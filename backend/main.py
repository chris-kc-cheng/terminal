"""FastAPI application — authentication + 12 protected financial data endpoints."""

import os
import time
import math
import json
import numpy as np
import pandas as pd
from functools import wraps
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError
from typing import Optional, List

from auth import authenticate_user, create_access_token, decode_token, get_user

load_dotenv()

app = FastAPI(title="Financial Terminal API", version="1.0.0")

# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------
ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://localhost:4173",
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in ALLOWED_ORIGINS],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

# ---------------------------------------------------------------------------
# Simple TTL cache
# ---------------------------------------------------------------------------
_cache: dict = {}

def ttl_cache(key_fn, ttl=3600):
    """Decorator-style TTL cache. key_fn(args, kwargs) -> cache key string."""
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            key = key_fn(*args, **kwargs)
            now = time.time()
            if key in _cache:
                val, ts = _cache[key]
                if now - ts < ttl:
                    return val
            result = fn(*args, **kwargs)
            _cache[key] = (result, now)
            return result
        return wrapper
    return decorator

def _safe(v):
    """Convert NaN/Inf to None for JSON serialization."""
    if v is None:
        return None
    if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
        return None
    return v

def _clean(obj):
    """Recursively clean NaN/Inf from dicts/lists."""
    if isinstance(obj, dict):
        return {k: _clean(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_clean(v) for v in obj]
    if isinstance(obj, float) and (math.isnan(obj) or math.isinf(obj)):
        return None
    return obj

# ---------------------------------------------------------------------------
# Auth dependency
# ---------------------------------------------------------------------------
def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_token(token)
        username: str = payload.get("sub")
        if not username:
            raise credentials_error
    except JWTError:
        raise credentials_error
    user = get_user(username)
    if not user:
        raise credentials_error
    return user


# ---------------------------------------------------------------------------
# Auth routes
# ---------------------------------------------------------------------------
@app.post("/auth/login")
def login(form: OAuth2PasswordRequestForm = Depends()):
    user = authenticate_user(form.username, form.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = create_access_token({"sub": user["username"]})
    return {"access_token": token, "token_type": "bearer"}


@app.get("/auth/me")
def read_me(current_user: dict = Depends(get_current_user)):
    return {
        "username": current_user["username"],
        "email": current_user["email"],
        "role": current_user["role"],
    }


@app.get("/api/greeting")
def greeting(current_user: dict = Depends(get_current_user)):
    return {"message": f"Hello, {current_user['username']}! This response came from FastAPI."}


@app.get("/health")
def health():
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# ALM — Cox-Ingersoll-Ross Model
# ---------------------------------------------------------------------------
@app.get("/api/alm")
def alm(
    scenarios: int = Query(default=20, ge=1, le=200),
    years: float = Query(default=10.0, ge=0.25, le=30.0),
    steps_per_year: int = Query(default=12, ge=1, le=52),
    a: float = Query(default=0.5, ge=0.0, le=10.0),
    b: float = Query(default=0.05, ge=0.0, le=0.20),
    sigma: float = Query(default=0.02, ge=0.0, le=0.20),
    init: float = Query(default=0.05, ge=0.0, le=0.20),
    current_user: dict = Depends(get_current_user),
):
    try:
        import toolkit as ftk
        rates_df, bonds_df = ftk.cir(
            years=years, a=a, b=b, sigma=sigma, init=init,
            scenarios=scenarios, steps_per_year=steps_per_year,
        )
        return _clean({
            "rates": rates_df.values.tolist(),
            "bonds": bonds_df.values.tolist(),
            "index": [str(x) for x in rates_df.index.tolist()],
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Multi-Period Linking
# ---------------------------------------------------------------------------
@app.get("/api/linking")
def linking(
    sample: int = Query(default=1, ge=1, le=2),
    current_user: dict = Depends(get_current_user),
):
    try:
        import toolkit as ftk

        if sample == 1:
            portfolio_data = {
                'Sector 1': [-0.06, 0.04, 0.04, 0.04],
                'Sector 2': [0.02, -0.12, -0.02, 0.06],
                'Sector 3': [-0.12, 0.04, 0.21, 0.06],
            }
            benchmark_data = {
                'Sector 1': [0.00, 0.03, -0.06, 0.08],
                'Sector 2': [0.04, 0.00, -0.04, 0.06],
                'Sector 3': [0.14, 0.00, -0.10, 0.00],
            }
        else:
            portfolio_data = {
                'Allocation': [0.10, 0.08, 0.05, 0.10],
                'Selection':  [0.11, 0.06, 0.15, 0.07],
            }
            benchmark_data = {
                'Allocation': [0.04, 0.06, 0.04, 0.05],
                'Selection':  [0.07, 0.03, 0.08, 0.05],
            }

        periods = [f"Q{i+1}" for i in range(4)]
        p = pd.DataFrame(portfolio_data, index=periods)
        b = pd.DataFrame(benchmark_data, index=periods)

        def df_to_list(df):
            return {"columns": df.columns.tolist(), "index": df.index.tolist(),
                    "data": df.values.tolist()}

        unadjusted = (p - b)
        carino_df = ftk.carino(p, b)
        frongello_df = ftk.frongello(p, b)
        frongello_r_df = ftk.frongello(p, b, sel=0)
        frongello_m_df = ftk.frongello(p, b, sel=0.5)

        return _clean({
            "portfolio": df_to_list(p),
            "benchmark": df_to_list(b),
            "unadjusted": df_to_list(unadjusted),
            "carino": df_to_list(carino_df),
            "frongello": df_to_list(frongello_df),
            "frongello_reversed": df_to_list(frongello_r_df),
            "frongello_modified": df_to_list(frongello_m_df),
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Options — Black-Scholes
# ---------------------------------------------------------------------------
OPTION_STRATEGIES = {
    "Long Call": [{"type": "Call", "strike": 100, "qty": 1}],
    "Long Put": [{"type": "Put", "strike": 100, "qty": 1}],
    "Short Call": [{"type": "Call", "strike": 100, "qty": -1}],
    "Short Put": [{"type": "Put", "strike": 100, "qty": -1}],
    "Bull Call Spread": [{"type": "Call", "strike": 95, "qty": 1}, {"type": "Call", "strike": 105, "qty": -1}],
    "Bear Put Spread": [{"type": "Put", "strike": 105, "qty": 1}, {"type": "Put", "strike": 95, "qty": -1}],
    "Long Straddle": [{"type": "Call", "strike": 100, "qty": 1}, {"type": "Put", "strike": 100, "qty": 1}],
    "Long Strangle": [{"type": "Call", "strike": 105, "qty": 1}, {"type": "Put", "strike": 95, "qty": 1}],
}

@app.get("/api/options/strategies")
def options_strategies(current_user: dict = Depends(get_current_user)):
    return {"strategies": list(OPTION_STRATEGIES.keys())}

@app.get("/api/options")
def options(
    strategy: str = Query(default="Long Call"),
    vol: float = Query(default=0.2, ge=0.01, le=1.0),
    time: float = Query(default=0.25, ge=0.01, le=2.0),
    rate: float = Query(default=0.05, ge=0.0, le=0.2),
    dvd: float = Query(default=0.0, ge=0.0, le=0.2),
    entry: float = Query(default=50.0, ge=0.0, le=100.0),
    current_user: dict = Depends(get_current_user),
):
    try:
        import toolkit as ftk
        positions = OPTION_STRATEGIES.get(strategy, OPTION_STRATEGIES["Long Call"])
        spots = np.linspace(50, 150, 101).tolist()

        price_total = np.zeros(len(spots))
        delta_total = np.zeros(len(spots))
        gamma_total = np.zeros(len(spots))
        theta_total = np.zeros(len(spots))
        vega_total = np.zeros(len(spots))
        premium_paid = 0.0

        for pos in positions:
            strike = pos["strike"]
            qty = pos["qty"]
            spot_arr = np.array(spots)
            entry_spot = 50 + entry  # entry_spot from 50 to 150

            if pos["type"] == "Call":
                inst = ftk.EuropeanCall(None, strike)
            else:
                inst = ftk.EuropeanPut(None, strike)

            price_arr = np.array([inst.price(s, rate, time, vol, dvd) for s in spots])
            delta_arr = np.array([inst.delta(s, rate, time, vol, dvd) for s in spots])
            gamma_arr = np.array([inst.gamma(s, rate, time, vol, dvd) for s in spots])
            theta_arr = np.array([inst.theta(s, rate, time, vol, dvd) for s in spots])
            vega_arr = np.array([inst.vega(s, rate, time, vol, dvd) for s in spots])

            price_total += qty * price_arr
            delta_total += qty * delta_arr
            gamma_total += qty * gamma_arr
            theta_total += qty * theta_arr
            vega_total += qty * vega_arr
            premium_paid += qty * inst.price(entry_spot, rate, time, vol, dvd)

        return _clean({
            "strategy": strategy,
            "positions": positions,
            "spots": spots,
            "price": price_total.tolist(),
            "delta": delta_total.tolist(),
            "gamma": gamma_total.tolist(),
            "theta": theta_total.tolist(),
            "vega": vega_total.tolist(),
            "premium_paid": float(premium_paid),
            "max_gain": float(np.max(price_total) - premium_paid),
            "max_loss": float(np.min(price_total) - premium_paid),
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Economic Indicators
# ---------------------------------------------------------------------------
@app.get("/api/economic")
def economic(current_user: dict = Depends(get_current_user)):
    cache_key = "economic"
    now = time.time()
    if cache_key in _cache:
        val, ts = _cache[cache_key]
        if now - ts < 3600:
            return val
    try:
        import toolkit as ftk

        ca = ftk.get_statcan_bulk(n=120)
        us = ftk.get_bls_bulk()

        ca_cpi = ca[41690973].ffill().pct_change(12).dropna() if 41690973 in ca.columns else pd.Series(dtype=float)
        ca_unemp = ca[2062815] / 100 if 2062815 in ca.columns else pd.Series(dtype=float)
        us_cpi = us['CUUR0000SA0'].ffill().pct_change(12).dropna() if 'CUUR0000SA0' in us.columns else pd.Series(dtype=float)
        us_unemp = us['LNS14000000'] / 100 if 'LNS14000000' in us.columns else pd.Series(dtype=float)

        def series_to_list(s):
            return [{"date": str(d), "value": _safe(float(v))} for d, v in s.items() if not pd.isna(v)]

        result = {
            "ca_cpi": series_to_list(ca_cpi),
            "ca_unemployment": series_to_list(ca_unemp),
            "us_cpi": series_to_list(us_cpi),
            "us_unemployment": series_to_list(us_unemp),
        }
        _cache[cache_key] = (result, now)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Equity Dashboard
# ---------------------------------------------------------------------------
EQUITY_INDICES = {
    '^GSPC': {'name': 'S&P 500', 'region': 'Americas', 'currency': 'USD'},
    '^DJI': {'name': 'Dow Jones', 'region': 'Americas', 'currency': 'USD'},
    '^IXIC': {'name': 'NASDAQ', 'region': 'Americas', 'currency': 'USD'},
    '^TSX': {'name': 'TSX Composite', 'region': 'Americas', 'currency': 'CAD'},
    '^BVSP': {'name': 'Bovespa', 'region': 'Americas', 'currency': 'BRL'},
    '^FTSE': {'name': 'FTSE 100', 'region': 'EMEA', 'currency': 'GBP'},
    '^GDAXI': {'name': 'DAX', 'region': 'EMEA', 'currency': 'EUR'},
    '^FCHI': {'name': 'CAC 40', 'region': 'EMEA', 'currency': 'EUR'},
    '^N225': {'name': 'Nikkei 225', 'region': 'Asia', 'currency': 'JPY'},
    '^HSI': {'name': 'Hang Seng', 'region': 'Asia', 'currency': 'HKD'},
    '000001.SS': {'name': 'Shanghai', 'region': 'Asia', 'currency': 'CNY'},
    '^AXJO': {'name': 'ASX 200', 'region': 'Asia', 'currency': 'AUD'},
}

@app.get("/api/equity")
def equity(
    currency: str = Query(default="Local"),
    lookback: int = Query(default=20, ge=5, le=252),
    current_user: dict = Depends(get_current_user),
):
    cache_key = f"equity_{currency}_{lookback}"
    now = time.time()
    if cache_key in _cache:
        val, ts = _cache[cache_key]
        if now - ts < 3600:
            return val
    try:
        import toolkit as ftk
        tickers = list(EQUITY_INDICES.keys())
        px = ftk.get_yahoo_bulk(tickers, period="2y")
        if px.empty:
            raise HTTPException(status_code=503, detail="No price data available")

        today = px.index[-1]
        rows = []
        for ticker, meta in EQUITY_INDICES.items():
            if ticker not in px.columns:
                continue
            s = px[ticker].dropna()
            if len(s) < 2:
                continue
            # compute MTD/QTD/YTD
            def ret(start_date):
                sub = s[s.index >= start_date]
                if len(sub) < 1:
                    return None
                start_val = s[s.index < start_date]
                if len(start_val) == 0:
                    return None
                return float(sub.iloc[-1] / start_val.iloc[-1] - 1)

            import datetime
            td = today.to_pydatetime() if hasattr(today, 'to_pydatetime') else today
            mtd_start = td.replace(day=1)
            q = ((td.month - 1) // 3) * 3 + 1
            qtd_start = td.replace(month=q, day=1)
            ytd_start = td.replace(month=1, day=1)

            sparkline = s.iloc[-lookback:].tolist()
            rows.append({
                "ticker": ticker,
                "name": meta["name"],
                "region": meta["region"],
                "currency": meta["currency"],
                "last": _safe(float(s.iloc[-1])),
                "date": str(today.date()),
                "mtd": _safe(ret(pd.Timestamp(mtd_start))),
                "qtd": _safe(ret(pd.Timestamp(qtd_start))),
                "ytd": _safe(ret(pd.Timestamp(ytd_start))),
                "sparkline": [_safe(float(v)) for v in sparkline],
            })

        result = {"data": rows}
        _cache[cache_key] = (result, now)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Fixed Income Dashboard
# ---------------------------------------------------------------------------
@app.get("/api/fixed-income")
def fixed_income(current_user: dict = Depends(get_current_user)):
    cache_key = "fixed_income"
    now = time.time()
    if cache_key in _cache:
        val, ts = _cache[cache_key]
        if now - ts < 3600:
            return val
    try:
        import toolkit as ftk

        # US yield curve
        us_curve = ftk.get_us_yield_curve(n=2)
        if us_curve.empty:
            us_records = []
        else:
            us_records = us_curve.reset_index().rename(columns={'index': 'date'}).to_dict(orient='records')
            us_records = [_clean({k: (str(v) if isinstance(v, pd.Timestamp) else v) for k, v in r.items()}) for r in us_records]

        # CA yield curve via BoC
        ca_series = ['V80691342', 'V80691344', 'V80691345', 'V80691346', 'V80691347',
                     'V80691348', 'V80691349', 'V80691350', 'V80691351', 'V80691352']
        ca_labels = ['3M', '6M', '1Y', '2Y', '3Y', '5Y', '7Y', '10Y', '20Y', '30Y']
        try:
            ca_raw = ftk.get_boc_bulk(ca_series)
            ca_curve = ca_raw.rename(columns=dict(zip(ca_series, ca_labels)))
            ca_records = []
            for date, row in ca_curve.iterrows():
                rec = {"date": str(date), "region": "Canada"}
                for label in ca_labels:
                    if label in row.index:
                        rec[label] = _safe(float(row[label])) if not pd.isna(row[label]) else None
                ca_records.append(rec)
        except Exception:
            ca_records = []

        result = {"us_curve": us_records, "ca_curve": ca_records}
        _cache[cache_key] = (result, now)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Currency / FX
# ---------------------------------------------------------------------------
FX_TICKERS = {
    'EURUSD=X': 'EUR', 'GBPUSD=X': 'GBP', 'JPYUSD=X': 'JPY',
    'CADUSD=X': 'CAD', 'AUDUSD=X': 'AUD', 'CHFUSD=X': 'CHF',
    'HKDUSD=X': 'HKD', 'CNHUSD=X': 'CNH',
}

@app.get("/api/currency")
def currency(
    lookback: int = Query(default=30, ge=1, le=365),
    show: str = Query(default="Change"),
    current_user: dict = Depends(get_current_user),
):
    cache_key = f"currency_{lookback}"
    now = time.time()
    if cache_key in _cache:
        val, ts = _cache[cache_key]
        if now - ts < 3600:
            cached_rates, cached_labels = val
        else:
            cached_rates, cached_labels = None, None
    else:
        cached_rates, cached_labels = None, None

    try:
        import toolkit as ftk
        if cached_rates is None:
            tickers = list(FX_TICKERS.keys())
            px = ftk.get_yahoo_bulk(tickers, period="1y")
            labels = list(FX_TICKERS.values())
            px = px.rename(columns=FX_TICKERS)
            cached_labels = labels
            cached_rates = px
            _cache[cache_key] = ((cached_rates, cached_labels), now)

        px = cached_rates
        labels = cached_labels

        # Get period returns
        recent = px.iloc[-lookback:]
        if len(recent) < 2:
            raise HTTPException(status_code=503, detail="Not enough data")

        start = recent.iloc[0]
        end = recent.iloc[-1]
        change = (end / start - 1) * 100  # percent

        n = len(labels)
        # Build n×n matrix: row = domestic, col = foreign (in terms of foreign per 1 USD)
        # Change matrix: how much foreign appreciated vs domestic
        matrix_val = []
        matrix_chg = []
        for i, dom in enumerate(labels):
            row_v = []
            row_c = []
            for j, fgn in enumerate(labels):
                if i == j:
                    row_v.append(1.0)
                    row_c.append(0.0)
                else:
                    # rate = fgn/dom
                    if dom in end.index and fgn in end.index and end[dom] != 0:
                        rate = float(end[fgn] / end[dom])
                        rate_start = float(start[fgn] / start[dom]) if start[dom] != 0 else None
                        chg = float(end[fgn] / end[dom] / (start[fgn] / start[dom]) - 1) * 100 if rate_start else 0.0
                    else:
                        rate = None
                        chg = None
                    row_v.append(_safe(rate))
                    row_c.append(_safe(chg))
            matrix_val.append(row_v)
            matrix_chg.append(row_c)

        return _clean({
            "labels": labels,
            "matrix_quote": matrix_val,
            "matrix_change": matrix_chg,
        })
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Heatmap — Periodic Table of Returns
# ---------------------------------------------------------------------------
HEATMAP_TICKERS = {
    'SPY': 'US Equity', 'EFA': 'Intl DM', 'EEM': 'EM Equity',
    'AGG': 'US Bonds', 'GLD': 'Gold', 'VNQ': 'REITs',
    'BCI': 'Commodities', 'SHY': 'Cash',
}

@app.get("/api/heatmap")
def heatmap(
    period: str = Query(default="Annually"),
    annualize: bool = Query(default=False),
    current_user: dict = Depends(get_current_user),
):
    cache_key = f"heatmap_{period}_{annualize}"
    now = time.time()
    if cache_key in _cache:
        val, ts = _cache[cache_key]
        if now - ts < 86400:
            return val
    try:
        import toolkit as ftk
        tickers = list(HEATMAP_TICKERS.keys())
        px = ftk.get_yahoo_bulk(tickers, period="10y").rename(columns=HEATMAP_TICKERS)

        freq_map = {"Monthly": "ME", "Quarterly": "QE", "Annually": "YE"}
        freq = freq_map.get(period, "YE")
        px_resampled = px.resample(freq).last()
        returns = px_resampled.pct_change().dropna()

        if annualize and period != "Annually":
            periods_per_year = {"Monthly": 12, "Quarterly": 4}.get(period, 1)
            returns = (1 + returns) ** periods_per_year - 1

        assets = returns.columns.tolist()
        periods_list = [str(d.date()) for d in returns.index]
        data = []
        for p_idx, p_date in enumerate(returns.index):
            for a_idx, asset in enumerate(assets):
                v = returns.iloc[p_idx][asset]
                data.append([a_idx, p_idx, _safe(round(float(v), 4)) if not pd.isna(v) else None])

        result = {"assets": assets, "periods": periods_list, "data": data}
        _cache[cache_key] = (result, now)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Portfolio Optimization
# ---------------------------------------------------------------------------
PORTFOLIO_TICKERS = {
    'VFIAX': 'US Large Cap', 'VSMAX': 'US Small Cap',
    'VTMGX': 'Intl DM', 'VEMAX': 'EM Equities',
    'VBTLX': 'US IG Bonds', 'VWEAX': 'US HY Bonds',
    'VGSLX': 'REITs', 'IAU': 'Gold',
}

@app.get("/api/portfolio")
def portfolio(
    rfr: float = Query(default=0.03, ge=0.0, le=0.15),
    min_bound: float = Query(default=0.0, ge=-1.0, le=1.0),
    max_bound: float = Query(default=1.0, ge=0.0, le=2.0),
    current_user: dict = Depends(get_current_user),
):
    cache_key = f"portfolio_{rfr}_{min_bound}_{max_bound}"
    now = time.time()
    if cache_key in _cache:
        val, ts = _cache[cache_key]
        if now - ts < 3600:
            return val
    try:
        import toolkit as ftk

        px = ftk.get_yahoo_bulk(list(PORTFOLIO_TICKERS.keys()), period="5y")
        px = px.rename(columns=PORTFOLIO_TICKERS)
        monthly = px.resample("ME").last().pct_change().dropna()

        cov = ftk.covariance(monthly, annualize=True)
        er = ftk.compound_return(monthly, annualize=True)

        strategies = {
            'Equal Weight': ftk.equal_weight(er),
            'Inverse Vol': ftk.inverse_vol(cov),
            'Min Volatility': ftk.min_vol(cov),
            'Risk Parity': ftk.risk_parity(cov),
        }
        try:
            strategies['Max Sharpe'] = ftk.max_sharpe(er, cov, rfr=rfr, min=min_bound, max=max_bound)
        except Exception:
            pass

        weights_dict = {name: {k: _safe(float(v)) for k, v in w.items()} for name, w in strategies.items()}
        risk_contrib = {name: {k: _safe(float(v)) for k, v in ftk.risk_contribution(w, cov).items()} for name, w in strategies.items()}

        # Risk-return for individual assets
        vols = {k: _safe(float(ftk.volatility(monthly[k], annualize=True))) for k in monthly.columns}
        rets = {k: _safe(float(er[k])) for k in er.index}

        # Risk-return for strategies
        strat_rr = {}
        for name, w in strategies.items():
            p_ret = ftk.portfolio_return(w, er)
            p_vol = ftk.portfolio_volatility(w, cov)
            strat_rr[name] = {"ret": _safe(float(p_ret)), "vol": _safe(float(p_vol))}

        result = {
            "assets": list(monthly.columns),
            "weights": weights_dict,
            "risk_contribution": risk_contrib,
            "asset_returns": rets,
            "asset_vols": vols,
            "strategy_rr": strat_rr,
        }
        _cache[cache_key] = (result, now)
        return _clean(result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Fama-French Factor Exposure
# ---------------------------------------------------------------------------
@app.get("/api/factors/datasets")
def factor_datasets(current_user: dict = Depends(get_current_user)):
    try:
        import toolkit as ftk
        datasets = ftk.get_famafrench_datasets()
        return {"datasets": datasets}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/factors")
def factors(
    ticker: str = Query(default="SPY"),
    dataset: str = Query(default="F-F_Research_Data_Factors"),
    mom: bool = Query(default=False),
    current_user: dict = Depends(get_current_user),
):
    cache_key = f"factors_{ticker}_{dataset}_{mom}"
    now = time.time()
    if cache_key in _cache:
        val, ts = _cache[cache_key]
        if now - ts < 3600:
            return val
    try:
        import toolkit as ftk

        ff = ftk.get_famafrench_factors(dataset, mom)
        price = ftk.get_yahoo(ticker.upper())
        returns = ftk.price_to_return(price)

        # Align
        ff.index = pd.to_datetime(ff.index.to_timestamp() if hasattr(ff.index, 'to_timestamp') else ff.index)
        returns.index = pd.to_datetime(returns.index)
        common = ff.index.intersection(returns.index)
        ff_aligned = ff.loc[common] / 100  # FF factors are in percentage
        ret_aligned = returns.loc[common]

        rfr = ff_aligned.iloc[:, -1]  # last column is RF
        factor_cols = ff_aligned.columns[:-1].tolist()
        factors_df = ff_aligned[factor_cols]
        excess_ret = ret_aligned - rfr

        betas = ftk.beta(excess_ret, factors_df)
        rsq = ftk.rsquared(excess_ret, factors_df)
        rsq_adj = ftk.rsquared(excess_ret, factors_df, adjusted=True)

        ann_ret = float(ftk.compound_return(ret_aligned, annualize=True))
        factor_ret = float(ftk.compound_return((betas * factors_df).sum(axis=1), annualize=True))

        # Time series for chart
        explained = (betas * factors_df).sum(axis=1)
        explained_price = ftk.return_to_price(explained)
        portfolio_price = ftk.return_to_price(ret_aligned)
        dates = [str(d.date()) for d in common]
        ep = [_safe(float(v)) for v in explained_price]
        pp = [_safe(float(v)) for v in portfolio_price]

        result = {
            "ticker": ticker.upper(),
            "dataset": dataset,
            "ann_return": _safe(ann_ret),
            "factor_return": _safe(factor_ret),
            "rsq": _safe(float(rsq)),
            "rsq_adj": _safe(float(rsq_adj)),
            "betas": {k: _safe(float(v)) for k, v in betas.items()},
            "factors": factor_cols,
            "dates": dates,
            "portfolio_price": pp,
            "explained_price": ep,
        }
        _cache[cache_key] = (result, now)
        return _clean(result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Peer Group Analysis
# ---------------------------------------------------------------------------
DEFAULT_PEERS = ['PRCOX', 'GQEFX', 'STSEX', 'NUESX', 'VTCLX']
DEFAULT_BENCHMARK = '^GSPC'

@app.get("/api/peers")
def peers(
    tickers: str = Query(default=",".join(DEFAULT_PEERS)),
    benchmark: str = Query(default=DEFAULT_BENCHMARK),
    rfr: float = Query(default=0.03, ge=0.0, le=0.15),
    period: str = Query(default="3Y"),
    current_user: dict = Depends(get_current_user),
):
    cache_key = f"peers_{tickers}_{benchmark}_{rfr}_{period}"
    now = time.time()
    if cache_key in _cache:
        val, ts = _cache[cache_key]
        if now - ts < 3600:
            return val
    try:
        import toolkit as ftk

        ticker_list = [t.strip() for t in tickers.split(",")]
        all_tickers = ticker_list + [benchmark]
        px = ftk.get_yahoo_bulk(all_tickers, period="20Y")
        px = px.resample("ME").last()
        rtn = ftk.price_to_return(px).dropna()

        # Trim to period
        period_map = {"1Y": 12, "3Y": 36, "5Y": 60, "10Y": 120}
        n_months = period_map.get(period, 36)
        if len(rtn) > n_months:
            rtn = rtn.iloc[-n_months:]

        rfr_monthly = (1 + rfr) ** (1 / 12) - 1
        rtn['RF'] = rfr_monthly

        funds = [t for t in ticker_list if t in rtn.columns]
        bm = benchmark if benchmark in rtn.columns else None

        if not funds:
            raise HTTPException(status_code=400, detail="No valid fund tickers found")

        fund_rtn = rtn[funds]
        bm_rtn = rtn[bm] if bm else pd.Series(0.0, index=rtn.index)

        # VAMI
        vami = ftk.return_to_price(fund_rtn).reset_index()
        vami['date'] = vami.iloc[:, 0].astype(str)
        vami_records = vami.drop(columns=[vami.columns[0]]).to_dict(orient='records')

        # Scatter: return vs vol
        scatter = []
        for f in funds:
            vol = float(ftk.volatility(fund_rtn[f], annualize=True))
            ret = float(ftk.compound_return(fund_rtn[f], annualize=True))
            scatter.append({"name": f, "vol": _safe(vol), "ret": _safe(ret)})

        # Summary table
        summary_rows = []
        for f in funds:
            try:
                ann_ret = float(ftk.compound_return(fund_rtn[f], annualize=True))
                ann_vol = float(ftk.volatility(fund_rtn[f], annualize=True))
                sharpe = float(ftk.sharpe(fund_rtn[f], rtn['RF']))
                max_dd = float(ftk.worst_drawdown(fund_rtn[f]))
                summary_rows.append({
                    "fund": f,
                    "ann_return": _safe(ann_ret),
                    "ann_vol": _safe(ann_vol),
                    "sharpe": _safe(sharpe),
                    "max_drawdown": _safe(max_dd),
                })
            except Exception:
                pass

        result = _clean({
            "funds": funds,
            "benchmark": bm,
            "vami": vami_records,
            "scatter": scatter,
            "summary": summary_rows,
        })
        _cache[cache_key] = (result, now)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Performance & Risk Analysis
# ---------------------------------------------------------------------------
@app.get("/api/performance")
def performance(
    fund: str = Query(default="SPY"),
    benchmark: str = Query(default="^GSPC"),
    rfr_ticker: str = Query(default="^IRX"),
    period: str = Query(default="3Y"),
    current_user: dict = Depends(get_current_user),
):
    cache_key = f"performance_{fund}_{benchmark}_{rfr_ticker}_{period}"
    now = time.time()
    if cache_key in _cache:
        val, ts = _cache[cache_key]
        if now - ts < 3600:
            return val
    try:
        import toolkit as ftk

        all_tickers = [fund, benchmark, rfr_ticker]
        px = ftk.get_yahoo_bulk(all_tickers, period="10Y")
        px = px.resample("ME").last()
        px.iloc[:, 2] = px.iloc[:, 2] / 12 / 100  # convert RFR to monthly decimal
        rtn = ftk.price_to_return(px).dropna()

        period_map = {"1Y": 12, "3Y": 36, "5Y": 60, "10Y": 120, "All": None}
        n = period_map.get(period)
        if n:
            rtn = rtn.iloc[-n:]

        f_col = rtn.columns[0]
        b_col = rtn.columns[1]
        r_col = rtn.columns[2]

        fund_r = rtn[f_col]
        bm_r = rtn[b_col]
        rfr_r = rtn[r_col]

        # Cumulative returns for chart
        vami = ftk.return_to_price(rtn[[f_col, b_col]])
        dates = [str(d) for d in vami.index]
        fund_vami = [_safe(float(v)) for v in vami[f_col]]
        bm_vami = [_safe(float(v)) for v in vami[b_col]]

        def s(fn, *args, **kwargs):
            try:
                v = fn(*args, **kwargs)
                return _safe(float(v))
            except Exception:
                return None

        metrics = {
            "Performance": {
                "Ann. Return": s(ftk.compound_return, fund_r, annualize=True),
                "Ann. Benchmark": s(ftk.compound_return, bm_r, annualize=True),
                "Best Month": s(ftk.best_period, fund_r),
                "Worst Month": s(ftk.worst_period, fund_r),
                "% Positive": s(ftk.avg_pos, fund_r),
            },
            "Risk": {
                "Ann. Volatility": s(ftk.volatility, fund_r, annualize=True),
                "Skewness": s(ftk.skew, fund_r),
                "Kurtosis": s(ftk.kurt, fund_r),
                "Max Drawdown": s(ftk.worst_drawdown, fund_r),
                "Semi-Deviation": s(ftk.semi_deviation, fund_r),
            },
            "Regression": {
                "Beta": s(ftk.beta, fund_r, bm_r),
                "Alpha (Ann.)": s(ftk.alpha, fund_r, bm_r, annualize=True, legacy=True),
                "Correlation": s(ftk.correlation, rtn[[f_col, b_col]].to_numpy()),
                "R-Squared": s(ftk.rsquared, fund_r, bm_r),
            },
            "Efficiency": {
                "Sharpe": s(ftk.sharpe, fund_r, rfr_r),
                "Sortino": s(ftk.sortino, fund_r, rfr_r),
                "Treynor": s(ftk.treynor, fund_r, bm_r, rfr_r),
                "Information Ratio": s(ftk.information_ratio, fund_r, bm_r),
                "Up Capture": s(ftk.up_capture, fund_r, bm_r),
                "Down Capture": s(ftk.down_capture, fund_r, bm_r),
                "Tracking Error": s(ftk.tracking_error, fund_r, bm_r, annualize=True),
            },
        }

        result = _clean({
            "fund": fund,
            "benchmark": benchmark,
            "dates": dates,
            "fund_vami": fund_vami,
            "bm_vami": bm_vami,
            "metrics": metrics,
            "observations": int(len(fund_r)),
        })
        _cache[cache_key] = (result, now)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

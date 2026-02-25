"""FastAPI application — authentication + 12 protected financial data endpoints."""

import os
import time
import math
import json
import numpy as np
import pandas as pd
import toolkit as ftk
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

        most_recent_year = returns.index.year.max()
        ytd_rets = returns[returns.index.year == most_recent_year]
        ytd = {
            col: _safe(float((1 + ytd_rets[col].dropna()).prod() - 1)) if len(ytd_rets[col].dropna()) > 0 else None
            for col in returns.columns
        }

        result = {"assets": assets, "periods": periods_list, "data": data, "ytd": ytd}
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
def _m(name, fn, fmt="pct"):
    """Compute one metric safely, returning {name, value, fmt}."""
    try:
        v = fn()
        if isinstance(v, (pd.Series, pd.DataFrame)):
            v = float(v.iloc[0]) if len(v) > 0 else None
        elif isinstance(v, np.ndarray):
            v = float(v.flat[0]) if v.size > 0 else None
        else:
            v = float(v)
        return {"name": name, "value": _safe(v), "fmt": fmt}
    except Exception:
        return {"name": name, "value": None, "fmt": fmt}


@app.get("/api/performance")
def performance(
    fund: str = Query(default="FCNTX"),
    benchmark: str = Query(default="^GSPC"),
    rfr_ticker: str = Query(default="^IRX"),
    period: str = Query(default="10Y"),
    window: str = Query(default="Cumulative"),
    window_size: int = Query(default=36, ge=6, le=120),
    market: str = Query(default="All"),
    ci: float = Query(default=0.95, ge=0.9, le=0.995),
    current_user: dict = Depends(get_current_user),
):
    cache_key = f"perf_{fund}_{benchmark}_{rfr_ticker}_{period}_{window}_{window_size}_{market}_{ci}"
    now = time.time()
    if cache_key in _cache:
        val, ts = _cache[cache_key]
        if now - ts < 3600:
            return val
    try:
        all_tickers = [fund, benchmark, rfr_ticker]
        px = ftk.get_yahoo_bulk(all_tickers, period="20Y")
        px = px.resample("ME").last()
        px.iloc[:, 2] = px.iloc[:, 2] / 12 / 100  # RFR: annualised % → monthly decimal
        rtn = ftk.price_to_return(px).dropna()

        period_map = {"1Y": 12, "3Y": 36, "5Y": 60, "10Y": 120, "All": None}
        n = period_map.get(period)
        if n:
            rtn = rtn.iloc[-n:]

        f_col, b_col, r_col = rtn.columns[0], rtn.columns[1], rtn.columns[2]
        fund_r = rtn[f_col]
        bm_r   = rtn[b_col]
        rfr_r  = rtn[r_col]

        # Market filter
        if market == "Up":
            mask = fund_r >= 0
            fund_r, bm_r, rfr_r = fund_r[mask], bm_r[mask], rfr_r[mask]
        elif market == "Down":
            mask = fund_r < 0
            fund_r, bm_r, rfr_r = fund_r[mask], bm_r[mask], rfr_r[mask]

        # Chart series based on window mode
        if window == "Rolling":
            chart_fund = fund_r.rolling(window_size).apply(
                lambda x: float((1 + x).prod() - 1), raw=True)
            chart_bm = bm_r.rolling(window_size).apply(
                lambda x: float((1 + x).prod() - 1), raw=True)
            chart_dates = [str(d) for d in chart_fund.index]
        elif window == "Trailing":
            cum_f = (1 + fund_r).cumprod()
            cum_b = (1 + bm_r).cumprod()
            chart_fund = cum_f.iloc[-1] / cum_f - 1
            chart_bm   = cum_b.iloc[-1] / cum_b - 1
            chart_dates = [str(d) for d in chart_fund.index]
        else:  # Cumulative (VAMI)
            vami = ftk.return_to_price(pd.concat([fund_r, bm_r], axis=1))
            chart_dates = [str(d) for d in vami.index]
            chart_fund  = vami.iloc[:, 0]
            chart_bm    = vami.iloc[:, 1]

        sig = 1 - ci

        perf_metrics = [
            _m("Annualized Return",              lambda: ftk.compound_return(fund_r, annualize=True)),
            _m("Cumulative Return",              lambda: ftk.compound_return(fund_r, annualize=False)),
            _m("Growth of $100",                 lambda: 100 * (1 + ftk.compound_return(fund_r, annualize=False)), fmt="dollar"),
            _m("Observations",                   lambda: float(fund_r.count()), fmt="int"),
            _m("Number of Positive Periods",     lambda: float((fund_r >= 0).sum()), fmt="int"),
            _m("Number of Negative Periods",     lambda: float((fund_r < 0).sum()), fmt="int"),
            _m("Average Return",                 lambda: ftk.arithmetic_mean(fund_r)),
            _m("Average Positive Return",        lambda: ftk.avg_pos(fund_r)),
            _m("Average Negative Return",        lambda: ftk.avg_neg(fund_r)),
            _m("Best Period",                    lambda: ftk.best_period(fund_r)),
            _m("Worst Period",                   lambda: ftk.worst_period(fund_r)),
            _m("Max Consecutive Gain Return",    lambda: ftk.max_consecutive_gain(fund_r)),
            _m("Max Consecutive Loss Return",    lambda: ftk.max_consecutive_loss(fund_r)),
            _m("Consecutive Positive Periods",   lambda: float(ftk.consecutive_positive_periods(fund_r)), fmt="int"),
            _m("Consecutive Negative Periods",   lambda: float(ftk.consecutive_negative_periods(fund_r)), fmt="int"),
            _m("Cumulative Excess Return",       lambda: ftk.active_return(fund_r, bm_r, annualize=False)),
            _m("Annualized Excess Return",       lambda: ftk.active_return(fund_r, bm_r, annualize=True)),
            _m("Excess Return - Geometric",      lambda: ftk.excess_return_geometric(fund_r, bm_r)),
            _m("Periods Above Benchmark",        lambda: float((fund_r - bm_r > 0).sum()), fmt="int"),
            _m("Percentage Above Benchmark",     lambda: (fund_r - bm_r > 0).mean()),
            _m("Percent Profitable Periods",     lambda: (fund_r > 0).mean()),
        ]

        risk_metrics = [
            _m("Annualized Volatility",  lambda: ftk.volatility(fund_r, annualize=True)),
            _m("Annualized Variance",    lambda: ftk.variance(fund_r, annualize=True)),
            _m("Skewness",               lambda: ftk.skew(fund_r), fmt="decimal"),
            _m("Excess Kurtosis",        lambda: ftk.kurt(fund_r), fmt="decimal"),
            _m("Jarque-Bera",            lambda: ftk.jarque_bera(fund_r), fmt="decimal"),
            _m("Max Drawdown",           lambda: ftk.worst_drawdown(fund_r)),
            _m("Average Drawdown",       lambda: ftk.all_drawdown(fund_r).mean()),
            _m("Current Drawdown",       lambda: ftk.current_drawdown(fund_r)),
            _m("Semi Deviation",         lambda: ftk.semi_deviation(fund_r)),
            _m("Gain Deviation (MAR)",   lambda: ftk.downside_risk(-fund_r, 0, annualize=True)),
            _m("Loss Deviation",         lambda: ftk.downside_risk(fund_r, rfr_r, ddof=0, annualize=True)),
            _m("Bias Ratio",             lambda: ftk.bias_ratio(fund_r), fmt="decimal"),
            _m("Gain/Loss Ratio",        lambda: ftk.gain_loss(fund_r), fmt="decimal"),
        ]

        var_metrics = [
            _m("Gaussian VaR",       lambda: ftk.var_normal(fund_r, sig=sig)),
            _m("Cornish-Fisher VaR", lambda: ftk.var_modified(fund_r, sig=sig)),
            _m("Gaussian CVaR",      lambda: ftk.cvar_normal(fund_r, sig=sig)),
        ]

        regression_metrics = [
            _m("Beta",                         lambda: ftk.beta(fund_r, bm_r), fmt="decimal"),
            _m("Beta T-Stat",                  lambda: ftk.beta_t_stat(fund_r, bm_r), fmt="decimal"),
            _m("Beta (Rfr Adjusted)",          lambda: ftk.beta(fund_r - rfr_r, bm_r - rfr_r), fmt="decimal"),
            _m("Alpha (Annualized)",           lambda: ftk.alpha(fund_r, bm_r, annualize=True, legacy=True)),
            _m("Jensen Alpha",                 lambda: ftk.alpha(fund_r, bm_r, rfr_r, annualize=True, legacy=True)),
            _m("Correlation",                  lambda: ftk.correlation(pd.concat([fund_r, bm_r], axis=1)).iloc[0, -1], fmt="decimal"),
            _m("R²",                           lambda: ftk.rsquared(fund_r, bm_r)),
            _m("Standard Error of Regression", lambda: ftk.ser(fund_r, bm_r), fmt="decimal"),
            _m("Autocorrelation",              lambda: float(fund_r.autocorr()), fmt="decimal"),
        ]

        efficiency_metrics = [
            _m("Sharpe Ratio",                lambda: ftk.sharpe(fund_r, rfr_r), fmt="decimal"),
            _m("Reward to Risk Ratio",        lambda: ftk.reward_to_risk(fund_r), fmt="decimal"),
            _m("Treynor Ratio",               lambda: ftk.treynor(fund_r, bm_r, rfr_r), fmt="decimal"),
            _m("Sortino Ratio",               lambda: ftk.sortino(fund_r, rfr_r), fmt="decimal"),
            _m("Sterling Ratio",              lambda: ftk.sterling_modified(fund_r), fmt="decimal"),
            _m("Calmar Ratio",                lambda: ftk.calmar(fund_r), fmt="decimal"),
            _m("Up Market Return",            lambda: ftk.up_market_return(fund_r, bm_r)),
            _m("Down Market Return",          lambda: ftk.down_market_return(fund_r, bm_r)),
            _m("Up Capture",                  lambda: ftk.up_capture(fund_r, bm_r)),
            _m("Down Capture",                lambda: ftk.down_capture(fund_r, bm_r)),
            _m("Tracking Error",              lambda: ftk.tracking_error(fund_r, bm_r, annualize=True)),
            _m("Information Ratio",           lambda: ftk.information_ratio(fund_r, bm_r), fmt="decimal"),
            _m("Batting Average",             lambda: ftk.batting_average(fund_r, bm_r)),
            _m("Up Period Batting Average",   lambda: ftk.up_batting_average(fund_r, bm_r)),
            _m("Down Market Batting Average", lambda: ftk.down_batting_average(fund_r, bm_r)),
            _m("Rolling Batting Average",     lambda: ftk.rolling_batting_average(fund_r, bm_r)),
        ]

        result = _clean({
            "fund": fund,
            "benchmark": benchmark,
            "window": window,
            "dates": chart_dates,
            "fund_chart":   [_safe(float(v)) for v in chart_fund],
            "bm_chart":     [_safe(float(v)) for v in chart_bm],
            "fund_returns": [_safe(float(v)) for v in fund_r],
            "bm_returns":   [_safe(float(v)) for v in bm_r],
            "observations": int(len(fund_r)),
            "metrics": {
                "Performance":   perf_metrics,
                "Risk":          risk_metrics,
                "Value at Risk": var_metrics,
                "Regression":    regression_metrics,
                "Efficiency":    efficiency_metrics,
            },
        })
        _cache[cache_key] = (result, now)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

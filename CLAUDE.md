# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A React + FastAPI port of [ftk-streamlit](https://github.com/chris-kc-cheng/ftk-streamlit) — a lightweight Bloomberg-like financial terminal. The original uses Streamlit; this version uses React (MUI) for the frontend and FastAPI with the **fintoolkit (`ftk`)** Python library for the backend. Frontend is deployed to GitHub Pages; backend to Render.com.

**Current state**: Authentication is fully working. All 17 pages are placeholder scaffolds — no `ftk` integration exists yet. The primary development work is implementing each page using `ftk`.

## Development Commands

### Frontend (`/frontend`)
```bash
npm run dev        # Start Vite dev server at http://localhost:5173
npm run build      # Production build (outputs to dist/)
npm run lint       # Run ESLint
npm run preview    # Preview production build locally
npm run deploy     # Build and deploy to GitHub Pages
```

### Backend (`/backend`)
```bash
uvicorn main:app --reload   # Start dev server at http://localhost:8000
pip install -r requirements.txt
```

## Architecture

### Frontend
- **React 19** + **Material-UI (MUI) v7** for UI
- **Vite** build tool with base path `/terminal/` (required for GitHub Pages)
- **No React Router** — navigation is handled via component state
- **Axios** HTTP client with JWT interceptor that auto-attaches tokens from localStorage
- **Context API** for global state:
  - [AuthContext.jsx](frontend/src/AuthContext.jsx): login/logout, token persistence in localStorage
  - [ThemeContext.jsx](frontend/src/ThemeContext.jsx): dark/light mode with localStorage persistence

Pages are organized into three sections: Market, Analysis, and Model. The layout uses MUI drawer navigation with responsive handling via `useMediaQuery`.

API base URL is configured via `VITE_API_URL` environment variable:
- Dev (`.env`): `http://localhost:8000`
- Prod (`.env.production`): Render.com URL

### Backend
- **FastAPI** with JWT auth (python-jose, passlib/bcrypt)
- **In-memory user store** (`FAKE_USERS` dict in [auth.py](backend/auth.py)) — not suitable for production
- Auth flow: `POST /auth/login` returns JWT → stored in localStorage → sent as `Authorization: Bearer` header on all subsequent requests
- CORS is configured via `ALLOWED_ORIGINS` env var

Key backend env vars (in `backend/.env`): `JWT_SECRET`, `JWT_ALGORITHM`, `JWT_EXPIRE_MINUTES`, `ALLOWED_ORIGINS`

### Page → Feature Mapping

Each page corresponds to a feature from the Streamlit reference app. Use `ftk` in the backend to implement the data/computation, then expose it via a FastAPI endpoint, and render it in the React page.

| Page | Feature to implement |
|------|---------------------|
| Market / Equity | Market index data via Yahoo Finance (`ftk`) |
| Market / Fixed Income | Yield curve construction and historical tracking |
| Market / Currency | FX rate heatmaps and cross-currency comparisons |
| Market / Indices | Major index performance visualization |
| Market / Yield Curve | Canadian and US yield curve movements |
| Analysis / Performance | Time-series fund evaluation, risk metrics, rolling stats |
| Analysis / Factor Analysis | Fama-French factor loading via regression |
| Analysis / Portfolio | Risk-return optimization across weighting strategies |
| Analysis / Heatmap | Periodic-table style asset class returns ("periodic table of returns") |
| Analysis / Peers | Multi-fund peer group benchmarking |
| Analysis / Factors | Multi-factor analysis tools |
| Model / Risk Model | Risk model outputs and backtests |
| Model / ALM | Cox-Ingersoll-Ross interest rate scenario generation |
| Model / Options | Black-Scholes pricing with Greeks visualization |
| Model / Linking | Multi-period index linking tools |

### Deployment
- Frontend auto-deploys via GitHub Actions on push to `main` (only when `frontend/` files change)
- Vite config sets `base: '/terminal/'` — required for all asset paths on GitHub Pages
- See [DEPLOY.md](DEPLOY.md) for full deployment instructions and demo credentials

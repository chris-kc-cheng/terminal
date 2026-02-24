# Financial Terminal

A Bloomberg-inspired financial terminal built with **React + FastAPI**, ported from [ftk-streamlit](https://github.com/chris-kc-cheng/ftk-streamlit).

**[Try the live demo →](https://chris-kc-cheng.github.io/terminal/)**

> **Disclaimer:** This project is purely experimental, created to explore the power of agentic AI. The application is far from complete and should not be used for any real financial decision-making.

---

## Built with Claude AI

This entire codebase — every component, endpoint, chart, and configuration — was written by **[Claude Code](https://claude.ai/code)** (Anthropic's agentic AI CLI) using **natural language instructions only**. No code was written by hand. The developer interacted exclusively through conversational prompts such as:

- *"Implement all 12 pages with ECharts and FastAPI endpoints"*
- *"Replace the user chip with an avatar menu with Profile and Logout options"*
- *"Move the toolkit import to the top level to reduce duplication"*

This project demonstrates what is possible when an AI agent autonomously handles architecture decisions, writes full-stack code, fixes bugs, manages git history, and deploys to production — all from plain English.

---

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Material UI v7, Apache ECharts |
| Backend | FastAPI, Python, fintoolkit (`ftk`) |
| Auth | JWT (python-jose, passlib) |
| Build | Vite, GitHub Actions |
| Hosting | GitHub Pages (frontend), Render.com (backend) |

## Pages

### Market
- **Equity** — Global index dashboard (Americas / Asia / EMEA) with MTD/QTD/YTD performance
- **Fixed Income** — US and Canadian yield curves
- **Currency** — FX cross-rate heatmap
- **Economic Indicators** — CPI and unemployment trends (Canada vs US)
- **Heat Map** — Periodic table of asset class returns

### Analysis
- **Performance & Risk** — Cumulative returns, drawdown, Sharpe, alpha/beta, and more
- **Portfolio Optimization** — Equal Weight, Inverse Vol, Min Vol, Risk Parity, Max Sharpe
- **Factor Exposure** — Fama-French factor regression
- **Peer Group** — Multi-fund VAMI comparison and scatter analysis

### Model
- **Options** — Black-Scholes pricing with full Greeks visualization
- **Yield Curve** — Cox-Ingersoll-Ross interest rate scenario simulation
- **Multi-Period Linking** — Carino and Frongello return attribution

## Demo credentials

| Username | Password |
|----------|----------|
| `demo` | `demo` |

See [DEPLOY.md](DEPLOY.md) for full deployment instructions.

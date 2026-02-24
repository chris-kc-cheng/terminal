# Deployment Guide

## Directory layout

```
terminal/
├── frontend/   ← React + Vite + Material UI
└── backend/    ← FastAPI
```

---

## 1. Deploy the FastAPI backend to Render

### One-time setup

1. Push the `backend/` folder to a GitHub repository
   (can be the same repo as the frontend or a separate one).

2. Go to **https://render.com** → **New → Web Service**.

3. Connect your GitHub repo and set:

   | Field | Value |
   |---|---|
   | Root directory | `backend` |
   | Runtime | **Python 3** |
   | Build command | `pip install -r requirements.txt` |
   | Start command | `uvicorn main:app --host 0.0.0.0 --port $PORT` |

4. Under **Environment Variables** add:

   | Key | Value |
   |---|---|
   | `JWT_SECRET` | a long random string (e.g. output of `python -c "import secrets; print(secrets.token_hex(32))"`) |
   | `JWT_ALGORITHM` | `HS256` |
   | `JWT_EXPIRE_MINUTES` | `60` |
   | `ALLOWED_ORIGINS` | `https://<your-github-username>.github.io` |

5. Deploy. Render gives you a URL like `https://your-app-name.onrender.com`.

---

## 2. Deploy the React frontend to GitHub Pages

### 2a. Configure the production API URL

Edit `frontend/.env.production`:
```
VITE_API_URL=https://your-app-name.onrender.com
```

### 2b. Set the Vite base path

In `frontend/vite.config.js` change `base` to your **repo name**:
```js
base: '/your-repo-name/',
```
This is required because GitHub Pages serves the site at
`https://<username>.github.io/<repo-name>/`.

If you use a custom domain or a `<username>.github.io` root repo, set `base: '/'`.

### 2c. Add the `homepage` field to package.json

```json
"homepage": "https://<your-github-username>.github.io/<your-repo-name>"
```

### 2d. First-time GitHub setup

```bash
cd frontend

# Initialise git if not already done
git init
git remote add origin https://github.com/<username>/<repo-name>.git
git add .
git commit -m "initial commit"
git push -u origin main
```

### 2e. Deploy (every time you want to publish)

```bash
cd frontend
npm run deploy
```

This runs `vite build` then pushes the `dist/` folder to the `gh-pages` branch.

### 2f. Enable GitHub Pages

1. In the repo → **Settings → Pages**
2. Set **Source** to **Deploy from a branch**, branch `gh-pages`, folder `/ (root)`.
3. Your site will be live at `https://<username>.github.io/<repo-name>/`.

---

## 3. Running locally

### Backend

```bash
cd backend

# Create and activate a virtual environment
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate

pip install -r requirements.txt
uvicorn main:app --reload
# API available at http://localhost:8000
# Swagger UI at http://localhost:8000/docs
```

### Frontend

```bash
cd frontend
npm install
npm run dev
# App available at http://localhost:5173
```

---

## 4. Demo credentials

| Username | Password | Role  |
|----------|----------|-------|
| admin    | secret   | admin |
| alice    | password123 | user |

---

## 5. Security checklist before going to production

- [ ] Replace the in-memory `FAKE_USERS` dict with a real database (PostgreSQL, SQLite, etc.)
- [ ] Set a strong `JWT_SECRET` environment variable on Render (never commit it)
- [ ] Restrict `ALLOWED_ORIGINS` to only your GitHub Pages domain
- [ ] Enable HTTPS everywhere (Render and GitHub Pages both provide it for free)
- [ ] Consider adding refresh tokens for long-lived sessions

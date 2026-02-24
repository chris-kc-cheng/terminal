"""FastAPI application — authentication + protected example endpoints."""

import os
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError

from auth import authenticate_user, create_access_token, decode_token, get_user

load_dotenv()

app = FastAPI(title="MyApp API", version="1.0.0")

# ---------------------------------------------------------------------------
# CORS — add your GitHub Pages origin in production
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
# Dependency: resolve the current authenticated user from the Bearer token
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
    """Return the profile of the currently authenticated user."""
    return {
        "username": current_user["username"],
        "email": current_user["email"],
        "role": current_user["role"],
    }


# ---------------------------------------------------------------------------
# Protected example API route
# ---------------------------------------------------------------------------
@app.get("/api/greeting")
def greeting(current_user: dict = Depends(get_current_user)):
    """A simple protected endpoint that returns a personalised greeting."""
    return {"message": f"Hello, {current_user['username']}! This response came from FastAPI."}


# ---------------------------------------------------------------------------
# Health-check (public)
# ---------------------------------------------------------------------------
@app.get("/health")
def health():
    return {"status": "ok"}

"""Authentication.

Built-in email/password auth issues HS256 JWTs. If SUPABASE_JWT_SECRET is set,
Supabase Auth access tokens are accepted too and users are provisioned on first
request — the rest of the system only ever sees `User` rows.
"""
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
import bcrypt
from sqlalchemy.orm import Session

from .config import get_settings
from .db import get_db
from app.models.models import User

bearer = HTTPBearer(auto_error=False)
settings = get_settings()
ALGO = "HS256"


def hash_password(p: str) -> str:
    return bcrypt.hashpw(p.encode()[:72], bcrypt.gensalt()).decode()


def verify_password(p: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(p.encode()[:72], hashed.encode())
    except ValueError:
        return False


def create_access_token(user_id: str) -> str:
    exp = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    return jwt.encode({"sub": user_id, "exp": exp, "iss": "invito"}, settings.secret_key, algorithm=ALGO)


def _decode(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, settings.secret_key, algorithms=[ALGO])
    except JWTError:
        pass
    if settings.supabase_jwt_secret:
        try:
            return jwt.decode(token, settings.supabase_jwt_secret, algorithms=[ALGO], audience="authenticated")
        except JWTError:
            return None
    return None


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    if not creds:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    payload = _decode(creds.credentials)
    if not payload or "sub" not in payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    user = db.get(User, payload["sub"])
    if not user and payload.get("iss") != "invito":
        # Supabase user seen for the first time → provision
        user = User(id=payload["sub"], email=payload.get("email", f"{payload['sub']}@supabase.local"), name=payload.get("user_metadata", {}).get("name"))
        db.add(user)
        db.commit()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user

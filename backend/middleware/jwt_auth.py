"""
JWT authentication dependency for FastAPI routes.
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jwt.exceptions import PyJWTError
from typing import Optional

from services.session_token import decode_session_token

bearer_scheme = HTTPBearer(auto_error=False)


async def require_auth(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> dict:
    """
    FastAPI dependency - validates Bearer JWT and returns the decoded payload.
    Raises 401 if token is missing, expired, or invalid.
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        payload = decode_session_token(credentials.credentials)
        if not payload.get("sub"):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        return payload
    except PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expired or invalid",
            headers={"WWW-Authenticate": "Bearer"},
        )

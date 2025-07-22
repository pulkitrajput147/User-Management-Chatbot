import os
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Body, Query
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from pydantic import BaseModel
import logging

# --- Configuration ---
logger = logging.getLogger(__name__)
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "a_very_secret_key_for_development_only")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24

AUTHORIZED_EMAILS = {
    "john32@gmail.com",
    "testuser1@example.com",
    "admin@example.com",
    "jane.doe@testing.co",
    "pulkitrajput147@gmail.com" # Added your email for testing
}

# --- THIS IS THE KEY BACKEND CHANGE ---
# Set auto_error=False so it doesn't immediately fail if the header is missing.
# This allows our code to check for the token in the query parameter as a fallback.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login", auto_error=False)

router = APIRouter(
    prefix="/auth",
    tags=["Authentication"]
)

# --- Pydantic Models ---
class Token(BaseModel):
    access_token: str
    token_type: str

class LoginRequest(BaseModel):
    email: str

# --- Core Authentication Functions ---
def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=15))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(
    token_from_header: str | None = Depends(oauth2_scheme),
    token_from_query: str | None = Query(None, alias="token") # For EventSource
) -> dict:
    """
    Dependency to verify JWT token from either 'Authorization' header or a query parameter.
    This makes authentication compatible with both standard fetch and EventSource.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    # Prioritize the token from the header, but fall back to the one from the query.
    token = token_from_header or token_from_query

    if token is None:
        logger.debug("Authentication failed: No token found in header or query parameter.")
        raise credentials_exception

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            logger.warning("Authentication failed: Token payload is missing 'sub' (email).")
            raise credentials_exception
        return {"email": email}
    except JWTError as e:
        logger.error(f"JWT Error during token decoding: {e}")
        raise credentials_exception

# --- API Endpoints ---
@router.post("/login", response_model=Token)
async def login_for_access_token(request: LoginRequest = Body(...)):
    user_email = request.email.lower()
    if user_email not in AUTHORIZED_EMAILS:
        logger.warning(f"Failed login attempt for unauthorized email: {user_email}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email not authorized for access",
        )

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user_email}, expires_delta=access_token_expires
    )
    logger.info(f"Successful login for: {user_email}. Token issued.")
    return {"access_token": access_token, "token_type": "bearer"}

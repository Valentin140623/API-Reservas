"""Base de datos. En local es un fichero SQLite; en producción basta con poner DATABASE_URL (PostgreSQL)."""
import os
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from sqlalchemy.pool import StaticPool

URL = os.environ.get("DATABASE_URL") or f"sqlite:///{Path(__file__).resolve().parent.parent / 'datos.db'}"
# Render/Heroku dan "postgres://..."; SQLAlchemy con psycopg 3 necesita "postgresql+psycopg://..."
if URL.startswith("postgres://"):
    URL = "postgresql+psycopg://" + URL[len("postgres://"):]
elif URL.startswith("postgresql://"):
    URL = "postgresql+psycopg://" + URL[len("postgresql://"):]

if URL.startswith("sqlite"):
    # "sqlite://" (en memoria, para tests) necesita una única conexión compartida
    extra = {"poolclass": StaticPool} if URL == "sqlite://" else {}
    engine = create_engine(URL, connect_args={"check_same_thread": False}, **extra)
else:
    engine = create_engine(URL, pool_pre_ping=True)
Sesion = sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def obtener_sesion():
    with Sesion() as s:
        yield s

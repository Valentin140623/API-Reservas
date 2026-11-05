import os
import sys
from pathlib import Path

os.environ["DATABASE_URL"] = "sqlite://"  # base de datos en memoria para los tests
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest
from sqlalchemy.pool import StaticPool
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app import db


@pytest.fixture
def sesion():
    eng = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    db.Base.metadata.create_all(eng)
    with sessionmaker(eng)() as s:
        yield s

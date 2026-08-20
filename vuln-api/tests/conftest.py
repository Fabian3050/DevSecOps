import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.main import app
from app.db import Base, get_db

# Base de datos de prueba en memoria (SQLite)
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},  # Necesario solo para SQLite
    poolclass=StaticPool, 
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db_session():
    """Crea una sesión de base de datos limpia para cada test"""
    # Crear todas las tablas
    Base.metadata.create_all(bind=engine)
    
    # Crear sesión
    db = TestingSessionLocal()
    
    try:
        yield db
        # Hacer rollback de cualquier transacción pendiente
        db.rollback()
    finally:
        db.close()
        # Limpiar todas las tablas después de cada test
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db_session):
    """Crea un cliente de prueba de FastAPI con la DB de prueba"""
    # Sobrescribir la dependencia get_db para usar nuestra DB de prueba
    def override_get_db():
        try:
            yield db_session
        finally:
            # No cerrar la sesión aquí, se cierra en el fixture db_session
            pass
    
    app.dependency_overrides[get_db] = override_get_db
    
    # Crear el cliente de prueba
    with TestClient(app) as test_client:
        yield test_client
    
    # Limpiar los overrides después del test
    app.dependency_overrides.clear()

from unittest.mock import patch
from fastapi import BackgroundTasks

@pytest.fixture(autouse=True)
def mock_fetch_agents_global():
    with patch("app.main.fetch_all_agents", return_value=[]) as mock:
        yield mock

class DummySession:
    def __init__(self, session):
        self._session = session
    def __getattr__(self, name):
        return getattr(self._session, name)
    def close(self):
        pass # Do not close the test session!

@pytest.fixture(autouse=True)
def mock_bg_and_session(db_session):
    def sync_add_task(self, func, *args, **kwargs):
        return func(*args, **kwargs)
        
    dummy = DummySession(db_session)
    with patch("app.main.SessionLocal", return_value=dummy):
        with patch.object(BackgroundTasks, "add_task", sync_add_task):
            yield


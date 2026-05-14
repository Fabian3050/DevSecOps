import pytest
from unittest.mock import patch
from app.models import User, WazuhConnection, Managers, Assets, VulnerabilityCatalog, VulnerabilityDetections
from app.auth import hash_password
from app.crypto import encrypt

# --- Helpers ---

def _get_auth_headers(client, db_session):
    # Crear admin si no existe
    admin = db_session.query(User).filter_by(username="qa_admin").first()
    if not admin:
        admin = User(username="qa_admin", password_hash=hash_password("Password123!"), is_active=True)
        db_session.add(admin)
        db_session.commit()
    
    res = client.post("/auth/login", data={"username": "qa_admin", "password": "Password123!"})
    return {"Authorization": f"Bearer {res.json()['access_token']}"}

def _create_test_manager(db_session, name="Test Manager"):
    manager = Managers(name=name, api_url="https://wazuh.test:9200")
    db_session.add(manager)
    db_session.commit()
    db_session.refresh(manager)
    return manager

# --- Tests para Nuevos Endpoints ---

def test_list_managers(client, db_session):
    headers = _get_auth_headers(client, db_session)
    _create_test_manager(db_session, "Manager A")
    _create_test_manager(db_session, "Manager B")
    
    response = client.get("/managers", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 2
    assert any(m["name"] == "Manager A" for m in data)

def test_list_assets(client, db_session):
    headers = _get_auth_headers(client, db_session)
    manager = _create_test_manager(db_session)
    
    asset = Assets(
        wazuh_agent_id="001",
        hostname="test-host",
        ip_address="192.168.1.10",
        os_version="22.04",
        manager_id=manager.id # manager.id ya es un objeto UUID
    )
    db_session.add(asset)
    db_session.commit()
    
    response = client.get("/assets", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["hostname"] == "test-host"

def test_list_vulnerability_catalog(client, db_session):
    headers = _get_auth_headers(client, db_session)
    
    cve = VulnerabilityCatalog(
        cve_id="CVE-2024-0001",
        severity="CRITICAL",
        description="Test critical vuln",
        cvss_score=9.8
    )
    db_session.add(cve)
    db_session.commit()
    
    response = client.get("/vulnerability-catalog", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert any(v["cve_id"] == "CVE-2024-0001" for v in data)

# --- Tests para Lógica de Sincronización (Deep Sync) ---

@patch("app.main.fetch_all_vulns")
def test_sync_creates_manager_and_assets(mock_fetch, client, db_session):
    headers = _get_auth_headers(client, db_session)
    
    # Configurar conexión de prueba
    conn = WazuhConnection(
        name="SyncConn",
        indexer_url="https://sync.test:9200",
        wazuh_user="admin",
        wazuh_password=encrypt("pass")
    )
    db_session.add(conn)
    db_session.commit()

    # Mock de respuesta de Wazuh con nueva estructura
    mock_fetch.return_value = [{
        "agent": {"id": "999", "name": "new-agent"},
        "host": {"ip": "10.0.0.5", "os": {"version": "22.04"}},
        "package": {"name": "bash", "version": "5.0"},
        "vulnerability": {
            "id": "CVE-2024-SYNC",
            "severity": "high",
            "description": "Sync test",
            "score": {"base": 8.0}
        }
    }]

    # Ejecutar Sincronización
    response = client.post(f"/wazuh-connections/{conn.id}/sync", headers=headers)
    assert response.status_code == 200
    
    # Verificar que se creó el Manager automáticamente
    manager = db_session.query(Managers).filter_by(name="SyncConn").first()
    assert manager is not None
    assert manager.api_url == "https://sync.test:9200"

    # Verificar que se creó el Asset
    asset = db_session.query(Assets).filter_by(wazuh_agent_id="999").first()
    assert asset is not None
    assert asset.hostname == "new-agent"
    assert asset.ip_address == "10.0.0.5"

    # Verificar que se registró la detección en el catálogo y tabla de detecciones
    catalog_item = db_session.query(VulnerabilityCatalog).filter_by(cve_id="CVE-2024-SYNC").first()
    assert catalog_item is not None
    assert catalog_item.severity == "HIGH"

    detection = db_session.query(VulnerabilityDetections).filter_by(asset_id=asset.id).first()
    assert detection is not None
    assert detection.cve_id == "CVE-2024-SYNC"

# --- Tests de Validación ---

def test_password_strength_validation(client, db_session):
    headers = _get_auth_headers(client, db_session)
    
    # Contraseña débil (solo letras)
    response = client.post("/auth/change-password", 
        json={"old_password": "Password123!", "new_password": "weak", "confirm_password": "weak"},
        headers=headers)
    assert response.status_code == 400
    assert "no es suficientemente robusta" in response.json()["detail"]

    # Contraseña fuerte
    response = client.post("/auth/change-password", 
        json={"old_password": "Password123!", "new_password": "Strong_Pass123!", "confirm_password": "Strong_Pass123!"},
        headers=headers)
    assert response.status_code == 200

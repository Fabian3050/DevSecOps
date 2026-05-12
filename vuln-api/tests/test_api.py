import pytest
from unittest.mock import patch
from app.models import User, WazuhConnection, WazuhVulnerability, VulnerabilityHistory
from app.auth import hash_password
from app.crypto import encrypt

#helpers

def _create_user(db, username="admin", password="admin", is_active=True):
    user = User(username=username, password_hash=hash_password(password), is_active=is_active)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _get_headers(client, username="admin", password="admin"):
    res = client.post("/auth/login", data={"username": username, "password": password})
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


def _create_connection(db, name="test-conn", is_active=True):
    conn = WazuhConnection(
        name=name,
        indexer_url="https://wazuh.local:9200",
        wazuh_user="admin",
        wazuh_password=encrypt("secret"),
        is_active=is_active,
    )
    db.add(conn)
    db.commit()
    db.refresh(conn)
    return conn


def _raw_vuln(cve="CVE-2023-9999", severity="High"):
    return [{
        "agent": {"id": "001", "name": "host-1"},
        "host": {"os": {"full": "Ubuntu 22.04", "platform": "ubuntu", "version": "22.04"}},
        "package": {"name": "curl", "version": "7.81", "type": "deb", "architecture": "amd64"},
        "vulnerability": {
            "id": cve, "severity": severity,
            "score": {"base": 6.0, "version": "3.1"},
            "detected_at": None, "published_at": None,
            "description": "desc", "reference": "https://ref",
            "scanner": {"vendor": "wazuh"},
        },
    }]


MOCK_VULN = [
    {
        "agent": {"id": "001", "name": "agent-1"},
        "host": {"os": {"full": "Ubuntu 22.04", "platform": "ubuntu", "version": "22.04"}},
        "package": {"name": "openssl", "version": "1.1.1", "type": "deb", "architecture": "amd64"},
        "vulnerability": {
            "id": "CVE-2023-0001", "severity": "High",
            "score": {"base": 7.5, "version": "3.1"},
            "detected_at": None, "published_at": None,
            "description": "Test vuln", "reference": "https://nvd.nist.gov",
            "scanner": {"vendor": "wazuh"},
        },
    }
]


#auth

def test_login_fail(client):
    response = client.post("/auth/login", data={"username": "wrong", "password": "password"})
    assert response.status_code == 400
    assert response.json()["detail"] == "Usuario o contraseña incorrectos"

def test_login_inactive_user(client, db_session):
    _create_user(db_session, is_active=False) 
    res = client.post("/auth/login", data={"username": "admin", "password": "admin"})
    assert res.status_code == 400

def test_login_success(client, db_session):
    _create_user(db_session)
    res = client.post("/auth/login", data={"username": "admin", "password": "admin"})
    assert res.status_code == 200
    assert "access_token" in res.json()


def test_login_unknown_user(client):
    res = client.post("/auth/login", data={"username": "ghost", "password": "x"})
    assert res.status_code == 400


def test_protected_route_without_token(client):
    assert client.get("/users/me").status_code == 401


def test_protected_route_invalid_token(client):
    res = client.get("/users/me", headers={"Authorization": "Bearer token.invalido"})
    assert res.status_code == 401


def test_sync_vulnerabilities_unauthorized(client, db_session):
    conn = _create_connection(db_session)
    response = client.post(f"/wazuh-connections/{conn.id}/sync")
    assert response.status_code == 401


@patch("app.main.fetch_all_vulns")
def test_sync_vulnerabilities_success(mock_fetch, client, db_session):
    from app.auth import pwd_context
    test_user = User(username="admin", password_hash=pwd_context.hash("admin"), is_active=True)
    db_session.add(test_user)
    conn = WazuhConnection(
        name="test", indexer_url="https://x:9200",
        wazuh_user="admin", wazuh_password=encrypt("secret"), is_active=True,
    )
    db_session.add(conn)
    db_session.commit()

    login_res = client.post("/auth/login", data={"username": "admin", "password": "admin"})
    headers = {"Authorization": f"Bearer {login_res.json()['access_token']}"}

    mock_fetch.return_value = [{
        "agent": {"id": "001", "name": "test-agent"},
        "host": {"os": {"full": "Ubuntu 22.04", "platform": "ubuntu", "version": "22.04"}},
        "package": {"name": "openssl", "version": "1.1.1", "type": "deb", "architecture": "amd64"},
        "vulnerability": {
            "id": "CVE-2023-1234", "severity": "High",
            "score": {"base": 7.5, "version": "3.1"},
            "detected_at": None, "published_at": None,
            "description": "Test", "reference": "https://nvd.nist.gov",
            "scanner": {"vendor": "wazuh"},
        },
    }]

    sync_res = client.post(f"/wazuh-connections/{conn.id}/sync", headers=headers)
    assert sync_res.status_code == 200
    assert sync_res.json()["synced"] == 1

    get_res = client.get("/vulns", headers=headers)
    assert len(get_res.json()) == 1
    vuln_item = get_res.json()[0]
    assert vuln_item["cve_id"] == "CVE-2023-1234"
    # new requirement: response should include origin connection name
    assert vuln_item.get("connection_name") == "test"


def test_change_password_success(client, db_session):
    _create_user(db_session)
    client.post("/auth/change-password",
                json={"old_password": "admin", "new_password": "Nueva123!", "confirm_password": "Nueva123!"},
                headers=_get_headers(client))
    res = client.post("/auth/login", data={"username": "admin", "password": "Nueva123!"})
    assert res.status_code == 200


def test_change_password_wrong_old(client, db_session):
    _create_user(db_session)
    res = client.post("/auth/change-password",
                      json={"old_password": "incorrecta", "new_password": "Nueva123!", "confirm_password": "Nueva123!"},
                      headers=_get_headers(client))
    assert res.status_code == 400


def test_change_password_same_as_old(client, db_session):
    _create_user(db_session)
    res = client.post("/auth/change-password",
                      json={"old_password": "admin", "new_password": "admin", "confirm_password": "admin"},
                      headers=_get_headers(client))
    assert res.status_code == 400


def test_change_password_unauthenticated(client):
    res = client.post("/auth/change-password",
                      json={"old_password": "admin", "new_password": "Nueva123!", "confirm_password": "Nueva123!"})
    assert res.status_code == 401

def test_change_password_mismatch(client, db_session):
    _create_user(db_session)
    res = client.post("/auth/change-password",
                      json={"old_password": "admin", "new_password": "Nueva123!", "confirm_password": "Otra456!"},
                      headers=_get_headers(client))
    assert res.status_code == 400

#users me

def test_get_me(client, db_session):
    _create_user(db_session)
    res = client.get("/users/me", headers=_get_headers(client))
    assert res.status_code == 200
    assert res.json()["username"] == "admin"
    assert res.json()["is_active"] is True


def test_get_me_is_active_false_after_deactivation(client, db_session):
    _create_user(db_session)
    headers = _get_headers(client) 
    me = client.get("/users/me", headers=headers).json()

    user = db_session.query(User).filter_by(id=me["id"]).first()
    user.is_active = False
    db_session.commit()

    res = client.get("/users/me", headers=headers) 
    assert res.json()["is_active"] is False 


#users crud

def test_create_user(client, db_session):
    _create_user(db_session)
    res = client.post("/users", json={"username": "nuevo", "password": "pass123"},
                      headers=_get_headers(client))
    assert res.status_code == 200


def test_create_user_duplicate(client, db_session):
    _create_user(db_session)
    headers = _get_headers(client)
    client.post("/users", json={"username": "dup", "password": "x"}, headers=headers)
    res = client.post("/users", json={"username": "dup", "password": "y"}, headers=headers)
    assert res.status_code == 400


def test_create_user_unauthenticated(client):
    assert client.post("/users", json={"username": "x", "password": "y"}).status_code == 401


def test_list_users(client, db_session):
    _create_user(db_session)
    res = client.get("/users", headers=_get_headers(client))
    assert res.status_code == 200
    assert any(u["username"] == "admin" for u in res.json())


def test_delete_user(client, db_session):
    _create_user(db_session)
    headers = _get_headers(client)
    client.post("/users", json={"username": "todelete", "password": "x"}, headers=headers)
    users = client.get("/users", headers=headers).json()
    target_id = next(u["id"] for u in users if u["username"] == "todelete")
    assert client.delete(f"/users/{target_id}", headers=headers).status_code == 200


def test_delete_self_forbidden(client, db_session):
    _create_user(db_session)
    headers = _get_headers(client)
    me = client.get("/users/me", headers=headers).json()
    assert client.delete(f"/users/{me['id']}", headers=headers).status_code == 400


def test_delete_nonexistent_user(client, db_session):
    _create_user(db_session)
    assert client.delete("/users/9999", headers=_get_headers(client)).status_code == 404


# wazuh connections

def test_list_connections_empty(client, db_session):
    _create_user(db_session)
    res = client.get("/wazuh-connections", headers=_get_headers(client))
    assert res.status_code == 200
    assert res.json() == []


@patch("app.main.test_connection", return_value=True)
def test_create_connection(mock_test, client, db_session):
    # the endpoint should automatically verify the Wazuh connection
    _create_user(db_session)
    payload = {"name": "prod", "indexer_url": "https://wazuh:9200",
               "wazuh_user": "admin", "wazuh_password": "secret"}
    res = client.post("/wazuh-connections", json=payload, headers=_get_headers(client))
    assert res.status_code == 201
    # verify that test_connection was called with provided credentials
    mock_test.assert_called_once_with(payload["indexer_url"], payload["wazuh_user"], payload["wazuh_password"])


def test_create_connection_duplicate_name(client, db_session):
    _create_user(db_session)
    headers = _get_headers(client)
    payload = {"name": "dup", "indexer_url": "x", "wazuh_user": "u", "wazuh_password": "p"}
    client.post("/wazuh-connections", json=payload, headers=headers)
    assert client.post("/wazuh-connections", json=payload, headers=headers).status_code == 400

@patch("app.main.test_connection", return_value=False)
def test_create_connection_fails_when_unreachable(mock_test, client, db_session):
    _create_user(db_session)
    payload = {"name": "bad", "indexer_url": "https://bad", "wazuh_user": "u", "wazuh_password": "p"}
    res = client.post("/wazuh-connections", json=payload, headers=_get_headers(client))
    assert res.status_code == 400
    assert "No se pudo establecer conexión" in res.json()["detail"]
    mock_test.assert_called_once()


def test_update_connection(client, db_session):
    _create_user(db_session)
    conn = _create_connection(db_session)
    res = client.put(f"/wazuh-connections/{conn.id}",
                     json={"name": "updated", "indexer_url": "https://new.url",
                           "wazuh_user": "newuser", "wazuh_password": "newpass"},
                     headers=_get_headers(client))
    assert res.status_code == 200


def test_update_nonexistent_connection(client, db_session):
    _create_user(db_session)
    res = client.put("/wazuh-connections/9999",
                     json={"name": "x", "indexer_url": "x", "wazuh_user": "x", "wazuh_password": "x"},
                     headers=_get_headers(client))
    assert res.status_code == 404


def test_delete_connection(client, db_session):
    _create_user(db_session)
    conn = _create_connection(db_session)
    assert client.delete(f"/wazuh-connections/{conn.id}", headers=_get_headers(client)).status_code == 200


def test_delete_nonexistent_connection(client, db_session):
    _create_user(db_session)
    assert client.delete("/wazuh-connections/9999", headers=_get_headers(client)).status_code == 404


@patch("app.main.test_connection", return_value=True)
def test_test_connection_ok(mock_test, client, db_session):
    _create_user(db_session)
    conn = _create_connection(db_session)
    res = client.post(f"/wazuh-connections/{conn.id}/test", headers=_get_headers(client))
    assert res.json()["ok"] is True


@patch("app.main.test_connection", return_value=False)
def test_test_connection_fail(mock_test, client, db_session):
    _create_user(db_session)
    conn = _create_connection(db_session)
    res = client.post(f"/wazuh-connections/{conn.id}/test", headers=_get_headers(client))
    assert res.json()["ok"] is False


def test_test_nonexistent_connection(client, db_session):
    _create_user(db_session)
    assert client.post("/wazuh-connections/9999/test", headers=_get_headers(client)).status_code == 404


# sync per conn

@patch("app.main.fetch_all_vulns", return_value=MOCK_VULN)
def test_sync_connection_success(mock_fetch, client, db_session):
    _create_user(db_session)
    conn = _create_connection(db_session)
    res = client.post(f"/wazuh-connections/{conn.id}/sync", headers=_get_headers(client))
    assert res.status_code == 200
    assert res.json()["synced"] == 1


def test_sync_inactive_connection(client, db_session):
    _create_user(db_session)
    conn = _create_connection(db_session, is_active=False)
    assert client.post(f"/wazuh-connections/{conn.id}/sync",
                       headers=_get_headers(client)).status_code == 400


def test_sync_nonexistent_connection(client, db_session):
    _create_user(db_session)
    assert client.post("/wazuh-connections/9999/sync",
                       headers=_get_headers(client)).status_code == 404


# sync all

@patch("app.main.fetch_all_vulns", return_value=MOCK_VULN)
def test_sync_all_success(mock_fetch, client, db_session):
    _create_user(db_session)
    _create_connection(db_session, name="conn-1")
    _create_connection(db_session, name="conn-2")
    res = client.post("/vulns/sync-all", headers=_get_headers(client))
    assert len(res.json()) == 2
    assert all(r["ok"] for r in res.json())


@patch("app.main.fetch_all_vulns", side_effect=Exception("unreachable"))
def test_sync_all_partial_failure(mock_fetch, client, db_session):
    _create_user(db_session)
    _create_connection(db_session)
    result = client.post("/vulns/sync-all", headers=_get_headers(client)).json()[0]
    assert result["ok"] is False


def test_sync_all_skips_inactive(client, db_session):
    _create_user(db_session)
    _create_connection(db_session, is_active=False)
    assert client.post("/vulns/sync-all", headers=_get_headers(client)).json() == []


def test_sync_all_unauthenticated(client):
    assert client.post("/vulns/sync-all").status_code == 401


# vulns list

def test_list_vulns_empty(client, db_session):
    _create_user(db_session)
    assert client.get("/vulns", headers=_get_headers(client)).json() == []


def test_list_vulns_unauthenticated(client):
    assert client.get("/vulns").status_code == 401


@patch("app.main.fetch_all_vulns", return_value=MOCK_VULN)
def test_list_vulns_limit_zero(mock_fetch, client, db_session):
    _create_user(db_session)
    conn = _create_connection(db_session)
    client.post(f"/wazuh-connections/{conn.id}/sync", headers=_get_headers(client))
    assert client.get("/vulns?limit=0", headers=_get_headers(client)).json() == []


@patch("app.main.fetch_all_vulns", return_value=MOCK_VULN)
def test_list_vulns_shows_connection_name(mock_fetch, client, db_session):
    # newly added test ensures connection_name field is returned
    _create_user(db_session)
    conn = _create_connection(db_session, name="myconn")
    client.post(f"/wazuh-connections/{conn.id}/sync", headers=_get_headers(client))
    res_list = client.get("/vulns", headers=_get_headers(client)).json()
    assert len(res_list) == 1
    assert res_list[0].get("connection_name") == "myconn"


# fetch vulns

@patch("app.main.fetch_all_vulns")
def test_new_vuln_creates_detected_history(mock_fetch, client, db_session):
    mock_fetch.return_value = _raw_vuln()
    _create_user(db_session)
    conn = _create_connection(db_session)
    client.post(f"/wazuh-connections/{conn.id}/sync", headers=_get_headers(client))
    actions = [h.action for h in db_session.query(VulnerabilityHistory).all()]
    assert "DETECTED" in actions


@patch("app.main.fetch_all_vulns")
def test_resolved_vuln_gets_reopened(mock_fetch, client, db_session):
    mock_fetch.return_value = _raw_vuln()
    _create_user(db_session)
    conn = _create_connection(db_session)
    headers = _get_headers(client)
    client.post(f"/wazuh-connections/{conn.id}/sync", headers=headers)
    vuln = db_session.query(WazuhVulnerability).first()
    vuln.status = "RESOLVED"
    db_session.commit()
    client.post(f"/wazuh-connections/{conn.id}/sync", headers=headers)
    db_session.refresh(vuln)
    assert vuln.status == "ACTIVE"
    actions = [h.action for h in db_session.query(VulnerabilityHistory).all()]
    assert "REOPENED" in actions


@patch("app.main.fetch_all_vulns")
def test_vuln_resolved_when_absent_from_payload(mock_fetch, client, db_session):
    mock_fetch.return_value = _raw_vuln()
    _create_user(db_session)
    conn = _create_connection(db_session)
    headers = _get_headers(client)
    client.post(f"/wazuh-connections/{conn.id}/sync", headers=headers)
    mock_fetch.return_value = []
    client.post(f"/wazuh-connections/{conn.id}/sync", headers=headers)
    vuln = db_session.query(WazuhVulnerability).first()
    assert vuln.status == "RESOLVED"


@patch("app.main.fetch_all_vulns")
def test_severity_change_logged_in_history(mock_fetch, client, db_session):
    mock_fetch.return_value = _raw_vuln(severity="Low")
    _create_user(db_session)
    conn = _create_connection(db_session)
    headers = _get_headers(client)
    client.post(f"/wazuh-connections/{conn.id}/sync", headers=headers)
    mock_fetch.return_value = _raw_vuln(severity="Critical")
    client.post(f"/wazuh-connections/{conn.id}/sync", headers=headers)
    actions = [h.action for h in db_session.query(VulnerabilityHistory).all()]
    assert "SEVERITY_CHANGED" in actions


@patch("app.main.fetch_all_vulns")
def test_vuln_without_cve_id_is_skipped(mock_fetch, client, db_session):
    mock_fetch.return_value = [{
        "agent": {"id": "001", "name": "host-1"},
        "host": {"os": {}},
        "package": {"name": "curl", "version": "7.81"},
        "vulnerability": {"id": None, "severity": "High", "score": {}},
    }]
    _create_user(db_session)
    conn = _create_connection(db_session)
    res = client.post(f"/wazuh-connections/{conn.id}/sync", headers=_get_headers(client))
    assert res.json()["synced"] == 0
    assert db_session.query(WazuhVulnerability).count() == 0
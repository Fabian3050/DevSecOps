import pytest
from unittest.mock import patch, MagicMock
from app.wazuh_client import fetch_all_agents
from app.main import _run_sync_task, process_wazuh_vulnerabilities
from app.models import WazuhConnection, Assets, WazuhVulnerability, VulnerabilityCatalog, VulnerabilityDetections, VulnerabilityHistory
from app.crypto import encrypt

@patch("app.wazuh_client.requests.post")
def test_fetch_all_agents(mock_post):
    """Test fetch_all_agents successfully aggregates and maps agents."""
    mock_response = MagicMock()
    mock_response.json.return_value = {
        "aggregations": {
            "agents": {
                "buckets": [
                    {
                        "latest": {
                            "hits": {
                                "hits": [
                                    {
                                        "_source": {
                                            "id": "001",
                                            "name": "agent1",
                                            "ip": "1.2.3.4",
                                            "os": {"version": "22.04"}
                                        }
                                    }
                                ]
                            }
                        }
                    }
                ]
            }
        }
    }
    mock_response.status_code = 200
    mock_post.return_value = mock_response

    agents = fetch_all_agents("http://fake", "user", "pass")
    
    assert len(agents) == 1
    assert agents[0]["agent"]["id"] == "001"
    assert agents[0]["agent"]["name"] == "agent1"
    assert agents[0]["host"]["ip"] == "1.2.3.4"
    assert agents[0]["host"]["os"]["version"] == "22.04"


def test_process_wazuh_vulnerabilities_cache(db_session):
    """Test that process_wazuh_vulnerabilities uses the asset_cache efficiently and avoids deadlocks."""
    # Setup test connection
    conn = WazuhConnection(
        name="Test",
        indexer_url="http://fake",
        wazuh_user="user",
        wazuh_password=encrypt("pass"),
        is_active=True
    )
    db_session.add(conn)
    db_session.commit()

    raw_agents = [
        {"agent": {"id": "001", "name": "agent1"}, "host": {"ip": "1.1.1.1", "os": {"version": "1.0"}}},
        {"agent": {"id": "002", "name": "agent2"}, "host": {"ip": "2.2.2.2", "os": {"version": "1.0"}}}
    ]
    raw_vulns = [
        {
            "agent": {"id": "001", "name": "agent1"},
            "vulnerability": {"id": "CVE-TEST-1", "severity": "High", "description": "Test"},
            "package": {"name": "pkg1", "version": "1.0"}
        },
        {
            "agent": {"id": "002", "name": "agent2"},
            "vulnerability": {"id": "CVE-TEST-1", "severity": "High", "description": "Test"},
            "package": {"name": "pkg2", "version": "1.0"}
        }
    ]

    count = process_wazuh_vulnerabilities(db_session, conn.id, raw_vulns, raw_agents)
    db_session.commit()

    assert count == 2
    
    # Check assets created
    assets = db_session.query(Assets).all()
    assert len(assets) == 2
    
    # Check vulns created
    vulns = db_session.query(WazuhVulnerability).all()
    assert len(vulns) == 2
    
    # Check catalog created
    cat = db_session.query(VulnerabilityCatalog).all()
    assert len(cat) == 1
    
    # Check detections created
    dets = db_session.query(VulnerabilityDetections).all()
    assert len(dets) == 2


@patch("app.main.fetch_all_agents")
@patch("app.main.fetch_all_vulns")
@patch("app.main.SessionLocal")
def test_run_sync_task(mock_session_local, mock_fetch_vulns, mock_fetch_agents, db_session):
    """Test that _run_sync_task coordinates fetching agents and vulns in the background."""
    mock_session_local.return_value = db_session
    mock_fetch_agents.return_value = []
    mock_fetch_vulns.return_value = []
    
    # Setup connection
    conn = WazuhConnection(
        name="Test",
        indexer_url="http://fake",
        wazuh_user="user",
        wazuh_password=encrypt("pass"),
        is_active=True
    )
    db_session.add(conn)
    db_session.commit()

    _run_sync_task(conn.id)
    
    mock_fetch_agents.assert_called_once()
    mock_fetch_vulns.assert_called_once()


@patch("app.main.BackgroundTasks.add_task")
def test_sync_all_endpoint_bg(mock_add_task, client, db_session):
    """Test that /vulns/sync-all uses BackgroundTasks instead of running synchronously."""
    from test_api import _create_user, _get_headers
    
    user = _create_user(db_session, "admin2", "admin2")
    headers = _get_headers(client, "admin2", "admin2")
    
    conn = WazuhConnection(
        name="TestBG",
        indexer_url="http://fake",
        wazuh_user="user",
        wazuh_password=encrypt("pass"),
        is_active=True
    )
    db_session.add(conn)
    db_session.commit()

    response = client.post("/api/vulns/sync-all", headers=headers)
    
    assert response.status_code == 200
    assert "Sincronización iniciada en segundo plano" in response.json()[0]["message"]
    assert mock_add_task.called


@patch("app.main.BackgroundTasks.add_task")
def test_sync_connection_endpoint_bg(mock_add_task, client, db_session):
    """Test that /wazuh-connections/{id}/sync uses BackgroundTasks."""
    from test_api import _create_user, _get_headers
    
    user = _create_user(db_session, "admin3", "admin3")
    headers = _get_headers(client, "admin3", "admin3")
    
    conn = WazuhConnection(
        name="TestConnBG",
        indexer_url="http://fake",
        wazuh_user="user",
        wazuh_password=encrypt("pass"),
        is_active=True
    )
    db_session.add(conn)
    db_session.commit()

    response = client.post(f"/api/wazuh-connections/{conn.id}/sync", headers=headers)
    
    assert response.status_code == 200
    assert "Sincronización iniciada en segundo plano" in response.json()["message"]
    assert mock_add_task.called

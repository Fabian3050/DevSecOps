# app/wazuh_client.py
import requests
from requests.auth import HTTPBasicAuth

VULN_INDEX = "wazuh-states-vulnerabilities-*/_search"

def fetch_all_vulns(indexer_url: str, wazuh_user: str, wazuh_password: str):
    url = f"{indexer_url}/{VULN_INDEX}"
    body = {"size": 10000, "_source": True}
    resp = requests.post(
        url,
        json=body,
        auth=HTTPBasicAuth(wazuh_user, wazuh_password),
        verify=False,
        timeout=60
    )
    resp.raise_for_status()
    hits = resp.json()["hits"]["hits"]
    return [h["_source"] for h in hits]


def test_connection(indexer_url: str, wazuh_user: str, wazuh_password: str) -> bool:
    try:
        resp = requests.get(
            indexer_url,
            auth=HTTPBasicAuth(wazuh_user, wazuh_password),
            verify=False,
            timeout=10
        )
        return resp.status_code == 200
    except Exception:
        return False
# app/wazuh_client.py
import requests
from requests.auth import HTTPBasicAuth

VULN_INDEX = "wazuh-states-vulnerabilities-*/_search"

# captura las vulnerabilidades desde Wazuh, usando Scroll API para iterar hasta que no queden más registros
def fetch_all_vulns(indexer_url: str, wazuh_user: str, wazuh_password: str):
    #Petición inicial solicitando el Scroll ID (mantiene el contexto por 1 minuto)
    url = f"{indexer_url}/{VULN_INDEX}?scroll=1m"
    body = {"size": 10000, "_source": True}
    resp = requests.post(
        url,
        json=body,
        auth=HTTPBasicAuth(wazuh_user, wazuh_password),
        verify=False,
        timeout=60
    )
    resp.raise_for_status()
    
    data = resp.json()
    scroll_id = data.get("_scroll_id")
    hits = data["hits"]["hits"]
    
    all_vulns = [h["_source"] for h in hits]
    
    # Bucle que usa el Scroll ID para pedir las siguientes páginas de 10.000 registros
    while scroll_id and hits:
        scroll_url = f"{indexer_url}/_search/scroll"
        scroll_body = {
            "scroll": "1m",
            "scroll_id": scroll_id
        }
        scroll_resp = requests.post(
            scroll_url,
            json=scroll_body,
            auth=HTTPBasicAuth(wazuh_user, wazuh_password),
            verify=False,
            timeout=60
        )
        scroll_resp.raise_for_status()
        
        scroll_data = scroll_resp.json()
        scroll_id = scroll_data.get("_scroll_id")
        hits = scroll_data["hits"]["hits"]
        
        all_vulns.extend([h["_source"] for h in hits])
        
    return all_vulns


# prueba la conexión a Wazuh, devolviendo True si es exitosa y False si no lo es
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

# obtiene los agentes registrados consultando el índice wazuh-monitoring
def fetch_all_agents(indexer_url: str, wazuh_user: str, wazuh_password: str):
    url = f"{indexer_url}/wazuh-monitoring-*/_search"
    body = {
        "size": 0,
        "aggs": {
            "agents": {
                "terms": {"field": "id", "size": 10000},
                "aggs": {
                    "latest": {
                        "top_hits": {
                            "size": 1,
                            "sort": [{"timestamp": {"order": "desc"}}],
                            "_source": ["id", "name", "ip", "os"]
                        }
                    }
                }
            }
        }
    }
    try:
        resp = requests.post(
            url,
            json=body,
            auth=HTTPBasicAuth(wazuh_user, wazuh_password),
            verify=False,
            timeout=60
        )
        resp.raise_for_status()
        data = resp.json()
        buckets = data.get("aggregations", {}).get("agents", {}).get("buckets", [])
        
        formatted_agents = []
        for b in buckets:
            hits = b.get("latest", {}).get("hits", {}).get("hits", [])
            if hits:
                source = hits[0]["_source"]
                formatted_agents.append({
                    "agent": {
                        "id": source.get("id"),
                        "name": source.get("name")
                    },
                    "host": {
                        "ip": source.get("ip"),
                        "os": source.get("os", {})
                    }
                })
        return formatted_agents
    except Exception as e:
        print(f"Error fetching agents: {e}")
        return []
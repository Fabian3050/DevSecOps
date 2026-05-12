#!/usr/bin/env bash

set -euo pipefail

WAZUH_API_URL="${WAZUH_API_URL:-https://localhost/api}"
USERNAME="${WAZUH_API_USER:-admin}"
PASSWORD="${WAZUH_API_PASSWORD:-admin}"
LIMIT="${LIMIT:-50}"
TOKEN="${WAZUH_API_TOKEN:-}"
INSECURE_TLS="${WAZUH_API_INSECURE_TLS:-true}"

if [ "$INSECURE_TLS" = "true" ]; then
  CURL_TLS_OPTS=(-k)
else
  CURL_TLS_OPTS=()
fi

login() {
  curl -sS "${CURL_TLS_OPTS[@]}" -X POST "$WAZUH_API_URL/auth/login" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "username=${USERNAME}&password=${PASSWORD}"
}

pretty_print() {
  python3 -m json.tool
}

fetch_endpoint() {
  local title="$1"
  local path="$2"
  echo
  echo "=== ${title} ==="
  curl -sS "${CURL_TLS_OPTS[@]}" -H "Authorization: Bearer ${TOKEN}" "$WAZUH_API_URL${path}" | pretty_print
}

if [ -z "$TOKEN" ]; then
  echo "Conectando a ${WAZUH_API_URL}..."
  RESPONSE="$(login)"
  TOKEN="$(printf '%s' "$RESPONSE" | python3 - <<'PY'
import json
import sys

try:
    data = json.load(sys.stdin)
except Exception:
    data = {}

print(data.get("access_token", ""))
PY
)"

  if [ -z "$TOKEN" ]; then
    echo "No se pudo obtener token. Revisa WAZUH_API_USER y WAZUH_API_PASSWORD, o usa WAZUH_API_TOKEN."
    echo "Respuesta recibida:"
    printf '%s\n' "$RESPONSE"
    exit 1
  fi
else
  echo "Usando token Bearer provisto para ${WAZUH_API_URL}..."
fi

fetch_endpoint "Managers" "/managers?limit=${LIMIT}"
fetch_endpoint "Assets" "/assets?limit=${LIMIT}"
fetch_endpoint "Vulnerability Catalog" "/vulnerability-catalog?limit=${LIMIT}"
fetch_endpoint "Vulnerability Detections" "/vulnerability-detections?limit=${LIMIT}"

#!/bin/bash

JENKINS_URL="http://localhost:8080"
JENKINS_USER="admin"
JENKINS_TOKEN="tu_api_token"

echo "Configurando credenciales en Jenkins..."

# Credencial: Database URL
curl -X POST "${JENKINS_URL}/credentials/store/system/domain/_/createCredentials" \
  --user "${JENKINS_USER}:${JENKINS_TOKEN}" \
  --data-urlencode 'json={
    "": "0",
    "credentials": {
      "scope": "GLOBAL",
      "id": "vuln-db-url",
      "secret": "postgresql://user:password@host:5432/dbname",
      "description": "Database URL",
      "$class": "org.jenkinsci.plugins.plaincredentials.impl.StringCredentialsImpl"
    }
  }'

# Credencial: Wazuh
curl -X POST "${JENKINS_URL}/credentials/store/system/domain/_/createCredentials" \
  --user "${JENKINS_USER}:${JENKINS_TOKEN}" \
  --data-urlencode 'json={
    "": "0",
    "credentials": {
      "scope": "GLOBAL",
      "id": "wazuh-indexer-creds",
      "username": "admin",
      "password": "SecurePass123!",
      "description": "Wazuh Indexer Credentials",
      "$class": "com.cloudbees.plugins.credentials.impl.UsernamePasswordCredentialsImpl"
    }
  }'

# Credencial: Admin App
curl -X POST "${JENKINS_URL}/credentials/store/system/domain/_/createCredentials" \
  --user "${JENKINS_USER}:${JENKINS_TOKEN}" \
  --data-urlencode 'json={
    "": "0",
    "credentials": {
      "scope": "GLOBAL",
      "id": "app-admin-creds",
      "username": "admin",
      "password": "admin",
      "description": "Application Admin Credentials",
      "$class": "com.cloudbees.plugins.credentials.impl.UsernamePasswordCredentialsImpl"
    }
  }'

echo "Credenciales configuradas exitosamente!"
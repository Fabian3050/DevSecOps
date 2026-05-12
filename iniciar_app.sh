#!/bin/bash

# ==========================================
# Variables para la gestión segura del Cronjob
# ==========================================
PROJECT_DIR=$(pwd)
CRON_MARKER="# VULN_APP_CERTBOT_RENEWAL"
# El comando entra a la carpeta del proyecto, intenta renovar, y si tiene éxito, recarga Nginx
CRON_CMD="0 3 * * * cd \"$PROJECT_DIR\" && docker compose run --rm certbot renew --quiet && docker exec frontend nginx -s reload"

echo "================================================="
echo "   Selector de Entorno: Autofirmado vs Let's Encrypt"
echo "================================================="
echo "1) Sin Dominio (Certificados Autofirmados / Local)"
echo "2) Con Dominio (Certificados Let's Encrypt / Prod)"
echo "================================================="
read -p "Selecciona una opción (1 o 2): " OPCION

if [ "$OPCION" == "1" ]; then
    echo -e "\n[+] Deteniendo contenedores y limpiando certificados anteriores..."
    docker compose down 2>/dev/null
    rm -rf ./certbot ./nginx/ssl

    echo "[+] Configurando entorno SIN dominio..."
    cp prod_config/docker-compose.nodomain.yml docker-compose.yml
    cp prod_config/nginx.nodomain.conf frontend/nginx.conf

    echo "[+] Generando certificados autofirmados locales..."
    mkdir -p ./nginx/ssl
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout ./nginx/ssl/nginx-selfsigned.key \
        -out ./nginx/ssl/nginx-selfsigned.crt \
        -subj "/C=CL/ST=RM/L=Santiago/O=Desarrollo/CN=localhost" 2>/dev/null

    # --- LÓGICA DE CRON: ELIMINACIÓN SEGURA ---
    if crontab -l 2>/dev/null | grep -q "$CRON_MARKER"; then
        echo "[+] Eliminando tarea de renovación automática (Cronjob)..."
        crontab -l 2>/dev/null | grep -v "$CRON_MARKER" | crontab -
    fi

    echo "[+] Levantando contenedores..."
    docker compose up -d --build

elif [ "$OPCION" == "2" ]; then
    echo -e "\n[+] Configurando entorno CON dominio..."
    read -p "Ingresa tu dominio (ej: midominio.cl): " DOMINIO
    read -p "Ingresa tu correo (para avisos de expiración de Let's Encrypt): " EMAIL

    echo "[+] Deteniendo contenedores y limpiando certificados anteriores..."
    docker compose down 2>/dev/null
    rm -rf ./certbot ./nginx/ssl

    echo "[+] Aplicando configuraciones de red..."
    cp prod_config/docker-compose.domain.yml docker-compose.yml
    cp prod_config/nginx.domain.conf frontend/nginx.conf

    sed -i "s/{{DOMAIN}}/$DOMINIO/g" frontend/nginx.conf

    echo "[+] Solicitando certificado oficial a Let's Encrypt para $DOMINIO..."
    
    if docker run --rm -p 80:80 \
        -v "$(pwd)/certbot/conf:/etc/letsencrypt" \
        certbot/certbot certonly --standalone \
        -d "$DOMINIO" \
        --non-interactive \
        --agree-tos \
        -m "$EMAIL"; then
        
        echo -e "\n[+] Certificados obtenidos correctamente. Levantando la aplicación..."
        docker compose up -d --build

        # --- LÓGICA DE CRON: INSERCIÓN SEGURA ---
        echo "[+] Configurando tarea de renovación automática (Cronjob)..."
        # 1. Borramos si ya existía para no duplicar
        if crontab -l 2>/dev/null | grep -q "$CRON_MARKER"; then
            crontab -l 2>/dev/null | grep -v "$CRON_MARKER" | crontab -
        fi
        # 2. Agregamos el nuevo cronjob con el marcador
        (crontab -l 2>/dev/null; echo "$CRON_CMD $CRON_MARKER") | crontab -
        echo "[+] Cronjob instalado. Tu certificado se renovará automáticamente."
    else
        echo -e "\n[ERROR] Certbot falló en la obtención del certificado."
        echo "Verifica que los puertos 80 y 443 estén libres y que el dominio apunte a tu IP."
        exit 1
    fi

else
    echo "Opción inválida. Abortando."
    exit 1
fi

echo -e "\n================================================="
echo "¡Cambio de entorno completado con éxito!"
echo "================================================="

---

# Guía de Despliegue en Producción

Este documento detalla los pasos necesarios para desplegar la aplicación en un entorno de producción, ya sea en un servidor con dominio público o en una red local utilizando certificados SSL autofirmados.

## Requisitos Previos

Antes de comenzar, asegúrate de tener instalado lo siguiente en tu servidor:

* **Docker**
* **Docker Compose**
* **Puertos 80 y 443** abiertos y disponibles en el firewall de tu servidor.
* Si vas a usar un dominio real, asegúrate de que el registro DNS (A o CNAME) apunte a la IP de tu servidor.

## Configuración Inicial

El proyecto utiliza un archivo `.env` en la raíz para gestionar las variables de entorno de los contenedores. Antes de ejecutar el proyecto, revisa y modifica las credenciales por defecto por motivos de seguridad:

```env
VITE_API_URL=/api
POSTGRES_DB=vulnerabilidades_db
POSTGRES_USER=admin
POSTGRES_PASSWORD=adminpassword
ENCRYPTION_KEY=_PDHhMGJ7ej8t4jZVgwX4xht5A8RBGwN4mwmUD15NkM=
SECRET_KEY=supersecret

```

## Ejecución del Proyecto

El proyecto incluye un script interactivo llamado `iniciar_app.sh` que automatiza la configuración de red, la gestión de certificados SSL y el levantamiento de los contenedores Docker.

Para iniciar el despliegue, otorga permisos de ejecución al script y córrelo con permisos de administrador:

```bash
chmod +x iniciar_app.sh
sudo ./iniciar_app.sh

```

El script te presentará un menú con dos opciones:

### Opción 1: Sin Dominio (Certificados Autofirmados / Local)

Ideal para entornos de desarrollo cerrado o redes locales.

* **Qué hace:** Detiene contenedores previos, copia la configuración de `docker-compose.nodomain.yml` y genera certificados SSL autofirmados usando `openssl`.
* **Cronjobs:** Si existía una tarea de renovación automática de certificados Let's Encrypt de despliegues anteriores, el script la elimina de forma segura.
* **Servicios:** Levanta la base de datos (PostgreSQL 15), la API y el Frontend, exponiendo los puertos 80 y 443.

### Opción 2: Con Dominio (Certificados Let's Encrypt / Prod)

Esta es la opción recomendada para producción real expuesta a internet.

* **Qué necesitas:** El script te pedirá ingresar tu dominio (ej. `midominio.cl`) y un correo electrónico para los avisos de expiración de Let's Encrypt.
* **Qué hace:** 1.  Copia la configuración desde `docker-compose.domain.yml` y `nginx.domain.conf`.
2.  Solicita un certificado SSL oficial utilizando un contenedor temporal de Certbot en modo "standalone".
3.  Levanta la infraestructura (`db-api`, `api`, `frontend` y un contenedor permanente de `certbot`).
* **Renovación Automática:** Si la obtención del certificado es exitosa, el script instala automáticamente un Cronjob en el sistema anfitrión (`# VULN_APP_CERTBOT_RENEWAL`) que ejecutará diariamente a las 03:00 AM el comando de renovación de Certbot y recargará el servidor Nginx para aplicar los cambios.

## Arquitectura de Servicios

En entorno de producción con dominio, Docker Compose levantará los siguientes servicios interconectados a través de la red `app-network`:

1. **db-api:** Base de datos PostgreSQL 15 con un volumen persistente `postgres_api_data`.
2. **api:** Backend construido desde la carpeta `./vuln-api`, con un *healthcheck* configurado que espera a que la base de datos esté lista antes de iniciar.
3. **frontend:** Servidor Nginx que expone los puertos 80 y 443, construido desde `./frontend`. Tiene montados los volúmenes para leer los certificados de Let's Encrypt.
4. **certbot** (Solo Opción 2): Contenedor encargado de gestionar las renovaciones futuras de SSL.

## Consultas CLI a los endpoints

Para consultar los endpoints protegidos desde la terminal, puedes usar el script `consultar_endpoints_wazuh.sh` ubicado en la raíz del proyecto.

Ejemplo de uso:

```bash
chmod +x consultar_endpoints_wazuh.sh
./consultar_endpoints_wazuh.sh
```

Si necesitas cambiar credenciales o la URL de la API:

```bash
WAZUH_API_URL=https://localhost/api WAZUH_API_USER=admin WAZUH_API_PASSWORD=admin LIMIT=100 ./consultar_endpoints_wazuh.sh
```

Si ya tienes un token Bearer válido, puedes saltarte el login:

```bash
WAZUH_API_URL=https://localhost/api WAZUH_API_TOKEN="<tu_token>" ./consultar_endpoints_wazuh.sh
```
El script consulta estos endpoints:

* `/managers`
* `/assets`
* `/vulnerability-catalog`
* `/vulnerability-detections`

# app/main.py
import re
import os
import uuid
from datetime import datetime, timezone, timedelta
from fastapi import FastAPI, Depends, HTTPException, Query, BackgroundTasks
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from dotenv import set_key, find_dotenv
from sqlalchemy.orm import Session, joinedload
from typing import List, Annotated, Optional
from pydantic import BaseModel
from sqlalchemy.sql import func
from sqlalchemy import text
from .db import Base, engine, get_db, SessionLocal
from .models import (
    User,
    WazuhVulnerability,
    WazuhConnection,
    VulnerabilityHistory,
    Managers,
    Assets,
    VulnerabilityCatalog,
    VulnerabilityDetections,
)
from .auth import (
    authenticate_user,
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)
from .wazuh_client import fetch_all_vulns, test_connection, fetch_all_agents
from .crypto import encrypt, decrypt

Base.metadata.create_all(bind=engine)

CONNECTION_NOT_FOUND = "Conexión no encontrada"


class WazuhConnectionRequest(BaseModel):
    name: str
    indexer_url: str
    wazuh_user: str
    wazuh_password: str


class WazuhConnectionResponse(BaseModel):
    id: int
    name: str
    indexer_url: str
    wazuh_user: str
    is_active: bool

def init_materialized_views():
    is_sqlite = engine.dialect.name == "sqlite"
    with engine.connect() as conn:
        if is_sqlite:
            # En SQLite usamos una vista normal para los tests unitarios
            conn.execute(text("DROP VIEW IF EXISTS mv_wazuh_vulnerabilities;"))
            conn.execute(text("""
                CREATE VIEW mv_wazuh_vulnerabilities AS
                SELECT * FROM wazuh_vulnerabilities;
            """))
        else:
            # En PostgreSQL usamos Vistas Materializadas para producción
            conn.execute(text("DROP PROCEDURE IF EXISTS sp_get_vulns_by_severity(TEXT, INTEGER, refcursor);"))
            conn.execute(text("DROP PROCEDURE IF EXISTS sp_get_vulns_by_os(TEXT, INTEGER, refcursor);"))
            conn.execute(text("DROP PROCEDURE IF EXISTS sp_get_vulns_by_agent(TEXT, INTEGER, refcursor);"))
            
            conn.execute(text("""
                CREATE MATERIALIZED VIEW IF NOT EXISTS mv_wazuh_vulnerabilities AS
                SELECT * FROM wazuh_vulnerabilities;
            """))
            
            conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_id ON mv_wazuh_vulnerabilities (id);"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_mv_severity ON mv_wazuh_vulnerabilities (severity);"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_mv_os_platform ON mv_wazuh_vulnerabilities (os_platform);"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_mv_os_full ON mv_wazuh_vulnerabilities (os_full);"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_mv_agent_id ON mv_wazuh_vulnerabilities (agent_id);"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_mv_connection_id ON mv_wazuh_vulnerabilities (connection_id);"))
        conn.commit()

try:
    init_materialized_views()
except Exception as e:
    print(f"Error initializing materialized views: {e}")


#esta funcion crea un usuario admin por defecto
def create_default_admin():
    db = SessionLocal()
    try:
        admin_exists = db.query(User).filter(User.username == "admin").first()
        if not admin_exists:
            print("Creando usuario admin default...")
            default_admin = User(
                username="admin", 
                password_hash=hash_password("admin"), 
                is_active=True,
                is_default_password=True,
            )
            db.add(default_admin)
            db.commit()
    finally:
        db.close()


create_default_admin()

app = FastAPI(title="Vulnerability Aggregator API", root_path="/api")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/auth/login")
def login(
    form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)
):
    print("Form data: ", form_data)
    user = authenticate_user(db, form_data.username, form_data.password)

    if not user:
        raise HTTPException(status_code=400, detail="Usuario o contraseña incorrectos")
    access_token = create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer"}


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str
    confirm_password: str 

def validate_strong_password(password: str) -> None:
    """Valida que la contraseña sea robusta. Lanza HTTPException si no cumple."""
    errors = []
    if len(password) < 8:
        errors.append("mínimo 8 caracteres")
    if not re.search(r"[A-Z]", password):
        errors.append("al menos una letra mayúscula")
    if not re.search(r"[a-z]", password):
        errors.append("al menos una letra minúscula")
    if not re.search(r"\d", password):
        errors.append("al menos un número")
    if not re.search(r"[!@#$%^&*(),.?\":{}|<>_\-]", password):
        errors.append("al menos un carácter especial (!@#$%^&*...)")
    if errors:
        raise HTTPException(
            status_code=400,
            detail=f"La contraseña no es suficientemente robusta: {', '.join(errors)}",
        )

@app.post("/auth/change-password")
def change_password(
    request: ChangePasswordRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db),
):
    if not verify_password(request.old_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="La contraseña antigua es incorrecta")

    if request.old_password == request.new_password:
        raise HTTPException(
            status_code=400,
            detail="La nueva contraseña debe ser diferente a la anterior",
        )

    if request.new_password != request.confirm_password:
        raise HTTPException(
            status_code=400,
            detail="Las contraseñas nuevas no coinciden",
        )

    validate_strong_password(request.new_password)

    current_user.password_hash = hash_password(request.new_password)
    current_user.is_active = True 
    current_user.is_default_password = False

    db.add(current_user)
    db.commit()

    return {"message": "Contraseña actualizada exitosamente"}


@app.get("/users/me")
def get_user_me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "username": current_user.username,
        "is_active": current_user.is_active,
        "is_default_password": current_user.is_default_password,
    }

class NewUserRequest(BaseModel):
    username: str
    password: str


@app.post("/users")
def create_user(
    request: NewUserRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    existing = db.query(User).filter(User.username == request.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="El nombre de usuario ya esta ocupado. Elige otro.")

    new_user = User(
        username=request.username, 
        password_hash=hash_password(request.password),
        is_default_password=True,
    )
    db.add(new_user)
    db.commit()
    return {"message": "Usuario creado"}


@app.get("/users")
def list_users(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    users = db.query(User).all()
    return [{"id": u.id, "username": u.username} for u in users]


@app.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.id == user_id:
        raise HTTPException(status_code=400, detail="No puedes eliminarte a ti mismo")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    db.delete(user)
    db.commit()
    return {"message": "Usuario eliminado"}


@app.get("/wazuh-connections")
def list_connections(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    conns = db.query(WazuhConnection).all()
    return [
        {
            "id": c.id,
            "name": c.name,
            "indexer_url": c.indexer_url,
            "wazuh_user": c.wazuh_user,
            "is_active": c.is_active,
            "tested": c.tested,
            "last_tested_at": c.last_tested_at,
            "last_test_ok": c.last_test_ok,
        }
        for c in conns
    ]


@app.post("/wazuh-connections", status_code=201)
def create_connection(
    request: WazuhConnectionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # verify unique name
    if db.query(WazuhConnection).filter(WazuhConnection.name == request.name).first():
        raise HTTPException(
            status_code=400, detail="Ya existe una conexión con ese nombre"
        )

    # try to connect before persisting
    ok = test_connection(request.indexer_url, request.wazuh_user, request.wazuh_password)
    if not ok:
        # do not store invalid configuration
        raise HTTPException(
            status_code=400,
            detail="No se pudo establecer conexión con el indexador Wazuh",
        )

    conn = WazuhConnection(
        name=request.name,
        indexer_url=request.indexer_url,
        wazuh_user=request.wazuh_user,
        wazuh_password=encrypt(request.wazuh_password),
        tested=True,
        last_tested_at=func.now(),
        last_test_ok=True,
    )
    db.add(conn)
    db.commit()
    db.refresh(conn)
    return {"message": "Conexión creada", "id": conn.id}


@app.put("/wazuh-connections/{conn_id}")
def update_connection(
    conn_id: int,
    request: WazuhConnectionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conn = db.query(WazuhConnection).filter(WazuhConnection.id == conn_id).first()
    if not conn:
        raise HTTPException(status_code=404, detail=CONNECTION_NOT_FOUND)

    conn.name = request.name
    conn.indexer_url = request.indexer_url
    conn.wazuh_user = request.wazuh_user
    if request.wazuh_password:
        conn.wazuh_password = encrypt(request.wazuh_password)
    db.commit()
    return {"message": "Conexión actualizada"}


@app.delete("/wazuh-connections/{conn_id}")
def delete_connection(
    conn_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conn = db.query(WazuhConnection).filter(WazuhConnection.id == conn_id).first()
    if not conn:
        raise HTTPException(status_code=404, detail=CONNECTION_NOT_FOUND)

    # Eliminar en masa el historial de vulnerabilidades para evitar Constraint Errors y Timeouts del ORM
    db.execute(text("""
        DELETE FROM vulnerability_history 
        WHERE vulnerability_id IN (
            SELECT id FROM wazuh_vulnerabilities WHERE connection_id = :conn_id
        )
    """), {"conn_id": conn_id})

    # Eliminar las vulnerabilidades de esta conexión
    db.execute(text("""
        DELETE FROM wazuh_vulnerabilities WHERE connection_id = :conn_id
    """), {"conn_id": conn_id})

    db.delete(conn)
    db.commit()
    return {"message": "Conexión eliminada"}


@app.post("/wazuh-connections/{conn_id}/test")
def test_wazuh_connection(
    conn_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conn = db.query(WazuhConnection).filter(WazuhConnection.id == conn_id).first()
    if not conn:
        raise HTTPException(status_code=404, detail=CONNECTION_NOT_FOUND)

    ok = test_connection(
        conn.indexer_url, conn.wazuh_user, decrypt(conn.wazuh_password)
    )
    
    conn.tested = True
    conn.last_tested_at = func.now()
    conn.last_test_ok = ok
    db.commit()

    return {"ok": ok, "message": "Conexión exitosa" if ok else "No se pudo conectar"}


def _run_sync_task(conn_id: int):
    db = SessionLocal()
    try:
        conn = db.query(WazuhConnection).filter(WazuhConnection.id == conn_id).first()
        if not conn or not conn.is_active:
            return

        raw_agents = fetch_all_agents(
            conn.indexer_url,
            conn.wazuh_user,
            decrypt(conn.wazuh_password),
        )

        raw_vulns = fetch_all_vulns(
            conn.indexer_url,
            conn.wazuh_user,
            decrypt(conn.wazuh_password),
        )

        process_wazuh_vulnerabilities(db, conn.id, raw_vulns, raw_agents)
        db.commit()
        
        if engine.dialect.name == "postgresql":
            with engine.connect() as db_conn:
                db_conn.execute(text("REFRESH MATERIALIZED VIEW CONCURRENTLY mv_wazuh_vulnerabilities;"))
                db_conn.commit()
    except Exception as e:
        db.rollback()
        print(f"Error in background sync for conn {conn_id}: {e}")
    finally:
        db.close()


@app.post("/wazuh-connections/{conn_id}/sync")
def sync_connection(
    conn_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conn = db.query(WazuhConnection).filter(WazuhConnection.id == conn_id).first()
    if not conn:
        raise HTTPException(status_code=404, detail=CONNECTION_NOT_FOUND)
    if not conn.is_active:
        raise HTTPException(status_code=400, detail="La conexión está inactiva")

    background_tasks.add_task(_run_sync_task, conn.id)

    return {"message": "Sincronización iniciada en segundo plano", "connection": conn.name}


def _parse_wazuh_datetime(value) -> Optional[datetime]:
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, (int, float)):
        return datetime.fromtimestamp(value, tz=timezone.utc)
    if isinstance(value, str):
        # Wazuh suele enviar timestamps ISO8601 con sufijo Z.
        normalized = value.strip().replace("Z", "+00:00")
        try:
            return datetime.fromisoformat(normalized)
        except ValueError:
            return None
    return None


def _normalize_severity(severity: Optional[str]) -> str:
    severity_map = {
        "low": "LOW",
        "medium": "MEDIUM",
        "high": "HIGH",
        "critical": "CRITICAL",
    }
    return severity_map.get((severity or "").lower(), "MEDIUM")


def _extract_ip(host: dict) -> str:
    if not isinstance(host, dict):
        return "unknown"

    raw_ip = host.get("ip") or host.get("ipv4") or host.get("address")
    if isinstance(raw_ip, list):
        for value in raw_ip:
            if value:
                return str(value)
        return "unknown"
    return str(raw_ip) if raw_ip else "unknown"


def _get_or_create_manager(db: Session, conn: WazuhConnection) -> Optional[uuid.UUID]:
    try:
        existing = db.query(Managers).filter_by(api_url=conn.indexer_url).first()
        if not existing:
            existing = db.query(Managers).filter_by(name=conn.name).first()
        if existing:
            existing.api_url = conn.indexer_url
            return existing.id
        manager = Managers(name=conn.name, api_url=conn.indexer_url)
        db.add(manager)
        db.flush()
        return manager.id
    except Exception as e:
        print(f"Error creating manager: {e}")
        return None


def _get_or_create_asset(db: Session, agent_id: str, agent_name: str, os_version: str, manager_id: uuid.UUID, host: dict) -> Optional[uuid.UUID]:
    try:
        if not agent_id:
            return None

        ip_address = _extract_ip(host)
        existing = db.query(Assets).filter_by(wazuh_agent_id=agent_id, manager_id=manager_id).first()
        if existing:
            if agent_name:
                existing.hostname = agent_name
            if os_version:
                existing.os_version = os_version
            if ip_address and ip_address != "unknown":
                existing.ip_address = ip_address
            return existing.id
        asset = Assets(
            wazuh_agent_id=agent_id,
            hostname=agent_name or f"Agent {agent_id}",
            os_version=os_version or "Unknown",
            ip_address=ip_address or "unknown",
            manager_id=manager_id,
        )
        db.add(asset)
        db.flush()
        return asset.id
    except Exception as e:
        print(f"Error creating asset: {e}")
        return None


def _get_or_create_cve_catalog(db: Session, cve_id: str, severity: str, description: str, cvss_score) -> bool:
    try:
        if not cve_id:
            return False

        existing = db.query(VulnerabilityCatalog).filter_by(cve_id=cve_id).first()
        severity_enum = _normalize_severity(severity)
        if existing:
            existing.severity = severity_enum
            if description:
                existing.description = description
            if cvss_score is not None:
                existing.cvss_score = cvss_score
            return True

        catalog = VulnerabilityCatalog(cve_id=cve_id, severity=severity_enum, description=description, cvss_score=cvss_score)
        db.add(catalog)
        db.flush()
        return True
    except Exception as e:
        print(f"Error creating CVE catalog: {e}")
        return False


def _create_vulnerability_detection(
    db: Session,
    asset_id: uuid.UUID,
    cve_id: str,
    timestamp,
    package_name: str,
    package_version: str,
    status: str = "DETECTED",
) -> bool:
    try:
        if not asset_id or not cve_id:
            return False

        detected_at = _parse_wazuh_datetime(timestamp) or datetime.now(timezone.utc)

        detection = VulnerabilityDetections(
            timestamp=detected_at,
            asset_id=asset_id,
            cve_id=cve_id,
            status=status,
            package_name=package_name,
            package_version=package_version,
        )
        db.add(detection)
        db.flush()
        return True
    except Exception as e:
        print(f"Error creating vulnerability detection: {e}")
        return False


def _handle_existing_vuln(db: Session, existing: WazuhVulnerability, vuln: dict) -> None:
    if existing.status == "RESOLVED":
        existing.status = "ACTIVE"
        db.add(VulnerabilityHistory(
            vulnerability_id=existing.id,
            action="REOPENED",
            details="La vulnerabilidad fue detectada nuevamente por Wazuh",
        ))

    if existing.severity != vuln.get("severity"):
        db.add(VulnerabilityHistory(
            vulnerability_id=existing.id,
            action="SEVERITY_CHANGED",
            details=f"Severidad cambió de {existing.severity} a {vuln.get('severity')}",
        ))
        existing.severity = vuln.get("severity")

    existing.score_base = (vuln.get("score") or {}).get("base")
    existing.last_seen = func.now()


def process_wazuh_vulnerabilities(db: Session, conn_id: int, raw_vulns: list, raw_agents: Optional[list] = None) -> int:
    count = 0
    seen_vuln_ids = set()

    conn = db.query(WazuhConnection).filter_by(id=conn_id).first()
    if not conn:
        return 0

    manager_id = _get_or_create_manager(db, conn)
    asset_cache = {}

    if manager_id and raw_agents:
        for a in raw_agents:
            agent_data = a.get("agent", {})
            host_data = a.get("host") or {}
            osinfo = host_data.get("os") or {}
            agent_id = agent_data.get("id")
            if agent_id:
                aid = _get_or_create_asset(
                    db,
                    agent_id,
                    agent_data.get("name"),
                    osinfo.get("version"),
                    manager_id,
                    host_data,
                )
                if aid:
                    asset_cache[agent_id] = aid

    active_vulns_in_db = db.query(WazuhVulnerability).filter_by(connection_id=conn_id, status="ACTIVE").all()
    active_vuln_dict = {v.id: v for v in active_vulns_in_db}

    for v in raw_vulns:
        agent = v.get("agent", {})
        host = v.get("host") or {}
        osinfo = host.get("os") or {}
        pkg = v.get("package", {})
        vuln = v.get("vulnerability", {})

        if not vuln.get("id"):
            continue

        if manager_id:
            agent_id = agent.get("id")
            asset_id = asset_cache.get(agent_id)
            if not asset_id and agent_id:
                asset_id = _get_or_create_asset(
                    db,
                    agent_id,
                    agent.get("name"),
                    osinfo.get("version"),
                    manager_id,
                    host,
                )
                if asset_id:
                    asset_cache[agent_id] = asset_id
                    
            _get_or_create_cve_catalog(db, vuln.get("id"), vuln.get("severity"), vuln.get("description"), (vuln.get("score") or {}).get("base"))
            if asset_id:
                _create_vulnerability_detection(db, asset_id, vuln.get("id"), vuln.get("detected_at"), pkg.get("name"), pkg.get("version"))

        existing = db.query(WazuhVulnerability).filter_by(
            connection_id=conn_id,
            agent_id=agent.get("id"),
            package_name=pkg.get("name"),
            package_version=pkg.get("version"),
            cve_id=vuln.get("id"),
        ).first()

        if existing:
            seen_vuln_ids.add(existing.id)
            _handle_existing_vuln(db, existing, vuln)
        else:
            new_vuln = _create_new_vuln(db, conn_id, agent, osinfo, pkg, vuln)
            seen_vuln_ids.add(new_vuln.id)

        count += 1

    _resolve_missing_vulns(db, active_vuln_dict, seen_vuln_ids)
    return count


def _create_new_vuln(db, conn_id, agent, osinfo, pkg, vuln):
    new_vuln = WazuhVulnerability(
        connection_id=conn_id,
        status="ACTIVE",
        agent_id=agent.get("id"),
        agent_name=agent.get("name"),
        os_full=osinfo.get("full"),
        os_platform=osinfo.get("platform"),
        os_version=osinfo.get("version"),
        package_name=pkg.get("name"),
        package_version=pkg.get("version"),
        package_type=pkg.get("type"),
        package_arch=pkg.get("architecture"),
        cve_id=vuln.get("id"),
        severity=vuln.get("severity"),
        score_base=(vuln.get("score") or {}).get("base"),
        score_version=(vuln.get("score") or {}).get("version"),
        detected_at=_parse_wazuh_datetime(vuln.get("detected_at")),
        published_at=_parse_wazuh_datetime(vuln.get("published_at")),
        description=vuln.get("description"),
        reference=vuln.get("reference"),
        scanner_vendor=(vuln.get("scanner") or {}).get("vendor"),
    )
    db.add(new_vuln)
    db.flush()
    db.add(VulnerabilityHistory(
        vulnerability_id=new_vuln.id,
        action="DETECTED",
        details="Vulnerabilidad identificada por primera vez",
    ))
    return new_vuln


def _resolve_missing_vulns(db, active_vuln_dict, seen_vuln_ids):
    for vuln_id, db_vuln in active_vuln_dict.items():
        if vuln_id not in seen_vuln_ids:
            db_vuln.status = "RESOLVED"
            db.add(VulnerabilityHistory(
                vulnerability_id=vuln_id,
                action="RESOLVED",
                details="Ya no es reportada por el agente (Probablemente parcheada)",
            ))


@app.post("/vulns/sync-all")
def sync_all_connections(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    conns = db.query(WazuhConnection).filter(WazuhConnection.is_active == True).all()
    results = []

    for conn in conns:
        background_tasks.add_task(_run_sync_task, conn.id)
        results.append({"connection": conn.name, "message": "Sincronización iniciada en segundo plano", "ok": True})

    return results


@app.get("/vulns")
def list_vulns(
    limit: Optional[int] = None,
    connection_id: int = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(WazuhVulnerability)

    if connection_id:
        query = query.filter(WazuhVulnerability.connection_id == connection_id)

    if limit is not None:
        if limit == 0:
            return []
        query = query.limit(limit)

    vulns = query.all()

    return [
        {
            "id": v.id,
            "connection_id": v.connection_id,
            "connection_name": v.connection.name if v.connection else None,
            "status": v.status,
            "agent_id": v.agent_id,
            "agent_name": v.agent_name,
            "os_full": v.os_full,
            "os_platform": v.os_platform,
            "os_version": v.os_version,
            "package_name": v.package_name,
            "package_version": v.package_version,
            "package_type": v.package_type,
            "package_arch": v.package_arch,
            "cve_id": v.cve_id,
            "severity": v.severity,
            "score_base": float(v.score_base) if v.score_base else None,
            "score_version": v.score_version,
            "detected_at": v.detected_at,
            "published_at": v.published_at,
            "description": v.description,
            "reference": v.reference,
            "scanner_vendor": v.scanner_vendor,
            "first_seen": v.first_seen,
            "last_seen": v.last_seen,
            "history": [
                {
                    "id": h.id,
                    "action": h.action,
                    "details": h.details,
                    "timestamp": h.timestamp,
                }
                for h in sorted(v.history, key=lambda h: h.timestamp)
            ],
        }
        for v in vulns
    ]


@app.get("/managers")
def list_managers(
    limit: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Managers)
    if limit is not None:
        query = query.limit(limit)
    rows = query.all()
    return [{"id": str(r.id), "name": r.name, "api_url": r.api_url} for r in rows]


@app.get("/assets")
def list_assets(
    manager_id: Optional[str] = None,
    limit: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Assets)
    if manager_id:
        query = query.filter(Assets.manager_id == manager_id)

    if limit is not None:
        query = query.limit(limit)
    rows = query.all()
    return [
        {
            "id": str(r.id),
            "wazuh_agent_id": r.wazuh_agent_id,
            "hostname": r.hostname,
            "ip_address": r.ip_address,
            "os_version": r.os_version,
            "manager_id": str(r.manager_id),
        }
        for r in rows
    ]


@app.get("/vulnerability-catalog")
def list_vulnerability_catalog(
    limit: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(VulnerabilityCatalog)
    if limit is not None:
        query = query.limit(limit)
    rows = query.all()
    return [
        {"cve_id": r.cve_id, "severity": r.severity, "cvss_score": float(r.cvss_score) if r.cvss_score is not None else None, "description": r.description}
        for r in rows
    ]


@app.get("/vulnerability-detections")
def list_vulnerability_detections(
    asset_id: Optional[str] = None,
    cve_id: Optional[str] = None,
    limit: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(VulnerabilityDetections)
    if asset_id:
        query = query.filter(VulnerabilityDetections.asset_id == asset_id)
    if cve_id:
        query = query.filter(VulnerabilityDetections.cve_id == cve_id)
    query = query.order_by(VulnerabilityDetections.timestamp.desc())
    if limit is not None:
        query = query.limit(limit)
    rows = query.all()
    return [
        {
            "timestamp": r.timestamp,
            "asset_id": str(r.asset_id),
            "cve_id": r.cve_id,
            "status": r.status,
            "package_name": r.package_name,
            "package_version": r.package_version,
        }
        for r in rows
    ]

@app.get("/vulnerabilities")
def filter_vulnerabilities(
    connection_id: Optional[int] = None,
    cve_id: Optional[str] = None,
    year: Optional[int] = None,
    severity: Optional[str] = None,
    os_platform: Optional[str] = None,
    agent_id: Optional[str] = None,
    status: Optional[str] = None,
    days: Optional[int] = None,
    reincident: Optional[bool] = None,
    limit: int = Query(default=100, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conditions = ["1=1"]
    parameters = {}

    if connection_id is not None:
        conditions.append("connection_id = :conn_id")
        parameters["conn_id"] = connection_id

    if cve_id:
        conditions.append("UPPER(cve_id) = UPPER(:cve_id)")
        parameters["cve_id"] = cve_id

    if year:
        start_of_year = datetime(year, 1, 1, tzinfo=timezone.utc)
        end_of_year = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
        conditions.append("detected_at >= :start_of_year AND detected_at < :end_of_year")
        parameters["start_of_year"] = start_of_year
        parameters["end_of_year"] = end_of_year

    if severity:
        conditions.append("UPPER(severity) = UPPER(:severity)")
        parameters["severity"] = severity

    if os_platform:
        conditions.append("(UPPER(os_platform) = UPPER(:os_platform) OR UPPER(os_full) = UPPER(:os_platform))")
        parameters["os_platform"] = os_platform

    if agent_id:
        conditions.append("(agent_id = :agent_id OR UPPER(agent_name) = UPPER(:agent_id))")
        parameters["agent_id"] = agent_id

    if status:
        conditions.append("UPPER(status) = UPPER(:status)")
        parameters["status"] = status

    if days:
        threshold = datetime.now(timezone.utc) - timedelta(days=days)
        conditions.append("detected_at >= :threshold")
        parameters["threshold"] = threshold

    base_where_clause = " WHERE " + " AND ".join(conditions)

    if reincident:
        conditions.append(f"""
            cve_id IN (
                SELECT cve_id 
                FROM mv_wazuh_vulnerabilities 
                {base_where_clause}
                GROUP BY cve_id 
                HAVING COUNT(DISTINCT agent_id) > 1
            )
        """)

    where_clause = " WHERE " + " AND ".join(conditions)

    if reincident:
        count_query = f"""
            SELECT COUNT(DISTINCT cve_id) 
            FROM mv_wazuh_vulnerabilities
            {where_clause}
        """
        query = f"""
            SELECT 
                cve_id,
                MAX(id) as id,
                MAX(connection_id) as connection_id,
                MAX(agent_id) as agent_id,
                MAX(agent_name) as agent_name,
                MAX(os_full) as os_full,
                MAX(os_platform) as os_platform,
                MAX(os_version) as os_version,
                MAX(package_name) as package_name,
                MAX(package_version) as package_version,
                MAX(package_type) as package_type,
                MAX(package_arch) as package_arch,
                MAX(severity) as severity,
                MAX(score_base) as score_base,
                MAX(score_version) as score_version,
                MAX(detected_at) as detected_at,
                MAX(published_at) as published_at,
                MAX(description) as description,
                MAX(reference) as reference,
                MAX(scanner_vendor) as scanner_vendor,
                MAX(first_seen) as first_seen,
                MAX(last_seen) as last_seen,
                MAX(status) as status
            FROM mv_wazuh_vulnerabilities
            {where_clause}
            GROUP BY cve_id
            ORDER BY MAX(detected_at) DESC
            LIMIT :limit
            OFFSET :offset
        """
    else:
        count_query = f"""
            SELECT COUNT(*) 
            FROM mv_wazuh_vulnerabilities
            {where_clause}
        """
        query = f"""
            SELECT *
            FROM mv_wazuh_vulnerabilities
            {where_clause}
            ORDER BY detected_at DESC
            LIMIT :limit
            OFFSET :offset
        """

    total_count = db.execute(text(count_query), parameters).scalar()

    parameters["limit"] = limit
    parameters["offset"] = offset

    rows = db.execute(text(query), parameters).mappings().all()
    return {
        "total": total_count,
        "items": [dict(row) for row in rows]
    }


@app.get("/vulnerabilities/timeline")
def get_vulnerabilities_timeline(
    connection_id: Optional[int] = None,
    limit: int = Query(default=2000, ge=1, le=5000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(WazuhVulnerability).options(joinedload(WazuhVulnerability.history))
    
    if connection_id is not None:
        query = query.filter(WazuhVulnerability.connection_id == connection_id)
        
    vulns = query.order_by(WazuhVulnerability.first_seen.desc()).limit(limit).all()
    
    result = []
    for v in vulns:
        result.append({
            "id": v.id,
            "cve_id": v.cve_id,
            "agent_name": v.agent_name,
            "severity": v.severity,
            "first_seen": v.first_seen,
            "history": [{"timestamp": h.timestamp, "action": h.action} for h in v.history]
        })
    return result


@app.get("/analytics/summary")
def get_analytics_summary(
    connection_id: Optional[int] = None,
    cve_id: Optional[str] = None,
    year: Optional[int] = None,
    severity: Optional[str] = None,
    os_platform: Optional[str] = None,
    status: Optional[str] = None,
    days: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conditions = ["1=1"]
    parameters = {}

    if connection_id is not None:
        conditions.append("connection_id = :conn_id")
        parameters["conn_id"] = connection_id

    if cve_id:
        conditions.append("cve_id ILIKE :cve_id")
        parameters["cve_id"] = f"%{cve_id}%"

    if year:
        start_date = datetime(year, 1, 1, tzinfo=timezone.utc)
        end_date = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
        conditions.append("detected_at >= :year_start AND detected_at < :year_end")
        parameters["year_start"] = start_date
        parameters["year_end"] = end_date

    if severity:
        conditions.append("severity = :severity")
        parameters["severity"] = severity

    if os_platform:
        conditions.append("os_platform ILIKE :os_platform")
        parameters["os_platform"] = f"%{os_platform}%"

    if status:
        conditions.append("status = :status")
        parameters["status"] = status
    else:
        conditions.append("status = 'ACTIVE'")

    if days:
        threshold = datetime.now(timezone.utc) - timedelta(days=days)
        conditions.append("detected_at >= :threshold")
        parameters["threshold"] = threshold

    where_clause = " WHERE " + " AND ".join(conditions)

    query_sev = f"""
        SELECT severity, COUNT(*) as count
        FROM mv_wazuh_vulnerabilities
        {where_clause}
        GROUP BY severity
    """
    
    query_cves = f"""
        SELECT cve_id, COUNT(*) as count
        FROM mv_wazuh_vulnerabilities
        {where_clause}
        GROUP BY cve_id
        ORDER BY count DESC
        LIMIT 5
    """

    query_agents = f"""
        SELECT agent_name, COUNT(*) as count
        FROM mv_wazuh_vulnerabilities
        {where_clause}
        GROUP BY agent_name
        ORDER BY count DESC
        LIMIT 5
    """

    query_summary = f"""
        SELECT 
            COUNT(*) as total_vulns,
            COUNT(DISTINCT agent_id) as total_agents,
            SUM(CASE WHEN severity IN ('Critical', 'CRITICAL', 'Crítica', 'critical') THEN 1 ELSE 0 END) as critical_vulns,
            COUNT(DISTINCT CASE WHEN severity IN ('Critical', 'CRITICAL', 'Crítica', 'critical') THEN agent_id ELSE NULL END) as critical_agents
        FROM mv_wazuh_vulnerabilities
        {where_clause}
    """

    query_reincidentes = f"""
        SELECT COUNT(*) as reincident_cves
        FROM (
            SELECT cve_id
            FROM mv_wazuh_vulnerabilities
            {where_clause}
            GROUP BY cve_id
            HAVING COUNT(DISTINCT agent_id) > 1
        ) sub
    """

    severity_rows = db.execute(text(query_sev), parameters).mappings().all()
    cves_rows = db.execute(text(query_cves), parameters).mappings().all()
    agents_rows = db.execute(text(query_agents), parameters).mappings().all()
    
    summary_row = db.execute(text(query_summary), parameters).mappings().first()
    reincident_row = db.execute(text(query_reincidentes), parameters).mappings().first()

    total_vulns = summary_row["total_vulns"] or 0
    total_agents = summary_row["total_agents"] or 0
    critical_vulns = summary_row["critical_vulns"] or 0
    critical_agents = summary_row["critical_agents"] or 0
    
    pct_critical_vulns = round((critical_vulns / total_vulns * 100), 1) if total_vulns > 0 else 0
    pct_critical_agents = round((critical_agents / total_agents * 100), 1) if total_agents > 0 else 0
    reincident_cves = reincident_row["reincident_cves"] or 0

    return {
        "severity_distribution": [dict(r) for r in severity_rows],
        "top_cves": [dict(r) for r in cves_rows],
        "top_agents": [dict(r) for r in agents_rows],
        "summary_metrics": {
            "total_vulns": total_vulns,
            "critical_vulns": critical_vulns,
            "pct_critical_vulns": pct_critical_vulns,
            "total_agents": total_agents,
            "critical_agents": critical_agents,
            "pct_critical_agents": pct_critical_agents,
            "reincident_cves": reincident_cves
        }
    }


@app.get("/vulnerabilities/{cve_id}/assets")
def get_assets_by_vulnerability(
    cve_id: str,
    limit: int = Query(default=100, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = """
        SELECT DISTINCT agent_id, agent_name, os_platform, os_version, os_full
        FROM mv_wazuh_vulnerabilities
        WHERE cve_id = :cve_id
        ORDER BY agent_id
        LIMIT :limit OFFSET :offset
    """
    rows = db.execute(text(query), {"cve_id": cve_id, "limit": limit, "offset": offset}).mappings().all()
    return [dict(row) for row in rows]
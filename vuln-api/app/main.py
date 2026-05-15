# app/main.py
import re
import os
import uuid
from datetime import datetime, timezone, timedelta
from fastapi import FastAPI, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from dotenv import set_key, find_dotenv
from sqlalchemy.orm import Session
from typing import List, Annotated, Optional
from pydantic import BaseModel
from sqlalchemy.sql import func
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
from .wazuh_client import fetch_all_vulns, test_connection
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


@app.post("/wazuh-connections/{conn_id}/sync")
def sync_connection(
    conn_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conn = db.query(WazuhConnection).filter(WazuhConnection.id == conn_id).first()
    if not conn:
        raise HTTPException(status_code=404, detail=CONNECTION_NOT_FOUND)
    if not conn.is_active:
        raise HTTPException(status_code=400, detail="La conexión está inactiva")

    raw_vulns = fetch_all_vulns(
        conn.indexer_url, conn.wazuh_user, decrypt(conn.wazuh_password)
    )

    count = process_wazuh_vulnerabilities(db, conn.id, raw_vulns)
    db.commit()

    return {"synced": count, "connection": conn.name}


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
            existing.hostname = agent_name or existing.hostname
            existing.os_version = os_version or existing.os_version
            existing.ip_address = ip_address or existing.ip_address
            return existing.id
        asset = Assets(
            wazuh_agent_id=agent_id,
            hostname=agent_name,
            os_version=os_version,
            ip_address=ip_address,
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


def process_wazuh_vulnerabilities(db: Session, conn_id: int, raw_vulns: list) -> int:
    count = 0
    seen_vuln_ids = set()

    conn = db.query(WazuhConnection).filter_by(id=conn_id).first()
    if not conn:
        return 0

    manager_id = _get_or_create_manager(db, conn)

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
            asset_id = _get_or_create_asset(
                db,
                agent.get("id"),
                agent.get("name"),
                osinfo.get("version"),
                manager_id,
                host,
            )
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
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    conns = db.query(WazuhConnection).filter(WazuhConnection.is_active == True).all()
    results = []

    for conn in conns:
        try:
            raw_vulns = fetch_all_vulns(
                conn.indexer_url,
                conn.wazuh_user,
                decrypt(conn.wazuh_password),
            )

            count = process_wazuh_vulnerabilities(db, conn.id, raw_vulns)
            db.commit()

            results.append({"connection": conn.name, "synced": count, "ok": True})
        except Exception as e:
            db.rollback()
            results.append({"connection": conn.name, "ok": False, "error": str(e)})

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
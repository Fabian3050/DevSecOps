# app/models.py
from sqlalchemy import (
    Column,
    Integer,
    Boolean,
    String,
    Text,
    DateTime,
    Numeric,
    UniqueConstraint,
    ForeignKey,
    Enum
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .db import Base
import uuid

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    is_active = Column(Boolean, default=False) 
    is_default_password = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    interactions = relationship("UserInteraction", back_populates="user")


class WazuhConnection(Base):
    __tablename__ = "wazuh_connections"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String, nullable=False, unique=True)
    indexer_url = Column(String, nullable=False)
    wazuh_user = Column(String, nullable=False)
    wazuh_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    vulnerabilities = relationship("WazuhVulnerability", back_populates="connection")
    tested = Column(Boolean, default=False)
    last_tested_at = Column(DateTime(timezone=True), nullable=True)
    last_test_ok = Column(Boolean, nullable=True)


class UserInteraction(Base):
    __tablename__ = "user_interactions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    endpoint = Column(String, index=True)
    method = Column(String)
    details = Column(Text, nullable=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    user = relationship("User", back_populates="interactions")


class WazuhVulnerability(Base):
    __tablename__ = "wazuh_vulnerabilities"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    connection_id = Column(Integer, ForeignKey("wazuh_connections.id"), nullable=False)
    connection = relationship("WazuhConnection", back_populates="vulnerabilities")
    status = Column(String, default="ACTIVE")
    agent_id = Column(String, nullable=False, index=True)
    agent_name = Column(String)
    os_full = Column(Text)
    os_platform = Column(Text)
    os_version = Column(Text)
    package_name = Column(Text)
    package_version = Column(Text)
    package_type = Column(Text)
    package_arch = Column(Text)
    cve_id = Column(Text, nullable=False)
    severity = Column(Text)
    score_base = Column(Numeric)
    score_version = Column(Text)
    detected_at = Column(DateTime(timezone=True))
    published_at = Column(DateTime(timezone=True))
    description = Column(Text)
    reference = Column(Text)
    scanner_vendor = Column(Text)
    first_seen = Column(DateTime(timezone=True), server_default=func.now())
    last_seen = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    history = relationship(
        "VulnerabilityHistory",
        back_populates="vulnerability",
        cascade="all, delete-orphan",
    )
    __table_args__ = (
        UniqueConstraint(
            "connection_id",
            "agent_id",
            "package_name",
            "package_version",
            "cve_id",
            name="uniq_wazuh_vuln",
        ),
    )


class VulnerabilityHistory(Base):
    __tablename__ = "vulnerability_history"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    vulnerability_id = Column(
        Integer, ForeignKey("wazuh_vulnerabilities.id"), nullable=False
    )
    action = Column(String, nullable=False)
    details = Column(Text, nullable=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    vulnerability = relationship("WazuhVulnerability", back_populates="history")


class Managers(Base):
    __tablename__ = "managers"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False, unique=True)
    api_url = Column(Text)
    api_key_vault_ref = Column(Text)
    assets = relationship("Assets", back_populates="manager")

class Assets(Base):
    __tablename__ = "assets"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    wazuh_agent_id = Column(String, nullable=False, index=True)
    hostname = Column(String)
    os_version = Column(String)
    ip_address = Column(String, nullable=False)
    manager_id = Column(UUID(as_uuid=True), ForeignKey("managers.id"), nullable=False)
    manager = relationship("Managers", back_populates="assets")
    vulnerability_detections = relationship("VulnerabilityDetections", back_populates="asset")

class VulnerabilityCatalog(Base):
    __tablename__ = "vulnerability_catalog"
    cve_id = Column(String, primary_key=True, nullable=False, unique=True)
    severity = Column(Enum("LOW", "MEDIUM", "HIGH", "CRITICAL", name="severity_enum"))
    description = Column(Text)
    cvss_score = Column(Numeric(precision=3, scale=1))  
    detections = relationship("VulnerabilityDetections", back_populates="cve")

class VulnerabilityDetections(Base):
    __tablename__ = "vulnerability_detections"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    timestamp = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), index=True)
    asset_id = Column(UUID(as_uuid=True), ForeignKey("assets.id"), nullable=False)
    cve_id = Column(String, ForeignKey("vulnerability_catalog.cve_id"), nullable=False)
    status = Column(Enum("DETECTED", "RESOLVED", "RE-EMERGED", name="vulnerability_status_enum"), nullable=False, default="DETECTED")
    package_name = Column(String)
    package_version = Column(String)  
    asset = relationship("Assets", back_populates="vulnerability_detections")
    cve   = relationship("VulnerabilityCatalog", back_populates="detections")



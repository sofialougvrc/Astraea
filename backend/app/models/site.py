from sqlalchemy import Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

try:
    from geoalchemy2 import Geometry
except ImportError:  # Allows syntax checks in minimal Python environments.
    Geometry = None

from app.db.session import Base


GeometryColumn = Geometry("POLYGON", srid=4326) if Geometry else Text


class ExcavationSite(Base):
    __tablename__ = "excavation_sites"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(200))
    region: Mapped[str] = mapped_column(String(200))
    geometry: Mapped[object | None] = mapped_column(GeometryColumn, nullable=True)

    units: Mapped[list["StratigraphicUnit"]] = relationship(back_populates="site")


class StratigraphicUnit(Base):
    __tablename__ = "stratigraphic_units"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    site_id: Mapped[int] = mapped_column(ForeignKey("excavation_sites.id"))
    su_code: Mapped[str] = mapped_column(String(32), index=True)
    label: Mapped[str] = mapped_column(String(200))
    phase: Mapped[str] = mapped_column(String(80))
    description: Mapped[str] = mapped_column(Text)
    start_year: Mapped[int] = mapped_column(Integer)
    end_year: Mapped[int] = mapped_column(Integer)
    prior_range: Mapped[list[int]] = mapped_column(ARRAY(Integer))
    posterior_range: Mapped[list[int]] = mapped_column(ARRAY(Integer))
    confidence: Mapped[float] = mapped_column(Float)
    geometry: Mapped[object | None] = mapped_column(GeometryColumn, nullable=True)

    site: Mapped[ExcavationSite] = relationship(back_populates="units")
    artifacts: Mapped[list["Artifact"]] = relationship(back_populates="unit")


class Artifact(Base):
    __tablename__ = "artifacts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    unit_id: Mapped[int] = mapped_column(ForeignKey("stratigraphic_units.id"))
    artifact_code: Mapped[str] = mapped_column(String(32), index=True)
    name: Mapped[str] = mapped_column(String(200))
    artifact_type: Mapped[str] = mapped_column(String(80))
    date_range: Mapped[list[int]] = mapped_column(ARRAY(Integer))
    metadata_json: Mapped[dict] = mapped_column(JSONB, default=dict)

    unit: Mapped[StratigraphicUnit] = relationship(back_populates="artifacts")


class StratigraphicRelationship(Base):
    __tablename__ = "stratigraphic_relationships"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    site_id: Mapped[int] = mapped_column(ForeignKey("excavation_sites.id"))
    source_su: Mapped[str] = mapped_column(String(32), index=True)
    target_su: Mapped[str] = mapped_column(String(32), index=True)
    relationship_type: Mapped[str] = mapped_column(String(60))
    confidence: Mapped[float] = mapped_column(Float)
    evidence: Mapped[str] = mapped_column(Text, default="")

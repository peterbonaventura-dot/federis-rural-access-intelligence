from pathlib import Path

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine

from ..config.settings import settings
from ..config.sources import SOURCES


_engine: Engine | None = None


def engine() -> Engine:
    global _engine
    if _engine is None:
        _engine = create_engine(settings.database_url, future=True)
    return _engine


def init_schema() -> None:
    """Run schema.sql and seed the source_registry. Idempotent."""
    schema_path = Path(__file__).parent / "schema.sql"
    sql = schema_path.read_text()
    with engine().begin() as conn:
        for stmt in _split_statements(sql):
            conn.execute(text(stmt))
        for src in SOURCES:
            conn.execute(
                text(
                    """
                    INSERT INTO source_registry
                        (source_key, display_name, source_url, citation, license_note,
                         geography_level, update_cadence)
                    VALUES (:source_key, :display_name, :source_url, :citation, :license_note,
                            :geography_level, :update_cadence)
                    ON CONFLICT (source_key) DO UPDATE SET
                        display_name = EXCLUDED.display_name,
                        source_url = EXCLUDED.source_url,
                        citation = EXCLUDED.citation,
                        license_note = EXCLUDED.license_note,
                        geography_level = EXCLUDED.geography_level,
                        update_cadence = EXCLUDED.update_cadence
                    """
                ),
                src,
            )


def _split_statements(sql: str) -> list[str]:
    # naive split; schema.sql intentionally avoids `;` inside string literals
    return [s.strip() for s in sql.split(";") if s.strip()]

"""Base loader: provenance tracking + idempotent upserts.

Every concrete loader implements `_run()` and returns a `LoadResult`. The
base class wraps the call to insert a row into `load_runs`, capturing
vintage, download timestamp, row count, and status (success/failed). A
loader that raises is logged with status='failed' and the exception re-
raised so the CLI exits non-zero.
"""

from __future__ import annotations

import logging
import sys
from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

import requests
from sqlalchemy import text
from tenacity import retry, stop_after_attempt, wait_exponential

from ..config.settings import settings
from ..db.connection import engine


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    stream=sys.stdout,
)
log = logging.getLogger("loader")


@dataclass
class LoadResult:
    data_vintage: str
    row_count: int
    notes: str = ""


class Loader(ABC):
    source_key: str

    @abstractmethod
    def _run(self) -> LoadResult: ...

    def run(self) -> LoadResult:
        log.info("starting load: %s", self.source_key)
        started = datetime.now(timezone.utc)
        try:
            result = self._run()
        except Exception as exc:  # noqa: BLE001
            self._record(None, 0, "failed", f"{type(exc).__name__}: {exc}", started)
            log.exception("load failed: %s", self.source_key)
            raise
        self._record(result.data_vintage, result.row_count, "success", result.notes, started)
        log.info(
            "completed load: %s vintage=%s rows=%d",
            self.source_key, result.data_vintage, result.row_count,
        )
        return result

    def _record(
        self,
        vintage: str | None,
        row_count: int,
        status: str,
        notes: str,
        downloaded_at: datetime,
    ) -> None:
        with engine().begin() as conn:
            conn.execute(
                text(
                    """
                    INSERT INTO load_runs
                        (source_key, data_vintage, downloaded_at, row_count, status, notes)
                    VALUES (:k, :v, :t, :r, :s, :n)
                    """
                ),
                {
                    "k": self.source_key,
                    "v": vintage,
                    "t": downloaded_at,
                    "r": row_count,
                    "s": status,
                    "n": notes or None,
                },
            )

    # ------------------------------------------------------------------
    # Shared helpers
    # ------------------------------------------------------------------
    @retry(stop=stop_after_attempt(4), wait=wait_exponential(multiplier=2, min=2, max=16))
    def download(self, url: str, dest_name: str) -> Path:
        """Download `url` into the local data cache. Skip if file exists."""
        dest = settings.data_dir / dest_name
        if dest.exists() and dest.stat().st_size > 0:
            log.info("cache hit: %s", dest.name)
            return dest
        log.info("downloading: %s", url)
        resp = requests.get(url, timeout=120, stream=True)
        resp.raise_for_status()
        with open(dest, "wb") as f:
            for chunk in resp.iter_content(chunk_size=1 << 16):
                f.write(chunk)
        return dest

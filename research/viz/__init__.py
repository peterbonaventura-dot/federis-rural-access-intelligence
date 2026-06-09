"""Static figure generation for the rural-health research repo.

Each module here is a single-purpose figure that reads from the research
database and writes a PNG (and a sidecar CSV with the underlying numbers,
so the HRSA-narrative authors can cite the data behind the visual).

Run from the CLI:

    python -m research.run viz workforce_choropleth
    python -m research.run viz access_deserts
    python -m research.run viz rural_urban_bars
    python -m research.run viz all
"""

from . import workforce_choropleth, access_deserts, rural_urban_bars

REGISTRY = {
    "workforce_choropleth": workforce_choropleth.render,
    "access_deserts": access_deserts.render,
    "rural_urban_bars": rural_urban_bars.render,
}

__all__ = ["REGISTRY"]

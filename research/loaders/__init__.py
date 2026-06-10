from .base import Loader, LoadResult
from . import ers_rucc, ers_ruca, ers_far, bls_oews, acs_age_disability, hrsa_ahrf, facility, ic_operational


REGISTRY: dict[str, Loader] = {
    "ers_rucc": ers_rucc.ErsRuccLoader(),
    "ers_ruca": ers_ruca.ErsRucaLoader(),
    "ers_far": ers_far.ErsFarLoader(),
    "bls_oews": bls_oews.BlsOewsLoader(),
    "acs_age_disability": acs_age_disability.AcsAgeDisabilityLoader(),
    "hrsa_ahrf": hrsa_ahrf.HrsaAhrfLoader(),
    "facility_cms_home_health": facility.CmsHomeHealthLoader(),
    "ic_operational": ic_operational.ICOperationalLoader(),
}

__all__ = ["Loader", "LoadResult", "REGISTRY"]

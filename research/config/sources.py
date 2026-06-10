"""Source registry: every dataset this repo ingests.

Each entry seeds the `source_registry` table on startup so analysts can cite
provenance directly out of SQL. URLs are pinned to landing pages, not deep
file links, because vintages change yearly — the loader resolves the actual
file by year.
"""

SOURCES = [
    {
        "source_key": "ers_rucc",
        "display_name": "USDA ERS Rural-Urban Continuum Codes",
        "source_url": "https://www.ers.usda.gov/data-products/rural-urban-continuum-codes/",
        "citation": "U.S. Department of Agriculture, Economic Research Service. Rural-Urban Continuum Codes.",
        "license_note": "Public domain (U.S. Government work).",
        "geography_level": "county",
        "update_cadence": "decennial revision; minor annual updates",
    },
    {
        "source_key": "ers_ruca",
        "display_name": "USDA ERS Rural-Urban Commuting Area Codes",
        "source_url": "https://www.ers.usda.gov/data-products/rural-urban-commuting-area-codes/",
        "citation": "U.S. Department of Agriculture, Economic Research Service. Rural-Urban Commuting Area Codes.",
        "license_note": "Public domain (U.S. Government work).",
        "geography_level": "tract",
        "update_cadence": "decennial revision",
    },
    {
        "source_key": "ers_far",
        "display_name": "USDA ERS Frontier and Remote Area Codes",
        "source_url": "https://www.ers.usda.gov/data-products/frontier-and-remote-area-codes/",
        "citation": "U.S. Department of Agriculture, Economic Research Service. Frontier and Remote Area Codes.",
        "license_note": "Public domain (U.S. Government work).",
        "geography_level": "zcta",
        "update_cadence": "decennial revision",
    },
    {
        "source_key": "bls_oews",
        "display_name": "BLS Occupational Employment and Wage Statistics",
        "source_url": "https://www.bls.gov/oes/tables.htm",
        "citation": "U.S. Bureau of Labor Statistics. Occupational Employment and Wage Statistics (OEWS).",
        "license_note": "Public domain (U.S. Government work). Cite BLS as source.",
        "geography_level": "county",
        "update_cadence": "annual (May reference period)",
    },
    {
        "source_key": "acs_age_disability",
        "display_name": "Census ACS 5-Year: Age and Self-Care Disability",
        "source_url": "https://www.census.gov/data/developers/data-sets/acs-5year.html",
        "citation": "U.S. Census Bureau. American Community Survey 5-Year Estimates (Tables B01001, B18106).",
        "license_note": "Public domain (U.S. Government work). API terms: api.census.gov.",
        "geography_level": "county",
        "update_cadence": "annual",
    },
    {
        "source_key": "hrsa_ahrf",
        "display_name": "HRSA Area Health Resources File",
        "source_url": "https://data.hrsa.gov/topics/health-workforce/ahrf",
        "citation": "U.S. Health Resources and Services Administration. Area Health Resources Files.",
        "license_note": "Public domain (U.S. Government work).",
        "geography_level": "county",
        "update_cadence": "annual",
    },
    {
        "source_key": "facility_cms_home_health",
        "display_name": "CMS Home Health Agency Provider List",
        "source_url": "https://data.cms.gov/provider-data/dataset/6jpm-sxkc",
        "citation": "Centers for Medicare & Medicaid Services. Home Health Care Agencies provider data.",
        "license_note": "Public domain (U.S. Government work).",
        "geography_level": "point",
        "update_cadence": "monthly",
    },
    {
        "source_key": "ic_operational",
        "display_name": "Independence Care operational aggregates (HHAX + ApplicantStack)",
        "source_url": "internal://base44/entities",
        "citation": "Independence Care operational records, aggregated to county level under consent + HIPAA Safe Harbor §164.514(b)(2) + n>=11 suppression. Not a public dataset.",
        "license_note": "Restricted use; internal research only. Aggregated/de-identified, non-PHI under §164.514(b).",
        "geography_level": "county",
        "update_cadence": "on-demand (re-run as consent universe expands)",
    },
]

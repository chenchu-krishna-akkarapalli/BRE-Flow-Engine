# Latency SLA Targets (in milliseconds)
SLA_TARGET_SIMPLE_GET_MS: float = 30.0
SLA_TARGET_CRUD_EVAL_MS: float = 80.0
SLA_TARGET_ZEN_RAM_MS: float = 10.0
SLA_TARGET_TOTAL_END_TO_END_MS: float = 100.0

# Database Connection Pool Tuning
DB_POOL_SIZE: int = 20
DB_MAX_OVERFLOW: int = 10
DB_POOL_RECYCLE_SECONDS: int = 3600
DB_POOL_PRE_PING: bool = True

# Business Rule Threshold Defaults
MIN_APPLICANT_AGE: int = 21
MAX_SALARIED_EMI_AGE: int = 60
MAX_SELF_EMPLOYED_EMI_AGE: int = 65
MIN_NRI_STAY_DAYS: int = 182
MIN_SALARIED_NET_MONTHLY_INCOME: float = 25000.0
MIN_SALARIED_TOTAL_WORK_EXP_YEARS: int = 1
MIN_SELF_EMPLOYED_BUSINESS_EXP_YEARS: int = 2
MIN_SELF_EMPLOYED_CURRENT_ITR: float = 300000.0
MIN_SELF_EMPLOYED_PREVIOUS_ITR: float = 100000.0
# Two-year total required by banks whose matrix row reads "Current + Prev".
# It REPLACES the per-year floors at those banks rather than stacking on them.
MIN_SELF_EMPLOYED_COMBINED_ITR: float = 600000.0
MIN_SELF_EMPLOYED_LOAN_AMOUNT: float = 100000.0
DPD_WRITE_OFF_MAX_TOLERANCE_DAYS: int = 90

# add-on §6: below this the wizard stops at step 3 rather than collecting the
# remaining steps and rejecting at the end. Distinct from the per-bank
# `min_salary` column, which decides eligibility; this decides whether there is
# an application to score at all.
MIN_SALARIED_MONTHLY_SALARY: float = 25000.0

# add-on §8: the income co-applicant question appears only when BOTH filed ITRs
# fall below this. Not a bank threshold — it gates the question, not a verdict.
MIN_CO_APPLICANT_ITR_TRIGGER: float = 100000.0

# Tenant risk overlays layered on top of the bank matrix: tenant -> (rule id,
# CIBIL floor). Gates the applicant rather than one lender, so it scores at
# every bank.
TENANT_CIBIL_OVERLAY: dict[str, tuple[str, int]] = {"tenant_alpha": ("ALPHA-RSK-001", 720)}

# Rate Limiting Defaults
DEFAULT_TENANT_RATE_LIMIT_PER_MINUTE: int = 600

# Cache SWR & Expiry Limits (in seconds)
SWR_CACHE_MAX_AGE_SECONDS: int = 10
SWR_CACHE_STALE_WHILE_REVALIDATE_SECONDS: int = 60

# Document upload & OCR
MAX_UPLOAD_BYTES: int = 5 * 1024 * 1024
OTP_LENGTH: int = 6
OTP_TTL_SECONDS: int = 300
OTP_MAX_ATTEMPTS: int = 5

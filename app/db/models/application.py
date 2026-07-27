from typing import Any, Dict, Optional

from sqlalchemy import Boolean, Float, ForeignKey, Integer, JSON, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_class import Base

# Entity-specific attributes live in a JSONB document rather than a wide table
# of mostly-NULL columns: an Individual, a Company and an HUF share barely a
# third of their fields. Everything the platform filters, sorts or reports on
# is promoted to a typed column below; the rest stays in the document.
JSONDocument = JSON().with_variant(JSONB(), "postgresql")


class ApplicationModel(Base):
    """A submitted onboarding application and its evaluated verdict.

    Rows are tenant-scoped and only readable under an active RLS context
    (`app.current_tenant_id`); see `app.db.rls.set_tenant_rls_context`.
    """

    __tablename__ = "application"

    tenant_id: Mapped[str] = mapped_column(String(64), ForeignKey("tenant.id"), nullable=False, index=True)

    # --- Identity (step 1) ---------------------------------------------------
    entity_type: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    applicant_name: Mapped[Optional[str]] = mapped_column(String(180), nullable=True)
    # PAN is stored masked (AB******4F). The raw value never reaches the
    # database, so an audit query can never leak it.
    pan_masked: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    contact_email: Mapped[Optional[str]] = mapped_column(String(254), nullable=True)
    contact_phone: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    is_nri: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # --- Address (step 2; absent for Company) --------------------------------
    pincode: Mapped[Optional[str]] = mapped_column(String(6), nullable=True)
    city_name: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    state_name: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    resident_details: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)

    # --- Occupation & business (step 3) --------------------------------------
    profile_type: Mapped[Optional[str]] = mapped_column(String(32), nullable=True, index=True)
    occupation: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    property_status: Mapped[Optional[str]] = mapped_column(String(48), nullable=True)
    guarantor_provided: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    business_establishment_date: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    current_itr_amount: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    prev_itr_amount: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # --- Banking, bureau & loan (step 4) -------------------------------------
    selected_bank: Mapped[str] = mapped_column(String(32), nullable=False)
    loan_type: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    existing_account_bank: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    existing_car_loan_bank: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    cibil_score: Mapped[int] = mapped_column(Integer, nullable=False)
    cibil_pl_score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    dpd_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    max_dpd_days: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    loan_enquiry_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    currently_outstanding: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    write_off_amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    write_off_type: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)

    # --- Co-applicant (step 5; absent for Company) ---------------------------
    co_applicant_age_relation: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    co_applicant_income_relation: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)

    # --- Verdict & polymorphic detail ----------------------------------------
    status: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    overall_eligible: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    entity_detail_json: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONDocument, nullable=True)
    payload_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)

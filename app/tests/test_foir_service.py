"""Unit and API integration tests for Phase 2 Bank FOIR and Processed Income."""

from fastapi.testclient import TestClient
from app.main import app
from app.services.foir_service import foir_service
from app.api.schemas.income import Phase2FoirCalculationRequest

client = TestClient(app)


def test_bob_foir_salaried_tiers():
    """Verify BOB Salaried tiers against FOIR Calculation sheet."""
    # 0 - 50,000 monthly -> 60%
    ratio_low, desc_low, _ = foir_service.get_bank_foir_ratio("BOB", "Salaried", 480_000)  # 40k/mo
    assert ratio_low == 0.60

    # 50,000 - 150,000 monthly -> 70%
    ratio_mid, desc_mid, _ = foir_service.get_bank_foir_ratio("BOB", "Salaried", 1_200_000)  # 100k/mo
    assert ratio_mid == 0.70

    # > 150,000 monthly -> 80%
    ratio_high, desc_high, _ = foir_service.get_bank_foir_ratio("BOB", "Salaried", 2_400_000)  # 200k/mo
    assert ratio_high == 0.80


def test_bob_foir_self_employed_tiers():
    """Verify BOB Self-Employed tiers: < 6L -> 60%, >= 6L -> 80%."""
    ratio_low, _, _ = foir_service.get_bank_foir_ratio("BOB", "Self-Employed", 448_922.50)
    assert ratio_low == 0.60

    ratio_high, _, _ = foir_service.get_bank_foir_ratio("BOB", "Self-Employed", 750_000)
    assert ratio_high == 0.80


def test_bom_foir_tiers():
    """Verify BOM tiers for salaried and self-employed."""
    # Salaried: 50k-100k -> 65%, 100k-200k -> 70%
    r1, _, _ = foir_service.get_bank_foir_ratio("BOM", "Salaried", 960_000)  # 80k/mo
    assert r1 == 0.65

    # Self-Employed: 6L-12L -> 65%, 12L-24L -> 70%
    r2, _, _ = foir_service.get_bank_foir_ratio("BOM", "Self-Employed", 800_000)
    assert r2 == 0.65
    r3, _, _ = foir_service.get_bank_foir_ratio("BOM", "Self-Employed", 1_500_000)
    assert r3 == 0.70


def test_boi_and_iob_foir_tiers():
    """Verify BOI and IOB tiers."""
    # BOI salaried < 1L -> 60%, 1L-5L -> 70%
    r_boi_sal, _, _ = foir_service.get_bank_foir_ratio("BOI", "Salaried", 600_000)  # 50k/mo
    assert r_boi_sal == 0.60

    # IOB salaried > 1L -> 70% (DGM Approval)
    r_iob_high, desc_iob, notes = foir_service.get_bank_foir_ratio("IOB", "Salaried", 1_800_000)  # 150k/mo
    assert r_iob_high == 0.70
    assert "DGM Approval" in (notes or "")


def test_final_processed_income_calculation():
    """Verify final_processed_income = foir_based_income - existing_emi."""
    # For Shashank Rai (average_income = 448,922.50, Self-Employed, BOB):
    # BOB FOIR = 60% -> foir_based_income = 448,922.50 * 0.6 = 269,353.50
    # existing_emi = 15,000 -> final_processed_income = 269,353.50 - 15,000 = 254,353.50
    res = foir_service.calculate_phase2_foir(
        average_income=448_922.50,
        occupation="Self-Employed",
        existing_emi=15_000.0,
    )

    bob_res = res.bank_foir_results["BOB"]
    assert bob_res.foir_percentage == 0.60
    assert bob_res.base_income == 448_922.50
    assert bob_res.foir_based_income == 269_353.50
    assert bob_res.existing_emi == 15_000.0
    assert bob_res.final_processed_income == 254_353.50


def test_phase2_api_endpoint():
    """Verify POST /api/v1/onboarding/income/phase2-foir endpoint."""
    payload = {
        "average_income": 600_000.0,
        "occupation": "Salaried",
        "existing_emi": 10_000.0,
    }

    resp = client.post(
        "/api/v1/onboarding/income/phase2-foir",
        json=payload,
        headers={"X-Tenant-ID": "tenant_alpha"},
    )
    assert resp.status_code == 200
    data = resp.json()

    assert data["average_income"] == 600_000.0
    assert data["average_monthly_income"] == 50_000.0
    assert data["occupation"] == "Salaried"
    assert data["existing_emi"] == 10_000.0

    # For Salaried at 50,000/mo, BOB gives 60% FOIR -> 50,000 * 0.60 = 30,000
    # final_processed_income = 30,000 - 10,000 = 20,000
    bob = data["bank_foir_results"]["BOB"]
    assert bob["base_income"] == 50_000.0
    assert bob["foir_percentage"] == 0.60
    assert bob["foir_based_income"] == 30_000.0
    assert bob["final_processed_income"] == 20_000.0

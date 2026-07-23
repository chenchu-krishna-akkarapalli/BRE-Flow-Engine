"""
FlowBRE Backend Blueprints Unit Test Suite (test_blueprints.py)
--------------------------------------------------------------
Unit tests verifying bureau parsing, rule engine evaluation,
and onboarding polymorphic request validation.
"""

from pathlib import Path

from bureau_parser import BureauParserService
from bre_engine import RuleEngineRegistry, AssessmentEngine
from onboarding import IndividualPayload, CompanyPayload, HUFPayload, OnboardingEvaluationRequest

# 1. BUREAU PARSER UNIT TESTS
def test_bureau_parser_std_conversion():
    raw_payload = {
        "cibil_score": 750,
        "accounts": [
            {
                "account_number_masked": "XXXX1234",
                "account_type": "Personal Loan",
                "write_off_amount": 0,
                "currently_overdue": False,
                "dpd_history": ["STD", 0, "STD", 30, "STD"]
            }
        ]
    }
    result = BureauParserService.parse_bureau_payload(
        raw_payload, applicant_pan="ABCDE1234F", applicant_dob="1990-01-01"
    )
    assert result.cibil_score == 750
    assert result.dpd_history == [0, 0, 0, 30, 0]
    assert result.write_off_amount == 0.0
    assert result.currently_overdue is False

def test_bureau_parser_pii_masking():
    from bureau_parser import mask_pan, mask_dob
    assert mask_pan("ABCDE1234F") == "AB******4F"
    assert mask_dob("1995-06-15") == "****-**-15"


# 2. ASSESSMENT ENGINE UNIT TESTS
def test_bre_engine_bank_matrix():
    rules_dir = Path(__file__).parent.parent.parent.parent
    registry = RuleEngineRegistry(rules_dir)
    engine = AssessmentEngine(registry)

    # Test profile eligible for BOI (min 701) but ineligible for Indian Bank (min 730 & 0 DPD)
    profile = {
        "bureauCibilScore": 710,
        "bureauDpd": 0,
        "bureauDpdList": [0, 0],
        "bureauWriteOffAmount": 0.0,
        "bureauCurrentlyOverdue": False
    }
    
    boi_res = engine.evaluate_bank_policy(profile, "BOI", registry.bank_matrix["BOI"])
    assert boi_res["eligible"] is True

    indian_bank_res = engine.evaluate_bank_policy(profile, "INDIAN_BANK", registry.bank_matrix["INDIAN_BANK"])
    assert indian_bank_res["eligible"] is False
    assert any(r["rule_id"] == "BUR-405" for r in indian_bank_res["rejections"])


# 3. POLYMORPHIC DISCRIMINATED UNIONS UNIT TESTS
def test_polymorphic_individual_request():
    individual_data = {
        "selectedBank": "HDFC",
        "pincode": "560001",
        "cityName": "Bengaluru",
        "stateName": "Karnataka",
        "residenceStatus": "Owned House",
        "bureauCibilScore": 760,
        "payload": {
            "entityType": "Individual",
            "applicantName": "Aarav Sharma",
            "dob": "1994-06-15",
            "gender": "MALE",
            "pan": "ABCDE1234F",
            "maritalStatus": "MARRIED",
            "citizenshipStatus": "RESIDENT_INDIAN",
            "phone": "9876543210",
            "email": "aarav@example.com",
            "occupation": "Salaried"
        }
    }
    req = OnboardingEvaluationRequest(**individual_data)
    assert req.payload.entityType == "Individual"
    assert req.payload.applicantName == "Aarav Sharma"

if __name__ == "__main__":
    test_bureau_parser_std_conversion()
    print("test_bureau_parser_std_conversion: PASS")
    test_bureau_parser_pii_masking()
    print("test_bureau_parser_pii_masking: PASS")
    test_bre_engine_bank_matrix()
    print("test_bre_engine_bank_matrix: PASS")
    test_polymorphic_individual_request()
    print("test_polymorphic_individual_request: PASS")
    print("\nALL 4 BLUEPRINT UNIT TESTS PASSED 100%!")

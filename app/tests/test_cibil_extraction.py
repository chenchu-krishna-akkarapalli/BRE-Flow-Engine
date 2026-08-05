"""Delivery-schema translation and upload guards for the CIBIL PDF engine.

The subprocess itself is exercised end-to-end only where the Rust binary is
built; the mapping below is pure and always runs, because it is the layer that
decides what the applicant's bureau history is said to be.
"""

import pytest

from app.core.exceptions import InvalidPayloadError
from app.constants import MAX_UPLOAD_BYTES
from app.services.cibil_service import (
    DPD_RECENT_YEARS,
    _amount,
    _dpd_days,
    _pl_score,
    _worst_dpd,
    map_to_bureau_fields,
    validate_upload,
)

# Shape of one `--schema target --pipeline` payload, trimmed to the mapped keys.
CLEAN = {
    "CIBIL_Score": 803,
    "CIBIL_PL_Score": "Not Available (only Credit Score)",
    "Currently_Outstanding": {"Total_Overdue": 0, "Total_Current_Balance": 511501},
    "DPD": {"Account_1_Personal_Loan": {"2026": {"JAN": 0, "FEB": "STD"}, "status": "ACTIVE"}},
    "Loan_Enquiry": {"Past_30_Days": 0, "Past_12_Months": 2, "Total_Enquiries": 2},
    "Write_Off_Amount": {"Total": "NIL", "Principal": "NIL"},
    "Write_Off_Details": {k: "NIL" for k in (
        "PL_Write_Off", "Home_Loan_Write_Off", "Consumer_Loan_Write_Off",
        "Agri_Loan_Write_Off", "MSME_Loan_Write_Off", "Auto_Loan_Write_Off",
        "Credit_Card_Write_Off",
    )},
}


def _with(**over):
    return {**CLEAN, **over}


# --- Cell coercion --------------------------------------------------------- #


@pytest.mark.parametrize("cell,days", [
    ("STD", 0), ("XXX", 0), ("SMA", 0), ("*", 0), ("-", 0), ("", 0), (None, 0),
    (0, 0), ("0", 0), (58, 58), ("516", 516), ("900", 900),
])
def test_dpd_cell_coercion(cell, days) -> None:
    """STD/XXX mean "reported, nothing overdue" — not an unparseable number."""
    assert _dpd_days(cell) == days


@pytest.mark.parametrize("raw,value", [
    ("NIL", 0.0), ("None", 0.0), ("", 0.0), (None, 0.0),
    ("205347", 205347.0), ("1,25,000", 125000.0), (39867, 39867.0),
])
def test_amount_sentinels(raw, value) -> None:
    assert _amount(raw) == value


@pytest.mark.parametrize("raw,score", [
    (839, 839), ("806", 806), ("-1", None), (-1, None),
    ("Not Available (only Credit Score)", None), (None, None), (299, None), (901, None),
])
def test_pl_score_rejects_sentinels(raw, score) -> None:
    """-1 and the prose sentinel are absences, not scores to pre-fill."""
    assert _pl_score(raw) == score


# --- DPD recency window ---------------------------------------------------- #


def test_cured_old_default_does_not_score_as_current_dpd() -> None:
    """A 2018 default on a bureau reporting through 2026 is history, not delinquency.

    Scoring lifetime-worst would reject an applicant whose bureau is clean today
    (the 803-score report in the sample set carries a cured 516-day default).
    """
    dpd = {
        "Account_1_Education_Loan": {"2017": {"AUG": 151}, "2018": {"AUG": 516}},
        "Account_2_Personal_Loan": {"2025": {"JAN": 0}, "2026": {"JAN": 0}},
    }
    recent, lifetime, missed, severe = _worst_dpd(dpd)

    assert recent == 0, "a cured 2018 default is not current delinquency"
    assert lifetime == 516, "and it is still disclosed, not dropped"
    # The wizard maps a 90+ answer back to a 90-day DPD, so lifetime-based flags
    # would reimpose exactly the default the window excludes.
    assert missed is False and severe is False


def test_window_is_report_relative_not_account_relative() -> None:
    """Per-account recency readmits the history the window exists to exclude.

    An account whose last report was 2018 has 2018 among ITS two most recent
    years; only the report's own latest year gives a meaningful cutoff.
    """
    latest = 2026
    stale = str(latest - 5)
    dpd = {
        "Account_1": {stale: {"JAN": 400}},
        "Account_2": {str(latest): {"JAN": 12}},
    }
    recent, lifetime, _, _ = _worst_dpd(dpd)

    assert recent == 12 and lifetime == 400


def test_recent_window_spans_the_configured_years() -> None:
    latest = 2026
    inside, outside = str(latest - DPD_RECENT_YEARS + 1), str(latest - DPD_RECENT_YEARS)
    dpd = {"A": {str(latest): {"JAN": 0}, inside: {"JAN": 30}, outside: {"JAN": 700}}}

    recent, lifetime, _, _ = _worst_dpd(dpd)
    assert recent == 30 and lifetime == 700


def test_no_reported_history_is_not_a_missed_payment() -> None:
    assert _worst_dpd({}) == (0, 0, False, False)


# --- Field mapping --------------------------------------------------------- #


def test_clean_report_maps_to_clean_bureau_fields() -> None:
    fields = map_to_bureau_fields(CLEAN)

    assert fields["bureauCibilScore"] == 803
    assert fields["bureauDpd"] == 0 and fields["hasMissedPayment"] is False
    assert fields["bureauLoanEnquiry"] is False and fields["enquiriesLast12Months"] == 2
    assert fields["bureauCurrentlyOutstanding"] == 0.0
    assert fields["bureauWriteOffAmount"] == 0.0
    assert not any(v for k, v in fields.items() if k.startswith("bureauFlag"))


def test_write_off_classes_map_onto_their_own_flags() -> None:
    """Each engine class drives exactly its own flag — a mis-wire would score
    the applicant against the wrong bank column."""
    for key, flag in (("PL_Write_Off", "bureauFlagPL"),
                      ("Home_Loan_Write_Off", "bureauFlagHome"),
                      ("Consumer_Loan_Write_Off", "bureauFlagConsumer"),
                      ("Agri_Loan_Write_Off", "bureauFlagAgri"),
                      ("MSME_Loan_Write_Off", "bureauFlagMSME"),
                      ("Auto_Loan_Write_Off", "bureauFlagAuto"),
                      ("Credit_Card_Write_Off", "bureauFlagCC")):
        details = {**CLEAN["Write_Off_Details"], key: "50000"}
        fields = map_to_bureau_fields(_with(Write_Off_Details=details))

        raised = {k for k, v in fields.items() if k.startswith("bureauFlag") and v}
        assert raised == {flag}, f"{key} raised {raised}"


def test_credit_card_amount_wins_the_single_amount_field() -> None:
    """The matrix caps the CC write-off specifically, so that figure is the one
    the wizard's single amount field has to carry."""
    details = {**CLEAN["Write_Off_Details"], "Credit_Card_Write_Off": "56904",
               "PL_Write_Off": "154900"}
    fields = map_to_bureau_fields(
        _with(Write_Off_Details=details, Write_Off_Amount={"Total": "211804"})
    )

    assert fields["bureauWriteOffAmount"] == 56904.0
    assert fields["bureauFlagCC"] is True and fields["bureauFlagPL"] is True


def test_total_write_off_is_used_when_no_credit_card_class() -> None:
    details = {**CLEAN["Write_Off_Details"], "Auto_Loan_Write_Off": "39867"}
    fields = map_to_bureau_fields(_with(Write_Off_Details=details,
                                        Write_Off_Amount={"Total": "39867"}))

    assert fields["bureauWriteOffAmount"] == 39867.0


def test_recent_enquiry_sets_the_wizard_toggle() -> None:
    fields = map_to_bureau_fields(_with(Loan_Enquiry={"Past_30_Days": 4, "Past_12_Months": 9}))

    assert fields["bureauLoanEnquiry"] is True
    assert fields["enquiriesLast30Days"] == 4 and fields["enquiriesLast12Months"] == 9


def test_pl_score_toggle_tracks_availability() -> None:
    assert map_to_bureau_fields(CLEAN)["cibilPlScoreToggle"] is False
    available = map_to_bureau_fields(_with(CIBIL_PL_Score="839"))
    assert available["cibilPlScoreToggle"] is True and available["bureauCibilPlScore"] == 839


def test_mapping_covers_every_delivery_key_it_claims() -> None:
    """A renamed engine key must fail loudly, not silently map to a clean zero."""
    fields = map_to_bureau_fields(_with(
        CIBIL_Score=690,
        Currently_Outstanding={"Total_Overdue": 16483, "Total_Current_Balance": 90000},
        Write_Off_Details={**CLEAN["Write_Off_Details"], "Credit_Card_Write_Off": "56904"},
    ))
    assert fields["bureauCibilScore"] == 690
    assert fields["bureauCurrentlyOutstanding"] == 16483.0
    assert fields["totalCurrentBalance"] == 90000.0
    assert fields["bureauFlagCC"] is True


# --- Upload guards --------------------------------------------------------- #


def test_upload_must_be_a_pdf() -> None:
    with pytest.raises(InvalidPayloadError, match="upload the CIBIL report as a PDF"):
        validate_upload(b"%PDF-1.4", "image/png", "report.png")


def test_declared_type_check_does_not_judge_the_bytes() -> None:
    """Emptiness, size and the %PDF- signature belong to the firewall, which
    reads the bytes rather than what the client claims about them."""
    validate_upload(b"", "application/pdf", "report.pdf")
    validate_upload(b"x" * (MAX_UPLOAD_BYTES + 1), "application/pdf", "report.pdf")


def test_flags_and_dpd_agree_on_the_same_window() -> None:
    """dpdDaysFor() rebuilds a day count from the two flags, so a report that
    sets them from different windows contradicts its own bureauDpd."""
    dpd = {
        "Old": {"2018": {"AUG": 516}},
        "New": {"2025": {"JAN": 0}, "2026": {"JAN": 0}},
    }
    fields = map_to_bureau_fields(_with(DPD=dpd))

    assert fields["bureauDpd"] == 0
    assert fields["hasMissedPayment"] is False and fields["missedOver90"] is False
    assert fields["worstEverDpd"] == 516, "the older default is still disclosed"


def test_recent_severe_default_raises_both_flags() -> None:
    fields = map_to_bureau_fields(_with(DPD={"A": {"2026": {"JAN": 120}}}))

    assert fields["bureauDpd"] == 120
    assert fields["hasMissedPayment"] is True and fields["missedOver90"] is True

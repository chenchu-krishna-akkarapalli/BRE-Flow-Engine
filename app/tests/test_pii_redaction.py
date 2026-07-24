from app.core.logging import redact_dob, redact_pan, redact_pii


def test_pan_redaction():
    pan = "ABCDE1234F"
    masked = redact_pan(pan)
    assert masked == "AB******4F"
    assert "CDE123" not in masked


def test_dob_redaction():
    dob = "1995-05-15"
    masked = redact_dob(dob)
    assert masked == "****-**-15"
    assert "1995" not in masked


def test_pii_dictionary_redaction():
    payload = {
        "applicant_name": "John Doe",
        "pan": "ABCDE1234F",
        "dob": "1990-01-15",
        "credit_bureau": {
            "cibil_score": 750,
            "pan": "XYZAB9876Q",
        },
    }
    redacted = redact_pii(payload)
    assert redacted["pan"] == "AB******4F"
    assert redacted["dob"] == "****-**-15"
    assert redacted["credit_bureau"]["pan"] == "XY******6Q"
    assert redacted["applicant_name"] == "John Doe"

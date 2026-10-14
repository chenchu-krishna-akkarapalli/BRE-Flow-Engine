"""Model-first payslip reading: rows, column split, grounding, gate, retry, service."""

import io
import json
from pathlib import Path

import httpx
import pypdfium2 as pdfium
import pytest

from app.services import payslip_gate, payslip_llm, payslip_reader, payslip_service
from app.services.payslip_llm import build_statement, find_source_line, grounded_identity
from app.services.payslip_reader import Glyph, Row, group_rows, split_side_by_side

LINES = [
    "ACME LTD | Salary slip for April 2025",
    "Employee Name | Ravi Kumar | PAN | ABCDE1234F",
    "Bank A/c No | 123456789012 | UAN | 100200300400",
    "Basic | 30,000.00 | Provident Fund | 1,800.00",
    "HRA | 20,000.00 | Professional Tax | 200.00",
    "Gross Earnings | 50,000.00 | Total Deductions | 2,000.00",
    "Net Pay | 48,000.00",
]
PAGES = [1] * len(LINES)
GOOD = {
    "month": "April", "year": 2025,
    "employee_name": "Ravi Kumar", "employer_name": "ACME LTD",
    "pan": "ABCDE1234F", "uan": "100200300400", "bank_account": "123456789012",
    "earnings": [{"label": "Basic", "value": 30000}, {"label": "HRA", "value": 20000}],
    "deductions": [{"label": "Provident Fund", "value": 1800}, {"label": "Professional Tax", "value": 200}],
    "gross_salary": 50000, "total_deductions": 2000, "net_pay": 48000,
}
ROWS = [Row(1, line.split(" | ")) for line in LINES]


def _glyph(text, x0, y0, page=1, h=10.0, w=None):
    return Glyph(text, x0, y0, x0 + (w or 6.0 * len(text)), y0 + h, page)


# --- reader ---------------------------------------------------------------

def test_rows_join_label_and_value_offset_by_cell_alignment():
    # Label bottom-aligned, value top-aligned in one cell: 5pt apart, one row.
    rows = group_rows([_glyph("Total", 17, 257), _glyph("306,300.00", 218, 252)])
    assert [r.cells for r in rows] == [["Total", "306,300.00"]]


def test_rows_split_cells_at_column_gaps_and_baseline_shifts():
    rows = group_rows([
        _glyph("Basic", 0, 100, w=30), _glyph("Pay", 33, 100, w=18),    # word gap: same cell
        _glyph("71,900.00", 200, 100),                                    # column gap: new cell
        _glyph("Amount", 300, 100, w=36), _glyph("Deductions", 340, 104),  # baseline shift: new cell
    ])
    assert rows[0].cells == ["Basic Pay", "71,900.00", "Amount", "Deductions"]


def test_side_by_side_table_becomes_two_blocks_with_shared_total_label():
    rows = [
        Row(1, ["Earnings", "Amount", "Deductions", "Amount"], [17, 233, 272, 516]),
        Row(1, ["Basic", "71,900.00", "Ee PF contribution", "1,800.00"], [17, 224, 272, 512]),
        Row(1, ["Total", "71,900.00", "1,800.00"], [17, 218, 507]),
        Row(1, ["Net Pay", "70,100.00"], [17, 218]),
    ]
    assert [r.text() for r in split_side_by_side(rows)] == [
        "Earnings | Amount", "Basic | 71,900.00", "Total | 71,900.00",
        "Deductions | Amount", "Ee PF contribution | 1,800.00", "Total | 1,800.00",
        "Net Pay | 70,100.00",
    ]


def test_summary_row_and_gross_up_line_do_not_drive_the_split():
    rows = [
        Row(1, ["Bank", "Earnings", "Deductions", "Net"], [0, 200, 300, 400]),
        Row(1, ["Basic", "100.00"], [0, 200]),
    ]
    assert split_side_by_side(rows) == rows
    table = [
        Row(1, ["Earnings", "Deductions"], [0, 300]),
        Row(1, ["Gross up on Non-Cash", "0.00", "PF", "10.00"], [0, 200, 300, 400]),
        Row(1, ["Total Earnings", "5.00", "Total Deductions", "10.00"], [0, 200, 300, 400]),
    ]
    texts = [r.text() for r in split_side_by_side(table)]
    assert texts.index("Gross up on Non-Cash | 0.00") < texts.index("Total Earnings | 5.00") < texts.index("Deductions")


SAMPLES = Path(__file__).resolve().parents[2] / "cibil-pdf-scrapper" / "payslip-test"


@pytest.mark.skipif(not (SAMPLES / "Pay Slip_Z33287_Feb-26.pdf").exists(), reason="sample corpus not present")
def test_text_layer_pdf_reads_into_rows():
    text = payslip_reader.read_pdf((SAMPLES / "Pay Slip_Z33287_Feb-26.pdf").read_bytes())
    lines = [r.text() for r in text.rows]
    assert text.source == "pdf_text"
    assert "Total Earnings | 131,476.00 | 1,300,056.00" in lines
    assert "Total Deductions | 10,935.00 | 97,487.00" in lines


@pytest.mark.skipif(
    not payslip_reader.ocr_available() or not (SAMPLES / "Salary slip for the month of  July 2025-2.pdf").exists(),
    reason="needs Tesseract and the sample corpus",
)
def test_scanned_pdf_is_read_with_ocr():
    text = payslip_reader.read_pdf((SAMPLES / "Salary slip for the month of  July 2025-2.pdf").read_bytes())
    lines = [r.text() for r in text.rows]
    assert text.source == "ocr"
    assert any("BASIC PAY: 42300.00" in line for line in lines)


# --- gate -----------------------------------------------------------------

def _stmt(gross, ded, net, earn, deds, method="llm_extracted"):
    amt = lambda v, m=method: None if v is None else {"value": v, "match_method": m}
    item = lambda label, v: {"raw_label": label, "amount": {"value": v}}
    return {
        "period": {"month": "April", "year": 2025},
        "earnings": {"items": [item(l, v) for l, v in earn]},
        "deductions": {"items": [item(l, v) for l, v in deds]},
        "summary": {"gross_salary": amt(gross), "total_deductions": amt(ded), "net_pay": amt(net)},
    }


def test_gate_accepts_a_balanced_payslip():
    r = payslip_gate.evaluate(_stmt(50000, 2000, 48000, [("Basic", 30000), ("HRA", 20000)], [("PF", 1800), ("PT", 200)]))
    assert (r.failures, r.status, r.confidence) == ([], "auto_accept", 1.0)


def test_gate_rejects_unbalanced_totals():
    r = payslip_gate.evaluate(_stmt(50000, 200, 48000, [("Basic", 50000)], [("PT", 200)]))
    assert "gross_minus_deductions_does_not_equal_net" in r.failures


def test_gate_does_not_read_a_missing_deduction_total_as_zero():
    r = payslip_gate.evaluate(_stmt(27200, None, 27200, [("Basic", 27200)], []))
    assert r.failures == ["total_deductions_missing"]


def test_gate_allows_grade_pay_outside_gross_only_when_exact():
    earn = [("BASIC PAY", 42300), ("GRADE PAY", 4200), ("DA", 23265), ("HRA", 1340)]
    assert payslip_gate.evaluate(_stmt(66905, 0, 66905, earn, [])).failures == []
    earn[1] = ("SPECIAL PAY", 4200)
    assert payslip_gate.evaluate(_stmt(66905, 0, 66905, earn, [])).failures == ["earning_items_do_not_sum_to_gross"]


# --- grounding ------------------------------------------------------------

def test_grounded_answer_has_no_failures():
    statement, failures = build_statement(GOOD, LINES, PAGES)
    assert failures == []
    assert statement["summary"]["net_pay"]["value"] == 48000
    assert payslip_gate.evaluate(statement).failures == []


def test_amount_not_printed_is_dropped():
    statement, failures = build_statement(dict(GOOD, net_pay=49000), LINES, PAGES)
    assert statement["summary"]["net_pay"] is None
    assert failures == ["llm_ungrounded_net_pay"]


def test_item_amount_must_sit_beside_its_label():
    _, failures = build_statement(dict(GOOD, earnings=[{"label": "Basic", "value": 1800}]), LINES, PAGES)
    assert failures == ["llm_ungrounded_earnings_item"]


def test_sign_must_match_the_printed_amount():
    lines = ["INCOME TAX | 9,135.00 | Taxes at broker | (66,850.00)", "Earnings 79,010.00 - 12,357.00"]
    assert find_source_line(-9135, "INCOME TAX", lines) is None
    assert find_source_line(9135, "INCOME TAX", lines) == 0
    assert find_source_line(-66850, "Taxes at broker", lines) == 0
    assert find_source_line(-12357, "", lines) is None  # a spaced minus is subtraction


def test_totals_rows_zero_items_and_employer_contributions_are_not_components():
    answer = dict(GOOD, earnings=GOOD["earnings"] + [
        {"label": "Gross Earnings", "value": 50000},
        {"label": "NPS EMPLOYER CONTRIBUTION", "value": 200},
        {"label": "Other Deduction 1", "value": 0},
    ])
    statement, failures = build_statement(answer, LINES, PAGES)
    assert failures == []
    assert [i["raw_label"] for i in statement["earnings"]["items"]] == ["Basic", "HRA"]


def test_net_is_derived_only_when_not_printed():
    lines = [l for l in LINES if not l.startswith("Net Pay")]
    statement, failures = build_statement(dict(GOOD, net_pay=None), lines, PAGES[:-1])
    assert failures == []
    assert statement["summary"]["net_pay"]["match_method"] == "computed_from_gross_minus_deductions"
    assert statement["summary"]["net_pay"]["value"] == 48000


def test_identity_must_be_printed_and_pan_well_formed():
    identity = grounded_identity(dict(GOOD, employee_name="Somebody Else", pan="ABCDE1234"), LINES)
    assert identity["employee_name"] is None
    assert identity["pan"] is None
    assert identity["bank_account"] == "123456789012"


def test_period_accepts_a_numeric_pay_period():
    lines = ["Pay period : 01.04.2024 - 30.04.2024"]
    statement, _ = build_statement({"month": "April", "year": 2024}, lines, [1])
    assert (statement["period"]["month"], statement["period"]["year"]) == ("April", 2024)
    statement, _ = build_statement({"month": "May", "year": 2024}, lines, [1])
    assert statement["period"]["month"] is None


# --- model call and retry -------------------------------------------------

def _model(monkeypatch, answers):
    calls = []

    async def fake_ask(prompt, doc_id, repair):
        calls.append(repair)
        return answers[min(len(calls), len(answers)) - 1]

    monkeypatch.setattr(payslip_llm, "_ask", fake_ask)
    return calls


@pytest.mark.asyncio
async def test_verified_on_first_answer(monkeypatch):
    calls = _model(monkeypatch, [GOOD])
    result = await payslip_llm.extract(ROWS, "t.pdf")
    assert (result.status, result.attempts, len(calls)) == ("auto_accept", 1, 1)
    assert result.identity["pan"] == "ABCDE1234F"


@pytest.mark.asyncio
async def test_failed_answer_is_retried_once_with_the_difference(monkeypatch):
    missed = dict(GOOD, deductions=[GOOD["deductions"][0]])
    calls = _model(monkeypatch, [missed, GOOD])
    result = await payslip_llm.extract(ROWS, "t.pdf")
    assert (result.status, result.attempts) == ("auto_accept", 2)
    previous, feedback = calls[1]
    assert previous == missed
    assert "deductions add up to 1,800.00" in feedback and "difference of 200.00" in feedback


@pytest.mark.asyncio
async def test_still_failing_answer_is_returned_for_review_never_verified(monkeypatch):
    missed = dict(GOOD, deductions=[GOOD["deductions"][0]])
    _model(monkeypatch, [missed, missed])
    result = await payslip_llm.extract(ROWS, "t.pdf")
    assert result.status == "needs_review"
    assert "deduction_items_do_not_sum_to_total" in result.reasons


def _ollama(monkeypatch, handler):
    monkeypatch.setattr(payslip_llm, "_transport", httpx.MockTransport(handler))


@pytest.mark.asyncio
async def test_model_request_is_schema_constrained_and_deterministic(monkeypatch):
    seen = {}

    def handler(request):
        seen.update(json.loads(request.content))
        return httpx.Response(200, json={"message": {"content": json.dumps(GOOD)}, "done_reason": "stop"})

    _ollama(monkeypatch, handler)
    result = await payslip_llm.extract(ROWS, "t.pdf")
    assert result.status == "auto_accept"
    assert "pan" in seen["format"]["required"]
    assert (seen["options"]["temperature"], seen["stream"], seen["keep_alive"]) == (0, False, "30m")
    assert "Basic | 30,000.00" in seen["messages"][1]["content"]


@pytest.mark.asyncio
async def test_truncated_model_output_yields_nothing(monkeypatch):
    _ollama(monkeypatch, lambda r: httpx.Response(200, json={"message": {"content": "{"}, "done_reason": "length"}))
    assert await payslip_llm.extract(ROWS, "t.pdf") is None


@pytest.mark.asyncio
async def test_unreachable_model_is_reported_not_hidden(monkeypatch):
    def handler(request):
        raise httpx.ConnectError("connection refused", request=request)

    _ollama(monkeypatch, handler)
    with pytest.raises(payslip_llm.ModelUnavailable):
        await payslip_llm.extract(ROWS, "t.pdf")


# --- service --------------------------------------------------------------

def _blank_pdf() -> bytes:
    # A real one-page PDF passes the upload firewall; the reader is stubbed, so
    # its (empty) content does not matter.
    doc = pdfium.PdfDocument.new()
    doc.new_page(595, 842)
    buffer = io.BytesIO()
    doc.save(buffer)
    return buffer.getvalue()


MINIMAL_PDF = _blank_pdf()


def _pdf_with_rows(monkeypatch, rows=ROWS):
    text = payslip_reader.PdfText(rows, 1, "pdf_text", [])
    monkeypatch.setattr(payslip_reader, "read_pdf", lambda data: text)


@pytest.mark.asyncio
async def test_service_returns_verified_fields(monkeypatch):
    _pdf_with_rows(monkeypatch)
    _model(monkeypatch, [GOOD])
    fields, status, message = await payslip_service.extract_payslip_report(MINIMAL_PDF, "application/pdf", "t.pdf")
    assert (status, fields["reviewRequired"], fields["extractionSource"]) == ("SUCCESS", False, "local_model")
    assert (fields["grossSalary"], fields["netSalary"]) == (50000, 48000)
    assert (fields["applicantName"], fields["panNumber"], fields["salaryPaymentMethod"]) == ("Ravi Kumar", "ABCDE1234F", "Bank Account")


@pytest.mark.asyncio
async def test_service_returns_unverified_figures_flagged_for_review(monkeypatch):
    _pdf_with_rows(monkeypatch)
    missed = dict(GOOD, deductions=[GOOD["deductions"][0]])
    _model(monkeypatch, [missed, missed])
    fields, status, message = await payslip_service.extract_payslip_report(MINIMAL_PDF, "application/pdf", "t.pdf")
    assert (status, fields["reviewRequired"]) == ("SUCCESS", True)
    assert "deduction_items_do_not_sum_to_total" in fields["reviewReasons"]
    assert "check the figures" in message


@pytest.mark.asyncio
async def test_service_reports_an_unavailable_model_as_engine_error(monkeypatch):
    _pdf_with_rows(monkeypatch)

    async def down(prompt, doc_id, repair):
        raise payslip_llm.ModelUnavailable("unreachable")

    monkeypatch.setattr(payslip_llm, "_ask", down)
    with pytest.raises(payslip_service.PayslipEngineError):
        await payslip_service.extract_payslip_report(MINIMAL_PDF, "application/pdf", "t.pdf")

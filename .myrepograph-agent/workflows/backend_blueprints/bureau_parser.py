"""
FlowBRE Bureau Report Parser Service (bureau_parser.py)
-------------------------------------------------------
High-performance parser for CIBIL bureau JSON payloads.
Converts 'STD' string representations to 0 DPD, extracts write-off amounts,
overdue balances, and enforces PII data masking for logging.

Latency Target: < 5 ms
Memory Lifecycle: Allocated transiently per request, cleaned by GC.
"""

import re
import time
import logging
from typing import List, Dict, Any, Union
from pydantic import BaseModel, Field, field_validator

logger = logging.getLogger("flowbre.bureau_parser")

# ==============================================================================
# PII REDACTION HELPERS
# ==============================================================================
def mask_pan(pan: str) -> str:
    if not pan or len(pan) != 10:
        return "****"
    return f"{pan[:2]}******{pan[-2:]}"

def mask_dob(dob: str) -> str:
    if not dob:
        return "**/**/****"
    parts = dob.split("-")
    if len(parts) == 3:
        return f"****-**-{parts[2]}"
    return "****-**-**"

# ==============================================================================
# SCHEMAS
# ==============================================================================
class BureauAccount(BaseModel):
    account_number_masked: str
    account_type: str
    write_off_amount: float = 0.0
    currently_overdue: bool = False
    dpd_history: List[Union[int, str]] = Field(default_factory=list)

class BureauParseResult(BaseModel):
    cibil_score: int
    cibil_pl_score: int
    write_off_amount: float
    currently_overdue: bool
    dpd_history: List[int]
    loan_enquiry_count_last_6m: int

# ==============================================================================
# BUREAU PARSER ENGINE
# ==============================================================================
class BureauParserService:
    @staticmethod
    def parse_bureau_payload(raw_payload: Dict[str, Any], applicant_pan: str = "", applicant_dob: str = "") -> BureauParseResult:
        """
        Parses raw bureau payload in < 5 ms.
        Converts 'STD' -> 0 DPD, sums write-offs, and logs masked PII.
        """
        start_time = time.perf_counter()
        
        # PII Masked Log Entry
        masked_pan = mask_pan(applicant_pan)
        masked_dob = mask_dob(applicant_dob)
        logger.info(f"Parsing bureau payload for PAN: {masked_pan}, DOB: {masked_dob}")

        cibil_score = raw_payload.get("cibil_score", 300)
        cibil_pl_score = raw_payload.get("cibil_pl_score", cibil_score)
        enquiry_count = raw_payload.get("loan_enquiry_count_last_6m", 0)

        accounts = raw_payload.get("accounts", [])
        total_write_off = 0.0
        is_overdue = False
        normalized_dpd: List[int] = []

        for acc in accounts:
            # Sum write-off amounts
            total_write_off += float(acc.get("write_off_amount", 0.0))
            if acc.get("currently_overdue", False):
                is_overdue = True

            # Standardize DPD history string/int list
            raw_dpd_list = acc.get("dpd_history", [])
            for entry in raw_dpd_list:
                if str(entry).upper() == "STD":
                    normalized_dpd.append(0)
                elif isinstance(entry, (int, float)):
                    normalized_dpd.append(int(entry))
                elif str(entry).isdigit():
                    normalized_dpd.append(int(entry))
                else:
                    normalized_dpd.append(0)

        elapsed_ms = (time.perf_counter() - start_time) * 1000
        if elapsed_ms > 5.0:
            logger.warning(f"Bureau parsing SLA warning: took {elapsed_ms:.2f} ms (Target < 5 ms)")

        return BureauParseResult(
            cibil_score=cibil_score,
            cibil_pl_score=cibil_pl_score,
            write_off_amount=total_write_off,
            currently_overdue=is_overdue,
            dpd_history=normalized_dpd,
            loan_enquiry_count_last_6m=enquiry_count
        )

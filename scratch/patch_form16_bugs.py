import pathlib

p = pathlib.Path("app/services/bre_engine.py")
t = p.read_text(encoding="utf-8")

# --- col 21 "Resi-Office-Separate-Both Rented": per-bank permission ---------
COL21 = {"BOI": False, "INDIAN_BANK": False, "IOB": False, "BOB": True,
         "BOM": False, "HDFC": True, "AXIS": True, "KOTAK": True}
for bank, allowed in COL21.items():
    i = t.index(f'"{bank}": {{')
    j = t.index("    },", i)
    t = t[:i] + t[i:j] + f'        "allow_separate_both_rented": {allowed},\n' + t[j:]

# --- Form 16: rule id EMP-SAL-206 (col 55) ---------------------------------
t = t.replace('check("EMP-SAL-208", "Form-16 History"', 'check("EMP-SAL-206", "Form-16 History"')

# --- Loan enquiry is a yes/no fact, not a count ----------------------------
t = t.replace('''    check("BUR-406", "Loan Enquiries", "Credit Bureau History",
          inp["loan_enquiry_count"] == 0 or policy["allow_loan_enquiry"],
          inp["loan_enquiry_count"], "0" if not policy["allow_loan_enquiry"] else "any",
          f"{code} does not accept applicants with open loan enquiries "
          f"({inp['loan_enquiry_count']} on file).")''',
'''    # An applicant with no enquiries always passes; one with enquiries is
    # judged against the bank's col-12 permission.
    check("BUR-406", "Loan Enquiries", "Credit Bureau History",
          (not inp["has_loan_enquiry"]) or policy["allow_loan_enquiry"],
          "Yes" if inp["has_loan_enquiry"] else "No",
          "Any" if policy["allow_loan_enquiry"] else "No",
          f"{code} does not accept applicants with active loan enquiries on the bureau record.")''')

t = t.replace('''            "loan_enquiry_count": payload.get("loan_enquiry_count", 0),''',
'''            # Yes/no on the wizard; the flat contract still carries a count.
            "has_loan_enquiry": bool(
                payload.get("has_loan_enquiry", payload.get("loan_enquiry_count", 0) > 0)
            ),''')

# --- REL-502: separate premises, both rented (col 21) ----------------------
t = t.replace('''    # --- Co-applicant eligibility (matrix cols 56-61) ------------------------''',
'''    # --- Separate office premises, both rented (col 21) ---------------------
    # Distinct from the guarantor question (cols 22/23), which governs an office
    # run out of a rented residence. This one asks whether the bank lends at all
    # when residence and a SEPARATELY addressed office are both rented.
    if inp["property_status"] == "SEPARATE_BOTH_RENTED" and "allow_separate_both_rented" in policy:
        check("REL-502", "Separate Premises Both Rented", "Residence & Guarantor",
              policy["allow_separate_both_rented"],
              "Residence + separate office both rented",
              policy["allow_separate_both_rented"],
              f"{code} does not lend where the residence and a separately addressed "
              "office are both rented.")

    # --- Co-applicant eligibility (matrix cols 56-61) ------------------------''')

p.write_text(t, encoding="utf-8")
print("engine: EMP-SAL-206, boolean loan enquiry, REL-502 + col21 key")

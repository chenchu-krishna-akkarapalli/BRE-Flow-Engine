---
name: trail-of-bits-security
description: Tool-backed security auditing using Semgrep, CodeQL, and variant analysis tailored for FastAPI endpoints, PII redaction (PAN, Aadhaar), SQL injection prevention, and Zen-Engine input parsing safety.
---

# Trail of Bits Security (FlowBRE Backend & API Edition)

Structured, tool-backed security auditing targeting FastAPI backend endpoints, Zen-Engine input parsing, and PII protection in FlowBRE.

## Focus Audit Areas

1. **Un-Redacted PII Logging Protection**: Audit logger output to guarantee raw Applicant PAN, Aadhaar, DOB, or financial metrics are masked/redacted (`***XXXX`) before being written to stdout or log files.
2. **SQL Injection Prevention**: Ensure all database queries via SQLAlchemy execute parameterization without raw SQL string concatenation.
3. **Zen-Engine Input Sanitization**: Verify that candidate evaluation payloads passed to Rust Zen-Engine core are strictly validated against Pydantic schemas, preventing remote code execution or panic crashes.
4. **Denial of Service (DoS) & Memory Exhaustion**: Check payload size limits on incoming JSON evaluation requests to protect CPython heap memory from allocation exhaustion spikes during Stage 2 (`Allocate Memory`).

## Principles

- Prefer Semgrep/CodeQL static analysis rules for automated vulnerability scanning.
- Conduct variant analysis when a flaw is found to fix identical patterns across all endpoints.
- Maintain zero hardcoded API keys or secrets in source code.

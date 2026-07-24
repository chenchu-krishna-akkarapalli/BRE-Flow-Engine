"""Locust load / concurrency profile for the FlowBRE onboarding evaluation API.

Drives the live ASGI app at `/api/v1/onboarding/evaluate` with a mix of
tenants and applicant profiles, and fails any request that breaches the
SLA ceilings from CLAUDE.md.

Run (against a running `uvicorn app.main:app`):
    locust -f scripts/locustfile.py --host http://127.0.0.1:8000

Headless CI gate (10k requests, 500 concurrent users, fail on SLA breach):
    locust -f scripts/locustfile.py --host http://127.0.0.1:8000 \
           --headless -u 500 -r 100 -t 2m
"""
import random

from locust import HttpUser, between, events, task

# SLA ceilings (ms) — see CLAUDE.md §"SLA Latency Ceilings".
HEALTH_SLA_MS = 30.0
EVALUATE_SLA_MS = 80.0
ROUND_TRIP_CEILING_MS = 100.0

TENANTS = ["default", "tenant_alpha", "tenant_beta"]
BANKS = ["BOI", "INDIAN_BANK", "IOB", "BOB", "BOM", "HDFC", "AXIS", "KOTAK"]


def _make_payload() -> dict:
    """Polymorphic applicant payload spanning approve/reject/edge cases."""
    return {
        "entity_type": "Individual",
        "occupation": random.choice(["Salaried", "Self-Employed"]),
        "applicant_name": "Load Test Applicant",
        "net_monthly_salary": random.choice([24999, 25000, 60000, 150000]),
        "age": random.choice([20, 21, 32, 61]),
        "selected_bank": random.choice(BANKS),
        "is_nri": random.random() < 0.15,
        "minimum_stay_period_nri_years": random.choice([0, 1, 2, 3]),
        "credit_bureau": {
            "cibil_score": random.choice([650, 700, 701, 730, 800]),
            "dpd_history": random.choice([[0, 0, 0], [15, 0], [120, 0], ["STD", 0]]),
            "write_off_amount": random.choice([0.0, 4999.0, 5000.0, 8000.0, 12000.0]),
            "write_off_type": random.choice([None, "CC", "PL"]),
        },
    }


class OnboardingUser(HttpUser):
    wait_time = between(0.0, 0.05)  # aggressive — approximate peak burst

    @task(1)
    def health(self):
        with self.client.get("/api/v1/health", name="GET /health", catch_response=True) as r:
            if r.elapsed.total_seconds() * 1000 > HEALTH_SLA_MS:
                r.failure(f"health SLA breach: {r.elapsed.total_seconds()*1000:.1f} ms")

    @task(10)
    def evaluate(self):
        tenant = random.choice(TENANTS)
        with self.client.post(
            "/api/v1/onboarding/evaluate",
            json=_make_payload(),
            headers={"X-Tenant-ID": tenant},
            name="POST /onboarding/evaluate",
            catch_response=True,
        ) as r:
            elapsed_ms = r.elapsed.total_seconds() * 1000
            if r.status_code != 200:
                r.failure(f"HTTP {r.status_code}: {r.text[:200]}")
            elif elapsed_ms > ROUND_TRIP_CEILING_MS:
                r.failure(f"round-trip ceiling breach: {elapsed_ms:.1f} ms")
            elif elapsed_ms > EVALUATE_SLA_MS:
                r.failure(f"evaluate SLA breach: {elapsed_ms:.1f} ms")


@events.quitting.add_listener
def _assert_slas(environment, **_kw):
    """Fail the headless run (non-zero exit) on any failure or p95 breach."""
    stats = environment.stats.total
    if stats.num_failures > 0:
        environment.process_exit_code = 1
    elif stats.get_response_time_percentile(0.95) > ROUND_TRIP_CEILING_MS:
        environment.process_exit_code = 1
    else:
        environment.process_exit_code = 0

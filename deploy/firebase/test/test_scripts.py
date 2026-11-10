"""Behavioural tests for the deploy check scripts.

Run: python3 -m unittest discover -s deploy/firebase/test -v
"""

from __future__ import annotations

import hashlib
import hmac
import json
import sys
import tempfile
import unittest
from pathlib import Path
from urllib.parse import quote

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "scripts"))

import check_redirect  # noqa: E402
import check_startup  # noqa: E402
import firebaserc  # noqa: E402
import plan_guard  # noqa: E402
import state_guard  # noqa: E402
import stripe_header  # noqa: E402

REV = "han-server-00007-abc"
OLD = "han-server-00006-xyz"


def line(message: str, revision: str = REV) -> dict:
    """One Cloud Run log entry shaped like han-server's tracing JSON."""
    return {
        "resource": {"type": "cloud_run_revision", "labels": {"revision_name": revision}},
        "jsonPayload": {"level": "INFO", "fields": {"message": message}, "target": "han_server"},
    }


HEALTHY = [
    line("Starting han-server"),
    line("Connected to PostgreSQL"),
    line("Migrations complete"),
    line("PostgreSQL LISTEN/NOTIFY triggers created"),
]


class StartupCheck(unittest.TestCase):
    def test_healthy_revision_passes(self):
        ok, reason = check_startup.evaluate(HEALTHY, REV)
        self.assertTrue(ok, reason)

    def test_text_payload_only_does_not_count(self):
        # Regression: the old check read textPayload, which is empty for JSON logs.
        entries = [
            {"resource": {"labels": {"revision_name": REV}}, "textPayload": "Connected to PostgreSQL"},
        ]
        ok, _ = check_startup.evaluate(entries, REV)
        self.assertFalse(ok)

    def test_lines_from_an_older_revision_do_not_count(self):
        # Regression: the old check had no revision filter.
        entries = [line("Connected to PostgreSQL", OLD), line("Migrations complete", OLD),
                   line("PostgreSQL LISTEN/NOTIFY triggers created", OLD)]
        ok, reason = check_startup.evaluate(entries, REV)
        self.assertFalse(ok)
        self.assertIn("missing startup lines", reason)

    def test_degraded_mode_fails_even_with_api_up(self):
        # main.rs falls back to degraded mode and still answers /health, so this
        # check is the only database proof. A degraded start must fail.
        entries = HEALTHY + [line("Database connection failed (starting in degraded mode): timeout")]
        ok, reason = check_startup.evaluate(entries, REV)
        self.assertFalse(ok)
        self.assertIn("logged a failure", reason)

    def test_failed_migration_fails(self):
        entries = [line("Connected to PostgreSQL"),
                   line("Migration failed (non-fatal, server will continue): boom"),
                   line("PostgreSQL LISTEN/NOTIFY triggers created")]
        ok, _ = check_startup.evaluate(entries, REV)
        self.assertFalse(ok)

    def test_main_reads_a_file_and_exits_nonzero(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "logs.json"
            path.write_text(json.dumps([line("Connected to PostgreSQL")]), encoding="utf-8")
            self.assertEqual(check_startup.main([str(path), REV]), 1)
            path.write_text(json.dumps(HEALTHY), encoding="utf-8")
            self.assertEqual(check_startup.main([str(path), REV]), 0)


class RedirectCheck(unittest.TestCase):
    CLIENT = "Iv1.test123"
    CALLBACK = "https://api.han.guru/auth/github/callback"

    def location(self, redirect: str) -> str:
        return (
            "https://github.com/login/oauth/authorize?client_id=Iv1.test123"
            f"&redirect_uri={redirect}&state=s&scope=read:user%20user:email"
        )

    def test_percent_encoded_redirect_passes(self):
        # oauth.rs encodes redirect_uri, so this is the real server output.
        ok, reason = check_redirect.check(self.location(quote(self.CALLBACK, safe="")), self.CLIENT, self.CALLBACK)
        self.assertTrue(ok, reason)

    def test_unencoded_redirect_also_passes_after_decoding(self):
        ok, _ = check_redirect.check(self.location(self.CALLBACK), self.CLIENT, self.CALLBACK)
        self.assertTrue(ok)

    def test_wrong_client_id_fails(self):
        ok, reason = check_redirect.check(self.location(quote(self.CALLBACK, safe="")), "Iv1.other", self.CALLBACK)
        self.assertFalse(ok)
        self.assertIn("client_id", reason)

    def test_wrong_callback_fails(self):
        wrong = "https://evil.example/auth/github/callback"
        ok, reason = check_redirect.check(self.location(quote(wrong, safe="")), self.CLIENT, self.CALLBACK)
        self.assertFalse(ok)
        self.assertIn("redirect_uri", reason)

    def test_non_github_host_fails(self):
        ok, _ = check_redirect.check("https://github.com.evil.example/login/oauth/authorize?client_id=Iv1.test123", self.CLIENT, self.CALLBACK)
        self.assertFalse(ok)


class FirebaseRc(unittest.TestCase):
    """H2: targets must sit under the real project ID, or deploys fail."""

    def test_targets_are_keyed_by_project_id(self):
        cfg = firebaserc.build("han-guru")
        self.assertEqual(cfg["projects"]["default"], "han-guru")
        self.assertIn("han-guru", cfg["targets"])
        self.assertNotIn("default", cfg["targets"])

    def test_every_hosting_target_used_by_a_deploy_resolves(self):
        cfg = firebaserc.build("han-guru-prod")
        hosting = cfg["targets"]["han-guru-prod"]["hosting"]
        for target in ("dashboard", "app", "api"):
            self.assertIn(target, hosting)
            self.assertTrue(hosting[target])

    def test_rejects_bad_project_id(self):
        with self.assertRaises(ValueError):
            firebaserc.build("Han_Guru")

    def test_writes_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / ".firebaserc"
            self.assertEqual(firebaserc.main(["han-guru", str(path)]), 0)
            self.assertEqual(json.loads(path.read_text())["targets"]["han-guru"]["hosting"]["api"], ["han-guru-api"])


class PlanGuard(unittest.TestCase):
    def plan(self, *changes):
        return {"resource_changes": [{"address": a, "change": {"actions": acts}} for a, acts in changes]}

    def test_plain_update_and_create_pass(self):
        plan = self.plan(("google_sql_database_instance.han", ["update"]), ("x.y", ["create"]))
        self.assertEqual(plan_guard.unexpected(plan, set()), [])

    def test_delete_is_refused(self):
        plan = self.plan(("google_sql_database_instance.han", ["delete"]))
        self.assertEqual(plan_guard.unexpected(plan, set()), ["google_sql_database_instance.han"])

    def test_replace_is_refused_as_delete_then_create(self):
        plan = self.plan(("google_secret_manager_secret_version.master_kek", ["delete", "create"]))
        self.assertEqual(
            plan_guard.unexpected(plan, set()),
            ["google_secret_manager_secret_version.master_kek"],
        )

    def test_allowlisted_delete_passes(self):
        plan = self.plan(("google_dns_record_set.certs", ["delete"]))
        self.assertEqual(plan_guard.unexpected(plan, {"google_dns_record_set.certs"}), [])

    def test_allowlist_is_exact_not_prefix(self):
        plan = self.plan(("google_dns_record_set.certs_extra", ["delete"]))
        self.assertEqual(plan_guard.unexpected(plan, {"google_dns_record_set.certs"}), ["google_dns_record_set.certs_extra"])

    def test_main_exit_codes(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "plan.json"
            path.write_text(json.dumps(self.plan(("a.b", ["delete"]))))
            self.assertEqual(plan_guard.main([str(path)]), 1)
            self.assertEqual(plan_guard.main([str(path), "a.b"]), 0)


class StateGuard(unittest.TestCase):
    def state(self, values):
        return {"values": {"root_module": {"resources": [{"address": "x", "values": values}]}}}

    def test_write_only_nulls_pass(self):
        self.assertEqual(state_guard.leaks(self.state({"secret_data_wo": None, "password_wo": None})), [])

    def test_secret_value_in_state_is_found(self):
        found = state_guard.leaks(self.state({"secret_data": "hunter2"}))
        self.assertEqual(len(found), 1)
        self.assertIn("secret_data", found[0])

    def test_nested_password_is_found(self):
        found = state_guard.leaks(self.state({"nested": [{"password": "pw"}]}))
        self.assertTrue(found)

    def test_empty_values_are_not_leaks(self):
        self.assertEqual(state_guard.leaks(self.state({"secret_data": "", "password": None})), [])


class StripeSignature(unittest.TestCase):
    """The smoke test sends a signed body. It must verify the way stripe.rs does."""

    def verify_like_server(self, payload: str, header: str, secret: str) -> bool:
        # Mirrors billing/stripe.rs verify_signature.
        parts = dict(p.strip().split("=", 1) for p in header.split(",") if "=" in p)
        ts, sig = parts.get("t"), parts.get("v1")
        if ts is None or sig is None:
            return False
        expected = hmac.new(secret.encode(), f"{ts}.{payload}".encode(), hashlib.sha256).hexdigest()
        return hmac.compare_digest(sig, expected)

    def test_correct_secret_verifies(self):
        body = b'{"id":"evt_smoke"}'
        header = stripe_header.header("whsec_fixture", body, 1700000000)
        self.assertTrue(self.verify_like_server(body.decode(), header, "whsec_fixture"))

    def test_wrong_secret_fails(self):
        body = b'{"id":"evt_smoke"}'
        header = stripe_header.header("whsec_other", body, 1700000000)
        self.assertFalse(self.verify_like_server(body.decode(), header, "whsec_fixture"))

    def test_tampered_body_fails(self):
        header = stripe_header.header("whsec_fixture", b'{"id":"a"}', 1700000000)
        self.assertFalse(self.verify_like_server('{"id":"b"}', header, "whsec_fixture"))

    def test_header_has_timestamp_and_v1(self):
        header = stripe_header.header("s", b"{}", 5)
        self.assertTrue(header.startswith("t=5,v1="))


if __name__ == "__main__":
    unittest.main()

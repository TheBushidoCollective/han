"""Isolation checks: Han must not gain rights over unrelated services or secrets.

Han runs in the shared project thebushido-co, next to the live website, Relic,
client demos and unrelated secrets. These tests pin what Terraform may grant,
so a new grant cannot slip in unreviewed.

Known gaps are listed in OPEN_PROJECT_WIDE_ROLES. Each one is a project-wide
admin role that IAM cannot scope to Han's resources. Removing an entry needs a
design change, not just a test edit. See PATH.md section 8.

Run: python3 -B -m unittest discover -s deploy/firebase/test -v
"""

from __future__ import annotations

import json
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
TF = ROOT / "deploy" / "firebase" / "terraform"
BOOT = ROOT / "deploy" / "firebase" / "bootstrap"
WORKFLOWS = ROOT / ".github" / "workflows"

# Every project-level role Terraform grants, in the order iam.tf declares them.
EXPECTED_PROJECT_ROLES = {
    "roles/run.admin",
    "roles/firebasehosting.admin",
    "roles/firebase.viewer",
    "roles/serviceusage.serviceUsageConsumer",
    "roles/cloudsql.viewer",
    "roles/logging.viewer",
    "roles/cloudsql.client",
    "roles/logging.logWriter",
}

# Project-wide admin grants that IAM cannot scope to Han's resources. Each is a
# real exposure: run.admin reaches every Cloud Run service in thebushido-co, and
# firebasehosting.admin reaches every Hosting site, including the live website
# and the client demos. Accepting or removing them is Jason's decision.
OPEN_PROJECT_WIDE_ROLES = {
    "roles/run.admin",
    "roles/firebasehosting.admin",
}

# Roles that can administer IAM or identities. Terraform must never grant these,
# and the apply identity must never hold them.
FORBIDDEN_ANYWHERE = {
    "roles/owner",
    "roles/editor",
    "roles/resourcemanager.projectIamAdmin",
    "roles/iam.serviceAccountAdmin",
    "roles/iam.serviceAccountTokenCreator",
    "roles/iam.serviceAccountKeyAdmin",
    "roles/iam.workloadIdentityPoolAdmin",
}


def project_role_grants(text: str) -> set[str]:
    """Roles granted at project level: every google_project_iam_member block."""
    roles: set[str] = set()
    for block in re.split(r'\nresource "', text):
        if not block.startswith("google_project_iam_member"):
            continue
        for match in re.finditer(r'"(roles/[a-zA-Z0-9.]+)"', block):
            roles.add(match.group(1))
    return roles


class ProjectRoles(unittest.TestCase):
    def setUp(self):
        self.iam = (TF / "iam.tf").read_text(encoding="utf-8")

    def test_project_roles_are_exactly_the_reviewed_set(self):
        # Any new project-level grant fails here until it is reviewed and listed.
        self.assertEqual(project_role_grants(self.iam), EXPECTED_PROJECT_ROLES)

    def test_open_exceptions_are_still_listed_as_open(self):
        # Keeps the known gap visible: if someone removes it, this list shrinks in review.
        self.assertTrue(OPEN_PROJECT_WIDE_ROLES <= EXPECTED_PROJECT_ROLES)

    def test_no_identity_admin_role_is_granted_anywhere_in_terraform(self):
        text = "".join(p.read_text(encoding="utf-8") for p in TF.glob("*.tf"))
        for role in FORBIDDEN_ANYWHERE:
            self.assertNotIn(f'"{role}"', text, f"Terraform must not grant {role}")

    def test_apply_grant_allowlist_covers_every_project_grant(self):
        allow = set(json.loads((BOOT / "apply-grant-allowlist.json").read_text())["roles"])
        self.assertTrue(project_role_grants(self.iam) <= allow)

    def test_apply_grant_allowlist_excludes_forbidden_roles(self):
        allow = set(json.loads((BOOT / "apply-grant-allowlist.json").read_text())["roles"])
        self.assertEqual(allow & FORBIDDEN_ANYWHERE, set())

    def test_condition_expression_matches_the_allowlist(self):
        import sys

        sys.path.insert(0, str(BOOT))
        import apply_condition  # noqa: E402

        expr = apply_condition.expression()
        listed = set(re.findall(r"'(roles/[^']+)'", expr))
        allow = set(json.loads((BOOT / "apply-grant-allowlist.json").read_text())["roles"])
        self.assertEqual(listed, allow)
        self.assertIn("modifiedGrantsByRole", expr)


class IdentityScope(unittest.TestCase):
    def test_terraform_does_not_create_identities_or_pools(self):
        # The apply identity must not create service accounts or the WIF pool:
        # that would let it mint identities or edit trust. Humans create them.
        for path in TF.glob("*.tf"):
            text = path.read_text(encoding="utf-8")
            self.assertNotRegex(text, r'resource\s+"google_service_account"', path.name)
            self.assertNotRegex(text, r'resource\s+"google_iam_workload_identity_pool', path.name)

    def test_no_workflow_or_terraform_uses_the_shared_github_pool(self):
        # The shared pool `github` also admits other TheBushidoCollective repos.
        shared = "workloadIdentityPools/github/"
        for path in list(WORKFLOWS.glob("*.yml")) + list(TF.glob("*.tf")):
            self.assertNotIn(shared, path.read_text(encoding="utf-8"), path.name)

    def test_no_secret_or_service_account_is_read_by_name_outside_han_prefixes(self):
        # Terraform reads only han-* identities and han-server-* secrets.
        text = "".join(p.read_text(encoding="utf-8") for p in TF.glob("*.tf"))
        for match in re.finditer(r'secret_id\s*=\s*"([^"]+)"', text):
            self.assertTrue(match.group(1).startswith("han-server-"), match.group(1))
        for match in re.finditer(r'account_id\s*=\s*"([^"]+)"', text):
            self.assertTrue(match.group(1).startswith("han-"), match.group(1))


if __name__ == "__main__":
    unittest.main()

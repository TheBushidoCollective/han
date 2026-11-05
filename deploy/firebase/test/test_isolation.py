"""Isolation checks: Han must not gain rights over unrelated services or secrets.

Han runs in the shared project thebushido-co, next to the live website, Relic,
client demos and unrelated secrets. These tests pin what Terraform and the
workflows may grant or touch, so a new grant cannot slip in unreviewed.

These are policy checks on the declared configuration. They do not prove that
IAM enforces them. Whether IAM Conditions on resource.name work for each service
is an open question, listed in PATH.md section 8.

Run: python3 -B -m unittest discover -s deploy/firebase/test -v
"""

from __future__ import annotations

import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
TF = ROOT / "deploy" / "firebase" / "terraform"
BOOT = ROOT / "deploy" / "firebase" / "bootstrap"
ROLES = BOOT / "roles"
WORKFLOWS = ROOT / ".github" / "workflows"

# Roles that can administer IAM, identities, or can read every payload in a
# project. Terraform must never grant them, and no role file may contain them.
FORBIDDEN_ANYWHERE = {
    "roles/owner",
    "roles/editor",
    "roles/viewer",
    "roles/secretmanager.admin",
    "roles/cloudsql.admin",
    "roles/artifactregistry.admin",
    "roles/resourcemanager.projectIamAdmin",
    "roles/iam.serviceAccountAdmin",
    "roles/iam.serviceAccountTokenCreator",
    "roles/iam.serviceAccountKeyAdmin",
    "roles/iam.workloadIdentityPoolAdmin",
}

# Permissions no Han role may hold. versions.access reads a payload.
# The project-level IAM setters let a holder change who has what.
FORBIDDEN_PERMISSIONS = {
    "secretmanager.versions.access",
    "resourcemanager.projects.setIamPolicy",
    "resourcemanager.projects.get",
    "iam.serviceAccounts.setIamPolicy",
    "iam.serviceAccounts.getAccessToken",
    "iam.serviceAccounts.create",
    "iam.serviceAccounts.createKey",
}

# Project-wide admin grants that IAM cannot scope to Han's resources. Each is a
# real exposure. Hosting has no site-level IAM, so firebasehosting.admin reaches
# every site in thebushido-co, including the live website and the client demos.
# Accepting or removing it is Jason's decision. See PATH.md section 8, risk 1.
OPEN_PROJECT_WIDE_GRANTS = {
    ("hosting deployer", "roles/firebasehosting.admin"),
}


def custom_role_permissions(path: Path) -> set[str]:
    text = path.read_text(encoding="utf-8")
    body = text.split("includedPermissions:", 1)[1]
    return {line[2:].strip() for line in body.splitlines() if line.startswith("- ")}


def terraform_text() -> str:
    return "".join(p.read_text(encoding="utf-8") for p in sorted(TF.glob("*.tf")))


class TerraformScope(unittest.TestCase):
    def test_terraform_creates_no_identity_pool_or_project_iam(self):
        for path in TF.glob("*.tf"):
            text = path.read_text(encoding="utf-8")
            self.assertNotRegex(text, r'resource\s+"google_service_account"', path.name)
            self.assertNotRegex(text, r'resource\s+"google_iam_workload_identity_pool', path.name)
            self.assertNotRegex(text, r'resource\s+"google_project_iam', path.name)
            self.assertNotRegex(text, r'resource\s+"google_project_service"', path.name)
            self.assertNotRegex(text, r'resource\s+"google_firebase_', path.name)
            self.assertNotRegex(text, r'resource\s+"google_dns_', path.name)

    def test_no_forbidden_role_is_granted_in_terraform(self):
        text = terraform_text()
        for role in FORBIDDEN_ANYWHERE:
            self.assertNotIn(f'"{role}"', text, f"Terraform must not grant {role}")

    def test_every_grant_is_on_a_single_han_resource(self):
        # Every binding names a Han resource by id, never a project.
        text = terraform_text()
        for match in re.finditer(r'resource\s+"(google_[a-z_0-9]+_iam_member)"', text):
            block = text[match.start(): text.find("\n}", match.start())]
            self.assertNotIn('project   = var.project_id\n  role    = "roles/run', block)
            self.assertRegex(block, r"(secret_id|repository|name)\s*=", match.group(1))

    def test_secret_names_and_accounts_are_han_prefixed(self):
        text = terraform_text()
        for match in re.finditer(r'secret_id\s*=\s*"([^"]+)"', text):
            name = match.group(1)
            self.assertTrue(
                name.startswith("han-server-") or name.startswith("${local.secret_prefix}"), name
            )
        for match in re.finditer(r'account_id\s*=\s*"([^"]+)"', text):
            self.assertTrue(match.group(1).startswith("han-"), match.group(1))

    def test_the_shared_pool_is_referenced_only_by_the_bootstrap(self):
        # Han's runtime never uses the shared github pool. Only the one-shot
        # bootstrap signs in through it, as the existing bootstrap identity.
        for path in list(TF.glob("*.tf")) + list(WORKFLOWS.glob("*.yml")):
            text = path.read_text(encoding="utf-8")
            if "workloadIdentityPools/github/" in text:
                self.assertEqual(path.name, "han-bootstrap.yml", path.name)
                self.assertIn("service_account: terraform-bootstrap@thebushido-co.iam.gserviceaccount.com", text)
                self.assertIn("environment:\n      name: han-bootstrap", text)

    def test_invoker_setting_is_in_terraform(self):
        self.assertIn("invoker_iam_disabled = true", (TF / "cloudrun.tf").read_text(encoding="utf-8"))


class CustomRoles(unittest.TestCase):
    def roles(self):
        return sorted(ROLES.glob("*.yaml"))

    def test_roles_exist_for_every_identity_that_needs_them(self):
        names = {p.stem for p in self.roles()}
        self.assertEqual(
            names,
            {
                "han_tf_create",
                "han_tf_apply_secrets",
                "han_tf_plan_secrets",
                "han_tf_apply_sql",
                "han_tf_plan_sql",
                "han_tf_plan_global",
            },
        )

    def test_no_role_holds_a_forbidden_permission(self):
        for path in self.roles():
            perms = custom_role_permissions(path)
            self.assertEqual(perms & FORBIDDEN_PERMISSIONS, set(), path.name)

    def test_no_role_file_names_a_forbidden_predefined_role(self):
        for path in self.roles():
            for role in FORBIDDEN_ANYWHERE:
                self.assertNotIn(role, path.read_text(encoding="utf-8"), path.name)

    def test_plan_roles_are_read_only(self):
        for name in ("han_tf_plan_secrets", "han_tf_plan_sql", "han_tf_plan_global"):
            perms = custom_role_permissions(ROLES / f"{name}.yaml")
            for perm in perms:
                verb = perm.rsplit(".", 1)[-1]
                self.assertTrue(
                    verb.startswith("get") or verb.startswith("list"),
                    f"{name}: {perm} is not read-only",
                )

    def test_apply_secret_role_has_no_payload_access(self):
        perms = custom_role_permissions(ROLES / "han_tf_apply_secrets.yaml")
        self.assertNotIn("secretmanager.versions.access", perms)

    def test_create_role_cannot_read_or_change_anything(self):
        perms = custom_role_permissions(ROLES / "han_tf_create.yaml")
        self.assertEqual(perms, {"secretmanager.secrets.create", "cloudsql.instances.create"})


if __name__ == "__main__":
    unittest.main()

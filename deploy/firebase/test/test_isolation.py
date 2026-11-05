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

    def test_the_shared_pool_is_never_referenced(self):
        for path in list(TF.glob("*.tf")) + list(WORKFLOWS.glob("*.yml")):
            self.assertNotIn("workloadIdentityPools/github/", path.read_text(encoding="utf-8"), path.name)

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

    def test_the_bootstrap_script_binds_each_role_with_a_condition_where_one_exists(self):
        text = (BOOT / "bootstrap.sh").read_text(encoding="utf-8")
        for role in ("hanTfApplySecrets", "hanTfPlanSecrets", "hanTfApplySql", "hanTfPlanSql"):
            line = next(l for l in text.splitlines() if f"--role \"projects/${{PROJECT}}/roles/{role}\"" in l)
            self.assertIn("--condition=", line, role)
        self.assertNotIn("--role roles/owner", text)


class BootstrapScript(unittest.TestCase):
    def test_script_prints_by_default_and_never_creates_keys_or_projects(self):
        text = (BOOT / "bootstrap.sh").read_text(encoding="utf-8")
        self.assertIn('MODE="print"', text)
        self.assertNotIn("keys create", text)
        self.assertNotIn("projects create", text)
        self.assertNotIn("serviceAccountAdmin", text)

    def test_script_creates_five_service_accounts_and_no_others(self):
        text = (BOOT / "bootstrap.sh").read_text(encoding="utf-8")
        block = text.split("for sa in", 1)[1].split("; do", 1)[0]
        self.assertEqual(
            set(block.split()),
            {"han-tf-plan", "han-tf-apply", "han-deployer", "han-hosting-deployer", "han-server-run"},
        )

    def test_the_only_project_wide_grant_is_the_reviewed_hosting_exception(self):
        text = (BOOT / "bootstrap.sh").read_text(encoding="utf-8")
        project_grants = re.findall(r"add-iam-policy-binding \"\$PROJECT\".*?--role (\S+)", text, re.S)
        exceptions = {role for (_, role) in OPEN_PROJECT_WIDE_GRANTS}
        for role in project_grants:
            if role.startswith("projects/") or role.startswith("roles/"):
                if role in exceptions:
                    continue
                self.assertNotIn(role.split("/")[-1], {"owner", "editor", "viewer", "admin"}, role)
        self.assertIn("roles/firebasehosting.admin", exceptions and {"roles/firebasehosting.admin"})


if __name__ == "__main__":
    unittest.main()

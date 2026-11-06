"""Offline contract tests for per-execution identity; no vendor writes or tokens."""
import base64
import contextlib
import io
import copy
import importlib.util
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

path = Path(__file__).resolve().parents[1] / 'bootstrap' / 'execution.py'
spec = importlib.util.spec_from_file_location('execution_contract_test', path)
e = importlib.util.module_from_spec(spec)
spec.loader.exec_module(e)

NOW = 1793872800
T = '2026-11-05T23:00:00Z'
C, H, W, R = 'a' * 40, 'b' * 64, 'c' * 40, '123456789'


def manifest():
    return e.make_manifest(C, H, W, R, '1', T, False)


def claims(m):
    return {'repository_owner_id': e.OWNER_ID, 'repository_id': e.REPOSITORY_ID, 'repository': e.REPOSITORY,
            'ref': 'refs/heads/main', 'event_name': 'workflow_dispatch', 'workflow_ref': e.WORKFLOW_REF,
            'sha': C, 'workflow_sha': C, 'run_id': R, 'run_attempt': '1', 'runner_environment': 'github-hosted',
            'environment': 'han-bootstrap', 'aud': m['audience'], 'exp': e.deadline_timestamp(T) - 120}


def provider(m):
    return {'name': m['provider_resource'], 'state': 'ACTIVE', 'disabled': False,
            'attributeMapping': {'google.subject': "assertion.repository_id + ':' + assertion.run_id + ':' + assertion.run_attempt"},
            'attributeCondition': e.provider_condition(m),
            'oidc': {'issuerUri': e.ISSUER, 'allowedAudiences': [m['audience']]}}


class ExecutionContract(unittest.TestCase):
    def test_exact_manifest_and_derived_identity(self):
        m = manifest(); self.assertEqual(e.validate_manifest(m), m)
        self.assertEqual(m['pool_id'], 'han-bs-123456789-1')
        for key, value in [('pool_id', 'wrong'), ('member', 'wrong'), ('audience', 'wrong'),
                           ('A', '2'), ('version', True), ('rotate_db_password', 'false')]:
            changed = dict(m); changed[key] = value
            with self.subTest(key=key), self.assertRaises(e.Refuse): e.validate_manifest(changed)
        for key in ('C', 'H', 'W', 'R', 'T'):
            changed = dict(m); changed[key] = 7
            with self.subTest(key=key), self.assertRaises(e.Refuse): e.validate_manifest(changed)
        with self.assertRaises(e.Refuse): e.validate_manifest({**m, 'extra': 'x'})
        for run in ('0', '-1', '1' * 21, '12/3'):
            with self.assertRaises(e.Refuse): e.make_manifest(C, H, W, run, '1', T, False)

    def test_manifest_bytes_must_be_canonical_and_not_duplicate_keys(self):
        m = manifest()
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'registration.json'
            path.write_text(json.dumps(m, sort_keys=True, separators=(',', ':')) + '\n')
            self.assertEqual(e.load_manifest(str(path)), m)
            path.write_text(json.dumps(m) + '\n')
            with self.assertRaises(e.Refuse): e.load_manifest(str(path))
            raw = json.dumps(m, sort_keys=True, separators=(',', ':'))
            path.write_text(raw[:-1] + ',\"version\":1}\n')
            with self.assertRaises(e.Refuse): e.load_manifest(str(path))

    def test_every_signed_claim_and_expiration_is_required(self):
        m = manifest(); good = claims(m)
        with mock.patch.object(e.time, 'time', return_value=e.deadline_timestamp(T) - 3600):
            e.check_claims(m, good)
            for key in good:
                bad = dict(good); bad[key] = 'different'
                with self.subTest(key=key), self.assertRaises(e.Refuse): e.check_claims(m, bad)
            for exp in (e.deadline_timestamp(T) + 1, e.deadline_timestamp(T) - 3601, True):
                bad = dict(good, exp=exp)
                with self.assertRaises(e.Refuse): e.check_claims(m, bad)

    def test_provider_requires_exact_mapping_condition_and_audience(self):
        m = manifest(); good = provider(m); e.verify_provider(m, good)
        for key, value in [('name', 'other'), ('state', 'DELETED'), ('disabled', True),
                           ('attributeMapping', {}), ('attributeCondition', 'true'), ('oidc', {})]:
            bad = copy.deepcopy(good); bad[key] = value
            with self.subTest(key=key), self.assertRaises(e.Refuse): e.verify_provider(m, bad)
        bad = copy.deepcopy(good); bad['oidc']['allowedAudiences'].append('other')
        with self.assertRaises(e.Refuse): e.verify_provider(m, bad)
        bad = copy.deepcopy(good); bad['oidc']['jwksJson'] = '{"keys":[{"kid":"attacker"}]}'
        with self.assertRaises(e.Refuse): e.verify_provider(m, bad)
        bad = copy.deepcopy(good); bad['oidc']['futureSecurityOption'] = True
        with self.assertRaises(e.Refuse): e.verify_provider(m, bad)
        bad = copy.deepcopy(good); bad['aws'] = {'accountId': 'other'}
        with self.assertRaises(e.Refuse): e.verify_provider(m, bad)

    def test_pool_is_exact_active_and_has_no_sibling_provider(self):
        m = manifest()
        good = {'name': m['provider_resource'].rsplit('/providers/', 1)[0], 'state': 'ACTIVE'}
        providers = [{'name': m['provider_resource']}]
        e.verify_pool(m, good, providers)
        for key, value in [('name', 'other'), ('state', 'DELETED'), ('disabled', True),
                           ('mode', 'TRUST_DOMAIN'), ('inlineTrustConfig', {})]:
            bad = dict(good, **{key: value})
            with self.subTest(key=key), self.assertRaises(e.Refuse): e.verify_pool(m, bad, providers)
        with self.assertRaises(e.Refuse): e.verify_pool(m, good, [])
        with self.assertRaises(e.Refuse): e.verify_pool(m, good, providers + [{'name': good['name'] + '/providers/attacker'}])
        with self.assertRaises(e.Refuse): e.verify_pool(m, good, [{'name': 'other'}])

    def test_provider_condition_pins_every_reviewed_predicate(self):
        m = manifest()
        expected = [
            "assertion.repository_owner_id == '233175215'",
            "assertion.repository_id == '1100192477'",
            "assertion.repository == 'TheBushidoCollective/han'",
            "assertion.ref == 'refs/heads/main'",
            "assertion.event_name == 'workflow_dispatch'",
            "assertion.workflow_ref == 'TheBushidoCollective/han/.github/workflows/han-bootstrap.yml@refs/heads/main'",
            f"assertion.sha == '{C}'", f"assertion.workflow_sha == '{C}'",
            f"assertion.run_id == '{R}'", "assertion.run_attempt == '1'",
            "assertion.runner_environment == 'github-hosted'", "assertion.environment == 'han-bootstrap'",
            f"assertion.aud == '{m['audience']}'", f"int(assertion.exp) <= {e.deadline_timestamp(T)}",
        ]
        self.assertEqual(e.provider_condition(m), " && ".join(expected))
        for clause in expected:
            altered = provider(m)
            altered['attributeCondition'] = altered['attributeCondition'].replace(clause, 'true')
            with self.subTest(clause=clause), self.assertRaises(e.Refuse):
                e.verify_provider(m, altered)

    def test_exact_ci_context_and_attempt_are_required(self):
        m = manifest()
        env = {'GITHUB_ACTIONS': 'true', 'GITHUB_REPOSITORY': e.REPOSITORY, 'GITHUB_REF': 'refs/heads/main',
               'GITHUB_EVENT_NAME': 'workflow_dispatch', 'GITHUB_WORKFLOW_REF': e.WORKFLOW_REF,
               'RUNNER_ENVIRONMENT': 'github-hosted', 'GITHUB_SHA': C, 'GITHUB_RUN_ID': R, 'GITHUB_RUN_ATTEMPT': '1'}
        with mock.patch.dict(os.environ, env, clear=True), mock.patch.object(e.time, 'time', return_value=e.deadline_timestamp(T) - 3600):
            e.check_ci(m)
            for key in env:
                with self.subTest(key=key), mock.patch.dict(os.environ, {key: 'bad'}), self.assertRaises(e.Refuse): e.check_ci(m)
            with mock.patch.object(e.time, 'time', return_value=e.deadline_timestamp(T) - 2699), self.assertRaises(e.Refuse): e.check_ci(m)

    def test_oidc_endpoint_rejects_untrusted_host_and_never_logs_token(self):
        m = manifest()
        with mock.patch.dict(os.environ, {'ACTIONS_ID_TOKEN_REQUEST_URL': 'https://evil.example/token',
                                         'ACTIONS_ID_TOKEN_REQUEST_TOKEN': 'secret'}, clear=True):
            with self.assertRaises(e.Refuse): e.get_assertion(m)
        payload = base64.urlsafe_b64encode(json.dumps(claims(m)).encode()).decode().rstrip('=')
        assertion = 'header.' + payload + '.signature'
        with mock.patch.dict(os.environ, {'ACTIONS_ID_TOKEN_REQUEST_URL': 'https://pipelines.actions.githubusercontent.com/oidc',
                                         'ACTIONS_ID_TOKEN_REQUEST_TOKEN': 'secret'}, clear=True), \
             mock.patch.object(e.time, 'time', return_value=e.deadline_timestamp(T) - 3600), \
             mock.patch.object(e, 'http_json', return_value={'value': assertion}):
            token, metadata = e.get_assertion(m)
            self.assertEqual(token, assertion)
            self.assertEqual(metadata['run_id'], R)

    def test_claim_artifact_omits_jwt_and_unlisted_claims(self):
        m = manifest()
        with tempfile.TemporaryDirectory() as tmp:
            registration = Path(tmp) / 'registration.json'
            artifact = Path(tmp) / 'claims.json'
            registration.write_text(json.dumps(m, sort_keys=True, separators=(',', ':')) + '\n')
            metadata = dict(claims(m), arbitrary_secret='extra-secret')
            argv = ['execution.py', 'inspect', '--manifest', str(registration), '--claims-file', str(artifact)]
            out = io.StringIO()
            with mock.patch.object(sys, 'argv', argv), mock.patch.object(e, 'check_ci'), \
                 mock.patch.object(e, 'get_assertion', return_value=('jwt-secret', metadata)), \
                 contextlib.redirect_stdout(out):
                self.assertEqual(e.main(), 0)
            text = artifact.read_text()
            self.assertNotIn('jwt-secret', text + out.getvalue())
            self.assertNotIn('extra-secret', text + out.getvalue())
            self.assertEqual(json.loads(text)['run_id'], R)

    def test_readiness_retries_impersonation_without_logging_credentials(self):
        m = manifest()
        out = io.StringIO()
        with mock.patch.object(e, 'check_ci'), mock.patch.object(e, 'get_assertion', return_value=('assertion-secret', {})), \
             mock.patch.object(e.time, 'time', return_value=e.deadline_timestamp(T) - 3600), \
             mock.patch.object(e.time, 'monotonic', return_value=0), mock.patch.object(e.time, 'sleep'), \
             mock.patch.object(e, 'http_json', side_effect=[
                 {'access_token': 'federated-secret'}, e.Refuse('not ready'),
                 {'access_token': 'federated-secret'}, {'accessToken': 'owner-secret'},
             ]) as http, contextlib.redirect_stdout(out):
            e.wait_for_federation(m)
        self.assertEqual(http.call_count, 4)
        self.assertIn('Execution-specific federation is ready', out.getvalue())
        for secret in ('assertion-secret', 'federated-secret', 'owner-secret'):
            self.assertNotIn(secret, out.getvalue())
        self.assertEqual(http.call_args_list[0].args[0], 'https://sts.googleapis.com/v1/token')
        self.assertIn(':generateAccessToken', http.call_args_list[1].args[0])

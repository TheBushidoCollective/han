"""Offline contract tests for per-execution identity; no vendor writes or tokens."""
import base64
import copy
import importlib.util
import json
import os
import sys
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
        with self.assertRaises(e.Refuse): e.validate_manifest({**m, 'extra': 'x'})
        for run in ('0', '-1', '1' * 21, '12/3'):
            with self.assertRaises(e.Refuse): e.make_manifest(C, H, W, run, '1', T, False)

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

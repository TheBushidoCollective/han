"""Closed-network proof of complete, conservative Han allow-chain coverage.

Drives the standalone checker in bootstrap/allow_coverage.py with an injected
backend. Nothing here reaches IAM.
"""
import base64
import copy
import importlib.util
import json
import unittest
from pathlib import Path

p = Path(__file__).resolve().parents[1] / 'bootstrap' / 'allow_coverage.py'
s = importlib.util.spec_from_file_location('han_allow_coverage', p)
c = importlib.util.module_from_spec(s)
s.loader.exec_module(c)

# Fixture manifest carrying the fields the checker reads. The executor that
# derives manifests is not carried on this branch, so the identity is spelled out.
SUBJECT = '1100192477:123456789:1:' + 'a' * 40 + ':' + 'a' * 40
M = {'version': 2, 'C': 'a' * 40, 'H': 'b' * 64, 'W': 'c' * 40, 'R': '123456789', 'A': '1',
     'T': '2026-11-06T23:00:00Z', 'rotate_db_password': False, 'pool_id': 'han-bootstrap-v2',
     'provider_id': 'github', 'subject': SUBJECT,
     'member': 'principal://iam.googleapis.com/projects/911514101920/locations/global/workloadIdentityPools/han-bootstrap-v2/subject/' + SUBJECT}


def lease():
    return {'role': 'roles/iam.workloadIdentityUser', 'members': [M['member']], 'condition': {
        'title': 'han-bootstrap-sign-in',
        'description': f"han-bootstrap commit={M['C']} plan={M['H']} run={M['R']} attempt=1",
        'expression': f"request.time < timestamp('{M['T']}')"}}


def fixture():
    return {
        ('GET', c.ACCOUNT_URL): {'email': c.READER, 'projectId': c.PROJECT_ID, 'uniqueId': '123456'},
        ('POST', c.ACCOUNT_URL + ':getIamPolicy'): {'version': 3, 'etag': 'abc=', 'bindings': [lease()]},
        ('GET', c.CRM + 'projects/' + c.PROJECT_NUMBER): {'name': 'projects/' + c.PROJECT_NUMBER,
            'projectId': c.PROJECT_ID, 'state': 'ACTIVE', 'parent': 'folders/987'},
        ('POST', c.CRM + 'projects/' + c.PROJECT_NUMBER + ':getIamPolicy'): {'bindings': []},
        ('GET', c.CRM + 'folders/987'): {'name': 'folders/987', 'state': 'ACTIVE', 'parent': 'organizations/654'},
        ('POST', c.CRM + 'folders/987:getIamPolicy'): {'bindings': []},
        ('GET', c.CRM + 'organizations/654'): {'name': 'organizations/654', 'state': 'ACTIVE'},
        ('POST', c.CRM + 'organizations/654:getIamPolicy'): {'bindings': []},
    }


class Backend:
    def __init__(self, responses=None):
        self.responses = responses or fixture()
        self.calls = []
    def __call__(self, method, url, body, reader):
        self.calls.append((method, url, body, reader))
        if reader != c.READER or body != (c.POLICY_BODY if method == 'POST' else b''):
            raise AssertionError('unexpected request')
        value = self.responses[(method, url)]
        if isinstance(value, Exception): raise value
        return json.dumps(value, separators=(',', ':')).encode()


class AllowCoverage(unittest.TestCase):
    def test_positive_grant_and_retired_use_independent_complete_passes(self):
        b = Backend(); snapshot = c.collect(M, 'granted', b)
        self.assertEqual(len(b.calls), 16)
        self.assertEqual(c.validate(snapshot, M, 'granted', c.READER), snapshot)
        self.assertEqual(snapshot['manifest_sha256'], c.digest(c.canonical(M)))
        self.assertTrue(all(call[3] == c.READER for call in b.calls))
        after = fixture(); after[('POST', c.ACCOUNT_URL + ':getIamPolicy')] = {'etag': 'next=', 'bindings': []}
        self.assertEqual(c.collect(M, 'retired', Backend(after))['mode'], 'retired')
        self.assertEqual(c.collect(M, 'baseline', Backend(after))['mode'], 'baseline')

    def test_unparented_requires_successful_project_get_not_missing_parent(self):
        f = fixture(); f[('GET', c.CRM + 'projects/' + c.PROJECT_NUMBER)].pop('parent')
        b = Backend(f); c.collect(M, 'granted', b)
        self.assertEqual(len(b.calls), 8)
        f = fixture(); f[('GET', c.CRM + 'folders/987')] = PermissionError('403')
        with self.assertRaisesRegex(c.CoverageError, 'COVERAGE_READ_FAILED'):
            c.collect(M, 'granted', Backend(f))
        f = fixture(); f[('GET', c.CRM + 'projects/' + c.PROJECT_NUMBER)]['parent'] = None
        with self.assertRaises(c.CoverageError): c.collect(M, 'granted', Backend(f))

    def test_candidate_bindings_at_every_level_block_even_when_condition_false(self):
        for method, url in [('POST', c.ACCOUNT_URL + ':getIamPolicy'),
                            ('POST', c.CRM + 'projects/' + c.PROJECT_NUMBER + ':getIamPolicy'),
                            ('POST', c.CRM + 'folders/987:getIamPolicy'),
                            ('POST', c.CRM + 'organizations/654:getIamPolicy')]:
            for member in ('allUsers', 'allAuthenticatedUsers', M['member'],
                'principalSet://iam.googleapis.com/projects/911514101920/locations/global/workloadIdentityPools/han-bootstrap-v2/group/x',
                'principalSet://iam.googleapis.com/projects/-/locations/global/workloadIdentityPools/*/*'):
                with self.subTest(url=url, member=member):
                    f = fixture(); policy = f[(method, url)]; policy['version'] = 3
                    policy['bindings'].append({'role': 'roles/viewer', 'members': [member],
                        'condition': {'title': 'expired', 'expression': "request.time < timestamp('2020-01-01T00:00:00Z')"}})
                    with self.assertRaisesRegex(c.CoverageError, 'COVERAGE_ALTERNATE_GRANT'):
                        c.collect(M, 'granted', Backend(f))

    def test_disjoint_principals_and_unknown_shapes(self):
        for member in ('user:person@example.com', 'serviceAccount:sa@example.iam.gserviceaccount.com',
                       'group:team@example.com', 'domain:example.com', 'deleted:user:gone@example.com?uid=123',
                       'principal://iam.googleapis.com/projects/911514101920/locations/global/workloadIdentityPools/other/subject/x',
                       'principalSet://cloudresourcemanager.googleapis.com/projects/123/type/ServiceAccount',
                       'principalSet://iam.googleapis.com/locations/global/workforcePools/contractors/*',
                       'deleted:principal://iam.googleapis.com/locations/global/workforcePools/contractors/subject/former',
                       'serviceAccount:my-project.svc.id.goog[namespace/service-account]',
                       'principal://iam.googleapis.com/projects/123/locations/global/workloadIdentityPools/my-project.svc.id.goog/kubernetes.serviceaccount.uid/abc-123',
                       'principalSet://agents.global.org-123456789012.system.id.goog/*',
                       'principal://agents.global.proj-123.system.id.goog/resources/aiplatform/projects/123/locations/us/reasoningEngines/a',
                       'projectOwner:thebushido-co', 'projectEditor:thebushido-co', 'projectViewer:thebushido-co'):
            self.assertEqual(c.classify(member, M), 'disjoint', member)
        for member in ('user:not-an-email', 'principal://evil.example/x',
                       'principalSet://iam.googleapis.com/projects/911514101920/locations/global/workloadIdentityPools/han-bootstrap-v2/attribute.x/x%2Fy',
                       'future:unknown', 'projectOwner:other-project', 'projectOwner:911514101920'):
            with self.assertRaises(c.CoverageError, msg=member): c.classify(member, M)

    def test_legacy_project_members_are_disjoint_and_do_not_block_a_grant(self):
        f = fixture()
        f[('POST', c.CRM + 'projects/' + c.PROJECT_NUMBER + ':getIamPolicy')] = {'bindings': [
            {'role': 'roles/owner', 'members': ['projectOwner:thebushido-co']},
            {'role': 'roles/editor', 'members': ['projectEditor:thebushido-co']},
            {'role': 'roles/viewer', 'members': ['projectViewer:thebushido-co']}]}
        self.assertEqual(c.collect(M, 'granted', Backend(f))['mode'], 'granted')

    def test_malformed_hierarchy_and_policy_block(self):
        cases = []
        f = fixture(); f[('GET', c.CRM + 'folders/987')]['parent'] = 'folders/987'; cases.append(f)
        f = fixture(); f[('GET', c.ACCOUNT_URL)]['uniqueId'] = None; cases.append(f)
        f = fixture(); f[('POST', c.ACCOUNT_URL + ':getIamPolicy')].pop('etag'); cases.append(f)
        f = fixture(); f[('POST', c.ACCOUNT_URL + ':getIamPolicy')]['version'] = 1; cases.append(f)
        f = fixture(); f[('POST', c.CRM + 'projects/' + c.PROJECT_NUMBER + ':getIamPolicy')]['bindings'] = [{'role':'roles/viewer_withcond_x','members':['user:a@example.com']}]; cases.append(f)
        for f in cases:
            with self.assertRaises(c.CoverageError): c.collect(M, 'granted', Backend(f))

    def test_retries_unstable_snapshots_and_fails_after_three(self):
        class Unstable(Backend):
            def __call__(self, method, url, body, reader):
                result = super().__call__(method, url, body, reader)
                if method == 'POST' and url == c.CRM + 'organizations/654:getIamPolicy':
                    return json.dumps({'etag': str(len(self.calls)), 'bindings': []}).encode()
                return result
        b = Unstable()
        with self.assertRaisesRegex(c.CoverageError, 'COVERAGE_UNSTABLE'):
            c.collect(M, 'granted', b)
        self.assertEqual(len(b.calls), 48)

    def test_unstable_snapshot_retries_the_entire_chain_then_accepts_stable_reads(self):
        class ChangesOnce(Backend):
            def __call__(self, method, url, body, reader):
                result = super().__call__(method, url, body, reader)
                if method == 'POST' and url == c.CRM + 'organizations/654:getIamPolicy' and len(self.calls) == 8:
                    return b'{"etag":"old","bindings":[]}'
                return result
        b = ChangesOnce()
        snapshot = c.collect(M, 'granted', b)
        self.assertEqual(snapshot['mode'], 'granted')
        self.assertEqual(len(b.calls), 32)

    def test_snapshot_revalidation_rejects_tampered_raw_and_identity(self):
        snapshot = c.collect(M, 'granted', Backend())
        for mutation in ('reader', 'hash', 'raw', 'extra', 'url'):
            bad = copy.deepcopy(snapshot)
            if mutation == 'reader': bad['reader'] = 'other'
            if mutation == 'hash': bad['passes'][0][0]['response_sha256'] = '0' * 64
            if mutation == 'raw': bad['passes'][0][0]['response_base64'] = base64.b64encode(b'{}').decode()
            if mutation == 'extra': bad['passes'][0].append(copy.deepcopy(bad['passes'][0][0]))
            if mutation == 'url': bad['passes'][0][0]['url'] = 'https://evil.example/'
            with self.subTest(mutation=mutation), self.assertRaises(c.CoverageError):
                c.validate(bad, M, 'granted', c.READER)


if __name__ == '__main__':
    unittest.main()

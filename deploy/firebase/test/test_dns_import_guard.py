"""Negative controls for legacy DNS import-only plan and workspace guards."""
import copy
import importlib.util
import unittest
import unittest.mock as mock
import yaml
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

path = Path(__file__).resolve().parents[1] / 'scripts' / 'dns_import_guard.py'
spec = importlib.util.spec_from_file_location('dns_import_guard', path)
g = importlib.util.module_from_spec(spec)
spec.loader.exec_module(g)


def workspace():
    return {'data': {'id': g.WORKSPACE, 'attributes': {'name': 'han-guru', 'locked': True,
            'auto-apply': False, 'vcs-repo': None}, 'relationships': {
            'current-state-version': {'data': {'id': g.STATE_VERSION}}}}}


def plan():
    changes = []
    for key, (name, kind) in g.RECORDS.items():
        ident = f'projects/waldrip-net/managedZones/han-guru/rrsets/{name}/{kind}'
        changes.append({'mode': 'managed', 'type': 'google_dns_record_set', 'index': key,
                        'address': f'google_dns_record_set.legacy["{key}"]', 'change': {
                            'actions': ['no-op'], 'importing': {'id': ident},
                            'after': {'project': 'waldrip-net', 'managed_zone': 'han-guru',
                                      'name': name, 'type': kind, 'ttl': 300, 'rrdatas': ['test.']},
                            'after_unknown': {}}})
    return {'complete': True, 'errored': False, 'resource_changes': changes}


class GuardTests(unittest.TestCase):
    def test_workspace_accepts_exact_frozen_detached(self):
        g.check_workspace(workspace())

    def test_workspace_refuses_missing_or_wrong_guards(self):
        for field, value in [('locked', False), ('auto-apply', True), ('vcs-repo', {'identifier': 'x'}), ('name', 'other')]:
            doc = workspace(); doc['data']['attributes'][field] = value
            with self.subTest(field=field), self.assertRaises(g.Refuse):
                g.check_workspace(doc)
        doc = workspace(); del doc['data']['attributes']['vcs-repo']
        with self.assertRaises(g.Refuse): g.check_workspace(doc)
        with mock.patch.object(g, 'api', side_effect=g.Refuse('unauthorized')):
            with self.assertRaises(g.Refuse): g.check_cloud('invalid')
        doc = workspace(); doc['data']['relationships']['current-state-version']['data']['id'] = 'changed'
        with self.assertRaises(g.Refuse): g.check_workspace(doc)
        with self.assertRaises(g.Refuse): g.check_cloud('')
        with self.assertRaises(g.Refuse): g.check_runs([{'data': [{'attributes': {'status': 'applying'}}]}])
        g.check_runs([{'data': [{'attributes': {'status': 'errored'}}]}])

    def test_cloud_checks_every_page(self):
        first = {'data': [{'attributes': {'status': 'errored'}}],
                 'meta': {'pagination': {'total-pages': 2}}}
        second = {'data': [{'attributes': {'status': 'applied'}}],
                  'meta': {'pagination': {'total-pages': 2}}}
        with mock.patch.object(g, 'api', side_effect=[workspace(), first, second]) as api:
            g.check_cloud('test-token')
            self.assertEqual(api.call_count, 3)
            self.assertIn('page%5Bnumber%5D=2', api.call_args.args[0])
        second['data'][0]['attributes']['status'] = 'pending'
        with mock.patch.object(g, 'api', side_effect=[workspace(), first, second]):
            with self.assertRaises(g.Refuse):
                g.check_cloud('test-token')

    def test_cloud_rejects_malformed_pagination(self):
        for value in (None, 0, 101, '2'):
            page = {'data': [], 'meta': {'pagination': {'total-pages': value}}}
            with self.subTest(value=value), mock.patch.object(g, 'api', side_effect=[workspace(), page]):
                with self.assertRaises(g.Refuse):
                    g.check_cloud('test-token')

    def test_api_never_follows_redirects_with_authorization(self):
        hits = []
        class Handler(BaseHTTPRequestHandler):
            def do_GET(self):
                hits.append(self.path)
                self.send_response(302)
                self.send_header('Location', f'http://127.0.0.1:{self.server.server_port}/redirected')
                self.end_headers()
            def log_message(self, *args):
                pass
        server = HTTPServer(('127.0.0.1', 0), Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            with mock.patch.object(g, 'BASE', f'http://127.0.0.1:{server.server_port}'):
                with self.assertRaises(g.Refuse):
                    g.api('/initial', 'test-token')
            self.assertEqual(hits, ['/initial'])
        finally:
            server.shutdown()
            thread.join()
            server.server_close()

    def test_plan_accepts_only_four_exact_noop_imports(self):
        g.check_plan(plan())
        mutations = []
        x = plan(); x['resource_changes'][0]['change']['actions'] = ['update']; mutations.append(x)
        x = plan(); x['resource_changes'][0]['change']['importing']['id'] = 'other'; mutations.append(x)
        x = plan(); x['resource_changes'][0]['change']['after_unknown'] = {'rrdatas': True}; mutations.append(x)
        x = plan(); x['resource_changes'].pop(); mutations.append(x)
        x = plan(); x['resource_changes'].append(copy.deepcopy(x['resource_changes'][0])); mutations.append(x)
        x = plan(); x['resource_changes'][0]['change']['after']['project'] = 'other'; mutations.append(x)
        x = plan(); x['complete'] = False; mutations.append(x)
        x = plan(); x['resource_changes'].append({'address': 'bad'}); mutations.append(x)
        for mutation in mutations:
            with self.assertRaises(g.Refuse): g.check_plan(mutation)

    def test_workflow_checks_frozen_state_before_auth_and_before_apply(self):
        root = Path(__file__).resolve().parents[3]
        wf = yaml.safe_load((root / '.github/workflows/han-dns-import.yml').read_text())
        jobs = wf['jobs']
        for name in ('dns-import-plan', 'dns-import-apply'):
            job = jobs[name]
            self.assertEqual(job['environment'], 'han-infra-apply')
            self.assertIn("github.ref == 'refs/heads/main'", job['if'])
            steps = job['steps']
            auth = next(i for i, step in enumerate(steps) if 'google-github-actions/auth@' in step.get('uses', ''))
            guard = next(i for i, step in enumerate(steps) if 'dns_import_guard.py cloud' in step.get('run', ''))
            self.assertLess(guard, auth)
            self.assertEqual(steps[guard]['env']['TFC_READ_TOKEN'], '${{ secrets.TFC_READ_TOKEN }}')
        apply_steps = jobs['dns-import-apply']['steps']
        apply = next(i for i, step in enumerate(apply_steps) if 'terraform apply' in step.get('run', ''))
        self.assertIn('dns_import_guard.py plan', apply_steps[apply - 1]['run'])
        self.assertIn('dns_import_guard.py cloud', apply_steps[apply - 1]['run'])
        self.assertEqual(apply_steps[apply]['run'], 'terraform apply -input=false -no-color dns.tfplan')

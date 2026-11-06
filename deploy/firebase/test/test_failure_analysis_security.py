"""Exercise failure-analysis entrypoints with a fake GitHub API, never live writes."""
import json
import os
import subprocess
import tempfile
import unittest
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[3]
SCRIPT = ROOT / 'deploy/firebase/bootstrap/failure_analysis.py'
WORKFLOW = ROOT / '.github/workflows/test-failure-analysis.yml'
SHA = 'a' * 40


class FailureAnalysisSecurity(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.path = Path(self.temp.name)
        self.run_data = {
            'id': 17, 'name': 'Test Website', 'path': '.github/workflows/test-website.yml',
            'conclusion': 'failure', 'status': 'completed', 'run_attempt': 1,
            'event': 'pull_request', 'head_branch': "feat/it's-$(touch sentinel)`id`\nnext",
            'head_sha': SHA, 'repository': {'id': 1}, 'head_repository': {'id': 1},
            'actor': {'login': 'writer', 'type': 'User'},
        }
        self.event = {'action': 'completed', 'repository': {'id': 1, 'full_name': 'org/repo',
                      'default_branch': 'main'}, 'workflow_run': self.run_data.copy()}
        self.state = {'run': self.run_data, 'permission': 'write', 'branch_sha': SHA,
                      'prs': [[{'number': 12, 'head': {'repo': {'id': 1}, 'ref': self.run_data['head_branch'],
                                                     'sha': SHA},
                                 'base': {'repo': {'id': 1}, 'ref': 'main'}}]], 'calls': []}
        stub = self.path / 'gh'
        stub.write_text('''#!/usr/bin/env python3
import json, os, sys
p = os.environ['STUB_STATE']
with open(p) as f: s = json.load(f)
a = sys.argv[1:]; endpoint = a[1]
s['calls'].append(a)
if endpoint.endswith('/rerun-failed-jobs'):
    s['run']['run_attempt'] = 2
    s['run']['status'] = 'queued'
    s['run']['conclusion'] = None
    result = None
elif endpoint.endswith('/comments'): result = None
elif '/actions/runs/' in endpoint: result = s['run']
elif '/collaborators/' in endpoint: result = {'permission': s['permission']}
elif '/branches/' in endpoint: result = {'commit': {'sha': s['branch_sha']}}
elif endpoint.endswith('/pulls'): result = s['prs']
else: raise SystemExit(3)
with open(p, 'w') as f: json.dump(s, f)
if result is not None: print(json.dumps(result))
''')
        stub.chmod(0o755)

    def invoke(self, mode, result=None):
        (self.path / 'event.json').write_text(json.dumps(self.event))
        (self.path / 'state.json').write_text(json.dumps(self.state))
        env = {**os.environ, 'PATH': str(self.path) + os.pathsep + os.environ['PATH'],
               'STUB_STATE': str(self.path / 'state.json'), 'GITHUB_EVENT_PATH': str(self.path / 'event.json'),
               'GITHUB_REPOSITORY': 'org/repo', 'ANALYSIS_RESULT': result or ''}
        proc = subprocess.run(['python3', '-I', '-B', str(SCRIPT), mode], cwd=self.path,
                              env=env, text=True, capture_output=True)
        self.state = json.loads((self.path / 'state.json').read_text())
        return proc

    def writes(self):
        return [call for call in self.state['calls'] if 'POST' in call]

    def test_hostile_branch_and_summary_are_literal_and_retry_original_run(self):
        text = "it's $(touch sentinel) `touch sentinel`\nsecond line"
        result = json.dumps({'is_flaky': True, 'confidence': 0.7, 'summary': text})
        proc = self.invoke('act', result)
        self.assertEqual(proc.returncode, 0, proc.stderr)
        writes = self.writes()
        self.assertEqual([w[1] for w in writes], ['repos/org/repo/actions/runs/17/rerun-failed-jobs',
                                                    'repos/org/repo/issues/12/comments'])
        self.assertIn(text, writes[1][-1])
        self.assertFalse((self.path / 'sentinel').exists())
        self.assertNotEqual(self.invoke('act', result).returncode, 0)
        self.assertEqual(len(self.writes()), 2)

    def test_low_confidence_does_not_claim_retry(self):
        result = json.dumps({'is_flaky': True, 'confidence': 0.69, 'summary': 'Review'})
        self.assertEqual(self.invoke('act', result).returncode, 0)
        self.assertEqual(len(self.writes()), 1)
        self.assertIn('below 0.7', self.writes()[0][-1])

    def test_bad_results_never_write(self):
        for raw in ('{', '{"is_flaky":true,"confidence":NaN,"summary":"x"}',
                    '{"is_flaky":true,"confidence":1.1,"summary":"x"}',
                    '{"is_flaky":true,"confidence":true,"summary":"x"}',
                    '{"is_flaky":"true","confidence":1,"summary":"x"}'):
            with self.subTest(raw=raw):
                self.assertNotEqual(self.invoke('act', raw).returncode, 0)
                self.assertEqual(self.writes(), [])

    def test_invalid_sources_rejected_before_analysis_and_writes(self):
        result = json.dumps({'is_flaky': True, 'confidence': 0.9, 'summary': 'x'})
        for field, value in [('path', '.github/workflows/other.yml'), ('name', 'Other'),
                             ('run_attempt', 2), ('event', 'workflow_dispatch'),
                             ('head_repository', {'id': 2}), ('conclusion', 'success'),
                             ('actor', {'login': 'bot[bot]', 'type': 'Bot'})]:
            with self.subTest(field=field):
                original = self.event['workflow_run'][field]
                self.event['workflow_run'][field] = value
                self.assertNotEqual(self.invoke('gate').returncode, 0)
                self.assertNotEqual(self.invoke('act', result).returncode, 0)
                self.assertEqual(self.writes(), [])
                self.event['workflow_run'][field] = original
        for key, value in [('permission', 'read'), ('branch_sha', 'b' * 40), ('prs', [[]]),
                           ('prs', [self.state['prs'][0] * 2])]:
            with self.subTest(key=key):
                old = self.state[key]
                self.state[key] = value
                self.assertNotEqual(self.invoke('gate').returncode, 0)
                self.assertNotEqual(self.invoke('act', result).returncode, 0)
                self.assertEqual(self.writes(), [])
                self.state[key] = old

    def test_workflow_gates_model_and_isolates_write_permissions(self):
        workflow = yaml.safe_load(WORKFLOW.read_text())
        analyze = workflow['jobs']['analyze']
        steps = analyze['steps']
        gate = next(i for i, step in enumerate(steps) if step.get('name') == 'Authenticate source')
        model = next(i for i, step in enumerate(steps) if step.get('id') == 'detect')
        self.assertLess(gate, model)
        self.assertIn('failure_analysis.py gate', steps[gate]['run'])
        self.assertEqual(analyze['permissions']['actions'], 'read')
        self.assertEqual(analyze['permissions']['pull-requests'], 'read')
        self.assertEqual(steps[model]['with']['github_token'], '${{ github.token }}')
        self.assertIn('--allowedTools', steps[model]['with']['claude_args'])
        for job in workflow['jobs'].values():
            for step in job['steps']:
                if 'run' in step:
                    self.assertNotIn('${{', step['run'])
                if 'checkout@' in step.get('uses', ''):
                    self.assertFalse(step['with']['persist-credentials'])
                    self.assertEqual(step['with']['ref'], '${{ github.sha }}')


if __name__ == '__main__':
    unittest.main()

"""Exercise the actual workflow-run source gate without live GitHub writes."""
import json
import subprocess
import unittest
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[3]


class AutoFixSourceTests(unittest.TestCase):
    def gate(self, **overrides):
        workflow = yaml.safe_load((ROOT / '.github/workflows/auto-fix-ci.yml').read_text())
        step = workflow['jobs']['should-fix']['steps'][0]
        script = step['with']['script']
        data = {'repo': 1, 'head_repo': 1, 'actor': 'writer', 'event': 'push',
                'branch': 'feature', 'sha': 'abc', 'current': 'abc',
                'permission': 'write', 'pull_repo': 1, 'pull_sha': 'abc', 'pull_ref': 'feature'}
        data.update(overrides)
        harness = r'''
const d = JSON.parse(process.argv[1]);
process.env.HEAD_BRANCH = d.branch; process.env.HEAD_SHA = d.sha;
const context = {repo: {owner: 'org', repo: 'repo'}, payload: {repository: {id: d.repo},
  workflow_run: {head_repository: {id: d.head_repo}, actor: {login: d.actor}, event: d.event}}};
const output = {};
const core = {setOutput: (k,v) => output[k]=v};
const github = {rest: {repos: {
  getCollaboratorPermissionLevel: async () => ({data: {permission: d.permission}}),
  getBranch: async () => ({data: {commit: {sha: d.current}}}),
  listCommits: async () => ({data: []})}, pulls: {list: () => {}}},
  paginate: async () => [{head: {repo: {id: d.pull_repo}, sha: d.pull_sha, ref: d.pull_ref}}]};
(async () => { await (async () => { SCRIPT })(); console.log(JSON.stringify(output)); })().catch(e => {console.error(e); process.exit(1)});
'''.replace('SCRIPT', script)
        result = subprocess.run(['node', '-e', harness, json.dumps(data)], capture_output=True, text=True, check=True)
        return json.loads(result.stdout.splitlines()[-1])['should_run']

    def test_authorized_same_repository_sources_work(self):
        self.assertEqual(self.gate(), 'true')
        self.assertEqual(self.gate(event='pull_request'), 'true')
        self.assertEqual(self.gate(branch="feature';global.pwned=1;//"), 'true')

    def test_untrusted_and_stale_sources_are_refused(self):
        for change in ({'head_repo': 2}, {'permission': 'read'}, {'current': 'new'},
                       {'event': 'workflow_dispatch'}, {'actor': 'github-actions[bot]'},
                       {'event': 'pull_request', 'pull_repo': 2},
                       {'event': 'pull_request', 'pull_sha': 'other'}):
            with self.subTest(change=change):
                self.assertEqual(self.gate(**change), 'false')

    def test_checkout_and_push_use_authenticated_source(self):
        workflow = yaml.safe_load((ROOT / '.github/workflows/auto-fix-ci.yml').read_text())
        steps = workflow['jobs']['auto-fix']['steps']
        checkout = next(s for s in steps if s.get('name') == 'Checkout code')
        push = next(s for s in steps if s.get('name') == 'Commit and push fixes')
        self.assertEqual(checkout['with']['ref'], '${{ github.event.workflow_run.head_sha }}')
        self.assertNotIn('${{', push['run'])
        self.assertIn('HEAD:refs/heads/${HEAD_BRANCH}', push['run'])

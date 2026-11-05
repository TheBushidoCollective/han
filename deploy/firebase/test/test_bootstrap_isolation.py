"""Exercise the actual bootstrap workflow command with a hostile adjacent module."""
import pathlib
import shutil
import subprocess
import tempfile
import unittest

import yaml

ROOT = pathlib.Path(__file__).resolve().parents[3]
WORKFLOW = ROOT / '.github/workflows/han-bootstrap.yml'


class BootstrapPythonIsolation(unittest.TestCase):
    def test_all_bootstrap_invocations_use_isolated_python(self):
        workflow = yaml.safe_load(WORKFLOW.read_text())
        runs = [step['run'] for job in workflow['jobs'].values()
                for step in job.get('steps', []) if 'deploy/firebase/bootstrap/bootstrap.py' in step.get('run', '')]
        self.assertEqual(len(runs), 3)
        for script in runs:
            self.assertIn('python3 -I -B deploy/firebase/bootstrap/bootstrap.py', script)

    def test_revoke_receives_the_same_rotation_choice_and_approval_as_execute(self):
        workflow = yaml.safe_load(WORKFLOW.read_text())
        steps = workflow['jobs']['apply']['steps']
        execute = next(step for step in steps if step.get('id') == 'execute')
        revoke = next(step for step in steps if '--revoke-only' in step.get('run', ''))
        self.assertEqual(execute['env']['ROTATE_FLAG'], revoke['env']['ROTATE_FLAG'])
        for flag in ('--expect-sha256 "$EXPECTED_SHA256"', '--expect-commit "$EXPECTED_COMMIT"',
                     '"${rotate[@]}"'):
            self.assertIn(flag, execute['run'])
            self.assertIn(flag, revoke['run'])

    def test_execute_leaves_time_for_revoke_before_grant_expiry(self):
        import ast

        workflow = yaml.safe_load(WORKFLOW.read_text())
        job = workflow['jobs']['apply']
        execute = next(step for step in job['steps'] if step.get('id') == 'execute')
        tree = ast.parse((ROOT / 'deploy/firebase/bootstrap/bootstrap.py').read_text())
        assignment = next(node for node in tree.body if isinstance(node, ast.Assign)
                          and any(isinstance(target, ast.Name) and target.id == 'MIN_REMAINING'
                                  for target in node.targets))
        minutes = next(keyword.value for keyword in assignment.value.keywords if keyword.arg == 'minutes')
        minimum = ast.literal_eval(minutes)
        self.assertEqual(job['timeout-minutes'], minimum)
        self.assertGreaterEqual(job['timeout-minutes'] - execute['timeout-minutes'], 5)

    def test_adjacent_shadow_module_is_not_imported(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = pathlib.Path(tmp)
            shutil.copytree(ROOT / 'deploy/firebase/bootstrap', root / 'deploy/firebase/bootstrap',
                            ignore=shutil.ignore_patterns('__pycache__'))
            (root / '.github/workflows').mkdir(parents=True)
            shutil.copy2(WORKFLOW, root / '.github/workflows/han-bootstrap.yml')
            marker = root / 'shadow-executed'
            shadow = root / 'deploy/firebase/bootstrap/json.py'
            shadow.write_text(f'open({str(marker)!r}, "w").write("executed")\n')
            result = subprocess.run(['python3', '-I', '-B', 'deploy/firebase/bootstrap/bootstrap.py'],
                                    cwd=root, capture_output=True, text=True, timeout=60)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn('plan-sha256:', result.stdout)
            self.assertFalse(marker.exists(), 'adjacent json.py executed')


if __name__ == '__main__':
    unittest.main()

"""Complete, conservative direct and inherited IAM allow-coverage observation.

The backend is an injected read-only callable (method, URL, body, reader) -> bytes.
No caller supplies a hierarchy, filtered policies or an authorization verdict.
"""
from __future__ import annotations

import base64
import hashlib
import json
import re
from typing import Callable

PROJECT_ID = 'thebushido-co'
PROJECT_NUMBER = '911514101920'
READER = 'terraform-bootstrap@thebushido-co.iam.gserviceaccount.com'
ACCOUNT_URL = f'https://iam.googleapis.com/v1/projects/{PROJECT_ID}/serviceAccounts/{READER}'
CRM = 'https://cloudresourcemanager.googleapis.com/v3/'
POLICY_BODY = b'{"options":{"requestedPolicyVersion":3}}'
MAX_RESPONSE = 1024 * 1024
MAX_DEPTH = 32


class CoverageError(RuntimeError):
    pass


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False, allow_nan=False).encode('utf-8')


def digest(value):
    return hashlib.sha256(value).hexdigest()


def _pairs(items):
    result = {}
    for key, value in items:
        if key in result:
            raise CoverageError('COVERAGE_MALFORMED_JSON')
        result[key] = value
    return result

def _constant(_value):
    raise CoverageError('COVERAGE_MALFORMED_JSON')


def parse(raw):
    if not isinstance(raw, bytes) or len(raw) > MAX_RESPONSE:
        raise CoverageError('COVERAGE_RESPONSE_INVALID')
    try:
        value = json.loads(raw.decode('utf-8'), object_pairs_hook=_pairs, parse_constant=_constant)
    except (ValueError, UnicodeError, RecursionError) as exc:
        raise CoverageError('COVERAGE_MALFORMED_JSON') from exc
    if not isinstance(value, dict):
        raise CoverageError('COVERAGE_MALFORMED_JSON')
    return value


def classify(member, manifest):
    """Return candidate/disjoint; refuse unknown identities instead of guessing."""
    if not isinstance(member, str) or not member or '..' in member:
        raise CoverageError('COVERAGE_UNSUPPORTED')
    if member in ('allUsers', 'allAuthenticatedUsers') or member == manifest['member']:
        return 'candidate'
    # Deleted Google identities carry the sole permitted query suffix.
    label = r'[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?'
    domain = rf'(?:{label}\.)+{label}'
    email = rf'[A-Za-z0-9][A-Za-z0-9._+-]*@{domain}'
    if re.fullmatch(r'deleted:(?:user|serviceAccount|group):' + email + r'\?uid=[0-9]+', member):
        return 'disjoint'
    if any(c in member for c in '%?#\\'):
        raise CoverageError('COVERAGE_UNSUPPORTED')
    if re.fullmatch(r'(?:user|serviceAccount|group):' + email, member):
        return 'disjoint'
    if re.fullmatch(r'domain:' + domain, member):
        return 'disjoint'
    if re.fullmatch(r'serviceAccount:[a-z0-9-]+\.svc\.id\.goog\[[A-Za-z0-9._-]+/[A-Za-z0-9._-]+\]', member):
        return 'disjoint'
    prefix = r'(principal|principalSet)://iam\.googleapis\.com/projects/([0-9]+|-|\*)/locations/(global|-|\*)/workloadIdentityPools/([a-z0-9.-]+|-|\*)(?:/(.+))?'
    match = re.fullmatch(prefix, member)
    if match:
        kind, project, location, pool, selector = match.groups()
        if pool not in ('-', '*') and (pool.startswith('.') or pool.endswith('.') or '..' in pool):
            raise CoverageError('COVERAGE_UNSUPPORTED')
        if not selector or any(c in selector for c in '%?#\\'):
            if kind == 'principalSet' and selector is None:
                return 'candidate' if project in (PROJECT_NUMBER, '-', '*') and pool in (manifest['pool_id'], '-', '*') else 'disjoint'
            raise CoverageError('COVERAGE_UNSUPPORTED')
        if '*' in selector:
            if kind == 'principalSet' and (selector == '*' or re.fullmatch(r'(?:group|namespace|attribute\.[A-Za-z0-9_]+)/\*', selector)):
                return 'candidate' if project in (PROJECT_NUMBER, '-', '*') and pool in (manifest['pool_id'], '-', '*') else 'disjoint'
            raise CoverageError('COVERAGE_UNSUPPORTED')
        if kind == 'principal':
            if not ((selector.startswith('subject/') and selector[8:]) or
                    (pool.endswith('.svc.id.goog') and re.fullmatch(r'kubernetes\.serviceaccount\.uid/[A-Za-z0-9-]+', selector))):
                raise CoverageError('COVERAGE_UNSUPPORTED')
        elif not (re.fullmatch(r'(?:group/[^/]+|attribute\.[A-Za-z0-9_]+/.+|namespace/.+|subject/.+)', selector) or
                  (pool.endswith('.svc.id.goog') and re.fullmatch(
                      r'kubernetes\.cluster/https://container\.googleapis\.com/v1/projects/[a-z0-9-]+/locations/[a-z0-9-]+/clusters/[a-z0-9-]+', selector))):
            raise CoverageError('COVERAGE_UNSUPPORTED')
        if project not in (PROJECT_NUMBER, '-', '*') or location not in ('global', '-', '*'):
            return 'disjoint'
        if pool not in (manifest['pool_id'], '-', '*'):
            return 'disjoint'
        if kind == 'principal':
            return 'candidate' if project in ('-', '*') or location in ('-', '*') or pool in ('-', '*') else 'disjoint'
        return 'candidate'
    # Documented workforce, service-account-set and agent trust-domain members
    # are disjoint principal types, but only recognized canonical forms count.
    workforce = r'iam\.googleapis\.com/locations/global/workforcePools/[a-z0-9-]+'
    if re.fullmatch(r'(?:principal|deleted:principal)://' + workforce + r'/subject/[A-Za-z0-9._:@/-]+', member):
        return 'disjoint'
    if re.fullmatch(r'principalSet://' + workforce + r'/(?:\*|group/[A-Za-z0-9._:@-]+|attribute\.[A-Za-z0-9_]+/[A-Za-z0-9._:@/-]+)', member):
        return 'disjoint'
    if re.fullmatch(r'principalSet://cloudresourcemanager\.googleapis\.com/(?:projects|folders|organizations)/[0-9]+/type/ServiceAccount', member):
        return 'disjoint'
    agent = r'agents\.global\.(?:org|proj)-[0-9]+\.system\.id\.goog'
    if re.fullmatch(r'principal://' + agent + r'/resources/(?:aiplatform|discoveryengine)/[A-Za-z0-9._:/-]+', member):
        return 'disjoint'
    if re.fullmatch(r'principalSet://' + agent + r'/(?:\*|attribute\.platformContainer/(?:aiplatform|discoveryengine)/projects/[0-9]+)', member):
        return 'disjoint'
    raise CoverageError('COVERAGE_UNSUPPORTED')


def policy(value, target=False):
    if not isinstance(value, dict) or set(value) - {'version', 'etag', 'bindings', 'auditConfigs'}:
        raise CoverageError('COVERAGE_POLICY_INVALID')
    if ('version' in value and (type(value['version']) is not int or value['version'] not in (1, 3))) or \
            ('etag' in value and not isinstance(value['etag'], str)) or \
            ('auditConfigs' in value and not isinstance(value['auditConfigs'], list)):
        raise CoverageError('COVERAGE_POLICY_INVALID')
    if target and (not isinstance(value.get('etag'), str) or not value['etag']):
        raise CoverageError('COVERAGE_POLICY_MISSING_ETAG')
    bindings = value.get('bindings', [])
    if not isinstance(bindings, list):
        raise CoverageError('COVERAGE_POLICY_INVALID')
    for binding in bindings:
        if (not isinstance(binding, dict) or set(binding) - {'role', 'members', 'condition'} or
                not isinstance(binding.get('role'), str) or '_withcond_' in binding['role']):
            raise CoverageError('COVERAGE_POLICY_INVALID')
        if not re.fullmatch(r'(?:roles/[A-Za-z0-9._-]+|(?:projects|organizations)/[A-Za-z0-9._-]+/roles/[A-Za-z0-9._-]+)', binding['role']):
            raise CoverageError('COVERAGE_POLICY_INVALID')
        if not isinstance(binding.get('members'), list) or not binding['members']:
            raise CoverageError('COVERAGE_POLICY_INVALID')
        if 'condition' in binding:
            condition = binding['condition']
            if (value.get('version') != 3 or not isinstance(condition, dict) or
                    set(condition) - {'title', 'description', 'expression', 'location'} or
                    not isinstance(condition.get('expression'), str) or not isinstance(condition.get('title'), str) or
                    any(not isinstance(item, str) for item in condition.values())):
                raise CoverageError('COVERAGE_POLICY_INVALID')
    return value


def _read_one(fetch, method, url, body):
    raw = fetch(method, url, body)
    return parse(raw)


def _walk(fetch):
    sa = _read_one(fetch, 'GET', ACCOUNT_URL, b'')
    if (sa.get('email') != READER or sa.get('projectId') != PROJECT_ID or
            not isinstance(sa.get('uniqueId'), str) or not re.fullmatch(r'[0-9]+', sa['uniqueId'])):
        raise CoverageError('COVERAGE_TARGET_INVALID')
    target = policy(_read_one(fetch, 'POST', ACCOUNT_URL + ':getIamPolicy', POLICY_BODY), target=True)
    name = 'projects/' + PROJECT_NUMBER
    visited = set()
    hierarchy = []
    policies = [('serviceAccount', target)]
    for depth in range(MAX_DEPTH):
        if name in visited:
            raise CoverageError('COVERAGE_HIERARCHY_INVALID')
        visited.add(name)
        metadata = _read_one(fetch, 'GET', CRM + name, b'')
        if metadata.get('name') != name or metadata.get('state') != 'ACTIVE':
            raise CoverageError('COVERAGE_HIERARCHY_INVALID')
        if depth == 0 and (name != 'projects/' + PROJECT_NUMBER or metadata.get('projectId') != PROJECT_ID):
            raise CoverageError('COVERAGE_HIERARCHY_INVALID')
        if 'parent' in metadata and metadata['parent'] is None:
            raise CoverageError('COVERAGE_HIERARCHY_INVALID')
        parent = metadata.get('parent')
        if parent == '':
            parent = None
        kind = name.split('/', 1)[0]
        if kind == 'organizations' and parent is not None:
            raise CoverageError('COVERAGE_HIERARCHY_INVALID')
        if kind == 'folders' and not isinstance(parent, str):
            raise CoverageError('COVERAGE_HIERARCHY_INVALID')
        if parent is not None and (not isinstance(parent, str) or not re.fullmatch(r'(?:folders|organizations)/[0-9]+', parent)):
            raise CoverageError('COVERAGE_HIERARCHY_INVALID')
        hierarchy.append((name, parent, metadata['state']))
        policies.append((name, policy(_read_one(fetch, 'POST', CRM + name + ':getIamPolicy', POLICY_BODY))))
        if parent is None:
            return {'target_id': str(sa['uniqueId']), 'hierarchy': hierarchy, 'policies': policies}
        name = parent
    raise CoverageError('COVERAGE_HIERARCHY_TOO_DEEP')


def _check_candidates(walk, manifest, mode):
    expected_condition = {'title': 'han-bootstrap-sign-in',
        'description': f"han-bootstrap commit={manifest['C']} plan={manifest['H']} run={manifest['R']} attempt=1",
        'expression': f"request.time < timestamp('{manifest['T']}')"}
    candidates = []
    for owner, document in walk['policies']:
        for binding in document.get('bindings', []):
            for member in binding['members']:
                if classify(member, manifest) == 'candidate':
                    candidates.append((owner, binding, member))
    if mode in ('baseline', 'retired'):
        if candidates:
            raise CoverageError('COVERAGE_ALTERNATE_GRANT')
    elif mode == 'granted':
        if len(candidates) != 1:
            raise CoverageError('COVERAGE_ALTERNATE_GRANT')
        owner, binding, member = candidates[0]
        if (owner != 'serviceAccount' or member != manifest['member'] or
                binding.get('role') != 'roles/iam.workloadIdentityUser' or
                binding.get('members') != [manifest['member']] or binding.get('condition') != expected_condition):
            raise CoverageError('COVERAGE_ALTERNATE_GRANT')
    else:
        raise CoverageError('COVERAGE_MODE_INVALID')


def _record(method, url, request_body, raw):
    if not isinstance(raw, bytes) or len(raw) > MAX_RESPONSE:
        raise CoverageError('COVERAGE_RESPONSE_INVALID')
    return {'method': method, 'url': url, 'request_sha256': digest(request_body),
            'response_sha256': digest(raw), 'response_base64': base64.b64encode(raw).decode('ascii')}


def _replay(records):
    if not isinstance(records, list):
        raise CoverageError('COVERAGE_EVIDENCE_INVALID')
    offset = 0
    def fetch(method, url, body):
        nonlocal offset
        if offset >= len(records):
            raise CoverageError('COVERAGE_EVIDENCE_INVALID')
        item = records[offset]; offset += 1
        if not isinstance(item, dict) or set(item) != {'method', 'url', 'request_sha256', 'response_sha256', 'response_base64'}:
            raise CoverageError('COVERAGE_EVIDENCE_INVALID')
        if (item['method'], item['url'], item['request_sha256']) != (method, url, digest(body)):
            raise CoverageError('COVERAGE_EVIDENCE_INVALID')
        if (not isinstance(item['response_base64'], str) or
                len(item['response_base64']) > ((MAX_RESPONSE + 2) // 3) * 4 or
                not isinstance(item['response_sha256'], str) or
                not re.fullmatch(r'[0-9a-f]{64}', item['response_sha256'])):
            raise CoverageError('COVERAGE_EVIDENCE_INVALID')
        try:
            raw = base64.b64decode(item['response_base64'], validate=True)
        except (ValueError, TypeError) as exc:
            raise CoverageError('COVERAGE_EVIDENCE_INVALID') from exc
        if len(raw) > MAX_RESPONSE or digest(raw) != item['response_sha256']:
            raise CoverageError('COVERAGE_EVIDENCE_INVALID')
        return raw
    result = _walk(fetch)
    if offset != len(records):
        raise CoverageError('COVERAGE_EVIDENCE_INVALID')
    return result


def validate(snapshot, manifest, mode, reader):
    if (not isinstance(snapshot, dict) or set(snapshot) != {'version', 'reader', 'mode', 'manifest_sha256', 'passes'} or
            type(snapshot['version']) is not int or snapshot['version'] != 1 or
            reader != READER or snapshot['reader'] != reader or snapshot['mode'] != mode or
            snapshot['manifest_sha256'] != digest(canonical(manifest)) or
            not isinstance(snapshot['passes'], list) or len(snapshot['passes']) != 2):
        raise CoverageError('COVERAGE_EVIDENCE_INVALID')
    first, second = (_replay(records) for records in snapshot['passes'])
    if canonical(first) != canonical(second):
        raise CoverageError('COVERAGE_UNSTABLE')
    _check_candidates(first, manifest, mode)
    return snapshot


def collect(manifest, mode, backend):
    if mode not in ('baseline', 'granted', 'retired'):
        raise CoverageError('COVERAGE_MODE_INVALID')
    for _attempt in range(3):
        records = []
        for _pass in range(2):
            observations = []
            def fetch(method, url, body):
                try:
                    raw = backend(method, url, body, READER)
                except Exception as exc:
                    raise CoverageError('COVERAGE_READ_FAILED') from exc
                observations.append(_record(method, url, body, raw))
                return raw
            _walk(fetch)
            records.append(observations)
        snapshot = {'version': 1, 'reader': READER, 'mode': mode,
                    'manifest_sha256': digest(canonical(manifest)), 'passes': records}
        try:
            return validate(snapshot, manifest, mode, READER)
        except CoverageError as exc:
            if str(exc) != 'COVERAGE_UNSTABLE':
                raise
    raise CoverageError('COVERAGE_UNSTABLE')

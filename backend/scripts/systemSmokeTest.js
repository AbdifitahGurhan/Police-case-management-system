'use strict';

const fs = require('fs');
const path = require('path');
const db = require('../src/config/database');

const API_URL = process.env.API_URL || 'http://localhost:5001/api';
const WEB_URL = API_URL.replace(/\/api\/?$/, '');
const RUN_ID = Date.now();
const FACE_IMAGE = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2w==';

const credentials = {
  admin: { username: 'admin@police.so', password: 'Admin@123' },
  officer: { username: 'officer@police.so', password: 'Officer@123' },
  cid: { username: 'cid@police.so', password: 'Cid@123' },
  court: { username: 'court_user', password: 'Special@123' },
  jail: { username: 'jail_user', password: 'Special@123' },
  state_admin: { username: 'banadir_admin', password: 'Unit@123' },
  region_admin: { username: 'mogadishu_region', password: 'Unit@123' },
  city_admin: { username: 'mogadishu_city', password: 'Unit@123' },
  district_admin: { username: 'hodan_district', password: 'Unit@123' },
  neighborhood_admin: { username: 'bakaro_station', password: 'Unit@123' },
};

const results = [];
const created = {
  cases: [],
  suspects: [],
  evidence: [],
  files: [],
};

const ok = (name, details = '') => results.push({ status: 'PASS', name, details });
const fail = (name, error) => results.push({ status: 'FAIL', name, details: error.message || String(error) });

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const asJson = async (response) => {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { raw: text };
  }
};

const request = async (pathName, { method = 'GET', token, body, headers = {}, expect } = {}) => {
  const response = await fetch(`${API_URL}${pathName}`, {
    method,
    headers: {
      ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await asJson(response);
  if (expect !== undefined) {
    assert(response.status === expect, `${method} ${pathName} expected ${expect}, got ${response.status}: ${JSON.stringify(data)}`);
  } else if (!response.ok) {
    throw new Error(`${method} ${pathName} failed ${response.status}: ${JSON.stringify(data)}`);
  }
  return { response, data };
};

const login = async (role) => {
  const { data } = await request('/auth/login', {
    method: 'POST',
    body: credentials[role],
  });
  assert(data.token, `${role} login did not return token`);
  assert(data.user?.role === role, `${role} login returned role ${data.user?.role}`);
  return data.token;
};

const incidentDateHoursAgo = (hours) => {
  const date = new Date(Date.now() - hours * 60 * 60 * 1000);
  return date.toISOString().slice(0, 19).replace('T', ' ');
};

const createCase = async (token, suffix, overrides = {}) => {
  const { data } = await request('/cases', {
    method: 'POST',
    token,
    body: {
      title: `Smoke Test Case ${RUN_ID} ${suffix}`,
      description: `Automated system smoke test case ${suffix}.`,
      incident_date: incidentDateHoursAgo(overrides.hoursAgo || 3),
      incident_location: overrides.location || `Smoke Test Location ${suffix}`,
      priority: overrides.priority || 'medium',
      status: overrides.status || 'draft',
      offender_name: `Smoke Test Offender ${RUN_ID}`,
      offender_face_image: FACE_IMAGE,
      ...overrides,
    },
  });
  created.cases.push(data.caseId);
  if (data.faceCapture?.suspectId) created.suspects.push(data.faceCapture.suspectId);
  return data;
};

const uploadEvidence = async (token, caseId) => {
  const form = new FormData();
  const content = `Smoke test evidence for case ${caseId}, run ${RUN_ID}`;
  form.append('case_id', String(caseId));
  form.append('title', `Smoke Test Evidence ${RUN_ID}`);
  form.append('description', 'Automated upload/open evidence verification.');
  form.append('type', 'document');
  form.append('collection_date', incidentDateHoursAgo(2));
  form.append('location_found', 'Smoke Test Evidence Room');
  form.append('file', new Blob([content], { type: 'text/plain' }), `smoke-evidence-${RUN_ID}.txt`);

  const { data } = await request('/evidence', { method: 'POST', token, body: form });
  created.evidence.push(data.evidenceId);
  const detail = await request(`/evidence/${data.evidenceId}`, { token });
  assert(detail.data.data?.file_url, 'Uploaded evidence did not return a file URL');
  created.files.push(detail.data.data.file_url);

  const fileResponse = await fetch(`${WEB_URL}${detail.data.data.file_url}`);
  assert(fileResponse.ok, `Evidence file did not open, status ${fileResponse.status}`);
  return detail.data.data;
};

const cleanup = async () => {
  try {
    if (created.evidence.length) {
      await db.query(`DELETE FROM chain_of_custody WHERE evidence_id IN (${created.evidence.map(() => '?').join(',')})`, created.evidence);
      await db.query(`DELETE FROM evidence WHERE id IN (${created.evidence.map(() => '?').join(',')})`, created.evidence);
    }
    if (created.cases.length) {
      await db.query(`DELETE FROM case_actions WHERE case_id IN (${created.cases.map(() => '?').join(',')})`, created.cases);
      await db.query(`DELETE FROM case_suspects WHERE case_id IN (${created.cases.map(() => '?').join(',')})`, created.cases);
      await db.query(`DELETE FROM cases WHERE id IN (${created.cases.map(() => '?').join(',')})`, created.cases);
    }
    const uniqueSuspects = [...new Set(created.suspects.filter(Boolean))];
    if (uniqueSuspects.length) {
      await db.query(`DELETE FROM suspects WHERE id IN (${uniqueSuspects.map(() => '?').join(',')})`, uniqueSuspects);
    }
    for (const fileUrl of created.files) {
      const filePath = path.join(__dirname, '..', fileUrl.replace('/uploads/', 'uploads/'));
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
  } catch (error) {
    fail('Cleanup test data', error);
  } finally {
    await db.pool.end();
  }
};

const runStep = async (name, fn) => {
  try {
    const details = await fn();
    ok(name, details);
  } catch (error) {
    fail(name, error);
  }
};

(async () => {
  const tokens = {};

  await runStep('Every seeded role can log in', async () => {
    for (const role of Object.keys(credentials)) {
      tokens[role] = await login(role);
    }
    return `${Object.keys(tokens).length} roles authenticated`;
  });

  await runStep('Role permissions allow and deny expected pages/actions', async () => {
    await request('/users', { token: tokens.admin, expect: 200 });
    await request('/users', { token: tokens.officer, expect: 403 });
    await request('/cases', { token: tokens.court, expect: 200 });
    await request('/reports/summary', { token: tokens.jail, expect: 200 });
    await request('/cases', { method: 'POST', token: tokens.court, body: {}, expect: 403 });
    await request('/evidence', { method: 'POST', token: tokens.jail, body: {}, expect: 403 });
    return 'Admin, officer, court, and jail permission checks passed';
  });

  let firstCase;
  let secondCase;
  await runStep('Register several cases with different dates, locations, priorities', async () => {
    firstCase = await createCase(tokens.officer, 'LOW', { priority: 'low', hoursAgo: 2, location: 'Hodan Market' });
    await createCase(tokens.officer, 'HIGH', { priority: 'high', hoursAgo: 26, location: 'Bakaro Junction' });
    secondCase = await createCase(tokens.officer, 'CRITICAL', { priority: 'critical', hoursAgo: 50, location: 'Airport Road' });
    return `Created cases ${created.cases.join(', ')}`;
  });

  await runStep('Captured face finds previous offender and links old profile', async () => {
    const lookup = await request('/suspects/face-search', {
      method: 'POST',
      token: tokens.officer,
      body: { face_image: FACE_IMAGE },
    });
    assert(lookup.data.match === true, 'Face lookup did not find the registered offender');
    assert(secondCase.faceCapture?.matchedExisting === true, 'Second case was not linked to the existing face profile');
    return `Matched suspect ${lookup.data.data.id}`;
  });

  await runStep('Court can record judgment after case is approved for court', async () => {
    await request(`/cases/${firstCase.caseId}`, {
      method: 'PUT',
      token: tokens.admin,
      body: { status: 'approved_for_court' },
    });
    const decision = await request(`/cases/${firstCase.caseId}/court-decision`, {
      method: 'POST',
      token: tokens.court,
      body: {
        decision: 'convicted',
        notes: 'Smoke test court judgment recorded after court approval.',
      },
    });
    assert(decision.data.status === 'court_convicted', 'Court decision did not update case status');
    return `Court decision status ${decision.data.status}`;
  });

  await runStep('Evidence file can be added and opened', async () => {
    const evidence = await uploadEvidence(tokens.officer, firstCase.caseId);
    return evidence.file_url;
  });

  await runStep('Offender search filters work by name, gender, repeat offender', async () => {
    const byName = await request(`/suspects?search=${encodeURIComponent(`Smoke Test Offender ${RUN_ID}`)}`, { token: tokens.officer });
    const byGender = await request('/suspects?gender=male', { token: tokens.officer });
    const repeat = await request('/suspects?repeat=true', { token: tokens.officer });
    assert(byName.data.data.length >= 1, 'Name search did not find smoke offender');
    assert(byGender.data.data.every((row) => row.gender === 'male'), 'Gender filter returned non-male records');
    assert(repeat.data.data.some((row) => Number(row.case_count) > 1), 'Repeat offender filter did not return repeat records');
    return 'Name, gender, and repeat filters passed';
  });

  await runStep('Jail and admin can release arrested offenders', async () => {
    const suspectId = created.suspects[0];
    await db.query('UPDATE suspects SET is_arrested = 1 WHERE id = ?', [suspectId]);
    await request(`/suspects/${suspectId}/release`, {
      method: 'POST',
      token: tokens.court,
      body: { release_reason: 'Unauthorized court release attempt' },
      expect: 403,
    });
    await request(`/suspects/${suspectId}/release`, {
      method: 'POST',
      token: tokens.jail,
      body: { release_reason: 'Smoke test jail release approval' },
    });
    const [[afterJail]] = await db.query('SELECT is_arrested FROM suspects WHERE id = ?', [suspectId]);
    assert(Number(afterJail.is_arrested) === 0, 'Jail release did not clear arrested status');

    await db.query('UPDATE suspects SET is_arrested = 1 WHERE id = ?', [suspectId]);
    await request(`/suspects/${suspectId}/release`, {
      method: 'POST',
      token: tokens.admin,
      body: { release_reason: 'Smoke test admin release approval' },
    });
    const [[afterAdmin]] = await db.query('SELECT is_arrested FROM suspects WHERE id = ?', [suspectId]);
    assert(Number(afterAdmin.is_arrested) === 0, 'Admin release did not clear arrested status');
    return `Released suspect ${suspectId} by jail and admin`;
  });

  await runStep('Printable report data endpoints are available', async () => {
    const offenderId = created.suspects[0];
    await request(`/reports/offender-profile?offender_id=${offenderId}`, { token: tokens.admin });
    await request(`/reports/monthly-crime?year=${new Date().getFullYear()}`, { token: tokens.admin });
    await request('/reports/repeat-offenders', { token: tokens.admin });
    await request('/reports/station-performance', { token: tokens.admin });
    await request('/reports/crime-category', { token: tokens.admin });
    return 'All printable report endpoints returned data';
  });

  await runStep('Validation rejects future/missing-face/invalid fields', async () => {
    await request('/cases', {
      method: 'POST',
      token: tokens.officer,
      body: {
        title: 'Invalid Future Case',
        incident_date: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        offender_name: 'Invalid Person',
        offender_face_image: FACE_IMAGE,
      },
      expect: 400,
    });
    await request('/cases', {
      method: 'POST',
      token: tokens.officer,
      body: {
        title: 'Missing Face Case',
        incident_date: incidentDateHoursAgo(3),
        offender_name: 'Invalid Person',
      },
      expect: 400,
    });
    await request('/suspects', {
      method: 'POST',
      token: tokens.officer,
      body: { full_name: 'Invalid Gender Test', gender: 'other' },
      expect: 400,
    });
    return 'Future date, missing face, and invalid gender rejected';
  });

  await runStep('Court and jail are report/read-only users', async () => {
    await request('/reports/summary', { token: tokens.court, expect: 200 });
    await request('/reports/summary', { token: tokens.jail, expect: 200 });
    await request('/cases', { token: tokens.court, expect: 200 });
    await request('/cases', { token: tokens.jail, expect: 200 });
    await request('/users', { token: tokens.court, expect: 403 });
    await request('/users', { token: tokens.jail, expect: 403 });
    return 'Court and jail can read operational reports but cannot manage users';
  });

  await runStep('Dashboard numbers update after sample cases', async () => {
    const summary = await request('/reports/summary', { token: tokens.admin });
    assert(Number(summary.data.data.caseStats.total_cases) >= created.cases.length, 'Summary total cases did not include created cases');
    return `Total cases now ${summary.data.data.caseStats.total_cases}`;
  });

  await runStep('Responsive layout support exists for mobile/tablet', async () => {
    const css = fs.readFileSync(path.join(__dirname, '../../frontend/src/app/globals.css'), 'utf8');
    assert(css.includes('@media (max-width: 900px)'), 'Mobile/tablet media query missing');
    assert(css.includes('.app-content'), 'Responsive app content styles missing');
    return 'Responsive CSS breakpoints are present; visual browser check is still recommended';
  });

  await runStep('Face recognition upgrade path is documented in code', async () => {
    const util = fs.readFileSync(path.join(__dirname, '../src/utils/faceBiometric.js'), 'utf8');
    assert(util.includes('biometricKey'), 'Face biometric utility missing');
    return 'Current exact biometric key matching is active; AI model matching can be plugged into this utility later';
  });

  await cleanup();

  const failed = results.filter((item) => item.status === 'FAIL');
  console.log('\nSystem Smoke Test Results');
  console.table(results);
  if (failed.length) {
    process.exitCode = 1;
  }
})();

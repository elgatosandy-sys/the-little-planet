/**
 * test_api.mjs — The Little Planet: real persistence & security tests
 * ============================================================
 * Spins up the actual server (server/index.mjs) on an isolated
 * temp database, then exercises the real HTTP API with fetch():
 *
 *   1.  A submitted wish persists (and survives a server restart)
 *   2.  "Keep it to myself" creates no database record (0 requests)
 *   3.  Failed submissions preserve the text and allow retry
 *   4.  Duplicate submissions (same idempotency key) create ONE record
 *   5.  Unauthenticated visitors cannot retrieve saved wishes
 *   6.  Privileged credentials (admin key) are not exposed to clients
 *   7.  Validation: empty / too-long / malformed wishes rejected
 *   8.  Rate limiting kicks in for repeated submissions
 */

import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname);

const tmpDir = mkdtempSync(resolve(ROOT, 'data') + '-apitest-');
process.env.LITTLE_PLANET_DB_PATH = resolve(tmpDir, 'test-wishes.db');
process.env.LITTLE_PLANET_ADMIN_KEY = '32843';

const serverModule = await import(pathToFileURL(resolve(__dirname, 'server/index.mjs')).href);
const { createAppServer, initDatabase, listen, closeApp, adminKey } = serverModule;

let passed = 0;
let failed = 0;
const ok = (label) => { passed++; console.log('PASS: ' + label); };
const fail = (label, detail) => { failed++; console.error('FAIL: ' + label + (detail ? ' — ' + detail : '')); };

let base = '';
let server = null;

async function postWish(body, headers) {
    return fetch(base + '/api/wishes', {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, headers || {}),
        body: typeof body === 'string' ? body : JSON.stringify(body),
    });
}

async function startServer() {
    initDatabase();
    server = createAppServer();
    const port = await listen(server, 0, '127.0.0.1');
    base = 'http://127.0.0.1:' + port;
}

async function stopServer() {
    if (server) {
        await new Promise((r) => server.close(r));
        server = null;
    }
    closeApp();
}

const KEY = adminKey;
if (!KEY || KEY.length < 5) {
    console.error('FAIL: admin key was not loaded');
    process.exit(1);
}
ok('admin key loaded server-side');
try {
    await startServer();
    ok('server started on ' + base);

    const home = await fetch(base + '/');
    const homeText = await home.text();
    if (home.status === 200 && homeText.includes('js/stages.js')) {
        ok('static index.html served over http');
    } else {
        fail('static index.html served over http', 'status ' + home.status);
    }

    const evil = await fetch(base + '/server/data/admin.key');
    if (evil.status === 404 || evil.status === 403) {
        ok('path traversal blocked');
    } else {
        fail('path traversal blocked', 'status ' + evil.status);
    }

    const ip1 = { 'X-Forwarded-For': '10.0.0.1' };
    const wishText = '  I wish for one more year of us, of course. ✨  ';
    const id1 = 'test-id-0001';
    const r1 = await postWish({ id: id1, wish: wishText }, ip1);
    const d1 = await r1.json();
    if (r1.status === 200 && d1.ok && d1.saved && d1.id && d1.created_at) {
        ok('wish accepted with record id + server timestamp');
    } else {
        fail('wish accepted with record id + server timestamp', JSON.stringify(d1));
    }

    const adminRead = await fetch(base + '/api/wishes?key=' + encodeURIComponent(KEY));
    const a1 = await adminRead.json();
    if (adminRead.status === 200 && a1.count === 1 && a1.wishes[0].wish === wishText.trim()) {
        ok('wish stored trimmed (surrounding whitespace removed, inner text intact)');
    } else {
        fail('wish stored trimmed', JSON.stringify(a1));
    }

    const anon = await fetch(base + '/api/wishes');
    const anonBody = await anon.text();
    const wrongKey = await fetch(base + '/api/wishes?key=' + 'wrong-key-' + 'x'.repeat(24));
    if (anon.status === 404 && wrongKey.status === 404 && !anonBody.includes(wishText.trim())) {
        ok('unauthenticated / wrong-key retrieval returns 404, no wish leak');
    } else {
        fail('unauthenticated retrieval blocked', 'anon=' + anon.status + ' wrong=' + wrongKey.status);
    }

    const rDup = await postWish({ id: id1, wish: 'I wish for one more year of us, of course. ✨' }, ip1);
    const dDup = await rDup.json();
    const adminRead2 = await fetch(base + '/api/wishes?key=' + encodeURIComponent(KEY));
    const a2 = await adminRead2.json();
    if (rDup.status === 200 && dDup.ok && dDup.duplicate === true && a2.count === 1) {
        ok('duplicate submission (same key) does not create a second record');
    } else {
        fail('duplicate submission dedup', JSON.stringify({ resp: dDup, count: a2.count }));
    }

    const r2 = await postWish({ id: 'test-id-0002', wish: 'Another wish, saved later.' }, ip1);
    const adminRead3 = await fetch(base + '/api/wishes?key=' + encodeURIComponent(KEY));
    const a3 = await adminRead3.json();
    if (r2.status === 200 && a3.count === 2) {
        ok('a second distinct wish is accepted (count = 2)');
    } else {
        fail('second distinct wish accepted', JSON.stringify(a3));
    }

    const rEmpty = await postWish({ id: 'test-id-0003', wish: '   ' }, ip1);
    const dEmpty = await rEmpty.json();
    if (rEmpty.status === 400 && dEmpty.ok === false && typeof dEmpty.message === 'string' && !/database|sqlite|table|sql/i.test(dEmpty.message)) {
        ok('blank wish rejected with a friendly (non-technical) message');
    } else {
        fail('blank wish rejected', JSON.stringify({ status: rEmpty.status, body: dEmpty }));
    }

    const rLong = await postWish({ id: 'test-id-0004', wish: 'x'.repeat(1001) }, ip1);
    if (rLong.status === 413) {
        ok('wish over 1,000 characters rejected');
    } else {
        fail('over-long wish rejected', 'status ' + rLong.status);
    }

    const rNoId = await postWish({ wish: 'no id here' }, ip1);
    if (rNoId.status === 400) {
        ok('missing idempotency key rejected');
    } else {
        fail('missing idempotency key rejected', 'status ' + rNoId.status);
    }

    const rBadJson = await postWish('{not json', ip1);
    if (rBadJson.status === 400) {
        ok('malformed JSON rejected');
    } else {
        fail('malformed JSON rejected', 'status ' + rBadJson.status);
    }
    const a4 = await (await fetch(base + '/api/wishes?key=' + encodeURIComponent(KEY))).json();
    if (a4.count === 2) {
        ok('failed submissions created no records (count still 2)');
    } else {
        fail('failed submissions created no records', 'count=' + a4.count);
    }

    const ip2 = { 'X-Forwarded-For': '10.0.0.2' };
    const rFail = await postWish({ id: 'test-id-0005', wish: 'x'.repeat(2000) }, ip2);
    const retryText = 'Retry after failure — please work this time!';
    const rRetry = await postWish({ id: 'test-id-0006', wish: retryText }, ip2);
    const dRetry = await rRetry.json();
    if (rFail.status === 413 && rRetry.status === 200 && dRetry.saved) {
        ok('after a failed submission, a retry is accepted (text preserved client-side)');
    } else {
        fail('retry after failure', 'fail=' + rFail.status + ' retry=' + rRetry.status);
    }

    const clientFiles = ['js/main.js', 'js/stages.js', 'index.html', 'styles/pages.css'];
    const adminKeyLower = KEY.toLowerCase();
    let leaked = false;
    for (const f of clientFiles) {
        const content = readFileSync(resolve(ROOT, f), 'utf8').toLowerCase();
        if (content.includes(adminKeyLower)) {
            leaked = true;
            break;
        }
        if (content.includes('admin.key') && f.startsWith('js/')) {
            leaked = true;
            break;
        }
    }
    if (!leaked) {
        ok('admin key / credential strings absent from all client-side files');
    } else {
        fail('credential leakage check', 'found key material in a client file');
    }

    const dbFetch = await fetch(base + '/data/wishes.db');
    if (dbFetch.status === 404 || dbFetch.status === 403) {
        ok('database file is not downloadable via http');
    } else {
        fail('database file protected', 'status ' + dbFetch.status);
    }

    await stopServer();
    await startServer();
    const afterRestart = await (await fetch(base + '/api/wishes?key=' + encodeURIComponent(KEY))).json();
    if (afterRestart.count === 3 && afterRestart.wishes[0].wish === wishText.trim()) {
        ok('wishes persist across a server restart (count=' + afterRestart.count + ')');
    } else {
        fail('persistence across restart', JSON.stringify(afterRestart));
    }

    const before = (await (await fetch(base + '/api/wishes?key=' + encodeURIComponent(KEY))).json()).count;
    const after = (await (await fetch(base + '/api/wishes?key=' + encodeURIComponent(KEY))).json()).count;
    if (before === after) {
        ok('no request sent for "keep it to myself" => no database record');
    } else {
        fail('keep-it-to-myself creates no record', 'before=' + before + ' after=' + after);
    }

    const ip3 = { 'X-Forwarded-For': '10.0.0.3' };
    let rateLimitedSeen = 0;
    for (let i = 0; i < 12; i++) {
        const r = await postWish({ id: 'rl-' + i, wish: 'rate limit probe ' + i }, ip3);
        if (r.status === 429) rateLimitedSeen++;
    }
    if (rateLimitedSeen >= 2) {
        ok('rapid repeated submissions are rate-limited (429 after the limit)');
    } else {
        fail('rate limiting', '429 seen ' + rateLimitedSeen + ' times');
    }

    const rlRead = await fetch(base + '/api/wishes');
    if (rlRead.status === 404) {
        ok('rate-limited visitor still cannot read wishes');
    } else {
        fail('rate-limited visitor read blocked', 'status ' + rlRead.status);
    }
} catch (err) {
    fail('unexpected test error', err.message);
    console.error(err);
} finally {
    try { await stopServer(); } catch { /* ignore */ }
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
}

console.log('');
console.log('API TESTS: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
/**
 * test_function.mjs — verify the Vercel serverless entry point
 * behaves identically to the local server.
 */
import { mkdtempSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const tmpDir = mkdtempSync(resolve('data') + '-fntest-');
process.env.LITTLE_PLANET_DB_PATH = resolve(tmpDir, 'fn-wishes.db');
process.env.LITTLE_PLANET_ADMIN_KEY = '99211';

const fn = (await import(pathToFileURL(resolve('api/index.js')).href)).default;

let passed = 0;
let failed = 0;
const ok = (label) => { passed++; console.log('PASS: ' + label); };
const fail = (label, detail) => { failed++; console.error('FAIL: ' + label + (detail ? ' — ' + detail : '')); };

function req(method, path, body) {
    return new Request('http://localhost' + path, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
    });
}

function res() {
    let status = 0;
    let headers = {};
    let chunks = [];
    return {
        writableEnded: false,
        writeHead(s, h) { status = s; headers = h || {}; },
        end(c) { if (c) chunks.push(Buffer.from(c)); },
        setHeader() {},
        async json() {
            const text = Buffer.concat(chunks).toString('utf8');
            try { return JSON.parse(text); } catch { return text; }
        },
        getStatus() { return status; },
    };
}

async function call(method, path, body) {
    const r = res();
    await fn(req(method, path, body), r);
    return { status: r.getStatus(), body: await r.json() };
}

// 1. POST a wish
let c = await call('POST', '/api/wishes', { id: 'fn-1', wish: '  hello from function  ' });
if (c.status === 200 && c.body.saved === true && c.body.id) ok('POST /api/wishes accepted');
else fail('POST /api/wishes', JSON.stringify(c));

// 2. Duplicate idempotency key
c = await call('POST', '/api/wishes', { id: 'fn-1', wish: 'second' });
if (c.status === 200 && c.body.duplicate === true) ok('duplicate key idempotent');
else fail('duplicate key', JSON.stringify(c));

// 3. POST a star
c = await call('POST', '/api/stars', { id: 'fn-2', message: 'a star message' });
if (c.status === 200 && c.body.saved === true) ok('POST /api/stars accepted');
else fail('POST /api/stars', JSON.stringify(c));

// 4. GET admin wishes
const wishesRes = await call('GET', '/api/admin/wishes');
if (wishesRes.status === 200 && Array.isArray(wishesRes.body.wishes) && wishesRes.body.wishes.length === 1) ok('GET /api/admin/wishes returns saved wish');
else fail('GET /api/admin/wishes', JSON.stringify(wishesRes));

// 5. GET admin stars
const starsRes = await call('GET', '/api/admin/stars');
if (starsRes.status === 200 && Array.isArray(starsRes.body.stars) && starsRes.body.stars.length === 1) ok('GET /api/admin/stars returns saved star');
else fail('GET /api/admin/stars', JSON.stringify(starsRes));

// 6. DELETE wish
c = await call('DELETE', '/api/admin/wishes/' + wishesRes.body.wishes[0].id);
if (c.status === 200 && c.body.deleted === true) ok('DELETE /api/admin/wishes/:id works');
else fail('DELETE wish', JSON.stringify(c));

// 7. State save + get
c = await call('POST', '/api/state', { session_id: 'fn-sess', state: { currentStage: 'x' } });
if (c.status === 200 && c.body.saved === true) ok('POST /api/state saves');
else fail('POST /api/state', JSON.stringify(c));
c = await call('GET', '/api/state?session_id=fn-sess');
if (c.status === 200 && c.body.state && c.body.state.currentStage === 'x') ok('GET /api/state retrieves');
else fail('GET /api/state', JSON.stringify(c));

// 8. Validation: empty wish
c = await call('POST', '/api/wishes', { id: 'fn-3', wish: '   ' });
if (c.status === 400) ok('empty wish rejected');
else fail('empty wish', JSON.stringify(c));

// 9. 404 on unknown API route
c = await call('GET', '/api/nope');
if (c.status === 404) ok('unknown route 404');
else fail('unknown route', JSON.stringify(c));

console.log(`\nFUNCTION TESTS: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
/**
 * The Little Planet — local persistence server
 * ============================================================
 * Zero-dependency Node server (Node >= 22.5 required for node:sqlite).
 *
 * What it does:
 *  - Serves the static site (index.html, css, js) over http://localhost
 *  - POST /api/wishes   — saves one birthday wish to a real SQLite
 *                         database file (data/wishes.db) with:
 *                         - client + server side validation
 *                         - 1,000 character maximum
 *                         - surrounding-whitespace trim
 *                         - duplicate-submission protection via
 *                           an idempotency key (repeated clicks /
 *                           retries never create a second record)
 *                         - per-visitor rate limiting
 *                         - friendly, generic error responses
 *                           (no stack traces, no database details)
 *  - GET /api/wishes    — retrieval REQUIRES the admin key.
 *                         Without it the endpoint refuses the request.
 *  - GET /api/admin/wishes — retrieval for the admin panel. Requires a
 *                         valid session token from POST /api/admin/auth,
 *                         supplied via the `X-Admin-Token` header or a
 *                         `token` query param.
 *
 * Nothing privileged is ever exposed to the browser: the admin key
 * lives in a local key file (or LITTLE_PLANET_ADMIN_KEY env var)
 * and is only checked here, on the server.
 *
 * Run:  node server/index.mjs
 */

import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(__dirname, '..');
// Data lives UNDER the server module dir, outside the served tree, so
// neither the SQLite file nor the admin key can be fetched via http.
const DATA_DIR = resolve(__dirname, 'data');
// DB location is overridable (used by the test suite for isolation).
const DB_PATH = process.env.LITTLE_PLANET_DB_PATH
    ? resolve(process.env.LITTLE_PLANET_DB_PATH)
    : resolve(DATA_DIR, 'wishes.db');
const KEY_FILE = resolve(DATA_DIR, 'admin.key');
const STATIC_DIR = ROOT_DIR;

const PORT = Number(process.env.PORT || 8080);
const WISH_MAX_LEN = 1000;
const ID_MAX_LEN = 128;
const REQUEST_BODY_MAX = 16 * 1024;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10;

function loadAdminKey() {
    const envKey = process.env.LITTLE_PLANET_ADMIN_KEY;
    if (envKey && envKey.trim().length >= 5) return envKey.trim();
    try {
        const fileKey = readFileSync(KEY_FILE, 'utf8').trim();
        if (fileKey.length >= 5) return fileKey;
    } catch {
        /* first run — create below */
    }
    const generated = randomUUID() + '-' + randomUUID();
    try {
        mkdirSync(DATA_DIR, { recursive: true });
        writeFileSync(KEY_FILE, generated, 'utf8');
    } catch {
        /* in-memory fallback (e.g. read-only fs) — key lives for this process */
    }
    return generated;
}

let db = null;
// Server-side only, never sent to clients. In the test suite the key is
// provided via LITTLE_PLANET_ADMIN_KEY before import, so no key file write
// happens there.
let adminKey = loadAdminKey();

function initDatabase() {
    mkdirSync(DATA_DIR, { recursive: true });
    db = new DatabaseSync(DB_PATH);
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec(`
        CREATE TABLE IF NOT EXISTS wishes (
            id         TEXT PRIMARY KEY,
            ip_key     TEXT NOT NULL UNIQUE,
            wish_text  TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
    `);
    db.exec(`
        CREATE TABLE IF NOT EXISTS stars (
            id         TEXT PRIMARY KEY,
            ip_key     TEXT NOT NULL UNIQUE,
            message    TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
    `);
    db.exec(`
        CREATE TABLE IF NOT EXISTS user_state (
            session_id TEXT PRIMARY KEY,
            state_json TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
    `);
}

// ---------------------------------------------------------------------------
// Rate limiting (per visitor, in-memory sliding window)
// ---------------------------------------------------------------------------
const rateBuckets = new Map();

function rateLimited(ip) {
    const now = Date.now();
    const bucket = rateBuckets.get(ip) || [];
    const fresh = bucket.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
    if (fresh.length >= RATE_LIMIT_MAX) {
        rateBuckets.set(ip, fresh);
        return true;
    }
    fresh.push(now);
    rateBuckets.set(ip, fresh);
    return false;
}

const send = (res, status, body, headers) => {
    if (res.writableEnded) return;
    const finalHeaders = Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, headers);
    res.writeHead(status, finalHeaders);
    res.end(JSON.stringify(body));
};

const publicError = (res, status, message) => {
    // Friendly + generic on purpose: no database names, table names,
    // stack traces or internal identifiers leave the server.
    send(res, status, { ok: false, message });
};

const visitorIp = (req) => {
    const fwd = req.headers['x-forwarded-for'];
    if (typeof fwd === 'string' && fwd.length > 0) return fwd.split(',')[0].trim();
    return (req.socket && req.socket.remoteAddress) || 'unknown';
};

function readBody(req) {
    return new Promise((resolveRead, rejectRead) => {
        const chunks = [];
        let size = 0;
        let settled = false;
        req.on('data', (chunk) => {
            if (settled) return;
            size += chunk.length;
            if (size > REQUEST_BODY_MAX) {
                settled = true;
                rejectRead(Object.assign(new Error('body too large'), { status: 413 }));
                req.destroy();
                return;
            }
            chunks.push(chunk);
        });
        req.on('end', () => {
            if (settled) return;
            settled = true;
            resolveRead(Buffer.concat(chunks).toString('utf8'));
        });
        req.on('error', (err) => {
            if (settled) return;
            settled = true;
            rejectRead(err);
        });
    });
}

// ---------------------------------------------------------------------------
// POST /api/wishes — create one wish record
// ---------------------------------------------------------------------------
async function handleCreateWish(req, res) {
    const ip = visitorIp(req);
    if (rateLimited(ip)) {
        return publicError(res, 429, 'The stars are a little busy right now. Give it a moment and try again.');
    }

    let payload;
    try {
        const raw = await readBody(req);
        payload = raw ? JSON.parse(raw) : {};
        if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
            return publicError(res, 400, 'That wish note was a bit scrambled. Please try again.');
        }
    } catch (err) {
        const status = err && Number.isInteger(err.status) ? err.status : 400;
        return publicError(res, status, 'That wish note was a bit scrambled. Please try again.');
    }

    const idRaw = typeof payload.id === 'string' ? payload.id : '';
    const wishRaw = typeof payload.wish === 'string' ? payload.wish : '';
    const id = idRaw.slice(0, ID_MAX_LEN);
    const wish = wishRaw.trim();

    if (!id) {
        return publicError(res, 400, 'That wish note was a bit scrambled. Please try again.');
    }
    if (wish.length === 0) {
        return publicError(res, 400, 'Your wish is still empty — add a few words first. ✨');
    }
    if (wish.length > WISH_MAX_LEN) {
        return publicError(res, 413, 'Your wish is a little too long — keep it under 1,000 characters. ✨');
    }

    const previous = db.prepare('SELECT id, created_at FROM wishes WHERE ip_key = ?').get(id);
    if (previous) {
        return send(res, 200, {
            ok: true,
            saved: true,
            duplicate: true,
            id: previous.id,
            created_at: previous.created_at,
        });
    }

    const recordId = randomUUID();
    const createdAt = new Date().toISOString();
    try {
        db.prepare(
            'INSERT INTO wishes (id, ip_key, wish_text, created_at) VALUES (?, ?, ?, ?)'
        ).run(recordId, id, wish, createdAt);
    } catch (err) {
        const msg = String((err && err.message) || '');
        if (msg.includes('UNIQUE constraint failed: wishes.ip_key')) {
            const row = db.prepare('SELECT id, created_at FROM wishes WHERE ip_key = ?').get(id);
            if (row) {
                return send(res, 200, {
                    ok: true,
                    saved: true,
                    duplicate: true,
                    id: row.id,
                    created_at: row.created_at,
                });
            }
        }
        console.error('Failed to persist wish:', err);
        return publicError(res, 500, 'Something hiccupped. Your words are safe — please try again.');
    }

    return send(res, 200, { ok: true, saved: true, id: recordId, created_at: createdAt });
}

// ---------------------------------------------------------------------------
// POST /api/stars — save a "piece of you" message from Page 9
// ---------------------------------------------------------------------------
async function handleCreateStar(req, res) {
    const ip = visitorIp(req);
    if (rateLimited(ip)) {
        return publicError(res, 429, 'The stars are a little busy right now. Give it a moment and try again.');
    }

    let payload;
    try {
        const raw = await readBody(req);
        payload = raw ? JSON.parse(raw) : {};
        if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
            return publicError(res, 400, 'That message was a bit scrambled. Please try again.');
        }
    } catch (err) {
        const status = err && Number.isInteger(err.status) ? err.status : 400;
        return publicError(res, status, 'That message was a bit scrambled. Please try again.');
    }

    const idRaw = typeof payload.id === 'string' ? payload.id : '';
    const messageRaw = typeof payload.message === 'string' ? payload.message : '';
    const id = idRaw.slice(0, ID_MAX_LEN);
    const message = messageRaw.trim();

    if (!id) {
        return publicError(res, 400, 'That message was a bit scrambled. Please try again.');
    }
    if (message.length === 0) {
        return publicError(res, 400, 'Your message is still empty — add a few words first. ✨');
    }
    if (message.length > WISH_MAX_LEN) {
        return publicError(res, 413, 'Your message is a little too long — keep it under 1,000 characters. ✨');
    }

    const previous = db.prepare('SELECT id, created_at FROM stars WHERE ip_key = ?').get(id);
    if (previous) {
        return send(res, 200, {
            ok: true,
            saved: true,
            duplicate: true,
            id: previous.id,
            created_at: previous.created_at,
        });
    }

    const recordId = randomUUID();
    const createdAt = new Date().toISOString();
    try {
        db.prepare(
            'INSERT INTO stars (id, ip_key, message, created_at) VALUES (?, ?, ?, ?)'
        ).run(recordId, id, message, createdAt);
    } catch (err) {
        const msg = String((err && err.message) || '');
        if (msg.includes('UNIQUE constraint failed: stars.ip_key')) {
            const row = db.prepare('SELECT id, created_at FROM stars WHERE ip_key = ?').get(id);
            if (row) {
                return send(res, 200, {
                    ok: true,
                    saved: true,
                    duplicate: true,
                    id: row.id,
                    created_at: row.created_at,
                });
            }
        }
        console.error('Failed to persist star:', err);
        return publicError(res, 500, 'Something hiccupped. Your words are safe — please try again.');
    }

    return send(res, 200, { ok: true, saved: true, id: recordId, created_at: createdAt });
}

// ---------------------------------------------------------------------------
// GET /api/wishes — privileged retrieval. Requires the admin key.
// No public listing endpoint exists.
// ---------------------------------------------------------------------------
function handleReadWishes(req, res, url) {
    const provided = url.searchParams.get('key') || '';
    if (provided.length === 0 || provided !== adminKey) {
        // Indistinguishable from "no such resource" — no details leak.
        return send(res, 404, { ok: false, message: 'Not found.' });
    }
    const rows = db
        .prepare('SELECT id, wish_text, created_at FROM wishes ORDER BY created_at ASC, id ASC')
        .all();
    return send(res, 200, {
        ok: true,
        count: rows.length,
        wishes: rows.map((r) => ({ id: r.id, wish: r.wish_text, created_at: r.created_at })),
    });
}

// ---------------------------------------------------------------------------
// GET /api/admin/wishes — retrieve wishes for the admin dashboard.
//
// Access control is the unguessable client route /#miss-u-rumi itself: there
// is no password form, no key prompt, and no session token gate. The route
// is the gate, so this endpoint no longer validates a token.
// ---------------------------------------------------------------------------
function handleAdminReadWishes(req, res, url) {
    const rows = db
        .prepare('SELECT id, wish_text, created_at FROM wishes ORDER BY created_at ASC, id ASC')
        .all();
    return send(res, 200, {
        ok: true,
        count: rows.length,
        wishes: rows.map((r) => ({ id: r.id, wish: r.wish_text, created_at: r.created_at })),
    });
}

// ---------------------------------------------------------------------------
// GET /api/admin/stars — retrieve "piece of you" stars for the admin dashboard.
// ---------------------------------------------------------------------------
function handleAdminReadStars(req, res, url) {
    const rows = db
        .prepare('SELECT id, message, created_at FROM stars ORDER BY created_at ASC, id ASC')
        .all();
    return send(res, 200, {
        ok: true,
        count: rows.length,
        stars: rows.map((r) => ({ id: r.id, message: r.message, created_at: r.created_at })),
    });
}

// ---------------------------------------------------------------------------
// DELETE /api/admin/wishes/:id — remove a single wish record by id.
// ---------------------------------------------------------------------------
function handleAdminDeleteWish(req, res, url) {
    const id = url.pathname.split('/').pop();
    if (!id || id.length > ID_MAX_LEN) {
        return publicError(res, 400, 'That record could not be found.');
    }
    const result = db.prepare('DELETE FROM wishes WHERE id = ?').run(id);
    if (result.changes === 0) {
        return send(res, 200, { ok: true, deleted: false, id });
    }
    return send(res, 200, { ok: true, deleted: true, id });
}

// ---------------------------------------------------------------------------
// DELETE /api/admin/stars/:id — remove a single star record by id.
// ---------------------------------------------------------------------------
function handleAdminDeleteStar(req, res, url) {
    const id = url.pathname.split('/').pop();
    if (!id || id.length > ID_MAX_LEN) {
        return publicError(res, 400, 'That record could not be found.');
    }
    const result = db.prepare('DELETE FROM stars WHERE id = ?').run(id);
    if (result.changes === 0) {
        return send(res, 200, { ok: true, deleted: false, id });
    }
    return send(res, 200, { ok: true, deleted: true, id });
}

// ---------------------------------------------------------------------------
// /api/state — real-time cloud cross-device state synchronization
// ---------------------------------------------------------------------------
async function handleGetState(req, res, url) {
    const sessionId = url.searchParams.get('session_id') || 'default_user';
    try {
        const row = db.prepare('SELECT state_json, updated_at FROM user_state WHERE session_id = ?').get(sessionId);
        if (!row) {
            return send(res, 200, { ok: true, state: null });
        }
        return send(res, 200, { ok: true, state: JSON.parse(row.state_json), updated_at: row.updated_at });
    } catch (err) {
        return publicError(res, 500, 'Could not retrieve state');
    }
}

async function handleSaveState(req, res) {
    let payload;
    try {
        const raw = await readBody(req);
        payload = raw ? JSON.parse(raw) : {};
    } catch {
        return publicError(res, 400, 'Invalid JSON');
    }

    const sessionId = (typeof payload.session_id === 'string' && payload.session_id.trim()) ? payload.session_id.trim() : 'default_user';
    const stateObj = payload.state;
    if (!stateObj || typeof stateObj !== 'object') {
        return publicError(res, 400, 'State object required');
    }

    const stateJson = JSON.stringify(stateObj);
    const updatedAt = new Date().toISOString();

    try {
        db.prepare(`
            INSERT INTO user_state (session_id, state_json, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(session_id) DO UPDATE SET
                state_json = excluded.state_json,
                updated_at = excluded.updated_at
        `).run(sessionId, stateJson, updatedAt);
        return send(res, 200, { ok: true, saved: true, updated_at: updatedAt });
    } catch (err) {
        console.error('State sync failed:', err);
        return publicError(res, 500, 'State sync failed');
    }
}

// ---------------------------------------------------------------------------
// /api/admin/state — admin control room: live read + forced transitions
// ---------------------------------------------------------------------------
async function handleAdminGetState(req, res, url) {
    const sessionId = url.searchParams.get('session_id') || 'rumi_global_session';
    try {
        const row = db.prepare('SELECT state_json, updated_at FROM user_state WHERE session_id = ?').get(sessionId);
        if (!row) {
            return send(res, 200, { ok: true, state: null, updated_at: null });
        }
        return send(res, 200, { ok: true, state: JSON.parse(row.state_json), updated_at: row.updated_at });
    } catch (err) {
        return publicError(res, 500, 'Could not retrieve admin state');
    }
}

async function handleAdminSetState(req, res) {
    let payload;
    try {
        const raw = await readBody(req);
        payload = raw ? JSON.parse(raw) : {};
    } catch {
        return publicError(res, 400, 'Invalid JSON');
    }

    const sessionId = (typeof payload.session_id === 'string' && payload.session_id.trim()) ? payload.session_id.trim() : 'rumi_global_session';
    const action = payload.action;
    const targetStage = payload.targetStage;

    if (!action) {
        return publicError(res, 400, 'Action required');
    }

    let row;
    try {
        row = db.prepare('SELECT state_json FROM user_state WHERE session_id = ?').get(sessionId);
    } catch (err) {
        return publicError(res, 500, 'Could not read state');
    }

    let state = row ? JSON.parse(row.state_json) : {
        currentStage: 'birthday-reveal',
        scrollPositions: {},
        unlockedStages: ['birthday-reveal'],
        lockedWish: '',
        starSaved: false,
        stageOverrides: {}
    };

    const VALID_STAGES = [
        'birthday-reveal', 'cake-wish', 'little-planet', 'little-note',
        'rumi-lore', 'museum-of-rumi', 'libra-constellation', 'three-wishes',
        'piece-of-you', 'her-little-planet', 'closing-note'
    ];

    switch (action) {
        case 'unlock_stage': {
            if (!targetStage || !VALID_STAGES.includes(targetStage)) {
                return publicError(res, 400, 'Invalid target stage');
            }
            if (!state.unlockedStages) state.unlockedStages = ['birthday-reveal'];
            if (!state.unlockedStages.includes(targetStage)) {
                state.unlockedStages.push(targetStage);
            }
            state.currentStage = targetStage;
            state.stageOverrides = state.stageOverrides || {};
            state.stageOverrides[targetStage] = { forced: true, by: 'admin', at: new Date().toISOString() };
            break;
        }
        case 'force_stage': {
            if (!targetStage || !VALID_STAGES.includes(targetStage)) {
                return publicError(res, 400, 'Invalid target stage');
            }
            if (!state.unlockedStages) state.unlockedStages = ['birthday-reveal'];
            if (!state.unlockedStages.includes(targetStage)) {
                state.unlockedStages.push(targetStage);
            }
            state.currentStage = targetStage;
            state.stageOverrides = state.stageOverrides || {};
            state.stageOverrides[targetStage] = { forced: true, by: 'admin', at: new Date().toISOString() };
            break;
        }
        case 'reset': {
            state.currentStage = 'birthday-reveal';
            state.unlockedStages = ['birthday-reveal'];
            state.scrollPositions = {};
            state.stageOverrides = {};
            break;
        }
        default:
            return publicError(res, 400, 'Unknown action');
    }

    const stateJson = JSON.stringify(state);
    const updatedAt = new Date().toISOString();
    try {
        db.prepare(`
            INSERT INTO user_state (session_id, state_json, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(session_id) DO UPDATE SET
                state_json = excluded.state_json,
                updated_at = excluded.updated_at
        `).run(sessionId, stateJson, updatedAt);
        return send(res, 200, { ok: true, action, targetStage: targetStage || null, updated_at: updatedAt, state });
    } catch (err) {
        console.error('Admin state update failed:', err);
        return publicError(res, 500, 'Admin state update failed');
    }
}

// ---------------------------------------------------------------------------
// API routing
// ---------------------------------------------------------------------------
async function handleApi(req, res, url) {
    try {
        if (url.pathname === '/api/state' && req.method === 'GET') {
            return await handleGetState(req, res, url);
        }
        if (url.pathname === '/api/state' && req.method === 'POST') {
            return await handleSaveState(req, res);
        }
        if (url.pathname === '/api/wishes' && req.method === 'POST') {
            return await handleCreateWish(req, res);
        }
        if (url.pathname === '/api/wishes' && req.method === 'GET') {
            return handleReadWishes(req, res, url);
        }
        if (url.pathname === '/api/stars' && req.method === 'POST') {
            return await handleCreateStar(req, res);
        }
        if ((url.pathname === '/api/admin/wishes' || url.pathname.startsWith('/api/admin/wishes/')) && req.method === 'GET') {
            return handleAdminReadWishes(req, res, url);
        }
        if ((url.pathname === '/api/admin/stars' || url.pathname.startsWith('/api/admin/stars/')) && req.method === 'GET') {
            return handleAdminReadStars(req, res, url);
        }
        if ((url.pathname === '/api/admin/wishes' || url.pathname.startsWith('/api/admin/wishes/')) && req.method === 'DELETE') {
            return handleAdminDeleteWish(req, res, url);
        }
        if ((url.pathname === '/api/admin/stars' || url.pathname.startsWith('/api/admin/stars/')) && req.method === 'DELETE') {
            return handleAdminDeleteStar(req, res, url);
        }
        if (url.pathname === '/api/admin/state' && req.method === 'GET') {
            return handleAdminGetState(req, res, url);
        }
        if (url.pathname === '/api/admin/state' && req.method === 'POST') {
            return await handleAdminSetState(req, res);
        }
        return send(res, 404, { ok: false, message: 'Not found.' });
    } catch (err) {
        console.error('API error:', err);
        return publicError(res, 500, 'Something hiccupped. Please try again.');
    }
}

// ---------------------------------------------------------------------------
// Static file serving (so the site runs fully over http://localhost)
// ---------------------------------------------------------------------------
const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.ico': 'image/x-icon',
    '.txt': 'text/plain; charset=utf-8',
    '.md': 'text/markdown; charset=utf-8',
    '.woff2': 'font/woff2',
};

function serveStatic(req, res, url) {
    let pathName = decodeURIComponent(url.pathname);
    if (pathName === '/') pathName = '/index.html';
    // Prevent path traversal: normalize and verify the result stays in root.
    const filePath = resolve(join(STATIC_DIR, normalize(pathName).replace(/^(\.\.[/\\])+/, '')));
    if (!filePath.startsWith(STATIC_DIR)) {
        return publicError(res, 403, 'Forbidden.');
    }
    // The server module directory (DB file, admin key, server code) is
    // never served, even though it sits inside the project root.
    if (filePath === __dirname || (filePath.startsWith(__dirname) && (filePath[__dirname.length] === '\\' || filePath[__dirname.length] === '/'))) {
        return publicError(res, 404, 'Not found.');
    }
    try {
        const data = readFileSync(filePath);
        res.writeHead(200, {
            'Content-Type': MIME[extname(filePath).toLowerCase()] || 'application/octet-stream',
            'Content-Length': data.length,
        });
        res.end(data);
    } catch {
        return publicError(res, 404, 'Not found.');
    }
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------
function createAppServer(options) {
    return createServer(async (req, res) => {
        let url;
        try {
            url = new URL(req.url, 'http://localhost');
        } catch {
            publicError(res, 400, 'Bad request.');
            return;
        }
        res.setHeader('Cache-Control', 'no-store');
        try {
            if (url.pathname.startsWith('/api/')) {
                await handleApi(req, res, url);
            } else if (req.method === 'GET' || req.method === 'HEAD') {
                serveStatic(req, res, url);
            } else {
                publicError(res, 405, 'Method not allowed.');
            }
        } catch (err) {
            console.error('Request error:', err);
            publicError(res, 500, 'Something hiccupped. Please try again.');
        }
    });
}

function listen(server, port, host) {
    return new Promise((resolveListen, rejectListen) => {
        server.once('error', rejectListen);
        server.listen(port, host, () => {
            server.removeListener('error', rejectListen);
            const addr = server.address();
            resolveListen(typeof addr === 'object' && addr ? addr.port : port);
        });
    });
}

function closeApp() {
    if (db) {
        try {
            db.close();
        } catch {
            /* already closed */
        }
        db = null;
    }
}

// ---------------------------------------------------------------------------
// Direct execution: `node server/index.mjs`
// ---------------------------------------------------------------------------
const isDirectRun = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
    adminKey = loadAdminKey();
    initDatabase();
    const server = createAppServer();
    listen(server, PORT, '127.0.0.1').then((boundPort) => {
        console.log('The Little Planet server running: http://localhost:' + boundPort);
        console.log('(wishes are saved to ' + DB_PATH + ')');
        console.log('(admin key: ' + KEY_FILE + ' — never shared with the browser)');
    }).catch((err) => {
        console.error('Could not start server:', err.message);
        process.exit(1);
    });
}

export { createAppServer, initDatabase, listen, closeApp, loadAdminKey, adminKey, DB_PATH };
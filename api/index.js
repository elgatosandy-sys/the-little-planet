/**
 * Vercel serverless entry point.
 *
 * The static site is served from the project root, and this file is the
 * single function that powers every /api/* route. It reuses the exact
 * same request handlers as the local Node server (server/index.mjs) so the
 * live behaviour is identical to `npm start`.
 *
 * Vercel Node serverless functions pass (req, res) where req is Node's
 * http.IncomingMessage (or Express req) and res is http.ServerResponse.
 * Standard Web Request/Response objects may also be passed in testing.
 */

import { handleRequest, initDatabase } from '../server/index.mjs';

let initialized = false;

async function ensureInitialized() {
    if (initialized) return;
    await initDatabase();
    initialized = true;
}

export default async function handler(req, res) {
    try {
        await ensureInitialized();

        // If req is a Web Standard Request object (e.g. from fetch / Edge), convert headers/url/body.
        let incomingReq = req;
        if (typeof req.arrayBuffer === 'function' && !req.headers.distinct) {
            const rawBody = await req.text();
            const headersObj = {};
            if (req.headers && typeof req.headers.forEach === 'function') {
                req.headers.forEach((val, key) => { headersObj[key] = val; });
            }
            incomingReq = {
                method: req.method || 'GET',
                url: req.url || '/',
                headers: headersObj,
                body: rawBody,
                on(evt, cb) {
                    if (evt === 'data' && rawBody) cb(Buffer.from(rawBody));
                    if (evt === 'end') cb();
                    return this;
                },
                destroy() {},
            };
        }

        await handleRequest(incomingReq, res);
    } catch (err) {
        console.error('Function error:', err);
        if (!res.writableEnded) {
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ ok: false, message: 'Something hiccupped. Please try again.' }));
        }
    }
}
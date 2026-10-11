#!/usr/bin/env node
/*
 * PortfolioIQ demo server — zero dependencies (Node 18+).
 *
 *  - Serves the prototype from ./app
 *  - Exposes /api/llm: a thin gateway to the organisation's APPROVED LLM. The API key stays on the
 *    server; the browser only sends tool definitions + conversation and receives tool calls/text.
 *
 * Configure with environment variables (see docs/LLM_SETUP.md):
 *   LLM_PROVIDER   anthropic | openai   (unset = no LLM; the built-in governed engine answers)
 *   LLM_MODEL      model id             (anthropic default: claude-opus-5)
 *   LLM_BASE_URL   gateway base URL     (anthropic default: https://api.anthropic.com;
 *                                        openai-compatible: e.g. https://<gateway>/v1)
 *   ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN   credentials for provider=anthropic
 *   LLM_API_KEY    credential for provider=openai-compatible gateways
 *   LLM_AUTH_HEADER  header name for LLM_API_KEY (default Authorization: Bearer; e.g. "api-key" for Azure)
 *   PORT (default 8080), HOST (default 127.0.0.1)
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, 'app');
const PORT = +process.env.PORT || 8080;
const HOST = process.env.HOST || '127.0.0.1';
const PROVIDER = (process.env.LLM_PROVIDER || '').toLowerCase();
const MODEL = process.env.LLM_MODEL || (PROVIDER === 'anthropic' ? 'claude-opus-5' : '');
const BASE = (process.env.LLM_BASE_URL || (PROVIDER === 'anthropic' ? 'https://api.anthropic.com' : '')).replace(/\/$/, '');

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.csv': 'text/csv', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };

function configured() {
  if (PROVIDER === 'anthropic') return !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
  if (PROVIDER === 'openai') return !!(BASE && MODEL);
  return false;
}

// ---------- provider: Claude (Messages API, raw HTTP to keep the server dependency-free) ----------
async function callAnthropic(body) {
  const headers = { 'content-type': 'application/json', 'anthropic-version': '2023-06-01' };
  if (process.env.ANTHROPIC_API_KEY) headers['x-api-key'] = process.env.ANTHROPIC_API_KEY;
  else headers.authorization = 'Bearer ' + process.env.ANTHROPIC_AUTH_TOKEN;
  const req = {
    model: MODEL,
    max_tokens: Math.min(+body.max_tokens || 16000, 16000),
    system: body.system,
    messages: body.messages,
    tools: body.tools,
    output_config: { effort: process.env.LLM_EFFORT || 'medium' }
  };
  // Server-side refusal fallback: only on the first-party API (gateways/clouds may not support it)
  const fallbacks = process.env.LLM_FALLBACKS || (BASE === 'https://api.anthropic.com' ? 'default' : 'off');
  if (fallbacks === 'default') { req.fallbacks = 'default'; headers['anthropic-beta'] = 'server-side-fallback-2026-07-01'; }
  const r = await fetch(BASE + '/v1/messages', { method: 'POST', headers, body: JSON.stringify(req) });
  const j = await r.json();
  if (!r.ok) throw new Error('Upstream ' + r.status + ': ' + JSON.stringify(j).slice(0, 300));
  return { content: j.content || [], stop_reason: j.stop_reason };
}

// ---------- provider: OpenAI-compatible chat completions (e.g. an enterprise gateway) ----------
function toOpenAI(body) {
  const msgs = [{ role: 'system', content: body.system }];
  body.messages.forEach((m) => {
    if (typeof m.content === 'string') { msgs.push({ role: m.role, content: m.content }); return; }
    if (m.role === 'assistant') {
      const text = m.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
      const calls = m.content.filter((b) => b.type === 'tool_use').map((b) => ({ id: b.id, type: 'function', function: { name: b.name, arguments: JSON.stringify(b.input || {}) } }));
      msgs.push(Object.assign({ role: 'assistant', content: text || null }, calls.length ? { tool_calls: calls } : {}));
    } else {
      m.content.forEach((b) => {
        if (b.type === 'tool_result') msgs.push({ role: 'tool', tool_call_id: b.tool_use_id, content: typeof b.content === 'string' ? b.content : JSON.stringify(b.content) });
        else if (b.type === 'text') msgs.push({ role: 'user', content: b.text });
      });
    }
  });
  return {
    model: MODEL, messages: msgs,
    tools: body.tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.input_schema } }))
  };
}
async function callOpenAI(body) {
  const headers = { 'content-type': 'application/json' };
  if (process.env.LLM_API_KEY) {
    const hn = process.env.LLM_AUTH_HEADER || 'authorization';
    headers[hn.toLowerCase()] = hn.toLowerCase() === 'authorization' ? 'Bearer ' + process.env.LLM_API_KEY : process.env.LLM_API_KEY;
  }
  const r = await fetch(BASE + '/chat/completions', { method: 'POST', headers, body: JSON.stringify(toOpenAI(body)) });
  const j = await r.json();
  if (!r.ok) throw new Error('Upstream ' + r.status + ': ' + JSON.stringify(j).slice(0, 300));
  const msg = (j.choices && j.choices[0] && j.choices[0].message) || {};
  const content = [];
  if (msg.content) content.push({ type: 'text', text: msg.content });
  (msg.tool_calls || []).forEach((c) => {
    let input = {};
    try { input = JSON.parse(c.function.arguments || '{}'); } catch (e) { input = {}; }
    content.push({ type: 'tool_use', id: c.id, name: c.function.name, input });
  });
  return { content, stop_reason: (msg.tool_calls || []).length ? 'tool_use' : 'end_turn' };
}

function send(res, code, obj, type) {
  res.writeHead(code, { 'content-type': type || 'application/json', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
  res.end(typeof obj === 'string' || Buffer.isBuffer(obj) ? obj : JSON.stringify(obj));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api/llm/status') {
    return send(res, 200, configured() ? { ok: true, label: MODEL || PROVIDER, provider: PROVIDER } : { ok: false });
  }
  if (url.pathname === '/api/llm' && req.method === 'POST') {
    if (!configured()) return send(res, 503, { error: 'No approved LLM configured' });
    let raw = '';
    for await (const chunk of req) { raw += chunk; if (raw.length > 1e6) return send(res, 413, { error: 'Too large' }); }
    try {
      const body = JSON.parse(raw);
      if (!Array.isArray(body.messages) || !Array.isArray(body.tools)) return send(res, 400, { error: 'Bad request' });
      const out = PROVIDER === 'anthropic' ? await callAnthropic(body) : await callOpenAI(body);
      return send(res, 200, out);
    } catch (e) {
      console.error('[llm]', e.message);
      return send(res, 502, { error: e.message });
    }
  }
  // static files
  let p = decodeURIComponent(url.pathname);
  if (p === '/') p = '/index.html';
  const file = path.normalize(path.join(ROOT, p));
  if (!file.startsWith(ROOT + path.sep)) return send(res, 403, 'Forbidden', 'text/plain');
  fs.readFile(file, (err, data) => {
    if (err) return send(res, 404, 'Not found', 'text/plain');
    send(res, 200, data, TYPES[path.extname(file)] || 'application/octet-stream');
  });
});

server.listen(PORT, HOST, () => {
  console.log(`PortfolioIQ running at http://${HOST}:${PORT}`);
  console.log(configured() ? `AI Analyst: approved LLM via ${PROVIDER} (${MODEL || 'default model'})` : 'AI Analyst: built-in governed engine (no LLM configured — see docs/LLM_SETUP.md)');
});

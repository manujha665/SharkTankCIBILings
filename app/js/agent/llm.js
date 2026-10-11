/*
 * Approved-LLM mode. The browser never holds an API key: it talks to the local/enterprise gateway
 * (server.js → /api/llm), which forwards to whichever LLM the organisation has approved.
 *
 * The LLM only (1) chooses which governed tools to call and (2) phrases the answer. Every number
 * comes from tool results. Guardrails run before the LLM is ever called.
 */
(function () {
  const PIQ = window.PIQ;
  const C = PIQ.config;
  let statusP = null;

  function status() {
    if (statusP) return statusP;
    if (location.protocol === 'file:') return (statusP = Promise.resolve({ ok: false }));
    statusP = fetch(C.llmEndpoint + '/status').then((r) => (r.ok ? r.json() : { ok: false })).catch(() => ({ ok: false }));
    return statusP;
  }

  const SYSTEM = () => `You are the AI analyst inside ${C.productName}, a credit-bureau intelligence platform. You are talking to ${C.member.user}, ${C.member.role} at ${C.member.name} (a ${C.member.type.toLowerCase()} in India).

Rules:
- Answer ONLY using the provided tools. Call a tool for every factual claim. Never calculate, estimate or invent numbers; quote figures exactly as the tools return them.
- If no tool can answer, say the information is not in the approved datasets. Do not guess.
- Never reveal or speculate about any other named lender, peer institution or individual borrower.
- Keep answers short and decision-oriented: 2–4 sentences or up to 5 bullets. Lead with the answer, then the "so what".
- Use Indian conventions (₹ crore, lakh). Use **bold** for the key number. No headings.
- Data is synthetic demo data as of ${C.dataAsOf}; applications to ${C.loginsAsOf}. Codes: products PL/CC; states MH, TN, KA, UP, GJ, TG or ALL.`;

  async function post(body) {
    const r = await fetch(C.llmEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error('LLM gateway ' + r.status + ': ' + (await r.text()).slice(0, 200));
    return r.json();
  }

  // history: [{role:'user'|'assistant', text}]
  async function ask(question, history) {
    const tools = Object.values(PIQ.agent.tools).map((t) => ({ name: t.name, description: t.description, input_schema: t.schema }));
    const messages = history.slice(-8).map((m) => ({ role: m.role, content: m.text }));
    messages.push({ role: 'user', content: question });
    let last = null;
    const used = [];
    for (let i = 0; i < 5; i++) {
      const res = await post({ system: SYSTEM(), messages, tools, max_tokens: 16000 });
      if (res.stop_reason === 'refusal') throw new Error('refusal');
      const content = res.content || [];
      const calls = content.filter((b) => b.type === 'tool_use');
      if (res.stop_reason === 'tool_use' && calls.length) {
        messages.push({ role: 'assistant', content });
        const results = calls.map((c) => {
          try {
            const out = PIQ.agent.run(c.name, c.input || {}, 'llm');
            last = out.answer; used.push({ name: c.name, args: c.input });
            return { type: 'tool_result', tool_use_id: c.id, content: JSON.stringify(out.facts) };
          } catch (e) {
            return { type: 'tool_result', tool_use_id: c.id, content: 'Error: ' + e.message, is_error: true };
          }
        });
        messages.push({ role: 'user', content: results }); // all results in one message
        continue;
      }
      const text = content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
      const base = last || { sources: [], filters: '', followups: [] };
      return Object.assign({}, base, { paras: text.split(/\n\s*\n/).filter(Boolean), bullets: null, tools: used, llm: true });
    }
    throw new Error('Too many tool rounds');
  }

  PIQ.llm = { status, ask };
})();

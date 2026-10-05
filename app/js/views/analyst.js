/* AI Analyst — chat UI (full page + drawer share one conversation). */
(function () {
  const PIQ = window.PIQ;
  const { h, pageHead } = PIQ.ui;
  const C = PIQ.config;
  const convo = []; // {role, q?} | {role:'bot', a}
  const history = []; // text history for the LLM
  const mounts = [];

  // Safe inline formatting: **bold** only; everything else is text
  function rich(parent, text, tag) {
    const el = h(tag || 'p', null, parent);
    String(text).split(/(\*\*[^*]+\*\*)/g).forEach((part) => {
      if (/^\*\*[^*]+\*\*$/.test(part)) h('strong', null, el, part.slice(2, -2));
      else if (part) el.appendChild(document.createTextNode(part));
    });
    return el;
  }

  function renderBot(log, a) {
    const wrap = h('div', 'msg bot', log);
    const b = h('div', 'bot-bubble' + (a.refusal ? ' refusal' : ''), wrap);
    (a.paras || []).forEach((p) => {
      const lines = p.split('\n');
      if (lines.every((l) => /^\s*([-•*]|\d+\.)\s+/.test(l))) {
        const ul = h('ul', null, b);
        lines.forEach((l) => rich(ul, l.replace(/^\s*([-•*]|\d+\.)\s+/, ''), 'li'));
      } else rich(b, p);
    });
    if (a.bullets && a.bullets.length) { const ul = h('ul', null, b); a.bullets.forEach((x) => rich(ul, x, 'li')); }
    if (a.chart) { const v = h('div', 'viz', b); v.style.marginTop = '8px'; try { a.chart(v); } catch (e) { v.textContent = ''; } }
    const meta = h('div', 'bot-meta', wrap);
    if (a.sources && a.sources.length) { const s = h('span', 'src-chip', meta); h('b', null, s, '⛁ Source: '); s.appendChild(document.createTextNode(a.sources.join(' + '))); }
    if (a.filters) { const s = h('span', 'src-chip', meta); h('b', null, s, 'Filters: '); s.appendChild(document.createTextNode(a.filters)); }
    if (a.tools && a.tools.length) { const s = h('span', 'src-chip', meta); h('b', null, s, 'Tools: '); s.appendChild(document.createTextNode(a.tools.map((t) => t.name).join(', '))); s.title = a.tools.map((t) => t.name + ' ' + JSON.stringify(t.args)).join('\n'); }
    if (a.refusal) { const s = h('span', 'src-chip', meta); h('b', null, s, '🔐 Guardrail applied'); }
    if (a.llm) { const s = h('span', 'src-chip', meta); s.textContent = '✦ phrased by approved LLM · numbers from governed tools'; }
    const fu = h('div', 'follow', wrap);
    if (a.link) { const bt = h('button', 'chip', fu, '↗ Open in dashboard'); bt.addEventListener('click', () => { document.getElementById('drawer').classList.remove('open'); PIQ.go(a.link.view, a.link.params); }); }
    (a.actions || []).forEach((x) => { const bt = h('button', 'chip', fu, '↗ ' + x.label); bt.addEventListener('click', () => { document.getElementById('drawer').classList.remove('open'); PIQ.go(x.view, x.params); }); });
    if (!a.refusal && (a.paras || []).length) { const pb = h('button', 'chip', fu, '📌 Save to actions'); pb.addEventListener('click', () => { const clean = (x) => String(x).replace(/\*\*/g, '').replace(/^\d+\.\s*/, ''); const lead = clean((a.paras || [])[0] || ''); const title = /:\s*$/.test(lead) && a.bullets && a.bullets.length ? clean(a.bullets[0]).split(/(?<=\.)\s/)[0] : lead.split(/(?<=[.!?])\s/)[0]; PIQ.actions.add(title, (a.paras || []).concat(a.bullets || []).map(clean).join(' ')); }); }
    (a.followups || []).forEach((q) => { const bt = h('button', 'chip', fu, q); bt.addEventListener('click', () => ask(q)); });
  }

  function renderAll() {
    for (let i = mounts.length - 1; i >= 0; i--) if (!mounts[i].log.isConnected && !mounts[i].compact) mounts.splice(i, 1);
    mounts.forEach((m) => {
      if (!m.log.isConnected) return;
      m.log.innerHTML = '';
      if (!convo.length) welcome(m.log);
      convo.forEach((x) => {
        if (x.role === 'user') h('div', 'msg user', m.log, x.q);
        else if (x.role === 'typing') { const w = h('div', 'msg bot', m.log); const b = h('div', 'bot-bubble', w); const t = h('span', 'typing', b); h('i', null, t); h('i', null, t); h('i', null, t); h('span', 'muted small', b, '  querying governed datasets…'); }
        else renderBot(m.log, x.a);
      });
      m.log.scrollTop = m.log.scrollHeight;
      if (m.ctx) {
        const c = PIQ.agent.ctx;
        m.ctx.innerHTML = '';
        h('span', null, m.ctx, 'Context:');
        [PIQ.ui.prodName(c.product), PIQ.ui.stateName(c.state), PIQ.sem.METRICS[c.metric].short].forEach((x) => h('span', 'tag', m.ctx, x));
        h('span', 'muted', m.ctx, '· follow-ups keep this context');
      }
    });
  }
  function welcome(log) {
    const w = h('div', 'msg bot', log);
    const b = h('div', 'bot-bubble', w);
    rich(b, `Hi ${C.member.user.split(' ')[0]}, I'm your ${C.productName} analyst. Ask me anything about the market, your portfolio, peers, applications or "what if" policies. Every number I give you comes from the approved datasets, with its source shown.`);
    const fu = h('div', 'follow', w);
    ['What should I worry about this week?', 'What is happening in personal loans?', 'Why did my personal loan delinquency go up?', 'Show me HDFC\'s delinquency'].forEach((q) => { const bt = h('button', 'chip', fu, q); bt.addEventListener('click', () => ask(q)); });
  }

  let busy = false;
  async function ask(q) {
    q = String(q || '').trim();
    if (!q || busy) return;
    busy = true;
    convo.push({ role: 'user', q });
    convo.push({ role: 'typing' });
    renderAll();
    let result;
    const g = PIQ.agent.guard(q);
    const st = await PIQ.llm.status();
    await new Promise((r) => setTimeout(r, g ? 250 : 450));
    try {
      if (!g && st.ok) result = await PIQ.llm.ask(q, history);
    } catch (e) {
      console.warn('LLM unavailable, using governed engine:', e.message);
    }
    if (!result) result = PIQ.agent.answer(q).answer;
    convo.pop();
    convo.push({ role: 'bot', a: result });
    history.push({ role: 'user', text: q }, { role: 'assistant', text: (result.paras || []).concat(result.bullets || []).join('\n').replace(/\*\*/g, '') || '(chart)' });
    busy = false;
    renderAll();
  }

  // Voice input: the browser's speech recognition fills the text box, then asks once the user stops talking.
  // Typing still works; the mic is a second way in. Chrome / Edge / Safari support it; Firefox doesn't.
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let activeRec = null;
  function voiceButton(form, inp) {
    const mic = h('button', 'btn mic', form, '🎤');
    mic.type = 'button';
    mic.title = 'Speak your question';
    mic.setAttribute('aria-label', 'Speak your question');
    const toast = (m) => (PIQ.actions && PIQ.actions.toast ? PIQ.actions.toast(m, true) : alert(m));
    const placeholder = inp.placeholder;
    const reset = () => { mic.classList.remove('on'); mic.textContent = '🎤'; mic.title = 'Speak your question'; inp.placeholder = placeholder; activeRec = null; };
    mic.addEventListener('click', () => {
      if (!SR) { toast('Voice input needs Chrome, Edge or Safari. You can keep typing your question.'); return; }
      if (activeRec) { activeRec.stop(); return; }
      const rec = new SR();
      rec.lang = 'en-IN';
      rec.interimResults = true;
      rec.continuous = false;
      rec.maxAlternatives = 1;
      let finalText = '', failed = false;
      rec.onresult = (e) => {
        let interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) finalText += e.results[i][0].transcript;
          else interim += e.results[i][0].transcript;
        }
        inp.value = (finalText + interim).trim();
      };
      rec.onerror = (e) => {
        failed = true;
        const msg = {
          'not-allowed': 'Microphone access is blocked. Allow the microphone for this site in your browser settings.',
          'service-not-allowed': 'Voice input isn\'t available on this page. Open the app over https or localhost.',
          'no-speech': 'Didn\'t catch that. Tap 🎤 and try again.',
          'audio-capture': 'No microphone found.',
          network: 'Voice recognition needs an internet connection in this browser.'
        }[e.error] || 'Voice input stopped (' + e.error + ').';
        toast(msg);
      };
      rec.onend = () => {
        reset();
        const q = finalText.trim() || inp.value.trim();
        if (!failed && q) { inp.value = ''; ask(q); }
      };
      try { rec.start(); } catch (err) { toast('Couldn\'t start voice input: ' + err.message); return; }
      activeRec = rec;
      mic.classList.add('on');
      mic.textContent = '■';
      mic.title = 'Stop listening';
      inp.value = '';
      inp.placeholder = 'Listening… speak your question';
      if (PIQ.sem) PIQ.sem.log('voice.input', {});
    });
    return mic;
  }

  function mount(container, opts) {
    const main = h('div', 'chat-main', container);
    main.style.flex = '1';
    const ctx = h('div', 'context-bar', main);
    const log = h('div', 'chat-log', main);
    const form = h('form', 'chat-input', main);
    const inp = h('input', null, form);
    inp.placeholder = 'Ask about the market, your portfolio, peers, applications…';
    inp.setAttribute('aria-label', 'Ask a question');
    voiceButton(form, inp);
    const send = h('button', 'btn primary', form, 'Ask');
    send.type = 'submit';
    form.addEventListener('submit', (e) => { e.preventDefault(); const q = inp.value; inp.value = ''; ask(q); });
    mounts.push({ log, ctx, inp, compact: opts && opts.compact });
    renderAll();
    return inp;
  }

  function render(root) {
    pageHead(root, 'AI Analyst', 'Ask in plain English. The analyst picks the right governed tools, shows its sources, and remembers context for follow-ups like "compare that with Gujarat" or "now compare it with my portfolio".');
    const wrap = h('div', 'chat', root);
    const left = h('div', null, wrap);
    left.style.cssText = 'display:flex;min-height:0';
    const inp = mount(left, {});
    const side = h('div', 'chat-side', wrap);
    const total = PIQ.questions.reduce((a, c) => a + c.qs.length, 0);
    const hd = h('div', null, side);
    h('strong', null, hd, 'Question library');
    h('div', 'small muted', hd, `${total} ready-made questions · click to ask`);
    PIQ.questions.forEach((cat, i) => {
      const d = h('details', 'qcat', side);
      if (i < 2) d.open = true;
      const s = h('summary', null, d);
      h('h4', null, s, cat.cat).style.display = 'inline';
      cat.qs.forEach((q) => { const b = h('button', 'chip', d, q); b.addEventListener('click', () => ask(q)); });
    });
    setTimeout(() => inp.focus(), 50);
  }

  PIQ.chatUI = { mount, ask };
  PIQ.views.analyst = { title: 'AI Analyst', render };
})();

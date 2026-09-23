// Shared UI building blocks: DOM helper, tutor stepper, grid view, image view, plots, sample images.
const UI = (() => {
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) if (kid !== null && kid !== undefined && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(kid));
    return el;
  }
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const tok = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const col = c => (c && c.startsWith('--') ? tok(c) : c);
  const fmt = (v, d = 2) => (v === null || v === undefined ? '-' : typeof v === 'number' ? (Number.isInteger(v) ? String(v) : v.toFixed(d)) : String(v));

  const pending = [];
  function typeset(el) {
    if (window.MathJax && MathJax.typesetPromise && MathJax.startup && MathJax.startup.document) MathJax.typesetPromise([el]).catch(() => {});
    else pending.push(el);
  }
  function flushMath() { pending.splice(0).forEach(typeset); }

  // ---------- small controls ----------
  function slider({ label, min, max, step = 1, value, fmt: f = v => v, oninput, id }) {
    const out = h('output', {}, f(value));
    const inp = h('input', { type: 'range', min, max, step, value, id, 'aria-label': label });
    inp.addEventListener('input', () => { out.textContent = f(+inp.value); oninput && oninput(+inp.value); });
    const el = h('span', { class: 'ctl' }, h('label', { for: id }, label), inp, out);
    el.input = inp;
    el.set = v => { inp.value = v; out.textContent = f(+v); };
    return el;
  }
  function segmented(options, value, onchange, label) {
    const el = h('span', { class: 'seg', role: 'group', 'aria-label': label || '' });
    const btns = options.map(([v, text]) => {
      const b = h('button', { type: 'button', 'aria-pressed': String(v === value) }, text);
      b.addEventListener('click', () => { set(v); onchange && onchange(v); });
      el.append(b);
      return [v, b];
    });
    function set(v) { btns.forEach(([bv, b]) => b.setAttribute('aria-pressed', String(bv === v))); el.value = v; }
    el.set = set; el.value = value;
    return el;
  }
  function labeled(label, control) { return h('span', { class: 'ctl' }, h('span', {}, label), control); }
  function select(options, value, onchange, id) {
    const s = h('select', { id }, options.map(([v, t]) => h('option', { value: v }, t)));
    s.value = value;
    s.addEventListener('change', () => onchange(s.value));
    return s;
  }

  // ---------- Tutor stepper: frames = [{line, vars, stack, note, ...}] ----------
  const KW = /\b(for|if|else|while|function|return|and|or|not|continue|break|to|true|false)\b/g;
  function highlight(line) {
    const ci = line.indexOf('//');
    const code = ci >= 0 ? line.slice(0, ci) : line, cm = ci >= 0 ? line.slice(ci) : '';
    let html = esc(code).replace(KW, '<span class="kw">$1</span>').replace(/\b([a-z_][a-z0-9_]*)(?=\()/gi, (m, n) => (/^(for|if|while|max|min|round)$/.test(n) ? m : `<span class="fn">${n}</span>`));
    return html + (cm ? `<span class="cm">${esc(cm)}</span>` : '');
  }
  let activeStepper = null;
  window.addEventListener('keydown', e => {
    if (!activeStepper || !activeStepper.root.isConnected || activeStepper.root.closest('[hidden]')) return;
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement && document.activeElement.tagName) && document.activeElement.type !== 'range') return;
    if (e.key === 'ArrowRight') { activeStepper.go(activeStepper.i + 1); e.preventDefault(); }
    if (e.key === 'ArrowLeft') { activeStepper.go(activeStepper.i - 1); e.preventDefault(); }
  });

  function Stepper({ code, title = '의사 코드', render, startLabel }) {
    const S = { frames: [], i: 0, timer: null };
    const btn = (t, aria, fn) => h('button', { class: 'btn', type: 'button', 'aria-label': aria, title: aria, onclick: () => { activeStepper = S; fn(); } }, t);
    const range = h('input', { type: 'range', min: 0, max: 0, value: 0, 'aria-label': '단계' });
    const count = h('span', { class: 'count' }, '0 / 0');
    const playBtn = btn('▶', '재생', () => (S.timer ? stop() : play()));
    const speed = h('select', { 'aria-label': '재생 속도' }, [['600', '느리게'], ['220', '보통'], ['60', '빠르게'], ['8', '매우 빠르게']].map(([v, t]) => h('option', { value: v }, t)));
    speed.value = '220';
    speed.addEventListener('change', () => { if (S.timer) { stop(); play(); } });
    range.addEventListener('input', () => { activeStepper = S; go(+range.value); });
    const bar = h('div', { class: 'tbar' },
      btn('⏮', '처음으로', () => go(0)), btn('◀', '이전 단계 (←)', () => go(S.i - 1)), playBtn, btn('▶|', '다음 단계 (→)', () => go(S.i + 1)), btn('⏭', '끝으로', () => go(S.frames.length - 1)),
      range, count, speed);
    const note = h('div', { class: 'tnote', 'aria-live': 'polite' });
    const codeEl = h('div', { class: 'code' });
    const lines = code.map((l, k) => {
      const ln = h('div', { class: 'ln' }, h('span', { class: 'no' }, String(k + 1)), h('span', { class: 'arrow' }, ''), h('span', { html: highlight(l) || ' ' }));
      codeEl.append(ln); return ln;
    });
    const watch = h('table', { class: 'watch' });
    const stackBox = h('div', { class: 'frames' });
    const stackWrap = h('div', { hidden: true }, h('div', { class: 'panel-title' }, '호출 스택 / 큐'), stackBox);
    const watchWrap = h('div', {}, h('div', { class: 'panel-title' }, '변수'), watch);
    const panel = h('div', { class: 'card tutor' }, h('h3', {}, title), codeEl, watchWrap, stackWrap);
    const root = h('div', { class: 'tutor' }, bar, note);
    root.addEventListener('pointerdown', () => (activeStepper = S));
    panel.addEventListener('pointerdown', () => (activeStepper = S));

    let prevVars = {};
    function go(i) {
      if (!S.frames.length) return;
      i = Math.max(0, Math.min(S.frames.length - 1, i));
      S.i = i; range.value = i; count.textContent = `${i + 1} / ${S.frames.length}`;
      const f = S.frames[i];
      const cur = new Set([].concat(f.line || []));
      lines.forEach((ln, k) => { const on = cur.has(k + 1); ln.classList.toggle('cur', on); ln.children[1].textContent = on ? '▸' : ''; });
      const first = lines[[...cur][0] - 1];
      if (first && codeEl.scrollHeight > codeEl.clientHeight + 4) {
        const top = first.offsetTop - codeEl.offsetTop;
        if (top < codeEl.scrollTop || top > codeEl.scrollTop + codeEl.clientHeight - 24) codeEl.scrollTop = top - 40;
      }
      note.innerHTML = f.note || '';
      const vars = f.vars || {};
      const prev = i > 0 ? S.frames[i - 1].vars || {} : prevVars;
      watch.replaceChildren(...Object.entries(vars).map(([k, v]) => h('tr', { class: prev[k] !== undefined && String(prev[k]) !== String(v) ? 'chg' : '' }, h('td', {}, k), h('td', {}, fmt(v, 3)))));
      watchWrap.hidden = !Object.keys(vars).length;
      if (f.stack) {
        stackWrap.hidden = false;
        const st = f.stack, max = 8;
        const shown = st.slice(-max);
        stackBox.replaceChildren(
          ...shown.map((s, k) => h('div', { class: 'frame' + (k === shown.length - 1 ? ' top' : ''), html: s })).reverse(),
          ...(st.length > max ? [h('div', { class: 'more' }, `… 아래에 ${st.length - max}개 더`)] : []),
          ...(st.length ? [] : [h('div', { class: 'more' }, '(비어 있음)')]));
      } else stackWrap.hidden = true;
      render(f, i, S.frames);
    }
    function play() {
      if (S.i >= S.frames.length - 1) go(0);
      playBtn.textContent = '❚❚'; playBtn.setAttribute('aria-label', '일시정지');
      S.timer = setInterval(() => { if (S.i >= S.frames.length - 1 || !root.isConnected || root.closest('[hidden]')) return stop(); go(S.i + 1); }, +speed.value);
    }
    function stop() { clearInterval(S.timer); S.timer = null; playBtn.textContent = '▶'; playBtn.setAttribute('aria-label', '재생'); }
    function load(frames, at = 0) {
      stop(); S.frames = frames; range.max = Math.max(0, frames.length - 1);
      go(at === 'end' ? frames.length - 1 : Math.min(at, frames.length - 1));
    }
    Object.assign(S, { root, bar, note, panel, codeEl, go, load, play, stop, get index() { return S.i; } });
    return S;
  }

  // ---------- Grid view ----------
  let gid = 0;
  function GridView({ rows, cols, cs = 34, fs = 13, axes = true, rowLabels, colLabels, cell, onClick, paint, onHover, onLeave, label }) {
    const G = { rows, cols, cs, cells: [] };
    const gv = h('div', { class: 'gv', role: 'grid', 'aria-label': label || '격자' });
    const wrap = h('div', { class: 'gridwrap' }, gv);
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('class', 'ov');
    const mid = 'm' + (++gid);
    let painting = null;
    window.addEventListener('pointerup', () => (painting = null));

    function build() {
      gv.replaceChildren();
      gv.style.setProperty('--cs', cs + 'px'); gv.style.setProperty('--fs', fs + 'px');
      gv.style.gridTemplateColumns = `${axes ? cs + 'px ' : ''}repeat(${G.cols}, ${cs}px)`;
      if (axes) { gv.append(h('div', { class: 'ax' })); for (let x = 0; x < G.cols; x++) gv.append(h('div', { class: 'ax' }, colLabels ? colLabels[x] ?? '' : String(x))); }
      G.cells = [];
      for (let y = 0; y < G.rows; y++) {
        if (axes) gv.append(h('div', { class: 'ax' }, rowLabels ? rowLabels[y] ?? '' : String(y)));
        const row = [];
        for (let x = 0; x < G.cols; x++) {
          const c = h('div', { class: 'c', role: 'gridcell' });
          c.addEventListener('pointerdown', e => {
            if (paint) { painting = paint.start(y, x); paint.apply(y, x, painting); e.preventDefault(); }
            else if (onClick) onClick(y, x, e);
          });
          c.addEventListener('pointerenter', e => {
            if (paint && painting !== null && e.buttons) paint.apply(y, x, painting);
            onHover && onHover(y, x);
          });
          gv.append(c); row.push(c);
        }
        G.cells.push(row);
      }
      if (onLeave) gv.addEventListener('pointerleave', onLeave);
      svg.style.left = (axes ? cs : 0) + 'px'; svg.style.top = (axes ? cs : 0) + 'px';
      svg.setAttribute('width', G.cols * cs); svg.setAttribute('height', G.rows * cs);
      gv.append(svg);
    }
    function draw() {
      for (let y = 0; y < G.rows; y++) for (let x = 0; x < G.cols; x++) {
        const c = G.cells[y][x], s = cell(y, x) || {};
        let cls = 'c' + (y === 0 ? ' edge-t' : '') + (x === 0 ? ' edge-l' : '') + ((onClick || paint) ? ' click' : '') + (s.cls ? ' ' + s.cls : '');
        if (c.className !== cls) c.className = cls;
        c.style.background = s.bg || ''; c.style.color = s.color || ''; c.style.fontWeight = s.bold ? '700' : '';
        const html = (s.sub !== undefined ? `<span class="sub">${esc(s.sub)}</span>` : '') + esc(s.t ?? '') + (s.badge !== undefined ? `<span class="badge" style="color:${s.badgeColor || 'var(--orange)'}">${esc(s.badge)}</span>` : '');
        if (c._html !== html) { c.innerHTML = html; c._html = html; }
        if (s.title) c.title = s.title; else c.removeAttribute('title');
      }
    }
    const cx = x => (x + 0.5) * cs, cy = y => (y + 0.5) * cs;
    function overlay(items) {
      const colors = ['--orange', '--neg', '--ok', '--ink', '--bad'];
      let defs = '<defs>' + colors.map(c => `<marker id="${mid}${c}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(${c})"/></marker>`).join('') + '</defs>';
      svg.innerHTML = defs + (items || []).map(it => {
        const c = it.color || '--orange';
        if (it.type === 'line' || it.type === 'arrow') {
          const [y1, x1, y2, x2] = it.pts;
          return `<line x1="${cx(x1)}" y1="${cy(y1)}" x2="${cx(x2)}" y2="${cy(y2)}" stroke="var(${c})" stroke-width="${it.w || 2.5}" ${it.dash ? 'stroke-dasharray="4 3"' : ''} ${it.type === 'arrow' ? `marker-end="url(#${mid}${c})"` : ''} stroke-linecap="round" opacity="${it.op || 1}"/>`;
        }
        if (it.type === 'rect') {
          const [y, x, hh, ww] = it.pts;
          return `<rect x="${x * cs + 1}" y="${y * cs + 1}" width="${ww * cs - 2}" height="${hh * cs - 2}" fill="${it.fill || 'none'}" stroke="var(${c})" stroke-width="${it.w || 2.5}" rx="3" ${it.dash ? 'stroke-dasharray="5 3"' : ''}/>`;
        }
        if (it.type === 'dot') return `<circle cx="${cx(it.pts[1])}" cy="${cy(it.pts[0])}" r="${it.r || 5}" fill="var(${c})"/>`;
        if (it.type === 'raw') return it.svg;
        return '';
      }).join('');
    }
    function resize(r, c) { G.rows = r; G.cols = c; build(); draw(); }
    build();
    Object.assign(G, { el: wrap, draw, overlay, resize, cx, cy });
    return G;
  }

  // ---------- Image view ----------
  function ImageView({ caption = '', info = '', onHover, onLeave, onClick, maxw } = {}) {
    const cv = h('canvas', { width: 8, height: 8 });
    const capL = h('span', {}, caption), capR = h('span', { class: 'mono' }, info);
    const el = h('div', { class: 'iv' }, cv, h('div', { class: 'caption' }, capL, capR));
    if (maxw) el.style.maxWidth = maxw + 'px';
    const ctx = cv.getContext('2d');
    const pos = e => { const r = cv.getBoundingClientRect(); return [Math.floor((e.clientY - r.top) / r.height * cv.height), Math.floor((e.clientX - r.left) / r.width * cv.width)]; };
    if (onHover) cv.addEventListener('pointermove', e => { const [y, x] = pos(e); if (y >= 0 && x >= 0 && y < cv.height && x < cv.width) onHover(y, x); });
    if (onLeave) cv.addEventListener('pointerleave', onLeave);
    if (onClick) { cv.style.cursor = 'crosshair'; cv.addEventListener('pointerdown', e => { const [y, x] = pos(e); onClick(y, x, e); }); }
    const rgbOf = c => { const d = document.createElement('div'); d.style.color = c; document.body.append(d); const m = getComputedStyle(d).color.match(/\d+/g).map(Number); d.remove(); return m; };

    function draw(arr, mode = 'gray', opt = {}) {
      const H = arr.length, W = arr[0].length;
      if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
      const im = ctx.createImageData(W, H), d = im.data;
      let lo = Infinity, hi = -Infinity, amax = 0;
      if (mode === 'norm' || mode === 'abs' || mode === 'signed') for (const r of arr) for (const v of r) { lo = Math.min(lo, v); hi = Math.max(hi, v); amax = Math.max(amax, Math.abs(v)); }
      if (opt.amax) amax = opt.amax;
      const P = rgbOf(tok('--pos')), N = rgbOf(tok('--neg'));
      const ink = opt.edgeColor ? rgbOf(col(opt.edgeColor)) : [20, 26, 22];
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const v = arr[y][x], k = (y * W + x) * 4;
        let r, g, b;
        if (mode === 'rgb') [r, g, b] = v;
        else if (mode === 'binary') { if (opt.dark) { r = g = b = v ? 255 : 0; } else if (v) [r, g, b] = ink; else r = g = b = 255; }
        else if (mode === 'signed') { const t = amax ? Math.min(1, Math.abs(v) / amax) : 0; const c = v >= 0 ? P : N; r = c[0] * t; g = c[1] * t; b = c[2] * t; }
        else if (mode === 'label') { if (!v) r = g = b = 255; else { const hue = (v * 137.5) % 360; [r, g, b] = hsl(hue, .6, .55); } }
        else {
          let t = v;
          if (mode === 'norm') t = hi > lo ? (v - lo) / (hi - lo) * 255 : 0;
          if (mode === 'abs') t = amax ? Math.abs(v) / amax * 255 : 0;
          if (opt.gain) t = Math.min(255, t * opt.gain);
          r = g = b = Math.max(0, Math.min(255, t));
        }
        d[k] = r; d[k + 1] = g; d[k + 2] = b; d[k + 3] = 255;
      }
      ctx.putImageData(im, 0, 0);
      if (opt.rects) for (const rc of opt.rects) { ctx.strokeStyle = col(rc.color || '--orange'); ctx.lineWidth = rc.w || 1; ctx.strokeRect(rc.x + 0.5 - (rc.pad || 0), rc.y + 0.5 - (rc.pad || 0), rc.ww - 1 + 2 * (rc.pad || 0), rc.hh - 1 + 2 * (rc.pad || 0)); }
      if (opt.marks) for (const m of opt.marks) { ctx.fillStyle = col(m.color || '--orange'); ctx.fillRect(m.x, m.y, 1, 1); }
      if (opt.lines) for (const l of opt.lines) { ctx.strokeStyle = col(l.color || '--orange'); ctx.lineWidth = l.w || 1; ctx.beginPath(); ctx.moveTo(l.x1, l.y1); ctx.lineTo(l.x2, l.y2); ctx.stroke(); }
    }
    function hsl(hh, s, l) {
      const a = s * Math.min(l, 1 - l), f = n => { const k = (n + hh / 30) % 12; return 255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))); };
      return [f(0), f(8), f(4)];
    }
    return { el, canvas: cv, ctx, draw, setCaption: t => (capL.textContent = t), setInfo: t => (capR.textContent = t), hsl };
  }

  // ---------- Plot ----------
  function plot(canvas, o) {
    const dpr = window.devicePixelRatio || 1, W = o.w || 520, Hh = o.h || 200;
    canvas.classList.add('plot');
    if (canvas.width !== W * dpr) { canvas.width = W * dpr; canvas.height = Hh * dpr; }
    canvas.style.aspectRatio = `${W} / ${Hh}`;
    const c = canvas.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, W, Hh);
    const m = Object.assign({ l: 44, r: 12, t: 12, b: 26 }, o.margin || {});
    const [x0, x1] = o.x, [y0, y1] = o.y;
    const X = v => m.l + (v - x0) / (x1 - x0) * (W - m.l - m.r);
    const Y = v => Hh - m.b - (v - y0) / (y1 - y0) * (Hh - m.t - m.b);
    c.font = '11px ' + tok('--mono').split(',')[0];
    c.fillStyle = tok('--muted'); c.strokeStyle = tok('--rule'); c.lineWidth = 1;
    const yt = o.yticks || nice(y0, y1, 4), xt = o.xticks || nice(x0, x1, 8);
    c.textAlign = 'right'; c.textBaseline = 'middle';
    for (const v of yt) { c.globalAlpha = .6; c.beginPath(); c.moveTo(m.l, Y(v)); c.lineTo(W - m.r, Y(v)); c.stroke(); c.globalAlpha = 1; c.fillText(o.yfmt ? o.yfmt(v) : trim(v), m.l - 5, Y(v)); }
    c.textAlign = 'center'; c.textBaseline = 'top';
    for (const v of xt) c.fillText(o.xfmt ? o.xfmt(v) : trim(v), X(v), Hh - m.b + 5);
    if (y0 < 0 && y1 > 0) { c.strokeStyle = tok('--faint'); c.beginPath(); c.moveTo(m.l, Y(0)); c.lineTo(W - m.r, Y(0)); c.stroke(); }
    for (const s of o.series || []) {
      const color = col(s.color || '--ink');
      const data = s.data.map((d, i) => (Array.isArray(d) ? d : [i + (s.x0 || 0), d])).filter(d => d[1] !== null && d[1] !== undefined);
      c.strokeStyle = color; c.fillStyle = color; c.lineWidth = s.width || 2; c.globalAlpha = s.alpha || 1;
      if (s.type === 'bar') {
        const bw = s.bw || Math.max(1, (X(x0 + 1) - X(x0)) * (s.frac || .8));
        const blo = Math.min(y0, y1), bhi = Math.max(y0, y1);
        for (const [x, y] of data) { const a = Y(Math.max(blo, Math.min(y, bhi))), b = Y(Math.max(blo, Math.min(0, bhi))); c.fillStyle = s.colorAt ? col(s.colorAt(x, y)) : color; c.fillRect(X(x) - bw / 2, Math.min(a, b), bw, Math.abs(b - a) || 0.5); }
      } else if (s.type === 'points') {
        for (const [x, y] of data) { c.beginPath(); c.arc(X(x), Y(y), s.r || 3, 0, 7); c.fill(); }
      } else {
        c.beginPath(); c.setLineDash(s.dash || []);
        const ylo = Math.min(y0, y1), yhi = Math.max(y0, y1), ysp = yhi - ylo;
        data.forEach(([x, y], k) => { const px = X(x), py = Y(Math.max(ylo - ysp, Math.min(yhi + ysp, y))); if (s.type === 'step' && k) c.lineTo(px, Y(data[k - 1][1])); k ? c.lineTo(px, py) : c.moveTo(px, py); });
        c.stroke(); c.setLineDash([]);
        if (s.fill) { c.lineTo(X(data[data.length - 1][0]), Y(Math.max(0, y0))); c.lineTo(X(data[0][0]), Y(Math.max(0, y0))); c.globalAlpha = .12; c.fill(); }
      }
      c.globalAlpha = 1;
    }
    for (const v of o.vlines || []) {
      c.strokeStyle = col(v.color || '--orange'); c.lineWidth = v.w || 1.5; c.setLineDash(v.dash || []);
      c.beginPath(); c.moveTo(X(v.x), m.t); c.lineTo(X(v.x), Hh - m.b); c.stroke(); c.setLineDash([]);
      if (v.label) { c.fillStyle = col(v.color || '--orange'); c.textAlign = X(v.x) > W - 80 ? 'right' : 'left'; c.textBaseline = 'top'; c.fillText(v.label, X(v.x) + (X(v.x) > W - 80 ? -4 : 4), m.t); }
    }
    for (const p of o.dots || []) { c.fillStyle = col(p.color || '--orange'); c.beginPath(); c.arc(X(p.x), Y(p.y), p.r || 4, 0, 7); c.fill(); if (p.label) { c.textAlign = 'left'; c.textBaseline = 'bottom'; c.fillText(p.label, X(p.x) + 6, Y(p.y) - 3); } }
    if (o.legend) { let lx = W - m.r - 4; c.textAlign = 'right'; c.textBaseline = 'top'; for (const [t, cc] of o.legend.slice().reverse()) { c.fillStyle = col(cc); const tw = c.measureText(t).width; c.fillText(t, lx, m.t + 2); c.fillRect(lx - tw - 14, m.t + 6, 10, 3); lx -= tw + 26; } }
    return { X, Y, W, H: Hh, m };
  }
  function trim(v) { return Math.abs(v) >= 100 || Number.isInteger(v) ? String(Math.round(v * 100) / 100) : String(+v.toFixed(2)); }
  function nice(a, b, n) {
    const span = b - a, raw = span / n, p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p;
    const step = (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * p, out = [];
    for (let v = Math.ceil(a / step) * step; v <= b + 1e-9; v += step) out.push(+v.toFixed(10));
    return out;
  }

  // ---------- Sample images ----------
  function fromCanvas(cvs) {
    const W = cvs.width, H = cvs.height, d = cvs.getContext('2d').getImageData(0, 0, W, H).data;
    const rgb = [], gray = [];
    for (let y = 0; y < H; y++) {
      const r1 = [], g1 = [];
      for (let x = 0; x < W; x++) { const k = (y * W + x) * 4; r1.push([d[k], d[k + 1], d[k + 2]]); g1.push(Math.round(0.299 * d[k] + 0.587 * d[k + 1] + 0.114 * d[k + 2])); }
      rgb.push(r1); gray.push(g1);
    }
    return { rgb, gray, w: W, h: H };
  }
  function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
  const SCENES = {
    shapes: ['도형 장면', () => {
      const W = 160, H = 120, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
      const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#8fb3d9'); g.addColorStop(1, '#d9cfa8'); x.fillStyle = g; x.fillRect(0, 0, W, H);
      x.fillStyle = '#6b7f4a'; x.fillRect(0, 88, W, 32);
      x.fillStyle = '#2b2f3a'; x.beginPath(); x.arc(42, 58, 24, 0, 7); x.fill();
      x.save(); x.translate(112, 52); x.rotate(0.35); x.fillStyle = '#f2efe6'; x.fillRect(-20, -20, 40, 40); x.fillStyle = '#c0462b'; x.fillRect(-8, -8, 16, 16); x.restore();
      x.fillStyle = '#e0a03a'; x.beginPath(); x.moveTo(70, 100); x.lineTo(92, 70); x.lineTo(114, 100); x.closePath(); x.fill();
      x.strokeStyle = '#ffffff'; x.lineWidth = 1; x.beginPath(); x.moveTo(6, 110); x.lineTo(60, 96); x.stroke();
      x.fillStyle = '#1d2330'; for (let i = 0; i < 5; i++) x.fillRect(128 + i * 6, 92, 3, 22);
      const img = fromCanvas(c), r = rng(7);
      img.rgb = img.rgb.map(row => row.map(p => p.map(v => Math.max(0, Math.min(255, v + (r() - .5) * 10)))));
      img.gray = img.rgb.map(row => row.map(([a, b2, cc]) => Math.round(0.299 * a + 0.587 * b2 + 0.114 * cc)));
      return img;
    }],
    text: ['글자', () => {
      const W = 160, H = 120, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
      const g = x.createLinearGradient(0, 0, W, 0); g.addColorStop(0, '#303030'); g.addColorStop(1, '#b0b0b0'); x.fillStyle = g; x.fillRect(0, 0, W, H);
      x.fillStyle = '#f5f5f5'; x.font = 'bold 64px sans-serif'; x.textBaseline = 'middle'; x.fillText('CV', 12, 50);
      x.fillStyle = '#101010'; x.font = 'bold 30px sans-serif'; x.fillText('에지', 90, 96);
      x.strokeStyle = '#e8e8e8'; x.lineWidth = 3; x.beginPath(); x.arc(125, 38, 18, 0, 7); x.stroke();
      return fromCanvas(c);
    }],
    zone: ['존 플레이트', () => {
      const W = 160, H = 120, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'), im = x.createImageData(W, H);
      for (let y = 0; y < H; y++) for (let i = 0; i < W; i++) { const r2 = (i - W / 2) ** 2 + (y - H / 2) ** 2, v = 127.5 + 127.5 * Math.cos(r2 * 0.012), k = (y * W + i) * 4; im.data[k] = im.data[k + 1] = im.data[k + 2] = v; im.data[k + 3] = 255; }
      x.putImageData(im, 0, 0); return fromCanvas(c);
    }],
    iso: ['등휘도 컬러', () => {
      const W = 160, H = 120, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
      x.fillStyle = 'rgb(128,128,128)'; x.fillRect(0, 0, W, H);
      x.fillStyle = 'rgb(200,100,110)'; x.beginPath(); x.arc(50, 60, 32, 0, 7); x.fill();
      x.fillStyle = 'rgb(90,150,100)'; x.fillRect(92, 26, 50, 50);
      x.fillStyle = 'rgb(120,120,210)'; x.beginPath(); x.moveTo(84, 112); x.lineTo(112, 80); x.lineTo(140, 112); x.closePath(); x.fill();
      return fromCanvas(c);
    }],
  };
  const APP_IMG = { cur: null, key: 'shapes', subs: new Set() };
  function currentImage() { if (!APP_IMG.cur) APP_IMG.cur = SCENES[APP_IMG.key][1](); return APP_IMG.cur; }
  function onImage(fn) { APP_IMG.subs.add(fn); return () => APP_IMG.subs.delete(fn); }
  function setImage(key, img) { APP_IMG.key = key; APP_IMG.cur = img || SCENES[key][1](); APP_IMG.subs.forEach(f => f(APP_IMG.cur)); document.querySelectorAll('select[data-imgpick]').forEach(s => (s.value = key)); }
  function imagePicker() {
    const opts = Object.entries(SCENES).map(([k, [t]]) => [k, t]);
    const file = h('input', { type: 'file', accept: 'image/*', hidden: true });
    const s = h('select', { 'data-imgpick': '', 'aria-label': '실습 영상' }, opts.map(([v, t]) => h('option', { value: v }, t)), h('option', { value: 'upload' }, '내 사진 올리기…'));
    if (APP_IMG.key === 'upload') s.append(h('option', { value: 'upload-cur' }, '올린 사진'));
    s.value = APP_IMG.key;
    s.addEventListener('change', () => { if (s.value === 'upload') { file.click(); s.value = APP_IMG.key; } else if (SCENES[s.value]) setImage(s.value); });
    file.addEventListener('change', () => {
      const f = file.files[0]; if (!f) return;
      const img = new Image();
      img.onload = () => {
        const sc = Math.min(1, 200 / Math.max(img.width, img.height)), c = document.createElement('canvas');
        c.width = Math.max(8, Math.round(img.width * sc)); c.height = Math.max(8, Math.round(img.height * sc));
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        document.querySelectorAll('select[data-imgpick]').forEach(sel => { if (!sel.querySelector('[value="upload-cur"]')) sel.append(h('option', { value: 'upload-cur' }, '올린 사진')); });
        setImage('upload-cur', fromCanvas(c));
        URL.revokeObjectURL(img.src);
      };
      img.src = URL.createObjectURL(f);
    });
    return h('span', { class: 'ctl' }, h('span', {}, '실습 영상'), s, file);
  }

  function matrixEl(M, d = 3) {
    const el = h('span', { class: 'matrix', style: { gridTemplateColumns: `repeat(${M[0].length}, auto)` } });
    for (const r of M) for (const v of r) el.append(h('span', {}, fmt(Math.abs(v) < 1e-10 ? 0 : v, d)));
    return el;
  }
  function dataTable(head, rows, curRow) {
    const t = h('table', { class: 'data' }, h('tr', {}, head.map(x => h('th', { html: x }))));
    rows.forEach((r, i) => t.append(h('tr', { class: i === curRow ? 'cur' : '' }, r.map(v => h('td', {}, typeof v === 'number' ? fmt(v, 3) : v)))));
    return h('div', { class: 'tablewrap' }, t);
  }
  function formula(tex, tag) { return h('div', { class: 'eq' }, tex, tag ? h('span', { class: 'tag' }, ' ' + tag) : null); }
  // grey-level → cell background
  const grayBg = (v, max = 255) => { const t = Math.max(0, Math.min(1, v / max)); const g = Math.round(255 - t * 200); return `rgb(${g},${g},${g})`; };
  const signedBg = (v, amax) => { const t = Math.min(1, Math.abs(v) / (amax || 1)) * 0.55; return v >= 0 ? `color-mix(in srgb, var(--pos) ${t * 100}%, var(--cell-bg))` : `color-mix(in srgb, var(--neg) ${t * 100}%, var(--cell-bg))`; };

  return { h, esc, tok, col, fmt, typeset, flushMath, slider, segmented, labeled, select, Stepper, GridView, ImageView, plot, nice, rng, SCENES, currentImage, onImage, setImage, imagePicker, matrixEl, dataTable, formula, grayBg, signedBg };
})();

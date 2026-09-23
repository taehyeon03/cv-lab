// Chapter 3 modules, part A: derivatives, edge operators, Gaussian, LoG, zero crossing, Canny, metrics, colour edges
(() => {
  const { h, fmt } = UI;
  const R = String.raw;
  const EX31 = `0 0 0 0 0 0 0 0
0 1 1 0 0 0 1 0
0 1 2 0 0 0 1 0
0 1 3 1 0 0 2 0
0 1 3 1 0 0 2 0
0 1 2 3 4 4 3 0
0 0 0 0 1 3 1 0
0 0 0 0 0 0 0 0`;
  const r1 = v => (v === null ? '-' : Math.abs(v - Math.round(v)) < 1e-9 ? String(Math.round(v)) : v.toFixed(1));

  // ================= 3.1.1–3.1.2 derivatives =================
  const SIGS = {
    '그림 3-2': [2, 2, 3, 2, 3, 5, 9, 9, 8, 9],
    '그림 3-3 계단·램프': [2, 2, 2, 2, 6, 6, 6, 6, 6, 5, 4, 3, 2, 2],
    '그림 3-9 솔트페퍼': [5, 5, 5, 5, 9, 5, 5, 5, 5, 5, 1, 5, 5, 5, 5, 5],
    '잡음 섞인 에지': [98, 97, 101, 102, 99, 168, 170, 169, 172, 167, 171, 170],
  };
  APP.mod({
    id: 'deriv', ch: '3', num: '3.1.1', title: '디지털 영상의 미분', src: '3강 p.5–9 · 식 (3.1)–(3.4), 그림 3-2~3-4, 3-9',
    blurb: '1차 미분의 봉우리와 2차 미분의 영교차. 신호를 직접 끌어 바꾸고 잡음 증폭 확인.',
    mount(root, m) {
      APP.scaffold(root, m, {
        lead: '에지는 명암 변화가 큰 곳입니다. 디지털 영상에서는 미분을 이웃 화소의 차이로 근사합니다. <b>1차 미분의 봉우리</b> 또는 <b>2차 미분의 영교차</b>(부호가 바뀌는 곳)가 에지 위치입니다. 위쪽 그래프의 막대를 끌어서 f를 바꿔 보세요. 미분은 잡음을 키우므로, σ를 올려 가우시안 스무딩을 먼저 하면 어떻게 달라지는지도 확인하세요.',
        formulas: [[R`$$f'(x)=\frac{df}{dx}\approx f(x+1)-f(x)$$`, '식 (3.2) · 마스크 [−1 1]'], [R`$$f'(x)\approx\frac{f(x+1)-f(x-1)}{2}$$`, '식 (3.4) · Δx=2, 마스크 [−1 0 1]'], [R`$$f''(x)\approx f(x+1)+f(x-1)-2f(x)$$`, '식 (3.3) · 마스크 [1 −2 1]']],
      });
      let raw = SIGS['그림 3-3 계단·램프'].slice(), op = 'fwd', sigma = 0, T = 2, sig = raw, d1 = [], d2 = [], hov = -1;
      const cvF = h('canvas', { style: { touchAction: 'none', cursor: 'ns-resize' } }), cvD1 = h('canvas'), cvD2 = h('canvas');
      const note = h('div', { class: 'note' }, '표의 칸이나 그래프 위에 마우스를 올리면 계산식을 보여 줍니다.');
      let gv = null; const gbox = h('div');
      let map = null;
      function compute() {
        const k = sigma > 0 ? CV.gaussian1D(sigma) : [1], r = (k.length - 1) / 2, n = raw.length;
        sig = raw.map((_, i) => k.reduce((s, w, j) => s + w * raw[CV.clamp(i + j - r, 0, n - 1)], 0));
        d1 = sig.map((v, i) => (op === 'fwd' ? (i < n - 1 ? sig[i + 1] - v : null) : (i > 0 && i < n - 1 ? (sig[i + 1] - sig[i - 1]) / 2 : null)));
        d2 = sig.map((v, i) => (i > 0 && i < n - 1 ? sig[i + 1] + sig[i - 1] - 2 * v : null));
      }
      function zc() { const out = []; let last = null; d2.forEach((v, i) => { if (v === null || Math.abs(v) < 1e-9) return; if (last && Math.sign(v) !== Math.sign(last.v) && Math.abs(v - last.v) > 1e-9) out.push((last.i + i) / 2); last = { i, v }; }); return out; }
      function build() {
        const n = raw.length;
        gv = UI.GridView({
          rows: 4, cols: n, cs: 40, fs: 12, rowLabels: ['f', "f'", "f''", "|f'|≥T"], label: '미분 표',
          cell: (y, x) => {
            const cur = x === hov ? ' win' : '';
            if (y === 0) return { t: r1(sig[x]), cls: cur, title: sigma ? `원래 값 ${raw[x]}` : '' };
            if (y === 1) return { t: r1(d1[x]), cls: cur, ...(d1[x] ? APP.signedCell(d1[x], Math.max(1, ...d1.map(v => Math.abs(v || 0)))) : {}) };
            if (y === 2) return { t: r1(d2[x]), cls: cur, ...(d2[x] ? APP.signedCell(d2[x], Math.max(1, ...d2.map(v => Math.abs(v || 0)))) : {}) };
            return d1[x] === null ? { t: '-' } : Math.abs(d1[x]) >= T ? { t: 1, cls: 'on' + cur } : { t: 0, cls: cur };
          },
          onHover: (y, x) => { hov = x; explain(x); draw(); }, onLeave: () => { hov = -1; draw(); },
        });
        gbox.replaceChildren(gv.el);
      }
      function explain(x) {
        const n = raw.length, s = i => r1(sig[CV.clamp(i, 0, n - 1)]);
        const a = op === 'fwd' ? (x < n - 1 ? `f'(${x}) = f(${x + 1}) − f(${x}) = ${s(x + 1)} − ${s(x)} = <b>${r1(d1[x])}</b>` : `f'(${x}): f(${x + 1})가 없어 계산 안 함`) : (d1[x] !== null ? `f'(${x}) = (f(${x + 1}) − f(${x - 1}))/2 = (${s(x + 1)} − ${s(x - 1)})/2 = <b>${r1(d1[x])}</b>` : `f'(${x}): 양 끝이라 계산 안 함`);
        const b = d2[x] !== null ? `f''(${x}) = f(${x + 1}) + f(${x - 1}) − 2f(${x}) = ${s(x + 1)} + ${s(x - 1)} − 2×${s(x)} = <b>${r1(d2[x])}</b>` : `f''(${x}): 양 끝이라 계산 안 함`;
        note.innerHTML = a + '<br>' + b;
      }
      function draw() {
        compute(); gv.draw();
        const n = raw.length, lo = Math.min(...raw, ...sig), hi = Math.max(...raw, ...sig), pad = Math.max(1, (hi - lo) * 0.15);
        const vl = hov >= 0 ? [{ x: hov, color: '--neg' }] : [];
        const z = zc().map(x => ({ x, color: '--green', dash: [4, 3], label: '영교차' }));
        map = UI.plot(cvF, { w: 640, h: 170, x: [-0.5, n - 0.5], y: [lo - pad, hi + pad], xticks: [...Array(n).keys()], series: [{ type: 'bar', data: raw, color: '--rule', frac: 0.7 }, { type: 'line', data: sig, color: '--ink', width: 2 }, { type: 'points', data: sig, color: '--ink', r: 3 }], vlines: [...vl, ...z] });
        map.range = [lo - pad, hi + pad];
        const a1 = Math.max(1, ...d1.map(v => Math.abs(v || 0))), a2 = Math.max(1, ...d2.map(v => Math.abs(v || 0)));
        UI.plot(cvD1, { w: 640, h: 130, x: [-0.5, n - 0.5], y: [-a1 * 1.15, a1 * 1.15], xticks: [...Array(n).keys()], series: [{ type: 'bar', data: d1.map((v, i) => [i + (op === 'fwd' ? 0.5 : 0), v]), colorAt: (x, y) => (y >= 0 ? '--pos' : '--neg'), frac: 0.6 }], vlines: vl, legend: [["f'  (1차 미분)", '--pos']] });
        UI.plot(cvD2, { w: 640, h: 130, x: [-0.5, n - 0.5], y: [-a2 * 1.15, a2 * 1.15], xticks: [...Array(n).keys()], series: [{ type: 'bar', data: d2, colorAt: (x, y) => (y >= 0 ? '--pos' : '--neg'), frac: 0.6 }], vlines: [...vl, ...z], legend: [["f''  (2차 미분)", '--pos']] });
      }
      let dragging = false;
      const setFromPtr = e => {
        const r = cvF.getBoundingClientRect(), W = map.W, H = map.H, px = (e.clientX - r.left) / r.width * W, py = (e.clientY - r.top) / r.height * H;
        const n = raw.length, x = Math.round(-0.5 + (px - map.m.l) / (W - map.m.l - map.m.r) * n);
        if (x < 0 || x >= n) return;
        const [a, b] = map.range, v = a + (H - map.m.b - py) / (H - map.m.t - map.m.b) * (b - a);
        raw[x] = Math.round(CV.clamp(v, 0, 999)); hov = x; explain(x); draw();
      };
      cvF.addEventListener('pointerdown', e => { dragging = true; cvF.setPointerCapture(e.pointerId); setFromPtr(e); });
      cvF.addEventListener('pointermove', e => dragging && setFromPtr(e));
      cvF.addEventListener('pointerup', () => (dragging = false));
      const presets = h('div', { class: 'presets' }, Object.keys(SIGS).map(k => h('button', { class: 'btn', onclick: () => { raw = SIGS[k].slice(); T = k === '잡음 섞인 에지' ? 30 : k === '그림 3-2' ? 3 : 2; tSl.set(T); build(); draw(); } }, k)));
      const tSl = UI.slider({ label: '이진화 T', min: 0, max: 60, value: T, id: 'dv-t', oninput: v => { T = v; draw(); } });
      root.append(h('div', { class: 'stack' },
        h('div', { class: 'card' }, h('div', { class: 'controls' }, presets),
          h('div', { class: 'controls', style: { marginTop: '8px' } }, UI.labeled("f' 근사", UI.segmented([['fwd', 'f(x+1)−f(x)'], ['ctr', '(f(x+1)−f(x−1))/2']], op, v => { op = v; draw(); })),
            UI.slider({ label: '가우시안 σ', min: 0, max: 3, step: 0.1, value: 0, id: 'dv-s', fmt: v => (v ? v.toFixed(1) : '없음'), oninput: v => { sigma = v; draw(); } }), tSl),
          h('div', { style: { marginTop: '10px' } }, cvF, h('span', { class: 'caption' }, '회색 막대: 원래 f (끌어서 수정) · 검은 선: 스무딩 후 f · 초록 점선: f″의 영교차')), cvD1, cvD2),
        h('div', { class: 'card' }, h('h3', {}, '미분 표', h('small', {}, '그림 3-2, 3-3, 3-9와 같은 형식')), gbox, note),
        h('div', { class: 'note warn' }, '그림 3-9 신호로 바꿔 보세요: 값 하나만 튀어도 1차 미분에서는 ±4, 2차 미분에서는 −8까지 커집니다(잡음 증폭). σ를 1 정도로 올리면 봉우리가 낮아지고 에지가 아닌 곳의 반응이 줄어듭니다. 램프 에지에서는 f′가 넓은 봉우리를, f″는 램프 양 끝에서 +, − 반응을 보이고 그 사이에 영교차가 생깁니다(그림 3-4).')));
      build(); draw();
    },
  });

  // ================= 3.1.3 edge operators =================
  APP.mod({
    id: 'sobel', ch: '3', num: '3.1.3', title: '에지 연산자·강도·방향', src: '3강 p.9–12 · 그림 3-5~3-8, 예제 3-1, 식 (3.6)', star: false,
    blurb: '로버츠·프레윗·소벨 마스크로 dy, dx 계산 → 강도 S, 방향 D, 8방향 양자화.',
    mount(root, m) {
      APP.scaffold(root, m, {
        lead: '2차원에서는 y, x 두 방향의 미분(그레이디언트)을 구합니다. 마스크를 정방형으로 넓히면 스무딩 효과가 생깁니다(프레윗, 소벨). 격자에서 <b>화소를 클릭</b>하면 그 위치의 dy, dx 계산 과정과 그레이디언트 방향(빨강), 에지 방향(파랑), 8방향 양자화 결과를 보여 줍니다. 에지 방향은 그레이디언트에 수직입니다.',
        formulas: [[R`$$\nabla f=\left(\frac{\partial f}{\partial y},\frac{\partial f}{\partial x}\right)=(d_y,d_x)$$`, '그레이디언트'], [R`$$S(y,x)=\sqrt{d_y^2+d_x^2}$$`, '에지 강도 (3.6)'], [R`$$D(y,x)=\arctan\!\left(\frac{d_y}{d_x}\right)$$`, '그레이디언트 방향']],
      });
      let f = APP.parseGrid(EX31), op = 'sobel', sel = [5, 3], show = 'f';
      let maps = null;
      const gv = UI.GridView({
        rows: 8, cols: 8, cs: 40, label: '예제 3-1 영상',
        cell: (y, x) => {
          const inW = win().some(([a, b]) => a === y && b === x);
          const s = show === 'f' ? { t: f[y][x], ...(f[y][x] ? {} : { color: 'var(--faint)' }) } : { t: maps.S[y][x].toFixed(1), ...APP.grayCell(maps.S[y][x], maxS()) };
          s.cls = (inW ? 'win' : '') + (sel[0] === y && sel[1] === x ? ' cur' : '');
          return s;
        },
        onClick: (y, x, e) => { if (e.altKey || e.shiftKey) { f[y][x] = (f[y][x] + (e.shiftKey ? 9 : 1)) % 10; } else sel = [y, x]; upd(); },
      });
      const maxS = () => Math.max(1, ...maps.S.flat());
      const win = () => { const k = CV.OPS[op].my, o = k.length === 2 ? 0 : 1, c = []; for (let j = 0; j < k.length; j++) for (let i = 0; i < k.length; i++) c.push([sel[0] + j - o, sel[1] + i - o]); return c; };
      const calcBox = h('div', { class: 'col' }), maskBox = h('div', { class: 'row' });
      const dial = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      dial.setAttribute('viewBox', '-90 -90 180 180'); dial.style.width = '190px';
      function upd() {
        maps = CV.edgeMaps(f, op);
        gv.draw();
        const [y, x] = sel, my = CV.OPS[op].my, mx = CV.OPS[op].mx;
        const A = CV.applyAt(f, my, y, x), B = CV.applyAt(f, mx, y, x), dy = A.s, dx = B.s, S = Math.hypot(dy, dx);
        const gd = CV.gradAngle(dy, dx), ed = ((gd + 90) % 360 + 360) % 360, q = CV.edgeDir8(dy, dx);
        const expr = t => t.terms.filter(u => u.k !== 0).map(u => `${u.v}×(${u.k})`).join(' + ');
        const mkMask = (k, name, terms) => { const g = UI.GridView({ rows: k.length, cols: k.length, cs: 36, fs: 12, axes: false, cell: (j, i) => ({ t: k[j][i], sub: terms[j * k.length + i].v, ...(k[j][i] > 0 ? { color: 'var(--pos)' } : k[j][i] < 0 ? { color: 'var(--neg)' } : { color: 'var(--faint)' }) }) }); g.draw(); return h('div', { class: 'col' }, h('span', { class: 'caption' }, name), g.el); };
        maskBox.replaceChildren(mkMask(my, 'm_y (작은 글씨: 겹친 f 값)', A.terms), mkMask(mx, 'm_x', B.terms));
        calcBox.replaceChildren(
          h('span', { class: 'mono' }, `d_y = ${expr(A) || '0'} = ${dy}`), h('span', { class: 'mono' }, `d_x = ${expr(B) || '0'} = ${dx}`),
          h('span', { class: 'mono' }, `S(${y},${x}) = √(${dy}² + ${dx}²) = ${S.toFixed(2)}`),
          h('span', { class: 'mono' }, `D(${y},${x}) = arctan(${dy}/${dx}) = ${S ? gd.toFixed(1) + '°' : '정의 안 됨 (S=0)'}`),
          h('span', { class: 'mono', style: { color: 'var(--neg)' } }, S ? `에지 방향 = D + 90° = ${ed.toFixed(1)}° → 양자화 ${q}` : ''));
        const L = 1.6, gy = S ? dy / S : 0, gx = S ? dx / S : 0;
        gv.overlay(S ? [{ type: 'arrow', pts: [y, x, y + gy * L, x + gx * L], color: '--bad' }, { type: 'arrow', pts: [y, x, y + gx * L, x - gy * L], color: '--neg' }] : []);
        const secs = [...Array(8).keys()].map(k => { const a0 = (k * 45 - 22.5) * Math.PI / 180, a1 = (k * 45 + 22.5) * Math.PI / 180, r = 70; return `<path d="M0,0 L${r * Math.cos(a0)},${r * Math.sin(a0)} A${r},${r} 0 0 1 ${r * Math.cos(a1)},${r * Math.sin(a1)} Z" fill="${S && k === q ? 'color-mix(in srgb, var(--neg) 30%, transparent)' : 'none'}" stroke="var(--rule)"/><text x="${82 * Math.cos(k * Math.PI / 4)}" y="${82 * Math.sin(k * Math.PI / 4) + 4}" text-anchor="middle" font-size="11" fill="var(--muted)">${k}</text>`; }).join('');
        const arrow = (ang, c) => `<line x1="0" y1="0" x2="${60 * Math.cos(ang * Math.PI / 180)}" y2="${60 * Math.sin(ang * Math.PI / 180)}" stroke="var(${c})" stroke-width="3" stroke-linecap="round"/><circle cx="${60 * Math.cos(ang * Math.PI / 180)}" cy="${60 * Math.sin(ang * Math.PI / 180)}" r="4" fill="var(${c})"/>`;
        dial.innerHTML = secs + (S ? arrow(gd, '--bad') + arrow(ed, '--neg') : '');
      }
      // image maps
      const ivS = UI.ImageView({ caption: '에지 강도 S' }), ivY = UI.ImageView({ caption: 'd_y (주황 +, 파랑 −)' }), ivX = UI.ImageView({ caption: 'd_x' }), ivD = UI.ImageView({ caption: '에지 방향 (색) × 강도' }), ivI = UI.ImageView({ caption: '입력' });
      function imgMaps() {
        const g = UI.currentImage().gray, E = CV.edgeMaps(g, op), mS = Math.max(...E.S.flat());
        ivI.draw(g); ivS.draw(E.S, 'abs'); ivY.draw(E.dy, 'signed'); ivX.draw(E.dx, 'signed');
        ivD.draw(E.S.map((r, y) => r.map((s, x) => { const [a, b, c] = ivD.hsl(E.D[y][x] * 45, 0.85, 0.55), t = Math.min(1, s / mS * 2.2); return [a * t, b * t, c * t]; })), 'rgb');
      }
      UI.onImage(imgMaps);
      const opSeg = UI.segmented([['roberts', '로버츠'], ['prewitt', '프레윗'], ['sobel', '소벨']], op, v => { op = v; upd(); imgMaps(); }, '연산자');
      root.append(h('div', { class: 'stack' },
        h('div', { class: 'lab' },
          h('div', { class: 'card' }, h('div', { class: 'controls' }, UI.labeled('연산자', opSeg), UI.labeled('격자 표시', UI.segmented([['f', '입력 f'], ['S', '강도 S']], 'f', v => { show = v; upd(); }))),
            h('div', { style: { marginTop: '10px' } }, gv.el), h('p', { class: 'caption' }, '클릭: 화소 선택 · Shift+클릭 −1 / Alt+클릭 +1로 값 수정 · 빨강: 그레이디언트 방향, 파랑: 에지 방향')),
          h('div', { class: 'stack' }, h('div', { class: 'card' }, h('h3', {}, '선택 화소의 계산'), maskBox, h('div', { style: { marginTop: '10px' } }, calcBox)),
            h('div', { class: 'card' }, h('h3', {}, '8방향 양자화', h('small', {}, '그림 3-6(b)')), h('div', { class: 'row', style: { alignItems: 'center' } }, dial, h('div', { class: 'caption' }, '0: −22.5°~22.5°, 1: 22.5°~67.5°, 2: 67.5°~112.5° … 영상 좌표는 y가 아래로 커지므로 각도가 화면에서 시계 방향으로 늘어납니다. 예제 3-1의 (5,3)은 D = −63.4°, 에지 방향 26.6° → 1.'))))),
        h('div', { class: 'card' }, h('h3', {}, '영상 전체에 적용', h('small', {}, '그림 3-8')), h('div', { class: 'controls' }, UI.imagePicker()), h('div', { class: 'imgs', style: { marginTop: '8px' } }, ivI.el, ivS.el, ivY.el, ivX.el, ivD.el),
          h('p', { class: 'caption' }, 'd_y는 가로로 놓인 에지(위아래 명암 변화)에, d_x는 세로 에지에 강하게 반응합니다.'))));
      upd(); imgMaps();
    },
  });

  // ================= 3.2.1 Gaussian =================
  APP.mod({
    id: 'gauss', ch: '3', num: '3.2.1', title: '가우시안과 다중 스케일', src: '3강 p.15–18 · 식 (3.7)(3.8), 그림 3-10~3-12',
    blurb: 'σ로 스케일 조절. 마스크 크기 규칙 6σ, 1·2차 도함수 모양, 다중 스케일 에지.',
    mount(root, m) {
      APP.scaffold(root, m, {
        lead: '미분은 잡음을 증폭하므로 먼저 가우시안으로 스무딩합니다. <b>σ가 작으면</b> 세밀한 에지까지, <b>σ가 크면</b> 굵직한 에지만 남습니다(다중 스케일). 이산 마스크 크기는 <b>6σ 이상인 가장 작은 홀수</b>로 정합니다 — 작으면 오차, 크면 계산 시간이 늘어납니다.',
        formulas: [[R`$$G(x)=\frac{1}{\sqrt{2\pi}\,\sigma}e^{-\frac{x^2}{2\sigma^2}}$$`, '식 (3.7)'], [R`$$G(y,x)=\frac{1}{2\pi\sigma^2}e^{-\frac{y^2+x^2}{2\sigma^2}}$$`, '식 (3.8)']],
      });
      let sigma = 2;
      const cvA = h('canvas'), cvB = h('canvas'), cvK = h('canvas'), info = h('div', { class: 'col' });
      const cvMS = h('canvas', { style: { width: '100%', imageRendering: 'pixelated', borderRadius: '6px', border: '1px solid var(--rule)' } });
      const scaleRow = h('div', { class: 'imgs' });
      UI.onImage(() => draw());
      const G = (x, s) => Math.exp(-x * x / (2 * s * s)) / (Math.sqrt(2 * Math.PI) * s);
      function draw() {
        const xs = []; for (let x = -20; x <= 20; x += 0.1) xs.push(+x.toFixed(2));
        UI.plot(cvA, { w: 420, h: 220, x: [-20, 20], y: [0, 0.82], series: [0.5, 1, 2, 5].map((s, k) => ({ type: 'line', data: xs.map(x => [x, G(x, s)]), color: ['--bad', '--green', '--neg', '--orange'][k], width: 1.2, alpha: 0.35 })).concat([{ type: 'line', data: xs.map(x => [x, G(x, sigma)]), color: '--ink', width: 2.5 }]), legend: [['σ=0.5', '--bad'], ['1', '--green'], ['2', '--neg'], ['5', '--orange'], ['지금', '--ink']] });
        const d1 = x => -x / (sigma * sigma) * G(x, sigma), d2 = x => (x * x - sigma * sigma) / Math.pow(sigma, 4) * G(x, sigma);
        const a = Math.max(G(0, sigma), ...xs.map(x => Math.abs(d1(x))), ...xs.map(x => Math.abs(d2(x))));
        UI.plot(cvB, { w: 420, h: 220, x: [-20, 20], y: [-a * 1.1, a * 1.1], series: [{ type: 'line', data: xs.map(x => [x, G(x, sigma)]), color: '--neg' }, { type: 'line', data: xs.map(x => [x, d1(x)]), color: '--bad' }, { type: 'line', data: xs.map(x => [x, d2(x)]), color: '--green' }], legend: [['G', '--neg'], ["G'", '--bad'], ["G''", '--green']] });
        const k = CV.gaussian1D(sigma), n = k.length, r = (n - 1) / 2;
        UI.plot(cvK, { w: 420, h: 150, x: [-r - 0.5, r + 0.5], y: [0, Math.max(...k) * 1.15], xticks: n <= 21 ? [...Array(n).keys()].map(i => i - r) : undefined, series: [{ type: 'bar', data: k.map((v, i) => [i - r, v]), color: '--orange', frac: 0.7 }] });
        info.replaceChildren(h('span', { class: 'mono' }, `6σ = ${(6 * sigma).toFixed(1)} → 마스크 ${n}×${n}`), h('span', { class: 'caption' }, `예: σ=3.0이면 19×19 (교재). 이산 가중치는 합이 1이 되도록 정규화했습니다. 가운데 값 = ${k[r].toFixed(4)}`));
        // multiscale bars (Fig 3-10): 1-D signal, three pixels per sample, one row per σ
        const W = 240, SX = 3, LM = 64, rowH = 26, gap = 4, base = new Array(W).fill(60);
        [[20, 22], [60, 64], [100, 130], [150, 151], [170, 176], [200, 214]].forEach(([a0, b0], i) => { for (let x = a0; x < b0; x++) base[x] = i % 2 ? 210 : 170; });
        const ss = [0.5, 1, 2, 4, 8], secH = 22 + (rowH + gap) * (ss.length + 1), c = cvMS.getContext('2d');
        cvMS.width = LM + W * SX + 8; cvMS.height = secH * 2 + 10;
        c.fillStyle = UI.tok('--surface'); c.fillRect(0, 0, cvMS.width, cvMS.height);
        c.font = '12px ' + UI.tok('--sans').split(',')[0]; c.textBaseline = 'middle';
        const stripe = (arr, y0, map) => arr.forEach((v, x) => { const t = Math.max(0, Math.min(255, Math.round(map(v)))); c.fillStyle = `rgb(${t},${t},${t})`; c.fillRect(LM + x * SX, y0, SX, rowH); });
        ['(b) 1차 미분 |f′| — 밝을수록 크다', '(c) 2차 미분 f″ — 회색 = 0, 흑백 경계 = 영교차'].forEach((title, sec) => {
          const top = sec * (secH + 10);
          c.fillStyle = UI.tok('--ink'); c.textAlign = 'left'; c.fillText(title, 4, top + 10);
          c.fillStyle = UI.tok('--muted'); c.textAlign = 'right'; c.fillText('원래 영상', LM - 6, top + 22 + rowH / 2);
          stripe(base, top + 22, v => v);
          ss.forEach((s, i) => {
            const kk = CV.gaussian1D(s), rr = (kk.length - 1) / 2, sm = base.map((_, x) => kk.reduce((a, w, j) => a + w * base[CV.clamp(x + j - rr, 0, W - 1)], 0));
            const y0 = top + 22 + (i + 1) * (rowH + gap);
            if (sec === 0) { const g1 = sm.map((v, x) => Math.abs((sm[CV.clamp(x + 1, 0, W - 1)] - sm[CV.clamp(x - 1, 0, W - 1)]) / 2)), m1 = Math.max(...g1) || 1; stripe(g1, y0, v => v / m1 * 255); }
            else { const g2 = sm.map((v, x) => sm[CV.clamp(x + 1, 0, W - 1)] + sm[CV.clamp(x - 1, 0, W - 1)] - 2 * v), m2 = Math.max(...g2.map(Math.abs)) || 1; stripe(g2, y0, v => 128 + v / m2 * 127); }
            const on = Math.abs(s - sigma) < 0.26 || (i === ss.length - 1 && sigma > 6) ;
            c.fillStyle = UI.tok(on ? '--orange' : '--muted'); c.textAlign = 'right'; c.fillText('σ=' + s, LM - 6, y0 + rowH / 2);
            if (on) { c.strokeStyle = UI.tok('--orange'); c.lineWidth = 2; c.strokeRect(LM - 1, y0 - 1, W * SX + 2, rowH + 2); }
          });
        });
        // image scale-space: blur and gradient magnitude at the current σ and neighbours
        const g0 = UI.currentImage().gray;
        scaleRow.replaceChildren(...[Math.max(0.5, sigma / 2), sigma, sigma * 2].map((s, k) => {
          const bl = CV.gaussianBlur(g0, Math.min(s, 8)), E = CV.edgeMaps(bl, 'sobel');
          const a1 = UI.ImageView({ caption: `스무딩 σ=${s.toFixed(1)}` + (k === 1 ? ' (지금)' : '') }), a2 = UI.ImageView({ caption: `|∇| σ=${s.toFixed(1)}` });
          a1.draw(bl); a2.draw(E.S, 'abs');
          return h('div', { class: 'col' }, a1.el, a2.el);
        }));
      }
      const sl = UI.slider({ label: 'σ', min: 0.5, max: 8, step: 0.1, value: sigma, id: 'ga-s', fmt: v => v.toFixed(1), oninput: v => { sigma = v; draw(); } });
      root.append(h('div', { class: 'stack' },
        h('div', { class: 'card' }, h('div', { class: 'controls' }, sl, h('div', { class: 'presets' }, [0.5, 1, 2, 4, 8].map(s => h('button', { class: 'btn', onclick: () => { sigma = s; sl.set(s); draw(); } }, 'σ=' + s))))),
        h('div', { class: 'row' }, h('div', { class: 'card', style: { flex: '1 1 380px' } }, h('h3', {}, 'σ에 따른 가우시안', h('small', {}, '그림 3-11(a)')), cvA), h('div', { class: 'card', style: { flex: '1 1 380px' } }, h('h3', {}, '가우시안의 미분', h('small', {}, '그림 3-11(b)')), cvB)),
        h('div', { class: 'card' }, h('h3', {}, '이산 마스크'), cvK, info),
        h('div', { class: 'card' }, h('h3', {}, '다중 스케일 에지 효과', h('small', {}, '그림 3-10 · 주황 테두리 = 지금 σ에 가장 가까운 줄')), h('div', { class: 'tablewrap' }, cvMS),
          h('p', { class: 'caption' }, '원래 영상에는 폭이 다른 막대 여섯 개가 있습니다. σ가 작으면 막대마다 양쪽 에지가 따로 잡히지만, σ가 커질수록 좁은 막대(폭 1~4)의 두 에지가 하나로 뭉개지고 결국 넓은 막대(폭 30)의 에지만 남습니다 — “에지의 세밀함 조절”의 뜻입니다.')),
        h('div', { class: 'card' }, h('h3', {}, '영상에서의 다중 스케일', h('small', {}, 'σ/2 · σ · 2σ')), h('div', { class: 'controls' }, UI.imagePicker()), h('div', { style: { marginTop: '8px' } }, scaleRow),
          h('p', { class: 'caption' }, '아래 줄은 스무딩 후 소벨 강도입니다. σ가 커지면 잡음과 작은 무늬의 에지가 사라지고 큰 물체의 윤곽만 굵게 남습니다.'))));
      draw();
    },
  });

  // ================= 3.2.2 LoG =================
  APP.mod({
    id: 'log', ch: '3', num: '3.2.2', title: 'LOG 필터', src: '3강 p.19–23 · 알고리즘 3-1·3-2, 식 (3.10)–(3.12), 그림 3-13·3-15',
    blurb: '가우시안 + 라플라시안을 한 번에. 멕시코 모자 모양 커널과 다중 스케일 영교차 에지.',
    mount(root, m) {
      APP.scaffold(root, m, {
        lead: 'Marr-Hildreth는 가우시안으로 스무딩한 뒤 라플라시안(2차 미분)을 적용해 영교차를 에지로 잡습니다. 두 번 컨볼루션하는 대신 <b>가우시안의 라플라시안(LOG) 커널 한 번</b>으로 같은 결과를 얻습니다(계산량 감소, 이산화 오류 누적 방지). 영교차 판정 방법은 다음 페이지에서 한 화소씩 볼 수 있습니다.',
        formulas: [[R`$$\nabla^2 f=f(y{+}1,x)+f(y{-}1,x)+f(y,x{+}1)+f(y,x{-}1)-4f(y,x)$$`, '라플라시안 (3.10)'], [R`$$\mathrm{LOG}=\nabla^2(G\circledast f)=(\nabla^2G)\circledast f$$`, '식 (3.11)'], [R`$$\nabla^2G(y,x)=\left(\frac{y^2+x^2-2\sigma^2}{\sigma^4}\right)G(y,x)$$`, '식 (3.12)']],
      });
      let sigma = 2, frac = 0.05;
      const kbox = h('div'), cvX = h('canvas');
      const ivI = UI.ImageView({ caption: '입력' }), ivL = UI.ImageView({ caption: 'LOG 응답 (주황 +, 파랑 −)' }), ivA = UI.ImageView({ caption: '영교차 (T = 최대×비율)' }), ivB = UI.ImageView({ caption: '영교차 (T = 0)' });
      function kern() {
        const K = CV.logKernel(sigma), n = K.length, r = (n - 1) / 2;
        if (n <= 9) {
          const amax = Math.max(...K.flat().map(Math.abs));
          const g = UI.GridView({ rows: n, cols: n, cs: n <= 7 ? 52 : 44, fs: 10.5, axes: false, cell: (y, x) => ({ t: K[y][x].toFixed(4), ...APP.signedCell(K[y][x], amax) }) }); g.draw();
          kbox.replaceChildren(h('span', { class: 'caption' }, `${n}×${n} (6σ = ${(6 * sigma).toFixed(1)}), 합이 0이 되도록 평균을 뺌`), g.el);
        } else {
          const iv = UI.ImageView({ caption: `${n}×${n} 커널 (색 = 부호)` }); iv.draw(K, 'signed'); iv.el.style.maxWidth = '260px';
          kbox.replaceChildren(iv.el);
        }
        UI.plot(cvX, { w: 420, h: 170, x: [-r, r], y: [Math.min(...K[r]) * 1.1, Math.max(Math.max(...K[r]) * 1.3, 1e-4)], series: [{ type: 'line', data: K[r].map((v, i) => [i - r, v]), color: '--orange', width: 2.5 }, { type: 'points', data: K[r].map((v, i) => [i - r, v]), color: '--orange', r: 2.5 }], yfmt: v => v.toFixed(3) });
      }
      function apply() {
        const g = UI.currentImage().gray, L = CV.correlate2D(g, CV.logKernel(sigma)), mx = Math.max(...L.flat().map(Math.abs));
        ivI.draw(g); ivL.draw(L, 'signed', { amax: mx * 0.5 });
        ivA.draw(CV.zeroCross(L, mx * frac), 'binary'); ivB.draw(CV.zeroCross(L, 0), 'binary');
        ivA.setInfo(`T = ${(mx * frac).toFixed(1)}`);
      }
      UI.onImage(apply);
      root.append(h('div', { class: 'stack' },
        h('div', { class: 'card' }, h('div', { class: 'controls' }, UI.slider({ label: 'σ', min: 0.5, max: 5, step: 0.1, value: sigma, id: 'log-s', fmt: v => v.toFixed(1), oninput: v => { sigma = v; kern(); apply(); } }),
          UI.slider({ label: 'T 비율', min: 0, max: 0.3, step: 0.01, value: frac, id: 'log-t', fmt: v => v.toFixed(2), oninput: v => { frac = v; apply(); } }), UI.imagePicker())),
        h('div', { class: 'row' }, h('div', { class: 'card', style: { flex: '1 1 380px' } }, h('h3', {}, 'LOG 커널', h('small', {}, '그림 3-13')), kbox), h('div', { class: 'card', style: { flex: '1 1 380px' } }, h('h3', {}, '가운데 행 단면 — 멕시코 모자'), cvX, h('p', { class: 'caption' }, '가운데가 음수, 둘레가 양수. σ가 커질수록 넓고 얕아집니다.'))),
        h('div', { class: 'card' }, h('h3', {}, '다중 스케일 에지 검출', h('small', {}, '그림 3-15')), h('div', { class: 'imgs' }, ivI.el, ivL.el, ivA.el, ivB.el),
          h('p', { class: 'caption' }, 'T = 0이면 부호만 바뀌어도 에지가 되어 평탄한 영역의 작은 흔들림까지 잡힙니다. T를 최댓값의 5% 정도로 두면 의미 있는 영교차만 남습니다. σ를 키우면 윤곽이 부드러운 큰 곡선이 됩니다.'))));
      kern(); apply();
    },
  });

  // ================= 3.2.2 zero crossing step-through =================
  const ZC_BOOK = `0 0 0 0 0 0 0 0
0 1 1 0 0 0 0 0
0 1 1 1 0 1 0 0
0 1 0 1 0 1 0 0
0 1 1 1 1 1 0 0
0 1 0 0 0 1 1 0
0 0 0 1 1 1 1 0
0 0 0 0 0 0 0 0`;
  const BOOK_K = [[.4038, .8021, .4038], [.8021, -4.8233, .8021], [.4038, .8021, .4038]];
  APP.mod({
    id: 'zc', ch: '3', num: '3.2.2', title: '영교차 검출 단계별', src: '3강 p.21–22 · 알고리즘 3-2, 예제 3-2, 그림 3-14', star: true,
    blurb: '마주보는 네 쌍의 부호와 차이를 한 화소씩 검사. 교재 예제 3-2 그대로.',
    mount(root, m) {
      APP.scaffold(root, m, {
        lead: '예제 3-2: 8×8 영상에 σ=0.5, 3×3 LOG를 적용해 g를 얻고, 각 화소에서 <b>마주보는 네 쌍</b>(동-서, 남-북, 북동-남서, 북서-남동)을 조사합니다. <b>부호가 다르고 값 차이가 T를 넘는 쌍이 두 개 이상</b>이면 영교차(에지)입니다. 오른쪽 g 격자에 선으로 네 쌍을 그려 보여 줍니다 — 초록: 통과, 빨강: 부호는 다르지만 차이가 T 이하, 회색: 부호가 같음.',
        formulas: [],
      });
      let f = APP.parseGrid(EX31), T = 1.0, useBook = true, sigma = 0.5, g = null, frame = null, cmp = false;
      const book = APP.parseGrid(ZC_BOOK);
      const CODE = ['σ 크기의 LOG 필터를 입력 영상 f에 적용한다.   // 결과 g', '결과 영상에서 영교차를 찾아 에지로 설정하고, 나머지는 비에지로 설정한다.', 'for(j=1 to M-2) for(i=1 to N-2) {', '  네 쌍(동-서, 남-북, 북동-남서, 북서-남동)의 부호를 조사한다.', '  부호가 다른 쌍의 값 차이가 T를 넘는지 확인한다.', '  if(그런 쌍이 두 개 이상) b(j,i)=1;  else b(j,i)=0;', '}'];
      const st = UI.Stepper({ code: CODE, title: '알고리즘 3-2 + 영교차 규칙', render: fr => { frame = fr; draw(); } });
      const gF = UI.GridView({ rows: 8, cols: 8, cs: 21, fs: 10, label: '입력 f', cell: (y, x) => ({ t: f[y][x], color: f[y][x] ? '' : 'var(--faint)', cls: frame && frame.j !== undefined && Math.abs(frame.j - y) <= 1 && Math.abs(frame.i - x) <= 1 ? 'win' : '' }), onClick: (y, x, e) => { f[y][x] = (f[y][x] + (e.shiftKey ? 9 : 1)) % 10; rebuild(); } });
      let gmax = 1;
      const gG = UI.GridView({ rows: 8, cols: 8, cs: 48, fs: 9.5, label: 'LOG 결과 g', cell: (y, x) => { if (!g) return {}; const s = { t: g[y][x].toFixed(3), ...APP.signedCell(g[y][x], gmax) }; if (frame && frame.j === y && frame.i === x) s.cls = 'cur'; return s; } });
      const gB = UI.GridView({
        rows: 8, cols: 8, cs: 21, fs: 10, label: '영교차 b',
        cell: (y, x) => {
          if (!frame) return {};
          const done = frame.k !== undefined && (y - 1) * 6 + (x - 1) <= frame.k && y > 0 && x > 0 && y < 7 && x < 7;
          const v = done ? frame.b[y][x] : y === 0 || x === 0 || y === 7 || x === 7 ? 0 : '';
          const s = { t: v, cls: v === 1 ? 'on' : '' };
          if (cmp && done && book[y][x] !== frame.b[y][x]) { s.cls += ' cur'; s.title = `교재: ${book[y][x]}`; }
          if (frame.j === y && frame.i === x) s.cls += ' cur';
          return s;
        },
      });
      const pairBox = h('div');
      function rebuild() {
        const K = useBook ? BOOK_K : CV.logKernel(sigma).map(r => r.map(v => v));
        g = CV.correlate2D(f, K.length === 3 ? K : K, 'zero'); gmax = Math.max(...g.flat().map(Math.abs));
        const b = CV.zeros(8, 8), fr = [];
        fr.push({ line: 1, b: CV.clone(b), note: `f에 ${useBook ? '교재의 σ=0.5 3×3 LOG 마스크' : `σ=${sigma}의 LOG 마스크`}를 적용해 g를 얻었습니다 (영상 밖은 0).`, vars: { T } });
        let k = 0;
        for (let j = 1; j < 7; j++) for (let i = 1; i < 7; i++, k++) {
          const z = CV.zcAt(g, j, i, T);
          b[j][i] = z.edge ? 1 : 0;
          fr.push({ line: [4, 5], j, i, k: k - 1, z, b: CV.clone(b), vars: { j, i, 'g(j,i)': g[j][i], '통과한 쌍': z.nPass }, note: z.pairs.map(p => `${p.name}: ${p.va.toFixed(3)} / ${p.vb.toFixed(3)} → ${p.opp ? `부호 다름, 차이 ${p.diff.toFixed(4)} ${p.diff > T ? '> T ✔' : '≤ T ✘'}` : '부호 같음'}`).join('<br>') });
          fr.push({ line: 6, j, i, k, z, b: CV.clone(b), vars: { j, i, '통과한 쌍': z.nPass, 'b(j,i)': b[j][i] }, note: `통과한 쌍 ${z.nPass}개 → ${z.edge ? '<b>두 개 이상이므로 에지 (b=1)</b>' : '두 개 미만이므로 비에지 (b=0)'}` + (j === 6 && i === 3 ? ' — 교재가 동그라미로 표시한 (6,3): 남-북 7.6442, 북서-남동 5.2379 두 쌍이 T=1.0을 넘습니다.' : '') + (j === 2 && i === 2 && useBook ? ' — ⚠ 교재 그림 3-14(b)는 (2,2)를 1로 표시합니다. 교재 g에서 (2,1)이 −0.0000(아주 작은 음수)이라 동-서 쌍이 부호가 다른 것으로 판정되었기 때문입니다. 반올림된 마스크로 계산하면 +0.0003이 되어 결과가 달라집니다 — 영교차 판정이 0 근처 값에 얼마나 민감한지 보여 주는 예입니다.' : '') });
        }
        st.load(fr, frame ? Math.min(st.i, fr.length - 1) : 0);
      }
      function draw() {
        gF.draw(); gG.draw(); gB.draw();
        if (frame.z) {
          gG.overlay(frame.z.pairs.map(p => ({ type: 'line', pts: [frame.j + p.a[0], frame.i + p.a[1], frame.j + p.b[0], frame.i + p.b[1]], color: p.pass ? '--ok' : p.opp ? '--bad' : '--faint', w: p.pass ? 4 : 2.5, dash: !p.opp })));
          pairBox.replaceChildren(UI.dataTable(['쌍', '값 a', '값 b', '부호', '|a−b|', `> T(${T})`], frame.z.pairs.map(p => [p.name, p.va.toFixed(4), p.vb.toFixed(4), p.opp ? '다름' : '같음', p.diff.toFixed(4), p.pass ? '✔' : '✘'])));
        } else { gG.overlay([]); pairBox.replaceChildren(); }
      }
      const kSeg = UI.segmented([['book', '교재 마스크 (σ=0.5)'], ['calc', '식 (3.12)로 계산']], 'book', v => { useBook = v === 'book'; sSl.hidden = useBook; rebuild(); });
      const sSl = UI.slider({ label: 'σ', min: 0.5, max: 1.2, step: 0.05, value: 0.5, id: 'zc-s', fmt: v => v.toFixed(2), oninput: v => { sigma = v; rebuild(); } }); sSl.hidden = true;
      const cmpChk = h('input', { type: 'checkbox', id: 'zc-cmp' }); cmpChk.addEventListener('change', () => { cmp = cmpChk.checked; gB.draw(); });
      root.append(h('div', { class: 'lab' },
        h('div', { class: 'stack' },
          h('div', { class: 'card' }, h('div', { class: 'controls' }, kSeg, sSl, UI.slider({ label: '임계값 T', min: 0, max: 8, step: 0.1, value: T, id: 'zc-t', fmt: v => v.toFixed(1), oninput: v => { T = v; rebuild(); } }), h('span', { class: 'ctl' }, cmpChk, h('label', { for: 'zc-cmp' }, '교재 그림 3-14(b)와 다른 칸 표시'))),
            h('div', { class: 'row', style: { marginTop: '10px' } }, h('div', { class: 'col' }, h('span', { class: 'caption' }, 'LOG 결과 g — 선: 지금 화소의 네 쌍 (초록 통과 · 빨강 차이 부족 · 회색 점선 부호 같음)'), gG.el), h('div', { class: 'col' }, h('span', { class: 'caption' }, '입력 f (클릭 +1)'), gF.el, h('span', { class: 'caption' }, '영교차 b'), gB.el))),
          st.root,
          h('div', { class: 'card' }, h('h3', {}, '네 쌍 검사표'), pairBox)),
        h('div', { class: 'stack' }, st.panel)));
      rebuild();
    },
  });

  // ================= 3.3 Canny =================
  function cannySmall() {
    const n = 12, img = CV.zeros(n, n, 40);
    for (let y = 2; y <= 8; y++) for (let x = 2; x <= 8; x++) img[y][x] = x <= 5 ? 200 : 105;
    img[10][10] = 95; img[9][10] = 80;
    return img.map(r => r.map(v => v));
  }
  APP.mod({
    id: 'canny', ch: '3', num: '3.3', title: '캐니 에지', src: '3강 p.24–31 · 알고리즘 3-3·3-4, 그림 3-17·3-18', star: true,
    blurb: '가우시안 → 소벨 → 비최대 억제 → 이력 임계값. 파이프라인 전체와 한 화소씩 추적.',
    mount(root, m) {
      APP.scaffold(root, m, {
        lead: '캐니는 에지 검출을 최적화 문제로 풀었습니다(최소 오류율, 위치 정확도, 한 두께). ① 가우시안 스무딩 → ② 소벨로 강도 S와 방향 D → ③ <b>비최대 억제</b>: 에지에 수직인 두 이웃보다 크지 않으면 0 → ④ <b>이력 임계값</b>: T<sub>high</sub>를 넘는 화소에서 추적을 시작하고, 추적 중에는 T<sub>low</sub>만 넘으면 이어 갑니다. 위의 단계 카드를 눌러 각 중간 결과를 크게 보세요.',
        formulas: [],
      });
      // ---- pipeline ----
      let sigma = 1.2, tl = 40, th = 110, stage = 5, P = null;
      const stages = [['입력 f', ''], ['① 가우시안 g', 'σ 스무딩'], ['② 강도 S', '소벨'], ['② 방향 D', '8방향 색'], ['③ 비최대 억제', '얇은 에지'], ['④ 이력 임계값', '최종 e']];
      const thumbs = stages.map(() => UI.ImageView({})), big = UI.ImageView({ caption: '' });
      const flow = h('div', { class: 'flow' });
      const cmpA = UI.ImageView({ caption: '단일 임계값 S > T_high' }), cmpB = UI.ImageView({ caption: '단일 임계값 S > T_low' }), cmpC = UI.ImageView({ caption: '이력 임계값 (T_low, T_high)' });
      function pipe() {
        const f = UI.currentImage().gray, g = CV.gaussianBlur(f, sigma), E = CV.edgeMaps(g, 'sobel'), N = CV.nms(E.S, E.D), e = CV.hysteresis(N, tl, th);
        P = { f, g, E, N, e };
        const mS = Math.max(...E.S.flat());
        const dirImg = E.S.map((r, y) => r.map((s, x) => { const [a, b, c] = big.hsl(E.D[y][x] * 45, 0.85, 0.55), t = Math.min(1, s / mS * 2.5); return [a * t, b * t, c * t]; }));
        const drawers = [iv => iv.draw(f), iv => iv.draw(g), iv => iv.draw(E.S, 'abs'), iv => iv.draw(dirImg, 'rgb'), iv => iv.draw(N, 'abs', { gain: 1.8 }), iv => iv.draw(e, 'binary')];
        drawers.forEach((d, k) => d(thumbs[k]));
        drawers[stage](big); big.setCaption(stages[stage][0]);
        big.setInfo(stage === 5 ? `에지 화소 ${e.flat().filter(Boolean).length}개` : stage === 2 ? `최대 S = ${mS.toFixed(0)}` : '');
        cmpA.draw(N.map(r => r.map(v => (v > th ? 1 : 0))), 'binary'); cmpB.draw(N.map(r => r.map(v => (v > tl ? 1 : 0))), 'binary'); cmpC.draw(e, 'binary');
        flow.querySelectorAll('.stage').forEach((s, k) => s.setAttribute('aria-pressed', String(k === stage)));
      }
      stages.forEach(([t, c], k) => {
        if (k) flow.append(h('span', { class: 'arr', 'aria-hidden': 'true' }, '→'));
        flow.append(h('button', { class: 'stage', type: 'button', onclick: () => { stage = k; pipe(); } }, h('b', {}, t), h('span', { class: 'caption' }, c), thumbs[k].el));
      });
      UI.onImage(pipe);
      // ---- small grid step-through ----
      const small = cannySmall(), sg = CV.gaussianBlur(small, 0.8), SE = CV.edgeMaps(sg, 'sobel');
      const S0 = SE.S.map(r => r.map(v => Math.round(v))), D0 = SE.D;
      const n = S0.length, smax = Math.max(...S0.flat());
      let gl = Math.round(smax * 0.18), gh = Math.round(smax * 0.45), frame = null;
      const CODE = ['f에 크기 σ인 가우시안을 적용하여 g를 얻는다.', 'g에 소벨 연산자를 적용하여, 에지 강도 맵 S와 에지 방향 맵 D를 얻는다.  // D는 8-방향 양자화', '', '// 5~9행 : 비최대 억제', 'for(y=1 to M-2)', '  for(x=1 to N-2) {', '    (y1,x1)과 (y2,x2)를 (y,x)의 두 이웃 화소라 하자.  // [그림 3-17] 참고', '    if(S(y,x)≤S(y1,x1) or S(y,x)≤S(y2,x2)) S(y,x)=0;  // 비최대 억제', '  }', '', '// 12~16행 : 이력 임계값을 이용한 에지 추적', 'e(y,x)=0, 0≤y≤M-1, 0≤x≤N-1;', 'visited(y,x)=0, 0≤y≤M-1, 0≤x≤N-1;  // 모든 화소가 아직 방문 안됨', 'for(y=1 to M-2)', '  for(x=1 to N-2)', '    if(S(y,x)>T_high and visited(y,x)=0) follow_edge(y,x);', '', '// 에지를 추적하는 재귀 함수(배열은 모두 전역변수라 가정)', 'function follow_edge(y,x) {', '  visited(y,x)=1;  // 방문했음을 표시', '  e(y,x)=1;  // 에지로 판정', '  for((y,x)의 8 이웃 (ny,nx) 각각에 대해)', '    if(S(ny,nx)>T_low and visited(ny,nx)=0) follow_edge(ny,nx);', '}'];
      const st = UI.Stepper({ code: CODE, title: '알고리즘 3-4 캐니 에지 검출', render: fr => { frame = fr; drawG(); } });
      const DIRCH = ['→', '↘', '↓', '↙', '←', '↖', '↑', '↗'];
      const gv = UI.GridView({
        rows: n, cols: n, cs: 38, fs: 11, label: '에지 강도 S',
        cell: (y, x) => {
          if (!frame) return {};
          const S = frame.S[y][x];
          const s = { t: S || '', sub: S && frame.ph === 'nms' ? DIRCH[D0[y][x]] : undefined };
          if (frame.ph === 'nms') Object.assign(s, APP.grayCell(frame.S[y][x], smax));
          else {
            if (frame.e[y][x]) { s.cls = 'on'; }
            else if (S > gh) { s.color = 'var(--bad)'; s.bold = true; }
            else if (S > gl) { s.color = 'var(--orange)'; }
            else s.color = 'var(--faint)';
          }
          if (frame.nb && frame.nb.some(([a, b]) => a === y && b === x)) s.cls = (s.cls || '') + ' win2';
          if (frame.cur && frame.cur[0] === y && frame.cur[1] === x) s.cls = (s.cls || '') + ' cur';
          return s;
        },
      });
      function framesSmall() {
        const fr = [], S = S0.map(r => r.slice()), orig = S0;
        fr.push({ ph: 'nms', S: CV.clone(S), line: [1, 2], note: `12×12 예제에 σ=0.8 가우시안과 소벨을 적용한 에지 강도 S입니다. 작은 화살표는 양자화된 에지 방향 D.`, vars: { M: n, N: n } });
        for (let y = 1; y < n - 1; y++) for (let x = 1; x < n - 1; x++) {
          if (!orig[y][x]) continue;
          const d = D0[y][x], [[a, b], [c, e]] = CV.NMS_NB[d % 4], s1 = orig[y + a][x + b], s2 = orig[y + c][x + e];
          const sup = orig[y][x] <= s1 || orig[y][x] <= s2;
          if (sup) S[y][x] = 0;
          fr.push({ ph: 'nms', S: CV.clone(S), cur: [y, x], nb: [[y + a, x + b], [y + c, x + e]], line: [7, 8], vars: { y, x, 'S(y,x)': orig[y][x], 'D(y,x)': d, 'S(y1,x1)': s1, 'S(y2,x2)': s2 }, note: `에지 방향 ${d}(${DIRCH[d]}) → 에지에 수직인 두 이웃 (${y + a},${x + b}), (${y + c},${x + e})와 비교: ${orig[y][x]} vs ${s1}, ${s2} → ${sup ? '<b>억제 (S=0)</b>' : '<b>가장 커서 유지</b>'}` });
        }
        const e = CV.zeros(n, n), vis = CV.zeros(n, n), stack = [];
        const snap = (line, note, cur, extra = {}) => fr.push({ ph: 'hyst', S, e: CV.clone(e), cur, line, note, stack: stack.map(([y, x, l]) => `<span class="fname">follow_edge</span>(${y}, ${x}) <span style="color:var(--muted)">· ${l}행</span>`), vars: { T_low: gl, T_high: gh, ...extra } });
        snap([12, 13], `비최대 억제 끝. 이제 e와 visited를 0으로 초기화합니다. 빨강 굵은 숫자: S > T_high(${gh}), 주황: T_low(${gl}) < S ≤ T_high.`);
        const follow = (y, x) => {
          stack.push([y, x, 20]); vis[y][x] = 1; e[y][x] = 1;
          snap([20, 21], `follow_edge(${y},${x}): 방문 표시하고 에지로 판정 (S=${S[y][x]})`, [y, x], { y, x });
          for (const [a, b] of CV.DIR8) {
            const ny = y + a, nx = x + b;
            if (ny <= 0 || nx <= 0 || ny >= n - 1 || nx >= n - 1) continue;
            if (S[ny][nx] > gl && !vis[ny][nx]) {
              stack[stack.length - 1][2] = 23;
              snap(23, `이웃 (${ny},${nx})의 S=${S[ny][nx]} > T_low(${gl})이고 아직 방문 안 함 → 재귀 호출`, [y, x], { y, x, ny, nx });
              follow(ny, nx);
            }
          }
          stack.pop();
        };
        for (let y = 1; y < n - 1; y++) for (let x = 1; x < n - 1; x++) {
          if (S[y][x] > gh && !vis[y][x]) { snap(16, `(${y},${x})의 S=${S[y][x]} > T_high(${gh})이고 미방문 → <b>여기서 추적 시작</b>`, [y, x], { y, x }); follow(y, x); }
        }
        const weak = [];
        for (let y = 1; y < n - 1; y++) for (let x = 1; x < n - 1; x++) if (S[y][x] > gl && !e[y][x]) weak.push(`(${y},${x})`);
        snap([], `완료. T_low는 넘지만 강한 에지와 이어지지 않은 화소 ${weak.length ? weak.join(', ') : '없음'}은 거짓 긍정으로 보고 버렸습니다.`);
        return fr;
      }
      function drawG() {
        gv.draw();
        if (frame.ph === 'nms' && frame.cur && frame.nb) {
          const [y, x] = frame.cur, d = D0[y][x], ea = d * Math.PI / 4;
          gv.overlay([
            { type: 'line', pts: [y - Math.sin(ea) * 0.9, x - Math.cos(ea) * 0.9, y + Math.sin(ea) * 0.9, x + Math.cos(ea) * 0.9], color: '--neg', w: 3 },
            ...frame.nb.map(([a, b]) => ({ type: 'arrow', pts: [y, x, y + (a - y) * 0.8, x + (b - x) * 0.8], color: '--bad', w: 2.5 })),
          ]);
        } else gv.overlay([]);
      }
      const rebuildSmall = () => st.load(framesSmall(), frame ? Math.min(st.i, 1e9) : 0);
      root.append(h('div', { class: 'stack' },
        h('div', { class: 'card' }, h('div', { class: 'controls' }, UI.imagePicker(),
          UI.slider({ label: 'σ', min: 0.5, max: 4, step: 0.1, value: sigma, id: 'cn-s', fmt: v => v.toFixed(1), oninput: v => { sigma = v; pipe(); } }),
          UI.slider({ label: 'T_low', min: 0, max: 400, value: tl, id: 'cn-l', oninput: v => { tl = v; pipe(); } }),
          UI.slider({ label: 'T_high', min: 0, max: 600, value: th, id: 'cn-h', oninput: v => { th = v; pipe(); } })),
          h('div', { style: { marginTop: '12px' } }, flow), h('div', { style: { marginTop: '12px', maxWidth: '640px' } }, big.el)),
        h('div', { class: 'card' }, h('h3', {}, '왜 임계값이 두 개인가', h('small', {}, 'T_high만 쓰면 에지가 끊기고, T_low만 쓰면 잡음이 섞입니다')), h('div', { class: 'imgs' }, cmpA.el, cmpB.el, cmpC.el)),
        h('h2', { style: { fontSize: '17px', margin: '10px 0 0' } }, '한 화소씩: 비최대 억제와 이력 임계값 추적'),
        h('div', { class: 'lab wide-code' },
          h('div', { class: 'stack' },
            h('div', { class: 'card' }, h('div', { class: 'controls' },
              UI.slider({ label: 'T_low', min: 0, max: smax, value: gl, id: 'cn-gl', oninput: v => { gl = v; rebuildSmall(); } }),
              UI.slider({ label: 'T_high', min: 0, max: smax, value: gh, id: 'cn-gh', oninput: v => { gh = v; rebuildSmall(); } })),
              h('div', { style: { marginTop: '10px' } }, gv.el),
              h('p', { class: 'caption' }, '주황 테두리: 지금 화소 · 파란 선: 양자화된 에지 방향 · 빨간 화살표: 에지에 수직인 두 이웃(비교 대상) / 추적 단계에서 검은 칸 = e=1, 빨간 굵은 숫자 > T_high, 주황 숫자 > T_low')),
            st.root,
            h('div', { class: 'note warn' }, '두 가지 짚을 점 — ① 교재 8행은 S를 제자리에서 0으로 바꾸는데, 그러면 이미 억제된 위·왼쪽 이웃과 비교하게 됩니다. 여기서는 억제 전의 원래 S와 비교합니다. ② 교재 23행의 visited(y,x)=0은 visited(ny,nx)=0의 오타로 보고 이웃의 방문 여부를 검사합니다.')),
          h('div', { class: 'stack' }, st.panel))));
      pipe(); rebuildSmall();
    },
  });

  // ================= 3.3 metrics =================
  APP.mod({
    id: 'metrics', ch: '3', num: '3.3', title: '인식 성능 측정', src: '3강 p.25–26 · 식 (1.1)–(1.4), 혼동 행렬',
    blurb: '혼동 행렬 → 정확률, 재현율, F 측정. 부류 불균형에서 정인식률이 속이는 경우.',
    mount(root, m) {
      APP.scaffold(root, m, {
        lead: '에지 검출기의 결과는 “에지/비에지” 분류로 볼 수 있습니다. 정인식률 하나만 보면 부류가 심하게 불균형할 때(에지 화소는 영상의 몇 %뿐) 좋은 검출기처럼 보일 수 있습니다. 혼동 행렬의 네 칸을 바꿔 가며 지표를 비교해 보세요.',
        formulas: [[R`$$\text{정확률}=\frac{TP}{TP+FP},\quad\text{재현율}=\frac{TP}{TP+FN}$$`, '식 (1.3)'], [R`$$F_\beta=(1+\beta^2)\frac{\text{정확률}\times\text{재현율}}{\beta^2\times\text{정확률}+\text{재현율}}$$`, '식 (1.4)']],
      });
      let c = { TP: 80, FN: 20, FP: 30, TN: 870 }, beta = 1;
      const out = h('div'), inps = {};
      const box = h('div', { class: 'tablewrap' });
      function upd() {
        const { TP, FN, FP, TN } = c, N = TP + FN + FP + TN, d = (a, b) => (b ? a / b : NaN);
        const P = d(TP, TP + FP), Rr = d(TP, TP + FN), F = d((1 + beta * beta) * P * Rr, beta * beta * P + Rr);
        const rows = [['정인식률 (TP+TN)/N', d(TP + TN, N)], ['거짓 긍정률 FPR', d(FP, FP + TN)], ['거짓 부정률 FNR', d(FN, TP + FN)], ['참 긍정률 TPR (=재현율)', Rr], ['참 부정률 TNR', d(TN, FP + TN)], ['정확률 (precision)', P], ['재현율 (recall)', Rr], [`F${beta === 1 ? '₁' : 'β (β=' + beta + ')'}`, F]];
        out.replaceChildren(h('div', { class: 'row' }, ...rows.map(([k, v]) => h('div', { class: 'card', style: { flex: '1 1 150px', padding: '10px 12px' } }, h('div', { class: 'caption' }, k), h('div', { class: 'mono', style: { fontSize: '22px' } }, isNaN(v) ? '—' : v.toFixed(3))))));
      }
      const mk = k => { const i = h('input', { type: 'number', min: 0, value: c[k], style: { width: '90px' }, id: 'mt-' + k, 'aria-label': k }); i.addEventListener('input', () => { c[k] = Math.max(0, +i.value || 0); upd(); }); inps[k] = i; return i; };
      box.append(h('table', { class: 'data' }, h('tr', {}, h('th', {}, ''), h('th', {}, '실제 에지'), h('th', {}, '실제 비에지')), h('tr', {}, h('th', {}, '에지로 검출'), h('td', {}, 'TP ', mk('TP')), h('td', {}, 'FP ', mk('FP'))), h('tr', {}, h('th', {}, '비에지로 판정'), h('td', {}, 'FN ', mk('FN')), h('td', {}, 'TN ', mk('TN')))));
      const set = v => { Object.assign(c, v); Object.keys(v).forEach(k => (inps[k].value = v[k])); upd(); };
      root.append(h('div', { class: 'stack' },
        h('div', { class: 'card' }, h('h3', {}, '혼동 행렬'), box, h('div', { class: 'controls', style: { marginTop: '10px' } },
          UI.slider({ label: 'β', min: 0.25, max: 4, step: 0.25, value: 1, id: 'mt-b', fmt: v => v.toFixed(2), oninput: v => { beta = v; upd(); } }),
          h('button', { class: 'btn', onclick: () => set({ TP: 0, FN: 1, FP: 0, TN: 999 }) }, '불량률 0.1%에서 “모두 정상” 짐작'),
          h('button', { class: 'btn', onclick: () => set({ TP: 80, FN: 20, FP: 30, TN: 870 }) }, '보통 검출기'))),
        out, h('p', { class: 'caption' }, '“모두 정상” 짐작은 정인식률 0.999지만 재현율 0 — 결함을 하나도 못 찾습니다. β > 1이면 재현율을, β < 1이면 정확률을 더 중시합니다.')));
      upd();
    },
  });

  // ================= 3.4 colour edges =================
  APP.mod({
    id: 'coloredge', ch: '3', num: '3.4', title: '컬러 에지', src: '3강 p.32–34 · 식 (3.13)–(3.15), 그림 3-19~3-21',
    blurb: 'RGB 채널별 OR 결합의 불일치 vs 디 젠조 방법. 등휘도 영상에서 명암 에지가 사라지는 경우.',
    mount(root, m) {
      APP.scaffold(root, m, {
        lead: 'RGB 채널마다 에지를 구해 OR로 합치면 채널마다 에지 위치가 조금씩 어긋나 <b>불일치</b>가 생깁니다(그림 3-20). <b>디 젠조 방법</b>은 세 채널의 그레이디언트를 함께 써서 변화가 가장 큰 방향과 그 크기를 구합니다. “등휘도 컬러” 영상에서는 명암만 쓰면 색이 다른 경계가 거의 사라지는 것도 확인해 보세요. 영상 위에 마우스를 올리면 그 화소의 값이 나옵니다.',
        formulas: [[R`$$g_{yy}=d_{yr}^2+d_{yg}^2+d_{yb}^2,\;g_{xx}=d_{xr}^2+d_{xg}^2+d_{xb}^2,\;g_{yx}=d_{yr}d_{xr}+d_{yg}d_{xg}+d_{yb}d_{xb}$$`, '식 (3.13)'], [R`$$D=\tfrac12\arctan\!\left(\frac{2g_{yx}}{g_{xx}-g_{yy}}\right)$$`, '식 (3.14)'], [R`$$S=\sqrt{0.5\big((g_{yy}+g_{xx})+(g_{xx}-g_{yy})\cos 2D+2g_{yx}\sin 2D\big)}$$`, '식 (3.15)']],
      });
      let frac = 0.2, Z = null, sel = null;
      const vec = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      vec.setAttribute('viewBox', '-120 -120 240 240'); vec.style.width = '240px'; vec.style.flex = '0 0 auto';
      const hov = (y, x) => {
        if (!Z) return;
        sel = [y, x];
        const q = Z.at[y][x], E = Z.E;
        const g = E.map(e => [e.dx[y][x], e.dy[y][x]]), zx = Math.cos(q.D) * q.S, zy = Math.sin(q.D) * q.S;
        const sc = 95 / Math.max(1e-9, q.S, ...g.map(([a, b]) => Math.hypot(a, b)));
        const ar = (dx, dy, col, w) => `<line x1="0" y1="0" x2="${dx * sc}" y2="${dy * sc}" stroke="${col}" stroke-width="${w}" stroke-linecap="round" marker-end="url(#ce-${col.replace(/[^a-z]/g, '')})"/>`;
        const mk = ['#d33', '#2a2', '#36d', 'var(--ink)'].map(cl => `<marker id="ce-${cl.replace(/[^a-z]/g, '')}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${cl}"/></marker>`).join('');
        vec.innerHTML = `<defs>${mk}</defs><circle r="100" fill="none" stroke="var(--rule)"/><line x1="-110" y1="0" x2="110" y2="0" stroke="var(--rule)"/><line x1="0" y1="-110" x2="0" y2="110" stroke="var(--rule)"/>` +
          `<line x1="${-zx * sc}" y1="${-zy * sc}" x2="${zx * sc}" y2="${zy * sc}" stroke="var(--orange)" stroke-width="9" opacity="0.35" stroke-linecap="round"/>` +
          ar(g[0][0], g[0][1], '#d33', 3) + ar(g[1][0], g[1][1], '#2a2', 3) + ar(g[2][0], g[2][1], '#36d', 3) +
          `<text x="112" y="-6" font-size="11" text-anchor="end" fill="var(--muted)">x</text><text x="6" y="114" font-size="11" fill="var(--muted)">y</text>`;
        info.replaceChildren(h('div', { class: 'row', style: { alignItems: 'center' } }, vec, h('div', { class: 'col', style: { flex: '1 1 280px' } },
          h('b', {}, `화소 (${y}, ${x})`),
          h('span', { class: 'caption' }, '빨강·초록·파랑 화살표 = R, G, B 채널 각각의 그레이디언트 (d_x, d_y). 주황 굵은 막대 = 디 젠조가 고른 방향 D와 크기 S. 세 화살표가 서로 다른 쪽을 가리키면 OR 결합은 채널마다 다른 위치에 에지를 찍지만, 디 젠조는 세 채널을 합쳐 변화가 가장 큰 방향 하나를 고릅니다.'),
          h('span', { class: 'mono' }, `g_yy=${q.gyy.toFixed(0)}, g_xx=${q.gxx.toFixed(0)}, g_yx=${q.gyx.toFixed(0)}`),
          h('span', { class: 'mono' }, `D = ½·atan(2g_yx/(g_xx−g_yy)) = ${(q.D * 180 / Math.PI).toFixed(1)}°,  S = ${q.S.toFixed(1)}`),
          h('span', { class: 'mono' }, `R/G/B 각 채널 S = ${E.map(e => e.S[y][x].toFixed(0)).join(' / ')} · 명암 소벨 S = ${Z.gS[y][x].toFixed(1)}`))));
        Z.redraw([y, x]);
      };
      const ivI = UI.ImageView({ caption: '입력 (클릭·이동하면 그 화소 분석)', onHover: hov }), ivG = UI.ImageView({ caption: '명암 영상의 소벨 S', onHover: hov }), ivO = UI.ImageView({ caption: 'R/G/B 각각 이진화 후 OR (색 = 어느 채널)', onHover: hov }), ivZ = UI.ImageView({ caption: '디 젠조 S', onHover: hov }), ivA = UI.ImageView({ caption: 'RGB 채널 S의 평균', onHover: hov }), ivZb = UI.ImageView({ caption: '디 젠조 S 이진화', onHover: hov });
      const info = h('div', { class: 'card' });
      function run() {
        const img = UI.currentImage(), H = img.h, W = img.w;
        const ch = k => CV.gaussianBlur(img.rgb.map(r => r.map(p => p[k])), 1);
        const E = [0, 1, 2].map(k => CV.edgeMaps(ch(k), 'sobel')), gS = CV.edgeMaps(CV.gaussianBlur(img.gray, 1), 'sobel').S;
        const at = [], zS = CV.zeros(H, W), avg = CV.zeros(H, W);
        for (let y = 0; y < H; y++) { const row = []; for (let x = 0; x < W; x++) {
          let gyy = 0, gxx = 0, gyx = 0;
          for (const e of E) { gyy += e.dy[y][x] ** 2; gxx += e.dx[y][x] ** 2; gyx += e.dy[y][x] * e.dx[y][x]; }
          let D = 0.5 * Math.atan2(2 * gyx, gxx - gyy);
          const S = Math.sqrt(Math.max(0, 0.5 * ((gyy + gxx) + (gxx - gyy) * Math.cos(2 * D) + 2 * gyx * Math.sin(2 * D))));
          row.push({ gyy, gxx, gyx, D, S }); zS[y][x] = S; avg[y][x] = (E[0].S[y][x] + E[1].S[y][x] + E[2].S[y][x]) / 3;
        } at.push(row); }
        const mx = Math.max(...zS.flat()), T = mx * frac, chM = E.map(e => Math.max(...e.S.flat()));
        const orImg = E[0].S.map((r, y) => r.map((_, x) => E.map((e, k) => (e.S[y][x] > chM[k] * frac * 1.2 ? 255 : 0))));
        const redraw = p => {
          const o = p ? { rects: [{ x: p[1] - 3, y: p[0] - 3, ww: 7, hh: 7, color: '--orange', w: 1 }] } : {};
          ivI.draw(img.rgb, 'rgb', o); ivG.draw(gS, 'abs', { amax: mx / Math.sqrt(3), ...o }); ivZ.draw(zS, 'abs', o); ivA.draw(avg, 'abs', o);
          ivO.draw(orImg, 'rgb', o); ivZb.draw(zS.map(r => r.map(v => (v > T ? 1 : 0))), 'binary', o);
        };
        Z = { at, gS, E, redraw };
        // default: the pixel where the three channel gradients disagree most (strong edge, low alignment)
        if (!sel || sel[0] >= H || sel[1] >= W) {
          let best = -1;
          for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) {
            const q = at[y][x]; if (q.S < mx * 0.3) continue;
            const sumMag = E.reduce((s, e) => s + Math.hypot(e.dx[y][x], e.dy[y][x]), 0), score = sumMag - q.S;
            if (score > best) { best = score; sel = [y, x]; }
          }
          if (!sel) sel = [H >> 1, W >> 1];
        }
        hov(...sel);
      }
      UI.onImage(() => { sel = null; run(); });
      root.append(h('div', { class: 'stack' },
        h('div', { class: 'card' }, h('div', { class: 'controls' }, UI.imagePicker(), h('button', { class: 'btn', onclick: () => UI.setImage('iso') }, '등휘도 컬러로 보기'), UI.slider({ label: '임계 비율', min: 0.05, max: 0.6, step: 0.01, value: frac, id: 'ce-t', fmt: v => v.toFixed(2), oninput: v => { frac = v; run(); } })),
          h('div', { class: 'imgs', style: { marginTop: '10px' } }, ivI.el, ivG.el, ivO.el, ivZ.el, ivA.el, ivZb.el)), info,
        h('p', { class: 'caption' }, 'OR 결과에서 흰색이 아닌 색(빨강·초록·파랑·노랑 등)은 일부 채널만 에지로 판정한 곳입니다 — 그 색이 섞인 테두리가 불일치입니다. 계산 전에 σ=1 가우시안을 각 채널에 적용했습니다.')));
      run();
    },
  });
})();

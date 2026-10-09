// Chapter 2 modules, part A: histogram, Otsu, connected components, point ops
(() => {
  const { h, fmt } = UI;
  const R = String.raw;
  const EX21 = `3 2 2 2 2 3 3 4
3 2 2 2 3 4 3 3
4 3 3 4 4 4 3 3
5 4 4 4 5 4 3 3
5 4 3 4 5 4 3 2
6 5 4 4 5 4 3 2
6 6 5 5 4 3 2 2
6 5 4 5 4 3 2 2`;

  // ================= 2.2 histogram equalization =================
  APP.mod({
    id: 'hist', ch: '2', num: '2.2', title: '히스토그램 평활화', src: '2강 p.12–17 · 예제 2-1, 2-2', star: true,
    blurb: '명암값 세기 → 정규화 → 누적 → 매핑 함수 T(l). 8×8 예제를 한 화소씩 따라가기.',
    mount(root, m) {
      APP.scaffold(root, m, {
        lead: '히스토그램은 각 명암값이 영상에 몇 번 나오는지 센 것입니다. <b>평활화</b>는 누적 히스토그램 c(·)를 매핑 함수로 써서 명암의 동적 범위를 넓힙니다. 왼쪽 8×8 영상(L=8)의 칸을 클릭하면 값이 +1 (Shift+클릭은 −1) 되고, 모든 단계가 다시 계산됩니다.',
        formulas: [[R`$$\hat h(l)=\frac{h(l)}{M\times N}$$`, '정규화 히스토그램'], [R`$$l_{out}=T(l_{in})=\mathrm{round}\big(c(l_{in})\times(L-1)\big),\qquad c(l_{in})=\sum_{l=0}^{l_{in}}\hat h(l)$$`, '식 (2.3)']],
      });
      const L = 8;
      let f = APP.parseGrid(EX21), frame = null;
      const CODE = [
        'for(j=0 to M-1) for(i=0 to N-1)',
        '    h(f(j,i))++;                        // 히스토그램 h 계산',
        'for(l=0 to L-1) ĥ(l) = h(l)/(M×N);     // 정규화',
        'for(l=0 to L-1) c(l) = ĥ(0)+…+ĥ(l);    // 누적 히스토그램',
        'for(l=0 to L-1) T(l) = round(c(l)×(L-1));  // 식 (2.3) 매핑 함수',
        'for(j=0 to M-1) for(i=0 to N-1)',
        '    f_out(j,i) = T(f(j,i));             // 매핑 적용',
      ];
      const st = UI.Stepper({ code: CODE, title: '평활화 의사 코드', render: fr => { frame = fr; draw(); } });
      const gin = UI.GridView({
        rows: 8, cols: 8, cs: 32, label: '입력 영상',
        cell: (y, x) => ({ t: f[y][x], ...APP.grayCell(f[y][x], L - 1), cls: frame && (frame.ph === 0 || frame.ph === 4) && frame.j === y && frame.i === x ? 'cur' : '' }),
        onClick: (y, x, e) => { f[y][x] = (f[y][x] + (e.shiftKey ? L - 1 : 1)) % L; rebuild(); },
      });
      const gout = UI.GridView({
        rows: 8, cols: 8, cs: 32, label: '평활화된 영상',
        cell: (y, x) => {
          if (!frame || frame.ph < 4 || y * 8 + x > frame.k) return { t: '' };
          const v = E.map[f[y][x]];
          return { t: v, ...APP.grayCell(v, L - 1), cls: frame.j === y && frame.i === x ? 'cur' : '' };
        },
      });
      const cvH = h('canvas'), cvC = h('canvas'), cvO = h('canvas');
      const tbl = h('div');
      const mapSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      mapSvg.setAttribute('viewBox', '0 0 460 150'); mapSvg.style.width = '100%'; mapSvg.style.maxWidth = '560px';
      let E = CV.equalize(f, L);
      function rebuild() {
        E = CV.equalize(f, L);
        const fr = [], hh = new Array(L).fill(0);
        for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) {
          const v = f[j][i]; hh[v]++;
          fr.push({ line: [1, 2], ph: 0, k: j * 8 + i, j, i, row: v, vars: { j, i, 'f(j,i)': v, [`h(${v})`]: hh[v] }, note: `화소 <b>(${j},${i})</b>의 명암값은 <b>${v}</b> → h(${v})를 1 늘림: ${hh[v] - 1} → <b>${hh[v]}</b>` });
        }
        for (let l = 0; l < L; l++) fr.push({ line: 3, ph: 1, k: l, row: l, vars: { l, 'h(l)': E.h[l], 'ĥ(l)': E.hn[l] }, note: `ĥ(${l}) = h(${l}) / 64 = ${E.h[l]} / 64 = <b>${E.hn[l].toFixed(3)}</b>` });
        for (let l = 0; l < L; l++) fr.push({ line: 4, ph: 2, k: l, row: l, vars: { l, 'ĥ(l)': E.hn[l], 'c(l)': E.c[l] }, note: l ? `c(${l}) = c(${l - 1}) + ĥ(${l}) = ${E.c[l - 1].toFixed(3)} + ${E.hn[l].toFixed(3)} = <b>${E.c[l].toFixed(3)}</b>` : `c(0) = ĥ(0) = <b>${E.c[0].toFixed(3)}</b>` });
        for (let l = 0; l < L; l++) fr.push({ line: 5, ph: 3, k: l, row: l, vars: { l, 'c(l)': E.c[l], 'c(l)×7': E.c[l] * 7, 'T(l)': E.map[l] }, note: `T(${l}) = round(${E.c[l].toFixed(3)} × 7) = round(${(E.c[l] * 7).toFixed(3)}) = <b>${E.map[l]}</b> — 입력 ${l}은 출력 ${E.map[l]}로 바뀝니다.` });
        for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) {
          const v = f[j][i];
          fr.push({ line: [6, 7], ph: 4, k: j * 8 + i, j, i, row: v, vars: { j, i, 'f(j,i)': v, 'f_out(j,i)': E.map[v] }, note: `f_out(${j},${i}) = T(${v}) = <b>${E.map[v]}</b>` });
        }
        st.load(fr, frame ? Math.min(st.i, fr.length - 1) : 0);
      }
      function draw() {
        gin.draw(); gout.draw();
        const ph = frame.ph, k = frame.k;
        const hp = new Array(L).fill(0);
        if (ph === 0) for (let p = 0; p <= k; p++) hp[f[p >> 3][p & 7]]++; else E.h.forEach((v, i) => (hp[i] = v));
        const hmax = Math.max(20, ...E.h);
        UI.plot(cvH, { w: 300, h: 170, x: [-0.5, L - 0.5], y: [0, hmax], xticks: [...Array(L).keys()], series: [{ type: 'bar', data: hp, color: '--ink', colorAt: x => (x === frame.row && (ph === 0) ? '--orange' : '--ink') }] });
        const cs = E.c.map((v, i) => (ph < 2 || (ph === 2 && i > k) ? null : v));
        UI.plot(cvC, { w: 300, h: 170, x: [-0.5, L - 0.5], y: [0, L - 1], xticks: [...Array(L).keys()], yticks: [0, 1, 2, 3, 4, 5, 6, 7], series: [{ type: 'line', data: cs.map((v, i) => [i, v === null ? null : v * (L - 1)]), color: '--green', width: 2 }, { type: 'points', data: E.map.map((v, i) => [i, ph < 3 || (ph === 3 && i > k) ? null : v]), color: '--orange', r: 4 }], legend: [['c(l)×7', '--green'], ['T(l)', '--orange']] });
        const ho = new Array(L).fill(0);
        if (ph === 4) for (let p = 0; p <= k; p++) ho[E.map[f[p >> 3][p & 7]]]++;
        UI.plot(cvO, { w: 300, h: 170, x: [-0.5, L - 0.5], y: [0, hmax], xticks: [...Array(L).keys()], series: [{ type: 'bar', data: ho, color: '--green' }] });
        const show = (p, l) => ph > p || (ph === p && l <= k);
        {
          const X = l => 30 + l * 57, hm = Math.max(...E.h, 1);
          let s = `<text x="0" y="28" font-size="11" fill="var(--muted)">입력</text><text x="0" y="134" font-size="11" fill="var(--muted)">출력</text>`;
          for (let l = 0; l < L; l++) {
            const w = 3 + E.h[l] / hm * 30;
            s += `<rect x="${X(l) - w / 2}" y="10" width="${w}" height="22" rx="3" fill="var(--ink)" opacity="${E.h[l] ? 0.85 : 0.12}"/><text x="${X(l)}" y="46" font-size="11" text-anchor="middle" fill="var(--muted)">${l}</text>`;
            s += `<text x="${X(l)}" y="104" font-size="11" text-anchor="middle" fill="var(--muted)">${l}</text>`;
          }
          const ho2 = new Array(L).fill(0); E.h.forEach((c, l) => (ho2[E.map[l]] += c));
          for (let l = 0; l < L; l++) if (show(3, l) && E.h[l]) {
            const on = ph === 3 && l === k;
            s += `<path d="M${X(l)},34 C${X(l)},70 ${X(E.map[l])},62 ${X(E.map[l])},94" fill="none" stroke="var(${on ? '--orange' : '--green'})" stroke-width="${1.5 + E.h[l] / hm * 5}" opacity="${on ? 1 : 0.7}"/>`;
          }
          if (ph >= 3) for (let l = 0; l < L; l++) { const c = ph === 3 ? E.h.reduce((a, v, i) => a + (i <= k && E.map[i] === l ? v : 0), 0) : ho2[l]; const w = 3 + c / hm * 30; s += `<rect x="${X(l) - w / 2}" y="110" width="${w}" height="22" rx="3" fill="var(--green)" opacity="${c ? 0.9 : 0.12}"/>`; }
          mapSvg.innerHTML = s;
        }
        tbl.replaceChildren(UI.dataTable(['l<sub>in</sub>', 'h(l)', 'ĥ(l)', 'c(l)', 'c(l)×7', 'l<sub>out</sub>'],
          E.h.map((v, l) => [l, ph === 0 ? hp[l] : v, show(1, l) ? E.hn[l] : '', show(2, l) ? E.c[l] : '', show(3, l) ? E.c[l] * 7 : '', show(3, l) ? E.map[l] : '']), frame.row));
      }
      // real image
      const ivA = UI.ImageView({ caption: '명암 범위를 좁힌 영상' }), ivB = UI.ImageView({ caption: '평활화 결과' });
      const cvA = h('canvas'), cvB = h('canvas');
      let lo = 70, span = 70;
      function real() {
        const g = UI.currentImage().gray;
        const a = g.map(r => r.map(v => Math.round(lo + v / 255 * span)));
        const Eq = CV.equalize(a, 256);
        ivA.draw(a); ivB.draw(Eq.out);
        const hA = CV.histogram(a, 256), hB = CV.histogram(Eq.out, 256), mx = Math.max(...hA, ...hB) * 0.6;
        UI.plot(cvA, { w: 300, h: 110, x: [0, 255], y: [0, mx], series: [{ type: 'bar', data: hA, color: '--ink', bw: 1.2 }] });
        UI.plot(cvB, { w: 300, h: 110, x: [0, 255], y: [0, mx], series: [{ type: 'bar', data: hB, color: '--green', bw: 1.2 }] });
      }
      UI.onImage(real);
      root.append(h('div', { class: 'lab' },
        h('div', { class: 'stack' },
          h('div', { class: 'card' }, h('h3', {}, '예제 2-1 영상과 히스토그램', h('small', {}, 'M=N=8, L=8 · 칸 클릭 +1 / Shift+클릭 −1')),
            h('div', { class: 'row' }, h('div', { class: 'col' }, gin.el, h('span', { class: 'caption' }, '입력 f')), h('div', { class: 'col', style: { flex: '1 1 260px' } }, cvH, h('span', { class: 'caption' }, '히스토그램 h(l) — 주황 막대가 지금 세는 값'))),
            h('div', { class: 'controls', style: { marginTop: '8px' } }, h('button', { class: 'btn', onclick: () => { f = APP.parseGrid(EX21); rebuild(); } }, '예제 2-1로 되돌리기'), h('button', { class: 'btn', onclick: () => { const r = UI.rng(Date.now()); f = f.map(row => row.map(() => Math.min(7, Math.floor(r() * r() * 5)))); rebuild(); } }, '어두운 무작위 영상'))),
          st.root,
          h('div', { class: 'card' }, h('h3', {}, '매핑 표 T(·)', h('small', {}, '그림 2-9(a)')),
            h('div', { class: 'row' }, tbl, h('div', { class: 'col', style: { flex: '1 1 260px' } }, cvC, h('span', { class: 'caption' }, '누적 c(l)×(L−1) 곡선이 곧 매핑 함수입니다'))),
            h('div', { style: { marginTop: '12px' } }, mapSvg, h('span', { class: 'caption' }, '각 명암값이 어디로 옮겨 가는지 — 막대 폭 = 화소 수. 많이 몰린 값(3, 4)은 서로 멀리 떨어지고, 드문 값(5, 6)은 7로 합쳐져 분포가 넓게 퍼집니다.'))),
          h('div', { class: 'card' }, h('h3', {}, '평활화된 영상', h('small', {}, '그림 2-9(b)(c)')),
            h('div', { class: 'row' }, gout.el, h('div', { class: 'col', style: { flex: '1 1 260px' } }, cvO, h('span', { class: 'caption' }, '새 히스토그램 — 동적 범위 [2,6] → [1,7]'))))),
        h('div', { class: 'stack' }, st.panel,
          h('div', { class: 'card' }, h('h3', {}, '실제 영상에 적용'), h('div', { class: 'controls' }, UI.imagePicker(),
            UI.slider({ label: '시작', min: 0, max: 200, value: lo, id: 'hist-lo', oninput: v => { lo = v; real(); } }),
            UI.slider({ label: '폭', min: 10, max: 255, value: span, id: 'hist-span', oninput: v => { span = v; real(); } })),
            h('div', { class: 'imgs two', style: { marginTop: '8px' } }, h('div', {}, ivA.el, cvA), h('div', {}, ivB.el, cvB)),
            h('p', { class: 'caption' }, '명암이 좁은 구간에 몰린 영상을 평활화하면 0~255 전체로 퍼집니다. 다만 빈칸이 생긴 빗살 모양 히스토그램이 되고, 영상에 따라 잡음이 강조될 수도 있습니다(그림 2-11).')))));
      rebuild(); real();
    },
  });

  // ================= 2.2.3 histogram backprojection =================
  const BP_TYPES = {
    R: ['바위', [120, 120, 120]], G: ['풀', [80, 140, 60]], F: ['얼굴 피부', [230, 150, 110]], K: ['손 피부', [205, 135, 100]],
    E: ['눈', [60, 45, 40]], L: ['입술', [190, 70, 80]], S: ['옷', [160, 150, 120]],
  };
  const BP_EX = `R R F F F R R R
R F F F F F R R
R F E F E F R R
R F F F F F R R
R R F L F R R R
S S S S S S S G
S S K K S S S G
G G G G G G G G`;
  const bpQ = (hh, s, q) => [CV.clamp(Math.floor((((hh % 360) + 360) % 360) / 360 * q), 0, q - 1), CV.clamp(Math.floor(s * q), 0, q - 1)]; // clamp: S of a grey pixel can come out as -2e-16
  const bpHS = ([r, g, b]) => { const o = CV.rgb2hsi(r / 255, g / 255, b / 255); return [o.h % 360, o.s]; };
  const BP_RAMP = [[18, 22, 40], [84, 38, 110], [196, 66, 72], [243, 150, 58], [252, 236, 170]];
  const bpRamp = t => {
    t = Math.max(0, Math.min(1, t)) * (BP_RAMP.length - 1);
    const k = Math.min(BP_RAMP.length - 2, Math.floor(t)), f = t - k, a = BP_RAMP[k], b = BP_RAMP[k + 1];
    return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * f)).join(',')})`;
  };
  function bpHeat(cv, G, { sqrt = false, max, hl } = {}) {
    const q = G.length, S = Math.max(3, Math.floor(240 / q)), n = q * S;
    if (cv.width !== n) { cv.width = n; cv.height = n; }
    const c = cv.getContext('2d'), mx = max || Math.max(1e-12, ...G.flat());
    for (let j = 0; j < q; j++) for (let i = 0; i < q; i++) { let t = G[j][i] / mx; if (sqrt) t = Math.sqrt(t); c.fillStyle = bpRamp(t); c.fillRect(i * S, j * S, S, S); }
    if (S >= 10) {
      c.strokeStyle = 'rgba(255,255,255,.12)'; c.lineWidth = 1; c.beginPath();
      for (let k = 1; k < q; k++) { c.moveTo(k * S + 0.5, 0); c.lineTo(k * S + 0.5, n); c.moveTo(0, k * S + 0.5); c.lineTo(n, k * S + 0.5); }
      c.stroke();
    }
    if (hl) { const p = S < 8 ? 3 : 0; c.lineWidth = 3; c.strokeStyle = '#19d3ff'; c.strokeRect(hl[1] * S + 1.5 - p, hl[0] * S + 1.5 - p, S - 3 + 2 * p, S - 3 + 2 * p); }
  }
  // synthetic scene in the spirit of Fig 2-13: face, hands, olive clothes, a wooden crate of skin-like hue, rock and grass
  function bpScene() {
    const W = 160, H = 120, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, 92); g.addColorStop(0, '#8e8d86'); g.addColorStop(1, '#6e6f68'); x.fillStyle = g; x.fillRect(0, 0, W, 92);
    x.strokeStyle = '#55564f'; x.lineWidth = 1.5;
    [[0, 20, 40, 28, 62, 16], [104, 40, 130, 34, 160, 46], [8, 60, 30, 72, 46, 64], [112, 12, 130, 22, 150, 8]].forEach(([a, b, c2, d, e, f]) => { x.beginPath(); x.moveTo(a, b); x.quadraticCurveTo(c2, d, e, f); x.stroke(); });
    x.fillStyle = '#5d8a3a'; x.fillRect(0, 92, W, 28);
    x.fillStyle = 'rgb(196,128,100)'; x.fillRect(124, 64, 30, 30);
    x.strokeStyle = 'rgb(150,98,78)'; x.lineWidth = 2; x.strokeRect(125, 65, 28, 28); x.beginPath(); x.moveTo(125, 65); x.lineTo(153, 93); x.stroke();
    x.fillStyle = 'rgb(150,145,100)'; x.beginPath(); x.moveTo(62, 58); x.lineTo(98, 58); x.lineTo(112, 104); x.lineTo(48, 104); x.closePath(); x.fill();
    x.fillStyle = 'rgb(130,126,90)'; x.fillRect(50, 98, 60, 14);
    x.fillStyle = 'rgb(170,52,44)'; x.fillRect(58, 66, 7, 8);
    x.fillStyle = 'rgb(212,145,116)'; x.fillRect(74, 52, 12, 8);
    x.fillStyle = 'rgb(222,150,120)'; x.beginPath(); x.ellipse(80, 42, 12, 14, 0, 0, 7); x.fill();
    x.fillStyle = 'rgb(74,78,58)'; x.beginPath(); x.ellipse(80, 29, 15, 10, 0, Math.PI, 0); x.fill(); x.fillRect(63, 28, 34, 4);
    x.fillStyle = 'rgb(58,42,36)'; [75, 85].forEach(ex => { x.beginPath(); x.ellipse(ex, 40, 2.2, 1.4, 0, 0, 7); x.fill(); });
    x.fillStyle = 'rgb(176,78,74)'; x.beginPath(); x.ellipse(80, 49, 4.5, 1.8, 0, 0, 7); x.fill();
    x.fillStyle = 'rgb(205,140,112)';
    [[68, 86, 0.3], [93, 88, -0.3]].forEach(([hx, hy, a]) => { x.beginPath(); x.ellipse(hx, hy, 7, 5, a, 0, 7); x.fill(); });
    const d = x.getImageData(0, 0, W, H).data, r = UI.rng(23), rgb = [], gray = [];
    for (let y = 0; y < H; y++) {
      const r1 = [], g1 = [];
      for (let i = 0; i < W; i++) {
        const k = (y * W + i) * 4, p = [0, 1, 2].map(ch => Math.max(0, Math.min(255, Math.round(d[k + ch] + (r() - 0.5) * 10))));
        r1.push(p); g1.push(Math.round(0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2]));
      }
      rgb.push(r1); gray.push(g1);
    }
    return { rgb, gray, w: W, h: H };
  }
  APP.mod({
    id: 'backproj', ch: '2', num: '2.2.3', title: '히스토그램 역투영과 얼굴 검출', src: '2강 p.18–22 · 알고리즘 2-2·2-3, 식 (2.4), 그림 2-12·2-13', star: true,
    blurb: 'HS 2차원 히스토그램 → 비율 히스토그램 min(ĥm/ĥi, 1) → 화소마다 칸을 찾아 신뢰도로 바꾸기.',
    mount(root, m) {
      APP.scaffold(root, m, {
        lead: '히스토그램 역투영은 <b>히스토그램을 매핑 함수로</b> 써서 화소 값을 “얼굴일 신뢰도”로 바꿉니다. 모델 얼굴의 색(H, S)을 q×q 칸으로 세어 ĥ<sub>m</sub>을 만들고, 검출할 영상 전체의 ĥ<sub>i</sub>로 나눈 <b>비율 히스토그램</b> h<sub>r</sub>을 씁니다. 나누면 영상 전체에 흔한 색은 점수가 깎이고, 얼굴에 특징적인 색은 올라갑니다. 비율은 1을 넘을 수 있으므로 <b>min(·, 1.0)</b>으로 잘라 0~1 신뢰도로 만듭니다. 입력 영상에서 드래그해 모델 영역을 다시 고르고, 화소나 히스토그램 칸 위에 마우스를 올려 보세요.',
        formulas: [
          [R`$$\hat h(j,i)=\frac{h(j,i)}{M\times N},\quad 0\le j,i\le q-1$$`, '알고리즘 2-2 · 정규화'],
          [R`$$h_r(j,i)=\min\!\left(\frac{\hat h_m(j,i)}{\hat h_i(j,i)},\;1.0\right),\quad 0\le j,i\le q-1$$`, '식 (2.4) 비율 히스토그램'],
          [R`$$o(j,i)=\hat h_r\big(\mathrm{quantize}(g_H(j,i)),\,\mathrm{quantize}(g_S(j,i))\big)$$`, '알고리즘 2-3 · 역투영'],
        ],
      });

      // ---------- whole-image demo ----------
      let src = 'face', q = 16, disp = 'r', theta = 0.5, rect = { x: 72, y: 33, w: 17, h: 21 }, hov = null, hovBin = null, FACE = null, D = null;
      const getImg = () => (src === 'face' ? FACE || (FACE = bpScene()) : UI.currentImage());
      function compute() {
        const img = getImg(), H = img.rgb.length, W = img.rgb[0].length;
        rect.x = CV.clamp(rect.x, 0, W - 1); rect.y = CV.clamp(rect.y, 0, H - 1);
        rect.w = CV.clamp(rect.w, 1, W - rect.x); rect.h = CV.clamp(rect.h, 1, H - rect.y);
        if (!img._hs) img._hs = img.rgb.map(r => r.map(bpHS));
        const bins = img._hs.map(r => r.map(([hh, s]) => bpQ(hh, s, q)));
        const hm = CV.zeros(q, q), hi = CV.zeros(q, q);
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          const [a, b] = bins[y][x]; hi[a][b]++;
          if (y >= rect.y && y < rect.y + rect.h && x >= rect.x && x < rect.x + rect.w) hm[a][b]++;
        }
        const nm = rect.w * rect.h, N = H * W;
        const Hm = hm.map(r => r.map(v => v / nm)), Hi = hi.map(r => r.map(v => v / N));
        const Rt = Hm.map((r, a) => r.map((v, b) => (Hi[a][b] > 0 ? v / Hi[a][b] : 0))), Hr = Rt.map(r => r.map(v => Math.min(v, 1)));
        const mHm = Math.max(1e-12, ...Hm.flat()), mR = Math.max(1e-12, ...Rt.flat());
        const val = (a, b) => (disp === 'r' ? Hr[a][b] : disp === 'm' ? Hm[a][b] / mHm : Rt[a][b] / mR);
        const O = bins.map(r => r.map(([a, b]) => val(a, b)));
        D = { img, H, W, bins, hm, hi, Hm, Hi, Rt, Hr, O, nm, N, mHm, mR };
        if (hovBin && (hovBin[0] >= q || hovBin[1] >= q)) { hovBin = null; hov = null; }
        if (hov) hovBin = bins[hov[0]] && bins[hov[0]][hov[1]] ? bins[hov[0]][hov[1]] : null;
      }
      const ivIn = UI.ImageView({ caption: '입력 영상' }), ivO = UI.ImageView({ caption: '' }), ivB = UI.ImageView({ caption: '' });
      const cvM = h('canvas'), cvI = h('canvas'), cvR = h('canvas');
      [cvM, cvI, cvR].forEach(cv => Object.assign(cv.style, { width: '100%', height: 'auto', imageRendering: 'pixelated', borderRadius: '6px', border: '1px solid var(--rule)', display: 'block', cursor: 'crosshair', touchAction: 'none' }));
      const look = h('div', { class: 'note' });
      const barCv = h('canvas'), tblBox = h('div'), clipInfo = h('p', { class: 'caption' });
      function lookup() {
        if (!hovBin) { look.innerHTML = '입력 영상이나 역투영 영상 위에 마우스를 올리면 그 화소가 <b>어느 칸을 찾아가서 어떤 값을 받는지</b> 보여 줍니다. 같은 칸에 속한 화소는 모두 하늘색으로 표시됩니다. 히스토그램 칸 위에 올려도 됩니다.'; return; }
        const [a, b] = hovBin, { Hm, Hi, Rt, Hr, hm, hi } = D;
        let s = '';
        if (hov) { const [y, x] = hov, p = D.img.rgb[y][x], [hh, sat] = D.img._hs[y][x]; s += `화소 (${y}, ${x}) RGB (${p.map(Math.round).join(', ')}) → H = ${hh.toFixed(1)}°, S = ${sat.toFixed(3)} → quantize → 칸 <b>(${a}, ${b})</b><br>`; }
        else s += `칸 <b>(${a}, ${b})</b>: H ${(a * 360 / q).toFixed(1)}°~${((a + 1) * 360 / q).toFixed(1)}°, S ${(b / q).toFixed(3)}~${((b + 1) / q).toFixed(3)}<br>`;
        s += `모델 ${hm[a][b]}화소 ÷ ${D.nm} → ĥm = ${Hm[a][b].toFixed(4)} · 영상 ${hi[a][b]}화소 ÷ ${D.N} → ĥi = ${Hi[a][b].toFixed(4)}<br>`;
        if (Hi[a][b] > 0) {
          const r = Rt[a][b];
          s += `ĥm / ĥi = ${r.toFixed(3)} → min(${r.toFixed(3)}, 1.0) = <b>${Hr[a][b].toFixed(3)}</b>` + (r > 1 ? ' <span class="pill hot">1을 넘어 잘림</span>' : '') + (hov && disp === 'r' ? ` = o(${hov[0]}, ${hov[1]})` : '');
          if (disp !== 'r' && hov) s += `<br>지금 표시 방식에서는 o(${hov[0]}, ${hov[1]}) = ${D.O[hov[0]][hov[1]].toFixed(3)} (${disp === 'm' ? 'ĥm ÷ 최댓값' : '(ĥm/ĥi) ÷ 최댓값'})`;
        } else s += 'ĥi = 0 → 이 영상에 없는 색이라 역투영에 쓰이지 않습니다.';
        look.innerHTML = s;
      }
      function minCard() {
        const { hm, Hm, Hi, Rt, Hr, N, nm } = D, list = [];
        for (let a = 0; a < q; a++) for (let b = 0; b < q; b++) if (hm[a][b]) list.push({ a, b, c: hm[a][b] });
        list.sort((p, r) => r.c - p.c);
        const top = list.slice(0, 8), rs = top.map(t => Rt[t.a][t.b]);
        const yMax = Math.max(1.3, Math.min(8, Math.max(0, ...rs))) * 1.08;
        UI.plot(barCv, {
          w: 400, h: 200, x: [-0.5, top.length - 0.5], y: [0, yMax], xticks: top.map((_, k) => k), xfmt: k => (top[k] ? `${top[k].a},${top[k].b}` : ''),
          series: [{ type: 'bar', data: rs, color: '--faint', frac: 0.62, alpha: 0.45 }, { type: 'bar', data: rs.map(v => Math.min(v, 1)), color: '--orange', frac: 0.62 }, { type: 'line', data: [[-0.5, 1], [top.length - 0.5, 1]], color: '--bad', width: 1.5, dash: [5, 4] }],
          legend: [['ĥm/ĥi', '--faint'], ['min(·, 1)', '--orange']],
        });
        tblBox.replaceChildren(UI.dataTable(['칸 (H,S)', '모델 화소', 'ĥm', 'ĥi', 'ĥm/ĥi', 'ĥr'], top.map(t => [`(${t.a},${t.b})`, t.c, Hm[t.a][t.b].toFixed(4), Hi[t.a][t.b].toFixed(4), Rt[t.a][t.b].toFixed(2), Hr[t.a][t.b].toFixed(2)])));
        const clipped = list.filter(t => Rt[t.a][t.b] > 1).length;
        clipInfo.textContent = `가로축 = 모델에 많이 나온 칸 (H칸, S칸). 모델에 나온 칸 ${list.length}개 중 ${clipped}개가 1을 넘어 1.0으로 잘렸습니다. 모델 영역 안에만 있는 색이면 비율이 N ÷ (모델 화소 수) = ${N} ÷ ${nm} ≈ ${(N / nm).toFixed(1)}까지 커집니다(그래프 위로 넘친 막대).`;
      }
      function redraw() {
        const { img, bins, O, Hm, Hi, Hr, H, W } = D, marks = [];
        if (hovBin) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (bins[y][x][0] === hovBin[0] && bins[y][x][1] === hovBin[1]) marks.push({ y, x, color: '#19d3ff' });
        ivIn.draw(img.rgb, 'rgb', { rects: [{ x: rect.x, y: rect.y, ww: rect.w, hh: rect.h, color: '--orange', w: 1.5 }], marks });
        ivO.draw(O.map(r => r.map(v => v * 255)), 'gray', { marks });
        ivB.draw(O.map(r => r.map(v => (v > theta ? 1 : 0))), 'binary', { dark: true });
        ivO.setCaption(disp === 'r' ? '역투영 o = ĥr(칸) · 식 (2.4)' : disp === 'm' ? 'ĥm(칸) ÷ 최댓값 · 나누지 않음' : '(ĥm/ĥi)(칸) ÷ 최댓값 · min 없음');
        ivB.setCaption(`o > ${theta.toFixed(2)}인 화소`);
        ivIn.setInfo(`모델 ${rect.w}×${rect.h}`);
        bpHeat(cvM, Hm, { sqrt: true, hl: hovBin }); bpHeat(cvI, Hi, { sqrt: true, hl: hovBin }); bpHeat(cvR, Hr, { max: 1, hl: hovBin });
        lookup(); minCard();
      }
      const run = () => { compute(); redraw(); };
      let raf = 0;
      const sched = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; redraw(); }); };
      const posOf = (cv, e) => { const r = cv.getBoundingClientRect(); return [Math.floor((e.clientY - r.top) / r.height * cv.height), Math.floor((e.clientX - r.left) / r.width * cv.width)]; };
      const setHov = (y, x) => { if (!D || y < 0 || x < 0 || y >= D.H || x >= D.W) return; hov = [y, x]; hovBin = D.bins[y][x]; sched(); };
      let drag = null, prevRect = null;
      Object.assign(ivIn.canvas.style, { cursor: 'crosshair', touchAction: 'none' });
      ivIn.canvas.addEventListener('pointerdown', e => { const [y, x] = posOf(ivIn.canvas, e); drag = [y, x]; prevRect = { ...rect }; ivIn.canvas.setPointerCapture(e.pointerId); });
      ivIn.canvas.addEventListener('pointermove', e => {
        const [y, x] = posOf(ivIn.canvas, e);
        if (!drag) return setHov(y, x);
        const yy = CV.clamp(y, 0, D.H - 1), xx = CV.clamp(x, 0, D.W - 1);
        rect = { x: Math.min(xx, drag[1]), y: Math.min(yy, drag[0]), w: Math.abs(xx - drag[1]) + 1, h: Math.abs(yy - drag[0]) + 1 };
        compute(); sched();
      });
      ivIn.canvas.addEventListener('pointerup', e => {
        if (!drag) return;
        drag = null;
        if (rect.w * rect.h < 4) rect = prevRect; // a click, not a drag
        compute(); redraw();
        setHov(...posOf(ivIn.canvas, e));
      });
      [ivO, ivB].forEach(iv => iv.canvas.addEventListener('pointermove', e => setHov(...posOf(iv.canvas, e))));
      [ivIn, ivO, ivB].forEach(iv => iv.canvas.addEventListener('pointerleave', () => { if (drag) return; hov = null; hovBin = null; sched(); }));
      [cvM, cvI, cvR].forEach(cv => {
        cv.addEventListener('pointermove', e => {
          const r = cv.getBoundingClientRect(), b = Math.floor((e.clientX - r.left) / r.width * q), a = Math.floor((e.clientY - r.top) / r.height * q);
          if (a >= 0 && b >= 0 && a < q && b < q && (!hovBin || hov || hovBin[0] !== a || hovBin[1] !== b)) { hov = null; hovBin = [a, b]; sched(); }
        });
        cv.addEventListener('pointerleave', () => { hovBin = null; sched(); });
      });
      function resetRect() {
        if (src === 'face') { rect = { x: 72, y: 33, w: 17, h: 21 }; return; }
        const img = getImg(), H = img.rgb.length, W = img.rgb[0].length;
        rect = { x: Math.round(W * 0.4), y: Math.round(H * 0.35), w: Math.max(2, Math.round(W * 0.2)), h: Math.max(2, Math.round(H * 0.25)) };
      }
      const picker = UI.imagePicker(); picker.hidden = true;
      const srcSeg = UI.segmented([['face', '합성 얼굴 장면'], ['shared', '공용 실습 영상 / 내 사진']], src, v => { src = v; picker.hidden = v !== 'shared'; hov = hovBin = null; resetRect(); run(); }, '영상');
      const qSeg = UI.segmented([[8, '8'], [16, '16'], [32, '32'], [64, '64']], q, v => { q = v; hovBin = null; run(); }, '양자화 q');
      const dSeg = UI.segmented([['r', 'min(ĥm/ĥi, 1)'], ['m', 'ĥm만'], ['raw', 'ĥm/ĥi (min 없음)']], disp, v => { disp = v; run(); }, '역투영 값');
      const thSl = UI.slider({ label: '이진화 θ', min: 0.05, max: 0.95, step: 0.05, value: theta, id: 'bp-th', fmt: v => v.toFixed(2), oninput: v => { theta = v; redraw(); } });
      UI.onImage(() => { if (src === 'shared' && root.isConnected) { hov = hovBin = null; resetRect(); run(); } });
      const cM = h('input', { type: 'number', step: '0.01', min: 0, value: 0.3, style: { width: '84px' }, id: 'bp-cm', 'aria-label': 'ĥm' });
      const cI = h('input', { type: 'number', step: '0.01', min: 0, value: 0.05, style: { width: '84px' }, id: 'bp-ci', 'aria-label': 'ĥi' });
      const cOut = h('div', { class: 'mono', style: { marginTop: '6px' } });
      const calc = () => { const a = +cM.value || 0, b = +cI.value || 0; cOut.innerHTML = b > 0 ? `${a} ÷ ${b} = ${(a / b).toFixed(3)} → min(${(a / b).toFixed(3)}, 1.0) = <b>${Math.min(1, a / b).toFixed(3)}</b>` : 'ĥi = 0이면 그 색은 영상에 없으므로 계산에 쓰이지 않습니다.'; };
      [cM, cI].forEach(i => i.addEventListener('input', calc));
      const heatCol = (cv, t, cap) => h('div', { class: 'col', style: { flex: '1 1 170px', maxWidth: '250px' } }, h('b', { style: { fontSize: '13px' } }, t), cv, h('span', { class: 'caption' }, cap));
      const bigCard = h('div', { class: 'card' },
        h('div', { class: 'controls' }, UI.labeled('영상', srcSeg), picker, UI.labeled('양자화 q', qSeg)),
        h('div', { class: 'controls', style: { marginTop: '8px' } }, UI.labeled('역투영 값', dSeg), thSl, h('span', { class: 'caption' }, '입력 영상에서 드래그 = 모델 영역(주황 사각형) 다시 고르기')),
        h('div', { class: 'imgs', style: { marginTop: '10px' } }, ivIn.el, ivO.el, ivB.el),
        h('div', { style: { marginTop: '10px' } }, look));
      const heatCard = h('div', { class: 'card' }, h('h3', {}, 'HS 2차원 히스토그램', h('small', {}, '그림 2-12(b) · 세로 = H 칸 j (0°→360°), 가로 = S 칸 i (0→1)')),
        h('div', { class: 'row' }, heatCol(cvM, 'ĥm · 모델 얼굴', '밝기 = √값 (작은 값도 보이게)'), heatCol(cvI, 'ĥi · 입력 영상 전체', '밝기 = √값'), heatCol(cvR, 'ĥr = min(ĥm/ĥi, 1)', '밝기 = 값 그대로 (0~1)')),
        h('p', { class: 'caption' }, 'ĥm에서 밝은 칸이 얼굴 색입니다. ĥi에서도 밝은 칸(영상 전체에 흔한 색)은 나눗셈 뒤 ĥr에서 어두워집니다. q를 8로 줄이면 칸이 넓어져 바위의 잡음 색까지 얼굴 칸에 들어가 배경에 흰 점이 늘어납니다. 64로 늘리면 칸이 잘게 쪼개져, 모델과 조금만 다른 색(나무 상자)은 칸이 어긋나 점점이 끊깁니다.'));
      const tryNote = h('div', { class: 'note', html: '해 볼 것 — <b>나눗셈의 효과</b>: 모델 영역을 헬멧 위 바위까지 넓게 드래그한 뒤 “ĥm만”과 “min(ĥm/ĥi, 1)”을 번갈아 보세요. ĥm만 쓰면 모델에 섞인 바위색이 얼굴만큼 밝아지지만, 나누면 영상 전체에 흔한 바위색이 깎여 얼굴이 두드러집니다. 반대로 모델이 깨끗할 때는 나눗셈이 모델에 몇 화소 섞인 드문 색(바위의 잡음 점)까지 1로 끌어올리는 부작용도 보입니다.' });
      const limitNote = h('div', { class: 'note warn', html: '그림 2-13처럼 얼굴뿐 아니라 <b>손</b>도 높은 값을 받습니다 — 히스토그램은 색만 세고 모양은 모르기 때문입니다. 비슷한 색 분포를 가진 다른 물체(여기서는 나무 상자)도 구별하지 못하고, 검출 대상이 여러 색으로 이루어져 있으면 오류가 생길 수 있습니다. 반대로 위치 정보를 버리므로 <b>이동·회전에 불변</b>이고 <b>가림(occlusion)에 강인</b>해서, 배경을 조정할 수 있는 상황에 적합합니다.' });
      const minEl = h('div', { class: 'card' }, h('h3', {}, '왜 min(·, 1.0)을 쓰나', h('small', {}, '모델에 많이 나온 칸 상위 8개')), barCv, clipInfo, tblBox,
        h('div', { class: 'note', style: { marginTop: '10px' }, html: '<b>나눗셈</b>은 영상 전체에 흔한 색의 점수를 깎습니다(확률로 보면 P(얼굴|색) ∝ P(색|얼굴) / P(색)). 그런데 ĥi가 작은 칸은 비율이 몇 배, 몇십 배로 커집니다. <b>min</b>으로 1에서 자르면 ① 신뢰도가 0~1 범위에 머물고 ② 드문 색 한두 칸이 결과를 독차지하지 못하며 ③ 분모가 작은 칸의 불안정한 값이 결과를 흔들지 못합니다. 위의 “역투영 값”을 <b>ĥm/ĥi (min 없음)</b>으로 바꾸면 드문 색 몇 칸이 최댓값이 되어 얼굴 대부분이 어두워지는 것을 볼 수 있습니다.' }),
        h('div', { class: 'controls', style: { marginTop: '10px' } }, h('b', { style: { fontSize: '13px' } }, '직접 계산'), UI.labeled('ĥm', cM), UI.labeled('ĥi', cI)), cOut);

      // ---------- tiny step-through ----------
      const TQ = 4, TM = 8, TN = 8;
      const parseEx = () => BP_EX.trim().split('\n').map(r => r.trim().split(/\s+/));
      let tImg = parseEx(), tRect = { y: 1, x: 1, h: 4, w: 5 }, tool = 'rect', brush = 'F', fr0 = null, anchor = null;
      const tBin = ty => bpQ(...bpHS(BP_TYPES[ty][1]), TQ);
      const CODE = [
        '// 알고리즘 2-2 : 2차원 히스토그램 계산 (먼저 모델 영역에 적용 → ĥ_m)',
        'h(j,i), 0≤j,i≤q-1 을 0으로 초기화한다.',
        'for(j=0 to M-1)',
        '  for(i=0 to N-1)   // 화소 (j,i) 각각에 대해',
        '    h(quantize(f_H(j,i)), quantize(f_S(j,i)))++;   // 해당 칸을 1 증가',
        'for(j=0 to q-1)',
        '  for(i=0 to q-1)',
        '    ĥ(j,i) = h(j,i)/(M×N);   // 정규화',
        '',
        '// 알고리즘 2-3 : 히스토그램 역투영',
        '영상 g_H, g_S에 [알고리즘 2-2]를 적용하여 정규 히스토그램 ĥ_i를 만든다.',
        '식 (2.4)를 이용하여 ĥ_r을 구한다.   // ĥ_r = min(ĥ_m/ĥ_i, 1.0)',
        'for(j=0 to M-1)',
        '  for(i=0 to N-1)',
        '    o(j,i) = ĥ_r(quantize(g_H(j,i)), quantize(g_S(j,i)));   // 역투영',
      ];
      const st = UI.Stepper({ code: CODE, title: '알고리즘 2-2 → 식 (2.4) → 알고리즘 2-3', render: fr => { fr0 = fr; tDraw(); } });
      const inR = (y, x) => y >= tRect.y && y < tRect.y + tRect.h && x >= tRect.x && x < tRect.x + tRect.w;
      const lum = ([r, g, b]) => 0.299 * r + 0.587 * g + 0.114 * b;
      const ovr = () => [{ type: 'rect', pts: [tRect.y, tRect.x, tRect.h, tRect.w], color: '--orange', w: 3, dash: true }];
      const gImg = UI.GridView({
        rows: TM, cols: TN, cs: 36, fs: 10.5, label: '입력 영상 g',
        cell: (y, x) => {
          const ty = tImg[y][x], c = BP_TYPES[ty][1], [a, b] = tBin(ty);
          const s = { t: `${a},${b}`, bg: `rgb(${c.join(',')})`, color: lum(c) < 130 ? '#fff' : '#111', title: `${BP_TYPES[ty][0]} RGB(${c.join(', ')}) → 칸 (${a}, ${b})` };
          if (fr0 && fr0.cur && fr0.cur[0] === y && fr0.cur[1] === x) s.cls = 'cur';
          else if (fr0 && fr0.bin && ['mn', 'in', 'r'].includes(fr0.ph) && a === fr0.bin[0] && b === fr0.bin[1] && (fr0.ph !== 'mn' || inR(y, x))) s.cls = 'win';
          return s;
        },
        paint: {
          start: (y, x) => { if (tool === 'rect') { anchor = [y, x]; return 'rect'; } return brush; },
          apply: (y, x, v) => {
            if (v === 'rect') tRect = { y: Math.min(y, anchor[0]), x: Math.min(x, anchor[1]), h: Math.abs(y - anchor[0]) + 1, w: Math.abs(x - anchor[1]) + 1 };
            else tImg[y][x] = v;
            gImg.draw(); gImg.overlay(ovr());
            clearTimeout(gImg.t); gImg.t = setTimeout(tBuild, 150);
          },
        },
      });
      const binLbl = { rowLabels: [...Array(TQ).keys()].map(a => 'H' + a), colLabels: [...Array(TQ).keys()].map(b => 'S' + b) };
      const isCur = (a, b, g) => fr0 && fr0.bin && fr0.grid === g && fr0.bin[0] === a && fr0.bin[1] === b;
      const tint = (v, max) => `color-mix(in srgb, var(--orange) ${Math.round(Math.min(1, v / max) * 55)}%, var(--cell-bg))`;
      const histCell = (cnt, nrm, tot, g) => (a, b) => {
        if (!fr0 || !fr0[cnt]) return { t: '' };
        const c = fr0[cnt][a][b], nv = fr0[nrm][a][b];
        const s = nv !== null ? { t: nv.toFixed(2), sub: `${c}/${fr0[tot]}` } : { t: String(c), color: c ? '' : 'var(--faint)' };
        if (c) s.bg = tint(c, fr0[tot] * 0.6);
        if (isCur(a, b, g)) s.cls = 'cur';
        return s;
      };
      const gHm = UI.GridView({ rows: TQ, cols: TQ, cs: 54, fs: 12, ...binLbl, label: 'ĥm', cell: histCell('hm', 'hmN', 'nm', 'm') });
      const gHi = UI.GridView({ rows: TQ, cols: TQ, cs: 54, fs: 12, ...binLbl, label: 'ĥi', cell: histCell('hi', 'hiN', 'N', 'i') });
      const gHr = UI.GridView({
        rows: TQ, cols: TQ, cs: 54, fs: 12, ...binLbl, label: 'ĥr',
        cell: (a, b) => {
          if (!fr0 || !fr0.hr || fr0.hr[a][b] === null) return { t: '' };
          const v = fr0.hr[a][b], r = fr0.rt[a][b];
          const s = { t: v.toFixed(2), sub: r === null ? '' : '÷ ' + r.toFixed(2), bg: v ? tint(v, 1) : '' };
          if (r !== null && r > 1) { s.badge = '✂'; s.badgeColor = 'var(--bad)'; }
          if (!v) s.color = 'var(--faint)';
          if (isCur(a, b, 'r')) s.cls = 'cur';
          return s;
        },
      });
      const gO = UI.GridView({
        rows: TM, cols: TN, cs: 36, fs: 10.5, label: '역투영 o',
        cell: (y, x) => {
          if (!fr0 || !fr0.o || fr0.o[y][x] === null) return { t: '' };
          const v = fr0.o[y][x], g = Math.round(35 + v * 215);
          return { t: v.toFixed(2), bg: `rgb(${g},${g},${g})`, color: g < 140 ? '#fff' : '#111', cls: fr0.ph === 'o' && fr0.cur && fr0.cur[0] === y && fr0.cur[1] === x ? 'cur' : '' };
        },
      });
      function tDraw() { gImg.draw(); gImg.overlay(ovr()); gHm.draw(); gHi.draw(); gHr.draw(); gO.draw(); }
      function tBuild() {
        const fr = [], nm = tRect.w * tRect.h, N = TM * TN;
        const Z = () => CV.zeros(TQ, TQ), NUL = () => Array.from({ length: TQ }, () => new Array(TQ).fill(null));
        const hm = Z(), hmN = NUL(), hi = Z(), hiN = NUL(), rt = NUL(), hr = NUL(), o = Array.from({ length: TM }, () => new Array(TN).fill(null));
        const snap = x => fr.push({ hm: CV.clone(hm), hmN: CV.clone(hmN), hi: CV.clone(hi), hiN: CV.clone(hiN), rt: CV.clone(rt), hr: CV.clone(hr), o: CV.clone(o), nm, N, ...x });
        snap({ ph: 'init', line: 2, vars: { q: TQ, '모델 M×N': `${tRect.h}×${tRect.w}=${nm}` }, note: `먼저 모델 영역(주황 점선, ${tRect.h}×${tRect.w} = ${nm}화소)에 알고리즘 2-2를 적용해 ĥ<sub>m</sub>을 만듭니다. q = ${TQ}이므로 H는 90°씩, S는 0.25씩 네 칸으로 나눕니다.` });
        for (let y = tRect.y; y < tRect.y + tRect.h; y++) for (let x = tRect.x; x < tRect.x + tRect.w; x++) {
          const ty = tImg[y][x], [hh, s] = bpHS(BP_TYPES[ty][1]), [a, b] = bpQ(hh, s, TQ);
          hm[a][b]++;
          snap({ ph: 'm', grid: 'm', cur: [y, x], bin: [a, b], line: [4, 5], vars: { j: y - tRect.y, i: x - tRect.x, f_H: hh.toFixed(1) + '°', f_S: s.toFixed(3), quantize: `(${a}, ${b})`, [`h_m(${a},${b})`]: hm[a][b] },
            note: `모델 화소 (${y},${x}) · ${BP_TYPES[ty][0]}: H = ${hh.toFixed(1)}°, S = ${s.toFixed(3)} → quantize → 칸 <b>(${a}, ${b})</b> → h<sub>m</sub>(${a},${b}): ${hm[a][b] - 1} → <b>${hm[a][b]}</b>` });
        }
        for (let a = 0; a < TQ; a++) for (let b = 0; b < TQ; b++) {
          if (!hm[a][b]) continue;
          hmN[a][b] = hm[a][b] / nm;
          snap({ ph: 'mn', grid: 'm', bin: [a, b], line: 8, vars: { j: a, i: b, [`h_m(${a},${b})`]: hm[a][b], 'M×N': nm, [`ĥ_m(${a},${b})`]: hmN[a][b] }, note: `ĥ<sub>m</sub>(${a},${b}) = ${hm[a][b]} / ${nm} = <b>${hmN[a][b].toFixed(3)}</b> — 모델 화소 중 이 색의 비율 (분모는 <b>모델</b> 화소 수)` });
        }
        for (let a = 0; a < TQ; a++) for (let b = 0; b < TQ; b++) if (hmN[a][b] === null) hmN[a][b] = 0;
        for (let y = 0; y < TM; y++) for (let x = 0; x < TN; x++) {
          const ty = tImg[y][x], [hh, s] = bpHS(BP_TYPES[ty][1]), [a, b] = bpQ(hh, s, TQ);
          hi[a][b]++;
          snap({ ph: 'i', grid: 'i', cur: [y, x], bin: [a, b], line: [11, 5], vars: { j: y, i: x, g_H: hh.toFixed(1) + '°', g_S: s.toFixed(3), quantize: `(${a}, ${b})`, [`h_i(${a},${b})`]: hi[a][b] },
            note: `입력 영상 전체에 알고리즘 2-2 적용 · 화소 (${y},${x}) ${BP_TYPES[ty][0]} → 칸 <b>(${a}, ${b})</b> → h<sub>i</sub>(${a},${b}) = <b>${hi[a][b]}</b>` });
        }
        for (let a = 0; a < TQ; a++) for (let b = 0; b < TQ; b++) {
          if (!hi[a][b]) continue;
          hiN[a][b] = hi[a][b] / N;
          snap({ ph: 'in', grid: 'i', bin: [a, b], line: [11, 8], vars: { j: a, i: b, [`h_i(${a},${b})`]: hi[a][b], 'M×N': N, [`ĥ_i(${a},${b})`]: hiN[a][b] }, note: `ĥ<sub>i</sub>(${a},${b}) = ${hi[a][b]} / ${N} = <b>${hiN[a][b].toFixed(3)}</b> — 영상 전체에서 이 색의 비율` });
        }
        for (let a = 0; a < TQ; a++) for (let b = 0; b < TQ; b++) if (hiN[a][b] === null) hiN[a][b] = 0;
        for (let a = 0; a < TQ; a++) for (let b = 0; b < TQ; b++) {
          if (!hi[a][b]) { rt[a][b] = null; hr[a][b] = 0; continue; }
          const r = hmN[a][b] / hiN[a][b]; rt[a][b] = r; hr[a][b] = Math.min(r, 1);
          const why = r > 1 ? `비율이 1을 넘으므로 <b>1.0으로 잘립니다</b> — 영상 전체보다 모델에서 훨씬 흔한, 얼굴다운 색입니다.` : r > 0 ? '1보다 작아 그대로 씁니다 — 모델에도 있지만 영상 전체(배경)에 더 흔한 색이라 점수가 깎였습니다.' : '모델에 없는 색이라 0입니다.';
          snap({ ph: 'r', grid: 'r', bin: [a, b], line: 12, vars: { j: a, i: b, [`ĥ_m(${a},${b})`]: hmN[a][b], [`ĥ_i(${a},${b})`]: hiN[a][b], 'ĥ_m/ĥ_i': r, [`ĥ_r(${a},${b})`]: hr[a][b] },
            note: `ĥ<sub>r</sub>(${a},${b}) = min(${hmN[a][b].toFixed(3)} / ${hiN[a][b].toFixed(3)}, 1.0) = min(${r.toFixed(3)}, 1.0) = <b>${hr[a][b].toFixed(3)}</b>. ${why}` });
        }
        for (let a = 0; a < TQ; a++) for (let b = 0; b < TQ; b++) if (hr[a][b] === null) hr[a][b] = 0;
        for (let y = 0; y < TM; y++) for (let x = 0; x < TN; x++) {
          const ty = tImg[y][x], [a, b] = tBin(ty);
          o[y][x] = hr[a][b];
          snap({ ph: 'o', grid: 'r', cur: [y, x], bin: [a, b], line: [14, 15], vars: { j: y, i: x, quantize: `(${a}, ${b})`, 'o(j,i)': o[y][x] },
            note: `화소 (${y},${x}) ${BP_TYPES[ty][0]} → 칸 (${a}, ${b})를 찾아가 ĥ<sub>r</sub> 값을 그대로 가져옴: o(${y},${x}) = <b>${o[y][x].toFixed(2)}</b>` + (!inR(y, x) && o[y][x] >= 1 ? ' — 모델 영역 밖인데도 최고점입니다(같은 색이라 구별 못함).' : '') });
        }
        const hot = []; for (let y = 0; y < TM; y++) for (let x = 0; x < TN; x++) if (o[y][x] >= 0.999 && !inR(y, x) && !'FLE'.includes(tImg[y][x])) hot.push(`(${y},${x}) ${BP_TYPES[tImg[y][x]][0]}`);
        snap({ ph: 'end', line: [], vars: {}, note: `완료. o가 1.00인 화소가 얼굴 후보입니다.` + (hot.length ? ` 얼굴이 아닌데도 1.00을 받은 화소: ${hot.join(', ')} — 그림 2-13에서 손이 함께 밝게 나온 것과 같은 한계입니다.` : '') });
        st.load(fr, fr0 ? Math.min(st.i, fr.length - 1) : fr.length - 1);
      }
      const brushSeg = UI.segmented(Object.entries(BP_TYPES).map(([k, [n]]) => [k, n]), brush, v => (brush = v), '색');
      const brushBox = h('span', { class: 'ctl' }, h('span', {}, '칠할 색'), brushSeg); brushBox.hidden = true;
      const toolSeg = UI.segmented([['rect', '모델 영역 드래그'], ['paint', '색 칠하기']], tool, v => { tool = v; brushBox.hidden = v !== 'paint'; }, '도구');
      const legend = h('div', { class: 'legend', style: { marginTop: '8px' } }, Object.entries(BP_TYPES).map(([k, [n, c]]) => h('span', {}, h('i', { style: { background: `rgb(${c.join(',')})` } }), `${n} → 칸 (${tBin(k).join(',')})`)));
      const capCol = (cap, el) => h('div', { class: 'col', style: { maxWidth: '330px' } }, h('span', { class: 'caption' }, cap), el);
      const tinyLab = h('div', { class: 'lab wide-code' },
        h('div', { class: 'stack' },
          h('div', { class: 'card' },
            h('div', { class: 'controls' }, UI.labeled('도구', toolSeg), brushBox, h('button', { class: 'btn', onclick: () => { tImg = parseEx(); tRect = { y: 1, x: 1, h: 4, w: 5 }; tBuild(); } }, '처음 예제로')),
            legend,
            h('div', { class: 'row', style: { marginTop: '10px' } },
              capCol('입력 g — 칸 글자 = 양자화된 (H칸, S칸) · 주황 점선 = 모델 영역', gImg.el),
              capCol('역투영 결과 o (밝을수록 얼굴일 가능성 높음)', gO.el))),
          h('div', { class: 'card' },
            h('div', { class: 'row' },
              capCol('ĥm · 모델 — 작은 글씨 = 개수 / 모델 화소 수', gHm.el),
              capCol('ĥi · 영상 전체 — 작은 글씨 = 개수 / 64', gHi.el),
              capCol('ĥr = min(ĥm/ĥi, 1) — 작은 글씨 = 나눗셈 결과, ✂ = 1에서 잘림', gHr.el))),
          st.root,
          h('div', { class: 'note', html: '처음 예제에서 볼 것: 모델 영역에 바위·눈 화소가 섞여 칸 (0,0)의 ĥm은 0.20이지만, 영상 전체에 바위·옷이 많아 ĥi가 커서 ĥr은 0.46으로 깎입니다. 반대로 얼굴 피부 (0,1)과 입술 (3,1)은 비율이 1을 넘어 1.00으로 잘립니다. 모델에 넣지 않은 <b>손</b>(6행)도 같은 칸이라 1.00을 받습니다.' })),
        h('div', { class: 'stack' }, st.panel));

      root.append(
        h('div', { class: 'lab' }, h('div', { class: 'stack' }, bigCard, heatCard, tryNote, limitNote), h('div', { class: 'stack' }, minEl)),
        h('h2', { style: { fontSize: '17px', margin: '26px 0 10px' } }, '한 화소씩: 알고리즘 2-2 → 식 (2.4) → 알고리즘 2-3'),
        tinyLab);
      run(); calc(); tBuild();
    },
  });

  // ================= 2.3.1 Otsu =================
  APP.mod({
    id: 'otsu', ch: '2', num: '2.3.1', title: '이진화와 오츄 알고리즘', src: '2강 p.23–26 · 식 (2.5)–(2.7)', star: true,
    blurb: '모든 임계값 t를 훑으며 두 그룹 분산의 가중합 v_within(t)이 최소인 T 찾기.',
    mount(root, m) {
      APP.scaffold(root, m, {
        lead: '오츄 알고리즘은 이진화했을 때 <b>흑 그룹과 백 그룹이 각각 균일할수록</b>(분산이 작을수록) 좋다는 원리입니다. t를 0부터 L−1까지 하나씩 바꿔 가며 가중 분산합 v<sub>within</sub>(t)을 계산하고, 가장 작은 t를 T로 고릅니다. 단계 슬라이더가 곧 t입니다.',
        formulas: [[R`$$T=\underset{t\in\{0,\dots,L-1\}}{\operatorname{argmin}}\;v_{within}(t)$$`, '식 (2.6)'], [R`$$v_{within}(t)=w_0(t)\,v_0(t)+w_1(t)\,v_1(t)$$`, '식 (2.7)'], [R`$$w_0=\sum_{i=0}^{t}\hat h(i),\;\mu_0=\frac{1}{w_0}\sum_{i=0}^{t}i\,\hat h(i),\;v_0=\frac{1}{w_0}\sum_{i=0}^{t}\hat h(i)(i-\mu_0)^2$$`, 'w₁, μ₁, v₁은 i = t+1 … L−1']],
      });
      const CODE = [
        'T=0; v_min=∞;',
        'for(t=0 to L-1) {',
        '  w0(t), μ0(t), v0(t) 계산      // 흑 그룹: 명암 0 … t',
        '  w1(t), μ1(t), v1(t) 계산      // 백 그룹: 명암 t+1 … L-1',
        '  v_within(t) = w0(t)v0(t) + w1(t)v1(t);  // 식 (2.7)',
        '  if(v_within(t) < v_min) { v_min=v_within(t); T=t; }',
        '}',
        'b(j,i) = f(j,i) > T ? 1 : 0;   // 흑 그룹 [0,T]는 0, 나머지는 1',
      ];
      let O, hist, frame;
      const st = UI.Stepper({ code: CODE, title: '오츄 의사 코드', render: fr => { frame = fr; draw(); } });
      const cvH = h('canvas'), cvV = h('canvas');
      const ivIn = UI.ImageView({ caption: '입력 영상' }), ivB = UI.ImageView({ caption: '현재 t로 이진화' });
      const varBar = h('div', { class: 'col', style: { gap: '4px' } });
      function rebuild() {
        const g = UI.currentImage().gray;
        hist = CV.histogram(g, 256); O = CV.otsu(hist);
        const fr = []; let best = { t: 0, v: Infinity };
        for (const r of O.rows) {
          const upd = r.vw < best.v; if (upd) best = { t: r.t, v: r.vw };
          fr.push({ t: r.t, best: best.t, line: upd ? [3, 4, 5, 6] : [3, 4, 5], vars: { t: r.t, w0: r.w0, 'μ0': r.m0, v0: r.v0, w1: r.w1, 'μ1': r.m1, v1: r.v1, v_within: r.vw, T: best.t }, note: `t = <b>${r.t}</b>: v<sub>within</sub> = ${r.w0.toFixed(3)}×${r.v0.toFixed(1)} + ${r.w1.toFixed(3)}×${r.v1.toFixed(1)} = <b>${r.vw.toFixed(1)}</b>` + (upd ? ` — 지금까지 최소라서 T = ${r.t}로 갱신` : ` (최소는 여전히 T = ${best.t})`) });
        }
        fr.push({ t: O.T, best: O.T, line: 8, vars: { T: O.T, v_min: O.rows[O.T].vw }, note: `모든 t를 확인했습니다. 가장 균일하게 나누는 임계값은 <b>T = ${O.T}</b>입니다.` });
        ivIn.draw(g);
        st.load(fr, 'end');
      }
      function draw() {
        const t = frame.t, g = UI.currentImage().gray;
        const mx = Math.max(...hist) * 0.7;
        const rw = O.rows[t];
        const pl = UI.plot(cvH, { w: 560, h: 190, x: [0, 255], y: [0, mx], series: [{ type: 'bar', data: hist, bw: 1.6, colorAt: x => (x <= t ? '--ink' : '--orange') }], vlines: [{ x: t, label: 't=' + t, color: '--green' }, { x: frame.best, label: 'T=' + frame.best, color: '--neg', dash: [4, 3] }] });
        const cx = cvH.getContext('2d'), band = (m, v, col, lab) => {
          if (!v && !m) return; const sd = Math.sqrt(v), y = pl.H - pl.m.b - 16;
          cx.fillStyle = UI.col(col); cx.globalAlpha = 0.18; cx.fillRect(pl.X(Math.max(0, m - sd)), pl.m.t, pl.X(Math.min(255, m + sd)) - pl.X(Math.max(0, m - sd)), pl.H - pl.m.t - pl.m.b); cx.globalAlpha = 1;
          cx.strokeStyle = UI.col(col); cx.lineWidth = 2.5; cx.beginPath(); cx.moveTo(pl.X(m - sd), y); cx.lineTo(pl.X(m + sd), y); cx.stroke();
          cx.beginPath(); cx.arc(pl.X(m), y, 4.5, 0, 7); cx.fill();
          cx.font = '11px ' + UI.tok('--mono').split(',')[0]; cx.textAlign = 'center'; cx.fillText(lab, pl.X(m), y - 8);
        };
        band(rw.m0, rw.v0, '--neg', 'μ₀±σ₀'); band(rw.m1, rw.v1, '--bad', 'μ₁±σ₁');
        const tot = rw.w0 * rw.v0 + rw.w1 * rw.v1 || 1, vmx = Math.max(...O.rows.map(r => r.vw));
        varBar.replaceChildren(
          h('div', { class: 'caption' }, `v_within(${t}) = w₀v₀ + w₁v₁ = ${(rw.w0 * rw.v0).toFixed(0)} + ${(rw.w1 * rw.v1).toFixed(0)} = ${rw.vw.toFixed(0)}`),
          h('div', { style: { display: 'flex', height: '18px', width: (rw.vw / vmx * 100) + '%', minWidth: '4px', borderRadius: '4px', overflow: 'hidden', transition: 'width .1s' } },
            h('div', { style: { flex: String(rw.w0 * rw.v0 / tot), background: 'var(--neg)' } }), h('div', { style: { flex: String(rw.w1 * rw.v1 / tot), background: 'var(--bad)' } })));
        const vmax = Math.max(...O.rows.map(r => r.vw));
        UI.plot(cvV, { w: 560, h: 150, x: [0, 255], y: [0, vmax], series: [{ type: 'line', data: O.rows.slice(0, t + 1).map(r => [r.t, r.vw]), color: '--green' }], dots: [{ x: frame.best, y: O.rows[frame.best].vw, color: '--neg', label: 'min' }], yfmt: v => Math.round(v) });
        ivB.draw(g.map(r => r.map(v => (v > t ? 255 : 0))));
        ivB.setInfo(`t = ${t}`);
      }
      UI.onImage(rebuild);
      root.append(h('div', { class: 'lab' },
        h('div', { class: 'stack' },
          h('div', { class: 'card' }, h('div', { class: 'controls' }, UI.imagePicker()),
            h('div', { style: { marginTop: '8px' } }, cvH, h('span', { class: 'caption' }, '히스토그램 — 검정: 흑 그룹 [0,t], 주황: 백 그룹 [t+1,255]. 파랑/빨강 띠: 각 그룹의 평균 μ ± 표준편차 σ — 띠가 좁을수록 그룹이 균일합니다.')),
            h('div', { style: { marginTop: '8px' } }, varBar, h('span', { class: 'caption' }, '막대 길이 = v_within (짧을수록 좋음), 파랑 = 흑 그룹 몫 w₀v₀, 빨강 = 백 그룹 몫 w₁v₁')),
            h('div', { style: { marginTop: '8px' } }, cvV, h('span', { class: 'caption' }, 'v_within(t) — 골짜기의 바닥이 T'))),
          st.root,
          h('div', { class: 'imgs two' }, ivIn.el, ivB.el)),
        h('div', { class: 'stack' }, st.panel, h('div', { class: 'note' }, '봉우리 두 개 사이의 계곡이 분명하면 T가 계곡에 놓입니다. 계곡이 없는 자연 영상에서도 오츄는 “두 그룹 분산의 가중합 최소”라는 기준으로 T를 정해 줍니다.'))));
      const review = h('section', { class: 'otsu-review' });
      review.innerHTML = R`
        <header><span class="caption">다시 공부할 때 · 생각하는 순서</span>
          <h2>평균은 밝기의 평균.<br>분산은 거리 제곱의 평균.</h2>
          <p>먼저 화소를 하나씩 보고 계산해 보세요.<br>PDF 식은 같은 밝기의 화소를 묶어서 쓴 것입니다.</p>
        </header>
        <article class="card">
          <span class="caption">01 · 평균</span><h3>밝기를 하나씩 더하고, 화소 개수로 나눈다.</h3>
          <p>그룹 안의 화소들이 얼마나 밝은지, 대표값 하나로 나타내는 것입니다.</p>
          <div class="otsu-math">$$\text{평균}=\frac{\text{각 화소의 밝기를 모두 더한 값}}{\text{그룹의 화소 개수}}$$</div>
          <p>예를 들어 한 그룹의 밝기가 \( [0,1,2] \)라면:</p>
          <div class="otsu-math">$$\mu=\frac{0+1+2}{3}=1$$</div>
        </article>
        <article class="card">
          <span class="caption">02 · 분산</span><h3>평균에서 얼마나 떨어졌는지 제곱하고, 그것들의 평균을 낸다.</h3>
          <p>각 화소에서 평균을 빼면 <b>편차</b>입니다. 편차를 제곱해서 더한 뒤, 그룹의 화소 개수로 나눕니다. <b>밝기의 평균을 구했던 것처럼, 이번에는 편차 제곱의 평균을 구하는 것</b>입니다.</p>
          <div class="otsu-math">$$\text{분산}=\frac{\text{각 화소의 }(\text{밝기}-\text{평균})^2\text{을 모두 더한 값}}{\text{그룹의 화소 개수}}$$</div>
          <div class="otsu-math">$$v=\frac{(0-1)^2+(1-1)^2+(2-1)^2}{3}=\frac{2}{3}$$</div>
          <p class="otsu-aside">왜 제곱할까요? 음수와 양수가 서로 상쇄되지 않게 하고, 평균에서 멀리 떨어진 값을 더 크게 반영하기 위해서입니다. 오츄에서는 그룹의 화소 개수로 나눕니다.</p>
        </article>
        <article class="card">
          <span class="caption">03 · PDF 식으로 연결</span><h3>같은 밝기를 여러 번 더하는 대신, 개수를 곱한다.</h3>
          <p>예를 들어 \([1,1,1,3]\)에서 밝기 1은 세 번 나옵니다. 세 번 더하는 것을 한 항으로 묶으면 됩니다.</p>
          <div class="otsu-math">$$\mu=\frac{1+1+1+3}{4}=\frac{1\times3+3\times1}{4}$$</div>
          <div class="otsu-math">$$v=\frac{3(1-\mu)^2+1(3-\mu)^2}{4}$$</div>
          <p><b>히스토그램을 곱하는 이유가 이것입니다.</b> 밝기 \(i\)인 화소가 \(h(i)\)개 있으니, 그 항을 \(h(i)\)번 반영합니다. \(i\)는 위치가 아니라 <b>밝기 값</b>입니다.</p>
          <details><summary>그런데 PDF는 왜 개수 대신 비율을 쓸까?</summary>
            <p>전체 화소 수를 \(N\), 지금 그룹의 화소 수를 \(n\)이라고 하면:</p>
            <div class="otsu-math">$$\hat h(i)=\frac{h(i)}{N},\qquad w=\frac{n}{N}$$</div>
            <p>분자도 전체 개수로 나누고, 분모도 전체 개수로 나눈 것이므로 서로 약분됩니다. <b>비율로 계산해도 평균·분산은 같습니다.</b></p>
            <div class="otsu-math">$$\frac{\sum_i(i-\mu)^2\hat h(i)}{w}=\frac{\frac{1}{N}\sum_i(i-\mu)^2h(i)}{\frac{n}{N}}=\frac{\sum_i(i-\mu)^2h(i)}{n}$$</div>
            <p>비율은 영상 크기와 관계없이 분포를 표현하고, 그룹의 비중을 나타내기 편합니다. 더 정확한 별도의 계산법은 아닙니다.</p>
          </details>
        </article>
        <article class="card">
          <span class="caption">04 · 오츄가 비교하는 값</span><h3>각 그룹의 분산을, 그룹이 차지하는 비율만큼 합친다.</h3>
          <div class="otsu-math">$$v_{\mathrm{within}}=\underbrace{w_0v_0}_{\text{왼쪽 비율 × 왼쪽 분산}}+\underbrace{w_1v_1}_{\text{오른쪽 비율 × 오른쪽 분산}}$$</div>
          <p>임계값을 바꿀 때마다 두 그룹의 평균·분산을 다시 구합니다. <b>이 가중합이 가장 작을 때의 임계값</b>을 고르면 됩니다.</p>
          <p class="otsu-aside">그래프의 띠는 계산 범위가 아니라 평균 ± 표준편차입니다. 분산은 임계값 양쪽의 각 그룹 전체로 계산합니다. 오츄는 누적 비율로 그룹의 비중을 구하지만, 평활화처럼 밝기를 바꾸지는 않습니다.</p>
        </article>
        <article class="card">
          <span class="caption">직접 풀어 보기</span><h3>같은 문제를 두 방식으로 계산해 보세요.</h3>
          <div class="otsu-math">$$[0,1,2,4,4],\qquad L=5,\qquad\hat h=\left[\frac15,\frac15,\frac15,0,\frac25\right]$$</div>
          <p>왼쪽은 \(i\le t\), 오른쪽은 \(i>t\)입니다. \(t=0,1,2,3\)에서 <b>그룹 비율 → 평균 → 분산 → 가중합</b>을 구해 보세요.</p>
          <details><summary>임계값 2 · 직접 계산한 풀이</summary>
            <p>왼쪽은 \([0,1,2]\), 오른쪽은 \([4,4]\)입니다.</p>
            <div class="otsu-math">$$w_0=\frac35,\qquad w_1=\frac25$$
            $$\mu_0=\frac{0+1+2}{3}=1,\qquad\mu_1=\frac{4+4}{2}=4$$
            $$v_0=\frac{(0-1)^2+(1-1)^2+(2-1)^2}{3}=\frac23$$
            $$v_1=\frac{(4-4)^2+(4-4)^2}{2}=0$$</div>
          </details>
          <details><summary>임계값 2 · PDF 비율 방식의 풀이</summary>
            <p>밝기별 비율을 곱해 더한 다음, 해당 그룹의 비율로 나눕니다.</p>
            <div class="otsu-math">$$\mu_0=\frac{0\cdot\frac15+1\cdot\frac15+2\cdot\frac15}{\frac35}=1$$
            $$\mu_1=\frac{3\cdot0+4\cdot\frac25}{\frac25}=4$$
            $$v_0=\frac{(0-1)^2\frac15+(1-1)^2\frac15+(2-1)^2\frac15}{\frac35}=\frac23$$
            $$v_1=\frac{(3-4)^2\cdot0+(4-4)^2\frac25}{\frac25}=0$$</div>
            <p>두 방식 모두 가중합은 같습니다.</p>
            <div class="otsu-math">$$v_{\mathrm{within}}(2)=\frac35\cdot\frac23+\frac25\cdot0=0.4$$</div>
          </details>
          <details><summary>전체 정답과 최종 임계값</summary>
            <div class="otsu-math">$$\begin{array}{c|cc|cc|cc|c}t&w_0&w_1&\mu_0&\mu_1&v_0&v_1&v_{\mathrm{within}}\\\hline
            0&1/5&4/5&0&11/4&0&27/16&1.35\\
            1&2/5&3/5&1/2&10/3&1/4&8/9&19/30\\
            2&3/5&2/5&1&4&2/3&0&0.4\\
            3&3/5&2/5&1&4&2/3&0&0.4
            \end{array}$$</div>
            <p>\(t=2,3\)에서 최솟값 \(0.4\)로 동률입니다. 밝기 3인 화소가 없어서 두 분할이 같습니다. 이 사이트는 더 작을 때만 갱신하므로 먼저 만난 \(T=2\)를 선택합니다. \(t=4\)는 오른쪽 그룹이 비어서 제외합니다.</p>
          </details>
        </article>`;
      root.append(review);
      rebuild();
    },
  });

  // ================= 2.3.2 connected components =================
  const CC_IMG = `0 0 0 0 0 0 0 0 0 0
0 0 0 0 1 1 0 0 0 0
0 0 0 0 0 1 0 0 0 0
0 0 0 0 0 1 0 0 0 0
0 1 1 0 0 1 0 1 1 0
0 1 0 1 0 1 1 0 1 0
0 1 0 1 0 1 0 0 1 0
0 1 0 1 0 1 0 0 1 0
0 1 1 0 0 1 0 0 1 0
0 0 0 0 0 0 0 0 0 0`;
  const labelColor = v => `hsl(${(v * 137.5 + 20) % 360} 62% 58%)`;
  APP.mod({
    id: 'cc', ch: '2', num: '2.3.2', title: '연결요소 번호 붙이기', src: '2강 p.27–31 · 알고리즘 2-5, 2-6', star: true,
    blurb: '범람 채움 재귀 호출을 호출 스택과 함께 한 줄씩. 4-연결성 vs 8-연결성, 열 단위 버전.',
    mount(root, m) {
      APP.scaffold(root, m, {
        lead: '이진 영상에서 서로 이어진 1 화소 묶음에 같은 번호를 붙입니다. <b>범람 채움</b>은 번호 없는 화소(-1)를 만나면 번호를 붙이고 이웃으로 재귀 호출합니다. 오른쪽 <b>호출 스택</b>이 쌓였다가 풀리는 모습을 보세요 — 영상이 크면 이 스택이 넘칩니다(스택 오버플로). 입력 격자는 칸을 드래그해 그릴 수 있습니다.',
        formulas: [],
      });
      let b = APP.parseGrid(CC_IMG), conn = 4, algo = 'rec', frame = null, st = null;
      const M = 10, N = 10;
      const gIn = UI.GridView({
        rows: M, cols: N, cs: 22, fs: 11, axes: false, label: '입력 이진 영상',
        cell: (y, x) => ({ t: b[y][x], cls: b[y][x] ? 'on' : '' }),
        paint: { start: (y, x) => 1 - b[y][x], apply: (y, x, v) => { if (b[y][x] !== v) { b[y][x] = v; gIn.draw(); clearTimeout(gIn.t); gIn.t = setTimeout(rebuild, 120); } } },
      });
      const gL = UI.GridView({
        rows: M, cols: N, cs: 36, label: '번호 영상 l',
        cell: (y, x) => {
          if (!frame) return {};
          const v = frame.l[y][x], cur = frame.cur && frame.cur[0] === y && frame.cur[1] === x;
          const s = v === -1 ? { t: '-1', cls: 'on' } : v === 0 ? { t: '0', color: 'var(--faint)' } : { t: v, bg: labelColor(v), color: '#111', bold: true };
          if (cur) s.cls = (s.cls || '') + ' cur';
          return s;
        },
      });
      const DIRS4 = [[0, 1, 'east'], [-1, 0, 'north'], [0, -1, 'west'], [1, 0, 'south']];
      const DIRS8 = DIRS4.concat([[-1, 1, 'north-east'], [-1, -1, 'north-west'], [1, -1, 'south-west'], [1, 1, 'south-east']]);
      function recCode(c) {
        const d = c === 4 ? DIRS4 : DIRS8;
        return ['b를 l로 복사한다. 이때 0은 0, 1은 -1로 복사한다.  // -1은 아직 번호를 안 붙였음을 표시',
          'l의 경계, 즉 j=0, j=M-1, i=0, i=N-1인 화소를 0으로 설정한다.  // 영상 바깥으로 나가는 것을 방지',
          'label=1;', 'for(j=1 to M-2)', '  for(i=1 to N-2) {', '    if(l(j,i)=-1) {', `      flood_fill${c}(l,j,i,label);`, '      label++;', '    }', '  }', '',
          `// ${c}-연결성 범람 채움 함수`, `function flood_fill${c}(l,j,i,label) {`, '  if(l(j,i)=-1) {   // 아직 번호를 안 붙인 화소이면', '    l(j,i)=label;',
          ...d.map(([a, bb, n]) => `    flood_fill${c}(l,j${a ? (a > 0 ? '+1' : '-1') : ''},i${bb ? (bb > 0 ? '+1' : '-1') : ''},label);  // ${n}`), '  }', '}'];
      }
      const EFF_CODE = ['b를 l로 복사한다. 이때 0은 0, 1은 -1로 복사한다.', 'l의 경계 화소를 0으로 설정한다.', 'label=1;', 'for(j=1 to M-2)', '  for(i=1 to N-2) {', '    if(l(j,i)=-1) {', '      efficient_floodfill4(l,j,i,label);', '      label++;', '    }', '  }', '',
        '// 메모리를 적게 사용하는 효율적인 4-연결성 범람 채움 함수', 'function efficient_floodfill4(l,j,i,label) {', '  Q=∅;   // 빈 큐 Q를 생성한다.', '  push(Q,(j,i));', '  while(Q≠∅) {', '    (y,x)=pop(Q);   // Q에서 원소를 하나 꺼낸다.', '    if(l(y,x)=-1) {', '      left=right=x;', '      while(l(y,left-1)=-1) left--;   // 아직 미처리 상태인 열을 찾는다.', '      while(l(y,right+1)=-1) right++;', '      for(c=left to right) {', '        l(y,c)=label;', '        if(l(y-1,c)=-1 and (c=left or l(y-1,c-1)≠-1)) push(Q,(y-1,c));', '        if(l(y+1,c)=-1 and (c=left or l(y+1,c-1)≠-1)) push(Q,(y+1,c));', '      }', '    }', '  }', '}'];

      function framesRec() {
        const l = b.map(r => r.map(v => (v ? -1 : 0))), fr = [], stack = [], dirs = conn === 4 ? DIRS4 : DIRS8;
        let label = 1, maxDepth = 0, calls = 0;
        const fname = `flood_fill${conn}`;
        const snap = (line, note, cur, vars = {}) => fr.push({ line, l: CV.clone(l), cur, note, vars: { label, ...vars, '스택 깊이': stack.length }, stack: stack.map(s => `<span class="fname">${fname}</span>(j=${s.j}, i=${s.i}) <span style="color:var(--muted)">· ${s.line}행에서 대기</span>`) });
        snap(1, 'b를 l로 복사: 1인 화소는 <b>-1</b>(아직 번호 없음), 0은 0.');
        for (let y = 0; y < M; y++) for (let x = 0; x < N; x++) if (y === 0 || x === 0 || y === M - 1 || x === N - 1) l[y][x] = 0;
        snap(2, '경계 화소를 0으로 — 재귀가 영상 밖으로 나가지 않게 막는 장치입니다.');
        snap(3, 'label = 1부터 시작');
        const fill = (j, i) => {
          calls++;
          stack.push({ j, i, line: 14 }); maxDepth = Math.max(maxDepth, stack.length);
          const v = l[j][i];
          snap(14, `${fname}(${j},${i}) 호출 — l(${j},${i}) = ${v}` + (v === -1 ? ' → <b>번호 없는 화소</b>이므로 번호를 붙입니다' : v === 0 ? ' → 배경이라 바로 반환' : ` → 이미 번호 ${v}가 있어 바로 반환`), [j, i], { j, i });
          if (v === -1) {
            l[j][i] = label; stack[stack.length - 1].line = 15;
            snap(15, `l(${j},${i}) = <b>${label}</b>`, [j, i], { j, i });
            dirs.forEach(([a, c, n], k) => {
              stack[stack.length - 1].line = 16 + k;
              snap(16 + k, `${n} 이웃 (${j + a},${i + c})로 재귀 호출 → 스택에 새 칸이 쌓입니다`, [j, i], { j, i });
              fill(j + a, i + c);
            });
          }
          stack.pop();
        };
        for (let j = 1; j < M - 1; j++) for (let i = 1; i < N - 1; i++) {
          const v = l[j][i];
          snap(6, `주사: l(${j},${i}) = ${v}` + (v === -1 ? ' → <b>새 연결요소 발견!</b>' : ' → 건너뜀'), [j, i], { j, i });
          if (v === -1) {
            snap(7, `${fname}(l, ${j}, ${i}, ${label}) 호출`, [j, i], { j, i });
            fill(j, i);
            snap(8, `연결요소 ${label} 완성 → label++`, [j, i], { j, i });
            label++;
          }
        }
        fr.push({ ...fr[fr.length - 1], line: [], note: `끝. 연결요소 ${label - 1}개, 함수 호출 ${calls}번, 최대 스택 깊이 <b>${maxDepth}</b>.`, stack: [] });
        return fr;
      }
      function framesEff() {
        const l = b.map(r => r.map(v => (v ? -1 : 0))), fr = [];
        for (let y = 0; y < M; y++) for (let x = 0; x < N; x++) if (y === 0 || x === 0 || y === M - 1 || x === N - 1) l[y][x] = 0;
        let label = 1, Q = [], maxQ = 0;
        const snap = (line, note, cur, vars = {}) => fr.push({ line, l: CV.clone(l), cur, note, vars: { label, ...vars, '큐 길이': Q.length }, stack: Q.map(([y, x]) => `(${y}, ${x})`) });
        snap([1, 2, 3], 'b를 l로 복사하고 경계를 0으로, label=1.');
        for (let j = 1; j < M - 1; j++) for (let i = 1; i < N - 1; i++) {
          snap(6, `주사: l(${j},${i}) = ${l[j][i]}` + (l[j][i] === -1 ? ' → <b>새 연결요소</b>' : ''), [j, i], { j, i });
          if (l[j][i] !== -1) continue;
          Q = []; snap(14, 'Q = ∅', [j, i]);
          Q.push([j, i]); snap(15, `push(Q, (${j},${i}))`, [j, i]);
          while (Q.length) {
            const [y, x] = Q.shift();
            snap(17, `pop(Q) → (${y},${x}), l = ${l[y][x]}` + (l[y][x] === -1 ? '' : ' → 이미 처리됨, 건너뜀'), [y, x], { y, x });
            if (l[y][x] !== -1) continue;
            let left = x, right = x;
            while (l[y][left - 1] === -1) left--;
            while (l[y][right + 1] === -1) right++;
            snap([19, 20, 21], `같은 행에서 -1이 이어진 구간: left=${left}, right=${right}`, [y, x], { y, x, left, right });
            for (let c = left; c <= right; c++) {
              l[y][c] = label;
              const pu = [];
              if (l[y - 1][c] === -1 && (c === left || l[y - 1][c - 1] !== -1)) { Q.push([y - 1, c]); pu.push(`(${y - 1},${c})`); }
              if (l[y + 1][c] === -1 && (c === left || l[y + 1][c - 1] !== -1)) { Q.push([y + 1, c]); pu.push(`(${y + 1},${c})`); }
              maxQ = Math.max(maxQ, Q.length);
              snap([23, 24, 25], `l(${y},${c}) = ${label}` + (pu.length ? ` · 위/아래 행의 새 구간 시작점 ${pu.join(', ')}을 큐에 넣음` : ''), [y, c], { y, c, left, right });
            }
          }
          snap(8, `연결요소 ${label} 완성 → label++`, [j, i]); label++;
        }
        fr.push({ ...fr[fr.length - 1], line: [], note: `끝. 연결요소 ${label - 1}개, 큐 최대 길이 <b>${maxQ}</b> — 재귀 버전의 스택 깊이와 비교해 보세요.` });
        return fr;
      }
      const lab = h('div', { class: 'lab wide-code' });
      function rebuild() {
        if (algo === 'eff' && conn === 8) { conn = 4; connSeg.set(4); }
        gIn.draw();
        const code = algo === 'rec' ? recCode(conn) : EFF_CODE;
        const prev = st;
        st = UI.Stepper({ code, title: algo === 'rec' ? `알고리즘 2-5 범람 채움 (${conn}-연결성)` : '알고리즘 2-6 범람 채움 (메모리 절약)', render: fr => { frame = fr; gL.draw(); } });
        if (prev) prev.stop();
        lab.replaceChildren(
          h('div', { class: 'stack' },
            h('div', { class: 'card' }, h('div', { class: 'controls' }, UI.labeled('연결성', connSeg), UI.labeled('방식', algoSeg), h('button', { class: 'btn', onclick: () => { b = APP.parseGrid(CC_IMG); gIn.draw(); rebuild(); } }, '그림 2-17로 되돌리기')),
              h('div', { class: 'row', style: { marginTop: '10px' } },
                h('div', { class: 'col' }, h('span', { class: 'caption' }, '입력 b (드래그해서 그리기)'), gIn.el),
                h('div', { class: 'col' }, h('span', { class: 'caption' }, '번호 영상 l — 검정: -1(미처리), 색: 번호, 주황 테두리: 지금 보는 화소'), gL.el))),
            st.root,
            h('div', { class: 'note' }, '같은 입력이라도 4-연결성에서는 대각선으로만 닿은 화소가 다른 번호를 받습니다(그림 2-17 b와 c). 연결성을 바꿔 번호가 어떻게 합쳐지는지 확인해 보세요.')),
          h('div', { class: 'stack' }, st.panel));
        st.load(algo === 'rec' ? framesRec() : framesEff(), 'end');
      }
      const connSeg = UI.segmented([[4, '4-연결'], [8, '8-연결']], 4, v => { conn = v; rebuild(); }, '연결성');
      const algoSeg = UI.segmented([['rec', '재귀 (2-5)'], ['eff', '열 단위 (2-6)']], 'rec', v => { algo = v; rebuild(); }, '방식');
      root.append(lab);
      rebuild();
    },
  });

  // ================= 2.4.1 point operations =================
  APP.mod({
    id: 'point', ch: '2', num: '2.4.1', title: '점 연산', src: '2강 p.33–35 · 식 (2.10)–(2.13)',
    blurb: '밝게·어둡게·반전·감마·디졸브 — 변환 곡선과 결과 영상을 함께.',
    mount(root, m) {
      APP.scaffold(root, m, {
        lead: '점 연산은 <b>자기 자신의 명암값만</b> 보고 새 값을 정합니다. 그래서 연산 전체가 0~255 → 0~255의 곡선 하나로 표현됩니다. 연산을 고르고 매개변수를 움직이면서 곡선과 영상이 함께 바뀌는 것을 보세요. 영상 위에 마우스를 올리면 그 화소의 입력→출력 값을 보여 줍니다.',
        formulas: [[R`$$f_{out}(j,i)=\begin{cases}\min(f(j,i)+a,\,L-1) & \text{밝게}\\ \max(f(j,i)-a,\,0) & \text{어둡게}\\ (L-1)-f(j,i) & \text{반전}\end{cases}$$`, '선형 연산'], [R`$$f_{out}=(L-1)\times\hat f^{\,\gamma},\quad \hat f=\frac{f}{L-1}$$`, '감마 수정'], [R`$$f_{out}=\alpha f_1+(1-\alpha)f_2$$`, '디졸브 식 (2.13)']],
      });
      let op = 'bright', a = 32, gamma = 0.67, alpha = 0.5;
      const cv = h('canvas');
      const ivA = UI.ImageView({ caption: '원본 f', onHover: (y, x) => hover(y, x) }), ivB = UI.ImageView({ caption: '결과 f_out', onHover: (y, x) => hover(y, x) });
      const ivC = UI.ImageView({ caption: '두 번째 영상 f₂' });
      const info = h('div', { class: 'note' }, '영상 위에 마우스를 올려 보세요.');
      let second = UI.SCENES.text[1]().gray;
      const T = v => op === 'bright' ? Math.min(v + a, 255) : op === 'dark' ? Math.max(v - a, 0) : op === 'inv' ? 255 - v : op === 'gamma' ? 255 * Math.pow(v / 255, gamma) : v;
      const outAt = (g, y, x) => (op === 'dissolve' ? alpha * g[y][x] + (1 - alpha) * (second[y] ? second[y][x] ?? 0 : 0) : T(g[y][x]));
      function hover(y, x) {
        const g = UI.currentImage().gray, v = g[y][x], o = outAt(g, y, x);
        info.innerHTML = op === 'dissolve' ? `(${y},${x}): ${alpha.toFixed(2)}×${v} + ${(1 - alpha).toFixed(2)}×${second[y][x]} = <b>${o.toFixed(1)}</b>` : `(${y},${x}): f = ${v} → f_out = <b>${o.toFixed(1)}</b>`;
        draw(v);
      }
      const pa = UI.slider({ label: 'a', min: 0, max: 128, value: a, id: 'pt-a', oninput: v => { a = v; draw(); } });
      const pg = UI.slider({ label: 'γ', min: 0.2, max: 3, step: 0.01, value: gamma, id: 'pt-g', fmt: v => v.toFixed(2), oninput: v => { gamma = v; draw(); } });
      const pal = UI.slider({ label: 'α', min: 0, max: 1, step: 0.01, value: alpha, id: 'pt-al', fmt: v => v.toFixed(2), oninput: v => { alpha = v; draw(); } });
      const seg = UI.segmented([['bright', '밝게'], ['dark', '어둡게'], ['inv', '반전'], ['gamma', '감마'], ['dissolve', '디졸브']], op, v => { op = v; draw(); }, '연산');
      function draw(hv) {
        pa.hidden = !(op === 'bright' || op === 'dark'); pg.hidden = op !== 'gamma'; pal.hidden = op !== 'dissolve'; ivC.el.hidden = op !== 'dissolve';
        const img = UI.currentImage(), g = img.gray;
        if (second.length !== g.length || second[0].length !== g[0].length) second = g.map((r, y) => r.map((_, x) => ((x >> 4) + (y >> 4)) % 2 ? 220 : 40));
        ivA.draw(g); ivB.draw(g.map((r, y) => r.map((_, x) => outAt(g, y, x)))); ivC.draw(second);
        const xs = [...Array(256).keys()];
        const series = op === 'dissolve' ? [{ type: 'line', data: xs.map(x => [x, alpha * x]), color: '--orange' }] : [{ type: 'line', data: xs.map(x => [x, T(x)]), color: '--orange', width: 2.5 }];
        UI.plot(cv, { w: 300, h: 260, x: [0, 255], y: [0, 255], xticks: [0, 64, 128, 192, 255], yticks: [0, 64, 128, 192, 255], series: [{ type: 'line', data: [[0, 0], [255, 255]], color: '--faint', width: 1, dash: [3, 3] }, ...series], vlines: hv !== undefined ? [{ x: hv, color: '--neg', label: 'f=' + hv }] : [], dots: hv !== undefined && op !== 'dissolve' ? [{ x: hv, y: T(hv), color: '--neg' }] : [] });
      }
      UI.onImage(() => draw());
      root.append(h('div', { class: 'lab' },
        h('div', { class: 'stack' },
          h('div', { class: 'card' }, h('div', { class: 'controls' }, seg, pa, pg, pal, UI.imagePicker())),
          h('div', { class: 'imgs two' }, ivA.el, ivB.el, ivC.el), info),
        h('div', { class: 'stack' }, h('div', { class: 'card' }, h('h3', {}, '변환 곡선 t(·)', h('small', {}, '가로: 입력 f, 세로: 출력 f_out')), cv, h('p', { class: 'caption' }, 'γ<1이면 곡선이 위로 볼록 → 어두운 부분이 밝아지고, γ>1이면 아래로 볼록 → 전체가 어두워집니다 (그림 2-19). 디졸브는 k=2인 점 연산으로, α에 따라 f₁에서 f₂로 서서히 바뀝니다.')))));
      draw();
    },
  });
})();

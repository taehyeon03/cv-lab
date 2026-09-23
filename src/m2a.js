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
            h('div', { class: 'row' }, tbl, h('div', { class: 'col', style: { flex: '1 1 260px' } }, cvC, h('span', { class: 'caption' }, '누적 c(l)×(L−1) 곡선이 곧 매핑 함수입니다')))),
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
        UI.plot(cvH, { w: 560, h: 170, x: [0, 255], y: [0, mx], series: [{ type: 'bar', data: hist, bw: 1.6, colorAt: x => (x <= t ? '--ink' : '--orange') }], vlines: [{ x: t, label: 't=' + t, color: '--green' }, { x: frame.best, label: 'T=' + frame.best, color: '--neg', dash: [4, 3] }] });
        const vmax = Math.max(...O.rows.map(r => r.vw));
        UI.plot(cvV, { w: 560, h: 150, x: [0, 255], y: [0, vmax], series: [{ type: 'line', data: O.rows.slice(0, t + 1).map(r => [r.t, r.vw]), color: '--green' }], dots: [{ x: frame.best, y: O.rows[frame.best].vw, color: '--neg', label: 'min' }], yfmt: v => Math.round(v) });
        ivB.draw(g.map(r => r.map(v => (v > t ? 255 : 0))));
        ivB.setInfo(`t = ${t}`);
      }
      UI.onImage(rebuild);
      root.append(h('div', { class: 'lab' },
        h('div', { class: 'stack' },
          h('div', { class: 'card' }, h('div', { class: 'controls' }, UI.imagePicker()),
            h('div', { style: { marginTop: '8px' } }, cvH, h('span', { class: 'caption' }, '히스토그램 — 검정: 흑 그룹 [0,t], 주황: 백 그룹 [t+1,255]')),
            h('div', { style: { marginTop: '8px' } }, cvV, h('span', { class: 'caption' }, 'v_within(t) — 골짜기의 바닥이 T'))),
          st.root,
          h('div', { class: 'imgs two' }, ivIn.el, ivB.el)),
        h('div', { class: 'stack' }, st.panel, h('div', { class: 'note' }, '봉우리 두 개 사이의 계곡이 분명하면 T가 계곡에 놓입니다. 계곡이 없는 자연 영상에서도 오츄는 “두 그룹 분산의 가중합 최소”라는 기준으로 T를 정해 줍니다.'))));
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

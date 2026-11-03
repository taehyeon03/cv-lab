// Chapter 5 modules, part B: graph representation, minimum spanning tree (Felzenszwalb), normalised cut, mean shift
(() => {
  const { h, fmt } = UI;
  const R = String.raw;
  const css = c => `rgb(${c.map(v => Math.round(v)).join(',')})`;
  // Fig 5-8 / 5-9 / 5-11: 10-level 5×5 image, nodes v0..v24 in row-major order
  const F58 = [[3, 7, 2, 2, 2], [3, 6, 9, 8, 1], [2, 8, 7, 4, 1], [1, 1, 4, 5, 4], [2, 2, 1, 1, 1]];
  const vName = i => 'v' + i;
  // draw node grid + edge weights between cells as an SVG overlay
  function edgeOverlay(G, E, opt = {}) {
    const items = [];
    for (const e of E) {
      const y1 = Math.floor(e.p / 5), x1 = e.p % 5, y2 = Math.floor(e.q / 5), x2 = e.q % 5;
      const cx = (G.cx(x1) + G.cx(x2)) / 2, cy = (G.cy(y1) + G.cy(y2)) / 2, st = opt.style ? opt.style(e) : {};
      const val = opt.value ? opt.value(e) : e.w;
      if (st.line) items.push({ type: 'line', pts: [y1, x1, y2, x2], color: st.line, w: st.w || 3, dash: st.dash, op: st.op });
      items.push({ type: 'raw', svg: `<rect x="${cx - 9}" y="${cy - 8}" width="18" height="16" rx="3" fill="var(--surface)" stroke="${st.stroke || 'none'}" stroke-width="2"/><text x="${cx}" y="${cy + 4}" text-anchor="middle" font-size="11" font-family="var(--mono)" fill="${st.text || 'var(--neg)'}" font-weight="${st.bold ? 700 : 400}">${val}</text>` });
    }
    G.overlay(items);
  }

  // ================= 5.3 graph representation (Example 5-1) =================
  APP.mod({
    id: 'graph53', ch: '5', num: '5.3', title: '영상의 그래프 표현', src: '5강 p.17–19 · 식 (5.5), 예제 5-1, 그림 5-8',
    blurb: '화소 = 노드, 이웃 화소 쌍 = 에지(가중치 = 명암 차이). 25×25 인접 행렬이 대각선 띠인 희소행렬이 되는 이유.',
    mount(root, m) {
      APP.scaffold(root, m, {
        lead: '영상을 <b>그래프 G = (V, E)</b>로 바꿉니다. 화소 하나가 노드 하나이고, 거리 r 이내의 화소 쌍만 에지로 잇습니다. 에지 가중치는 <b>거리</b> d(명암 차이, 작을수록 비슷) 또는 <b>유사도</b> s = e<sup>−d</sup>(클수록 비슷)입니다. 예제 5-1의 5×5 영상(10단계 명암, r=1 → 4-이웃)을 그래프와 인접 행렬로 바꿔 보세요. 격자의 숫자를 클릭해 바꾸면 가중치가 다시 계산됩니다.',
        formulas: [[R`$$d_{pq}=\begin{cases}|f(v_p)-f(v_q)|,&v_q\in Neigh(v_p)\\\infty,&\text{그렇지 않으면}\end{cases}\qquad s_{pq}=\begin{cases}e^{-d_{pq}},&v_q\in Neigh(v_p)\\0,&\text{그렇지 않으면}\end{cases}$$`, '식 (5.5)  (‖x(v_q)−x(v_p)‖ ≤ r 이면 이웃)']],
      });
      SEG5UI.flow(root, '5.3', { prev: '5.2의 방법은 화소나 블록 하나하나를 규칙으로 판정해 <b>지역 정보</b>만 썼습니다(그림 5-2의 딜레마).', idea: '영상 전체를 하나의 그래프로 보고, 분할을 “어느 에지를 자를까”라는 <b>전역 최적화 문제</b>로 바꿉니다. 비슷한 노드 쌍은 같은 연결요소, 다른 쌍은 다른 연결요소가 될 <b>가능성이 높다</b>고 봅니다.', next: '목적 함수와 탐색 알고리즘을 어떻게 정하느냐로 갈립니다 → 최소 신장트리(5.3.1), 정규화 절단(5.3.2).' });
      let f = F58.map(r => r.slice()), nb = 4, wmode = 'd', sel = null;
      const G = UI.GridView({ rows: 5, cols: 5, cs: 64, fs: 15, label: '5×5 영상', cell: (y, x) => ({ t: f[y][x], sub: vName(y * 5 + x), cls: sel === y * 5 + x ? 'cur' : '' }), onClick: (y, x, e) => { if (e.shiftKey) { f[y][x] = (f[y][x] + 1) % 10; } else sel = sel === y * 5 + x ? null : y * 5 + x; draw(); } });
      const matBox = h('div', { style: { overflowX: 'auto' } }), info = h('div');
      function draw() {
        const E = SEG.gridGraph(f, nb), val = e => (wmode === 'd' ? e.w : Math.exp(-e.w).toFixed(2).replace(/^0/, ''));
        G.draw();
        edgeOverlay(G, E, { value: val, style: e => (sel !== null && (e.p === sel || e.q === sel) ? { stroke: 'var(--orange)', bold: true, text: 'var(--ink)' } : {}) });
        const n = 25, M = Array.from({ length: n }, () => new Array(n).fill(null));
        for (const e of E) M[e.p][e.q] = M[e.q][e.p] = wmode === 'd' ? e.w : Math.exp(-e.w);
        for (let i = 0; i < n; i++) M[i][i] = wmode === 'd' ? 0 : 1;
        const gv = UI.GridView({ rows: n, cols: n, cs: 22, fs: 8, rowLabels: Array.from({ length: n }, (_, i) => vName(i)), colLabels: Array.from({ length: n }, (_, i) => i), label: '인접 행렬', cell: (y, x) => { const v = M[y][x]; const s = v === null ? { t: '·', color: 'var(--faint)' } : { t: wmode === 'd' ? v : v.toFixed(1).replace(/^0/, ''), bg: y === x ? 'var(--surface-2)' : 'color-mix(in srgb, var(--neg) 18%, var(--cell-bg))' }; if (sel !== null && (y === sel || x === sel)) s.cls = 'win'; return s; } });
        gv.draw(); matBox.replaceChildren(gv.el);
        const filled = M.flat().filter(v => v !== null).length;
        info.replaceChildren(h('dl', { class: 'kv' }, h('dt', {}, '노드 수 |V|'), h('dd', {}, '25'), h('dt', {}, '에지 수 |E|'), h('dd', {}, String(E.length)), h('dt', {}, '행렬 칸'), h('dd', {}, `625칸 중 ${filled}칸만 값 있음 (${(filled / 625 * 100).toFixed(0)}%)`), h('dt', {}, 'w₆,₇ / w₇,₈'), h('dd', {}, `${E.find(e => e.p === 6 && e.q === 7).w} / ${E.find(e => e.p === 7 && e.q === 8).w}`)),
          h('p', { class: 'caption', html: `거리로 보면 w₆,₇ = ${E.find(e => e.p === 6 && e.q === 7).w} > w₇,₈ = ${E.find(e => e.p === 7 && e.q === 8).w} 이므로 (v₆, v₇) 사이가 분할선이 될 가능성이 더 높습니다. 노드 v<sub>i</sub>의 이웃은 v<sub>i±1</sub>(좌우)과 v<sub>i±5</sub>(위아래)뿐이라 인접 행렬은 대각선 근처의 띠에만 값이 있는 <b>희소행렬</b>입니다. 8-이웃이면 v<sub>i±4</sub>, v<sub>i±6</sub>이 더해져 띠가 넓어집니다.` }));
      }
      root.append(h('div', { class: 'card' }, h('div', { class: 'controls' }, UI.segmented([[4, '4-이웃 (r=1)'], [8, '8-이웃']], nb, v => { nb = v; draw(); }), UI.segmented([['d', '거리 d (식 5.5)'], ['s', '유사도 e^(−d)']], wmode, v => { wmode = v; draw(); }), h('button', { class: 'btn', type: 'button', onclick: () => { f = F58.map(r => r.slice()); draw(); } }, '예제 5-1 영상으로')),
        h('div', { class: 'row', style: { marginTop: '12px' } }, h('div', { class: 'col' }, h('span', { class: 'caption' }, '파란 숫자 = 에지 가중치 · 클릭: 노드 선택 · Shift+클릭: 명암 +1'), G.el, info), h('div', { class: 'col', style: { flex: '1 1 560px' } }, h('span', { class: 'caption' }, '25×25 인접 행렬 (그림 5-8(b)) — 선택한 노드의 행·열 음영'), matBox))));
      draw();
    },
  });

  // ================= 5.3.1 minimum spanning tree (Felzenszwalb) =================
  APP.mod({
    id: 'mst', ch: '5', num: '5.3.1', title: '최소 신장트리 분할 (Felzenszwalb)', src: '5강 p.20–23 · 식 (5.6)–(5.10), 알고리즘 5-4, 그림 5-9·5-10', star: true,
    blurb: 'intra(C)·mult_intra로 “합쳐도 되는가”를 판정하며 작은 에지부터 합치는 탐욕 알고리즘.',
    mount(root, m) {
      APP.scaffold(root, m, {
        lead: '연결요소 C의 <b>균일성 intra(C)</b>는 C의 최소 신장트리(MST)에서 가장 큰 에지입니다. 두 화소가 직접 많이 달라도 작은 에지로 이어진 길이 있으면 같은 영역일 가능성이 높기 때문입니다. 알고리즘 5-4는 에지를 <b>작은 것부터</b> 보면서 두 연결요소를 이어도 균일성이 크게 나빠지지 않으면(w ≤ mult_intra) 합칩니다. k가 작을수록 세밀하게 나뉩니다.',
        formulas: [
          [R`$$intra(C)=\max_{e\in MST(C)}w_e$$`, '식 (5.6)'],
          [R`$$mult\_intra(C_i,C_j)=\min\big(intra(C_i)+\tau(C_i),\ intra(C_j)+\tau(C_j)\big),\quad \tau(C)=\frac{k}{|C|}$$`, '식 (5.7)'],
          [R`$$D(C_i,C_j)=\big[\,diff(C_i,C_j)>mult\_intra(C_i,C_j)\,\big],\quad diff=\min_{v_p\in C_i,v_q\in C_j}w_{pq}$$`, '식 (5.8)(5.9)'],
        ],
      });
      SEG5UI.flow(root, '5.3', { prev: '5.3 그래프 표현까지는 “어디를 자를 가능성이 높은가”만 말해 줍니다.', idea: '목적 함수 = 모든 이웃 쌍에서 D가 참(거칠지도 세밀하지도 않음). 탐색 = 에지를 정렬해 <b>작은 것부터 한 번씩만</b> 보는 탐욕 알고리즘(O(n)에 가까움).', next: '탐욕적으로 합치기만 하는 대신, 자를 선 전체의 비용을 재는 목적 함수(cut·ncut)를 세우고 최적해를 찾는 방법 → 5.3.2 정규화 절단.' });
      // (1) intra(C) explorer on Fig 5-9
      const E = SEG.gridGraph(F58);
      let C = new Set([1, 6, 7, 11, 12]);
      const Gi = UI.GridView({ rows: 5, cols: 5, cs: 58, fs: 14, label: 'C 고르기', cell: (y, x) => { const i = y * 5 + x; return { t: F58[y][x], sub: vName(i), bg: C.has(i) ? 'color-mix(in srgb, var(--orange) 22%, var(--cell-bg))' : '' }; }, onClick: (y, x) => { const i = y * 5 + x; C.has(i) ? C.delete(i) : C.add(i); drawI(); } });
      const intraBox = h('div');
      function drawI() {
        Gi.draw();
        const r = SEG.mstIntra([...C], E), inM = new Set(r.mst.map(e => e.p + ',' + e.q)), inC = new Set(r.internal.map(e => e.p + ',' + e.q));
        edgeOverlay(Gi, E, { style: e => (inM.has(e.p + ',' + e.q) ? { line: '--bad', w: 4, text: 'var(--bad)', bold: true, stroke: 'var(--bad)' } : inC.has(e.p + ',' + e.q) ? { text: 'var(--ink)' } : { text: 'var(--faint)' }) });
        const add = [13, 8].filter(v => !C.has(v)).map(v => [v, SEG.mstIntra([...C, v], E).intra]);
        intraBox.replaceChildren(h('dl', { class: 'kv' }, h('dt', {}, 'C'), h('dd', {}, '{' + [...C].sort((a, b) => a - b).map(vName).join(', ') + '}'), h('dt', {}, 'MST 에지'), h('dd', {}, r.mst.map(e => `${vName(e.p)}–${vName(e.q)}(${e.w})`).join(', ') || '-'), h('dt', {}, 'intra(C)'), h('dd', {}, r.connected ? String(r.intra) : '연결되지 않음')),
          h('p', { class: 'caption' }, r.connected ? `빨간 선이 MST입니다. intra(C) = ${r.intra}. ` + add.map(([v, it]) => `${vName(v)}를 더하면 intra = ${it}`).join(', ') + '. 교재: v₁₃을 더하면 3이 되어 균일성이 떨어지고, v₈을 더하면 2로 유지되어 v₈이 유리합니다. v₆(6)과 v₇(9)은 직접 차이가 3이지만 3보다 작은 에지로 이어진 길이 있어 같은 영역일 가능성이 높습니다.' : 'C가 하나로 이어지지 않았습니다. 이웃한 칸을 고르세요.'));
      }
      // (2) algorithm 5-4 tracer on the same image
      let k = 4, frame = null, res = null;
      const CODE = ['f로부터 식 (5.5)로 거리 가중치 그래프를 만든다.', '에지를 오름차순으로 정렬한다.', '초기 분할 S0 = {{v_i}} — 노드 각각이 연결요소', 'for(i=1 to |E|) {', '  정렬된 리스트의 i번째 에지를 e=(v_p, v_q)라 하자.', '  v_p와 v_q가 속한 연결요소를 C_p, C_q라 하자.', '  if((C_p ≠ C_q) and w_pq ≤ mult_intra(C_p, C_q))', '    C_p와 C_q를 합쳐 하나의 연결요소로 대치한다.', '  else S_i = S_(i-1);', '}', 'S = S_|E|;'];
      const st = UI.Stepper({ code: CODE, title: '알고리즘 5-4 최소 신장트리 분할', render: fr => { frame = fr; drawA(); } });
      const Ga = UI.GridView({ rows: 5, cols: 5, cs: 58, fs: 14, label: '연결요소', cell: (y, x) => { const i = y * 5 + x; const comp = frame && frame.comp ? frame.comp : Array.from({ length: 25 }, (_, v) => v); const ids = [...new Set(comp)]; const c = SEG5UI.palette(ids.indexOf(comp[i]) % 12); const s = { t: F58[y][x], sub: vName(i), bg: `color-mix(in srgb, ${css(c)} 45%, var(--cell-bg))` }; if (frame && frame.e && (frame.e.p === i || frame.e.q === i)) s.cls = 'cur'; return s; } });
      function rebuildA() {
        res = SEG.felzenszwalb(25, E, k, { trace: true });
        const fr = [{ line: [1, 2], note: `가중치(=명암 차이)로 정렬한 에지 ${res.sorted.length}개: ` + res.sorted.slice(0, 12).map(e => `${vName(e.p)}–${vName(e.q)}:${e.w}`).join(', ') + ' …', comp: null }, { line: 3, comp: null, note: '처음에는 노드 25개가 각각 연결요소입니다 (intra = 0, |C| = 1).', vars: { k, '연결요소 수': 25 } }];
        res.steps.forEach((sp, i) => {
          const nC = new Set(sp.comp).size;
          if (sp.same) fr.push({ line: [5, 6, 9], e: sp.e, comp: sp.comp, vars: { i: i + 1, e: `${vName(sp.e.p)}–${vName(sp.e.q)}`, w: sp.e.w, '연결요소 수': nC }, note: `${vName(sp.e.p)}와 ${vName(sp.e.q)}는 이미 같은 연결요소 → 건너뜀` });
          else fr.push({ line: sp.ok ? [5, 6, 7, 8] : [5, 6, 7, 9], e: sp.e, comp: sp.comp, vars: { i: i + 1, e: `${vName(sp.e.p)}–${vName(sp.e.q)}`, w_pq: sp.e.w, 'intra(C_p)+k/|C_p|': `${sp.ia}+${k}/${sp.sa}=${(sp.ia + k / sp.sa).toFixed(2)}`, 'intra(C_q)+k/|C_q|': `${sp.ib}+${k}/${sp.sb}=${(sp.ib + k / sp.sb).toFixed(2)}`, mult_intra: +sp.mi.toFixed(3), '연결요소 수': nC },
            note: `w = ${sp.e.w} ${sp.ok ? '≤' : '>'} mult_intra = min(${(sp.ia + k / sp.sa).toFixed(2)}, ${(sp.ib + k / sp.sb).toFixed(2)}) = ${sp.mi.toFixed(2)} → ${sp.ok ? '<b>합침</b>' : '합치지 않음 (분할선 후보)'}` });
        });
        const nF = new Set(res.comp).size;
        fr.push({ line: 11, comp: res.comp, vars: { k, '최종 연결요소 수': nF }, note: `에지 ${res.sorted.length}개를 한 번씩 보고 끝 — 연결요소 <b>${nF}개</b>. 탐욕 알고리즘이지만 Felzenszwalb는 결과가 “거칠지도 세밀하지도 않음”(모든 이웃 쌍에서 D 참)을 증명했습니다. k를 바꿔 보세요.` });
        st.load(fr, frame ? Math.min(st.i, fr.length - 1) : 0);
      }
      function drawA() { Ga.draw(); edgeOverlay(Ga, E, { style: e => (frame && frame.e && frame.e.p === e.p && frame.e.q === e.q ? { stroke: 'var(--orange)', bold: true, text: 'var(--ink)' } : frame && frame.comp && frame.comp[e.p] === frame.comp[e.q] ? { text: 'var(--faint)' } : {}) }); }
      // (3) real image
      let pk, kr = 300, sig = 0.8, minA = 20;
      const ivA = UI.FeatView({ width: 360 }), ivB = UI.FeatView({ width: 360 }), rInfo = h('p', { class: 'caption' });
      function real() {
        const rgb = pk.rgb(), hh = rgb.length, ww = rgb[0].length, ch = [0, 1, 2].map(c => CV.gaussianBlur(rgb.map(r => r.map(p => p[c])), sig));
        const feat = rgb.map((r, y) => r.map((_, x) => [ch[0][y][x], ch[1][y][x], ch[2][y][x]]));
        const t0 = performance.now(), Eg = SEG.gridGraph(feat, 8), r = SEG.felzenszwalb(hh * ww, Eg, kr, { minArea: minA }), ms = performance.now() - t0;
        const lab = []; for (let y = 0; y < hh; y++) lab.push(r.comp.slice(y * ww, (y + 1) * ww));
        ivA.draw(rgb, 'rgb'); ivA.setCaption('원래 영상');
        ivB.draw(SEG5UI.withBorders(SEG5UI.labelRGB(lab, rgb), lab), 'rgb'); ivB.setCaption(`k = ${kr}, min_area = ${minA}`); ivB.setInfo(`${SEG5UI.nRegions(lab)}개 영역 · ${Math.round(ms)} ms`);
        rInfo.innerHTML = `컬러는 식 (5.10)처럼 (r,g,b) 벡터 사이 거리로 에지 가중치를 줍니다 (σ=${sig} 가우시안으로 먼저 스무딩, 8-이웃). k-means(5.2.2)와 달리 <b>이웃한 화소끼리만</b> 합치므로 영역이 덩어리로 나옵니다. 정렬·Union-Find 덕분에 화소 수에 거의 비례하는 시간에 끝납니다.`;
      }
      pk = UI.figPicker('sun', () => real());
      root.append(h('div', { class: 'lab' },
        h('div', { class: 'stack' },
          h('div', { class: 'card' }, h('h3', {}, '① intra(C) 직접 구해 보기', h('small', {}, '그림 5-9 · 칸을 클릭해 C에 넣고 빼기')), h('div', { class: 'row' }, Gi.el, h('div', { class: 'col', style: { flex: '1 1 260px' } }, intraBox))),
          h('div', { class: 'card' }, h('h3', {}, '② 알고리즘 5-4 따라가기', h('small', {}, '같은 5×5 영상')), h('div', { class: 'controls' }, UI.slider({ label: 'k', min: 0, max: 30, step: 1, value: k, id: 'ms-k', oninput: v => { k = v; rebuildA(); } })),
            h('div', { class: 'row', style: { marginTop: '8px' } }, Ga.el, h('p', { class: 'caption', style: { flex: '1 1 220px' } }, '색이 같은 칸이 같은 연결요소입니다. 주황 테두리 숫자가 지금 보는 에지. τ(C) = k/|C| 덕분에 작은 연결요소는 조금 큰 에지로도 합쳐지고, 커질수록 까다로워집니다.'))),
          h('div', { class: 'card' }, h('h3', {}, '③ 자연 영상', h('small', {}, '그림 5-10')), h('div', { class: 'controls' }, pk.el, UI.slider({ label: 'k', min: 20, max: 2000, step: 20, value: kr, id: 'ms-kr', oninput: v => { kr = v; real(); } }), UI.slider({ label: 'min_area', min: 0, max: 200, step: 5, value: minA, id: 'ms-ma', oninput: v => { minA = v; real(); } })),
            h('div', { class: 'row', style: { marginTop: '10px' } }, h('div', { class: 'col', style: { flex: '1 1 320px' } }, ivA.el), h('div', { class: 'col', style: { flex: '1 1 320px' } }, ivB.el)), rInfo)),
        h('div', { class: 'stack' }, st.panel)));
      drawI(); rebuildA(); real();
    },
  });

  // ================= 5.3.2 normalised cut =================
  APP.mod({
    id: 'ncut', ch: '5', num: '5.3.2', title: '정규화 절단 (ncut)', src: '5강 p.24–27 · 식 (5.11)–(5.15), 알고리즘 5-5, 그림 5-11', star: true,
    blurb: 'cut은 작은 조각을 좋아한다 → assoc로 나눈 ncut. 31가지 분할을 전부 재 보고, 고유 벡터로 근사해 찾기.',
    mount(root, m) {
      APP.scaffold(root, m, {
        lead: '연결요소 C를 C₁, C₂로 자를 때 <b>잘리는 에지의 유사도 합 cut</b>이 작을수록 좋아 보입니다(Wu). 하지만 cut은 조각이 클수록 에지가 많아 커지므로 <b>작은 조각을 떼어 내는</b> 쪽을 선호합니다. Shi는 cut을 각 조각의 연결 강도 assoc로 나눈 <b>ncut</b>을 씁니다. 최적 ncut 찾기는 NP-complete이지만, 식 (5.14)의 <b>두 번째로 작은 고유값의 고유 벡터</b>로 근사해를 얻습니다. 그림 5-11의 연결요소 C = {v₇, v₁₁, v₁₂, v₁₃, v₁₇, v₁₈}(유사도 = 9 − d)로 확인해 보세요.',
        formulas: [
          [R`$$cut(C_1,C_2)=\sum_{p\in C_1,\,q\in C_2}w_{pq}$$`, '식 (5.11)'],
          [R`$$ncut(C_1,C_2)=\frac{cut(C_1,C_2)}{assoc(C_1,C)}+\frac{cut(C_1,C_2)}{assoc(C_2,C)},\quad assoc(C_1,C)=\sum_{p\in C_1,\,q\in C}w_{pq}$$`, '식 (5.12)'],
          [R`$$(\mathbf{D}-\mathbf{W})\mathbf{y}^{\mathsf T}=\lambda\mathbf{D}\mathbf{y}^{\mathsf T}\ \Leftrightarrow\ \mathbf{A}\mathbf{z}=\lambda\mathbf{z},\ \ \mathbf{A}=\mathbf{D}^{-\frac12}(\mathbf{D}-\mathbf{W})\mathbf{D}^{-\frac12},\ \ \mathbf{y}=\mathbf{D}^{-\frac12}\mathbf{z}$$`, '식 (5.13)(5.14)'],
        ],
      });
      SEG5UI.flow(root, '5.3', { prev: '5.3.1은 에지를 하나씩 탐욕적으로 합쳤을 뿐, 분할 전체의 좋고 나쁨을 한 숫자로 재지는 않았습니다.', idea: '분할의 품질을 <b>목적 함수 ncut</b> 하나로 재고, 그 최소를 <b>고유 벡터</b>(4강의 고윳값 계산!)로 근사해 찾습니다.', next: '그래프 방법은 “어디를 자를까”를 묻습니다. 반대로 <b>각 화소가 어느 봉우리(모드)로 모이는가</b>를 묻는 방법 → 5.4 민시프트.' });
      const E = SEG.gridGraph(F58), C = [7, 11, 12, 13, 17, 18];
      const Wm = C.map(p => C.map(q => { const e = E.find(e => (e.p === p && e.q === q) || (e.p === q && e.q === p)); return e ? 9 - e.w : 0; }));
      const parts = [];
      for (let mask = 1; mask < 63; mask++) if (mask & 1) { const A = [], B = []; C.forEach((v, i) => ((mask >> i) & 1 ? A : B).push(i)); parts.push({ A, B, ...SEG.ncut(Wm, A, B) }); }
      const named = { '7,11,12': '①', '7': '②', '7,11,12,13': '교재의 14' };
      let pick = parts.find(p => p.A.map(i => C[i]).join(',') === '7,11,12'), sortBy = 'cut';
      const G = UI.GridView({ rows: 5, cols: 5, cs: 60, fs: 14, label: '그림 5-11', cell: (y, x) => { const i = y * 5 + x, k = C.indexOf(i); const s = { t: F58[y][x], sub: vName(i) }; if (k < 0) s.cls = 'dim'; else s.bg = pick.A.includes(k) ? 'color-mix(in srgb, var(--orange) 35%, var(--cell-bg))' : 'color-mix(in srgb, var(--neg) 30%, var(--cell-bg))'; return s; }, onClick: (y, x) => { const k = C.indexOf(y * 5 + x); if (k <= 0) return; const A = new Set(pick.A); A.has(k) ? A.delete(k) : A.add(k); const key = [...A].sort((a, b) => a - b).join(','); const p = parts.find(q => q.A.join(',') === key); if (p) { pick = p; draw(); } } });
      const listBox = h('div'), cmp = h('div'), eigBox = h('div'), ycv = h('canvas');
      function draw() {
        G.draw();
        const set = new Set(C);
        edgeOverlay(G, E.filter(e => set.has(e.p) && set.has(e.q)), { value: e => 9 - e.w, style: e => { const a = pick.A.includes(C.indexOf(e.p)), b = pick.A.includes(C.indexOf(e.q)); return a !== b ? { line: '--bad', w: 3, dash: true, stroke: 'var(--bad)', text: 'var(--bad)', bold: true } : { text: 'var(--ink)' }; } });
        const nm = named[pick.A.map(i => C[i]).join(',')];
        cmp.replaceChildren(h('dl', { class: 'kv' }, h('dt', {}, 'C₁'), h('dd', {}, '{' + pick.A.map(i => vName(C[i])).join(', ') + '}' + (nm ? `  (분할선 ${nm})` : '')), h('dt', {}, 'C₂'), h('dd', {}, '{' + pick.B.map(i => vName(C[i])).join(', ') + '}'), h('dt', {}, 'cut'), h('dd', {}, String(pick.cut)), h('dt', {}, 'assoc(C₁,C)'), h('dd', {}, String(pick.assocA)), h('dt', {}, 'assoc(C₂,C)'), h('dd', {}, String(pick.assocB)), h('dt', {}, 'ncut'), h('dd', {}, `${pick.cut}/${pick.assocA} + ${pick.cut}/${pick.assocB} = ${pick.ncut.toFixed(4)}`)));
        const sorted = parts.slice().sort((a, b) => a[sortBy] - b[sortBy] || a.cut - b.cut);
        listBox.replaceChildren(UI.dataTable(['순위', 'C₁ (나머지는 C₂)', 'cut', 'ncut'], sorted.slice(0, 10).map((p, i) => [i + 1, h('button', { class: 'btn', type: 'button', style: { padding: '0 6px' }, onclick: () => { pick = p; draw(); } }, '{' + p.A.map(k => C[k]).join(',') + '}' + (named[p.A.map(k => C[k]).join(',')] ? ' ' + named[p.A.map(k => C[k]).join(',')] : '')), p.cut, p.ncut.toFixed(4)]), sorted.indexOf(pick)), h('p', { class: 'caption' }, `31가지 분할 중 ${sortBy === 'cut' ? 'cut' : 'ncut'}이 작은 순서 10개. cut으로 고르면 1위가 {v₇} 하나만 떼어 내는 ②(cut 7)지만, ncut으로 고르면 직관적으로 좋은 ①(cut 12)이 1위입니다.`));
      }
      // spectral solution
      const sp = SEG.spectral(Wm);
      function drawEig() {
        const y = sp.y;
        UI.plot(ycv, { w: 360, h: 170, x: [-0.5, 5.5], y: [Math.min(...y) * 1.25, Math.max(...y) * 1.25], xticks: [0, 1, 2, 3, 4, 5], xfmt: i => vName(C[i]), series: [{ type: 'bar', data: y.map((v, i) => [i, v]), colorAt: i => (sp.best.A.includes(i) ? '--orange' : '--neg'), frac: 0.6 }], dots: [], yfmt: v => v.toFixed(2) });
        eigBox.replaceChildren(h('dl', { class: 'kv' }, h('dt', {}, 'd_ii = Σw_ij'), h('dd', {}, sp.D.join(', ')), h('dt', {}, '고유값 λ'), h('dd', {}, sp.values.map(v => v.toFixed(4)).join(', ')), h('dt', {}, 'λ₂의 고유 벡터 y'), h('dd', {}, sp.y.map(v => v.toFixed(3)).join(', ')), h('dt', {}, '나눈 결과'), h('dd', {}, `{${sp.best.A.map(i => vName(C[i])).join(', ')}} | {${sp.best.B.map(i => vName(C[i])).join(', ')}} — ncut ${sp.best.ncut.toFixed(4)}`)),
          h('p', { class: 'caption' }, `가장 작은 고유값은 항상 0(모든 성분이 같은 벡터, 자르지 않음)이라 쓸모가 없고, 두 번째로 작은 λ₂ = ${sp.values[1].toFixed(4)}의 고유 벡터가 분할을 알려 줍니다. 이론과 달리 두 값만 갖지 않으므로 임계값(여기서는 ncut이 가장 작아지는 값)으로 나눕니다. 31가지를 다 재지 않고도 ①을 찾았습니다.`));
      }
      root.append(h('div', { class: 'card' }, h('div', { class: 'controls' }, UI.segmented([['cut', 'cut 작은 순'], ['ncut', 'ncut 작은 순']], sortBy, v => { sortBy = v; draw(); }), h('span', { class: 'caption' }, '격자에서 C의 칸을 클릭하면 C₁(주황) ↔ C₂(파랑)를 바꿉니다 (v₇은 항상 C₁)')),
        h('div', { class: 'row', style: { marginTop: '10px' } }, h('div', { class: 'col' }, h('span', { class: 'caption' }, '숫자 = 유사도 9−d, 빨간 점선 = 잘리는 에지'), G.el, cmp), h('div', { class: 'col', style: { flex: '1 1 360px' } }, listBox))),
        h('div', { class: 'card', style: { marginTop: '16px' } }, h('h3', {}, '고유 벡터로 근사해 찾기', h('small', {}, '식 (5.13)(5.14) · 알고리즘 5-5')), h('div', { class: 'row' }, h('div', { class: 'col' }, h('span', { class: 'caption' }, '두 번째 고유 벡터 y의 성분 (주황 = C₁)'), ycv), h('div', { class: 'col', style: { flex: '1 1 360px' } }, eigBox)),
          h('p', { class: 'note' }, '실제 영상에서는 식 (5.15)처럼 특징값 차이와 위치 거리를 함께 쓰는 유사도로 W를 만들고, 나눈 C₁·C₂를 다시 나눌지 판단하며 재귀적으로 반복합니다(알고리즘 5-5). 노드가 수천~수만 개라 근사 고유값 알고리즘이 꼭 필요합니다.')));
      draw(); drawEig();
    },
  });

  // ================= 5.4 mean shift =================
  APP.mod({
    id: 'meanshift', ch: '5', num: '5.4', title: '민시프트', src: '5강 p.29–37 · 식 (5.16)–(5.20), 알고리즘 5-6~5-8, 그림 5-13~5-15', star: true,
    blurb: '샘플이 밀집된 쪽으로 반복 이동해 봉우리(모드)를 찾기. 1차원 → 2차원 → 영상(5차원).',
    mount(root, m) {
      APP.scaffold(root, m, {
        lead: '샘플(점)만 주어졌을 때 점 y가 어느 봉우리(<b>모드</b>)에 속하는지 묻습니다. 파젠 창으로 밀도 p(x)를 그려 볼 수는 있지만, 5차원 영상 공간에서 함수를 통째로 추정하는 것은 차원의 저주 때문에 비현실적입니다. 민시프트는 함수를 그리지 않고, 커널 안 샘플의 <b>평균 쪽으로</b> 점을 계속 옮겨(y<sub>t+1</sub> = y<sub>t</sub> + m(y<sub>t</sub>)) 봉우리에 도착합니다. 모든 샘플에서 출발해 같은 봉우리에 도착한 것끼리 한 군집입니다.',
        formulas: [
          [R`$$p(\mathbf{x})=\frac{1}{nh^d}\sum_{i=1}^{n}k\Big(\frac{\mathbf{x}-\mathbf{x}_i}{h}\Big)$$`, '식 (5.16) 파젠 창'],
          [R`$$\mathbf{y}_{t+1}=\frac{\sum_i \mathbf{x}_i\,k\big(\frac{\mathbf{x}_i-\mathbf{y}_t}{h}\big)}{\sum_i k\big(\frac{\mathbf{x}_i-\mathbf{y}_t}{h}\big)},\qquad \mathbf{m}(\mathbf{y}_t)=\mathbf{y}_{t+1}-\mathbf{y}_t$$`, '식 (5.18)(5.19)'],
          [R`$$\mathbf{x}=(\mathbf{x}^s,\mathbf{x}^r)=(y,\,x,\,L,\,u,\,v)$$`, '식 (5.20) 영상의 5차원 공간'],
        ],
      });
      SEG5UI.flow(root, '5.4', { prev: 'k-means(5.2.2)는 k를 정해야 하고, 둥근 군집만 잘 찾고, 위치를 무시했습니다.', idea: '각 점이 스스로 <b>밀도가 높은 쪽으로 언덕을 오르게</b> 합니다. 군집 수는 자동, 모양 가정 없음(비모수적), 매개변수는 커널 폭 h 하나. 영상에서는 위치와 색을 함께 쓴 5차원 (y, x, L, u, v)에서 실행합니다.', next: '모든 화소가 수렴할 때까지 창 안 탐색을 반복해 느립니다. 에지 강도를 지형으로 보고 물을 채우는, 전혀 다른 비유 → 5.5 워터셰드.' });
      // (1) 1-D: Parzen estimate and one mean-shift path (Fig 5-13, 5-14)
      const X1 = [1.0, 1.4, 1.7, 2.0, 2.1, 2.3, 2.6, 3.4, 5.6, 6.0, 6.2, 6.3, 6.5, 6.7, 7.1, 8.4];
      let h1 = 1.0, ker = 'flat', y0 = 4.2, frame = null;
      const CODE = ['y_0 = x_i;   // 초기점 설정', 't = 0;', 'while(TRUE) {', '  식 (5.19)로 y_(t+1)을 계산한다.   // 커널 안 샘플의 가중 평균', '  if(||y_(t+1) − y_t|| ≤ ε) break;   // 수렴', '  t++;', '}', 'v_i = y_(t+1);   // x_i의 수렴점'];
      const st = UI.Stepper({ code: CODE, title: '알고리즘 5-6 (한 샘플의 모드 탐색)', render: fr => { frame = fr; draw1(); } });
      const cv1 = h('canvas');
      function rebuild1() {
        const path = SEG.meanShiftPath(X1.map(v => [v]), [y0], h1, ker, 1e-4).map(p => p[0]);
        const fr = [{ line: [1, 2], t: 0, y: path[0], vars: { y_0: +path[0].toFixed(4), h: h1 }, note: `y₀ = ${path[0].toFixed(3)}에서 출발합니다. 회색 띠가 커널(폭 h = ${h1}) — 이 안의 샘플만 계산에 참여합니다.` }];
        for (let t = 0; t + 1 < path.length; t++) {
          const yt = path[t], inside = X1.filter(x => SEG.KER[ker](((x - yt) / h1) ** 2) > 0), ws = inside.map(x => SEG.KER[ker](((x - yt) / h1) ** 2));
          const done = Math.abs(path[t + 1] - yt) <= 1e-4;
          fr.push({ line: [3, 4], t, y: yt, next: path[t + 1], inside, vars: { t, y_t: +yt.toFixed(4), '커널 안 샘플 수': inside.length, y_next: +path[t + 1].toFixed(4), 'm(y_t)': +(path[t + 1] - yt).toFixed(4) }, note: `커널 안 샘플 ${inside.map((x, i) => (ker === 'flat' ? x : `${x}×${ws[i].toFixed(2)}`)).join(', ')} → 가중 평균 y<sub>t+1</sub> = <b>${path[t + 1].toFixed(4)}</b>, 민시프트 m = ${(path[t + 1] - yt).toFixed(4)}` });
          fr.push({ line: done ? 5 : [5, 6], t, y: path[t + 1], vars: { '|y_(t+1)−y_t|': +Math.abs(path[t + 1] - yt).toFixed(5), 수렴: done ? '예' : '아니오' }, note: done ? `이동량이 ε 이하 → <b>수렴</b>. 이 점은 모드 ${path[t + 1].toFixed(3)}에 속합니다.` : '아직 움직이는 중 → 반복' });
        }
        fr.push({ line: 8, y: path[path.length - 1], vars: { v_i: +path[path.length - 1].toFixed(4), '반복 횟수': path.length - 1 }, note: path.length === 1 ? `커널(폭 h = ${h1}) 안에 샘플이 하나도 없어 움직일 수 없습니다. h를 키우거나 샘플 근처를 클릭하세요 — 샘플이 희소한 고차원에서 h가 중요한 이유입니다.` : `수렴점 v = ${path[path.length - 1].toFixed(3)}. 그래프를 클릭해 다른 출발점으로 해 보세요. 두 봉우리 사이 계곡에서 출발하면 <b>샘플이 더 많은 쪽</b>으로 갑니다.` });
        st.load(fr, 0);
      }
      function draw1() {
        const xs = []; for (let x = 0; x <= 9.001; x += 0.05) xs.push(x);
        const p = xs.map(x => SEG.parzen1D(X1, x, h1, ker)), top = Math.max(...p) * 1.25;
        const P = UI.plot(cv1, { w: 560, h: 220, x: [0, 9], y: [0, top], series: [{ data: xs.map((x, i) => [x, p[i]]), color: '--neg', width: 2, fill: true }, { type: 'points', data: X1.map(x => [x, top * 0.04]), color: '--bad', r: 4 }], vlines: frame ? [{ x: frame.y, color: '--orange', label: 'y_t' }] : [], yfmt: v => v.toFixed(2) });
        const c = cv1.getContext('2d');
        if (frame) {
          c.fillStyle = 'rgba(128,128,128,.15)'; c.fillRect(P.X(frame.y - h1), P.m.t, P.X(frame.y + h1) - P.X(frame.y - h1), P.H - P.m.t - P.m.b);
          if (frame.inside) { c.fillStyle = UI.col('--orange'); for (const x of frame.inside) { c.beginPath(); c.arc(P.X(x), P.Y(top * 0.04), 5.5, 0, 7); c.fill(); } }
          if (frame.next !== undefined) { c.strokeStyle = UI.col('--ok'); c.lineWidth = 3; const yy = P.Y(top * 0.85); c.beginPath(); c.moveTo(P.X(frame.y), yy); c.lineTo(P.X(frame.next), yy); c.stroke(); c.fillStyle = UI.col('--ok'); c.fillText('m(y_t)', P.X((frame.y + frame.next) / 2) - 16, yy - 6); }
        }
      }
      cv1.addEventListener('pointerdown', e => { const r = cv1.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * 560; const v = (x - 44) / (560 - 56) * 9; if (v > 0 && v < 9) { y0 = +v.toFixed(2); rebuild1(); } });
      // (2) 2-D clustering (Algorithm 5-6, all samples)
      const rnd = UI.rng(5), X2 = [];
      const blob = (cx, cy, n, s) => { for (let i = 0; i < n; i++) { const a = rnd() * 6.283, r = Math.sqrt(-2 * Math.log(rnd() + 1e-9)) * s; X2.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } };
      blob(2.5, 2.5, 30, 0.6); blob(6.8, 3, 25, 0.7); blob(4.5, 7.2, 35, 0.8); blob(7.8, 7.5, 12, 0.5);
      let h2 = 1.4;
      const cv2 = h('canvas'), info2 = h('p', { class: 'caption' });
      function draw2() {
        const r = SEG.meanShiftCluster(X2, h2, 'flat', 1e-3);
        const P = UI.plot(cv2, { w: 420, h: 360, x: [0, 10], y: [0, 10], margin: { l: 30, b: 24 } });
        const c = cv2.getContext('2d');
        r.paths.forEach((p, i) => { c.strokeStyle = `rgba(${SEG5UI.palette(r.label[i]).join(',')},.55)`; c.lineWidth = 1; c.beginPath(); p.forEach(([a, b], k) => (k ? c.lineTo(P.X(a), P.Y(b)) : c.moveTo(P.X(a), P.Y(b)))); c.stroke(); });
        X2.forEach(([a, b], i) => { c.fillStyle = css(SEG5UI.palette(r.label[i])); c.beginPath(); c.arc(P.X(a), P.Y(b), 3.5, 0, 7); c.fill(); });
        r.modes.forEach(([a, b]) => { c.strokeStyle = UI.tok('--ink'); c.lineWidth = 2.5; c.beginPath(); c.arc(P.X(a), P.Y(b), 7, 0, 7); c.stroke(); });
        c.strokeStyle = 'rgba(128,128,128,.6)'; c.setLineDash([4, 3]); c.beginPath(); c.arc(P.X(1.2), P.Y(9), P.X(1.2 + h2) - P.X(1.2), 0, 7); c.stroke(); c.setLineDash([]); c.fillStyle = UI.tok('--muted'); c.fillText('커널 폭 h', P.X(1.2) - 22, P.Y(9) + 4);
        info2.innerHTML = `모드(굵은 원) <b>${r.modes.length}개</b>를 자동으로 찾았습니다 — k-means처럼 군집 수를 미리 정하지 않습니다. 선은 각 점이 출발해서 수렴점까지 간 길입니다. h를 줄이면 봉우리가 잘게 쪼개지고(군집 많음), 키우면 이웃 봉우리가 합쳐집니다(군집 적음). 정할 매개변수는 h 하나뿐입니다.`;
      }
      // (3) image: 5-D (y, x, L, u, v) with hs, hr
      let pk, hs = 6, hr = 8, half = true, minA = 15;
      const ivA = UI.FeatView({ width: 330 }), ivB = UI.FeatView({ width: 330 }), ivC = UI.FeatView({ width: 330 }), info3 = h('p', { class: 'caption' });
      function real() {
        let rgb = pk.rgb(); if (half) rgb = rgb.filter((_, y) => y % 2 === 0).map(r => r.filter((_, x) => x % 2 === 0));
        const t0 = performance.now(), r = SEG.meanShiftImage(rgb, hs, hr, { minArea: minA }), ms = performance.now() - t0;
        const smooth = r.modes.map(row => row.map(md => { const [L, u, v] = md.c; return luv2rgb(L, u, v); }));
        ivA.draw(rgb, 'rgb'); ivA.setCaption('원래 영상');
        ivB.draw(smooth, 'rgb'); ivB.setCaption('에지 보존 스무딩 (알고리즘 5-8)');
        ivC.draw(SEG5UI.withBorders(SEG5UI.labelRGB(r.lab, rgb), r.lab), 'rgb'); ivC.setCaption('분할 (알고리즘 5-7)'); ivC.setInfo(`${SEG5UI.nRegions(r.lab)}개 · ${Math.round(ms)} ms`);
        const avgIt = r.iters.flat().reduce((a, b) => a + b, 0) / (rgb.length * rgb[0].length);
        info3.innerHTML = `화소 ${rgb.length * rgb[0].length}개가 모두 시작점이 되어 평균 ${avgIt.toFixed(1)}번 이동했습니다. 커널: 위치 반지름 h<sub>s</sub> = ${hs}, 색(Luv) 반지름 h<sub>r</sub> = ${hr}. 가운데 영상은 각 화소를 자기 모드의 색으로 바꾼 것 — 영역 안은 평평해지고 경계(색이 h<sub>r</sub> 넘게 다른 곳)는 섞이지 않아 <b>에지가 보존</b>됩니다(연습문제 5). k-means(5.2.2)와 비교해 보세요.`;
      }
      function luv2rgb(L, u, v) {
        if (L <= 0) return [0, 0, 0];
        const up = u / (13 * L) + 0.19784, vp = v / (13 * L) + 0.46832, Y = L > 8 ? ((L + 16) / 116) ** 3 : L / 903.3, X = Y * 9 * up / (4 * vp), Z = Y * (12 - 3 * up - 20 * vp) / (4 * vp);
        const g = c => { c = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055; return Math.max(0, Math.min(255, c * 255)); };
        return [g(3.2406 * X - 1.5372 * Y - 0.4986 * Z), g(-0.9689 * X + 1.8758 * Y + 0.0415 * Z), g(0.0557 * X - 0.204 * Y + 1.057 * Z)];
      }
      pk = UI.figPicker('sun', () => real());
      let tmr = null; const later = () => { clearTimeout(tmr); tmr = setTimeout(real, 120); };
      root.append(h('div', { class: 'lab' },
        h('div', { class: 'stack' },
          h('div', { class: 'card' }, h('h3', {}, '① 1차원: 파젠 창과 모드 탐색', h('small', {}, '그림 5-13 · 5-14 · 그래프를 클릭해 출발점 바꾸기')),
            h('div', { class: 'controls' }, UI.slider({ label: '대역폭 h', min: 0.3, max: 3, step: 0.1, value: h1, id: 'mshift-h', fmt: v => v.toFixed(1), oninput: v => { h1 = v; rebuild1(); } }), UI.segmented([['flat', '평편한 커널'], ['gauss', '가우시안 커널']], ker, v => { ker = v; rebuild1(); })),
            h('div', { style: { marginTop: '8px' } }, cv1), h('p', { class: 'caption' }, '파란 곡선 = 식 (5.16)으로 추정한 p(x) (h가 크면 매끄럽고 작으면 거칢). 빨간 점 = 샘플, 주황 = 지금 커널 안의 샘플, 초록 화살표 = 민시프트 m(yₜ). 민시프트는 곡선을 그리지 않고도 봉우리로 올라갑니다.')),
          h('div', { class: 'card' }, h('h3', {}, '② 2차원: 모든 샘플에서 출발 → 군집', h('small', {}, '알고리즘 5-6')), h('div', { class: 'controls' }, UI.slider({ label: 'h', min: 0.6, max: 3, step: 0.1, value: h2, id: 'mshift-h2', fmt: v => v.toFixed(1), oninput: v => { h2 = v; draw2(); } })), h('div', { class: 'row', style: { marginTop: '8px' } }, cv2, h('div', { class: 'col', style: { flex: '1 1 220px' } }, info2))),
          h('div', { class: 'card' }, h('h3', {}, '③ 영상: 5차원 (y, x, L, u, v)', h('small', {}, '알고리즘 5-7 · 5-8 · 그림 5-15')),
            h('div', { class: 'controls' }, pk.el, UI.slider({ label: 'h_s (위치)', min: 2, max: 12, step: 1, value: hs, id: 'mshift-hs', oninput: v => { hs = v; later(); } }), UI.slider({ label: 'h_r (색)', min: 3, max: 25, step: 1, value: hr, id: 'mshift-hr', oninput: v => { hr = v; later(); } }), UI.slider({ label: 'min_area', min: 0, max: 80, step: 5, value: minA, id: 'mshift-ma', oninput: v => { minA = v; later(); } }),
              h('span', { class: 'ctl' }, (() => { const c = h('input', { type: 'checkbox', id: 'mshift-half', checked: true }); c.addEventListener('change', () => { half = c.checked; real(); }); return c; })(), h('label', { for: 'mshift-half' }, '절반 크기로 (빠르게)'))),
            h('div', { class: 'row', style: { marginTop: '10px' } }, ivA.el, ivB.el, ivC.el), info3)),
        h('div', { class: 'stack' }, st.panel)));
      rebuild1(); draw2(); real();
    },
  });
})();

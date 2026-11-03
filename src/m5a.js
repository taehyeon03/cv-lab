// Chapter 5 modules, part A: shared flow strip, 5.1 principle, 5.2 thresholding / k-means / split-merge
const SEG5UI = (() => {
  const { h } = UI;
  const STAGES = [
    ['5.1', '원리', 'seg51', '분할이란?'],
    ['5.2', '전통적 방법', 'otsu2', '단순한 규칙'],
    ['5.3', '그래프', 'graph53', '전역 최적화'],
    ['5.4', '민시프트', 'meanshift', '전역 최적화'],
    ['5.5', '워터셰드', 'watershed', '전역 최적화'],
    ['5.6', '대화식', 'snake', '사용자 개입'],
    ['5.7', '선택', 'segcmp', '비교·평가'],
  ];
  // where this page sits in the chapter, what problem of the previous step it answers, and what comes next
  function flow(root, stage, { prev, idea, next }) {
    const strip = h('div', { class: 'flow5' }, STAGES.map(([n, t, id, grp]) => h('a', { href: '#' + id, class: n === stage ? 'on' : '' }, h('small', {}, grp), h('b', {}, `${n} ${t}`))));
    const rows = [prev && ['앞 방법의 한계', prev], idea && ['이 방법의 핵심', idea], next && ['다음으로', next]].filter(Boolean);
    const card = h('div', { class: 'card flow5-why' }, strip, h('dl', {}, rows.flatMap(([k, v]) => [h('dt', {}, k), h('dd', { html: v })])));
    const after = root.querySelector('.formula-card') || root.querySelector('.lead');
    after.after(card);
  }
  // label image → RGB (region mean colour or a categorical colour)
  const PAL = [[230, 159, 0], [86, 180, 233], [0, 158, 115], [240, 228, 66], [0, 114, 178], [213, 94, 0], [204, 121, 167], [120, 120, 120], [160, 82, 45], [127, 201, 127], [190, 174, 212], [253, 192, 134]];
  const palette = i => (i < PAL.length ? PAL[i] : [(i * 97) % 256, (i * 57 + 80) % 256, (i * 151 + 40) % 256]);
  function labelRGB(lab, src) {
    const h2 = lab.length, w2 = lab[0].length;
    if (!src) { const ids = new Map(); return lab.map(r => r.map(v => { if (!ids.has(v)) ids.set(v, ids.size); return palette(ids.get(v)); })); }
    const acc = new Map();
    for (let y = 0; y < h2; y++) for (let x = 0; x < w2; x++) { const v = lab[y][x], c = Array.isArray(src[y][x]) ? src[y][x] : [src[y][x], src[y][x], src[y][x]]; const a = acc.get(v) || [0, 0, 0, 0]; a[0] += c[0]; a[1] += c[1]; a[2] += c[2]; a[3]++; acc.set(v, a); }
    return lab.map(r => r.map(v => { const a = acc.get(v); return [a[0] / a[3], a[1] / a[3], a[2] / a[3]]; }));
  }
  // thin black boundary over an RGB image wherever the label changes
  function withBorders(rgb, lab) { return rgb.map((r, y) => r.map((c, x) => ((x + 1 < r.length && lab[y][x + 1] !== lab[y][x]) || (y + 1 < rgb.length && lab[y + 1][x] !== lab[y][x]) ? [20, 20, 20] : c))); }
  const nRegions = lab => new Set(lab.flat()).size;
  return { STAGES, flow, palette, labelRGB, withBorders, nRegions };
})();

(() => {
  const { h, fmt } = UI;
  const R = String.raw;
  const css = c => `rgb(${c.map(v => Math.round(v)).join(',')})`;

  // ================= 5.1 principle =================
  APP.mod({
    id: 'seg51', ch: '5', num: '5.1', title: '영상 분할의 원리', src: '5강 p.1–6 · 식 (5.1), 그림 5-1·5-2',
    blurb: '식 (5.1)의 네 조건을 직접 칠해 보며 확인. 저분할·과분할의 딜레마와 5장 전체 흐름.',
    mount(root, m) {
      APP.scaffold(root, m, {
        lead: '영상 분할은 영상을 <b>의미 있는 영역</b>으로 나누는 일입니다. 식 (5.1)은 좋은 분할의 네 조건(겹치지 않음·전체를 덮음·영역 안은 동질·이웃 영역은 다름)을 적지만, 반드시 지켜야 하는 규칙이라기보다 <b>개념을 설명하는</b> 식입니다. 아래 격자에 영역 번호를 칠해 보면서 네 조건과 <b>저분할·과분할</b>이 어떻게 판정되는지 확인하세요.',
        formulas: [[R`$$\bigcup_{i=1}^{n} r_i = f,\quad r_i\cap r_j=\emptyset\ (i\ne j),\quad Q(r_i)=\text{참},\quad Q(r_i\cup r_j)=\text{거짓}\ (r_i,r_j\text{ 이웃})$$`, '식 (5.1)']],
      });
      SEG5UI.flow(root, '5.1', { idea: '무엇이 “좋은 분할”인지 정의하는 단계입니다. 동질성 Q(·)를 얼마나 엄격하게 보느냐에 따라 저분할과 과분할 사이에서 정답이 달라집니다.', next: '5.2의 임계화·군집화·분할합병은 이 Q(·)를 아주 단순한 규칙(명암 구간, 색 거리, 최댓값−최솟값)으로 정합니다.' });
      // 8×8 toy image: background, a bright square, a dark bar and a mid-grey patch
      const IMG = [[1, 1, 1, 1, 1, 1, 2, 2], [1, 8, 8, 8, 1, 1, 2, 2], [1, 8, 9, 8, 1, 1, 1, 1], [1, 8, 8, 8, 1, 4, 4, 1], [1, 1, 1, 1, 1, 4, 5, 1], [0, 0, 0, 0, 1, 1, 1, 1], [0, 0, 0, 0, 1, 7, 7, 7], [1, 1, 1, 1, 1, 7, 6, 7]];
      const PRE = {
        good: ['적당한 분할', [[1, 1, 1, 1, 1, 1, 1, 1], [1, 2, 2, 2, 1, 1, 1, 1], [1, 2, 2, 2, 1, 1, 1, 1], [1, 2, 2, 2, 1, 3, 3, 1], [1, 1, 1, 1, 1, 3, 3, 1], [4, 4, 4, 4, 1, 1, 1, 1], [4, 4, 4, 4, 1, 5, 5, 5], [1, 1, 1, 1, 1, 5, 5, 5]]],
        under: ['저분할 (덜 세밀)', [[1, 1, 1, 1, 1, 1, 1, 1], [1, 2, 2, 2, 1, 1, 1, 1], [1, 2, 2, 2, 1, 1, 1, 1], [1, 2, 2, 2, 1, 1, 1, 1], [1, 1, 1, 1, 1, 1, 1, 1], [1, 1, 1, 1, 1, 1, 1, 1], [1, 1, 1, 1, 1, 2, 2, 2], [1, 1, 1, 1, 1, 2, 2, 2]]],
        over: ['과분할 (너무 세밀)', [[1, 1, 1, 1, 6, 6, 6, 6], [1, 2, 2, 2, 6, 6, 6, 6], [1, 2, 7, 2, 6, 6, 6, 6], [1, 2, 2, 2, 6, 3, 3, 6], [1, 1, 1, 1, 6, 3, 3, 6], [4, 4, 4, 4, 6, 6, 6, 6], [4, 4, 4, 4, 6, 5, 5, 5], [8, 8, 8, 8, 6, 5, 5, 5]]],
      };
      let lab = PRE.good[1].map(r => r.slice()), brush = 1, T = 1;
      const g = UI.GridView({ rows: 8, cols: 8, cs: 40, fs: 12, label: '영역 번호', cell: (y, x) => { const c = SEG5UI.palette(lab[y][x] - 1); return { t: IMG[y][x], sub: lab[y][x] || '', bg: lab[y][x] ? `color-mix(in srgb, ${css(c)} 55%, var(--cell-bg))` : '', title: `명암 ${IMG[y][x]}, 영역 ${lab[y][x] || '없음'}` }; }, paint: { start: (y, x) => brush, apply: (y, x, v) => { lab[y][x] = v; check(); } } });
      const out = h('div');
      function check() {
        g.draw();
        const regions = new Map();
        lab.forEach((r, y) => r.forEach((v, x) => { if (!v) return; if (!regions.has(v)) regions.set(v, []); regions.get(v).push([y, x]); }));
        const uncovered = lab.flat().filter(v => !v).length;
        const rows = [], bad = [];
        for (const [v, px] of regions) {
          const vals = px.map(([y, x]) => IMG[y][x]), lo = Math.min(...vals), hi = Math.max(...vals);
          // connected?
          const set = new Set(px.map(([y, x]) => y * 8 + x)), seen = new Set([px[0][0] * 8 + px[0][1]]), st = [px[0]];
          while (st.length) { const [a, b] = st.pop(); for (const [dy, dx] of SEG.N4) { const k = (a + dy) * 8 + b + dx; if (a + dy >= 0 && a + dy < 8 && b + dx >= 0 && b + dx < 8 && set.has(k) && !seen.has(k)) { seen.add(k); st.push([a + dy, b + dx]); } } }
          rows.push([h('span', { style: { color: css(SEG5UI.palette(v - 1)), fontWeight: 700 } }, '■ ' + v), px.length, `${lo}~${hi}`, hi - lo <= T ? '참 ✔' : '거짓 ✘', seen.size === px.length ? '예' : '아니오 (떨어진 조각)']);
          if (hi - lo > T) bad.push(v);
        }
        // neighbouring regions that would still be homogeneous together → should have been one region
        const pairs = new Set(), merge = [];
        for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) for (const [dy, dx] of [[0, 1], [1, 0]]) { const a = lab[y][x], b = lab[y + dy] && lab[y + dy][x + dx]; if (a && b && a !== b) pairs.add(a < b ? `${a},${b}` : `${b},${a}`); }
        for (const p of pairs) { const [a, b] = p.split(',').map(Number), vals = [...regions.get(a), ...regions.get(b)].map(([y, x]) => IMG[y][x]); if (Math.max(...vals) - Math.min(...vals) <= T) merge.push(`${a}+${b}`); }
        const verdict = bad.length ? `저분할: 영역 ${bad.join(', ')}은(는) 안의 명암 차이가 T=${T}보다 커서 Q가 거짓입니다 (더 나눠야 함).` : merge.length ? `과분할: 이웃 영역 ${merge.join(', ')}은(는) 합쳐도 Q가 참입니다 (합쳐야 함).` : uncovered ? `아직 ${uncovered}칸이 어느 영역에도 속하지 않습니다 (전체를 덮지 못함).` : '네 조건을 모두 만족합니다 — 이 T에서는 “적당한” 분할입니다.';
        out.replaceChildren(UI.dataTable(['영역', '화소 수', '명암 범위', `Q(rᵢ): 범위 ≤ T`, '연결됨'], rows),
          h('dl', { class: 'kv', style: { marginTop: '8px' } }, h('dt', {}, '겹치지 않음'), h('dd', {}, '✔ (한 칸에 번호는 하나뿐)'), h('dt', {}, '전체를 덮음'), h('dd', {}, uncovered ? `✘ ${uncovered}칸 비어 있음` : '✔'), h('dt', {}, '영역 안은 동질'), h('dd', {}, bad.length ? `✘ 영역 ${bad.join(', ')}` : '✔'), h('dt', {}, '이웃은 다름'), h('dd', {}, merge.length ? `✘ ${merge.join(', ')}` : '✔')),
          h('p', { class: bad.length || merge.length || uncovered ? 'note warn' : 'note' }, verdict));
      }
      const preSeg = UI.segmented(Object.entries(PRE).map(([k, v]) => [k, v[0]]), 'good', v => { lab = PRE[v][1].map(r => r.slice()); check(); });
      const brushSel = UI.select([1, 2, 3, 4, 5, 6, 7, 8].map(v => [v, '영역 ' + v]).concat([[0, '지우개']]), 1, v => (brush = +v), 's51-b');
      root.append(h('div', { class: 'lab' },
        h('div', { class: 'stack' },
          h('div', { class: 'card' }, h('h3', {}, '네 조건을 직접 확인', h('small', {}, '칸을 드래그해 영역 번호를 칠하기 · 숫자는 명암')),
            h('div', { class: 'controls' }, preSeg, UI.labeled('붓', brushSel), UI.slider({ label: '동질 기준 T (범위 ≤ T)', min: 0, max: 9, step: 1, value: T, id: 's51-t', oninput: v => { T = v; check(); } })),
            h('div', { class: 'row', style: { marginTop: '10px' } }, g.el, h('div', { class: 'col', style: { flex: '1 1 320px' } }, out))),
          h('div', { class: 'card' }, h('h3', {}, '어디까지 세밀하게 나눠야 할까 — 딜레마'), h('p', { class: 'caption' }, 'T를 0으로 낮추면 “적당한 분할”도 저분할이 되고(영역 2의 8·9가 다름), T를 9로 올리면 거의 모든 분할이 과분할이 됩니다. 정답은 Q를 어떻게 정하느냐, 즉 응용이 무엇을 원하느냐에 달려 있습니다. 교재 그림 5-1(b)의 가격표도 엄격히 보면 저분할입니다.'))),
        h('div', { class: 'stack' },
          h('div', { class: 'card' }, h('h3', {}, '사람과 컴퓨터의 차이'), h('ul', { class: 'caption', style: { margin: 0, paddingLeft: '18px' } },
            h('li', {}, '사람: 선택적 주의 집중(관심 있는 곳만 세밀하게), 능동 비전(다가가서 다시 보기), 물체 지식으로 인식과 동시에 분할'),
            h('li', {}, '컴퓨터: 분할 단계에는 그런 지식이 없음. 분할은 인식의 전 단계 — 닭이 먼저냐 달걀이 먼저냐'),
            h('li', {}, '그림 5-2: 이웃 몇 화소만 보면 경계가 모호 → 영상 전체를 보는 전역 정보가 필요 (5.3~5.5의 출발점)'))),
          h('div', { class: 'card' }, h('h3', {}, '에지·지역 특징과의 관계'), h('ul', { class: 'caption', style: { margin: 0, paddingLeft: '18px' } },
            h('li', {}, '에지(3장)는 영역의 경계와 동전의 양면이지만 폐곡선을 이루지 못하는 경우가 많아, 에지 검출 결과를 그대로 영역으로 쓸 수 없음'),
            h('li', {}, '지역 특징(4장)은 점 하나라 혼자서는 부족. 영역은 모양·색·텍스처 기술자를 뽑아 인식에 쓸 수 있음'),
            h('li', {}, '현재 많은 응용(예: 파노라마)은 영역보다 지역 특징(SIFT)을 사용'))))));
      check();
    },
  });

  // ================= 5.2.1 double-threshold Otsu, adaptive thresholding =================
  APP.mod({
    id: 'otsu2', ch: '5', num: '5.2.1', title: '이중 임계값 오츄와 적응적 임계화', src: '5강 p.8–10 · 식 (5.2)–(5.4), 알고리즘 5-1, 그림 5-3·5-4', star: true,
    blurb: '(t₁, t₂) 모든 쌍의 부류간 분산을 계산해 최댓값으로 삼진화. 전역 임계화의 한계와 적응적 임계화.',
    mount(root, m) {
      APP.scaffold(root, m, {
        lead: '2장의 오츄 알고리즘은 임계값 하나로 영상을 둘로 나눴습니다. 밝은 달·어두운 나무·중간 밝기의 하늘처럼 물체가 셋이면 <b>임계값 두 개 (t₁, t₂)</b>로 세 구간을 만듭니다. 세 부류의 평균이 전체 평균에서 멀수록(부류간 분산이 클수록) 좋은 분할이므로, 가능한 모든 쌍을 계산해 <b>가장 큰 v_between</b>을 고릅니다. 아래의 작은 히스토그램(L=8)으로 계산을 따라가 보고, 그림 5-3의 달 영상에도 적용해 보세요.',
        formulas: [
          [R`$$v_{between}(t_1,t_2)=w_0(\mu_0-\mu_g)^2+w_1(\mu_1-\mu_g)^2+w_2(\mu_2-\mu_g)^2$$`, '식 (5.2)'],
          [R`$$w_0=\sum_{i=0}^{t_1}\hat h_i,\ \ \mu_0=\frac{1}{w_0}\sum_{i=0}^{t_1}i\hat h_i,\ \ \ldots\qquad(\hat t_1,\hat t_2)=\underset{0<t_1<t_2<L-1}{\operatorname{argmax}}\ v_{between}(t_1,t_2)$$`, '식 (5.2)(5.3)'],
          [R`$$b(j,i)=\begin{cases}1,&f(j,i)\ge t(j,i)\\0,&\text{그렇지 않으면}\end{cases}$$`, '식 (5.4) 적응적 임계화'],
        ],
      });
      SEG5UI.flow(root, '5.2', { prev: '2장의 이진화(오츄)는 물체가 둘(물체/배경)일 때만 맞습니다.', idea: '임계값을 둘로 늘려 세 부류로 나누고, 부류간 분산 v<sub>between</sub>이 최대인 (t₁, t₂)를 <b>전수 조사</b>로 찾습니다.', next: '영상 전체에 임계값 한두 개만 쓰는 전역 방법이라 지역마다 밝기가 다르면 실패합니다(그림 5-4) → 적응적 임계화, 그리고 색을 쓰는 군집화(5.2.2).' });
      const L = 8;
      let hist = [3, 6, 2, 1, 4, 7, 2, 5], frame = null;
      const CODE = ['[알고리즘 2-1]로 정규 히스토그램 ĥ을 만든다.', 'for(t1=1 to L-3)', '  for(t2=t1+1 to L-2)', '    식 (5.2)로 v_between(t1,t2)를 계산한다.', '가장 큰 v_between의 (t1,t2)를 (t̂1,t̂2)로 취한다.', '(t̂1,t̂2)로 f를 삼진화하여 g를 만든다.'];
      const st = UI.Stepper({ code: CODE, title: '알고리즘 5-1 이중 임계값 오츄', render: fr => { frame = fr; draw(); } });
      const hcv = h('canvas'), tblBox = h('div');
      let O = null;
      const heatG = UI.GridView({ rows: L, cols: L, cs: 40, fs: 10, rowLabels: Array.from({ length: L }, (_, i) => 't₁=' + i), colLabels: Array.from({ length: L }, (_, i) => 't₂=' + i), label: 'v_between 표', cell: (y, x) => { const v = O && O.table[y][x]; if (v === null || v === undefined) return { cls: 'dim' }; const s2 = { t: v.toFixed(2), ...APP.grayCell(v, O.v) }; if (frame && frame.t1 === y && frame.t2 === x) s2.cls = 'cur'; if (y === O.t1 && x === O.t2) s2.bold = true; return s2; } });
      function rebuild() {
        const N = hist.reduce((a, b) => a + b, 0), hn = hist.map(v => v / N), o = SEG.otsu2(hn); O = o; const mg = hn.reduce((s, v, i) => s + i * v, 0);
        const fr = [{ line: 1, vars: { N, μ_g: +mg.toFixed(4) }, note: `ĥ(i) = h(i)/${N}. 전체 평균 μ<sub>g</sub> = Σ i·ĥ(i) = <b>${mg.toFixed(4)}</b>` }];
        let best = -1;
        for (let t1 = 1; t1 <= L - 3; t1++) for (let t2 = t1 + 1; t2 <= L - 2; t2++) {
          const r = SEG.vBetween(hn, t1, t2), isBest = r.v > best; if (isBest) best = r.v;
          fr.push({ line: [2, 3, 4], t1, t2, r, best, vars: { t1, t2, w0: +r.cls[0].w.toFixed(3), μ0: +r.cls[0].mu.toFixed(3), w1: +r.cls[1].w.toFixed(3), μ1: +r.cls[1].mu.toFixed(3), w2: +r.cls[2].w.toFixed(3), μ2: +r.cls[2].mu.toFixed(3), v_between: +r.v.toFixed(4), '지금까지 최대': +best.toFixed(4) },
            note: `구간 [0..${t1}] [${t1 + 1}..${t2}] [${t2 + 1}..7]: ` + r.cls.map((c, i) => `${c.w.toFixed(3)}×(${c.mu.toFixed(2)}−${mg.toFixed(2)})²`).join(' + ') + ` = <b>${r.v.toFixed(4)}</b>` + (isBest ? ' ← 새 최대' : '') });
        }
        fr.push({ line: [5, 6], t1: o.t1, t2: o.t2, r: SEG.vBetween(hn, o.t1, o.t2), best: o.v, final: true, vars: { 't̂1': o.t1, 't̂2': o.t2, v_between: +o.v.toFixed(4) }, note: `${(L - 3) * (L - 2) / 2}개 쌍을 모두 조사한 결과 <b>(t̂₁, t̂₂) = (${o.t1}, ${o.t2})</b>. 명암 ≤${o.t1} → 0, ${o.t1 + 1}~${o.t2} → 1, ≥${o.t2 + 1} → 2로 삼진화합니다.` });
        st.load(fr, frame ? Math.min(st.i, fr.length - 1) : 0);
      }
      function draw() {
        const N = hist.reduce((a, b) => a + b, 0);
        const colorOf = i => (!frame || frame.t1 === undefined ? '--faint' : i <= frame.t1 ? '--neg' : i <= frame.t2 ? '--ok' : '--orange');
        UI.plot(hcv, { w: 420, h: 190, x: [-0.6, L - 0.4], y: [0, Math.max(...hist) / N * 1.15], xticks: [0, 1, 2, 3, 4, 5, 6, 7], series: [{ type: 'bar', data: hist.map((v, i) => [i, v / N]), colorAt: i => colorOf(i), frac: 0.7 }], vlines: frame && frame.t1 !== undefined ? [{ x: frame.t1 + 0.5, label: 't₁', color: '--ink' }, { x: frame.t2 + 0.5, label: 't₂', color: '--ink' }] : [], yfmt: v => v.toFixed(2) });
        if (frame && frame.r) tblBox.replaceChildren(UI.dataTable(['부류', '구간', 'w', 'μ', 'w(μ−μ_g)²'], frame.r.cls.map((c, i) => [['0 (어두움)', '1 (중간)', '2 (밝음)'][i], i === 0 ? `0~${frame.t1}` : i === 1 ? `${frame.t1 + 1}~${frame.t2}` : `${frame.t2 + 1}~7`, c.w.toFixed(4), c.mu.toFixed(4), (c.w * (c.mu - frame.r.mg) ** 2).toFixed(4)])));
        else tblBox.replaceChildren();
        heatG.draw();
      }
      const histIn = h('input', { type: 'text', value: hist.join(' '), size: 22, 'aria-label': '히스토그램 h(0..7)' });
      histIn.addEventListener('change', () => { const v = histIn.value.trim().split(/[\s,]+/).map(Number).filter(x => x >= 0); if (v.length === L) { hist = v; rebuild(); } });
      // real images
      let pk, mode = 'otsu2', nwin = 15, Cc = 8;
      const ivA = UI.FeatView({ width: 360 }), ivB = UI.FeatView({ width: 360 }), realInfo = h('p', { class: 'caption' }), rcv = h('canvas');
      function real() {
        const g = pk.gray(), hst = SEG.histogram(g, 256), N = g.length * g[0].length, hn = hst.map(v => v / N);
        ivA.draw(g, 'gray'); ivA.setCaption('원래 영상');
        let out, msg;
        if (mode === 'otsu2') {
          // the 256-level search is O(L²); run it on a 64-bin histogram and map back
          const h64 = new Array(64).fill(0); hn.forEach((v, i) => (h64[i >> 2] += v));
          const o = SEG.otsu2(h64), t1 = o.t1 * 4 + 3, t2 = o.t2 * 4 + 3;
          out = SEG.ternarize(g, t1, t2).map(r => r.map(v => v * 127.5)); msg = `알고리즘 5-1: (t̂₁, t̂₂) ≈ (${t1}, ${t2}) — 64단계 히스토그램에서 전수 조사 후 0~255로 환산 (교재 그림 5-3은 t₁=46, t₂=159).`;
          UI.plot(rcv, { w: 360, h: 140, x: [0, 255], y: [0, Math.max(...hn) * 1.1], series: [{ data: hn.map((v, i) => [i, v]), color: '--ink', width: 1.5 }], vlines: [{ x: t1, label: 't₁', color: '--neg' }, { x: t2, label: 't₂', color: '--orange' }], yfmt: v => v.toFixed(3) });
        } else if (mode === 'otsu1') {
          const tt = CV.otsu(hst).T;
          out = g.map(r => r.map(v => (v > tt ? 255 : 0))); msg = `2장 오츄(임계값 하나): t = ${tt}`;
          UI.plot(rcv, { w: 360, h: 140, x: [0, 255], y: [0, Math.max(...hn) * 1.1], series: [{ data: hn.map((v, i) => [i, v]), color: '--ink', width: 1.5 }], vlines: [{ x: tt, label: 't', color: '--orange' }], yfmt: v => v.toFixed(3) });
        } else {
          const a = SEG.adaptive(g, nwin, Cc); out = a.b.map(r => r.map(v => v * 255)); msg = `식 (5.4): t(j,i) = (${nwin}×${nwin} 이웃 평균) − ${Cc}. 화소마다 임계값이 다릅니다.`;
          UI.plot(rcv, { w: 360, h: 140, x: [0, 255], y: [0, Math.max(...hn) * 1.1], series: [{ data: hn.map((v, i) => [i, v]), color: '--ink', width: 1.5 }], yfmt: v => v.toFixed(3) });
        }
        ivB.draw(out, 'gray'); ivB.setCaption(mode === 'adaptive' ? '적응적 임계화 결과' : mode === 'otsu2' ? '삼진 영상 (0·1·2 → 검정·회색·흰색)' : '이진 영상');
        realInfo.textContent = msg;
      }
      pk = UI.figPicker('moon', () => real());
      const modeSeg = UI.segmented([['otsu1', '오츄 (2장, t 하나)'], ['otsu2', '이중 임계값 (알고리즘 5-1)'], ['adaptive', '적응적 (식 5.4)']], mode, v => { mode = v; adCtl.hidden = v !== 'adaptive'; real(); });
      const adCtl = h('span', { class: 'controls', hidden: true }, UI.slider({ label: '이웃 n×n', min: 3, max: 41, step: 2, value: nwin, id: 'o2-n', oninput: v => { nwin = v; real(); } }), UI.slider({ label: 'C', min: -10, max: 30, step: 1, value: Cc, id: 'o2-c', oninput: v => { Cc = v; real(); } }));
      root.append(h('div', { class: 'lab' },
        h('div', { class: 'stack' },
          h('div', { class: 'card' }, h('h3', {}, '작은 예: L = 8 히스토그램', h('small', {}, '숫자를 바꾸고 Enter')), h('div', { class: 'controls' }, UI.labeled('h(0..7)', histIn)),
            h('div', { class: 'row', style: { marginTop: '10px' } }, h('div', { class: 'col', style: { flex: '1 1 380px' } }, hcv, h('span', { class: 'caption' }, '파랑: 부류 0 · 초록: 부류 1 · 주황: 부류 2'), tblBox), h('div', { class: 'col' }, h('span', { class: 'caption' }, '모든 (t₁, t₂)의 v_between — 진할수록 큼, 굵게: 최대, 주황 테두리: 지금 계산 중'), heatG.el))),
          h('div', { class: 'card' }, h('h3', {}, '실제 영상', h('small', {}, '그림 5-3 · 5-4')), h('div', { class: 'controls' }, pk.el, modeSeg, adCtl),
            h('div', { class: 'row', style: { marginTop: '10px' } }, h('div', { class: 'col', style: { flex: '1 1 300px' } }, ivA.el), h('div', { class: 'col', style: { flex: '1 1 300px' } }, ivB.el), h('div', { class: 'col', style: { flex: '1 1 300px' } }, rcv, realInfo)),
            h('p', { class: 'caption' }, '“그림 5-4 효모”를 골라 세 방법을 비교해 보세요. 효모 내부는 지역마다 밝기가 달라 전역 임계값(오츄·이중 임계값)으로는 만족스럽지 않고, 적응적 임계화는 이웃을 보고 임계값을 정해 경계를 더 잘 살립니다. 다만 t(j,i)를 정하는 “강력한 한 가지 방법”은 없습니다.'))),
        h('div', { class: 'stack' }, st.panel)));
      rebuild(); real();
    },
  });

  // ================= 5.2.2 k-means =================
  APP.mod({
    id: 'kmeans', ch: '5', num: '5.2.2', title: 'k-means 군집화', src: '5강 p.11–13 · 알고리즘 5-2, 그림 5-5·5-6', star: true,
    blurb: '화소를 색 공간의 점으로 보고 “가장 가까운 중심에 배정 → 평균으로 중심 갱신”을 반복.',
    mount(root, m) {
      APP.scaffold(root, m, {
        lead: '컬러 화소를 RGB 공간의 점으로 옮기면 색이 비슷한 화소끼리 가까이 모입니다(그림 5-5). <b>k-means</b>는 ① 모든 점을 가장 가까운 중심에 배정하고 ② 각 중심을 배정된 점들의 평균으로 옮기기를, 배정이 바뀌지 않을 때까지 반복합니다. 아래의 12개 화소로 계산을 따라간 뒤 해바라기 영상에 적용해 보세요.',
        formulas: [[R`$$\text{배정: } c(\mathbf{x}_i)=\underset{j}{\operatorname{argmin}}\ \|\mathbf{x}_i-\mathbf{z}_j\|^2,\qquad \text{갱신: } \mathbf{z}_j=\frac{1}{|X_j|}\sum_{\mathbf{x}\in X_j}\mathbf{x}$$`, '알고리즘 5-2 (6·8행)']],
      });
      SEG5UI.flow(root, '5.2', { prev: '명암 임계화는 명암 하나만 보고, 구간도 직접 나눠야 했습니다.', idea: '컬러 (r, g, b)를 3차원 점으로 보고 <b>가까운 점끼리 묶습니다</b>. 군집 수 k는 사람이 정합니다.', next: '색만 보고 화소의 <b>위치(지리적 근접성)는 무시</b>하므로 결과가 자글자글합니다(그림 5-6) → 위치까지 쓰는 그래프 방법(5.3)과 민시프트(5.4).' });
      // twelve colour pixels (r, g, b) in a 3×4 image
      const PIX = [[[220, 40, 30], [210, 60, 40], [40, 200, 60], [60, 190, 50]], [[230, 70, 50], [50, 60, 200], [40, 180, 70], [30, 40, 210]], [[200, 50, 60], [60, 70, 190], [45, 50, 220], [70, 210, 80]]];
      // default centres: one red, one green, one blue pixel (x1, x3, x6) so the first run already gives a sensible split
      let k = 3, init = [0, 2, 5], frame = null;
      const X = PIX.flat();
      const CODE = ['화소를 x_i=(r,g,b)로 변환하여 X={x_1,…,x_n}을 구성한다.', 'k개의 군집 중심 Z={z_1,…,z_k}를 초기화한다.', 'while(TRUE) {', '  for(i=1 to n) x_i를 가장 가까운 군집 중심에 배정한다.', '  if(첫 배정이 아니고 이전 배정과 같음) break;', '  for(j=1 to k) z_j에 배정된 샘플의 평균으로 z_j를 대치한다.', '}', 'for(j=1 to k) z_j에 배정된 화소를 j로 번호를 매긴다.'];
      const st = UI.Stepper({ code: CODE, title: '알고리즘 5-2 k-means', render: fr => { frame = fr; draw(); } });
      const gP = UI.GridView({ rows: 3, cols: 4, cs: 56, fs: 10, label: '입력 화소', cell: (y, x) => { const i = y * 4 + x, c = X[i], a = frame && frame.assign; return { bg: css(c), color: '#fff', t: `x${i + 1}`, badge: a && a[i] !== null && a[i] !== undefined ? 'z' + (a[i] + 1) : init.includes(i) ? '★' : undefined, badgeColor: '#fff', cls: frame && frame.cur === i ? 'cur' : '' }; }, onClick: (y, x) => { const i = y * 4 + x; init = init.includes(i) ? init : [...init.slice(1), i]; rebuild('end'); } });
      const initBox = h('p', { class: 'caption' });
      const scat = h('canvas'), distBox = h('div'), gOut = UI.GridView({ rows: 3, cols: 4, cs: 40, fs: 12, label: '분할 결과', cell: (y, x) => { const a = frame && frame.final ? frame.assign : null; if (!a) return {}; const z = frame.Z[a[y * 4 + x]]; return { bg: css(z), color: '#fff', t: a[y * 4 + x] + 1 }; } });
      // at: 0 = start of the trace (first load), 'end' = jump to the finished result so a control change is visible at once
      function rebuild(at = 'end') {
        init = init.slice(-k); while (init.length < k) init.push([...Array(12).keys()].find(i => !init.includes(i)));
        const km = SEG.kmeans(X, k, init), fr = [{ line: 1, Z: null, note: '12개 화소를 RGB 공간의 점 x₁~x₁₂로 옮깁니다. 오른쪽 위 그림은 (R, B) 평면에 투영한 모습입니다.' }];
        fr.push({ line: 2, Z: km.trace[0].Z, note: `초기 중심: ${init.map(i => 'x' + (i + 1)).join(', ')} (영상에서 화소를 클릭하면 바꿀 수 있음). 초기화가 결과에 영향을 줍니다.`, vars: Object.fromEntries(km.trace[0].Z.map((z, j) => ['z' + (j + 1), `(${z.map(v => Math.round(v)).join(',')})`])) });
        let round = 0;
        for (let t = 1; t < km.trace.length; t++) {
          const tr = km.trace[t];
          if (!tr.update) {
            round++;
            X.forEach((x, i) => { const ds = tr.Z.map(z => Math.sqrt(x.reduce((s, v, d) => s + (v - z[d]) ** 2, 0))); fr.push({ line: 4, Z: tr.Z, assign: tr.assign.map((a, j) => (j <= i ? a : null)).map(a => a), cur: i, ds, partial: i, note: `${round}회차 배정: x${i + 1} = (${x.join(',')})와 중심까지 거리 ` + ds.map((d, j) => `z${j + 1}: ${d.toFixed(1)}`).join(', ') + ` → <b>z${tr.assign[i] + 1}</b>`, vars: { i: i + 1, 배정: 'z' + (tr.assign[i] + 1) } }); });
            fr.push({ line: 5, Z: tr.Z, assign: tr.assign, note: tr.converged ? '<b>배정이 이전 회차와 똑같습니다 → 수렴, 반복 종료.</b> (어떤 초기 중심에서도 반드시 종료된다는 것이 증명되어 있습니다)' : round === 1 ? '첫 배정이므로 계속합니다.' : '이전 배정과 다른 화소가 있어 계속합니다.', vars: { 회차: round, 수렴: tr.converged ? '예' : '아니오' } });
            if (tr.converged) break;
          } else fr.push({ line: 6, Z: tr.Z, assign: tr.assign, upd: true, note: '각 중심을 배정된 화소들의 평균으로 옮깁니다: ' + tr.Z.map((z, j) => `z${j + 1} = (${z.map(v => v.toFixed(1)).join(', ')})`).join(', '), vars: Object.fromEntries(tr.Z.map((z, j) => ['z' + (j + 1), `(${z.map(v => Math.round(v)).join(',')})`])) });
        }
        fr.push({ line: 8, Z: km.Z, assign: km.assign, final: true, note: `군집 번호를 화소에 매기면 분할 결과입니다. 아래 결과 격자는 각 군집의 중심 색으로 칠했습니다.`, vars: { k } });
        st.load(fr, at);
        const rounds = km.trace.filter(t => t.assign && !t.update).length, groups = km.Z.map((_, j) => X.map((_, i) => i).filter(i => km.assign[i] === j).map(i => 'x' + (i + 1)));
        initBox.innerHTML = `초기 중심 <b>${init.map(i => 'x' + (i + 1)).join(', ')}</b> (★) → ${rounds}회 배정 후 수렴: ` + groups.map((g, j) => `z${j + 1} = {${g.join(', ')}}`).join(', ') + `. ◀ 버튼으로 처음부터 한 단계씩 되짚어 볼 수 있습니다. 빨강 둘을 초기 중심으로 고르면(x1, x2 클릭) 빨강이 둘로 갈리고 초록·파랑이 합쳐지는 것 — 초기화가 결과를 바꾸는 예입니다.`;
      }
      function draw() {
        gP.draw(); gOut.draw();
        const P = UI.plot(scat, { w: 320, h: 260, x: [0, 255], y: [0, 255], xticks: [0, 64, 128, 192, 255], yticks: [0, 64, 128, 192, 255], margin: { l: 36, b: 28 } });
        const c = scat.getContext('2d');
        c.fillStyle = UI.tok('--muted'); c.font = '11px sans-serif'; c.fillText('R →', P.X(225), P.Y(8)); c.fillText('B ↑', P.X(4), P.Y(245));
        X.forEach((x, i) => { c.fillStyle = css(x); c.beginPath(); c.arc(P.X(x[0]), P.Y(x[2]), frame && frame.cur === i ? 7 : 5, 0, 7); c.fill(); if (frame && frame.assign && frame.assign[i] !== null && frame.Z) { const z = frame.Z[frame.assign[i]]; c.strokeStyle = 'rgba(128,128,128,.5)'; c.lineWidth = 1; c.beginPath(); c.moveTo(P.X(x[0]), P.Y(x[2])); c.lineTo(P.X(z[0]), P.Y(z[2])); c.stroke(); } });
        if (frame && frame.Z) frame.Z.forEach((z, j) => { c.strokeStyle = UI.tok('--ink'); c.lineWidth = 2.5; const X0 = P.X(z[0]), Y0 = P.Y(z[2]); c.beginPath(); c.moveTo(X0 - 7, Y0 - 7); c.lineTo(X0 + 7, Y0 + 7); c.moveTo(X0 + 7, Y0 - 7); c.lineTo(X0 - 7, Y0 + 7); c.stroke(); c.fillStyle = UI.tok('--ink'); c.fillText('z' + (j + 1), X0 + 8, Y0 - 6); });
        distBox.replaceChildren(frame && frame.ds ? UI.dataTable(['중심', '거리'], frame.ds.map((d, j) => [h('b', {}, 'z' + (j + 1)), d.toFixed(2)])) : h('span'));
      }
      // real image
      let kk = 6, useXY = false, wxy = 1.5, seed = 1, pk;
      const ivA = UI.FeatView({ width: 380 }), ivB = UI.FeatView({ width: 380 }), info = h('p', { class: 'caption' });
      function real() {
        const rgb = pk.rgb(), hh = rgb.length, ww = rgb[0].length, Xs = [];
        rgb.forEach((r, y) => r.forEach((c, x) => Xs.push(useXY ? [...c, y * wxy * 255 / hh, x * wxy * 255 / ww] : c.slice())));
        const r = UI.rng(seed), init2 = []; while (init2.length < kk) { const i = Math.floor(r() * Xs.length); if (!init2.includes(i)) init2.push(i); }
        const t0 = performance.now(), km = SEG.kmeans(Xs, kk, init2, 30), ms = performance.now() - t0;
        const lab = []; for (let y = 0; y < hh; y++) lab.push(km.assign.slice(y * ww, (y + 1) * ww));
        ivA.draw(rgb, 'rgb'); ivA.setCaption('원래 영상');
        ivB.draw(SEG5UI.labelRGB(lab), 'rgb'); ivB.setCaption(`k = ${kk}${useXY ? ' · (r,g,b,y,x) 5차원' : ' · (r,g,b)'}`); ivB.setInfo(`${Math.round(ms)} ms · ${km.trace.filter(t => !t.update).length}회 배정`);
        info.innerHTML = useXY ? '위치 (y, x)를 특징에 넣으면 멀리 떨어진 같은 색 화소가 다른 군집이 되어 덩어리가 생기지만, 이번엔 영역이 격자처럼 잘립니다 — 색과 위치를 <b>함께, 적절한 척도로</b> 쓰는 방법이 5.4 민시프트(5차원 (y, x, L, u, v))입니다.' : '그림 5-6처럼 같은 색이면 멀리 떨어져 있어도 같은 군집이 되고, 해바라기 밭이 노랑·빨강·초록 점으로 흩어집니다. 군집화가 <b>화소 사이의 지리적 근접성을 무시</b>하기 때문입니다.';
      }
      pk = UI.figPicker('sun', () => real());
      root.append(h('div', { class: 'lab' },
        h('div', { class: 'stack' },
          h('div', { class: 'card' }, h('h3', {}, '12개 화소로 따라가기'), h('div', { class: 'controls' }, UI.slider({ label: 'k', min: 2, max: 4, step: 1, value: k, id: 'km-k', oninput: v => { k = v; rebuild(); } }), h('button', { class: 'btn', type: 'button', onclick: () => { const r = Math.random; init = []; while (init.length < k) { const i = Math.floor(r() * 12); if (!init.includes(i)) init.push(i); } rebuild(); } }, '초기 중심 무작위'), h('button', { class: 'btn', type: 'button', onclick: () => { init = [0, 2, 5, 3].slice(0, k); rebuild(); } }, '기본 초기 중심으로')), initBox,
            h('div', { class: 'row', style: { marginTop: '10px' } }, h('div', { class: 'col' }, h('span', { class: 'caption' }, '입력 3×4 (배지 = 배정된 중심, 클릭 = 초기 중심으로)'), gP.el, h('span', { class: 'caption' }, '분할 결과 (중심 색)'), gOut.el), h('div', { class: 'col' }, h('span', { class: 'caption' }, 'RGB 공간을 (R, B)로 투영 · × = 중심'), scat), h('div', { class: 'col' }, distBox))),
          h('div', { class: 'card' }, h('h3', {}, '해바라기 영상에 적용', h('small', {}, '그림 5-5 · 5-6')),
            h('div', { class: 'controls' }, pk.el, UI.slider({ label: 'k', min: 2, max: 10, step: 1, value: kk, id: 'km-kk', oninput: v => { kk = v; real(); } }), h('button', { class: 'btn', type: 'button', onclick: () => { seed++; real(); } }, '초기 중심 다시 뽑기'),
              h('span', { class: 'ctl' }, (() => { const c = h('input', { type: 'checkbox', id: 'km-xy' }); c.addEventListener('change', () => { useXY = c.checked; real(); }); return c; })(), h('label', { for: 'km-xy' }, '위치 (y, x)도 특징에 넣기'))),
            h('div', { class: 'row', style: { marginTop: '10px' } }, h('div', { class: 'col', style: { flex: '1 1 340px' } }, ivA.el), h('div', { class: 'col', style: { flex: '1 1 340px' } }, ivB.el)), info)),
        h('div', { class: 'stack' }, st.panel)));
      rebuild(0); real();
    },
  });

  // ================= 5.2.3 split and merge =================
  const FIG57 = (() => { const b = Array.from({ length: 8 }, () => new Array(8).fill(0)); b[1][1] = 1; b[2][3] = b[3][3] = 1; for (let y = 4; y < 8; y++) for (let x = 4; x < 8; x++) b[y][x] = 1; b[4][2] = b[4][3] = b[5][2] = b[5][3] = 1; return b; })();
  APP.mod({
    id: 'splitmerge', ch: '5', num: '5.2.3', title: '분할합병과 4진 트리', src: '5강 p.14–15 · 알고리즘 5-3, 그림 5-7', star: true,
    blurb: 'Q(r)가 거짓이면 넷으로 나누고(4진 트리), 이웃한 두 영역을 합쳐도 Q가 참이면 합병.',
    mount(root, m) {
      APP.scaffold(root, m, {
        lead: '영역 r이 균일하지 않으면(Q(r) 거짓) <b>네 개로 나누기</b>를 반복하고, 그 결과를 <b>4진 트리</b>로 표현합니다. 그러면 원래 한 물체인 곳도 블록 경계에서 잘려 과분할되므로, 이웃한 두 영역을 합쳐도 Q가 참이면 <b>합병</b>합니다. 그림 5-7의 8×8 이진 영상으로 따라가 보세요. 자식 순서는 교재처럼 1 = 오른쪽 위, 2 = 오른쪽 아래, 3 = 왼쪽 아래, 4 = 왼쪽 위입니다.',
        formulas: [[R`$$Q(r)=\begin{cases}\text{참},&\max_{r}f-\min_{r}f\le T\\\text{거짓},&\text{그렇지 않으면}\end{cases}$$`, '이 실습의 조건 함수 (이진 영상이면 T=0: “모두 같은 값”)']],
      });
      SEG5UI.flow(root, '5.2', { prev: '임계화·군집화는 화소를 하나씩 따로 판정했습니다.', idea: '<b>영역 단위</b>로 “균일한가?”를 묻고, 아니면 나누고(분할) 비슷하면 합칩니다(합병).', next: '이진 영상은 Q가 명확하지만, 명암·컬러 자연 영상에서 늘 맞는 규칙 Q(·) 하나를 만들 수는 없습니다 → 5.3부터는 규칙 대신 <b>전역 최적화</b>.' });
      let f = FIG57.map(r => r.slice()), T = 0, s = 1, frame = null, res = null;
      const CODE = ['split(f);   // 분할', 'while(TRUE) {   // 합병', '  for(모든 이웃한 영역 쌍 r_i와 r_j에 대해)', '    if(Q(r_i ∪ r_j)) r_i와 r_j를 합병하라.', '  3~4행에서 변화가 없으면 break;', '}', '', 'function split(r) {', '  if((not Q(r)) and (r의 넓이 > s)) {', '    r을 네 개의 4분 영상 r_i, 1≤i≤4로 나눈다.', '    for(i=1 to 4) split(r_i);', '  }', '}'];
      const st = UI.Stepper({ code: CODE, title: '알고리즘 5-3 분할합병', render: fr => { frame = fr; draw(); } });
      const g = UI.GridView({ rows: 8, cols: 8, cs: 36, fs: 12, label: '입력', cell: (y, x) => {
        const s2 = { t: f[y][x], cls: f[y][x] ? 'on' : '' };
        if (frame && frame.node) { const n = frame.node; if (y >= n.y && y < n.y + n.hh && x >= n.x && x < n.x + n.ww) s2.cls += frame.q ? ' win2' : ' win'; }
        if (frame && frame.region) { const c = SEG5UI.palette(frame.region[y][x] % 12); s2.bg = `color-mix(in srgb, ${css(c)} ${f[y][x] ? 75 : 45}%, var(--cell-bg))`; s2.color = '#111'; }
        return s2;
      }, onClick: (y, x) => { f[y][x] ^= 1; rebuild(); } });
      const treeBox = h('div', { style: { overflowX: 'auto' } });
      function rebuild() {
        res = SEG.splitMerge(f, T, s);
        const fr = [], done = new Set();
        for (const sp of res.steps) {
          const n = sp.node, name = n.path ? '블록 ' + n.path.split('').join('-') : '전체 영상';
          if (sp.kind === 'test') fr.push({ line: [8, 9], node: n, q: sp.q, done: new Set(done), vars: { r: name, 크기: `${n.hh}×${n.ww}`, 'Q(r)': sp.q ? '참' : '거짓' }, note: `${name} (${n.hh}×${n.ww}): ${sp.q ? '모든 화소가 같은 값(Q 참) → 더 나누지 않음' : n.hh * n.ww > s && n.hh > 1 ? 'Q 거짓이고 넓이 > s → 넷으로 나눔' : 'Q 거짓이지만 더 나눌 수 없음'}` });
          else { done.add(n.id); fr.push({ line: n.q ? 9 : [10, 11], node: n, q: true, leaf: true, done: new Set(done), vars: { r: name, '단말 노드': n.mean >= 0.5 ? '흑' : '백' }, note: `${name}은(는) 단말 노드 — 트리에 ${n.mean >= 0.5 ? '흑(●)' : '백(○)'}으로 기록합니다.` }); }
        }
        fr.push({ line: 1, done: new Set(done), leafView: true, note: `분할 끝: 단말 노드 <b>${res.leaves.length}개</b> (교재 그림 5-7과 같은 트리). 같은 물체(예: 오른쪽 아래 흑 블록과 왼쪽 아래의 흑 2×2)가 서로 다른 노드로 잘려 있어 과분할입니다.` });
        const lab = res.leafLab.map(r => r.slice()), par = lab.flat().map((_, i) => i);
        res.merges.forEach(([a, b], k) => fr.push({ line: [3, 4], done: new Set(done), merged: k + 1, note: `이웃한 영역 ${res.leaves[a].path.split('').join('-')} 와 ${res.leaves[b].path.split('').join('-')}: 합쳐도 모두 같은 값 → Q(rᵢ∪rⱼ) 참 → 합병 (${k + 1}번째)` }));
        fr.push({ line: 5, region: res.region, done: new Set(done), note: `더 이상 합칠 쌍이 없어 끝. 단말 노드 ${res.leaves.length}개 → 최종 영역 <b>${SEG5UI.nRegions(res.region)}개</b>.`, vars: { '합병 횟수': res.merges.length, '최종 영역 수': SEG5UI.nRegions(res.region) } });
        st.load(fr, frame ? Math.min(st.i, fr.length - 1) : 0);
      }
      function drawTree() {
        // simple layered SVG: leaves spaced evenly
        const leaves = res.leaves, W = Math.max(420, leaves.length * 26), D = Math.max(...leaves.map(l => l.depth)), Hh = 40 + D * 60;
        const pos = new Map(); let k = 0;
        const place = n => { if (!n.children.length) { pos.set(n.id, [16 + k++ * ((W - 32) / Math.max(1, leaves.length - 1)), 20 + n.depth * 60]); return; } n.children.forEach(place); const xs = n.children.map(c => pos.get(c.id)[0]); pos.set(n.id, [(Math.min(...xs) + Math.max(...xs)) / 2, 20 + n.depth * 60]); };
        place(res.root);
        let svg = `<svg width="${W}" height="${Hh}" viewBox="0 0 ${W} ${Hh}" role="img" aria-label="4진 트리">`;
        const walk = n => { const [x, y] = pos.get(n.id); n.children.forEach((c, i) => { const [cx, cy] = pos.get(c.id); svg += `<line x1="${x}" y1="${y}" x2="${cx}" y2="${cy}" stroke="var(--rule)" stroke-width="1.5"/><text x="${(x + cx) / 2 + (i - 1.5) * 2}" y="${(y + cy) / 2 - 3}" font-size="10" fill="var(--muted)">${i + 1}</text>`; walk(c); }); };
        walk(res.root);
        const draw1 = n => { const [x, y] = pos.get(n.id), vis = frame && frame.done && (frame.done.has(n.id) || n.children.length); const leaf = !n.children.length; const cur = frame && frame.node && frame.node.id === n.id; const fill = !vis && leaf ? 'var(--surface-2)' : leaf ? (n.mean >= 0.5 ? 'var(--cell-on)' : 'var(--cell-bg)') : 'var(--faint)'; svg += `<circle cx="${x}" cy="${y}" r="${cur ? 10 : 8}" fill="${fill}" stroke="${cur ? 'var(--orange)' : 'var(--ink)'}" stroke-width="${cur ? 3 : 1.2}"/>`; n.children.forEach(draw1); };
        draw1(res.root);
        treeBox.innerHTML = svg + '</svg>';
      }
      function draw() { g.draw(); drawTree(); }
      // grey image version
      let pk, Tg = 40, sg = 4;
      const ivA = UI.FeatView({ width: 340 }), ivB = UI.FeatView({ width: 340 }), ivC = UI.FeatView({ width: 340 }), gInfo = h('p', { class: 'caption' });
      function real() {
        const g0 = pk.gray(), n = 128, sm = g0.slice(0, Math.min(n, g0.length)).map(r => r.slice(0, Math.min(n, r.length)));
        const r = SEG.splitMerge(sm, Tg, sg * sg);
        const leafRGB = SEG5UI.withBorders(SEG5UI.labelRGB(r.leafLab, sm), r.leafLab);
        ivA.draw(sm, 'gray'); ivA.setCaption('입력 (왼쪽 위 128×128)');
        ivB.draw(leafRGB, 'rgb'); ivB.setCaption('분할 직후 (블록 평균)'); ivB.setInfo(`${r.leaves.length}개`);
        ivC.draw(SEG5UI.withBorders(SEG5UI.labelRGB(r.region, sm), r.region), 'rgb'); ivC.setCaption('합병 후'); ivC.setInfo(`${SEG5UI.nRegions(r.region)}개`);
        gInfo.textContent = `Q: 영역의 최댓값−최솟값 ≤ ${Tg}, 최소 넓이 s = ${sg}×${sg}. T를 바꿔 보면 블록 모양이 그대로 남거나(너무 작음) 서로 다른 물체가 합쳐집니다(너무 큼) — 하나의 규칙 Q로 자연 영상을 가르기 어렵다는 뜻입니다.`;
      }
      pk = UI.figPicker('yeast', () => real());
      root.append(h('div', { class: 'lab' },
        h('div', { class: 'stack' },
          h('div', { class: 'card' }, h('div', { class: 'controls' }, h('button', { class: 'btn', type: 'button', onclick: () => { f = FIG57.map(r => r.slice()); rebuild(); } }, '그림 5-7 영상으로'), UI.labeled('최소 넓이 s', UI.select([[1, '1 (끝까지)'], [4, '4 (2×2에서 멈춤)']], s, v => { s = +v; rebuild(); }, 'sm-s'))),
            h('div', { class: 'row', style: { marginTop: '10px' } }, h('div', { class: 'col' }, h('span', { class: 'caption' }, '입력 (클릭 0↔1) — 음영: 지금 검사하는 블록'), g.el), h('div', { class: 'col', style: { flex: '1 1 360px' } }, h('span', { class: 'caption' }, '4진 트리 — ● 흑 단말, ○ 백 단말, 회색: 다시 나눈 노드 (선 위 숫자 = 자식 번호)'), treeBox))),
          h('div', { class: 'card' }, h('h3', {}, '명암 영상에서는?'), h('div', { class: 'controls' }, pk.el, UI.slider({ label: 'Q의 T', min: 2, max: 80, step: 2, value: Tg, id: 'sm-t', oninput: v => { Tg = v; real(); } }), UI.slider({ label: '최소 블록', min: 1, max: 8, step: 1, value: sg, id: 'sm-sg', fmt: v => v + '×' + v, oninput: v => { sg = v; real(); } })),
            h('div', { class: 'row', style: { marginTop: '10px' } }, ivA.el, ivB.el, ivC.el), gInfo)),
        h('div', { class: 'stack' }, st.panel)));
      rebuild(); real();
    },
  });
})();

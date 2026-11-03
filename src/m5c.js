// Chapter 5 modules, part C: watershed, snake, graph cut, choosing an algorithm
(() => {
  const { h, fmt } = UI;
  const R = String.raw;
  const css = c => `rgb(${c.map(v => Math.round(v)).join(',')})`;

  // ================= 5.5 watershed =================
  const F516 = [2, 2, 2, 2, 6, 8, 9, 8, 8, 4, 2, 1, 2, 4, 4, 4];
  // Fig 5-16: edge strength at x is |f(x+1) − f(x)|; the last position has no value ('-') and is treated as the highest border
  const edge1 = f => f.map((v, i) => (i + 1 < f.length ? Math.abs(f[i + 1] - v) : Infinity));
  APP.mod({
    id: 'watershed', ch: '5', num: '5.5', title: '워터셰드', src: '5강 p.39–41 · 알고리즘 5-9, 그림 5-16', star: true,
    blurb: '에지 강도 = 지형의 높이. 낮은 곳부터 물을 채우고 두 호수가 만나는 곳에 댐(= 분할 경계)을 쌓기.',
    mount(root, m) {
      APP.scaffold(root, m, {
        lead: '에지 강도를 그 지점의 <b>높이</b>로 보면 영상은 지형이 됩니다. 각 <b>최저점</b>에 구멍을 뚫고 물을 채우면 수위가 오를 때마다 호수가 커지고, 서로 다른 호수가 넘쳐 만나려는 곳에 <b>댐</b>을 쌓습니다. 이 댐이 워터셰드(분수계), 즉 분할 경계입니다. 그림 5-16의 1차원 예로 수위를 올려 보고, 알고리즘 5-9(Meyer)가 우선순위 큐로 같은 결과를 내는 과정을 따라가 보세요.',
        formulas: [[R`$$\text{에지 강도 } e(x)=|f(x+1)-f(x)|\quad(\text{그림 5-16}),\qquad \text{2차원: } e(j,i)=\|\nabla f(j,i)\|$$`, '높이 = 에지 강도']],
      });
      SEG5UI.flow(root, '5.5', { prev: '민시프트는 화소마다 창 안을 반복 탐색해 느렸고, 그래프 방법은 고유값·정렬이 필요했습니다.', idea: '에지 강도 맵을 지형으로 보고 <b>낮은 화소부터</b>(우선순위 큐) 이웃 호수의 번호를 물려받습니다. 두 호수 사이의 화소는 번호를 받지 못해 경계가 되므로 <b>항상 폐곡선</b>이 생깁니다.', next: '잡음 때문에 최저점이 너무 많아 <b>심한 과분할</b>이 숙제입니다(슈퍼 화소로는 유용). 원하는 물체 하나만 정확히 오리고 싶다면 사용자가 알려 주는 방법 → 5.6 대화식 분할.' });
      let f = F516.slice(), level = 1, frame = null;
      const LV = 5;
      const fIn = h('input', { type: 'text', value: f.join(' '), size: 40, 'aria-label': '입력 f' });
      fIn.addEventListener('change', () => { const v = fIn.value.trim().split(/[\s,]+/).map(Number); if (v.length >= 4 && v.every(x => x >= 0 && x <= 9)) { f = v; rebuild(); } });
      const gF = UI.GridView({ rows: 2, cols: 16, cs: 34, fs: 13, rowLabels: ['f', 'e'], label: '입력과 에지 강도', cell: (y, x) => { const e = edge1(f); if (x >= f.length) return {}; if (y === 0) return { t: f[x] }; return { t: isFinite(e[x]) ? e[x] : '-', cls: frame && frame.p === x ? 'cur' : '' }; } });
      const gW = UI.GridView({ rows: LV, cols: 16, cs: 34, fs: 12, rowLabels: [5, 4, 3, 2, 1].map(v => '수위 ' + v), label: '물과 댐', cell: (y, x) => {
        if (x >= f.length) return {};
        const e = edge1(f), L = LV - y, frs = SEG.floodLevels(e, LV), cur = frs[level - 1];
        if (!isFinite(e[x]) || e[x] >= L) return { bg: 'color-mix(in srgb, var(--faint) 55%, var(--cell-bg))' };
        if (L > level) return {};
        const atL = frs[L - 1];
        if (atL.dam[x]) return { t: '▦', bg: 'color-mix(in srgb, var(--bad) 30%, var(--cell-bg))', title: '댐' };
        const lab = atL.lab[x];
        return lab ? { t: '○', bg: `color-mix(in srgb, ${css(SEG5UI.palette(order(cur.lab)(lab)))} 45%, var(--cell-bg))` } : {};
      } });
      // renumber basins left-to-right so they read 유역1..4 as in the figure
      const order = lab => { const seen = []; lab.forEach(v => { if (v && !seen.includes(v)) seen.push(v); }); return v => seen.indexOf(v); };
      const lvMsg = h('p', { class: 'note' });
      const lvSl = UI.slider({ label: '수위', min: 1, max: LV, step: 1, value: level, id: 'ws-lv', oninput: v => { level = v; drawW(); } });
      const MSG = { 1: '바닥에 구멍을 뚫어 물을 주입 — 높이 0인 최저점(유역 1, 2, 4)에 호수가 생깁니다.', 2: '높이 1까지 잠김 — 유역 3도 호수가 됩니다.', 3: '높이 2까지 — 유역 3과 4가 위치 12에서 넘쳐 합쳐지려 하므로 둘 사이에 댐을 쌓습니다.', 4: '높이 3 — 새로 잠기는 곳이 없습니다.', 5: '높이 4까지 — 위치 3(유역 1·2 사이)과 8(유역 2·3 사이)에도 댐. 최고 수위이므로 멈춥니다.' };
      function drawW() {
        gW.draw();
        const e = edge1(f), fr = SEG.floodLevels(e, LV)[level - 1], dams = fr.dam.map((d, i) => (d ? i : -1)).filter(i => i >= 0);
        lvMsg.innerHTML = `<b>수위 ${level}</b>: ${f.join(' ') === F516.join(' ') ? MSG[level] : ''} 지금까지 댐: ${dams.length ? dams.join(', ') : '없음'}.`;
      }
      // Meyer tracer
      const CODE = ['f에 그레이디언트 연산을 적용하여 에지 강도 맵을 구한다.', '최저 영역을 찾아 각각에 서로 다른 번호를 매긴다.', '번호가 매겨진 영역의 이웃 화소를 에지 강도에 따라 우선순위 큐 q에 삽입한다.', 'while(q ≠ ∅) {', '  p = pop(q);   // 에지 강도가 가장 낮은 화소', '  p의 이웃 중 번호가 매겨진 것을 조사한다.', '  if(그들의 번호가 모두 같으면) p에 그들과 같은 번호를 부여한다.', '  번호가 매겨지지 않은 p의 이웃을 모두 q에 삽입한다.', '}', '번호가 매겨지지 않은 화소를 워터셰드로 취한다.', '워터셰드로 영상을 분할한다.'];
      const st = UI.Stepper({ code: CODE, title: '알고리즘 5-9 워터셰드 (Meyer)', render: fr => { frame = fr; gF.draw(); gM.draw(); } });
      const gM = UI.GridView({ rows: 1, cols: 16, cs: 34, fs: 13, rowLabels: ['번호'], label: '번호', cell: (y, x) => { if (!frame || !frame.lab || x >= f.length) return {}; const v = frame.lab[x]; const s = v ? { t: v, bg: `color-mix(in srgb, ${css(SEG5UI.palette(v - 1))} 45%, var(--cell-bg))` } : frame.done && isFinite(edge1(f)[x]) ? { t: 'W', bg: 'color-mix(in srgb, var(--bad) 30%, var(--cell-bg))' } : {}; if (frame.p === x) s.cls = 'cur'; return s; } });
      function rebuild() {
        fIn.value = f.join(' ');
        gF.resize(2, f.length); gW.resize(LV, f.length); gM.resize(1, f.length);
        const e = edge1(f), r = SEG.meyer([e], { trace: true }), q2s = q => q.map(([, x, v]) => `${x}(${v})`);
        const fr = [{ line: 1, note: '에지 강도 e(x) = |f(x+1) − f(x)| (그림 5-16 둘째 줄). 마지막 칸은 값이 없어 가장 높은 가장자리로 봅니다.' }];
        const init = r.steps[0];
        fr.push({ line: 2, lab: init.lab[0], note: `높이가 주변보다 낮은 평지(최저 영역)를 찾아 번호 1~${r.minima}을 매깁니다: ` + [...new Set(init.lab[0].filter(Boolean))].map(v => `${v} = {${init.lab[0].map((l, i) => (l === v ? i : -1)).filter(i => i >= 0).join(',')}}`).join(', ') });
        fr.push({ line: 3, lab: init.lab[0], stack: q2s(init.queue), note: `번호가 붙은 영역의 이웃을 큐에 넣습니다 (괄호 = 에지 강도, 낮을수록 먼저 나옴): ${q2s(init.queue).join(', ')}` });
        for (const sp of r.steps.slice(1)) {
          const x = sp.x;
          fr.push({ line: sp.ls.length === 1 ? [5, 6, 7, 8] : [5, 6, 8], p: x, lab: sp.lab[0], stack: q2s(sp.queue), vars: { p: x, 'e(p)': e[x], '이웃 번호': sp.ls.join(',') || '-', '부여': sp.got || '없음' }, note: sp.ls.length === 1 ? `p = ${x} (높이 ${e[x]}): 번호 붙은 이웃이 모두 ${sp.ls[0]} → <b>${sp.ls[0]}번</b>을 부여` + (sp.added.length ? `, 새 이웃 ${sp.added.map(a => a[1]).join(',')}을 큐에 넣음` : '') : `p = ${x} (높이 ${e[x]}): 이웃 번호가 ${sp.ls.join('과 ')}로 <b>서로 다름</b> → 번호를 주지 않음 (두 호수가 만나는 곳 = 워터셰드 후보)` });
        }
        const ws = r.lab[0].map((v, i) => (!v && isFinite(e[i]) ? i : -1)).filter(i => i >= 0);
        fr.push({ line: [10, 11], lab: r.lab[0], done: true, note: `번호를 받지 못한 위치 <b>${ws.join(', ')}</b>가 워터셰드(W)입니다 — 물 채우기로 쌓은 댐 위치와 같습니다. 7행에서 “번호가 모두 같을 때만” 붙이는 이유가 바로 이것입니다(연습문제 6).` });
        st.load(fr, 0);
        drawW();
      }
      // 2-D
      let pk, sig = 1.5, quant = 8;
      const ivA = UI.FeatView({ width: 340 }), ivB = UI.FeatView({ width: 340 }), ivC = UI.FeatView({ width: 340 }), info2 = h('p', { class: 'caption' });
      function real() {
        const g = pk.gray(), sm = sig > 0 ? CV.gaussianBlur(g, sig) : g, E = CV.edgeMaps(sm).S, mx = Math.max(...E.flat());
        const Eq = E.map(r => r.map(v => Math.floor(v / mx * 255 / quant)));
        const t0 = performance.now(), r = SEG.meyer(Eq), ms = performance.now() - t0;
        const col = r.lab.map((row, y) => row.map((v, x) => (v ? SEG5UI.palette((v - 1) % 12).map(c => c * 0.55 + g[y][x] * 0.45) : [200, 30, 30])));
        ivA.draw(g, 'gray'); ivA.setCaption('원래 영상');
        ivB.draw(Eq, 'norm'); ivB.setCaption('높이 = 에지 강도 (지형)');
        ivC.draw(col, 'rgb'); ivC.setCaption('유역(색)과 워터셰드(빨강)'); ivC.setInfo(`${r.minima}개 유역 · ${Math.round(ms)} ms`);
        info2.innerHTML = `최저점마다 유역이 하나씩 생기므로 잡음이 있으면 <b>과분할</b>됩니다. 먼저 스무딩(σ)하거나 높이를 거칠게 양자화(단계 폭 ${quant})하면 자잘한 최저점이 사라져 유역 수가 줄어듭니다. 워터셰드 경계는 언제나 닫힌 곡선입니다.`;
      }
      pk = UI.figPicker('yeast', () => real());
      root.append(h('div', { class: 'lab' },
        h('div', { class: 'stack' },
          h('div', { class: 'card' }, h('h3', {}, '① 물을 채우며 댐 쌓기', h('small', {}, '그림 5-16')), h('div', { class: 'controls' }, UI.labeled('f', fIn), h('button', { class: 'btn', type: 'button', onclick: () => { f = F516.slice(); rebuild(); } }, '그림 5-16으로'), lvSl),
            h('div', { class: 'col', style: { marginTop: '8px' } }, gF.el, h('span', { class: 'caption' }, '회색 = 땅(에지 강도만큼의 높이), ○ = 물(유역별 색), ▦ = 댐'), gW.el), lvMsg),
          h('div', { class: 'card' }, h('h3', {}, '② 알고리즘 5-9의 결과', h('small', {}, '오른쪽 단계 실행기')), gM.el, h('p', { class: 'caption' }, '우선순위 큐에서 높이가 낮은 화소부터 꺼내므로, 물이 낮은 곳부터 차오르는 것과 같은 순서로 번호가 퍼집니다. 큐 내용은 단계 실행기의 “호출 스택 / 큐” 칸에 보입니다.')),
          h('div', { class: 'card' }, h('h3', {}, '③ 2차원 영상'), h('div', { class: 'controls' }, pk.el, UI.slider({ label: '스무딩 σ', min: 0, max: 4, step: 0.5, value: sig, id: 'ws-s', fmt: v => v.toFixed(1), oninput: v => { sig = v; real(); } }), UI.slider({ label: '높이 양자화 폭', min: 1, max: 40, step: 1, value: quant, id: 'ws-q', oninput: v => { quant = v; real(); } })),
            h('div', { class: 'row', style: { marginTop: '10px' } }, ivA.el, ivB.el, ivC.el), info2)),
        h('div', { class: 'stack' }, st.panel)));
      rebuild(); real();
    },
  });

  // ================= 5.6.1 snake =================
  APP.mod({
    id: 'snake', ch: '5', num: '5.6.1', title: '능동 외곽선 (스네이크)', src: '5강 p.43–49 · 식 (5.21)–(5.26), 알고리즘 5-10, 그림 5-17~5-19', star: true,
    blurb: '곡선 위 점마다 9개 후보 위치의 에너지를 재어 가장 낮은 곳으로 옮기기를 반복(Williams 탐욕 알고리즘).',
    mount(root, m) {
      APP.scaffold(root, m, {
        lead: '영상 전체를 나누는 대신 <b>관심 물체 하나</b>만 오려냅니다. 사용자가 물체 근처에 초기 곡선을 주면, 곡선 위의 각 점이 <b>에너지가 가장 낮은 이웃 위치</b>로 조금씩 움직입니다. 에너지는 ① 점 간격이 고른가(연속성) ② 곡선이 부드러운가(곡률) ③ 에지 위에 있는가(영상)의 가중 합입니다. 모양이 뱀처럼 움직여 <b>스네이크</b>라 부릅니다. 영상을 클릭하면 그 위치에 점을 더해 초기 곡선을 직접 만들 수 있습니다.',
        formulas: [
          [R`$$E_{snake}=\int_0^1 E_{image}(\mathbf g(s))+E_{internal}(\mathbf g(s))+E_{constraint}(\mathbf g(s))\,ds$$`, '식 (5.21)'],
          [R`$$E_{image}=-\|\nabla f(\mathbf g(s))\|^2,\quad E_{internal}=\tfrac{\alpha\|\mathbf g_s\|^2+\beta\|\mathbf g_{ss}\|^2}{2},\ \ \|\mathbf g_s\|^2\cong\|\mathbf g(s)-\mathbf g(s-1)\|^2,\ \ \|\mathbf g_{ss}\|^2\cong\|\mathbf g(s-1)-2\mathbf g(s)+\mathbf g(s+1)\|^2$$`, '식 (5.22)(5.23)'],
          [R`$$E^*=\sum_s\big(\alpha E_{cont}+\beta E_{curv}+\gamma E_{image}\big),\ \ E_{cont}=\big|\bar d-\|\mathbf g(s)-\mathbf g(s-1)\|\big|,\ \ E_{image}=\frac{min-mag}{max-min}$$`, '식 (5.26) Williams'],
        ],
      });
      SEG5UI.flow(root, '5.6', { prev: '5.2~5.5는 영상 전체를 배타적인 영역으로 나눴고, 어느 영역이 원하는 물체인지는 알려 주지 않았습니다.', idea: '사용자가 <b>초기 곡선</b>을 주고, 곡선이 에너지 최소 상태(물체 외곽선)를 <b>능동적으로</b> 찾아갑니다. 내부 에너지가 “물체 경계는 대체로 매끄럽다”는 전제를 넣어 잡음에 붙잡히지 않게 합니다.', next: '곡선을 점들로 명시적으로 표현해서 구멍·여러 조각을 다루기 어렵고 초기 곡선에 민감합니다 → 지능 가위·레벨 셋, 그리고 토폴로지 제한이 없는 그래프 절단(5.6.2).' });
      // synthetic test image: bright rounded square with a notch + noise
      const N = 48;
      const scene = (noise, seed) => { const r = UI.rng(seed), f = SEG.zeros(N, N, 60); for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const inSq = Math.max(Math.abs(y - 24) / 13, Math.abs(x - 24) / 15) <= 1 && !(y < 20 && x > 30); if (inSq) f[y][x] = 200; f[y][x] += (r() - 0.5) * 2 * noise; } return f; };
      let noise = 20, img = scene(noise, 3), mag, sm = 1.5, alpha = 1, beta = 1, gamma = 1.2, T1 = 0.25, T2 = 100, T3 = 1, pts, frame = null, history = [];
      const circle = (n = 20, rr = 20) => Array.from({ length: n }, (_, i) => { const t = i / n * 2 * Math.PI; return [Math.round(24 + rr * Math.sin(t)), Math.round(24 + rr * Math.cos(t))]; });
      pts = circle();
      const CODE = ['초기 곡선 g(s)를 설정한다.   // 사용자 입력', 'for(s=0 to n) α(s)=β(s)=γ(s)=1.0;', 'while(TRUE) {', '  moved = 0;', '  for(s=0 to n) {', '    for(g(s)의 이웃점 각각에 대해)   // 자기 자신 + 8-이웃 = 9개', '      식 (5.26)으로 에너지 E*를 구한다.', '    if(최소 에너지 점이 g(s)와 다르면) { g(s)를 그 점으로 이동; moved++; }', '  }', '  if(moved < T3) break;   // 수렴', '  곡률 c_s를 계산해 코너(c_s 극대, > T1, 에지 강도 > T2)면 β(s)=0;', '}'];
      const st = UI.Stepper({ code: CODE, title: '알고리즘 5-10 스네이크 (탐욕)', render: fr => { frame = fr; draw(); } });
      const iv = UI.FeatView({ width: 420, onClick: (y, x, e) => { if (e.shiftKey) { pts = []; } pts.push([y, x]); if (pts.length >= 3) rebuild(); else draw(); } });
      const cand = UI.GridView({ rows: 3, cols: 3, cs: 92, fs: 10, axes: false, label: '9개 후보', cell: (y, x) => { if (!frame || !frame.c) return {}; const r = frame.c.rows.find(q => q.y === frame.c.from[0] + y - 1 && q.x === frame.c.from[1] + x - 1); if (!r) return { cls: 'dim' }; const best = frame.c.rows[frame.c.best]; const s = { t: `E=${r.E.toFixed(2)}`, sub: `c${r.ecn.toFixed(2)} k${r.ekn.toFixed(2)} i${r.ei.toFixed(2)}`, bg: r === best ? 'color-mix(in srgb, var(--ok) 35%, var(--cell-bg))' : '' }; if (y === 1 && x === 1) s.cls = 'win'; return s; } });
      function rebuild() {
        mag = CV.edgeMaps(sm > 0 ? CV.gaussianBlur(img, sm) : img).S;   // ‖∇f‖ after a light Gaussian so single noisy pixels do not trap the snake
        const n = pts.length, A = new Array(n).fill(alpha), B = new Array(n).fill(beta), Gm = new Array(n).fill(gamma);
        let P = pts.map(p => p.slice()), fr = [{ line: [1, 2], P, note: `초기 곡선: 점 ${n}개 (그림 5-18처럼 폐곡선, 첨자는 모듈로 — s=0의 s−1은 n−1). α=${alpha}, β=${beta}, γ=${gamma}.` }];
        history = [P];
        for (let it = 1; it <= 60; it++) {
          const r = SEG.snakeStep(P, mag, A, B, Gm);
          fr.push({ line: [3, 4], P, it, note: `${it}회차 시작. 평균 간격 d̄ = ${r.cand[0].dbar.toFixed(2)}` });
          // record point-level frames for the first two iterations, then one frame per iteration
          if (it <= 2) r.cand.forEach((c, s) => { const b = c.rows[c.best]; fr.push({ line: [5, 6, 7, 8], P, it, s, c, vars: { 회차: it, s, 'g(s)': `(${c.from})`, '최소 E 위치': `(${b.y},${b.x})`, E_cont: +b.ecn.toFixed(3), E_curv: +b.ekn.toFixed(3), E_image: +b.ei.toFixed(3) }, note: `점 s=${s} (${c.from}): 9개 후보 중 E가 가장 작은 곳은 (${b.y}, ${b.x}) ${b.y === c.from[0] && b.x === c.from[1] ? '— 제자리' : '→ 이동'}. 아래 3×3 표에서 c=연속성, k=곡률, i=영상 항(각각 정규화).` }); });
          const corner = SEG.snakeCorners(r.next, mag, T1, T2);
          corner.forEach((cc, s) => { B[s] = cc ? 0 : beta; });
          fr.push({ line: [9, 10, 11], P: r.next, it, corner, vars: { 회차: it, moved: r.moved, '코너 수': corner.filter(Boolean).length }, note: `${it}회차: 점 ${r.moved}개가 움직임.` + (corner.some(Boolean) ? ` 코너로 판정된 점(빨강) ${corner.filter(Boolean).length}개는 다음 회차에서 β=0 — 곡률 벌점을 받지 않아 모서리에 붙을 수 있습니다.` : '') + (r.moved < T3 ? ' <b>moved < T3 → 수렴</b>' : '') });
          P = r.next; history.push(P);
          if (r.moved < T3) break;
        }
        st.load(fr, 0);
      }
      function draw() {
        const P = frame && frame.P ? frame.P : pts, marks = [];
        history.slice(0, 1).forEach(H0 => marks.push({ kind: 'poly', pts: H0, color: '--faint', w: 1 }));
        marks.push({ kind: 'poly', pts: P, color: '--orange', w: 2.5 });
        P.forEach((p, s) => marks.push({ kind: 'dot', y: p[0], x: p[1], size: frame && frame.s === s ? 5 : 2.5, color: frame && frame.corner && frame.corner[s] ? '--bad' : frame && frame.s === s ? '--neg' : '--orange' }));
        if (frame && frame.c) { const b = frame.c.rows[frame.c.best]; marks.push({ kind: 'rect', y: frame.c.from[0] - 1, x: frame.c.from[1] - 1, hh: 3, ww: 3, color: '--neg', w: 1.5 }); marks.push({ kind: 'cross', y: b.y, x: b.x, color: '--ok', size: 5 }); }
        iv.draw(img, 'gray', { marks }); iv.setCaption('회색 선 = 초기 곡선, 주황 = 현재 스네이크 · 클릭: 점 추가, Shift+클릭: 새로 시작'); iv.setInfo(`${P.length}점`);
        cand.draw();
      }
      // Fig 5-18 list
      const F518 = [[1, 2], [4, 1], [6, 4], [4, 6], [2, 6], [1, 3]];
      const g518 = UI.GridView({ rows: 8, cols: 8, cs: 26, fs: 10, label: '그림 5-18', cell: (y, x) => { const k = F518.findIndex(p => p[0] === y && p[1] === x); return k >= 0 ? { t: k, bg: 'color-mix(in srgb, var(--orange) 40%, var(--cell-bg))', bold: true } : {}; } });
      g518.draw();
      g518.overlay(F518.map((p, i) => ({ type: 'line', pts: [p[0], p[1], F518[(i + 1) % 6][0], F518[(i + 1) % 6][1]], color: '--orange', w: 1.5, dash: true })));
      root.append(h('div', { class: 'lab' },
        h('div', { class: 'stack' },
          h('div', { class: 'card' }, h('div', { class: 'controls' }, h('button', { class: 'btn', type: 'button', onclick: () => { pts = circle(); rebuild(); } }, '원으로 초기화'), UI.slider({ label: '잡음', min: 0, max: 60, step: 5, value: noise, id: 'sn-n', oninput: v => { noise = v; img = scene(noise, 3); rebuild(); } }), UI.slider({ label: '에지 전 스무딩 σ', min: 0, max: 3, step: 0.5, value: sm, id: 'sn-sm', fmt: v => v.toFixed(1), oninput: v => { sm = v; rebuild(); } }),
            UI.slider({ label: 'α 연속성', min: 0, max: 3, step: 0.1, value: alpha, id: 'sn-a', fmt: v => v.toFixed(1), oninput: v => { alpha = v; rebuild(); } }), UI.slider({ label: 'β 곡률', min: 0, max: 3, step: 0.1, value: beta, id: 'sn-b', fmt: v => v.toFixed(1), oninput: v => { beta = v; rebuild(); } }), UI.slider({ label: 'γ 영상', min: 0, max: 3, step: 0.1, value: gamma, id: 'sn-g', fmt: v => v.toFixed(1), oninput: v => { gamma = v; rebuild(); } })),
            h('div', { class: 'row', style: { marginTop: '10px' } }, h('div', { class: 'col', style: { flex: '1 1 380px' } }, iv.el), h('div', { class: 'col' }, h('span', { class: 'caption' }, '현재 점의 9개 후보 (가운데 = 제자리, 초록 = 최소 E)'), cand.el))),
          h('div', { class: 'card' }, h('h3', {}, '해 볼 것'), h('ul', { class: 'caption', style: { margin: 0, paddingLeft: '18px' } },
            h('li', {}, 'γ = 0 (영상 항 제거, 연습문제 8): 에지를 무시하고 간격·곡률만 줄이므로 곡선이 점점 오그라듭니다.'),
            h('li', {}, 'β를 크게: 곡선이 너무 매끄러워져 오른쪽 위의 파인 홈으로 들어가지 못합니다. 작게: 잡음에 붙잡혀 울퉁불퉁해집니다.'),
            h('li', {}, '잡음을 올리면 영상 항이 흔들려 내부 에너지(α, β)의 역할이 커집니다.'),
            h('li', {}, '스무딩 σ = 0: 잡음 화소 하나하나의 그레이디언트에 점이 붙잡혀 몇 회차 만에 멈춥니다. 그래서 보통 에지 강도를 구하기 전에 가볍게 스무딩합니다.'))),
          h('div', { class: 'card' }, h('h3', {}, '이산 곡선 g(s)', h('small', {}, '그림 5-18 · n = 6, g(6) = g(0)')), h('div', { class: 'row' }, g518.el, h('p', { class: 'caption', style: { flex: '1 1 240px' } }, 'g(0)=(1,2), g(1)=(4,1), g(2)=(6,4), g(3)=(4,6), g(4)=(2,6), g(5)=(1,3). 디지털 영상에서는 s를 0, 1, …, n의 정수로 두고, 각 점을 화소 단위로 움직입니다.'))),
          h('div', { class: 'card' }, h('h3', {}, '스네이크 이후: 지능 가위와 레벨 셋', h('small', {}, '그림 5-19')), h('ul', { class: 'caption', style: { margin: 0, paddingLeft: '18px' } },
            h('li', {}, '지능 가위: 사용자가 물체 주위를 대충 따라가면 시스템이 경계를 실시간으로 잘라 보여 줌 (GIMP에 있음)'),
            h('li', {}, '레벨 셋: 곡선을 점으로 들고 다니지 않고 함수 φ = 0인 등고선으로 암시적으로 표현 → 구멍·섬이 있는 영역도 표현 가능'),
            h('li', {}, 'Kass의 변분법은 불안정, Amini의 동적 프로그래밍은 O(nm²)로 느림 → Williams의 탐욕 알고리즘이 품질·속도 모두 우수')))),
        h('div', { class: 'stack' }, st.panel)));
      rebuild();
    },
  });

  // ================= 5.6.2 graph cut =================
  const NET = { names: ['S', '1', '2', '3', '4', 'T'], pos: [[150, 20], [60, 110], [240, 110], [60, 280], [240, 280], [150, 370]], edges: [[0, 1, 7], [0, 2, 2], [1, 3, 4], [1, 2, 1], [3, 4, 1], [2, 4, 4], [3, 5, 2], [4, 5, 5]] };
  APP.mod({
    id: 'graphcut', ch: '5', num: '5.6.2', title: '그래프 절단 (최소 절단)', src: '5강 p.50–54 · 식 (5.27)–(5.29), 알고리즘 5-11, 예제 5-2, 그림 5-20~5-23', star: true,
    blurb: '최대 흐름 = 최소 절단. 화소 + S·T 그래프에 사용자의 물체/배경 표시를 넣고 최소 절단으로 오리기.',
    mount(root, m) {
      APP.scaffold(root, m, {
        lead: 'S에서 T로 물을 보낼 때 에지 가중치를 <b>파이프 용량</b>으로 보면, 보낼 수 있는 최대 흐름은 병목에서 정해집니다. Ford의 정리에 따르면 그 <b>최대 흐름 = 최소 절단</b>(S와 T를 떼어 놓는 데 자르는 에지 가중치 합의 최솟값)이고, 최소 절단의 에지는 모두 포화되어 있습니다. 영상 분할에서는 화소를 노드로, 사용자가 표시한 <b>물체(O)를 S</b>, <b>배경(B)을 T</b>에 묶어 최소 절단을 구하면 S 쪽 화소가 물체, T 쪽이 배경이 됩니다.',
        formulas: [
          [R`$$w_{pq}=e^{-\frac{(f(v_p)-f(v_q))^2}{2\sigma^2}}\,d(v_p,v_q)$$`, '식 (5.27) 화소 사이'],
          [R`$$w_{pS}=\lambda\big(-\ln prob(f(v_p)\,|\,\text{background})\big),\qquad w_{pT}=\lambda\big(-\ln prob(f(v_p)\,|\,\text{object})\big)$$`, '식 (5.28)(5.29) 단말 노드와'],
        ],
      });
      SEG5UI.flow(root, '5.6', { prev: '스네이크는 곡선을 명시적으로 들고 다녀 초기 곡선에 민감하고 구멍 난 물체를 다루기 어려웠습니다.', idea: '사용자 표시(O·B)를 <b>어길 수 없는 엄격한 조건</b>으로 그래프에 넣고, 화소끼리의 유사도(영상의 내재적 특성)와 물체·배경 확률(외부 지식)을 <b>최소 절단 하나</b>로 균형 맞춥니다. 외곽선을 암시적으로 표현해 토폴로지 제한이 없습니다.', next: 'GrabCut은 입력을 더 편하게(사각형 하나) 하고 경계를 정밀하게 다듬었습니다. 이제 여러 방법 중 무엇을 고를지 → 5.7.' });
      // (1) network flow, Fig 5-20
      const cap = Array.from({ length: 6 }, () => new Array(6).fill(0)); NET.edges.forEach(([a, b, c]) => (cap[a][b] = c));
      const mf = SEG.maxflow(cap, 0, 5, { trace: true });
      let frame = null;
      const CODE = ['모든 에지의 흐름 = 0', 'while(S에서 T로 가는 남는 용량의 경로가 있다) {', '  가장 짧은 경로 P를 찾는다.   // 너비 우선 탐색', '  b = P에서 남는 용량의 최솟값;   // 병목', '  P의 모든 에지에 흐름 b를 더한다;', '}', 'S에서 남는 용량으로 갈 수 있는 노드 집합 = S 쪽,  나머지 = T 쪽', '최소 절단 = S 쪽 → T 쪽 에지 (모두 포화)'];
      const st = UI.Stepper({ code: CODE, title: '최대 흐름 → 최소 절단 (Edmonds–Karp)', render: fr => { frame = fr; drawNet(); } });
      const netBox = h('div');
      function drawNet() {
        const f = frame && frame.f, path = frame && frame.path, cut = frame && frame.cut;
        let svg = `<svg viewBox="0 0 300 395" width="300" height="395" role="img" aria-label="네트워크 흐름"><defs><marker id="nf-a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--ink)"/></marker></defs>`;
        for (const [a, b, c] of NET.edges) {
          const [x1, y1] = NET.pos[a], [x2, y2] = NET.pos[b], dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
          const onP = path && path.some((v, i) => i && path[i - 1] === a && v === b), isCut = cut && cut.some(e => e[0] === a && e[1] === b);
          const fl = f ? Math.max(0, f[a][b]) : 0, sat = f && fl >= c - 1e-9;
          svg += `<line x1="${x1 + ux * 18}" y1="${y1 + uy * 18}" x2="${x2 - ux * 20}" y2="${y2 - uy * 20}" stroke="${isCut ? 'var(--bad)' : onP ? 'var(--orange)' : 'var(--ink)'}" stroke-width="${onP || isCut ? 3.5 : 1.6}" ${isCut ? 'stroke-dasharray="6 4"' : ''} marker-end="url(#nf-a)"/>`;
          const mx = (x1 + x2) / 2 + uy * 14, my = (y1 + y2) / 2 - ux * 14;
          svg += `<text x="${mx}" y="${my + 4}" text-anchor="middle" font-size="13" font-family="var(--mono)" fill="${sat ? 'var(--bad)' : 'var(--ink)'}" font-weight="${sat ? 700 : 400}">${f ? fl + '/' : ''}${c}</text>`;
        }
        NET.names.forEach((nm, i) => { const [x, y] = NET.pos[i], side = frame && frame.reach ? (frame.reach[i] ? 'var(--orange)' : 'var(--neg)') : 'var(--surface)'; svg += `<circle cx="${x}" cy="${y}" r="17" fill="${frame && frame.reach ? `color-mix(in srgb, ${side} 30%, var(--surface))` : 'var(--surface)'}" stroke="var(--ink)" stroke-width="1.6"/><text x="${x}" y="${y + 5}" text-anchor="middle" font-size="15" font-weight="700" fill="var(--ink)">${nm}</text>`; });
        netBox.innerHTML = svg + '</svg>';
      }
      const fr = [{ line: 1, f: cap.map(r => r.map(() => 0)), note: '그림 5-20 왼쪽: 숫자는 파이프 용량. 아직 아무것도 흐르지 않습니다.' }];
      mf.steps.forEach((s, i) => fr.push({ line: [2, 3, 4, 5], f: s.f, path: s.path, vars: { 경로: s.path.map(v => NET.names[v]).join('→'), 병목: s.b, '총 흐름': s.total }, note: `${i + 1}번째 경로 ${s.path.map(v => NET.names[v]).join(' → ')}: 남은 용량의 최솟값(병목) <b>${s.b}</b>만큼 보냄 → 총 흐름 ${s.total}. 빨간 숫자는 꽉 찬(포화) 파이프.` }));
      fr.push({ line: 7, f: mf.f, reach: mf.reach, note: `더 보낼 경로가 없습니다 → <b>최대 흐름 = ${mf.total}</b>. 남은 용량으로 S에서 갈 수 있는 노드 {${mf.reach.map((r, i) => (r ? NET.names[i] : null)).filter(Boolean).join(', ')}}(주황)가 S 쪽입니다.` });
      fr.push({ line: 8, f: mf.f, reach: mf.reach, cut: mf.cutEdges, note: `최소 절단 = ${mf.cutEdges.map(([a, b, c]) => `${NET.names[a]}→${NET.names[b]}(${c})`).join(' + ')} = <b>${mf.cutEdges.reduce((s, e) => s + e[2], 0)}</b> = 최대 흐름. 잘린 네 에지가 모두 포화 상태입니다(Ford의 정리). 교재의 {v₁, v₃} | {v₂, v₄} 분할선입니다.` });
      st.load(fr, 0);
      // (2) Example 5-2
      const G52 = [[2, 8, 3], [2, 7, 9], [1, 1, 2]], SEED = [[0, 'O', 0], [0, 0, 0], [0, 0, 'B']];
      // the book gives prob(7|object)=0.3 and prob(7|background)=0.01 only; the other entries are filled in for this demo
      const PO = [0.01, 0.01, 0.01, 0.03, 0.01, 0.01, 0.02, 0.3, 0.4, 0.2], PB = [0.05, 0.35, 0.35, 0.15, 0.04, 0.02, 0.01, 0.01, 0.01, 0.01];
      let lam = 1, sig = 1, cellSel = 4;
      const gG = UI.GridView({ rows: 3, cols: 3, cs: 92, fs: 17, label: '예제 5-2', cell: (y, x) => { const r = ex52(), o = r.obj[y][x], sd = SEED[y][x]; const s = { t: G52[y][x], sub: sd || '', bg: o ? 'var(--cell-bg)' : 'color-mix(in srgb, var(--faint) 60%, var(--cell-bg))', title: o ? '물체' : '배경' }; if (y * 3 + x === cellSel) s.cls = 'cur'; if (sd === 'O') s.color = 'var(--bad)'; if (sd === 'B') s.color = 'var(--neg)'; return s; }, onClick: (y, x) => { cellSel = y * 3 + x; drawEx(); } });
      const exInfo = h('div'), probBox = h('div');
      const ex52 = () => SEG.graphCutImage(G52, SEED, { lambda: lam, sigma: sig, pObj: v => PO[v], pBg: v => PB[v] });
      function drawEx() {
        gG.draw();
        const r = ex52(), t = r.tlinks[cellSel], y = Math.floor(cellSel / 3), x = cellSel % 3, v = G52[y][x], sd = SEED[y][x];
        gG.overlay(r.nlinks.map(([p, q, w]) => ({ type: 'raw', svg: (() => { const y1 = Math.floor(p / 3), x1 = p % 3, y2 = Math.floor(q / 3), x2 = q % 3, cx = (gG.cx(x1) + gG.cx(x2)) / 2, cy = (gG.cy(y1) + gG.cy(y2)) / 2; return `<rect x="${cx - 17}" y="${cy - 8}" width="34" height="16" rx="3" fill="var(--surface)" stroke="var(--rule)"/><text x="${cx}" y="${cy + 4}" text-anchor="middle" font-size="10" font-family="var(--mono)" fill="var(--neg)">${w < 0.0005 ? '0' : w.toFixed(3).replace(/^0/, '')}</text>`; })() })));
        exInfo.replaceChildren(h('dl', { class: 'kv' }, h('dt', {}, `화소 (${y},${x}), 명암 ${v}`), h('dd', {}, sd === 'O' ? '사용자가 O로 지정' : sd === 'B' ? '사용자가 B로 지정' : 'O도 B도 아님'), h('dt', {}, 'w_pS'), h('dd', {}, sd === 'O' ? '100 (아주 큰 값 — 절대 안 잘림)' : sd === 'B' ? '0' : `${lam}·(−ln prob(${v}|배경)) = ${lam}·(−ln ${PB[v]}) = ${t.wS.toFixed(4)}`), h('dt', {}, 'w_pT'), h('dd', {}, sd === 'B' ? '100' : sd === 'O' ? '0' : `${lam}·(−ln prob(${v}|물체)) = ${lam}·(−ln ${PO[v]}) = ${t.wT.toFixed(4)}`), h('dt', {}, '최대 흐름'), h('dd', {}, r.flow.toFixed(4))),
          h('p', { class: 'caption', html: `화소 사이 숫자는 식 (5.27) 유사도(σ=${sig}, d=1): 8과 7이면 e<sup>−1/2</sup> = 0.6065, 2와 8이면 거의 0. 가운데 화소(7)는 S와 4.6052, T와 1.204로 이어져 있어 <b>T 쪽 에지가 잘릴</b> 가능성이 높습니다. 결과(흰 칸 = 물체, 회색 = 배경)는 그림 5-22와 같습니다. 모든 화소는 절단 후 S 또는 T 하나에만 연결되어 남습니다.` }));
        probBox.replaceChildren(UI.dataTable(['명암', ...PO.map((_, i) => i)], [['prob(·|물체)', ...PO], ['prob(·|배경)', ...PB]]), h('p', { class: 'caption' }, '교재는 명암 7의 확률(0.3, 0.01)만 줍니다. 나머지 칸은 이 실습에서 정한 값입니다 (실제로는 O·B로 표시한 화소의 히스토그램 등으로 구함).'));
      }
      // (3) interactive cut on an image
      let pk, brush = 'O', lam2 = 1, sig2 = 12, seeds2 = null, obj2 = null;
      const W2 = 64;
      const small = () => { const g = pk.gray(), sc = Math.max(1, Math.round(g[0].length / W2)); return g.filter((_, y) => y % sc === 0).map(r => r.filter((_, x) => x % sc === 0)); };
      const iv2 = UI.FeatView({ width: 420, onClick: (y, x, e) => paint(y, x), onHover: undefined }), info2 = h('p', { class: 'caption' });
      let painting = false;
      iv2.canvas.addEventListener('pointerdown', () => (painting = true)); window.addEventListener('pointerup', () => { if (painting) { painting = false; cut2(); } });
      iv2.canvas.addEventListener('pointermove', e => { if (!painting) return; const r = iv2.canvas.getBoundingClientRect(), g = small(); const y = Math.floor((e.clientY - r.top) / r.height * g.length), x = Math.floor((e.clientX - r.left) / r.width * g[0].length); paint(y, x); });
      function paint(y, x) { const g = small(); if (!seeds2 || seeds2.length !== g.length) seeds2 = g.map(r => r.map(() => 0)); for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const a = y + dy, b = x + dx; if (a >= 0 && b >= 0 && a < g.length && b < g[0].length) seeds2[a][b] = brush === 'X' ? 0 : brush; } show2(); }
      function cut2() {
        const g = small(); if (!seeds2 || seeds2.length !== g.length) { seeds2 = g.map(r => r.map(() => 0)); }
        const vo = [], vb = []; g.forEach((r, y) => r.forEach((v, x) => { if (seeds2[y][x] === 'O') vo.push(v); if (seeds2[y][x] === 'B') vb.push(v); }));
        if (!vo.length || !vb.length) { obj2 = null; info2.textContent = '빨강(물체 O)과 파랑(배경 B)을 둘 다 몇 번 칠하면 최소 절단을 계산합니다.'; show2(); return; }
        // seed histograms (16 bins, add-one smoothing) as prob(f | object/background)
        const hist = vs => { const hh = new Array(16).fill(1); vs.forEach(v => hh[v >> 4]++); const s = hh.reduce((a, b) => a + b, 0); return v => hh[Math.min(15, v >> 4)] / s; };
        const t0 = performance.now(), r = SEG.graphCutImage(g, seeds2, { lambda: lam2, sigma: sig2, pObj: hist(vo), pBg: hist(vb), big: 1e6 }), ms = performance.now() - t0;
        obj2 = r.obj;
        info2.innerHTML = `화소 ${g.length * g[0].length}개 + S, T. 최대 흐름 ${r.flow.toFixed(1)}, ${Math.round(ms)} ms. 물체 화소 ${obj2.flat().filter(Boolean).length}개. λ를 키우면 물체·배경 <b>확률</b>(t-link)을 더 믿고, 줄이면 이웃끼리 같은 편이 되려는 <b>매끄러움</b>(n-link)이 이깁니다. 물체가 여러 조각이어도, 구멍이 있어도 됩니다.`;
        show2();
      }
      function show2() {
        const g = small(), rgb = g.map((r, y) => r.map((v, x) => { let c = [v, v, v]; if (obj2 && !obj2[y][x]) c = c.map(q => q * 0.35); const sd = seeds2 && seeds2[y] && seeds2[y][x]; if (sd === 'O') c = [230, 60, 50]; if (sd === 'B') c = [50, 110, 230]; return c; }));
        iv2.draw(rgb, 'rgb'); iv2.setCaption('드래그해서 칠하기 — 밝게 남은 곳이 물체, 어두워진 곳이 배경');
      }
      pk = UI.figPicker('moon', () => { seeds2 = null; obj2 = null; show2(); info2.textContent = '빨강(물체 O)과 파랑(배경 B)을 칠해 보세요.'; });
      const brushSeg = UI.segmented([['O', '물체 O (빨강)'], ['B', '배경 B (파랑)'], ['X', '지우개']], brush, v => (brush = v));
      root.append(h('div', { class: 'lab' },
        h('div', { class: 'stack' },
          h('div', { class: 'card' }, h('h3', {}, '① 네트워크 흐름과 최소 절단', h('small', {}, '그림 5-20 · 오른쪽 단계 실행기')), h('div', { class: 'row' }, netBox, h('p', { class: 'caption', style: { flex: '1 1 240px' } }, '각 에지의 “흐름/용량”. 용량 7인 S→1 파이프도 그다음 파이프(1→3의 4는 3→T 2와 3→4 1에 막힘)가 받아 주는 만큼만 흐릅니다. 경로를 찾을 때마다 병목만큼 보내고, 더 보낼 경로가 없을 때의 총량이 최대 흐름입니다. 마지막에 S에서 갈 수 있는 쪽(주황)과 없는 쪽(파랑)을 가르는 빨간 점선이 최소 절단.'))),
          h('div', { class: 'card' }, h('h3', {}, '② 예제 5-2: 3×3 영상', h('small', {}, '칸을 클릭하면 그 화소의 가중치 계산')), h('div', { class: 'controls' }, UI.slider({ label: 'λ', min: 0.1, max: 5, step: 0.1, value: lam, id: 'gc-l', fmt: v => v.toFixed(1), oninput: v => { lam = v; drawEx(); } }), UI.slider({ label: 'σ', min: 0.5, max: 4, step: 0.5, value: sig, id: 'gc-s', fmt: v => v.toFixed(1), oninput: v => { sig = v; drawEx(); } })),
            h('div', { class: 'row', style: { marginTop: '8px' } }, gG.el, h('div', { class: 'col', style: { flex: '1 1 300px' } }, exInfo)), probBox),
          h('div', { class: 'card' }, h('h3', {}, '③ 직접 오려 보기', h('small', {}, '알고리즘 5-11 · 그림 5-21의 바오밥 나무처럼')), h('div', { class: 'controls' }, pk.el, brushSeg, UI.slider({ label: 'λ', min: 0, max: 5, step: 0.1, value: lam2, id: 'gc-l2', fmt: v => v.toFixed(1), oninput: v => { lam2 = v; cut2(); } }), UI.slider({ label: 'σ', min: 2, max: 40, step: 1, value: sig2, id: 'gc-s2', oninput: v => { sig2 = v; cut2(); } }), h('button', { class: 'btn', type: 'button', onclick: () => { seeds2 = null; obj2 = null; show2(); } }, '표시 지우기')),
            h('div', { class: 'row', style: { marginTop: '10px' } }, h('div', { class: 'col', style: { flex: '1 1 380px' } }, iv2.el), h('div', { class: 'col', style: { flex: '1 1 220px' } }, info2)))),
        h('div', { class: 'stack' }, st.panel)));
      drawNet(); drawEx(); show2(); info2.textContent = '빨강(물체 O)과 파랑(배경 B)을 칠해 보세요. 예: “그림 5-3 달”에서 달 위에 빨강, 하늘에 파랑.';
    },
  });

  // ================= 5.7 choosing an algorithm =================
  APP.mod({
    id: 'segcmp', ch: '5', num: '5.7', title: '알고리즘 선택과 5장 흐름 정리', src: '5강 p.56–57 · 그림 5-24, 5장 요약',
    blurb: '같은 영상에 5장의 모든 방법을 돌려 나란히 비교. 데이터베이스·벤치마킹·과적합.',
    mount(root, m) {
      APP.scaffold(root, m, {
        lead: '분할 알고리즘을 고르는 뚜렷한 가이드라인은 없습니다. UC 버클리·바이츠만 같은 <b>표준 데이터베이스</b>에 여러 사람이 손으로 분할한 결과가 있어 그것과 비교(벤치마킹)하지만, 데이터베이스에 매개변수를 너무 맞추면 새 영상에서 품질이 떨어지는 <b>과적합</b>이 생깁니다. 아래에서 같은 영상에 5장의 방법을 모두 돌려 보며 흐름을 정리해 보세요.',
        formulas: [],
      });
      SEG5UI.flow(root, '5.7', { prev: '5.2~5.6에서 단순 규칙 → 전역 최적화 → 사용자 개입 순으로 방법이 발전했습니다.', idea: '응용에 맞는 방법을 <b>직접 실험해서</b> 고릅니다. 사람 분할(그라운드 트루스)도 사람마다 다르다는 점(저분할·과분할의 딜레마)을 기억하세요.' });
      const rows = [
        ['5.2.1 이중 임계값 오츄', '명암 히스토그램', '부류간 분산 최대 (전수 조사)', '단순·빠름', '물체가 명암으로 안 갈리면 실패, 지역 변화에 약함', 'otsu2'],
        ['5.2.2 k-means', '(r,g,b) 점', '가장 가까운 중심·평균 갱신 반복', '컬러 사용, 구현 쉬움', 'k 지정, 초기화 민감, 위치 무시 → 자글자글', 'kmeans'],
        ['5.2.3 분할합병', '블록', 'Q 거짓이면 4분할, 참이면 합병', '이진 영상에 명확', '자연 영상에 맞는 Q 하나를 만들 수 없음', 'splitmerge'],
        ['5.3.1 최소 신장트리', '화소 그래프 (이웃 에지)', 'mult_intra 비교, 작은 에지부터 탐욕 병합', 'O(n)에 가까움, 전역적으로 적당한 분할 보장', 'k로 세밀함 조절 필요', 'mst'],
        ['5.3.2 정규화 절단', '화소 그래프 (특징+거리 유사도)', 'ncut 최소, 두 번째 고유 벡터로 근사', '작은 조각 편애 없음, 전역 최적', '고유값 계산이 무거움', 'ncut'],
        ['5.4 민시프트', '5차원 (y,x,L,u,v)', '밀도 봉우리로 반복 이동', '군집 수 자동, 임의 모양, h 하나', '느림 (창 안 탐색 반복)', 'meanshift'],
        ['5.5 워터셰드', '에지 강도 지형', '낮은 곳부터 번호 전파 (우선순위 큐)', '항상 폐곡선, 빠름', '심한 과분할 (슈퍼 화소로는 유용)', 'watershed'],
        ['5.6.1 스네이크', '초기 곡선', '에너지 최소 위치로 점 이동 (탐욕)', '매끄러운 외곽선, 물체 하나', '초기 곡선 민감, 토폴로지 고정', 'snake'],
        ['5.6.2 그래프 절단', '화소 + S·T, 사용자 O·B', '최대 흐름 = 최소 절단', '사용자 의도 반영, 토폴로지 자유', '사용자 입력 필요', 'graphcut'],
      ];
      // run several methods on the same image
      let pk;
      const grid = h('div', { class: 'row', style: { gap: '12px' } });
      function run() {
        const rgb0 = pk.rgb(), g0 = pk.gray(), sc = rgb0[0].length > 100 ? 2 : 1;
        const rgb = rgb0.filter((_, y) => y % sc === 0).map(r => r.filter((_, x) => x % sc === 0)), g = g0.filter((_, y) => y % sc === 0).map(r => r.filter((_, x) => x % sc === 0));
        const hh = g.length, ww = g[0].length, out = [];
        const time = (name, fn) => { const t = performance.now(), lab = fn(); out.push([name, lab, performance.now() - t]); };
        time('이중 임계값 오츄', () => { const hn = SEG.histogram(g, 256).map(v => v / (hh * ww)), h64 = new Array(64).fill(0); hn.forEach((v, i) => (h64[i >> 2] += v)); const o = SEG.otsu2(h64); return SEG.ternarize(g, o.t1 * 4 + 3, o.t2 * 4 + 3); });
        time('k-means (k=6)', () => { const X = rgb.flat(), r = UI.rng(2), init = []; while (init.length < 6) { const i = Math.floor(r() * X.length); if (!init.includes(i)) init.push(i); } const a = SEG.kmeans(X, 6, init, 25).assign; return Array.from({ length: hh }, (_, y) => a.slice(y * ww, (y + 1) * ww)); });
        time('분할합병 (T=30)', () => SEG.splitMerge(g, 30, 4).region);
        time('최소 신장트리 (k=300)', () => { const ch = [0, 1, 2].map(c => CV.gaussianBlur(rgb.map(r => r.map(p => p[c])), 0.8)), feat = rgb.map((r, y) => r.map((_, x) => [ch[0][y][x], ch[1][y][x], ch[2][y][x]])); const c = SEG.felzenszwalb(hh * ww, SEG.gridGraph(feat, 8), 300, { minArea: 15 }).comp; return Array.from({ length: hh }, (_, y) => c.slice(y * ww, (y + 1) * ww)); });
        time('민시프트 (hs=5, hr=8)', () => SEG.meanShiftImage(rgb, 5, 8, { minArea: 10 }).lab);
        time('워터셰드 (σ=1.5)', () => { const E = CV.edgeMaps(CV.gaussianBlur(g, 1.5)).S, mx = Math.max(...E.flat()); return SEG.meyer(E.map(r => r.map(v => Math.floor(v / mx * 32)))).lab; });
        grid.replaceChildren(...out.map(([name, lab, ms]) => { const v = UI.FeatView({ width: 250 }); v.draw(SEG5UI.withBorders(SEG5UI.labelRGB(lab, rgb), lab), 'rgb', { width: 250 }); v.setCaption(name); v.setInfo(`${SEG5UI.nRegions(lab)}개 · ${Math.round(ms)} ms`); return h('div', { style: { flex: '1 1 240px', maxWidth: '300px' } }, v.el); }));
      }
      pk = UI.figPicker('sun', () => run());
      root.append(
        h('div', { class: 'card' }, h('h3', {}, '같은 영상, 여섯 가지 방법', h('small', {}, '영역 평균색 + 경계선 · 영역 수 · 시간')), h('div', { class: 'controls' }, pk.el), h('div', { style: { marginTop: '10px' } }, grid),
          h('p', { class: 'caption' }, '매개변수는 각 페이지의 기본값 근처로 고정했습니다(큰 영상은 절반 크기). 페이지로 가서 매개변수를 바꿔 보면 순위가 쉽게 뒤집힙니다 — 그래서 “어떤 알고리즘이 최고인가”보다 “내 응용에 맞는가”를 실험으로 확인해야 합니다.')),
        h('div', { class: 'card', style: { marginTop: '16px' } }, h('h3', {}, '5장 한눈에 보기'), UI.dataTable(['방법', '무엇을 보나', '어떻게 정하나', '장점', '한계'], rows.map(r => [h('a', { href: '#' + r[5] }, r[0]), r[1], r[2], r[3], r[4]]))),
        h('div', { class: 'card', style: { marginTop: '16px' } }, h('h3', {}, '데이터베이스와 벤치마킹'), h('ul', { class: 'caption', style: { margin: 0, paddingLeft: '18px' } },
          h('li', {}, 'UC 버클리 [Martin2001]: 자연 영상, 여러 사람의 분할 결과 제공 (그림 5-1(b))'),
          h('li', {}, '바이츠만 [Alpert2007]: 더 단순한 영상을 물체 하나·둘로 분할'),
          h('li', {}, '품질 척도 [Unnikrishnan2007]로 네 알고리즘을 비교한 [Estrada2009], 외곽선 검출과 영역 분할을 결합한 [Arbelaez2011]'),
          h('li', {}, '과적합: 데이터베이스에 맞춘 매개변수가 새 영상에서는 품질이 떨어짐 → 일반화 능력이 낮은 알고리즘'))));
      run();
    },
  });
})();

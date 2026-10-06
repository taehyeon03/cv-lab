// Chapter 4 modules, part B: scale space, Harris-Laplace, SIFT, SURF, detector comparison
(() => {
  const { h, fmt } = UI;
  const R = String.raw;
  const SIG4 = [1.6, 2.0159, 2.5398, 3.2, 4.0317, 5.0797];
  const ms = fn => { const t = performance.now(); const r = fn(); return [r, performance.now() - t]; };
  // synthetic test scene: blobs and squares of several sizes on a mid-grey background
  function blobScene() {
    const H = 96, W = 128, f = CV.zeros(H, W, 70);
    const disc = (cy, cx, r, v) => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ((y - cy) ** 2 + (x - cx) ** 2 <= r * r) f[y][x] = v; };
    const sq = (y0, x0, s, v) => { for (let y = y0; y < y0 + s; y++) for (let x = x0; x < x0 + s; x++) f[y][x] = v; };
    disc(24, 24, 4, 210); disc(26, 62, 7, 210); disc(30, 104, 12, 30);
    sq(60, 10, 10, 220); sq(56, 44, 20, 220); sq(64, 86, 6, 20); sq(78, 104, 12, 200);
    return f;
  }

  // ================= 4.4.1 scale space =================
  APP.mod({
    id: 'scalespace', ch: '4', num: '4.4.1', title: '스케일 공간', src: '4강 p.27–31 · 알고리즘 4-2, 식 (4.17), 그림 4-12~4-15',
    blurb: '스케일 축 t를 더한 3차원 공간 (y,x,t). 정규 라플라시안이 극점을 만드는 σ가 곧 물체의 스케일.',
    mount(root, m) {
      APP.scaffold(root, m, {
        lead: '카메라가 멀어지면 물체가 작아지고 세부가 사라집니다(그림 4-12). 크기가 고정된 연산자로는 이를 따라갈 수 없으므로, 영상을 여러 스케일로 만든 <b>스케일 공간 (y, x, t)</b>에서 <b>3차원 극점</b>을 찾습니다(알고리즘 4-2). 스케일 축을 따라 <b>정규 라플라시안</b>을 재면 물체 크기에 맞는 σ에서 극점이 생깁니다. σ²를 곱하는 “정규화”가 없으면 값이 σ에 따라 계속 줄어들기만 해서 극점이 생기지 않습니다.',
        formulas: [[R`$$\nabla^2_{norm}f=\sigma^2\,\big|\,d_{yy}(\sigma)+d_{xx}(\sigma)\,\big|$$`, '식 (4.17)'], [R`$$\text{반지름 } r \text{ 인 원판의 중심: } \sigma^2\nabla^2 \propto \tfrac{r^2}{\sigma^2}e^{-r^2/2\sigma^2}\ \Rightarrow\ \sigma^\ast=\tfrac{r}{\sqrt2}$$`, '극점 위치 (원판 모델)']],
      });
      // (1) the two ways to build multi-scale images
      const strip = h('div', { class: 'row' });
      function multi() {
        const g = pk.gray(), cells = [];
        for (const s of [0, 1, 2, 3, 10]) { const v = UI.FeatView({ width: 170 }); v.draw(s ? CV.gaussianBlur(g, s) : g, 'gray', { width: 170 }); v.setCaption(s ? `σ=${s}` : '원래 영상'); cells.push(v.el); }
        const row2 = []; let p = g;
        for (let k = 0; k < 5; k++) { const v = UI.FeatView({ width: 170 / 2 ** k }); v.draw(p, 'gray', { width: 170 / 2 ** k }); v.setCaption(`${p[0].length}×${p.length}`); row2.push(v.el); p = CV.pyramidDown(p); }
        strip.replaceChildren(h('div', { class: 'col' }, h('span', { class: 'caption' }, '(a) 가우시안 스무딩 — σ가 연속값, 크기 그대로 (그림 4-14의 σ=1, 2, 3, 10)'), h('div', { class: 'row', style: { gap: '8px' } }, ...cells)),
          h('div', { class: 'col' }, h('span', { class: 'caption' }, '(b) 피라미드 — ½씩 줄어 스케일이 이산적'), h('div', { class: 'row', style: { gap: '8px', alignItems: 'flex-end' } }, ...row2)));
      }
      const pk = UI.figPicker('whale', () => multi());
      // Fig 4-12: the mountain photo shrunk, peak region compared
      let shrink = 10;
      const mtn = UI.SCENES.mtn[1]().gray, ivBig = UI.FeatView({ width: 340 }), ivSmall = UI.FeatView({ width: 340 }), ivZa = UI.FeatView({ width: 160 }), ivZb = UI.FeatView({ width: 160 });
      const PEAK = [14, 92];   // summit (y, x) in the 170×137 photo
      function mountain() {
        const H = mtn.length, W = mtn[0].length, h2 = Math.max(4, Math.round(H / shrink)), w2 = Math.max(4, Math.round(W / shrink));
        const small = CV.zeros(h2, w2);
        for (let y = 0; y < h2; y++) for (let x = 0; x < w2; x++) { let s2 = 0, n = 0; for (let j = Math.floor(y * H / h2); j < Math.floor((y + 1) * H / h2); j++) for (let i = Math.floor(x * W / w2); i < Math.floor((x + 1) * W / w2); i++) { s2 += mtn[j][i]; n++; } small[y][x] = s2 / n; }
        const r = 12, crop = (img, cy, cx, rr) => Array.from({ length: 2 * rr + 1 }, (_, j) => Array.from({ length: 2 * rr + 1 }, (_, i) => img[CV.clamp(cy - rr + j, 0, img.length - 1)][CV.clamp(cx - rr + i, 0, img[0].length - 1)]));
        const sy = Math.round(PEAK[0] * h2 / H), sx = Math.round(PEAK[1] * w2 / W), rs = Math.max(1, Math.round(r * h2 / H));
        ivBig.draw(mtn, 'gray', { width: 340, marks: [{ y: PEAK[0], x: PEAK[1], r, color: '--bad', w: 2 }] }); ivBig.setCaption(`원래 영상 ${W}×${H}`);
        ivSmall.draw(small, 'gray', { width: Math.max(40, 340 / shrink), marks: [{ y: sy, x: sx, r: rs, color: '--bad', w: 2 }] }); ivSmall.setCaption(`1/${shrink} 축소 ${w2}×${h2}`);
        ivZa.draw(crop(mtn, PEAK[0] + 6, PEAK[1], r), 'gray', { width: 160 }); ivZa.setCaption('원래 영상의 산꼭대기');
        ivZb.draw(crop(small, sy + Math.round(6 * h2 / H), sx, rs + 1), 'gray', { width: 160 }); ivZb.setCaption('축소 영상의 산꼭대기');
      }
      // (2) Fig 4-15 experiment with two discs
      let r1 = 5, r2 = 8, norm = true, sigNow = 3;
      const cvs = h('canvas'), ivL = UI.FeatView({ width: 380 }), ivO = UI.FeatView({ width: 380 }), msg = h('p', { class: 'caption' });
      const scene = () => { const f = CV.zeros(48, 96, 0); for (let y = 0; y < 48; y++) for (let x = 0; x < 96; x++) if ((y - 24) ** 2 + (x - 28) ** 2 <= r1 * r1 || (y - 24) ** 2 + (x - 70) ** 2 <= r2 * r2) f[y][x] = 1; return f; };
      function curve() {
        const f = scene(), S = []; for (let s = 1; s <= 10.001; s += 0.25) S.push(+s.toFixed(2));
        const v1 = S.map(s => CV.normLapAt(f, 24, 28, s) / (norm ? 1 : s * s)), v2 = S.map(s => CV.normLapAt(f, 24, 70, s) / (norm ? 1 : s * s));
        const top = Math.max(...v1, ...v2) * 1.1 || 1, arg = v => S[v.indexOf(Math.max(...v))];
        const p1 = arg(v1), p2 = arg(v2);
        UI.plot(cvs, { w: 520, h: 230, x: [1, 10], y: [0, top], series: [{ data: S.map((s, i) => [s, v1[i]]), color: '--neg' }, { data: S.map((s, i) => [s, v2[i]]), color: '--orange' }], vlines: norm ? [{ x: p1, color: '--neg', dash: [4, 3], label: `σ=${p1}` }, { x: p2, color: '--orange', dash: [4, 3], label: `σ=${p2}` }, { x: sigNow, color: '--faint', w: 1 }] : [{ x: sigNow, color: '--faint', w: 1 }], legend: [[`작은 원 r=${r1}`, '--neg'], [`큰 원 r=${r2}`, '--orange']], xfmt: v => 'σ ' + v });
        msg.innerHTML = norm ? `극점: 작은 원 σ=<b>${p1}</b> (이론 r/√2 = ${(r1 / Math.SQRT2).toFixed(2)}), 큰 원 σ=<b>${p2}</b> (이론 ${(r2 / Math.SQRT2).toFixed(2)}). 원이 클수록 극점의 σ도 커집니다 → <b>극점의 σ가 물체의 스케일</b>. 두 원의 극점 높이가 거의 같은 것도 정규화 덕분입니다.` : 'σ²를 곱하지 않으면 σ가 커질수록 스무딩 때문에 값이 계속 작아져 큰 물체에 맞는 극점이 사라집니다. 스케일끼리 공정하게 비교하려면 σ²를 곱해야 합니다.';
        const L = CV.normLap(f, sigNow);
        ivO.draw(f, 'gray', { width: 380, marks: [{ y: 24, x: 28, r: p1 * Math.SQRT2, color: '--neg' }, { y: 24, x: 70, r: p2 * Math.SQRT2, color: '--orange' }] }); ivO.setCaption('원래 영상 + 극점 σ로 그린 원 (반지름 √2σ)');
        ivL.draw(L, 'abs', { width: 380 }); ivL.setCaption(`σ=${sigNow}에서 정규 라플라시안 영상 (그림 4-15(b) 한 장)`);
      }
      root.append(
        h('div', { class: 'card', style: { marginBottom: '16px' } }, h('h3', {}, '거리에 따른 스케일 변화', h('small', {}, '그림 4-12')),
          h('div', { class: 'controls' }, UI.slider({ label: '축소 비율 1/', min: 2, max: 12, step: 1, value: shrink, id: 'ss-k', oninput: v => { shrink = v; mountain(); } })),
          h('div', { class: 'row', style: { marginTop: '10px', alignItems: 'flex-end' } }, ivBig.el, ivSmall.el, h('div', { class: 'col' }, h('div', { class: 'row', style: { gap: '8px' } }, ivZa.el, ivZb.el))),
          h('p', { class: 'caption' }, '멀리서 찍으면(축소) 산꼭대기가 몇 화소짜리 덩어리로 줄어 세부 무늬가 사라집니다. 같은 산꼭대기를 잡으려면 원래 영상에서는 큰 연산자(빨간 원), 축소 영상에서는 작은 연산자가 필요합니다. 사람은 이를 강인하게 처리하는데, 컴퓨터 비전은 스케일 공간으로 대처합니다.')),
        h('div', { class: 'card' }, h('h3', {}, '다중 스케일 영상을 만드는 두 방법', h('small', {}, '그림 4-13')), h('div', { class: 'controls' }, pk.el), h('div', { style: { marginTop: '10px' } }, strip)),
        h('div', { class: 'card', style: { marginTop: '16px' } }, h('h3', {}, 't 축에서 지역 극점 찾기', h('small', {}, '그림 4-15 실험')),
          h('div', { class: 'controls' }, UI.slider({ label: '작은 원 r', min: 2, max: 9, step: 1, value: r1, id: 'ss-r1', oninput: v => { r1 = v; curve(); } }), UI.slider({ label: '큰 원 r', min: 4, max: 14, step: 1, value: r2, id: 'ss-r2', oninput: v => { r2 = v; curve(); } }),
            UI.segmented([[true, 'σ² 곱함 (정규)'], [false, 'σ² 안 곱함']], true, v => { norm = v; curve(); }), UI.slider({ label: '보는 σ', min: 1, max: 10, step: 0.5, value: sigNow, id: 'ss-s', fmt: v => v.toFixed(1), oninput: v => { sigNow = v; curve(); } })),
          h('div', { class: 'row', style: { marginTop: '10px' } }, h('div', { class: 'col', style: { flex: '1 1 480px' } }, cvs, msg), h('div', { class: 'col', style: { flex: '1 1 340px' } }, ivO.el, ivL.el))),
        h('div', { class: 'card', style: { marginTop: '16px' } }, h('h3', {}, '알고리즘 4-2 다중 스케일 접근 방법'),
          h('pre', { class: 'code', style: { margin: 0 } }, '1  f에서 다중 스케일 영상 M = {f^s0, f^s1, f^s2, …}를 구성한다.   // f^si는 스케일이 si인 영상\n2  M에서 3차원 극점을 찾아 특징점 집합 F로 취한다.             // 극점 (y,x,s)는 스케일 불변이어야 함'),
          h('p', { class: 'caption' }, '여기서 극점은 지역 최대 또는 최소점입니다. (y, x)뿐 아니라 이웃 스케일과도 비교합니다 — 4.4.2는 공간과 스케일을 따로, 4.4.3 SIFT는 26개 이웃과 한꺼번에 비교합니다.')));
      mountain(); multi(); curve();
    },
  });

  // ================= 4.4.2 Harris-Laplace =================
  APP.mod({
    id: 'harlap', ch: '4', num: '4.4.2', title: '해리스 라플라스', src: '4강 p.32–33 · 식 (4.18)(4.19), 알고리즘 4-3', star: true,
    blurb: '공간에서는 다중 스케일 해리스, 스케일 축에서는 정규 라플라시안. 극점을 반복해서 다듬기.',
    mount(root, m) {
      APP.scaffold(root, m, {
        lead: '(y, x, t) 3차원에서 극점을 찾는 해리스 라플라스의 전략: <b>영상 공간에서는 해리스</b>(위치를 잘 찾음), <b>스케일 축에서는 정규 라플라시안</b>(스케일을 잘 찾음)을 씁니다. 단계 1에서 σ<sub>n</sub> = ξ<sup>n</sup>σ<sub>0</sub>마다 다중 스케일 해리스 맵의 지역 최대를 모으고, 단계 2에서 각 점마다 [0.7σ, 1.4σ] 구간의 정규 라플라시안 극점으로 스케일을 고친 뒤 그 스케일에서 위치를 다시 찾기를 <b>수렴할 때까지</b> 반복합니다.',
        formulas: [
          [R`$$\mathbf{A}_{scale\_space}=\sigma_D^2\,G(\sigma_I)\circledast\begin{pmatrix}d_y^2(\sigma_D)&d_y(\sigma_D)d_x(\sigma_D)\\d_y(\sigma_D)d_x(\sigma_D)&d_x^2(\sigma_D)\end{pmatrix}=\begin{pmatrix}p&r\\r&q\end{pmatrix}$$`, '식 (4.18)'],
          [R`$$C=(pq-r^2)-k(p+q)^2$$`, '식 (4.19)'],
        ],
      });
      let xi = 1.4, s = 0.7, s0 = 1.0, N = 6, thr = 0.05, frame = null, data = null;
      const CODE = [
        'F_temp = ∅;',
        'for(n=0 to N) {   // 단계 1: 스케일 공간에서 지역 극점 수집하기',
        '  σn = ξⁿ·σ0;',
        '  σI = σn;  σD = s·σn;',
        '  식 (4.19)를 이용하여 특징 가능성 맵을 계산한다.',
        '  맵에서 지역 극점 (y,x)를 구하고, (y,x,σI)를 F_temp에 추가한다.',
        '}',
        '// 단계 2: 스케일 선택 (극점 미세 조정)',
        'F = ∅;',
        'for(F_temp의 특징점 e=(y,x,σ) 각각에 대해)',
        '  while(true) {',
        '    [0.7σ, 1.4σ] 구간에서 정규 라플라시안의 지역 극점 σnew를 찾는다.',
        '    if(못 찾음) {e를 버린다; break;}',
        '    else σnew에 대해 (y,x) 주위에서 새로운 극점 (ynew,xnew)를 찾는다.',
        '    if((y,x,σ)=(ynew,xnew,σnew)) {F = F∪(y,x,σ); break;}  // 수렴',
        '    else (y,x,σ) = (ynew,xnew,σnew);   // 새로 찾은 것으로 반복',
        '  }',
      ];
      const st = UI.Stepper({ code: CODE, title: '알고리즘 4-3 해리스 라플라스', render: fr => { frame = fr; draw(); } });
      const iv = UI.FeatView({ width: 520 }), ivM = UI.FeatView({ width: 330 }), cvs = h('canvas'), sumBox = h('div');
      function compute() {
        const f = blobScene(), maps = [], Ftemp = [];
        const sig = Array.from({ length: N + 1 }, (_, n) => s0 * xi ** n);
        const lapCache = new Map(), lapAt = (y, x, sg) => { const key = `${y},${x},${sg.toFixed(3)}`; if (!lapCache.has(key)) lapCache.set(key, CV.normLapAt(f, y, x, sg)); return lapCache.get(key); };
        sig.forEach((sn, n) => {
          const C = CV.harrisScale(f, sn, s * sn), mx = Math.max(...C.flat());
          const pts = CV.localMax(C, thr * mx, 8);
          maps.push({ n, sn, C, pts });
          pts.forEach(([y, x]) => Ftemp.push({ y, x, sg: sn, n }));
        });
        // stage 2
        const F = [], trace = [];
        const lapMap = new Map(), harrisAt = sn => { const k = sn.toFixed(3); if (!lapMap.has(k)) lapMap.set(k, CV.harrisScale(f, sn, s * sn)); return lapMap.get(k); };
        for (const e of Ftemp) {
          let { y, x, sg } = e; const steps = [];
          for (let it = 0; it < 8; it++) {
            const S = []; for (let t = 0.7; t <= 1.401; t += 0.1) S.push(sg * t);
            const L = S.map(v => lapAt(y, x, v));
            let best = -1; for (let k = 1; k < S.length - 1; k++) if (L[k] > L[k - 1] && L[k] > L[k + 1] && (best < 0 || L[k] > L[best])) best = k;
            if (best < 0) { steps.push({ y, x, sg, S, L, fail: true }); break; }
            const sn = S[best], C = harrisAt(sn);
            let ny = y, nx = x, bv = -Infinity;
            for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const yy = y + j, xx = x + i; if (CV.inside(C, yy, xx) && C[yy][xx] > bv) { bv = C[yy][xx]; ny = yy; nx = xx; } }
            const conv = ny === y && nx === x && Math.abs(sn - sg) < 1e-9;
            steps.push({ y, x, sg, S, L, best, sn, ny, nx, conv });
            if (conv) { F.push({ y, x, sg }); break; }
            y = ny; x = nx; sg = sn;
          }
          trace.push({ e, steps });
        }
        // merge duplicates converging to the same (y,x,σ)
        const uniq = []; for (const p of F) if (!uniq.some(q => Math.abs(q.y - p.y) <= 1 && Math.abs(q.x - p.x) <= 1 && Math.abs(q.sg - p.sg) < 0.2 * p.sg)) uniq.push(p);
        data = { f, sig, maps, Ftemp, F: uniq, trace };
        const fr = [{ line: 1, phase: 1, note: `ξ=${xi}, s=${s}, σ0=${s0}, N=${N} — 원과 사각형의 크기가 서로 다른 합성 영상입니다.`, vars: { ξ: xi, s, σ0: s0, N } }];
        maps.forEach(mp => fr.push({ line: [3, 4, 5, 6], phase: 1, n: mp.n, vars: { n: mp.n, σn: +mp.sn.toFixed(3), σI: +mp.sn.toFixed(3), σD: +(s * mp.sn).toFixed(3), '극점 수': mp.pts.length, '|F_temp|': maps.slice(0, mp.n + 1).reduce((a, b) => a + b.pts.length, 0) }, note: `σ<sub>I</sub>=${mp.sn.toFixed(2)}, σ<sub>D</sub>=${(s * mp.sn).toFixed(2)}에서 해리스 맵의 지역 최대 ${mp.pts.length}개를 F_temp에 넣습니다. σ가 커질수록 작은 구조는 사라지고 큰 구조의 점이 남습니다.` }));
        fr.push({ line: [8, 9], phase: 2, note: `F_temp에 ${Ftemp.length}개 — 같은 코너가 여러 스케일에서 중복으로 잡혀 있습니다. 이제 각 점의 스케일을 정규 라플라시안으로 고릅니다.`, vars: { '|F_temp|': Ftemp.length } });
        const shown = trace.slice(0, 40);
        shown.forEach((t, ti) => t.steps.forEach((sp, si) => fr.push({ line: sp.fail ? [12, 13] : sp.conv ? [12, 14, 15] : [12, 14, 16], phase: 2, ti, si, sp, vars: { e: `#${ti + 1}`, '반복': si + 1, '(y,x)': `(${sp.y},${sp.x})`, σ: +sp.sg.toFixed(3), σnew: sp.fail ? '-' : +sp.sn.toFixed(3), '(ynew,xnew)': sp.fail ? '-' : `(${sp.ny},${sp.nx})` }, note: sp.fail ? `[0.7σ, 1.4σ] = [${(0.7 * sp.sg).toFixed(2)}, ${(1.4 * sp.sg).toFixed(2)}] 안에 정규 라플라시안 극점이 없음 → <b>버림</b> (스케일이 정해지지 않는 점)` : sp.conv ? `σnew = ${sp.sn.toFixed(2)}, 위치도 그대로 → <b>수렴, F에 추가</b>` : `σ ${sp.sg.toFixed(2)} → ${sp.sn.toFixed(2)}, 위치 (${sp.y},${sp.x}) → (${sp.ny},${sp.nx})로 옮겨 반복` })));
        fr.push({ line: 17, phase: 3, vars: { '|F_temp|': Ftemp.length, '|F| (중복 합침)': uniq.length }, note: `최종 특징점 ${uniq.length}개 (같은 곳으로 수렴한 중복은 합침). 원 반지름을 √2σ로 그렸습니다 — 물체 크기를 따라 원 크기가 달라집니다. ${trace.length > 40 ? `(단계 실행은 처음 40개 점만 보여 줍니다)` : ''}` });
        st.load(fr, 0);
        sumBox.replaceChildren(UI.dataTable(['n', 'σI', 'σD', '지역 최대'], maps.map(mp => [mp.n, mp.sn.toFixed(2), (s * mp.sn).toFixed(2), mp.pts.length])));
      }
      function draw() {
        if (!data || !frame) return;
        const { f, maps, Ftemp, F, trace } = data;
        let marks = [];
        if (frame.phase === 1 && frame.n !== undefined) {
          const mp = maps[frame.n];
          marks = maps.slice(0, frame.n).flatMap(q => q.pts.map(([y, x]) => ({ kind: 'dot', y, x, size: 2, color: '--faint' }))).concat(mp.pts.map(([y, x]) => ({ y, x, r: mp.sn * Math.SQRT2, color: '--orange', w: 1.5 })));
          ivM.draw(mp.C, 'norm', { width: 330, marks: mp.pts.map(([y, x]) => ({ kind: 'dot', y, x, size: 2.5, color: '--orange' })) }); ivM.setCaption(`σI=${mp.sn.toFixed(2)}의 해리스 맵`);
        } else if (frame.phase === 2 && frame.sp) {
          const sp = frame.sp;
          marks = Ftemp.map(e => ({ kind: 'dot', y: e.y, x: e.x, size: 1.6, color: '--faint' })).concat([{ y: sp.y, x: sp.x, r: sp.sg * Math.SQRT2, color: '--neg', w: 2 }], sp.fail ? [] : [{ y: sp.ny, x: sp.nx, r: sp.sn * Math.SQRT2, color: '--orange', w: 2 }]);
          UI.plot(cvs, { w: 330, h: 170, x: [sp.S[0], sp.S[sp.S.length - 1]], y: [0, Math.max(...sp.L) * 1.15 || 1], series: [{ data: sp.S.map((v, i) => [v, sp.L[i]]), color: '--neg', type: 'line' }, { data: sp.S.map((v, i) => [v, sp.L[i]]), color: '--neg', type: 'points' }], vlines: sp.fail ? [] : [{ x: sp.sn, color: '--orange', label: 'σnew' }], xfmt: v => v.toFixed(1) });
        } else {
          marks = (frame.phase === 3 ? F : []).map(p => ({ y: p.y, x: p.x, r: p.sg * Math.SQRT2, color: '--orange', w: 2 }));
        }
        iv.draw(f, 'gray', { marks }); iv.setCaption(frame.phase === 2 ? '파랑: 현재 (y,x,σ) · 주황: 새 (ynew,xnew,σnew)' : frame.phase === 3 ? '최종 특징점 (원 = √2σ)' : '주황: 이번 스케일의 지역 최대 · 회색: 이전 스케일'); iv.setInfo(frame.phase === 3 ? `${F.length}개` : '');
        cvs.hidden = frame.phase !== 2; ivM.el.hidden = !(frame.phase === 1 && frame.n !== undefined);
      }
      root.append(h('div', { class: 'lab' },
        h('div', { class: 'stack' },
          h('div', { class: 'card' }, h('div', { class: 'controls' }, UI.slider({ label: 'ξ', min: 1.2, max: 1.6, step: 0.05, value: xi, id: 'hl-xi', fmt: v => v.toFixed(2), oninput: v => { xi = v; compute(); } }), UI.slider({ label: 's', min: 0.5, max: 1, step: 0.05, value: s, id: 'hl-s', fmt: v => v.toFixed(2), oninput: v => { s = v; compute(); } }), UI.slider({ label: 'N', min: 3, max: 7, step: 1, value: N, id: 'hl-n', oninput: v => { N = v; compute(); } }), UI.slider({ label: '해리스 임계값 (×max)', min: 0.01, max: 0.3, step: 0.01, value: thr, id: 'hl-t', fmt: v => v.toFixed(2), oninput: v => { thr = v; compute(); } })),
            h('div', { class: 'row', style: { marginTop: '10px' } }, h('div', { class: 'col', style: { flex: '1 1 420px' } }, iv.el), h('div', { class: 'col', style: { flex: '1 1 300px' } }, ivM.el, h('div', {}, h('span', { class: 'caption' }, '[0.7σ, 1.4σ]에서 정규 라플라시안'), cvs)))),
          h('div', { class: 'card' }, h('h3', {}, '단계 1 요약'), sumBox, h('p', { class: 'caption' }, '교재 기본값은 ξ=1.4, s=0.7. σD는 미분할 때, σI는 미분 곱을 모을 때(적분) 쓰는 스케일입니다. σD² 곱은 정규 라플라시안의 σ²와 같은 이유(스케일 사이 공정한 비교)입니다.'))),
        h('div', { class: 'stack' }, st.panel)));
      compute();
    },
  });

  // ================= 4.4.3 SIFT =================
  APP.mod({
    id: 'sift', ch: '4', num: '4.4.3', title: 'SIFT 검출', src: '4강 p.34–38 · 식 (4.20)(4.21), 그림 4-16·4-17', star: true,
    blurb: '피라미드+가우시안 옥타브 → DOG 다섯 장 → 가운데 세 장에서 26-이웃 극점 = 키포인트.',
    mount(root, m) {
      APP.scaffold(root, m, {
        lead: 'SIFT(Lowe 1999, 2004)는 <b>피라미드와 가우시안을 합친</b> 스케일 공간을 씁니다. 한 옥타브는 σ<sub>i+1</sub> = kσ<sub>i</sub> (σ<sub>0</sub>=1.6, k=2<sup>1/3</sup>)로 스무딩한 <b>여섯 장</b>, 이웃끼리 뺀 <b>DOG 다섯 장</b>으로 이루어지고, σ=3.2 영상을 반으로 줄여 다음 옥타브를 시작합니다. DOG는 정규 라플라시안과 거의 같은 모양이지만 <b>뺄셈만</b> 하므로 매우 빠릅니다. 가운데 세 장의 DOG에서 <b>26개 이웃</b>보다 크거나 작은 점이 키포인트입니다.',
        formulas: [
          [R`$$DOG(\sigma_i)=G(\sigma_{i+1})\circledast f-G(\sigma_i)\circledast f=\big(G(k\sigma_i)-G(\sigma_i)\big)\circledast f$$`, '식 (4.20)'],
          [R`$$(y,x)=(y'\times2^{o},\ x'\times2^{o}),\qquad s=1.6\times2^{\frac{o+i'}{3}}$$`, '식 (4.21)'],
        ],
      });
      let nOct = 2, thr = 0.03, edge = false, sel = 0, frame = null, P = null, K = null, T = 0;
      const pyr = h('div'), iv = UI.FeatView({ width: 560, onClick: (y, x) => { if (!K.length) return; let b = 0, bd = Infinity; K.forEach((k, i) => { const d = (k.Y - y) ** 2 + (k.X - x) ** 2; if (d < bd) { bd = d; b = i; } }); sel = b; kpSel.value = String(b); steps(); } });
      const kpSel = h('select', { 'aria-label': '키포인트' }); kpSel.addEventListener('change', () => { sel = +kpSel.value; steps(); });
      const CODE = [
        'for(o = 각 옥타브) for(i = 1 to 3) {      // 가운데 세 장의 DOG',
        '  for(각 화소 (y,x)) {',
        '    c = DOG_i(y,x);',
        '    for(n = DOG_{i-1}, DOG_i, DOG_{i+1}의 3×3 이웃 26개)',
        '      c > n 인가?  c < n 인가?',
        '    if(c가 26개 모두보다 크거나 모두보다 작음)',
        '      키포인트 <y,x,o,i> 추가;',
        '  }',
        '}',
        '(y,x) = (y·2^o, x·2^o);  s = 1.6×2^((o+i)/3);   // 식 (4.21)',
      ];
      const st = UI.Stepper({ code: CODE, title: '그림 4-17 키포인트 검출', render: fr => { frame = fr; draw(); } });
      const grids = [-1, 0, 1].map(d => UI.GridView({ rows: 3, cols: 3, cs: 50, fs: 10, axes: false, label: `DOG ${d}`, cell: (y, x) => {
        if (!frame || !frame.vals) return {};
        const v = frame.vals[d + 1][y][x], s = { t: v.toFixed(2), ...APP.signedCell(v, frame.amax) };
        if (d === 0 && y === 1 && x === 1) { s.t = 'X ' + v.toFixed(1); s.cls = 'cur'; return s; }
        const k = (d + 1) * 9 + y * 3 + x, idx = frame.order.indexOf(k);
        if (idx >= 0 && idx < frame.done) s.badge = frame.cmp[idx]; if (idx === frame.done - 1) s.cls = 'win';
        return s;
      } }));
      function compute() {
        let t; [P, t] = ms(() => CV.siftPyramid(pk.gray(), nOct));
        let t2; [K, t2] = ms(() => CV.siftKeypoints(P, thr * 255, edge ? 10 : 0)); T = t + t2;
        pyr.replaceChildren(...P.map(O => h('div', { class: 'col', style: { marginBottom: '10px' } }, h('span', { class: 'caption' }, `옥타브 ${O.o} — ${O.gauss[0][0].length}×${O.gauss[0].length}` + (O.o ? ' (옥타브 ' + (O.o - 1) + '의 σ=3.2 영상을 다운샘플링)' : '')),
          h('div', { class: 'row', style: { gap: '6px' } }, ...O.gauss.map((g, i) => { const v = UI.FeatView({ width: 120 }); v.draw(g, 'gray', { width: 120 }); v.setCaption('σ ' + SIG4[i].toFixed(4)); return v.el; })),
          h('div', { class: 'row', style: { gap: '6px', paddingLeft: '63px' } }, ...O.dog.map((d, i) => { const v = UI.FeatView({ width: 120 }); v.draw(d, 'signed', { width: 120 }); v.setCaption(`DOG ${i}${i >= 1 && i <= 3 ? ' ●' : ''}`); return v.el; })))),
        h('p', { class: 'caption' }, '● 표시한 가운데 세 장(DOG 1~3)에서만 극점을 찾습니다. 맨 위·맨 아래 DOG는 위나 아래 이웃이 없기 때문입니다. 옥타브가 바뀌면 σ 숫자는 그대로지만 영상이 절반이라 실제 스케일은 두 배입니다.'));
        kpSel.replaceChildren(...K.map((k, i) => h('option', { value: String(i) }, `#${i + 1} o=${k.o} i=${k.i} (${k.y},${k.x}) ${k.type > 0 ? '최대' : '최소'}`)));
        sel = Math.min(sel, Math.max(0, K.length - 1)); kpSel.value = String(sel);
        steps();
      }
      function steps() {
        const fr = [];
        const k = K[sel];
        if (!k) { st.load([{ line: 1, note: '키포인트가 없습니다. 대비 임계값을 낮춰 보세요.' }]); return; }
        const D = P[k.o].dog, vals = [-1, 0, 1].map(d => [-1, 0, 1].map(j => [-1, 0, 1].map(a => D[k.i + d][k.y + j][k.x + a])));
        const amax = Math.max(...vals.flat(2).map(Math.abs)), c = vals[1][1][1];
        const order = []; for (let d = 0; d < 3; d++) for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) if (!(d === 1 && y === 1 && x === 1)) order.push(d * 9 + y * 3 + x);
        const cmp = order.map(q => { const v = vals[Math.floor(q / 9)][Math.floor(q % 9 / 3)][q % 3]; return c > v ? '<' : c < v ? '>' : '='; });
        const base = { vals, amax, order, cmp };
        fr.push({ ...base, done: 0, line: [1, 2, 3], vars: { o: k.o, i: k.i, y: k.y, x: k.x, c: +c.toFixed(3) }, note: `옥타브 ${k.o}의 DOG ${k.i}, 화소 (${k.y}, ${k.x}): c = ${c.toFixed(3)}. 위(DOG ${k.i + 1})·같은 층·아래(DOG ${k.i - 1})의 3×3에서 자신을 뺀 26개와 비교합니다.` });
        let gt = 0, lt = 0;
        order.forEach((q, n) => {
          const d = Math.floor(q / 9), v = vals[d][Math.floor(q % 9 / 3)][q % 3];
          if (c > v) gt++; else if (c < v) lt++;
          fr.push({ ...base, done: n + 1, line: [4, 5], vars: { '비교': `${n + 1}/26`, n: +v.toFixed(3), 'c보다 작은 이웃': gt, 'c보다 큰 이웃': lt }, note: `${['아래 DOG', '같은 DOG', '위 DOG'][d]}의 이웃 ${v.toFixed(3)}: c ${c > v ? '>' : c < v ? '<' : '='} n` });
        });
        fr.push({ ...base, done: 26, line: [6, 7], vars: { 'c보다 작은 이웃': gt, 'c보다 큰 이웃': lt, 결과: gt === 26 ? '최대' : lt === 26 ? '최소' : '아님' }, note: gt === 26 ? '26개 모두보다 큼 → <b>지역 최대, 키포인트</b>' : lt === 26 ? '26개 모두보다 작음 → <b>지역 최소, 키포인트</b> (DOG는 어두운 블롭에서 최대, 밝은 블롭에서 최소)' : '극점이 아님' });
        fr.push({ ...base, done: 26, line: 10, vars: { "y'": k.y, "x'": k.x, o: k.o, "i'": k.i, y: k.Y, x: k.X, s: +k.s.toFixed(4) }, note: `(y, x) = (${k.y}×2^${k.o}, ${k.x}×2^${k.o}) = (<b>${k.Y}, ${k.X}</b>), s = 1.6×2^((${k.o}+${k.i})/3) = <b>${k.s.toFixed(4)}</b>. 실제 SIFT는 여기서 2차 함수 맞추기로 y′, x′, i′를 부분 화소까지 다듬지만 이 실습에서는 생략했습니다.` });
        st.load(fr, 0);
      }
      function draw() {
        grids.forEach(g => g.draw());
        iv.draw(pk.gray(), 'gray', { marks: K.map((k, i) => ({ y: k.Y, x: k.X, r: k.s * Math.SQRT2, color: i === sel ? '--neg' : k.type > 0 ? '--orange' : '--ok', w: i === sel ? 2.5 : 1.3 })) });
        iv.setCaption('키포인트 (원 반지름 √2·s) — 주황: DOG 최대, 초록: DOG 최소, 파랑: 선택. 클릭하면 가까운 키포인트 선택'); iv.setInfo(`${K.length}개 · ${T.toFixed(0)} ms`);
      }
      const pk = UI.figPicker('whale', () => compute());
      // DOG vs normalised Laplacian (Eq. 4.20)
      let kk = Math.pow(2, 1 / 3);
      const dcv = h('canvas');
      function dogPlot() {
        const s = 1, xs = []; for (let x = -5; x <= 5.001; x += 0.05) xs.push(x);
        const g = (x, sg) => Math.exp(-x * x / (2 * sg * sg)) / (Math.sqrt(2 * Math.PI) * sg);
        const dog = xs.map(x => g(x, s) - g(x, kk * s)), lap = xs.map(x => -(kk - 1) * s * s * ((x * x - s * s) / s ** 4) * g(x, s));
        const sc = Math.max(...dog.map(Math.abs)), sc2 = Math.max(...lap.map(Math.abs));
        UI.plot(dcv, { w: 440, h: 200, x: [-5, 5], y: [-0.6, 1.05], series: [{ data: xs.map((x, i) => [x, lap[i] / sc2]), color: '--bad', width: 3 }, { data: xs.map((x, i) => [x, dog[i] / sc]), color: '--neg' }], legend: [['DOG', '--neg'], ['−정규 라플라시안', '--bad']] });
      }
      root.append(h('div', { class: 'lab wide-code' },
        h('div', { class: 'stack' },
          h('div', { class: 'card' }, h('div', { class: 'controls' }, pk.el, UI.slider({ label: '옥타브 수', min: 1, max: 3, step: 1, value: nOct, id: 'sf-o', oninput: v => { nOct = v; compute(); } }), UI.slider({ label: '대비 임계값 |DOG|', min: 0, max: 0.1, step: 0.005, value: thr, id: 'sf-t', fmt: v => v.toFixed(3), oninput: v => { thr = v; compute(); } }),
            h('span', { class: 'ctl' }, (() => { const c = h('input', { type: 'checkbox', id: 'sf-e' }); c.addEventListener('change', () => { edge = c.checked; compute(); }); return c; })(), h('label', { for: 'sf-e' }, '에지 응답 제거 (r=10, Lowe 2004)'))),
            h('div', { style: { marginTop: '10px' } }, iv.el)),
          h('div', { class: 'card' }, h('h3', {}, '선택한 키포인트의 26-이웃', h('small', {}, '그림 4-17 — 배지 <: 이웃이 c보다 작음, >: 큼')), h('div', { class: 'controls' }, UI.labeled('키포인트', kpSel)),
            h('div', { class: 'row', style: { marginTop: '8px' } }, ...grids.map((g, i) => h('div', { class: 'col' }, h('span', { class: 'caption' }, ['(c) DOG(σ_{i−1}) 아래', '(b) DOG(σ_i) — X가 후보', '(a) DOG(σ_{i+1}) 위'][i]), g.el)))),
          h('div', { class: 'card' }, h('h3', {}, 'SIFT의 스케일 공간', h('small', {}, '그림 4-16')), pyr),
          h('div', { class: 'card' }, h('h3', {}, 'DOG ≈ 정규 라플라시안', h('small', {}, '식 (4.20)')), h('div', { class: 'controls' }, UI.slider({ label: 'k', min: 1.05, max: 2, step: 0.05, value: kk, id: 'sf-k', fmt: v => v.toFixed(2), oninput: v => { kk = v; dogPlot(); } })), dcv,
            h('p', { class: 'caption' }, 'G(kσ) − G(σ) ≈ (k−1)σ²∇²G 이라서, DOG는 이미 σ²가 곱해진 정규 라플라시안(부호 반대, 상수배)입니다. k가 1에 가까울수록 두 곡선이 겹칩니다. Mikolajczyk(2002)의 실험에서 정규 라플라시안이 가장 안정적으로 극점을 만들었기 때문에, SIFT는 그것을 싸게 근사한 DOG를 씁니다.'),
            h('p', { class: 'caption' }, '공개 소프트웨어: David Lowe, Rob Hess, Andrea Vedaldi(VLFeat), OpenCV.'))),
        h('div', { class: 'stack' }, st.panel)));
      compute(); dogPlot();
    },
  });

  // ================= 4.4.4 SURF =================
  APP.mod({
    id: 'surf', ch: '4', num: '4.4.4', title: 'SURF 검출', src: '4강 p.39–41 · 식 (4.12)(4.22), 그림 4-18·4-19', star: true,
    blurb: '헤시안 행렬식을 박스 마스크로 근사, 적분 영상으로 어떤 크기든 네 번 조회로 계산.',
    mount(root, m) {
      APP.scaffold(root, m, {
        lead: 'SURF는 반복률을 잃지 않고 SIFT보다 빠르기를 목표로, <b>헤시안 행렬식</b>을 씁니다. 가우시안 2차 미분 d<sub>yy</sub>, d<sub>xx</sub>, d<sub>yx</sub>를 <b>상수 값 상자</b>로 근사한 9×9 마스크로 바꾸고(그림 4-18), 상자 합은 <b>적분 영상</b>에서 네 번 조회로 구합니다. 그래서 마스크 크기가 커져도 계산량이 같습니다. SIFT가 영상을 줄여 가며 같은 연산자를 쓰는 것과 반대로, SURF는 <b>영상은 그대로 두고 마스크를 키웁니다</b>.',
        formulas: [
          [R`$$C=\det(\mathbf{H})=d_{yy}(\sigma)d_{xx}(\sigma)-d_{yx}(\sigma)^2$$`, '식 (4.12)'],
          [R`$$d_{yy}(\sigma)=\frac{\partial^2}{\partial y^2}\big(G(\sigma)\circledast f\big)=\Big(\frac{\partial^2}{\partial y^2}G(\sigma)\Big)\circledast f$$`, '식 (4.22)'],
          [R`$$ii(y,x)=\sum_{y'\le y}\sum_{x'\le x}f(y',x'),\quad \sum_{\text{상자}}f=ii(D)-ii(B)-ii(C)+ii(A)$$`, '적분 영상'],
        ],
      });
      // (1) masks
      let L = 9;
      const maskCell = which => (y, x) => { const v = CV.surfMask(L, which)[y][x]; return { t: L <= 15 ? (v || '') : '', bg: v > 0 ? 'var(--cell-bg)' : v < 0 ? 'var(--cell-on)' : 'color-mix(in srgb, var(--faint) 45%, var(--cell-bg))', color: v < 0 ? 'var(--cell-on-ink)' : '' }; };
      const boxYY = h('div'), boxYX = h('div');
      const gauss2 = which => { const s = 1.2, r = 4, M = CV.zeros(9, 9); for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) { const g = Math.exp(-(x * x + y * y) / (2 * s * s)); M[y + r][x + r] = which === 'yy' ? (y * y / s ** 4 - 1 / s ** 2) * g : (x * y / s ** 4) * g; } return M; };
      const ivG1 = UI.FeatView({ width: 180 }), ivG2 = UI.FeatView({ width: 180 });
      function masks() {
        const cs = Math.max(7, Math.floor(200 / L));
        for (const [box2, which] of [[boxYY, 'yy'], [boxYX, 'yx']]) { const g = UI.GridView({ rows: L, cols: L, cs, fs: cs > 14 ? 10 : 8, axes: false, cell: maskCell(which) }); g.draw(); box2.replaceChildren(g.el); }
      }
      // (2) integral image stepper
      const SMALL = APP.parseGrid(`3 1 4 1 5 9
2 6 5 3 5 8
9 7 9 3 2 3
8 4 6 2 6 4
3 3 8 3 2 7
9 5 0 2 8 8`);
      let box = [1, 2, 3, 4], frame = null;
      const CODE = [
        'for(y=0 to M-1) for(x=0 to N-1)    // 적분 영상 만들기 (한 번만)',
        '  ii(y,x) = f(y,x) + ii(y-1,x) + ii(y,x-1) − ii(y-1,x-1);',
        '// 상자 (y0..y1, x0..x1)의 합 — 크기와 무관하게 네 번 조회',
        'D = ii(y1, x1);',
        'B = ii(y0-1, x1);   C = ii(y1, x0-1);',
        'A = ii(y0-1, x0-1);',
        '합 = D − B − C + A;',
      ];
      const st = UI.Stepper({ code: CODE, title: '적분 영상과 상자 합', render: fr => { frame = fr; gS.draw(); gI.draw(); } });
      const inBox = (y, x) => y >= box[0] && y <= box[2] && x >= box[1] && x <= box[3];
      const gS = UI.GridView({ rows: 6, cols: 6, cs: 38, fs: 14, label: 'f', cell: (y, x) => ({ t: SMALL[y][x], cls: (frame && frame.phase === 2 && inBox(y, x) ? 'win' : '') + (frame && frame.phase === 1 && frame.y === y && frame.x === x ? ' cur' : '') }), onClick: (y, x, e) => { SMALL[y][x] = (SMALL[y][x] + (e.shiftKey ? 9 : 1)) % 10; build(); } });
      let II = null;
      const gI = UI.GridView({ rows: 6, cols: 6, cs: 44, fs: 13, label: 'ii', cell: (y, x) => {
        if (!frame) return {};
        const done = frame.phase === 2 || y * 6 + x <= frame.k;
        const s = { t: done ? II[y + 1][x + 1] : '' };
        if (frame.phase === 1 && frame.y === y && frame.x === x) s.cls = 'cur';
        if (frame.phase === 1 && ((frame.y - 1 === y && frame.x === x) || (frame.y === y && frame.x - 1 === x) || (frame.y - 1 === y && frame.x - 1 === x))) s.cls = 'win';
        if (frame.phase === 2 && frame.look) { const L2 = frame.look.find(([yy, xx]) => yy === y && xx === x); if (L2) { s.cls = 'cur'; s.badge = L2[2]; } }
        return s;
      } });
      function build() {
        II = CV.integral(SMALL);
        const fr = [];
        let k = 0;
        for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++, k++) fr.push({ phase: 1, y, x, k, line: [1, 2], vars: { y, x, 'f(y,x)': SMALL[y][x], 'ii(y-1,x)': II[y][x + 1], 'ii(y,x-1)': II[y + 1][x], 'ii(y-1,x-1)': II[y][x], 'ii(y,x)': II[y + 1][x + 1] }, note: `ii(${y},${x}) = ${SMALL[y][x]} + ${II[y][x + 1]} + ${II[y + 1][x]} − ${II[y][x]} = <b>${II[y + 1][x + 1]}</b> — 왼쪽 위 직사각형 전체의 합` });
        const [y0, x0, y1, x1] = box, D = II[y1 + 1][x1 + 1], B = II[y0][x1 + 1], C = II[y1 + 1][x0], A = II[y0][x0];
        const look = [];
        fr.push({ phase: 2, look: [[y1, x1, 'D']], line: 4, vars: { D }, note: `상자 (${y0}..${y1}, ${x0}..${x1}) — 오른쪽 아래 모서리 ii(${y1},${x1}) = ${D}는 상자와 그 위·왼쪽을 모두 포함합니다.` });
        const lk = [[y1, x1, 'D']]; if (y0 > 0) lk.push([y0 - 1, x1, 'B']); if (x0 > 0) lk.push([y1, x0 - 1, 'C']);
        fr.push({ phase: 2, look: lk.slice(), line: 5, vars: { D, B, C }, note: `위쪽 띠 B = ${B}, 왼쪽 띠 C = ${C}를 뺍니다${y0 === 0 || x0 === 0 ? ' (영상 밖이면 0)' : ''}.` });
        if (y0 > 0 && x0 > 0) lk.push([y0 - 1, x0 - 1, 'A']);
        fr.push({ phase: 2, look: lk.slice(), line: 6, vars: { D, B, C, A }, note: `왼쪽 위 A = ${A}는 두 번 빠졌으므로 한 번 더합니다.` });
        let direct = 0; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) direct += SMALL[y][x];
        fr.push({ phase: 2, look: lk.slice(), line: 7, vars: { D, B, C, A, '합': D - B - C + A, '직접 더한 값': direct }, note: `${D} − ${B} − ${C} + ${A} = <b>${D - B - C + A}</b> (직접 더하면 ${direct}). 상자가 9×9든 99×99든 조회는 네 번입니다.` });
        st.load(fr, 'end');
      }
      const boxCtl = ['y0', 'x0', 'y1', 'x1'].map((nm, i) => UI.slider({ label: nm, min: 0, max: 5, step: 1, value: box[i], id: 'sb-' + nm, oninput: v => { box[i] = v; if (box[0] > box[2]) box[2] = box[0]; if (box[1] > box[3]) box[3] = box[1]; boxCtl.forEach((c, j) => c.set(box[j])); build(); } }));
      // (3) detection
      let nOct = 2, thr = 0.02;
      const iv = UI.FeatView({ width: 560 }), oct = h('div'), timing = h('div');
      function detect() {
        const g = pk.gray().map(r => r.map(v => v / 255)), Hh = g.length, Ww = g[0].length;
        const [res, t] = ms(() => {
          const ii = CV.integral(g), kps = [];
          for (let o = 0; o < nOct; o++) {
            const sizes = CV.surfSizes(o), maps = sizes.map(Ls => CV.surfDet(ii, Ls, Hh, Ww));
            const mx = Math.max(...maps.flat(2));
            for (let l = 1; l <= 2; l++) {
              const b = (sizes[l + 1] - 1) / 2 + 1;
              for (let y = b; y < Hh - b; y++) for (let x = b; x < Ww - b; x++) {
                const c = maps[l][y][x]; if (c < thr * mx) continue;
                let ok = true;
                for (let d = -1; d <= 1 && ok; d++) for (let j = -1; j <= 1 && ok; j++) for (let a = -1; a <= 1; a++) if ((d || j || a) && maps[l + d][y + j][x + a] >= c) { ok = false; break; }
                if (ok) kps.push({ y, x, L: sizes[l], s: 1.2 * sizes[l] / 9 });
              }
            }
          }
          return kps;
        });
        const [, tS] = ms(() => CV.siftKeypoints(CV.siftPyramid(pk.gray(), 2), 0.03 * 255));
        iv.draw(pk.gray(), 'gray', { marks: res.map(k => ({ y: k.y, x: k.x, r: k.s * Math.SQRT2, color: '--orange', w: 1.4 })) });
        iv.setCaption('SURF 키포인트 (원 반지름 √2·s, s = 1.2·L/9)'); iv.setInfo(`${res.length}개`);
        timing.replaceChildren(h('dl', { class: 'kv' }, h('dt', {}, 'SURF (이 브라우저)'), h('dd', {}, `${t.toFixed(0)} ms`), h('dt', {}, 'SIFT 2옥타브'), h('dd', {}, `${tS.toFixed(0)} ms`)),
          h('p', { class: 'caption' }, 'Bay(2008) 보고: 800×640 영상에서 SURF 70 ms, SIFT 400 ms, 해리스 라플라스 2100 ms. 여기 숫자는 최적화하지 않은 JavaScript라 절대값은 다르지만, 마스크가 커져도 계산량이 그대로인 SURF가 대체로 빠릅니다.'));
      }
      function octTable() {
        oct.replaceChildren(UI.dataTable(['옥타브', '마스크 크기', '증가폭', '극점을 찾는 층'], [0, 1, 2].map(o => { const s = CV.surfSizes(o); return [o + 1, s.map(v => `${v}×${v}`).join(', '), s[1] - s[0], `${s[1]}, ${s[2]}`]; })),
          h('p', { class: 'caption', html: '다음 옥타브는 이전 옥타브의 두 번째 마스크에서 시작해 증가폭을 두 배로 늘립니다. 극점은 그림 4-17처럼 위·아래 층과 26-이웃 비교로 찾으므로 가운데 두 층에서만 찾습니다. 근사 오차를 보정하려고 원 논문은 det ≈ D<sub>yy</sub>D<sub>xx</sub> − (0.9·D<sub>yx</sub>)²를 쓰며, 이 실습도 0.9를 곱했습니다.' }));
      }
      const pk = UI.figPicker('whale', () => detect());
      const sizeSeg = UI.segmented([[9, '9×9'], [15, '15×15'], [21, '21×21'], [27, '27×27']], 9, v => { L = v; masks(); });
      root.append(h('div', { class: 'lab' },
        h('div', { class: 'stack' },
          h('div', { class: 'card' }, h('h3', {}, '가우시안 2차 미분과 박스 근사', h('small', {}, '그림 4-18 · 4-19 (흰 +, 검정 −, 회색 0)')), h('div', { class: 'controls' }, sizeSeg),
            h('div', { class: 'row', style: { marginTop: '10px' } },
              h('div', { class: 'col' }, h('span', { class: 'caption' }, '(a) d_yy'), ivG1.el), h('div', { class: 'col' }, h('span', { class: 'caption' }, '(b) d_yx'), ivG2.el),
              h('div', { class: 'col' }, h('span', { class: 'caption' }, '(c) D_yy'), boxYY), h('div', { class: 'col' }, h('span', { class: 'caption' }, '(d) D_yx'), boxYX))),
          h('div', { class: 'card' }, h('h3', {}, '적분 영상으로 상자 합 구하기'), h('div', { class: 'controls' }, ...boxCtl),
            h('div', { class: 'row', style: { marginTop: '10px' } }, h('div', { class: 'col' }, h('span', { class: 'caption' }, 'f (클릭 +1) — 음영: 합을 구할 상자'), gS.el), h('div', { class: 'col' }, h('span', { class: 'caption' }, '적분 영상 ii — 배지: 조회하는 A, B, C, D'), gI.el))),
          h('div', { class: 'card' }, h('h3', {}, 'SURF의 스케일 공간', h('small', {}, '옥타브 구성')), oct),
          h('div', { class: 'card' }, h('h3', {}, '실제 영상에서 검출'), h('div', { class: 'controls' }, pk.el, UI.slider({ label: '옥타브 수', min: 1, max: 2, step: 1, value: nOct, id: 'sb-o', oninput: v => { nOct = v; detect(); } }), UI.slider({ label: '임계값 (×max)', min: 0.002, max: 0.2, step: 0.002, value: thr, id: 'sb-t', fmt: v => v.toFixed(3), oninput: v => { thr = v; detect(); } })),
            h('div', { class: 'row', style: { marginTop: '10px' } }, h('div', { class: 'col', style: { flex: '1 1 420px' } }, iv.el), h('div', { class: 'col', style: { flex: '1 1 220px' } }, timing)))),
        h('div', { class: 'stack' }, st.panel)));
      ivG1.draw(gauss2('yy'), 'signed', { width: 180, grid: true }); ivG2.draw(gauss2('yx'), 'signed', { width: 180, grid: true });
      masks(); build(); octTable(); detect();
    },
  });

  // ================= 4.4.5 comparison =================
  APP.mod({
    id: 'detcmp', ch: '4', num: '4.4.5', title: '지역 특징 검출기 비교', src: '4강 p.42 · [Tuytelaars2007] 외 성능 분석 논문',
    blurb: '어떤 검출기가 어떤 변환에 불변인가. 같은 영상을 회전·축소하며 반복률을 직접 재 보기.',
    mount(root, m) {
      APP.scaffold(root, m, {
        lead: '어떤 지역 특징을 쓸지는 응용에 따라 다르므로, 교재는 <b>손수 성능 실험을 하고 판단하라</b>고 권합니다([Tuytelaars2007, 7.1절]의 지침 참조). 아래에서 같은 영상을 회전·축소한 뒤 각 검출기의 <b>반복률</b>(원래 점이 변환된 위치 근처에서 다시 검출되는 비율)과 시간을 재 볼 수 있습니다.',
        formulas: [],
      });
      const rows = [
        ['모라벡', '제곱차 합 4방향 최소', '이동', '✘ (4방향)', '✘', '아주 빠름'],
        ['해리스', '2차 모멘트 A의 det − k·trace²', '이동', '✔', '✘', '빠름'],
        ['헤시안 det / LOG', '2차 미분 H', '이동', '✔', '✘ (σ 고정)', '빠름'],
        ['슈산', 'USAN 넓이', '이동', '✔', '✘', '빠름'],
        ['해리스 라플라스', '해리스 + 정규 라플라시안', '이동', '✔', '✔', '느림 (2100 ms)'],
        ['SIFT', 'DOG 26-이웃 극점', '이동', '✔', '✔', '보통 (400 ms)'],
        ['SURF', '박스 근사 det(H) + 적분 영상', '이동', '✔', '✔', '빠름 (70 ms)'],
      ];
      let deg = 30, scl = 0.7;
      const out = h('div'), cvs = h('canvas');
      function harrisPts(g) { const C = CV.harris(g.map(r => r.map(v => v / 255)), { G: CV.gaussKernel2D(1.5), border: 'replicate' }).C; return CV.localMax(C, 0.05 * Math.max(...C.flat()), 8).map(([y, x]) => ({ y, x, s: 1.5 })); }
      function siftPts(g) { return CV.siftKeypoints(CV.siftPyramid(g, 2), 0.02 * 255, 10).map(k => ({ y: k.Y, x: k.X, s: k.s })); }
      function surfPts(g) {
        const f = g.map(r => r.map(v => v / 255)), H = f.length, W = f[0].length, ii = CV.integral(f), out2 = [];
        const sizes = CV.surfSizes(0), maps = sizes.map(L => CV.surfDet(ii, L, H, W)), mx = Math.max(...maps.flat(2));
        for (let l = 1; l <= 2; l++) { const b = (sizes[l + 1] - 1) / 2 + 1; for (let y = b; y < H - b; y++) for (let x = b; x < W - b; x++) { const c = maps[l][y][x]; if (c < 0.01 * mx) continue; let ok = true; for (let d = -1; d <= 1 && ok; d++) for (let j = -1; j <= 1 && ok; j++) for (let a = -1; a <= 1; a++) if ((d || j || a) && maps[l + d][y + j][x + a] >= c) { ok = false; break; } if (ok) out2.push({ y, x, s: 1.2 * sizes[l] / 9 }); } }
        return out2;
      }
      const DET = [['해리스 (단일 스케일)', harrisPts, '--neg'], ['SIFT', siftPts, '--orange'], ['SURF', surfPts, '--ok']];
      function run() {
        const g = pk.gray(), Wp = CV.warp(g, deg, scl), hb = Wp.img.length, wb = Wp.img[0].length, res = [];
        for (const [nm, fn, colr] of DET) {
          const [A, ta] = ms(() => fn(g)), B = fn(Wp.img);
          const mp = A.map(p => ({ ...p, m: Wp.map(p.y, p.x) })).filter(p => p.m[0] >= 4 && p.m[1] >= 4 && p.m[0] < hb - 4 && p.m[1] < wb - 4);
          const tol = 1.5 + 0.5 / scl;
          const hit = mp.filter(p => B.some(q => (q.y - p.m[0]) ** 2 + (q.x - p.m[1]) ** 2 <= tol * tol));
          res.push({ nm, colr, nA: A.length, nB: B.length, n: mp.length, hit: hit.length, rate: mp.length ? hit.length / mp.length : 0, ta });
        }
        UI.plot(cvs, { w: 460, h: 190, x: [-0.5, 2.5], y: [0, 100], xticks: [0, 1, 2], xfmt: v => res[v] ? res[v].nm.split(' ')[0] : '', series: res.map((r, i) => ({ type: 'bar', data: [[i, r.rate * 100]], color: r.colr, bw: 70 })), yfmt: v => v + '%' });
        out.replaceChildren(UI.dataTable(['검출기', '원래 영상 점', '변환 영상 점', '반복', '반복률', '시간'], res.map(r => [r.nm, r.nA, r.nB, `${r.hit}/${r.n}`, (r.rate * 100).toFixed(0) + '%', r.ta.toFixed(0) + ' ms'])));
      }
      const pk = UI.figPicker('mtn', () => run());
      root.append(
        h('div', { class: 'card' }, h('h3', {}, '불변성 한눈에 보기'), UI.dataTable(['검출기', '특징 가능성', '이동', '회전', '스케일', '속도 (교재·Bay2008)'], rows.map(r => [h('b', {}, r[0]), r[1], '✔', r[3], r[4], r[5]])),
          h('p', { class: 'caption' }, '이 장의 검출기는 모두 위치·스케일까지만 정합니다. 방향과 특징 벡터(기술자)는 6장에서 다룹니다. 어파인(비스듬히 본) 변환까지 불변인 검출기는 [Mikolajczyk2005b]에 비교되어 있습니다.')),
        h('div', { class: 'card', style: { marginTop: '16px' } }, h('h3', {}, '직접 해 보는 반복률 실험'),
          h('div', { class: 'controls' }, pk.el, UI.slider({ label: '회전', min: 0, max: 90, step: 5, value: deg, id: 'dc-r', fmt: v => v + '°', oninput: v => { deg = v; run(); } }), UI.slider({ label: '스케일', min: 0.5, max: 1, step: 0.05, value: scl, id: 'dc-s', fmt: v => v.toFixed(2), oninput: v => { scl = v; run(); } })),
          h('div', { class: 'row', style: { marginTop: '10px' } }, h('div', { class: 'col', style: { flex: '1 1 420px' } }, cvs), h('div', { class: 'col', style: { flex: '1 1 380px' } }, out)),
          h('p', { class: 'caption' }, '간단히 하려고 위치만 비교했습니다(허용 오차 약 1.5~2.5화소). 논문의 반복률은 검출 영역의 겹침 비율까지 봅니다. 영상과 변환에 따라 순위가 바뀌므로 교재 말대로 “손수 실험하고 판단”해야 합니다.')),
        h('div', { class: 'card', style: { marginTop: '16px' } }, h('h3', {}, '참고 논문'),
          h('ul', { class: 'caption', style: { margin: 0, paddingLeft: '18px' } },
            h('li', {}, '[Tuytelaars2007] T. Tuytelaars, K. Mikolajczyk, “Local invariant feature detectors: a survey,” Foundations and Trends in Computer Graphics and Vision 3(3), 177–280 — 튜토리얼'),
            h('li', {}, '[Schmid2000] C. Schmid et al., “Evaluation of interest point detectors,” IJCV 37(2), 151–172'),
            h('li', {}, '[Mikolajczyk2005b] K. Mikolajczyk et al., “A comparison of affine region detectors,” IJCV 65(1-2), 43–72'),
            h('li', {}, '[Miksik2012] O. Miksik, K. Mikolajczyk, “Evaluation of local detectors and descriptors for fast feature matching,” ICPR, 2681–2684'),
            h('li', {}, '[Aanes2012] H. Aanæs et al., “Interesting interest points,” IJCV 97, 18–35'))));
      run();
    },
  });
})();

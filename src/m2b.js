// Chapter 2 modules, part B: correlation/convolution, median, geometry, pyramid, morphology, colour
(() => {
  const { h, fmt } = UI;
  const R = String.raw;
  const n2 = v => (Math.abs(v - Math.round(v)) < 1e-9 ? String(Math.round(v)) : (+v.toFixed(3)).toString());

  // ================= 2.4.2 correlation & convolution =================
  const PRESETS = {
    '항등': [[0, 0, 0], [0, 1, 0], [0, 0, 0]],
    '박스': [[1 / 9, 1 / 9, 1 / 9], [1 / 9, 1 / 9, 1 / 9], [1 / 9, 1 / 9, 1 / 9]],
    '가우시안': [[0, 0, .0002, 0, 0], [0, .0113, .0837, .0113, 0], [.0002, .0837, .6187, .0837, .0002], [0, .0113, .0837, .0113, 0], [0, 0, .0002, 0, 0]],
    '샤프닝': [[0, -1, 0], [-1, 5, -1], [0, -1, 0]],
    '수평 에지': [[1, 1, 1], [0, 0, 0], [-1, -1, -1]],
    '수직 에지': [[1, 0, -1], [1, 0, -1], [1, 0, -1]],
    '모션': [[.0304, .0501, 0, 0, 0], [.0501, .1771, .0519, 0, 0], [0, .0519, .1771, .0519, 0], [0, 0, .0519, .1771, .0501], [0, 0, 0, .0501, .0304]],
    '라플라시안': [[0, 1, 0], [1, -4, 1], [0, 1, 0]],
    '비대칭 1~9': [[1, 2, 3], [4, 5, 6], [7, 8, 9]],
  };
  APP.mod({
    id: 'conv', ch: '2', num: '2.4.2', title: '상관과 컨볼루션', src: '2강 p.36–40 · 식 (2.14), 그림 2-22~2-24', star: true,
    blurb: '윈도우를 밀며 곱해서 더하기. 커널 숫자를 직접 바꾸고, 상관과 컨볼루션(뒤집기)의 차이를 확인.',
    mount(root, m) {
      APP.scaffold(root, m, {
        lead: '영역 연산은 이웃 화소들의 값으로 새 값을 정합니다. <b>상관</b>은 윈도우 u를 그대로 겹쳐 곱해 더하고, <b>컨볼루션</b>은 윈도우를 뒤집은 뒤 상관을 적용합니다. 임펄스(1이 하나뿐인 영상)에 컨볼루션하면 윈도우가 그대로 찍혀 나오는 이유가 여기에 있습니다(임펄스 반응). 교재는 둘을 구분하지 않고 컨볼루션이라 부릅니다.',
        formulas: [[R`$$g(i)=u\otimes f=\sum_{x=-(w-1)/2}^{(w-1)/2}u(x)\,f(i+x)$$`, '상관 (1차원)'], [R`$$g(i)=u\circledast f=\sum_{x=-(w-1)/2}^{(w-1)/2}u(x)\,f(i-x)$$`, '컨볼루션 (1차원)'], [R`$$g(j,i)=\sum_{y}\sum_{x}u(y,x)\,f(j\pm y,\,i\pm x)$$`, '2차원: 상관은 +, 컨볼루션은 −']],
      });
      // ---- 1-D ----
      let f1 = [0, 0, 1, 0, 2, 2, 4, 3, 1, 0], u1 = [2, 4, 3], mode1 = 'corr', fr1 = null;
      const CODE1 = ['for(i=(w-1)/2 to n-1-(w-1)/2) {   // 양 끝은 계산하지 않음(-)', '  g(i)=0;', '  for(x=-(w-1)/2 to (w-1)/2)', '    g(i) += u(x)·f(i+x);    // 상관.  컨볼루션은 f(i-x)', '}'];
      const st1 = UI.Stepper({ code: CODE1, title: '1차원 의사 코드', render: fr => { fr1 = fr; g1.draw(); } });
      const g1 = UI.GridView({
        rows: 3, cols: 10, cs: 42, rowLabels: ['f', 'u', 'g'], label: '1차원 상관',
        cell: (y, x) => {
          if (!fr1) return {};
          const r = (u1.length - 1) / 2, i = fr1.i;
          if (y === 0) return { t: f1[x], cls: Math.abs(x - i) <= r ? 'win' : '', bold: fr1.px === x };
          if (y === 1) { const k = x - i + r; if (k < 0 || k >= u1.length) return { t: '' }; const w = fr1.ker[k]; return { t: '×' + w, color: 'var(--orange)', bold: fr1.px === x, cls: fr1.px === x ? 'cur' : '' }; }
          const val = fr1.g[x];
          return { t: val === undefined ? '' : val === null ? '-' : val, cls: x === i ? 'cur' : '', bold: x === i };
        },
      });
      const in1f = h('input', { type: 'text', value: f1.join(' '), size: 26, 'aria-label': '입력 f' });
      const in1u = h('input', { type: 'text', value: u1.join(' '), size: 8, 'aria-label': '윈도우 u' });
      const seg1 = UI.segmented([['corr', '상관'], ['conv', '컨볼루션']], 'corr', v => { mode1 = v; build1(); }, '연산');
      [in1f, in1u].forEach(inp => inp.addEventListener('change', () => {
        const nf = in1f.value.trim().split(/[\s,]+/).map(Number).filter(v => !isNaN(v)), nu = in1u.value.trim().split(/[\s,]+/).map(Number).filter(v => !isNaN(v));
        if (nf.length >= 3 && nu.length % 2 === 1 && nu.length < nf.length) { f1 = nf; u1 = nu; g1.resize(3, f1.length); build1(); }
      }));
      function build1() {
        const r = (u1.length - 1) / 2, ker = mode1 === 'conv' ? u1.slice().reverse() : u1.slice(), n = f1.length;
        const g = new Array(n).fill(undefined), fr = [];
        for (let i = 0; i < r; i++) g[i] = null;
        for (let i = r; i < n - r; i++) {
          g[i] = 0; const terms = [];
          fr.push({ line: 2, i, ker, g: g.slice(), vars: { i, 'g(i)': 0 }, note: `g(${i}) = 0 으로 시작. 윈도우 중심을 f(${i})에 맞춥니다` + (mode1 === 'conv' ? ' (컨볼루션이라 u를 <b>뒤집어</b> 겹칩니다: ' + ker.join(' ') + ')' : '') });
          for (let x = -r; x <= r; x++) {
            const w = ker[x + r], v = f1[i + x];
            g[i] += w * v; terms.push(`${w}×${v}`);
            fr.push({ line: 4, i, px: i + x, ker, g: g.slice(), vars: { i, x, [mode1 === 'conv' ? 'u(-x)' : 'u(x)']: w, [`f(${i}+${x})`]: v, 'g(i)': g[i] }, note: `g(${i}) = ${terms.join(' + ')} = <b>${g[i]}</b>` });
          }
        }
        for (let i = n - r; i < n; i++) g[i] = null;
        const best = g.reduce((b, v, i) => (v !== null && v !== undefined && (b < 0 || v > g[b]) ? i : b), -1);
        fr.push({ line: [], i: best, ker, g: g.slice(), vars: { 'max g': g[best], '위치': best }, note: `완료. 최댓값 <b>${g[best]}</b>이 위치 <b>${best}</b>에서 나옵니다` + (mode1 === 'corr' ? ' — 윈도우 모양과 가장 닮은 곳(원시적 매칭, 그림 2-22).' : '.') });
        st1.load(fr, 'end');
      }

      // ---- 2-D ----
      const IMP = Array.from({ length: 8 }, (_, y) => Array.from({ length: 8 }, (_, x) => (y === 3 && x === 2 ? 1 : 0)));
      let K = PRESETS['비대칭 1~9'].map(r => r.slice()), preset = '비대칭 1~9', mode2 = 'corr', src = 'grid', norm = false, disp = 'clamp';
      let fg = IMP.map(r => r.slice()), G = null, fr2 = null;
      const kbox = h('div', { class: 'kgrid' });
      const presetBox = h('div', { class: 'presets' });
      const kernel = () => { let k = K; if (norm) { const s = k.flat().reduce((a, b) => a + b, 0); if (Math.abs(s) > 1e-9) k = k.map(r => r.map(v => v / s)); } return mode2 === 'conv' ? k.slice().reverse().map(r => r.slice().reverse()) : k; };
      function drawKernel() {
        kbox.style.gridTemplateColumns = `repeat(${K.length}, auto)`;
        const r = (K.length - 1) / 2;
        kbox.replaceChildren(...K.flatMap((row, y) => row.map((v, x) => {
          const inp = h('input', { type: 'number', step: '0.1', value: n2(v), 'aria-label': `u(${y - r},${x - r})`, id: `conv-k-${K.length}-${y}-${x}` });
          inp.addEventListener('input', () => { K[y][x] = parseFloat(inp.value) || 0; preset = ''; drawPresets(); update(); });
          return inp;
        })));
      }
      function drawPresets() {
        presetBox.replaceChildren(...Object.keys(PRESETS).map(name => h('button', { class: 'btn', 'aria-pressed': String(name === preset), onclick: () => {
          preset = name; K = PRESETS[name].map(r => r.slice()); const s = K.flat().reduce((a, b) => a + b, 0);
          disp = Math.abs(s - 1) < 0.02 ? 'clamp' : name === '비대칭 1~9' ? 'clamp' : 'abs'; dispSeg.set(disp);
          drawKernel(); drawPresets(); update();
        } }, name)));
      }
      const CODE2 = ['for(j=0 to M-1) for(i=0 to N-1) {', '  g(j,i)=0;', '  for(y=-(h-1)/2 to (h-1)/2) for(x=-(w-1)/2 to (w-1)/2)', '    g(j,i) += u(y,x)·f(j+y,i+x);   // 상관.  컨볼루션은 f(j-y,i-x)', '}'];
      const st2 = UI.Stepper({ code: CODE2, title: '2차원 의사 코드', render: fr => { fr2 = fr; gF.draw(); gG.draw(); } });
      const inWin = (y, x) => fr2 && fr2.j !== undefined && Math.abs(y - fr2.j) <= (K.length - 1) / 2 && Math.abs(x - fr2.i) <= (K.length - 1) / 2;
      const gF = UI.GridView({
        rows: 8, cols: 8, cs: 34, label: '입력 f',
        cell: (y, x) => {
          const s = { t: fg[y][x], cls: inWin(y, x) ? 'win' : '' };
          if (inWin(y, x)) { const r = (K.length - 1) / 2; s.sub = n2(kernel()[y - fr2.j + r][x - fr2.i + r]); }
          if (fr2 && fr2.j === y && fr2.i === x) s.cls += ' cur';
          if (fg[y][x]) s.bold = true;
          return s;
        },
        onClick: (y, x, e) => { fg[y][x] = (fg[y][x] + (e.shiftKey ? 9 : 1)) % 10; update(); },
      });
      const gG = UI.GridView({
        rows: 8, cols: 8, cs: 34, fs: 11.5, label: '출력 g',
        cell: (y, x) => {
          if (!fr2 || y * 8 + x > fr2.k) return { t: '' };
          const v = G[y][x];
          return { t: n2(v), ...APP.signedCell(v, gmax), cls: fr2.j === y && fr2.i === x ? 'cur' : '' };
        },
      });
      let gmax = 1;
      const ivIn = UI.ImageView({ caption: '입력 영상', onHover: (y, x) => mag(y, x) }), ivOut = UI.ImageView({ caption: '출력 g', onHover: (y, x) => mag(y, x) });
      const magBox = h('div', { class: 'col' });
      function mag(y, x) {
        const k = kernel(), r = (k.length - 1) / 2, img = UI.currentImage().gray, Hh = img.length, W = img[0].length;
        let s = 0;
        const mg = UI.GridView({ rows: k.length, cols: k.length, cs: 46, fs: 12, axes: false, cell: (j, i) => { const v = img[CV.clamp(y + j - r, 0, Hh - 1)][CV.clamp(x + i - r, 0, W - 1)]; return { t: v, sub: '×' + n2(k[j][i]), ...APP.grayCell(v) }; } });
        for (let j = 0; j < k.length; j++) for (let i = 0; i < k.length; i++) s += k[j][i] * img[CV.clamp(y + j - r, 0, Hh - 1)][CV.clamp(x + i - r, 0, W - 1)];
        mg.draw();
        magBox.replaceChildren(h('span', { class: 'caption' }, `(${y}, ${x}) 주변 — 칸의 작은 글씨가 곱해지는 가중치`), mg.el, h('span', { class: 'mono' }, `g(${y},${x}) = Σ 값×가중치 = ${s.toFixed(2)}`));
        ivIn.draw(img, 'gray', { rects: [{ x: x - r, y: y - r, ww: k.length, hh: k.length }] });
      }
      const gridBox = h('div', { class: 'row' }), imgBox = h('div', { class: 'imgs two' }), tutorBox = h('div');
      const srcSeg = UI.segmented([['grid', '숫자 격자 8×8'], ['img', '영상']], src, v => { src = v; update(); }, '입력');
      const modeSeg = UI.segmented([['corr', '상관'], ['conv', '컨볼루션']], mode2, v => { mode2 = v; update(); }, '연산');
      const dispSeg = UI.segmented([['clamp', '0–255로 자르기'], ['abs', '절댓값'], ['signed', '부호 색']], disp, v => { disp = v; update(); }, '표시');
      const normChk = h('input', { type: 'checkbox', id: 'conv-norm' });
      normChk.addEventListener('change', () => { norm = normChk.checked; update(); });
      const sizeSeg = UI.segmented([[3, '3×3'], [5, '5×5']], 3, v => { const r = (v - 1) / 2; K = Array.from({ length: v }, (_, y) => Array.from({ length: v }, (_, x) => (y === r && x === r ? 1 : 0))); preset = ''; drawKernel(); drawPresets(); update(); }, '크기');
      function update() {
        sizeSeg.set(K.length);
        const k = kernel();
        gridBox.hidden = src !== 'grid'; imgBox.hidden = src !== 'img'; tutorBox.hidden = src !== 'grid'; magBox.hidden = src !== 'img';
        if (src === 'grid') {
          G = CV.correlate2D(fg, k, 'zero'); gmax = Math.max(1e-9, ...G.flat().map(Math.abs));
          const fr = [];
          for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) {
            const r = (k.length - 1) / 2, terms = [];
            for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) { const v = CV.inside(fg, j + y, i + x) ? fg[j + y][i + x] : 0; if (v && k[y + r][x + r]) terms.push(`${n2(k[y + r][x + r])}×${v}`); }
            fr.push({ line: [3, 4], j, i, k: j * 8 + i, vars: { j, i, 'g(j,i)': G[j][i] }, note: `g(${j},${i}) = ${terms.length ? terms.join(' + ') : '0 (윈도우 안의 f가 모두 0)'} = <b>${n2(G[j][i])}</b>` });
          }
          st2.load(fr, fr2 ? Math.min(st2.i, fr.length - 1) : 27);
        } else {
          const img = UI.currentImage().gray, out = CV.correlate2D(img, k);
          ivIn.draw(img);
          if (disp === 'clamp') ivOut.draw(out); else ivOut.draw(out, disp);
          ivOut.setInfo(disp === 'clamp' ? '' : disp === 'abs' ? '|g| 정규화' : '주황 +, 파랑 −');
        }
      }
      UI.onImage(() => src === 'img' && update());
      imgBox.append(ivIn.el, ivOut.el);
      gridBox.append(h('div', { class: 'col' }, h('span', { class: 'caption' }, '입력 f — 클릭 +1 / Shift+클릭 −1, 작은 글씨: 곱해지는 가중치'), gF.el), h('div', { class: 'col' }, h('span', { class: 'caption' }, '출력 g (0으로 채운 경계)'), gG.el));
      tutorBox.append(st2.root);
      const p1 = h('div', { class: 'card' }, h('h3', {}, '1차원: 그림 2-22', h('small', {}, '숫자를 바꾸고 Enter')),
        h('div', { class: 'controls' }, UI.labeled('f', in1f), UI.labeled('u', in1u), seg1), h('div', { style: { marginTop: '10px' } }, g1.el), h('div', { style: { marginTop: '10px' } }, st1.root));
      const p2 = h('div', { class: 'card' }, h('h3', {}, '2차원: 커널을 직접 편집', h('small', {}, '그림 2-23, 2-24')),
        h('div', { class: 'controls' }, UI.labeled('입력', srcSeg), UI.labeled('연산', modeSeg), UI.labeled('크기', sizeSeg), h('span', { class: 'ctl' }, normChk, h('label', { for: 'conv-norm' }, '가중치 합으로 나누기'))),
        h('div', { class: 'row', style: { marginTop: '12px', alignItems: 'flex-start' } }, h('div', { class: 'col' }, h('span', { class: 'caption' }, '윈도우 u (가운데가 원점)'), kbox), h('div', { class: 'col', style: { flex: '1 1 260px' } }, h('span', { class: 'caption' }, '프리셋'), presetBox, h('div', { class: 'controls' }, UI.labeled('표시', dispSeg)))),
        h('div', { style: { marginTop: '14px' } }, gridBox, imgBox), h('div', { class: 'controls', style: { marginTop: '8px' } }, h('button', { class: 'btn', onclick: () => { fg = IMP.map(r => r.slice()); update(); } }, '임펄스'), h('button', { class: 'btn', onclick: () => { fg = APP.parseGrid(`0 0 0 0 0 0 0 0\n0 1 1 0 0 0 1 0\n0 1 2 0 0 0 1 0\n0 1 3 1 0 0 2 0\n0 1 3 1 0 0 2 0\n0 1 2 3 4 4 3 0\n0 0 0 0 1 3 1 0\n0 0 0 0 0 0 0 0`); update(); } }, '예제 3-1 영상'), UI.imagePicker()), tutorBox);
      root.append(h('div', { class: 'lab' }, h('div', { class: 'stack' }, p1, p2, magBox),
        h('div', { class: 'stack' }, st1.panel, st2.panel, h('div', { class: 'note' }, '해 볼 것: 입력을 “임펄스”, 커널을 “비대칭 1~9”로 두고 상관 ↔ 컨볼루션을 바꿔 보세요. 상관 결과에는 윈도우가 뒤집혀(9 8 7 …) 찍히고, 컨볼루션 결과에는 윈도우가 그대로(1 2 3 …) 찍힙니다.'))));
      drawKernel(); drawPresets(); build1(); update();
    },
  });

  // ================= 2.4.2 median =================
  APP.mod({
    id: 'median', ch: '2', num: '2.4.2', title: '메디안 필터', src: '2강 p.41 · 그림 2-25',
    blurb: '솔트페퍼 잡음에서 가우시안과 메디안 비교. 윈도우 정렬을 직접 확인.',
    mount(root, m) {
      APP.scaffold(root, m, {
        lead: '메디안 필터는 윈도우 안의 값을 <b>정렬해 가운데 값</b>을 고르는 비선형 연산입니다. 극단값(솔트페퍼 잡음)은 정렬하면 양 끝으로 밀려나 결과에 영향을 주지 못합니다. 가우시안은 잡음까지 섞어서 평균을 내므로 얼룩이 남고 에지도 흐려집니다. 잡음 영상 위에 마우스를 올려 보세요.',
        formulas: [],
      });
      let amt = 0.08, sigma = 1, r = 1, noisy;
      const ivN = UI.ImageView({ caption: '솔트페퍼 잡음', onHover: (y, x) => hov(y, x) }), ivG = UI.ImageView({ caption: '가우시안', onHover: (y, x) => hov(y, x) }), ivM = UI.ImageView({ caption: '메디안', onHover: (y, x) => hov(y, x) });
      const box = h('div', { class: 'card' });
      let gOut, mOut;
      let make = function () {
        const g = UI.currentImage().gray, rr = UI.rng(11);
        noisy = g.map(row => row.map(v => { const q = rr(); return q < amt / 2 ? 0 : q < amt ? 255 : v; }));
        gOut = CV.gaussianBlur(noisy, sigma); mOut = CV.median(noisy, r);
        ivN.draw(noisy); ivG.draw(gOut); ivM.draw(mOut);
      };
      function hov(y, x) {
        const a = [], Hh = noisy.length, W = noisy[0].length;
        for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) a.push(noisy[CV.clamp(y + j, 0, Hh - 1)][CV.clamp(x + i, 0, W - 1)]);
        const s = a.slice().sort((p, q) => p - q), mid = s.length >> 1, mean = a.reduce((p, q) => p + q, 0) / a.length;
        const zoom = UI.GridView({ rows: 2 * r + 1, cols: 2 * r + 1, cs: 40, fs: 11, axes: false, cell: (j, i) => { const v = noisy[CV.clamp(y + j - r, 0, Hh - 1)][CV.clamp(x + i - r, 0, W - 1)]; return { t: v, ...APP.grayCell(v), cls: j === r && i === r ? 'cur' : '' }; } }); zoom.draw();
        box.replaceChildren(h('h3', {}, `(${y}, ${x}) 주변 ${2 * r + 1}×${2 * r + 1} 윈도우`), h('div', { class: 'row', style: { alignItems: 'center' } }, zoom.el, h('div', { class: 'col', style: { flex: '1 1 300px' } }, h('span', { class: 'caption' }, '→ 값을 정렬하면'),
          h('div', { class: 'chips' }, s.map((v, k) => h('span', { class: 'lit' + (k === mid ? ' t' : v === 0 || v === 255 ? ' f' : '') }, v))),
          h('p', { class: 'caption' }, h('b', {}, `메디안 = ${s[mid]}`), ` (정렬한 ${s.length}개 중 ${mid + 1}번째, 초록) · 단순 평균 = ${mean.toFixed(1)} · 가우시안 결과 = ${gOut[y][x].toFixed(1)} · 빨강: 잡음(0 또는 255)`), h('p', { class: 'caption' }, '잡음 값은 정렬하면 양 끝으로 밀려나 가운데 값에 영향을 못 줍니다. 평균·가우시안은 255 하나만 섞여도 값이 끌려갑니다.'))));
        [ivN, ivG, ivM].forEach((iv, k) => iv.draw([noisy, gOut, mOut][k], 'gray', { rects: [{ x: x - r, y: y - r, ww: 2 * r + 1, hh: 2 * r + 1 }] }));
      }
      const pickDefault = () => { const g0 = UI.currentImage().gray; for (let y = 20; y < noisy.length - 20; y++) for (let x = 20; x < noisy[0].length - 20; x++) if (noisy[y][x] === 255 && g0[y][x] < 120) return [y, x]; return [noisy.length >> 1, noisy[0].length >> 1]; };
      const make0 = make; make = () => { make0(); hov(...pickDefault()); };
      UI.onImage(() => make());
      root.append(h('div', { class: 'stack' },
        h('div', { class: 'card' }, h('div', { class: 'controls' }, UI.imagePicker(),
          UI.slider({ label: '잡음 비율', min: 0, max: 0.3, step: 0.01, value: amt, id: 'md-amt', fmt: v => Math.round(v * 100) + '%', oninput: v => { amt = v; make(); } }),
          UI.slider({ label: '가우시안 σ', min: 0.3, max: 3, step: 0.1, value: sigma, id: 'md-s', fmt: v => v.toFixed(1), oninput: v => { sigma = v; make(); } }),
          UI.labeled('메디안 윈도우', UI.segmented([[1, '3×3'], [2, '5×5']], 1, v => { r = v; make(); })))),
        h('div', { class: 'imgs' }, ivN.el, ivG.el, ivM.el), box));
      make();
    },
  });

  // ================= 2.4.3 geometric ops =================
  APP.mod({
    id: 'geom', ch: '2', num: '2.4.3', title: '기하 연산과 보간', src: '2강 p.42–52 · 표 2-1, 예제 2-3·2-4, 알고리즘 2-7·2-8, 식 (2.17)(2.18)',
    blurb: '동차 행렬을 곱해 복합 변환 만들기, 전방/후방 변환, 양선형 보간 계산기.',
    mount(root, m) {
      APP.scaffold(root, m, {
        lead: '점을 <b>동차 좌표</b> (y x 1)로 쓰면 이동·회전·크기 변환이 모두 3×3 행렬 곱이 되고, 여러 변환을 <b>행렬 하나로 미리 곱해 둘 수 있습니다</b>(복합 변환). 교재는 행벡터 규약 x′ = x·H 를 씁니다. 아래 목록에서 변환을 추가·수정하면 행렬 곱과 삼각형이 함께 바뀝니다.',
        formulas: [[R`$$\dot{\mathbf x}'=(y'\;x'\;1)=\dot{\mathbf x}\dot{\mathbf H}=(y\;x\;1)\begin{pmatrix}a_{11}&a_{12}&0\\a_{21}&a_{22}&0\\a_{31}&a_{32}&1\end{pmatrix}$$`, '식 (2.16)'], [R`$$T(t_y,t_x)=\begin{pmatrix}1&0&0\\0&1&0\\t_y&t_x&1\end{pmatrix},\;R(\theta)=\begin{pmatrix}\cos\theta&-\sin\theta&0\\\sin\theta&\cos\theta&0\\0&0&1\end{pmatrix}$$`, '표 2-1']],
      });
      const TYPES = { T: ['이동 T', ['t_y', 't_x']], R: ['회전 R', ['θ°']], S: ['크기 S', ['s_y', 's_x']], Shy: ['기울임 Sh_y', ['h_y']], Shx: ['기울임 Sh_x', ['h_x']] };
      const mat = o => o.t === 'T' ? CV.M.T(o.p[0], o.p[1]) : o.t === 'R' ? CV.M.R(o.p[0]) : o.t === 'S' ? CV.M.S(o.p[0], o.p[1]) : o.t === 'Shy' ? [[1, 0, 0], [o.p[0], 1, 0], [0, 0, 1]] : [[1, o.p[0], 0], [0, 1, 0], [0, 0, 1]];
      let ops = [{ t: 'T', p: [3, 2] }, { t: 'R', p: [30] }];
      const tri = [[3, 5], [2, 5], [3, 8]];
      const opsBox = h('div', { class: 'col' }), matBox = h('div', { class: 'row', style: { alignItems: 'center', gap: '8px' } }), ptTbl = h('div');
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '-30 -30 400 400'); svg.style.width = '100%'; svg.style.maxWidth = '420px';
      const COLS = ['--faint', '--orange', '--green', '--neg', '--bad', '--ink'];
      function drawOps() {
        opsBox.replaceChildren(...ops.map((o, k) => h('div', { class: 'controls' },
          h('span', { class: 'pill', style: { color: `var(${COLS[(k + 1) % COLS.length]})` } }, `${k + 1}`),
          UI.select(Object.entries(TYPES).map(([v, [t]]) => [v, t]), o.t, v => { o.t = v; o.p = v === 'T' ? [0, 0] : v === 'R' ? [30] : v === 'S' ? [1.5, 1.5] : [0.5]; drawOps(); upd(); }, `geo-t-${k}`),
          ...TYPES[o.t][1].map((pn, q) => { const inp = h('input', { type: 'number', step: o.t === 'R' ? 5 : 0.5, value: o.p[q], style: { width: '72px' }, id: `geo-p-${k}-${q}`, 'aria-label': pn }); inp.addEventListener('input', () => { o.p[q] = parseFloat(inp.value) || 0; upd(); }); return UI.labeled(pn, inp); }),
          h('button', { class: 'btn', 'aria-label': '삭제', onclick: () => { ops.splice(k, 1); drawOps(); upd(); } }, '삭제'))),
          h('div', { class: 'controls' }, h('button', { class: 'btn', onclick: () => { ops.push({ t: 'R', p: [30] }); drawOps(); upd(); } }, '+ 변환 추가'),
            h('button', { class: 'btn', onclick: () => { ops = [{ t: 'T', p: [3, 2] }, { t: 'R', p: [30] }]; drawOps(); upd(); } }, '예제 2-3/2-4'),
            h('button', { class: 'btn', onclick: () => { ops = [{ t: 'T', p: [-3, -6] }, { t: 'R', p: [45] }, { t: 'T', p: [3, 6] }]; drawOps(); upd(); } }, '점 (3,6) 중심 회전')));
      }
      function upd() {
        let Hm = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
        const stages = [tri.map(p => [p[0], p[1], 1])];
        for (const o of ops) { const Mm = mat(o); Hm = CV.M.mul(Hm, Mm); stages.push(stages[stages.length - 1].map(p => CV.M.apply(p, Mm))); }
        matBox.replaceChildren(...ops.flatMap((o, k) => [k ? h('span', {}, '·') : null, h('span', { class: 'col', style: { justifyItems: 'center' } }, UI.matrixEl(mat(o)), h('span', { class: 'caption' }, `${TYPES[o.t][0].split(' ')[1]}(${o.p.join(', ')})`))]), h('span', {}, '='), h('span', { class: 'col', style: { justifyItems: 'center' } }, UI.matrixEl(Hm, 4), h('span', { class: 'caption' }, '복합 행렬 H')));
        const final = tri.map(p => CV.M.apply([p[0], p[1], 1], Hm));
        ptTbl.replaceChildren(UI.dataTable(['꼭지점', '원래 (y, x)', ...ops.map((_, k) => `${k + 1}단계 후`), '복합 H 한 번'], tri.map((p, i) => [`x${i + 1}`, `(${p[0]}, ${p[1]})`, ...stages.slice(1).map(s => `(${s[i][0].toFixed(2)}, ${s[i][1].toFixed(2)})`), `(${final[i][0].toFixed(4)}, ${final[i][1].toFixed(4)})`])));
        const S = 26, pts = s => s.map(p => `${p[1] * S},${p[0] * S}`).join(' ');
        let g = '';
        for (let k = 0; k <= 13; k++) g += `<line x1="${k * S}" y1="0" x2="${k * S}" y2="${13 * S}" stroke="var(--rule)" stroke-width="1"/><line x1="0" y1="${k * S}" x2="${13 * S}" y2="${k * S}" stroke="var(--rule)" stroke-width="1"/>` + (k % 2 === 0 ? `<text x="${k * S}" y="-8" font-size="10" text-anchor="middle" fill="var(--muted)">${k}</text><text x="-10" y="${k * S + 3}" font-size="10" text-anchor="end" fill="var(--muted)">${k}</text>` : '');
        g += `<line x1="0" y1="0" x2="${13.3 * S}" y2="0" stroke="var(--ink)" stroke-width="1.5"/><line x1="0" y1="0" x2="0" y2="${13.3 * S}" stroke="var(--ink)" stroke-width="1.5"/><text x="${13.4 * S}" y="4" font-size="12" fill="var(--ink)">x</text><text x="-4" y="${13.8 * S}" font-size="12" fill="var(--ink)">y</text>`;
        stages.forEach((s, k) => { g += `<polygon points="${pts(s)}" fill="var(${COLS[k % COLS.length]})" fill-opacity="${k ? 0.35 : 0.2}" stroke="var(${COLS[k % COLS.length]})" stroke-width="1.5"/><circle cx="${s[0][1] * S}" cy="${s[0][0] * S}" r="3" fill="var(${COLS[k % COLS.length]})"/>`; });
        svg.innerHTML = g;
      }
      // warp
      let ang = 20, sc = 1.4;
      const ivF = UI.ImageView({ caption: '전방 변환 (알고리즘 2-7)' }), ivBn = UI.ImageView({ caption: '후방 + 최근접' }), ivBl = UI.ImageView({ caption: '후방 + 양선형 보간' });
      function warp() {
        const src = UI.currentImage().gray, Hh = src.length, W = src[0].length, cy = Hh / 2, cx = W / 2;
        const Hm = [CV.M.T(-cy, -cx), CV.M.R(ang), CV.M.S(sc, sc), CV.M.T(cy, cx)].reduce(CV.M.mul), Hi = CV.M.inv(Hm);
        const fw = CV.zeros(Hh, W), hole = CV.zeros(Hh, W, 1);
        for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) { const [yy, xx] = CV.M.apply([y, x, 1], Hm).map(Math.round); if (yy >= 0 && xx >= 0 && yy < Hh && xx < W) { fw[yy][xx] = src[y][x]; hole[yy][xx] = 0; } }
        const bn = CV.zeros(Hh, W), bl = CV.zeros(Hh, W);
        for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
          const [yf, xf] = CV.M.apply([y, x, 1], Hi);
          if (yf < 0 || xf < 0 || yf > Hh - 1 || xf > W - 1) continue;
          bn[y][x] = src[Math.round(yf)][Math.round(xf)]; bl[y][x] = CV.bilinear(src, yf, xf);
        }
        const holes = []; let nh = 0;
        for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) { const [yf, xf] = CV.M.apply([y, x, 1], Hi); if (hole[y][x] && yf >= 0 && xf >= 0 && yf <= Hh - 1 && xf <= W - 1) { holes.push({ y, x, color: '--orange' }); nh++; } }
        ivF.draw(fw); ivF.setInfo(`구멍(검은 점) ${nh}개`); ivBn.draw(bn); ivBl.draw(bl);
      }
      UI.onImage(warp);
      // bilinear calculator
      let bv = [30, 90, 120, 200], al = 0.35, be = 0.6;
      const bsvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      bsvg.setAttribute('viewBox', '-40 -30 300 300'); bsvg.style.width = '100%'; bsvg.style.maxWidth = '320px'; bsvg.style.touchAction = 'none';
      const bout = h('div', { class: 'col' });
      const binps = bv.map((v, k) => { const inp = h('input', { type: 'number', value: v, style: { width: '64px' }, id: 'bl-' + k, 'aria-label': ['f(y,x)', 'f(y,x+1)', 'f(y+1,x)', 'f(y+1,x+1)'][k] }); inp.addEventListener('input', () => { bv[k] = parseFloat(inp.value) || 0; bil(); }); return inp; });
      function bil() {
        const [a, b, c, d] = bv, top = (1 - al) * a + al * b, bot = (1 - al) * c + al * d, v = (1 - be) * top + be * bot, S = 200;
        const shade = t => { const g = Math.round(245 - Math.min(255, Math.max(0, t)) / 255 * 200); return `rgb(${g},${g},${g})`; };
        bsvg.innerHTML = `<rect x="0" y="0" width="${S}" height="${S}" fill="none" stroke="var(--rule)"/>` +
          [[0, 0, a], [S, 0, b], [0, S, c], [S, S, d]].map(([x, y, t]) => `<circle cx="${x}" cy="${y}" r="16" fill="${shade(t)}" stroke="var(--ink)"/><text x="${x}" y="${y + 4}" text-anchor="middle" font-size="11" fill="${t > 140 ? '#fff' : '#111'}">${t}</text>`).join('') +
          `<line x1="0" y1="${be * S}" x2="${S}" y2="${be * S}" stroke="var(--faint)" stroke-dasharray="4 3"/><line x1="${al * S}" y1="0" x2="${al * S}" y2="${S}" stroke="var(--faint)" stroke-dasharray="4 3"/>` +
          `<circle cx="${al * S}" cy="0" r="5" fill="var(--green)"/><circle cx="${al * S}" cy="${S}" r="5" fill="var(--green)"/><circle cx="${al * S}" cy="${be * S}" r="8" fill="var(--bad)" style="cursor:grab"/>` +
          `<text x="${al * S / 2}" y="-8" font-size="11" text-anchor="middle" fill="var(--muted)">α=${al.toFixed(2)}</text><text x="-8" y="${be * S / 2}" font-size="11" text-anchor="end" fill="var(--muted)">β=${be.toFixed(2)}</text>` +
          `<text x="0" y="${S + 32}" font-size="11" fill="var(--muted)">(y, x)</text><text x="${S}" y="${S + 32}" font-size="11" text-anchor="end" fill="var(--muted)">(y+1, x+1)</text>`;
        bout.replaceChildren(
          h('span', { class: 'mono' }, `f(y, x′)   = (1−${al.toFixed(2)})·${a} + ${al.toFixed(2)}·${b} = ${top.toFixed(2)}`),
          h('span', { class: 'mono' }, `f(y+1, x′) = (1−${al.toFixed(2)})·${c} + ${al.toFixed(2)}·${d} = ${bot.toFixed(2)}`),
          h('span', { class: 'mono', style: { color: 'var(--bad)', fontWeight: 700 } }, `f(y′, x′)  = (1−${be.toFixed(2)})·${top.toFixed(2)} + ${be.toFixed(2)}·${bot.toFixed(2)} = ${v.toFixed(2)}`),
          h('span', { class: 'caption' }, `최근접 이웃이었다면 ${[a, b, c, d][(be >= 0.5 ? 2 : 0) + (al >= 0.5 ? 1 : 0)]}을 그대로 가져옵니다.`));
      }
      let drag = false;
      const setPt = e => { const r = bsvg.getBoundingClientRect(), sx = 300 / r.width; al = CV.clamp(((e.clientX - r.left) * sx - 40) / 200, 0, 1); be = CV.clamp(((e.clientY - r.top) * sx - 30) / 200, 0, 1); bil(); };
      bsvg.addEventListener('pointerdown', e => { drag = true; setPt(e); });
      bsvg.addEventListener('pointermove', e => drag && setPt(e));
      window.addEventListener('pointerup', () => (drag = false));
      root.append(h('div', { class: 'stack' },
        h('div', { class: 'lab' },
          h('div', { class: 'card' }, h('h3', {}, '변환 목록', h('small', {}, '위에서부터 차례로 적용')), opsBox, h('div', { style: { marginTop: '12px', overflowX: 'auto' } }, matBox), h('div', { style: { marginTop: '12px' } }, ptTbl),
            h('p', { class: 'caption' }, '각 단계를 따로 곱한 결과와 복합 행렬 H를 한 번 곱한 결과가 같습니다 — 꼭지점이 많을수록 복합 변환이 계산을 크게 줄입니다.')),
          h('div', { class: 'card' }, h('h3', {}, 'y−x 평면', h('small', {}, 'y는 아래, x는 오른쪽')), svg, h('p', { class: 'caption' }, '회색: 원래 삼각형, 색: 각 단계 결과. 점 표시는 꼭지점 x1.'))),
        h('div', { class: 'card' }, h('h3', {}, '영상에 적용: 전방 vs 후방', h('small', {}, '그림 2-27')),
          h('div', { class: 'controls' }, UI.imagePicker(), UI.slider({ label: '회전 θ', min: -180, max: 180, value: ang, id: 'geo-ang', fmt: v => v + '°', oninput: v => { ang = v; warp(); } }), UI.slider({ label: '확대', min: 0.5, max: 3, step: 0.05, value: sc, id: 'geo-sc', fmt: v => v.toFixed(2), oninput: v => { sc = v; warp(); } })),
          h('div', { class: 'imgs', style: { marginTop: '10px' } }, ivF.el, ivBn.el, ivBl.el),
          h('p', { class: 'caption' }, '전방 변환은 원본 화소를 보내는 방식이라, 확대하면 아무도 도착하지 않는 칸(검은 점 = 구멍)이 생깁니다. 후방 변환은 결과 화소마다 H⁻¹로 원본 위치를 찾아오므로 구멍이 없고, 실수 좌표를 보간하면 계단 현상(에일리어싱)도 줄어듭니다.')),
        h('div', { class: 'lab' },
          h('div', { class: 'card' }, h('h3', {}, '양선형 보간 계산기', h('small', {}, '빨간 점을 끌어 보세요')), h('div', { class: 'row' }, bsvg, h('div', { class: 'col', style: { flex: '1 1 240px' } }, h('div', { class: 'controls' }, ...binps.map((inp, k) => UI.labeled(['f(y,x)', 'f(y,x+1)', 'f(y+1,x)', 'f(y+1,x+1)'][k], inp))), bout))),
          h('div', { class: 'formula-card' }, h('div', { class: 'eq' }, R`$$f(y,x')=(1-\alpha)f(y,x)+\alpha f(y,x+1)$$`), h('div', { class: 'eq' }, R`$$f(y+1,x')=(1-\alpha)f(y+1,x)+\alpha f(y+1,x+1)$$`), h('div', { class: 'eq' }, R`$$f(y',x')=(1-\beta)f(y,x')+\beta f(y+1,x')$$`), h('div', { class: 'tag' }, '식 (2.18) — 가로로 두 번, 세로로 한 번 선형 보간')))));
      drawOps(); upd(); warp(); bil();
    },
  });

  // ================= 2.5 pyramid =================
  APP.mod({
    id: 'pyr', ch: '2', num: '2.5', title: '다해상도 피라미드', src: '2강 p.51–54 · 식 (2.19)(2.20), 그림 2-34',
    blurb: '단순 다운샘플링의 에일리어싱과 Burt&Adelson 스무딩 비교.',
    mount(root, m) {
      APP.scaffold(root, m, {
        lead: '피라미드는 샘플링 비율 0.5로 다운샘플링을 반복해 만듭니다. 식 (2.19)처럼 <b>한 칸 건너 하나씩</b> 뽑으면 화소마다 100% 또는 0%만 공헌해서 에일리어싱이 생깁니다. Burt&Adelson 방법(2.20)은 5×5 가중치로 먼저 스무딩해 <b>모든 화소가 고르게</b> 공헌하게 합니다. “존 플레이트” 영상에서 차이가 가장 잘 보입니다.',
        formulas: [[R`$$f_k(j,i)=f_{k-1}\!\left(\tfrac{j}{r},\tfrac{i}{r}\right),\;r=\tfrac12$$`, '식 (2.19) 단순 다운샘플링'], [R`$$f_k(j,i)=\sum_{y=-2}^{2}\sum_{x=-2}^{2}w(y,x)\,f_{k-1}\!\left(\tfrac{j}{r}+y,\tfrac{i}{r}+x\right)$$`, '식 (2.20) Burt&Adelson']],
      });
      const rowA = h('div', { class: 'imgs' }), rowB = h('div', { class: 'imgs' });
      function run() {
        const g = UI.currentImage().gray;
        let a = g, b = g; const A = [g], B = [g];
        for (let k = 1; k <= 3; k++) { a = CV.pyramidDown(a, false); b = CV.pyramidDown(b, true); A.push(a); B.push(b); }
        const mk = (L, row) => row.replaceChildren(...L.map((im, k) => { const iv = UI.ImageView({ caption: `f${k}`, info: `${im[0].length}×${im.length}` }); iv.draw(im); return iv.el; }));
        mk(A, rowA); mk(B, rowB);
      }
      UI.onImage(run);
      const v = [0.05, 0.25, 0.4, 0.25, 0.05];
      root.append(h('div', { class: 'stack' },
        h('div', { class: 'card' }, h('div', { class: 'controls' }, UI.imagePicker(), h('button', { class: 'btn', onclick: () => UI.setImage('zone') }, '존 플레이트로 보기')),
          h('h3', { style: { marginTop: '12px' } }, '식 (2.19): 건너뛰며 뽑기'), rowA, h('h3', { style: { marginTop: '12px' } }, '식 (2.20): Burt&Adelson 스무딩 후 뽑기'), rowB,
          h('p', { class: 'caption' }, '모든 단계를 같은 크기로 확대해 보여 줍니다. 위 줄 f₂, f₃에서 원래 없던 무늬(무아레)가 나타나는 것이 에일리어싱입니다.')),
        h('div', { class: 'row' }, h('div', { class: 'card' }, h('h3', {}, '1차원 가중치 v, h'), UI.dataTable(['−2', '−1', '0', '1', '2'], [v])), h('div', { class: 'card' }, h('h3', {}, 'w = v·h (5×5)', h('small', {}, '그림 2-34')), UI.dataTable(['', '−2', '−1', '0', '1', '2'], CV.burtKernel().map((r, k) => [k - 2, ...r.map(x => x.toFixed(4))])))),
        h('p', { class: 'caption' }, '가중치의 합은 1이고, 짝수·홀수 위치 화소가 각각 0.05+0.4+0.05 = 0.25+0.25 = 0.5씩 공헌합니다 — “모든 화소가 50%씩 공헌”의 뜻입니다.')));
      run();
    },
  });

  // ================= 2.6 morphology =================
  const MORPH_BIN = `0 0 0 0 0 0 0 0
0 1 1 0 0 0 1 0
0 1 1 0 0 0 1 0
0 1 1 1 0 0 1 0
0 1 1 1 0 0 1 0
0 1 1 1 1 1 1 0
0 0 0 0 1 1 1 0
0 0 0 0 0 0 0 0`;
  const MORPH_GRAY = `0 0 0 0 0 0 0 0
0 1 1 0 0 0 1 0
0 1 2 0 0 0 1 0
0 1 3 1 0 0 2 0
0 1 3 1 0 0 2 0
0 1 2 3 4 4 3 0
0 0 0 0 1 3 1 0
0 0 0 0 0 0 0 0`;
  const SES = {
    '1×3 가로': [[1, 1, 1]], '3×1 세로': [[1], [1], [1]], '3×3 십자': [[0, 1, 0], [1, 1, 1], [0, 1, 0]], '3×3 사각': [[1, 1, 1], [1, 1, 1], [1, 1, 1]],
  };
  APP.mod({
    id: 'morph', ch: '2', num: '2.6', title: '모폴로지', src: '2강 p.55–60 · 식 (2.21)–(2.31), 예제 2-5·2-6', star: true,
    blurb: '구조 요소를 한 칸씩 옮기며 팽창·침식·열기·닫기. 이진과 명암 모두.',
    mount(root, m) {
      APP.scaffold(root, m, {
        lead: '<b>팽창</b>은 구조 요소 S가 덮는 화소 중 <b>하나라도</b> 1이면 1(명암이면 최댓값), <b>침식</b>은 <b>모두</b> 1이어야 1(명암이면 최솟값)입니다. 열기 = 침식 후 팽창(작은 돌출 제거), 닫기 = 팽창 후 침식(작은 틈 메움). 입력 격자와 구조 요소를 클릭해 바꿔 보세요.',
        formulas: [[R`$$f\oplus S=\bigcup_{\mathbf x\in f}S_{\mathbf x}$$`, '팽창 (2.22)'], [R`$$f\ominus S=\{\mathbf x\mid \mathbf x+\mathbf s\in f,\;\forall \mathbf s\in S\}$$`, '침식 (2.23)'], [R`$$(f\oplus S)(j,i)=\max_{(y,x)\in S}f(j-y,i-x)$$`, '명암 팽창 (2.28)'], [R`$$(f\ominus S)(j,i)=\min_{(y,x)\in S}f(j+y,i+x)$$`, '명암 침식 (2.29)'], [R`$$f\circ S=(f\ominus S)\oplus S,\quad f\bullet S=(f\oplus S)\ominus S$$`, '열기 (2.24) · 닫기 (2.25)']],
      });
      let kind = 'bin', op = 'dilate', f = APP.parseGrid(MORPH_BIN), seName = '1×3 가로', SE = SES[seName].map(r => r.slice()), frame = null;
      const CODE = ['function morph(f, S, op) {', '  for(j=0 to M-1) for(i=0 to N-1) {', '    if(op=팽창) g(j,i) = max{ f(j-y,i-x) | (y,x)∈S };  // 하나라도 1이면 1', '    else        g(j,i) = min{ f(j+y,i+x) | (y,x)∈S };  // 모두 1이어야 1', '  }', '  return g;', '}', '열기: g = morph(morph(f,S,침식), S,팽창);', '닫기: g = morph(morph(f,S,팽창), S,침식);'];
      const st = UI.Stepper({ code: CODE, title: '모폴로지 의사 코드', render: fr => {
        frame = fr; gIn.draw(); gOut.draw();
        gIn.overlay(fr.cells ? [...fr.cells.map(([y, x]) => ({ type: 'rect', pts: [y, x, 1, 1], color: '--orange', w: 3, fill: 'rgba(208,101,42,.28)' })), { type: 'dot', pts: [fr.j, fr.i], color: '--neg', r: 5 }] : []);
        gOut.overlay(fr.j !== undefined ? [{ type: 'rect', pts: [fr.j, fr.i, 1, 1], color: '--neg', w: 3 }] : []);
        if (fr.vals) {
          const best = fr.word === 'max' ? Math.max(...fr.vals) : Math.min(...fr.vals); let marked = false;
          valBox.replaceChildren(h('span', { class: 'caption' }, `S가 덮는 칸의 값 (${fr.word === 'max' ? '팽창 → 가장 큰 값' : '침식 → 가장 작은 값'})`),
            h('div', { class: 'chips' }, fr.vals.map(v => { const hit = !marked && v === best; if (hit) marked = true; return h('span', { class: 'lit' + (hit ? ' t' : '') }, v); }), h('span', { class: 'mono' }, ` → ${fr.word} = ${best}`)),
            h('span', { class: 'caption' }, fr.oob ? '영상 밖 칸은 ' + (fr.word === 'max' ? '무시' : '0으로 취급') + '합니다.' : ''));
        }
      } });
      const offs = () => { const hh = SE.length, ww = SE[0].length, oy = (hh - 1) >> 1, ox = (ww - 1) >> 1, o = []; SE.forEach((r, y) => r.forEach((v, x) => v && o.push({ y: y - oy, x: x - ox, v: 0 }))); return o; };
      const maxV = () => (kind === 'bin' ? 1 : 4);
      const cellOf = (g, y, x, cur, inCells) => { const v = g[y][x]; const s = kind === 'bin' ? { t: v, cls: v ? 'on' : '' } : { t: v, ...APP.grayCell(v, 4) }; if (cur) s.cls = (s.cls || '') + ' cur'; return s; };
      const gIn = UI.GridView({ rows: 8, cols: 8, cs: 34, label: '입력', cell: (y, x) => { const src = frame ? frame.src : f; return cellOf(src, y, x, false); }, onClick: (y, x, e) => { f[y][x] = (f[y][x] + (e.shiftKey ? maxV() : 1)) % (maxV() + 1); rebuild(); } });
      const gOut = UI.GridView({ rows: 8, cols: 8, cs: 34, label: '출력', cell: (y, x) => { if (!frame) return {}; if (y * 8 + x > frame.k) return { t: '' }; return cellOf(frame.out, y, x, frame.j === y && frame.i === x); } });
      const seBox = h('div'), valBox = h('div', { class: 'col', style: { gap: '4px', marginTop: '10px' } });
      function drawSE() {
        const g = UI.GridView({ rows: SE.length, cols: SE[0].length, cs: 30, axes: false, cell: (y, x) => ({ t: SE[y][x] ? (kind === 'bin' ? 1 : 0) : '', cls: SE[y][x] ? 'on' : '', sub: y === (SE.length - 1) >> 1 && x === (SE[0].length - 1) >> 1 ? '●' : undefined }), onClick: (y, x) => { SE[y][x] = 1 - SE[y][x]; if (!SE.flat().some(Boolean)) SE[y][x] = 1; seName = ''; drawSE(); rebuild(); } });
        g.draw();
        seBox.replaceChildren(h('div', { class: 'presets' }, Object.keys(SES).map(n => h('button', { class: 'btn', 'aria-pressed': String(n === seName), onclick: () => { seName = n; SE = SES[n].map(r => r.slice()); drawSE(); rebuild(); } }, n))), h('div', { style: { marginTop: '6px' } }, g.el), h('span', { class: 'caption' }, kind === 'bin' ? '칸 클릭으로 S에 넣고 빼기 · ● 원점' : '평편한 구조요소: 모든 값 0 (식 2.28, 2.29)'));
      }
      function rebuild() {
        const o = offs(), fr = [];
        const pass = (src, which, phase) => {
          const out = CV.morph(src, o, which), part = CV.zeros(8, 8);
          for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) {
            part[j][i] = out[j][i];
            const cells = o.map(s => (which === 'dilate' ? [j - s.y, i - s.x] : [j + s.y, i + s.x])).filter(([y, x]) => y >= 0 && x >= 0 && y < 8 && x < 8);
            const vals = o.map(s => { const y = which === 'dilate' ? j - s.y : j + s.y, x = which === 'dilate' ? i - s.x : i + s.x; return CV.inside(src, y, x) ? src[y][x] : which === 'dilate' ? null : 0; }).filter(v => v !== null);
            const word = which === 'dilate' ? 'max' : 'min';
            fr.push({ src, vals, word: which === 'dilate' ? 'max' : 'min', oob: cells.length < o.length, out: part.map(r => r.slice()), k: j * 8 + i, j, i, cells, line: which === 'dilate' ? 3 : 4, vars: { j, i, 단계: phase, 'g(j,i)': out[j][i] },
              note: `${phase ? phase + ' · ' : ''}g(${j},${i}) = ${word}{ ${vals.join(', ')} } = <b>${out[j][i]}</b>` + (kind === 'bin' ? (which === 'dilate' ? (out[j][i] ? ' — 덮인 칸 중 1이 있음' : ' — 덮인 칸이 모두 0') : (out[j][i] ? ' — 덮인 칸이 모두 1' : ' — 0인 칸(또는 영상 밖)이 섞임')) : '') });
          }
          return out;
        };
        if (op === 'dilate' || op === 'erode') pass(f, op, '');
        else {
          const first = op === 'open' ? 'erode' : 'dilate', second = op === 'open' ? 'dilate' : 'erode';
          const mid = pass(f, first, `1단계 ${first === 'erode' ? '침식' : '팽창'}`);
          const n = fr.length;
          pass(mid, second, `2단계 ${second === 'erode' ? '침식' : '팽창'}`);
          for (let k = n; k < fr.length; k++) fr[k].line = [op === 'open' ? 8 : 9, fr[k].line];
          for (let k = 0; k < n; k++) fr[k].line = [op === 'open' ? 8 : 9, fr[k].line];
        }
        st.load(fr, 'end');
      }
      // real-image demo: all four ops side by side
      let iKind = 'bin', iSize = 1;
      const ivs = ['원본', '팽창 f⊕S', '침식 f⊖S', '열기 f∘S', '닫기 f•S'].map(c => UI.ImageView({ caption: c }));
      function imgDemo() {
        const g = UI.currentImage().gray, T = CV.otsu(CV.histogram(g, 256)).T;
        const src = iKind === 'bin' ? g.map(r => r.map(v => (v > T ? 1 : 0))) : g;
        const o = []; for (let y = -iSize; y <= iSize; y++) for (let x = -iSize; x <= iSize; x++) o.push({ y, x, v: 0 });
        const d = CV.morph(src, o, 'dilate'), e = CV.morph(src, o, 'erode');
        const outs = [src, d, e, CV.morph(e, o, 'dilate'), CV.morph(d, o, 'erode')];
        outs.forEach((a, k) => (iKind === 'bin' ? ivs[k].draw(a, 'binary', { dark: true }) : ivs[k].draw(a)));
        ivs[0].setInfo(iKind === 'bin' ? `오츄 T=${T}로 이진화` : '');
      }
      UI.onImage(imgDemo);
      const imgCard = h('div', { class: 'card' }, h('h3', {}, '실제 영상에서 네 연산 비교', h('small', {}, '정사각형 평편 구조요소')),
        h('div', { class: 'controls' }, UI.imagePicker(), UI.segmented([['bin', '이진'], ['gray', '명암']], 'bin', v => { iKind = v; imgDemo(); }), UI.segmented([[1, '3×3'], [2, '5×5']], 1, v => { iSize = v; imgDemo(); })),
        h('div', { class: 'imgs', style: { marginTop: '8px' } }, ivs.map(v => v.el)),
        h('p', { class: 'caption' }, '팽창은 흰 영역을 키우고 침식은 줄입니다. 열기는 흰 잡점과 얇은 선(줄무늬 막대)을 없애고, 닫기는 검은 작은 구멍·틈을 메웁니다. 열기·닫기 후에도 큰 물체의 크기는 거의 그대로입니다.'));
      const kindSeg = UI.segmented([['bin', '이진 (예제 2-5)'], ['gray', '명암 (예제 2-6)']], kind, v => { kind = v; f = APP.parseGrid(v === 'bin' ? MORPH_BIN : MORPH_GRAY); seName = '1×3 가로'; SE = SES[seName].map(r => r.slice()); drawSE(); rebuild(); }, '종류');
      const opSeg = UI.segmented([['dilate', '팽창'], ['erode', '침식'], ['open', '열기'], ['close', '닫기']], op, v => { op = v; rebuild(); }, '연산');
      root.append(h('div', { class: 'lab' },
        h('div', { class: 'stack' },
          h('div', { class: 'card' }, h('div', { class: 'controls' }, kindSeg, opSeg),
            h('div', { class: 'row', style: { marginTop: '12px' } },
              h('div', { class: 'col' }, h('span', { class: 'caption' }, '입력 (열기·닫기 2단계에서는 중간 결과) · 주황 = S가 덮는 칸, 파란 점 = 지금 위치'), gIn.el),
              h('div', { class: 'col' }, h('span', { class: 'caption' }, '출력 g'), gOut.el),
              h('div', { class: 'col' }, h('span', { class: 'caption' }, '구조 요소 S'), seBox)), valBox),
          st.root,
          imgCard,
          h('div', { class: 'note' }, '예제 2-5 분석: 가로 1×3 구조요소로 열기를 하면 폭이 1인 세로 막대(6열)가 사라지고, 닫기를 하면 3~4행의 틈(3~5열)이 메워집니다. 결과가 교재 그림 2-38과 같은지 확인해 보세요.')),
        h('div', { class: 'stack' }, st.panel)));
      drawSE(); rebuild(); imgDemo();
    },
  });

  // ================= 2.7 colour =================
  APP.mod({
    id: 'color', ch: '2', num: '2.7', title: '컬러 모델과 처리', src: '2강 p.61–65 · 그림 2-43~2-47',
    blurb: 'RGB ↔ HSI 변환, 채널별 독립 처리가 색을 망가뜨리는 경우.',
    mount(root, m) {
      APP.scaffold(root, m, {
        lead: 'RGB는 길이 1인 정육면체, HSI는 색상(H)·채도(S)·명도(I)의 이중 콘으로 색을 나타냅니다. 컬러 영상은 가장 간단하게 세 채널을 독립적으로 처리할 수 있지만, <b>히스토그램 평활화처럼 채널마다 다른 매핑이 생기는 연산</b>은 색상이 틀어집니다. 명도 I에만 적용하면 색상은 유지됩니다.',
        formulas: [[R`$$I=\frac{R+G+B}{3},\quad S=1-\frac{\min(R,G,B)}{I}$$`, 'HSI'], [R`$$H=\cos^{-1}\!\frac{\tfrac12[(R-G)+(R-B)]}{\sqrt{(R-G)^2+(R-B)(G-B)}}\;(B>G\text{이면 }360^\circ-H)$$`, '']],
      });
      let rgb = [200, 120, 60];
      const sw = h('div', { style: { width: '110px', height: '110px', borderRadius: '10px', border: '1px solid var(--rule)' } });
      const wheel = h('canvas', { width: 220, height: 220, style: { width: '180px', height: '180px' } });
      const out = h('dl', { class: 'kv' });
      function col() {
        const [r, g, b] = rgb, s = CV.rgb2hsi(r / 255, g / 255, b / 255);
        sw.style.background = `rgb(${r},${g},${b})`;
        out.replaceChildren(...[['R, G, B', `${r}, ${g}, ${b}`], ['H', s.h.toFixed(1) + '°'], ['S', s.s.toFixed(3)], ['I', s.i.toFixed(3)]].flatMap(([k, v]) => [h('dt', {}, k), h('dd', {}, v)]));
        const c = wheel.getContext('2d'), R0 = 100, cx = 110, cy = 110;
        c.clearRect(0, 0, 220, 220);
        for (let a = 0; a < 360; a += 2) for (let rr = 0; rr <= R0; rr += 4) { c.fillStyle = `hsl(${a} ${rr}% 50%)`; const t = a * Math.PI / 180; c.fillRect(cx + rr * Math.cos(t) - 2, cy - rr * Math.sin(t) - 2, 5, 5); }
        const t = s.h * Math.PI / 180;
        c.strokeStyle = '#000'; c.lineWidth = 2; c.beginPath(); c.arc(cx + s.s * R0 * Math.cos(t), cy - s.s * R0 * Math.sin(t), 7, 0, 7); c.stroke();
        c.strokeStyle = '#fff'; c.beginPath(); c.arc(cx + s.s * R0 * Math.cos(t), cy - s.s * R0 * Math.sin(t), 9, 0, 7); c.stroke();
      }
      const sl = ['R', 'G', 'B'].map((n, k) => UI.slider({ label: n, min: 0, max: 255, value: rgb[k], id: 'col-' + n, oninput: v => { rgb[k] = v; col(); } }));
      const iv0 = UI.ImageView({ caption: '원본 (어둡게 만든 영상)' }), iv1 = UI.ImageView({ caption: 'R, G, B 각각 평활화' }), iv2 = UI.ImageView({ caption: '명도 I만 평활화' });
      const ivr = UI.ImageView({ caption: 'f_r' }), ivg = UI.ImageView({ caption: 'f_g' }), ivb = UI.ImageView({ caption: 'f_b' });
      function eqDemo() {
        const img = UI.currentImage().rgb.map(r => r.map(p => p.map(v => Math.round(v * 0.45 + 10))));
        const ch = k => img.map(r => r.map(p => p[k]));
        const E = [0, 1, 2].map(k => CV.equalize(ch(k).map(r => r.map(v => Math.min(255, Math.round(v)))), 256).out);
        iv0.draw(img, 'rgb');
        iv1.draw(img.map((r, y) => r.map((_, x) => [E[0][y][x], E[1][y][x], E[2][y][x]])), 'rgb');
        const I = img.map(r => r.map(p => Math.round((p[0] + p[1] + p[2]) / 3))), EI = CV.equalize(I, 256).out;
        iv2.draw(img.map((r, y) => r.map((p, x) => { const k = I[y][x] ? EI[y][x] / I[y][x] : 0; return p.map(v => Math.min(255, v * k)); })), 'rgb');
        ivr.draw(ch(0)); ivg.draw(ch(1)); ivb.draw(ch(2));
      }
      UI.onImage(eqDemo);
      root.append(h('div', { class: 'stack' },
        h('div', { class: 'card' }, h('h3', {}, 'RGB → HSI'), h('div', { class: 'row', style: { alignItems: 'center' } }, h('div', { class: 'col' }, ...sl), sw, wheel, out),
          h('p', { class: 'caption' }, '원판의 각도가 H, 중심에서의 거리가 S입니다. R=G=B(회색)이면 S=0이 되어 H가 정의되지 않습니다.')),
        h('div', { class: 'card' }, h('h3', {}, '세 채널 f_r, f_g, f_b', h('small', {}, '그림 2-44')), h('div', { class: 'controls' }, UI.imagePicker()), h('div', { class: 'imgs', style: { marginTop: '8px' } }, ivr.el, ivg.el, ivb.el)),
        h('div', { class: 'card' }, h('h3', {}, '독립 처리가 부적절한 경우: 히스토그램 평활화'), h('div', { class: 'imgs' }, iv0.el, iv1.el, iv2.el),
          h('p', { class: 'caption' }, '가운데는 채널마다 다른 매핑 함수가 적용되어 색의 비율(색상)이 바뀌었습니다. 오른쪽은 I만 평활화하고 R:G:B 비율은 그대로 두었습니다.'))));
      col(); eqDemo();
    },
  });
})();

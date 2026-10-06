// Chapter 4 modules, part A: local feature basics, Moravec, Harris, Hessian/LoG, SUSAN, localisation (NMS)
(() => {
  const { h, fmt } = UI;
  const R = String.raw;
  const f3 = v => (Math.abs(v) < 5e-4 ? '0' : v.toFixed(3).replace(/^(-?)0\./, '$1.'));
  // Fig 4-3(a): 12×12 synthetic triangle; a=(7,7), b=(5,3), c=(2,8)
  const F43 = `0 0 0 0 0 0 0 0 0 0 0 0
0 0 0 0 0 0 0 0 0 0 0 0
0 0 0 0 0 0 0 0 0 0 0 0
0 0 0 1 0 0 0 0 0 0 0 0
0 0 0 1 1 0 0 0 0 0 0 0
0 0 0 1 1 1 0 0 0 0 0 0
0 0 0 1 1 1 1 0 0 0 0 0
0 0 0 1 1 1 1 1 0 0 0 0
0 0 0 0 0 0 0 0 0 0 0 0
0 0 0 0 0 0 0 0 0 0 0 0
0 0 0 0 0 0 0 0 0 0 0 0
0 0 0 0 0 0 0 0 0 0 0 0`;
  const PTS = { a: [7, 7], b: [5, 3], c: [2, 8] };
  const ptName = (y, x) => Object.keys(PTS).find(k => PTS[k][0] === y && PTS[k][1] === x);
  const kindOf = (l1, l2, big) => (l1 < big * 0.05 ? ['평탄한 곳', 'pill'] : l2 < l1 * 0.2 ? ['에지', 'pill hot'] : ['코너(특징점)', 'pill ok']);

  // ================= 4.1 basics =================
  APP.mod({
    id: 'feat', ch: '4', num: '4.1', title: '지역 특징 검출의 기초', src: '4강 p.3–6 · 지역 특징의 표현·성질·검출 원리',
    blurb: '에지 대신 지역 특징을 쓰는 이유, <위치,스케일,방향,특징 벡터>, 좋은 특징의 여섯 가지 성질.',
    mount(root, m) {
      APP.scaffold(root, m, {
        lead: '에지는 강도와 방향밖에 없어 두 영상에서 <b>같은 점을 짝짓기(매칭)</b>에는 정보가 모자랍니다. 그래서 주위와 두드러지게 달라 풍부한 정보를 뽑을 수 있는 <b>지역 특징</b>을 씁니다. 80년대에는 에지 토막에서 곡률이 큰 곳을 코너로 찾았지만, 이제는 <b>명암 영상에서 직접</b> 찾고, “물리적으로 코너인가”보다 <b>“다시 찍어도 또 검출되는가(반복성)”</b>를 중요하게 봅니다.',
        formulas: [[R`$$\text{지역 특징} = \langle\,\text{위치},\ \text{스케일},\ \text{방향},\ \text{특징 벡터}\,\rangle = \big((y,x),\ s,\ \theta,\ \mathbf{x}\big)$$`, '검출 단계(4장): 위치·스케일 · 기술 단계(6장): 방향·특징 벡터']],
      });
      const props = [
        ['반복성', 'repeatability', '같은 물체를 다른 시점·조명·크기로 찍어도 같은 곳에서 다시 검출된다.'],
        ['분별력', 'distinctiveness', '다른 곳의 특징과 헷갈리지 않도록 서로 충분히 다르다.'],
        ['지역성', 'locality', '작은 영역만 보고 정한다 → 가림(occlusion)과 배경 변화에 강하다.'],
        ['정확성', 'accuracy', '검출된 위치(와 스케일)가 정확하다.'],
        ['적당한 양', 'quantity', '물체를 표현할 만큼 충분하되, 너무 많아 계산을 망치지 않는다.'],
        ['계산 효율', 'efficiency', '실시간 응용에 쓸 수 있을 만큼 빠르다.'],
      ];
      // perception experiment: click anywhere, see how brightness changes when the window is shifted in 8 directions
      // Fig 4-4: the three points marked on the deer photo
      const DEER = { a: [83, 81], b: [135, 102], c: [23, 30] };
      let pt = DEER.a.slice();
      const iv = UI.FeatView({ caption: '영상을 클릭해 보세요 — 9×9 창을 8방향으로 한 화소씩 옮겨 봅니다', onClick: (y, x) => { pt = [y, x]; abSeg.set(null); draw(); } });
      const sBox = h('div');
      function draw() {
        const g = pk.gray();
        const fig = pk.key === 'deer' ? Object.entries(DEER).map(([n, [y, x]]) => ({ kind: 'cross', y, x, color: '--bad', size: 5 })) : [];
        iv.draw(g, 'gray', { marks: [...fig, ...(pt ? [{ kind: 'rect', y: pt[0] - 4, x: pt[1] - 4, hh: 9, ww: 9 }] : [])] });
        if (!pt) { sBox.replaceChildren(h('p', { class: 'caption' }, '아직 고른 점이 없습니다.')); return; }
        const S = CV.moravecS(g, pt[0], pt[1], 4), mx = Math.max(1, ...S.flat());
        const vals = [S[1][2], S[1][0], S[2][1], S[0][1], S[0][0], S[0][2], S[2][0], S[2][2]], lo = Math.min(...vals), hi = Math.max(...vals);
        const cls = hi < 2000 ? ['모든 방향으로 변화가 적다 → 평탄한 곳 (나쁜 특징)', 'pill'] : lo < hi * 0.15 ? ['어느 방향은 변화가 적고 어느 방향은 크다 → 에지 (애매한 특징)', 'pill hot'] : ['모든 방향으로 변화가 크다 → 코너 (좋은 특징)', 'pill ok'];
        const gv = UI.GridView({ rows: 3, cols: 3, cs: 62, fs: 11, rowLabels: ['-1', '0', '1'], colLabels: ['-1', '0', '1'], cell: (y, x) => { const t = S[y][x] / mx, v = Math.round(20 + t * 225); return { t: Math.round(S[y][x]), bg: `rgb(${v},${v},${v})`, color: v > 140 ? '#1b211d' : '#fff' }; } });
        gv.draw();
        sBox.replaceChildren(h('div', { class: 'row' }, h('div', { class: 'col' }, h('span', { class: 'caption' }, `S(v,u) 맵 — 점 (${pt[0]}, ${pt[1]})${ptN() ? ' = 그림 4-4의 ' + ptN() : ''}, 밝을수록 큰 값`), gv.el),
          h('div', { class: 'col', style: { maxWidth: '300px' } }, h('span', { class: cls[1] }, cls[0]), h('p', { class: 'caption' }, `가장 작은 변화 ${Math.round(lo)}, 가장 큰 변화 ${Math.round(hi)}. 사람에게 짝을 찾기 쉬운 곳(여러 방향으로 밝기가 바뀌는 곳)이 컴퓨터에게도 쉽습니다. 이 “좋은 정도”를 숫자로 만든 것이 다음 절의 특징 가능성 C입니다.`))));
      }
      const ptN = () => (pk.key === 'deer' ? Object.keys(DEER).find(k => DEER[k][0] === pt[0] && DEER[k][1] === pt[1]) : null);
      const pk = UI.figPicker('deer', () => draw());
      const abSeg = UI.segmented([['a', 'a (뿔·코너)'], ['b', 'b (다리·에지)'], ['c', 'c (풀밭·평탄)']], 'a', v => { pk.set('deer'); pt = DEER[v].slice(); draw(); }, '그림 4-4의 점');
      root.append(
        h('div', { class: 'lab' },
          h('div', { class: 'stack' },
            h('div', { class: 'card' }, h('h3', {}, '인지 실험: 어떤 점이 짝 찾기 쉬운가', h('small', {}, '4.1.3 · 그림 4-4')), h('div', { class: 'controls' }, pk.el, abSeg), h('div', { style: { marginTop: '10px' } }, iv.el)),
            h('div', { class: 'card' }, h('h3', {}, '창을 옮겼을 때의 변화량', h('small', {}, '9×9 마스크로 측정 (그림 4-4)')), sBox)),
          h('div', { class: 'stack' },
            h('div', { class: 'card' }, h('h3', {}, '지역 특징이 갖춰야 할 성질', h('small', {}, '4.1.2')), UI.dataTable(['성질', '영문', '뜻'], props.map(p => [h('b', {}, p[0]), p[1], p[2]])),
              h('p', { class: 'note warn', style: { marginTop: '10px' } }, '이 성질들은 서로 길항(trade-off) 관계입니다. 예: 분별력을 높이려 영역을 넓히면 지역성이 떨어지고, 양을 늘리면 계산 효율이 떨어집니다. 그래서 응용에 맞는 특징을 골라야 합니다.')),
            h('div', { class: 'card' }, h('h3', {}, '특징 검출의 역사', h('small', {}, '4.1.1')),
              h('ul', { class: 'caption', style: { margin: 0, paddingLeft: '18px' } },
                h('li', {}, '80년대: 에지 토막의 곡률이 큰 곳 = 코너 / dominant point 검출 연구가 활발'),
                h('li', {}, '90년대 소강, 2000년대 사라짐 — 더 좋은 대안이 나왔기 때문'),
                h('li', {}, '지역 특징: 명암 영상에서 직접 검출, 기준은 “코너다움”이 아니라 반복성'))))));
      draw();
    },
  });

  // ================= 4.2.1 Moravec =================
  APP.mod({
    id: 'moravec', ch: '4', num: '4.2.1', title: '모라벡 알고리즘', src: '4강 p.8–11 · 식 (4.1)(4.2), 예제 4-1, 그림 4-3·4-4', star: true,
    blurb: '창을 한 화소씩 옮기며 제곱차의 합 S(v,u)를 계산. 예제 4-1의 점 b를 한 항씩 따라가기.',
    mount(root, m) {
      APP.scaffold(root, m, {
        lead: '점 주위의 창(마스크 w)을 (v,u)만큼 옮겼을 때 밝기가 얼마나 바뀌는지를 <b>제곱차의 합</b> S(v,u)로 잽니다. 코너는 모든 방향으로 S가 크고, 에지는 에지를 따라가는 방향으로만 작고, 평탄한 곳은 모두 작습니다. 그래서 <b>네 방향 중 가장 작은 값</b>을 특징 가능성 C로 씁니다. 왼쪽 격자를 클릭해 점을 고르고(값 바꾸기 모드에서는 0/1 토글), 단계 실행기로 예제 4-1을 따라가 보세요.',
        formulas: [[R`$$S(v,u)=\sum_y\sum_x w(y,x)\,\big(f(y+v,x+u)-f(y,x)\big)^2$$`, '식 (4.1)'], [R`$$C=\min\big(S(0,1),\,S(0,-1),\,S(1,0),\,S(-1,0)\big)$$`, '식 (4.2)']],
      });
      let f = APP.parseGrid(F43), pt = [5, 3], r = 1, mode = 'pick', frame = null, Cmap = null;
      const CODE = [
        '// 점 (y0,x0)에서 S(v,u) 맵 계산 — w는 (2r+1)×(2r+1) 박스(값 1)',
        'for(v=-1 to 1) for(u=-1 to 1) {',
        '  S(v,u) = 0;',
        '  for(y=y0-r to y0+r) for(x=x0-r to x0+r)   // w(y,x)=1인 곳',
        '    S(v,u) += (f(y+v,x+u) - f(y,x))²;',
        '}',
        'C = min(S(0,1), S(0,-1), S(1,0), S(-1,0));   // 식 (4.2)',
      ];
      const st = UI.Stepper({ code: CODE, title: '식 (4.1) → 식 (4.2)', render: fr => { frame = fr; draw(); } });
      const gF = UI.GridView({
        rows: 12, cols: 12, cs: 30, fs: 12, label: '입력 영상 f',
        cell: (y, x) => {
          const s = { t: f[y][x], cls: f[y][x] ? 'on' : '' };
          if (frame && frame.y !== undefined) {
            if (Math.abs(y - pt[0]) <= r && Math.abs(x - pt[1]) <= r) s.cls += ' win';
            if (Math.abs(y - pt[0] - frame.v) <= r && Math.abs(x - pt[1] - frame.u) <= r) s.cls += ' win2';
          }
          const n = ptName(y, x); if (n) s.badge = n;
          if (y === pt[0] && x === pt[1]) s.cls += ' cur';
          return s;
        },
        onClick: (y, x) => { if (mode === 'pick') pt = [y, x]; else f[y][x] ^= 1; rebuild(); },
      });
      const gS = UI.GridView({ rows: 3, cols: 3, cs: 52, fs: 15, rowLabels: ['-1', '0', '1'], colLabels: ['-1', '0', '1'], label: 'S(v,u)', cell: (y, x) => {
        if (!frame) return {};
        const v = frame.S[y][x]; const s = { t: v === null ? '' : v };
        if (v !== null) Object.assign(s, APP.grayCell(v, 9));
        if (frame.v === y - 1 && frame.u === x - 1) s.cls = 'cur';
        if (frame.fin && ((y === 1) !== (x === 1))) s.bold = true;
        return s;
      } });
      const gC = UI.GridView({ rows: 12, cols: 12, cs: 22, fs: 10, label: 'C 맵', cell: (y, x) => (Cmap ? { t: Cmap[y][x] || '', ...APP.grayCell(Cmap[y][x], Math.max(1, ...Cmap.flat())), cls: y === pt[0] && x === pt[1] ? 'cur' : '' } : {}), onClick: (y, x) => { pt = [y, x]; rebuild(); } });
      const res = h('div');
      function rebuild() {
        Cmap = CV.moravecMap(f, r);
        const [y0, x0] = pt, fr = [], S = [[null, null, null], [null, null, null], [null, null, null]];
        fr.push({ line: 1, S: CV.clone(S), vars: { y0, x0, '마스크': `${2 * r + 1}×${2 * r + 1}` }, note: `점 (${y0}, ${x0})${ptName(y0, x0) ? ' = 교재의 점 ' + ptName(y0, x0) : ''} 주위 ${2 * r + 1}×${2 * r + 1} 창(주황)을 (v,u)만큼 옮긴 창(파랑)과 비교합니다.` });
        for (let v = -1; v <= 1; v++) for (let u = -1; u <= 1; u++) {
          let s = 0;
          fr.push({ line: [2, 3], v, u, y: y0, x: x0, S: CV.clone(S), vars: { v, u, 'S(v,u)': 0 }, note: `(v,u) = (${v}, ${u}) — 창을 ${v ? (v > 0 ? '아래로 ' : '위로 ') + Math.abs(v) : ''}${v && u ? ', ' : ''}${u ? (u > 0 ? '오른쪽으로 ' : '왼쪽으로 ') + Math.abs(u) : ''}${!v && !u ? '옮기지 않으면 항상 0' : ' 옮깁니다'}.` });
          for (let y = y0 - r; y <= y0 + r; y++) for (let x = x0 - r; x <= x0 + r; x++) {
            const a = CV.inside(f, y + v, x + u) ? f[y + v][x + u] : 0, b = CV.inside(f, y, x) ? f[y][x] : 0, d = (a - b) ** 2;
            s += d;
            if (d || r === 1) fr.push({ line: [4, 5], v, u, y, x, S: CV.clone(S), vars: { v, u, y, x, 'f(y+v,x+u)': a, 'f(y,x)': b, '(차)²': d, 'S(v,u)': s }, note: `f(${y + v},${x + u}) − f(${y},${x}) = ${a} − ${b} → 제곱 <b>${d}</b>, 누적 S(${v},${u}) = ${s}` });
          }
          S[v + 1][u + 1] = s;
          fr.push({ line: 6, v, u, y: y0, x: x0, S: CV.clone(S), vars: { v, u, 'S(v,u)': s }, note: `S(${v}, ${u}) = <b>${s}</b>` });
        }
        const C = CV.moravecC(S);
        fr.push({ line: 7, S: CV.clone(S), fin: true, vars: { 'S(0,1)': S[1][2], 'S(0,-1)': S[1][0], 'S(1,0)': S[2][1], 'S(-1,0)': S[0][1], C }, note: `C = min(${S[1][2]}, ${S[1][0]}, ${S[2][1]}, ${S[0][1]}) = <b>${C}</b> — 상하좌우 네 방향(굵게)만 봅니다. 대각선 값은 쓰지 않습니다.` + (ptName(y0, x0) === 'b' && r === 1 ? ' 교재 예제 4-1의 S 맵(3 1 6 / 3 0 4 / 3 0 3)과 같습니다.' : '') });
        st.load(fr, frame ? Math.min(st.i, fr.length - 1) : 0);
        const row = k => { const S2 = CV.moravecS(f, ...PTS[k], r); return [h('b', {}, k + ' ' + JSON.stringify(PTS[k])), S2.map(rr => rr.join(' ')).join(' / '), CV.moravecC(S2)]; };
        res.replaceChildren(UI.dataTable(['점', 'S(v,u) 맵 (행별)', 'C'], ['a', 'b', 'c'].map(row)), h('p', { class: 'caption' }, '그림 4-3(b): a(코너)는 모든 방향으로 값이 크고, b(에지)는 에지를 따라가는 방향 (−1,0)·(1,0)… 중 일부가 작고, c(평탄)는 모두 0입니다. 그런데 C 맵을 보면 a의 C가 2로 b의 0보다 크기는 하지만, 한 화소·네 방향만 봐서 대각선 에지에서도 값이 나오는 등 한계가 보입니다.'));
      }
      function draw() {
        gF.draw(); gS.draw(); gC.draw();
        if (frame && frame.y !== undefined && frame.line && [].concat(frame.line).includes(5)) gF.overlay([{ type: 'arrow', pts: [frame.y, frame.x, frame.y + frame.v, frame.x + frame.u], color: '--neg' }]); else gF.overlay([]);
      }
      const modeSeg = UI.segmented([['pick', '클릭: 점 고르기'], ['edit', '클릭: 값 0↔1']], mode, v => (mode = v));
      const ptSeg = UI.segmented([['a', '점 a (코너)'], ['b', '점 b (에지)'], ['c', '점 c (평탄)']], 'b', v => { pt = PTS[v].slice(); rebuild(); });
      const rSeg = UI.segmented([[1, '3×3 (교재)'], [2, '5×5']], 1, v => { r = v; rebuild(); });
      root.append(h('div', { class: 'lab' },
        h('div', { class: 'stack' },
          h('div', { class: 'card' }, h('div', { class: 'controls' }, ptSeg, modeSeg, UI.labeled('마스크', rSeg), h('button', { class: 'btn', type: 'button', onclick: () => { f = APP.parseGrid(F43); rebuild(); } }, '그림 4-3 영상으로')),
            h('div', { class: 'row', style: { marginTop: '10px' } },
              h('div', { class: 'col' }, h('span', { class: 'caption' }, '입력 f — 주황: 원래 창, 파랑: (v,u)만큼 옮긴 창, 화살표: 지금 비교하는 두 화소'), gF.el),
              h('div', { class: 'col' }, h('span', { class: 'caption' }, 'S(v,u) 맵 (가로 u, 세로 v)'), gS.el, h('span', { class: 'caption' }, '특징 가능성 C 맵 — 클릭하면 그 점으로'), gC.el))),
          h('div', { class: 'card' }, h('h3', {}, '세 지점의 S 맵', h('small', {}, '그림 4-3(b)')), res),
          h('div', { class: 'card' }, h('h3', {}, '모라벡의 한계'), h('ul', { class: 'caption', style: { margin: 0, paddingLeft: '18px' } }, h('li', {}, '한 화소만큼, 네 방향만 옮겨 본다 → 방향에 따라 값이 달라진다 (회전에 약함).'), h('li', {}, '박스 창이라 잡음에 대한 대처가 없다 → 해리스는 가우시안 가중치와 미분으로 이를 고칩니다.')))),
        h('div', { class: 'stack' }, st.panel)));
      rebuild();
    },
  });

  // ================= 4.2.2 Harris =================
  APP.mod({
    id: 'harris', ch: '4', num: '4.2.2', title: '해리스 코너', src: '4강 p.12–19 · 식 (4.3)–(4.9), 예제 4-2, 표 4-1, 그림 4-5·4-6', star: true,
    blurb: '가우시안 가중 제곱차 → 테일러 확장 → 2차 모멘트 행렬 A → 고유값 → C. 예제 4-2 그대로.',
    mount(root, m) {
      APP.scaffold(root, m, {
        lead: '해리스는 모라벡의 박스 창을 <b>가우시안 G</b>로 바꿔 잡음에 대처하고, 테일러 확장으로 S(v,u)를 <b>(v,u)와 무관한 행렬 A</b>와 u=(v,u)의 곱으로 인수분해했습니다. A만 보면 모든 방향의 변화를 알 수 있습니다: 고유값 <b>둘 다 크면 코너</b>, 하나만 크면 에지, 둘 다 작으면 평탄. 고유값 계산을 피하려고 C = det(A) − k·trace(A)²를 씁니다.',
        formulas: [
          [R`$$S(v,u)\cong\sum_y\sum_x G(y,x)\,(v\,d_y+u\,d_x)^2=\mathbf{u}\mathbf{A}\mathbf{u}^{\mathsf T}$$`, '식 (4.5)'],
          [R`$$\mathbf{A}=\begin{pmatrix}G\circledast d_y^2 & G\circledast d_yd_x\\ G\circledast d_yd_x & G\circledast d_x^2\end{pmatrix}=\begin{pmatrix}p&r\\r&q\end{pmatrix}$$`, '식 (4.7)'],
          [R`$$C=\lambda_1\lambda_2-k(\lambda_1+\lambda_2)^2=(pq-r^2)-k(p+q)^2$$`, '식 (4.8)(4.9)'],
        ],
      });
      let f = APP.parseGrid(F43), pt = [7, 7], k = 0.04, show = 'p', frame = null, HR = null;
      const MAPS = { dy: ['d_y', 'dy', 2], dx: ['d_x', 'dx', 2], dyy: ['d_y²', 'dyy', 4], dxx: ['d_x²', 'dxx', 4], dyx: ['d_y·d_x', 'dyx', 4], p: ['G⊛d_y² = p', 'p', 1], q: ['G⊛d_x² = q', 'q', 1], r: ['G⊛d_yd_x = r', 'r', 1], C: ['C (식 4.9)', 'C', 0.2] };
      const CODE = [
        'd_y = f ⊛ [-1 0 1]ᵀ;  d_x = f ⊛ [-1 0 1];   // 그림 4-5(b)',
        'p = Σ G(j,i)·d_y²(y+j,x+i);    // 3×3 가우시안 σ=1.0',
        'q = Σ G(j,i)·d_x²(y+j,x+i);',
        'r = Σ G(j,i)·d_y·d_x(y+j,x+i);',
        'A = [[p, r], [r, q]];           // 식 (4.7)',
        'λ1, λ2 = A의 고유값;            // 표 4-1',
        'C = (p·q − r²) − k·(p+q)²;      // 식 (4.9)',
      ];
      const st = UI.Stepper({ code: CODE, title: '예제 4-2: 한 점의 행렬 A와 C', render: fr => { frame = fr; draw(); } });
      const gF = UI.GridView({ rows: 12, cols: 12, cs: 24, fs: 11, label: '입력 f', cell: (y, x) => { const s = { t: f[y][x], cls: f[y][x] ? 'on' : '' }; const n = ptName(y, x); if (n) s.badge = n; if (frame && frame.nb && Math.abs(y - pt[0]) <= 1 && Math.abs(x - pt[1]) <= 1) s.cls += ' win'; if (y === pt[0] && x === pt[1]) s.cls += ' cur'; return s; }, onClick: (y, x, e) => { if (e.shiftKey) f[y][x] ^= 1; else pt = [y, x]; rebuild(); } });
      const gM = UI.GridView({ rows: 12, cols: 12, cs: 40, fs: 10, label: '선택한 맵', cell: (y, x) => {
        if (!HR) return {};
        const [, key, amax] = MAPS[show], v = HR[key][y][x];
        const s = { t: key === 'dy' || key === 'dx' || key === 'dyy' || key === 'dxx' || key === 'dyx' ? (v || '') : f3(v), ...APP.signedCell(v, amax) };
        if (frame && frame.term && y === frame.term[0] && x === frame.term[1]) s.cls = 'cur';
        else if (frame && frame.nb && Math.abs(y - pt[0]) <= 1 && Math.abs(x - pt[1]) <= 1) s.cls = 'win';
        if (y === pt[0] && x === pt[1] && !(frame && frame.term)) s.cls = 'cur';
        return s;
      }, onClick: (y, x) => { pt = [y, x]; rebuild(); } });
      const mapSel = UI.select(Object.entries(MAPS).map(([kk, v]) => [kk, v[0]]), show, v => { show = v; gM.draw(); }, 'hr-map');
      const Abox = h('div'), tbl = h('div'), lam = h('canvas', { 'aria-label': '고유값 평면' });
      function rebuild() {
        HR = CV.harris(f, { k });
        const [y0, x0] = pt, fr = [], G = CV.BOOK_G;
        const nb = []; for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) nb.push([j, i]);
        const at = (mp, y, x) => (CV.inside(f, y, x) ? HR[mp][y][x] : 0);
        fr.push({ line: 1, nb: true, vars: { y: y0, x: x0, 'd_y(y,x)': at('dy', y0, x0), 'd_x(y,x)': at('dx', y0, x0) }, show: 'dy', note: `d<sub>y</sub>(y,x) = f(y+1,x) − f(y−1,x), d<sub>x</sub>(y,x) = f(y,x+1) − f(y,x−1). 점 (${y0}, ${x0}) 주위 3×3에서 이 값들을 G로 가중 평균합니다.` });
        let acc = { p: 0, q: 0, r: 0 };
        [['p', 'dyy', 2, 'd_y²'], ['q', 'dxx', 3, 'd_x²'], ['r', 'dyx', 4, 'd_y·d_x']].forEach(([key, src, line, nm]) => {
          for (const [j, i] of nb) {
            const y = y0 + j, x = x0 + i, w = G[j + 1][i + 1], v = at(src, y, x);
            acc[key] += w * v;
            fr.push({ line, nb: true, term: [y, x], show: src, vars: { j, i, 'G(j,i)': w, [nm]: v, [key]: +acc[key].toFixed(4) }, note: `G(${j},${i}) × ${nm}(${y},${x}) = ${w} × ${v} = ${(w * v).toFixed(4)} → ${key} = <b>${acc[key].toFixed(4)}</b>` });
          }
        });
        const p = acc.p, q = acc.q, r = acc.r, [l1, l2] = CV.eig2(p, r, q), C = p * q - r * r - k * (p + q) ** 2;
        fr.push({ line: 5, show: 'p', A: [[p, r], [r, q]], vars: { p: +p.toFixed(3), q: +q.toFixed(3), r: +r.toFixed(3) }, note: `A = [[${p.toFixed(3)}, ${r.toFixed(3)}], [${r.toFixed(3)}, ${q.toFixed(3)}]]` + (ptName(y0, x0) === 'a' ? ' — 교재 예제 4-2의 점 a와 같습니다 (0.522, −0.199, 0.527).' : '') });
        fr.push({ line: 6, show: 'p', A: [[p, r], [r, q]], lam: [l1, l2], vars: { 'λ1': +l1.toFixed(4), 'λ2': +l2.toFixed(4) }, note: `λ1 = ${l1.toFixed(4)}, λ2 = ${l2.toFixed(4)} → <b>${kindOf(l1, l2, 0.5)[0]}</b>. 고유값은 A가 나타내는 두 주축 방향의 변화량입니다.` });
        fr.push({ line: 7, show: 'C', A: [[p, r], [r, q]], lam: [l1, l2], vars: { 'det(A)': +(p * q - r * r).toFixed(4), 'trace(A)': +(p + q).toFixed(4), k, C: +C.toFixed(4) }, note: `C = (${p.toFixed(3)}×${q.toFixed(3)} − ${r.toFixed(3)}²) − ${k}×(${(p + q).toFixed(3)})² = <b>${C.toFixed(4)}</b>. 고유값으로 계산해도 λ1λ2 − k(λ1+λ2)² = ${(l1 * l2 - k * (l1 + l2) ** 2).toFixed(4)}로 같습니다.` });
        st.load(fr, frame ? Math.min(st.i, fr.length - 1) : 0);
        tbl.replaceChildren(UI.dataTable(['', 'a (7,7)', 'b (5,3)', 'c (2,8)'], (() => {
          const cols = ['a', 'b', 'c'].map(n => { const [y, x] = PTS[n], P = HR.p[y][x], Q = HR.q[y][x], Rr = HR.r[y][x], [a1, a2] = CV.eig2(P, Rr, Q); return { P, Q, Rr, a1, a2, C: HR.C[y][x] }; });
          return [['A', ...cols.map(c => UI.matrixEl([[c.P, c.Rr], [c.Rr, c.Q]]))], ['고유값', ...cols.map(c => `λ1=${c.a1.toFixed(4)}, λ2=${c.a2.toFixed(4)}`)], ['C', ...cols.map(c => c.C.toFixed(4))]];
        })()), h('p', { class: 'caption' }, `교재 표 4-1: a C=0.1925, b C=0.0237, c C=0 (k=0.04). a의 C는 교재 행렬(0.522, −0.199, 0.527)을 식 (4.9)에 넣으면 0.1915가 되어, 교재 값 0.1925는 반올림·계산 차이로 보입니다. 순서(a ≫ b > c)는 같습니다.`));
      }
      function drawLam() {
        const pts = ['a', 'b', 'c'].map(n => { const [y, x] = PTS[n]; return [n, ...CV.eig2(HR.p[y][x], HR.r[y][x], HR.q[y][x])]; });
        const P = UI.plot(lam, { w: 320, h: 250, x: [0, 1], y: [0, 1], margin: { l: 36, b: 30 }, xfmt: v => v.toFixed(1), yfmt: v => v.toFixed(1) });
        const c = lam.getContext('2d');
        for (let a = 0; a < 1; a += 0.02) for (let b = 0; b < 1; b += 0.02) { const C = a * b - k * (a + b) ** 2; c.fillStyle = C > 0.02 ? 'rgba(47,125,58,.18)' : C < 0 ? 'rgba(192,57,43,.10)' : 'rgba(0,0,0,0)'; c.fillRect(P.X(a), P.Y(b + 0.02), P.X(a + 0.02) - P.X(a), P.Y(b) - P.Y(b + 0.02)); }
        const cur = frame && frame.lam ? [['●', ...frame.lam]] : [];
        for (const [n, l1, l2] of [...pts, ...cur]) { c.fillStyle = UI.col(n === '●' ? '--orange' : '--ink'); c.beginPath(); c.arc(P.X(Math.min(1, l1)), P.Y(Math.min(1, l2)), n === '●' ? 6 : 4, 0, 7); c.fill(); c.font = '12px sans-serif'; c.textAlign = 'left'; if (n !== '●') c.fillText(n, P.X(Math.min(1, l1)) + 6, P.Y(Math.min(1, l2)) - 4); }
        c.fillStyle = UI.col('--muted'); c.font = '11px sans-serif'; c.textAlign = 'center'; c.fillText('λ1', P.X(0.95), P.Y(0) + 18); c.textAlign = 'left'; c.fillText('λ2', 4, P.Y(0.97));
      }
      function draw() {
        if (frame && frame.show && MAPS[frame.show] && frame.show !== show) { show = frame.show; mapSel.value = show; }
        gF.draw(); gM.draw(); drawLam();
        Abox.replaceChildren(...(frame && frame.A ? [h('span', { class: 'caption' }, 'A = '), UI.matrixEl(frame.A), frame.lam ? h('span', { class: kindOf(...frame.lam, 0.5)[1], style: { marginLeft: '10px' } }, kindOf(...frame.lam, 0.5)[0]) : null] : [h('span', { class: 'caption' }, '단계를 끝까지 진행하면 A와 고유값이 여기에 나옵니다.')]));
      }
      // real image
      let sig = 1.5, thr = 0.02, useNms = false;
      const iv = UI.FeatView({ caption: '' });
      function real() {
        const g = pk.gray().map(r => r.map(v => v / 255)), Hm = CV.harris(g, { G: CV.gaussKernel2D(sig), k, border: 'replicate' });
        const mx = Math.max(...Hm.C.flat()), T = thr * mx;
        let pts = [];
        if (useNms) pts = CV.localMax(Hm.C, T, 8).map(([y, x]) => [y, x]);
        else Hm.C.forEach((r, y) => r.forEach((v, x) => { if (v > T) pts.push([y, x]); }));
        iv.draw(pk.gray(), 'gray', { marks: pts.map(([y, x]) => ({ kind: 'dot', y, x, size: useNms ? 3.5 : 1.6, color: '--neg' })) });
        iv.setCaption(useNms ? `C > ${thr}·max 이면서 8-이웃보다 큰 점 (비최대 억제)` : `C > ${thr}·max 인 모든 화소 — 코너 주위에 덩어리로 몰려 나옴 (그림 4-6)`); iv.setInfo(`${pts.length}개`);
      }
      const pk = UI.figPicker('deer', () => real());
      const ptSeg = UI.segmented([['a', '점 a'], ['b', '점 b'], ['c', '점 c']], 'a', v => { pt = PTS[v].slice(); rebuild(); });
      root.append(h('div', { class: 'lab' },
        h('div', { class: 'stack' },
          h('div', { class: 'card' }, h('div', { class: 'controls' }, ptSeg, UI.labeled('보는 맵', mapSel), UI.slider({ label: 'k', min: 0.02, max: 0.15, step: 0.01, value: k, id: 'hr-k', fmt: v => v.toFixed(2), oninput: v => { k = v; rebuild(); real(); } })),
            h('div', { class: 'row', style: { marginTop: '10px' } },
              h('div', { class: 'col' }, h('span', { class: 'caption' }, '입력 f — 클릭: 점 고르기, Shift+클릭: 0↔1'), gF.el, h('div', {}, Abox)),
              h('div', { class: 'col' }, h('span', { class: 'caption' }, '선택한 맵 (그림 4-5) — 주황 칸이 지금 더하는 항'), gM.el))),
          h('div', { class: 'card' }, h('h3', {}, '세 점의 특징 가능성', h('small', {}, '표 4-1')), h('div', { class: 'row' }, tbl, h('div', { class: 'col' }, h('span', { class: 'caption' }, '고유값 평면: 초록 = C > 0.02 (코너), 빨강 = C < 0 (에지)'), lam))),
          h('div', { class: 'card' }, h('h3', {}, '실제 영상에 적용', h('small', {}, '그림 4-6')),
            h('div', { class: 'controls' }, pk.el, UI.slider({ label: 'G의 σ', min: 0.7, max: 3, step: 0.1, value: sig, id: 'hr-s', fmt: v => v.toFixed(1), oninput: v => { sig = v; real(); } }), UI.slider({ label: '임계값 (×max)', min: 0.002, max: 0.2, step: 0.002, value: thr, id: 'hr-t', fmt: v => v.toFixed(3), oninput: v => { thr = v; real(); } }),
              UI.segmented([[false, '임계값만'], [true, '+ 비최대 억제']], false, v => { useNms = v; real(); })),
            h('div', { style: { marginTop: '10px' } }, iv.el),
            h('p', { class: 'caption' }, '“코너”라는 이름은 정확하지 않습니다 — 실제로는 무늬가 복잡한 곳 어디서나 C가 커지므로 특징점 또는 관심점(interest point)이라 부르는 편이 낫습니다.'))),
        h('div', { class: 'stack' }, st.panel)));
      rebuild(); real();
    },
  });

  // ================= 4.2.2+ eigenvalues / eigenvectors of A =================
  APP.mod({
    id: 'eigen', ch: '4', num: '4.2.2+', title: '고윳값·고유벡터와 특징 가능성', src: '4강 p.15–17 · 식 (4.7)–(4.9), 표 4-1 — 직접 계산 연습', star: true,
    blurb: '2×2 행렬의 고윳값·고유벡터를 손으로 구하고, 그것으로 C를 재기 → 고윳값 없이 det·trace로 재기.',
    mount(root, m) {
      APP.scaffold(root, m, {
        lead: '해리스의 2차 모멘트 행렬 A는 “창을 방향 u로 옮겼을 때 밝기가 얼마나 바뀌는가” S = uAuᵀ를 담고 있습니다. <b>고유벡터</b>는 A를 곱해도 방향이 바뀌지 않는 방향(Av = λv)이고, 그 방향으로 옮겼을 때의 변화량이 <b>고윳값</b> λ입니다. 그래서 λ1은 가장 크게 변하는 방향의 변화량, λ2는 가장 작게 변하는 방향의 변화량입니다. 아래에서 ① 간단한 예제로 고윳값·고유벡터를 구하고 ② 그 값으로 C를 잰 다음 ③ 고윳값 없이 det·trace로 같은 C를 얻는 과정을 따라가고, 마지막에 직접 풀어 보세요.',
        formulas: [
          [R`$$\mathbf{A}\mathbf{v}=\lambda\mathbf{v}\ \Leftrightarrow\ \det(\mathbf{A}-\lambda\mathbf{I})=0\ \Leftrightarrow\ \lambda^2-(p+q)\lambda+(pq-r^2)=0$$`, '특성 방정식 (A = [[p r][r q]])'],
          [R`$$\lambda_{1,2}=\frac{p+q}{2}\pm\sqrt{\Big(\frac{p-q}{2}\Big)^2+r^2},\qquad \mathbf{v}=(1,\ \tfrac{\lambda-p}{r})$$`, '2×2 대칭 행렬의 고윳값·고유벡터'],
          [R`$$\lambda_1\lambda_2=\det(\mathbf{A})=pq-r^2,\qquad \lambda_1+\lambda_2=\operatorname{trace}(\mathbf{A})=p+q$$`, '그래서 식 (4.8) = 식 (4.9)'],
        ],
      });
      const PRE = {
        ex: ['간단한 예제', 2, 2, 1], ex2: ['정수 예제 2', 4, 7, -2],
        a: ['표 4-1 점 a (코너)', 0.522, 0.527, -0.199], b: ['표 4-1 점 b (에지)', 0.075, 0.801, -0.075], c: ['표 4-1 점 c (평탄)', 0, 0, 0],
      };
      let [, p, q, r] = PRE.ex, k = 0.04, th = 20, frame = null;
      const nf = v => (Math.abs(v) < 5e-7 ? '0' : Number.isInteger(v) ? String(v) : (+v.toFixed(4)).toString());
      const inP = h('input', { type: 'number', step: 'any', value: p, style: { width: '80px' }, 'aria-label': 'p' }), inQ = h('input', { type: 'number', step: 'any', value: q, style: { width: '80px' }, 'aria-label': 'q' }), inR = h('input', { type: 'number', step: 'any', value: r, style: { width: '80px' }, 'aria-label': 'r' });
      [inP, inQ, inR].forEach(el => el.addEventListener('change', () => { p = +inP.value || 0; q = +inQ.value || 0; r = +inR.value || 0; preSeg.set(null); rebuild(); }));
      const preSeg = UI.segmented(Object.entries(PRE).map(([kk, v]) => [kk, v[0]]), 'ex', v => { [, p, q, r] = PRE[v]; inP.value = p; inQ.value = q; inR.value = r; rebuild(); });
      const eig = () => { const [l1, l2] = CV.eig2(p, r, q); const vec = l => (Math.abs(r) > 1e-12 ? [1, (l - p) / r] : Math.abs(l - p) < 1e-12 && Math.abs(p - q) > 1e-12 ? [1, 0] : Math.abs(p - q) < 1e-12 ? null : [0, 1]); return { l1, l2, v1: vec(l1), v2: vec(l2) }; };
      // components are (y, x) like the book's u = (v, u)
      const CODE = [
        'A = [[p, r], [r, q]];                       // 2차 모멘트 행렬',
        'Av = λv  ⇔  (A − λI)v = 0  ⇔  det(A − λI) = 0;',
        '(p−λ)(q−λ) − r² = 0  →  λ² − (p+q)λ + (pq−r²) = 0;',
        'λ1, λ2 = ((p+q) ± √((p+q)² − 4(pq−r²))) / 2;',
        'v1: (p−λ1)·y + r·x = 0 의 해,  v2: (p−λ2)·y + r·x = 0 의 해;',
        '검산: A·v1 = λ1·v1,  v1 ⟂ v2;',
        'C = λ1·λ2 − k·(λ1+λ2)²;                     // 식 (4.8)',
        'det = p·q − r²;  trace = p + q;              // 고윳값 없이',
        'C = det − k·trace²;                          // 식 (4.9) — 같은 값',
        '판정: 둘 다 크면 코너, 하나만 크면 에지, 둘 다 작으면 평탄;',
      ];
      const st = UI.Stepper({ code: CODE, title: '고윳값 → C,  그리고 det·trace → C', render: fr => { frame = fr; draw(); } });
      const cvs = h('canvas', { width: 340, height: 340, style: { width: '100%', maxWidth: '340px', border: '1px solid var(--rule)', borderRadius: '8px', background: 'var(--cell-bg)' } });
      const readout = h('div'), cmp = h('div');
      const thSl = UI.slider({ label: '방향 u의 각도', min: 0, max: 179, step: 1, value: th, id: 'eg-th', fmt: v => v + '°', oninput: v => { th = v; draw(); } });
      const snapBtn = which => h('button', { class: 'btn', type: 'button', onclick: () => { const e = eig(), v = which === 1 ? e.v1 : e.v2; if (!v) return; let a = Math.round(Math.atan2(v[0], v[1]) * 180 / Math.PI); a = ((a % 180) + 180) % 180; th = a; thSl.set(a); draw(); } }, which === 1 ? 'u를 v1 방향으로' : 'u를 v2 방향으로');
      function rebuild() {
        const { l1, l2, v1, v2 } = eig(), det = p * q - r * r, tr = p + q, Ce = l1 * l2 - k * (l1 + l2) ** 2, Cd = det - k * tr * tr, disc = tr * tr - 4 * det;
        const kind = l1 < 1e-9 ? '평탄 (둘 다 0)' : l2 < 0.2 * l1 ? '에지 (하나만 큼)' : '코너 (둘 다 큼)';
        const fr = [
          { line: 1, vars: { p, q, r }, note: `A = [[${nf(p)}, ${nf(r)}], [${nf(r)}, ${nf(q)}]] — 대각선 p = Σd<sub>y</sub>², q = Σd<sub>x</sub>², 비대각 r = Σd<sub>y</sub>d<sub>x</sub>.` },
          { line: 2, vars: { p, q, r }, note: 'v가 0이 아닌데 (A − λI)v = 0이 되려면 A − λI가 역행렬을 갖지 않아야 합니다 → 행렬식 = 0. 이 식을 풀면 λ가 나옵니다.' },
          { line: 3, vars: { 'p+q': tr, 'pq−r²': det }, note: `(${nf(p)}−λ)(${nf(q)}−λ) − (${nf(r)})² = 0 → <b>λ² − ${nf(tr)}λ + ${nf(det)} = 0</b> (특성 방정식). 계수가 바로 trace와 det입니다.` },
          { line: 4, vars: { '판별식': disc, λ1: l1, λ2: l2 }, note: `λ = (${nf(tr)} ± √${nf(disc)}) / 2 → <b>λ1 = ${nf(l1)}, λ2 = ${nf(l2)}</b>. 대칭 행렬이라 판별식 (p−q)² + 4r² ≥ 0, 고윳값은 항상 실수입니다.` },
          { line: 5, vars: { v1: v1 ? `(1, ${nf(v1[1])})` : '모든 방향', v2: v2 ? `(1, ${nf(v2[1])})` : '모든 방향' }, eig: true, note: v1 ? `v = (v<sub>y</sub>, v<sub>x</sub>)의 첫 성분을 1로 두고 (A − λI)v = 0의 첫 줄 (p−λ)·1 + r·v<sub>x</sub> = 0을 풀면 v<sub>x</sub> = (λ−p)/r: <b>v1 = (1, ${nf(v1[1])})</b>, <b>v2 = (1, ${nf(v2[1])})</b>. 그림의 주황(v1)·파랑(v2) 화살표.` : 'A가 단위행렬의 상수배라 모든 방향이 고유벡터입니다 (변화량이 방향과 무관).' },
          { line: 6, vars: { 'v1·v2': v1 && v2 ? +(v1[0] * v2[0] + v1[1] * v2[1]).toFixed(6) : '-' }, eig: true, note: v1 ? `A·v1 = (${nf(p * v1[0] + r * v1[1])}, ${nf(r * v1[0] + q * v1[1])}) = ${nf(l1)}×(${nf(v1[0])}, ${nf(v1[1])}) ✔. 두 고유벡터의 내적 = 0 → 서로 수직. “u를 v1 방향으로” 버튼을 눌러 Au가 u와 겹치는지 보세요.` : '검산할 고유벡터 방향이 정해지지 않습니다.' },
          { line: 7, vars: { 'λ1λ2': l1 * l2, '(λ1+λ2)²': (l1 + l2) ** 2, k, C: Ce }, eig: true, note: `C = ${nf(l1)}×${nf(l2)} − ${k}×(${nf(l1)}+${nf(l2)})² = <b>${nf(Ce)}</b>` },
          { line: 8, vars: { det, trace: tr }, eig: true, note: `det = ${nf(p)}×${nf(q)} − (${nf(r)})² = <b>${nf(det)}</b> (= λ1λ2 = ${nf(l1 * l2)}),  trace = ${nf(p)} + ${nf(q)} = <b>${nf(tr)}</b> (= λ1+λ2 = ${nf(l1 + l2)})` },
          { line: 9, vars: { det, trace: tr, k, C: Cd }, eig: true, note: `C = ${nf(det)} − ${k}×${nf(tr)}² = <b>${nf(Cd)}</b> — 식 (4.8)과 같은 값. 제곱근(고윳값) 계산이 필요 없어 모든 화소에서 빠르게 계산할 수 있습니다.` },
          { line: 10, vars: { λ1: l1, λ2: l2, C: Cd }, eig: true, note: `<b>${kind}</b>. C > 0이 크면 코너, C < 0이면 에지(하나만 큰 경우 −k(λ1+λ2)² 항이 이김), C ≈ 0이면 평탄.` },
        ];
        st.load(fr, frame ? Math.min(st.i, fr.length - 1) : 0);
        cmp.replaceChildren(UI.dataTable(['', '식 (4.8) 고윳값', '식 (4.9) det·trace'], [['곱 항', `λ1λ2 = ${nf(l1 * l2)}`, `det = ${nf(det)}`], ['합 항', `λ1+λ2 = ${nf(l1 + l2)}`, `trace = ${nf(tr)}`], ['C', nf(Ce), nf(Cd)]]));
      }
      function draw() {
        const { l1, l2, v1, v2 } = eig(), c = cvs.getContext('2d'), W = 340, cx = 170, cy = 170, R = 130;
        const dpr = Math.min(2, window.devicePixelRatio || 1); if (cvs.width !== W * dpr) { cvs.width = cvs.height = W * dpr; }
        c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, W);
        const sc = R / Math.max(Math.abs(l1), Math.abs(l2), 1e-9), P = (dy, dx, len) => [cx + dx * len * sc, cy + dy * len * sc];
        c.strokeStyle = UI.tok('--rule'); c.lineWidth = 1; c.beginPath(); c.moveTo(10, cy); c.lineTo(W - 10, cy); c.moveTo(cx, 10); c.lineTo(cx, W - 10); c.stroke();
        c.fillStyle = UI.tok('--muted'); c.font = '11px sans-serif'; c.fillText('x (u)', W - 38, cy - 6); c.fillText('y (v)', cx + 6, W - 12);
        // S(θ) = uAuᵀ for unit u, drawn as radius
        c.strokeStyle = UI.tok('--faint'); c.lineWidth = 2; c.beginPath();
        for (let a = 0; a <= 360; a += 2) { const t = a * Math.PI / 180, dy = Math.sin(t), dx = Math.cos(t), S = p * dy * dy + 2 * r * dy * dx + q * dx * dx, [X, Y] = P(dy, dx, S); a ? c.lineTo(X, Y) : c.moveTo(X, Y); }
        c.stroke();
        const arrow = (dy, dx, len, colr, w = 3, label) => { const [X, Y] = P(dy, dx, len); c.strokeStyle = c.fillStyle = UI.col(colr); c.lineWidth = w; c.beginPath(); c.moveTo(cx, cy); c.lineTo(X, Y); c.stroke(); const ang = Math.atan2(Y - cy, X - cx); c.beginPath(); c.moveTo(X, Y); c.lineTo(X - 9 * Math.cos(ang - 0.4), Y - 9 * Math.sin(ang - 0.4)); c.lineTo(X - 9 * Math.cos(ang + 0.4), Y - 9 * Math.sin(ang + 0.4)); c.fill(); if (label) { c.font = '12px sans-serif'; c.fillText(label, X + 5, Y - 5); } };
        const t = th * Math.PI / 180, uy = Math.sin(t), ux = Math.cos(t), Ay = p * uy + r * ux, Ax = r * uy + q * ux, S = uy * Ay + ux * Ax;
        arrow(uy, ux, Math.max(Math.abs(l1), 1e-9) * 0.55, '--ink', 2, 'u');
        if (Math.hypot(Ay, Ax) > 1e-12) arrow(Ay, Ax, 1, '--ok', 2.5, 'Au');
        const showEig = frame && frame.eig;   // eigenvectors on top so they stay visible when Au lines up with them
        if (showEig && v1 && l1 > 1e-12) { const n1 = Math.hypot(...v1), n2 = Math.hypot(...v2); arrow(v1[0] / n1, v1[1] / n1, l1, '--orange', 4, 'λ1·v1'); if (l2 > 1e-12) arrow(v2[0] / n2, v2[1] / n2, l2, '--neg', 4, 'λ2·v2'); }
        const cross = Math.abs(uy * Ax - ux * Ay) / (Math.hypot(Ay, Ax) || 1);
        readout.replaceChildren(h('dl', { class: 'kv' }, h('dt', {}, 'u = (v, u)'), h('dd', {}, `(${uy.toFixed(3)}, ${ux.toFixed(3)})`), h('dt', {}, 'Au'), h('dd', {}, `(${Ay.toFixed(3)}, ${Ax.toFixed(3)})`), h('dt', {}, 'S = uAuᵀ'), h('dd', {}, S.toFixed(4))),
          h('p', { class: cross < 0.01 && Math.hypot(Ay, Ax) > 1e-12 ? 'pill ok' : 'pill' }, cross < 0.01 && Math.hypot(Ay, Ax) > 1e-12 ? `Au ∥ u → u가 고유벡터, S = λ = ${S.toFixed(4)}` : 'Au와 u의 방향이 다름 → 고유벡터 아님'),
          h('p', { class: 'caption' }, `회색 곡선: 방향별 변화량 S(θ) = uAuᵀ (원점에서의 거리). 가장 먼 방향이 v1(최대 λ1 = ${nf(l1)}), 가장 가까운 방향이 v2(최소 λ2 = ${nf(l2)})입니다.`));
      }
      root.append(h('div', { class: 'lab' },
        h('div', { class: 'stack' },
          h('div', { class: 'card' }, h('h3', {}, '① 행렬 고르기'), h('div', { class: 'controls' }, preSeg),
            h('div', { class: 'controls', style: { marginTop: '8px' } }, UI.labeled('p', inP), UI.labeled('q', inQ), UI.labeled('r', inR), UI.slider({ label: 'k', min: 0.02, max: 0.15, step: 0.01, value: k, id: 'eg-k', fmt: v => v.toFixed(2), oninput: v => { k = v; rebuild(); } })),
            h('p', { class: 'caption' }, '“간단한 예제” A = [[2, 1], [1, 2]]: λ² − 4λ + 3 = 0 → λ = 3, 1, v1 = (1, 1), v2 = (1, −1). 먼저 이것을 손으로 풀어 보고 단계 실행기로 확인하세요.')),
          h('div', { class: 'card' }, h('h3', {}, '② 방향 u를 돌려 보기', h('small', {}, 'Av = λv의 뜻')), h('div', { class: 'controls' }, thSl, snapBtn(1), snapBtn(2)),
            h('div', { class: 'row', style: { marginTop: '10px' } }, cvs, h('div', { class: 'col', style: { flex: '1 1 220px' } }, readout))),
          h('div', { class: 'card' }, h('h3', {}, '③ 두 방식 비교', h('small', {}, '식 (4.8) vs 식 (4.9)')), cmp),
          h('div', { class: 'card' }, h('h3', {}, '④ 직접 풀어 보기', h('small', {}, '채점 · 단계별 풀이')), h('p', { class: 'caption' }, '고윳값·고유벡터 → 고윳값으로 C → det·trace로 C 순서로 풀어 보세요. 보통 난이도의 det·trace 문제는 화소 미분값에서 A를 만드는 것부터 시작합니다. “문제 풀기” 페이지에도 같은 유형이 있습니다.'), QUIZ.panel(['eigen', 'harrisEig', 'harrisDet'], 'eigen', 'eig4'))),
        h('div', { class: 'stack' }, st.panel)));
      rebuild();
    },
  });

  // ================= 4.2.3 Hessian =================
  APP.mod({
    id: 'hessian', ch: '4', num: '4.2.3', title: '2차 미분: 헤시안과 LOG', src: '4강 p.20 · 식 (4.11)–(4.13)',
    blurb: '가우시안으로 스무딩한 뒤의 2차 미분 행렬 H. 행렬식(det)과 대각합(LOG)을 특징 가능성으로.',
    mount(root, m) {
      APP.scaffold(root, m, {
        lead: '1차 미분 대신 <b>2차 미분</b>을 모은 헤시안 행렬 H를 씁니다. 잡음 때문에 먼저 σ 가우시안으로 스무딩한 뒤 미분합니다. <b>행렬식 det(H)</b>는 두 방향 곡률이 모두 클 때(블롭·코너) 커지고, <b>대각합 trace(H) = LOG</b>는 3장의 라플라시안과 같아 블롭과 에지 모두에 반응합니다. 영상을 클릭하면 그 점의 H를 보여 줍니다.',
        formulas: [
          [R`$$\mathbf{H}=\begin{pmatrix}d_{yy}(\sigma)&d_{yx}(\sigma)\\d_{yx}(\sigma)&d_{xx}(\sigma)\end{pmatrix},\quad d_{st}(\sigma)=\frac{\partial}{\partial t}\Big(\frac{\partial}{\partial s}\big(G(y,x,\sigma)\circledast f(y,x)\big)\Big)$$`, '식 (4.11)'],
          [R`$$C=\det(\mathbf{H})=d_{yy}(\sigma)d_{xx}(\sigma)-d_{yx}(\sigma)^2$$`, '식 (4.12)'],
          [R`$$C=\nabla^2=\operatorname{trace}(\mathbf{H})=d_{yy}(\sigma)+d_{xx}(\sigma)$$`, '식 (4.13)'],
        ],
      });
      let sig = 2, which = 'det', pt = null, thr = 0.1;
      const ivS = UI.FeatView({ caption: '', width: 420, onClick: (y, x) => { pt = [y, x]; draw(); } }), ivM = UI.FeatView({ caption: '', width: 420, onClick: (y, x) => { pt = [y, x]; draw(); } });
      const info = h('div');
      function draw() {
        const g = pk.gray(), Hs = CV.hessian(g, sig), map = which === 'det' ? Hs.det : Hs.lap;
        const resp = which === 'det' ? map : map.map(r => r.map(Math.abs)), mx = Math.max(...resp.flat());
        const pts = CV.localMax(resp, thr * mx, 8);
        const marks = pts.map(([y, x]) => ({ y, x, r: sig * Math.SQRT2, color: '--orange', w: 1.5 }));
        if (pt) marks.push({ kind: 'cross', y: pt[0], x: pt[1], color: '--neg', size: 6 });
        ivS.draw(Hs.g, 'gray', { marks }); ivS.setCaption(`σ=${sig} 스무딩 영상 + 검출점 (원 반지름 √2σ)`); ivS.setInfo(`${pts.length}개`);
        ivM.draw(map, 'signed', { marks: pt ? [{ kind: 'cross', y: pt[0], x: pt[1], color: '--ink', size: 6 }] : [] }); ivM.setCaption(which === 'det' ? 'det(H) — 주황 +, 파랑 −' : 'LOG = d_yy + d_xx — 주황 +, 파랑 −');
        if (!pt) { info.replaceChildren(h('p', { class: 'caption' }, '영상을 클릭해 보세요.')); return; }
        const [y, x] = pt, A = [[Hs.dyy[y][x], Hs.dyx[y][x]], [Hs.dyx[y][x], Hs.dxx[y][x]]], [l1, l2] = CV.eig2(A[0][0], A[0][1], A[1][1]);
        info.replaceChildren(h('div', { class: 'row' }, h('span', { class: 'caption' }, `(${y}, ${x})  H = `), UI.matrixEl(A, 2)),
          h('dl', { class: 'kv' }, h('dt', {}, 'det(H)'), h('dd', {}, Hs.det[y][x].toFixed(2)), h('dt', {}, 'trace(H)'), h('dd', {}, Hs.lap[y][x].toFixed(2)), h('dt', {}, '고유값'), h('dd', {}, `${l1.toFixed(2)}, ${l2.toFixed(2)}`)),
          h('p', { class: 'caption' }, l1 * l2 > 0 ? '두 고유값의 부호가 같음 → 두 방향 모두 볼록/오목 (블롭 중심, det > 0)' : '두 고유값의 부호가 다르거나 하나가 0에 가까움 → 에지나 안장점 (det ≤ 0)'));
      }
      const pk = UI.figPicker('deer', () => draw());
      root.append(h('div', { class: 'card' }, h('div', { class: 'controls' }, pk.el, UI.segmented([['det', 'det(H) (식 4.12)'], ['lap', 'LOG (식 4.13)']], which, v => { which = v; draw(); }), UI.slider({ label: 'σ', min: 1, max: 6, step: 0.5, value: sig, id: 'hs-s', fmt: v => v.toFixed(1), oninput: v => { sig = v; draw(); } }), UI.slider({ label: '임계값 (×max)', min: 0.01, max: 0.6, step: 0.01, value: thr, id: 'hs-t', fmt: v => v.toFixed(2), oninput: v => { thr = v; draw(); } })),
        h('div', { class: 'row', style: { marginTop: '12px' } }, h('div', { class: 'col', style: { flex: '1 1 380px' } }, ivS.el), h('div', { class: 'col', style: { flex: '1 1 380px' } }, ivM.el), h('div', { class: 'col', style: { flex: '1 1 220px' } }, info))),
        h('p', { class: 'note', style: { marginTop: '16px' } }, 'σ를 키우면 작은 무늬는 사라지고 큰 블롭에서만 반응합니다. σ가 곧 “얼마나 큰 구조를 찾는가”를 정하는 스케일이며, 4.4절에서 이 σ를 자동으로 고르는 방법을 배웁니다. 행렬식은 SURF(4.4.4)가, LOG는 SIFT의 DOG(4.4.3)가 근사해 씁니다.'));
      draw();
    },
  });

  // ================= 4.2.4 SUSAN =================
  function susanScene(n = 26) {
    const f = CV.zeros(n, n, 90), tri = [[4, 13], [20, 3], [20, 23]];
    const sgn = (p, a, b) => (p[1] - b[1]) * (a[0] - b[0]) - (a[1] - b[1]) * (p[0] - b[0]);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const p = [y, x], d1 = sgn(p, tri[0], tri[1]), d2 = sgn(p, tri[1], tri[2]), d3 = sgn(p, tri[2], tri[0]);
      if (!((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0))) f[y][x] = 210;
    }
    return f;
  }
  const SPTS = { a: [20, 3], b: [12, 8], c: [6, 4] };
  APP.mod({
    id: 'susan', ch: '4', num: '4.2.4', title: '슈산 (SUSAN)', src: '4강 p.21 · 식 (4.14)(4.15), 그림 4-7·4-8', star: true,
    blurb: '원형 마스크 안에서 중심과 밝기가 비슷한 화소의 넓이(USAN)를 세기. 넓이가 작을수록 코너.',
    mount(root, m) {
      APP.scaffold(root, m, {
        lead: '미분을 쓰지 않는 방법입니다. 7×7 원형 마스크(넓이 37)를 화소 r<sub>0</sub>에 놓고, 중심과 밝기 차이가 t<sub>1</sub> 이하인 화소 수 <b>usan_area</b>를 셉니다. 평탄한 곳(c)은 거의 37, 에지(b)는 약 절반, 코너(a)는 그보다 더 작습니다. 그래서 usan_area가 t<sub>2</sub> 이하일 때 <b>q − usan_area</b>를 특징 가능성으로 씁니다 (Small Univalue Segment Assimilating Nucleus).',
        formulas: [
          [R`$$usan\_area(r_0)=\sum_r s(r,r_0),\qquad s(r,r_0)=\begin{cases}1,&|f(r)-f(r_0)|\le t_1\\0,&\text{그렇지 않으면}\end{cases}$$`, '식 (4.14)'],
          [R`$$C=\begin{cases}q-usan\_area(r_0),&usan\_area(r_0)\le t_2\\0,&\text{그렇지 않으면}\end{cases}$$`, '식 (4.15)'],
        ],
      });
      let noise = 0, f = susanScene(), pt = SPTS.a.slice(), t1 = 27, t2 = 18, frame = null, res = null;
      const mk = () => { const g = susanScene(), r = UI.rng(3); return noise ? g.map(rw => rw.map(v => Math.round(CV.clamp(v + (r() - 0.5) * 2 * noise, 0, 255)))) : g; };
      const CODE = [
        'usan_area = 0;',
        'for(r = 원형 마스크의 37칸) {       // 그림 4-8',
        '  if(|f(r) − f(r0)| ≤ t1) s = 1;   // 식 (4.14)',
        '  else s = 0;',
        '  usan_area += s;',
        '}',
        'if(usan_area ≤ t2) C = q − usan_area;   // 식 (4.15), q = t2',
        'else C = 0;',
      ];
      const st = UI.Stepper({ code: CODE, title: '한 점의 USAN 넓이와 C', render: fr => { frame = fr; draw(); } });
      const n = f.length;
      const gF = UI.GridView({ rows: n, cols: n, cs: 19, fs: 8, axes: false, label: '영상', cell: (y, x) => {
        const s = { bg: UI.grayBg(f[y][x]) };
        const j = y - pt[0], i = x - pt[1];
        if (Math.abs(j) <= 3 && Math.abs(i) <= 3 && CV.SUSAN_MASK[j + 3][i + 3] && frame && frame.done) {
          const k = (j + 3) * 7 + (i + 3), d = frame.done.get(k);
          if (d !== undefined) s.bg = d ? 'color-mix(in srgb, var(--ok) 55%, var(--cell-bg))' : 'color-mix(in srgb, var(--bad) 45%, var(--cell-bg))';
          else s.cls = 'win';
          if (frame.cur === k) s.cls = 'cur';
        }
        if (j === 0 && i === 0) { s.cls = 'cur'; s.t = '●'; s.color = 'var(--orange)'; }
        const nm = Object.keys(SPTS).find(kk => SPTS[kk][0] === y && SPTS[kk][1] === x); if (nm) s.badge = nm;
        return s;
      }, onClick: (y, x) => { pt = [y, x]; rebuild(); } });
      const ivC = UI.FeatView({ width: 300 }), ivA = UI.FeatView({ width: 300 });
      function rebuild() {
        res = CV.susan(f, t1, t2);
        const [y0, x0] = pt, c0 = f[y0][x0], done = new Map(), fr = [];
        let area = 0;
        fr.push({ line: 1, done: new Map(done), vars: { r0: `(${y0},${x0})`, 'f(r0)': c0, t1, usan_area: 0 }, note: `중심 r0 = (${y0}, ${x0}), 밝기 ${c0}. 마스크 안 37칸을 하나씩 비교합니다.` });
        for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) {
          if (!CV.SUSAN_MASK[j + 3][i + 3]) continue;
          const y = y0 + j, x = x0 + i, k = (j + 3) * 7 + (i + 3);
          if (!CV.inside(f, y, x)) { fr.push({ line: 2, cur: k, done: new Map(done), vars: { r: `(${y},${x})`, usan_area: area }, note: `(${y}, ${x})는 영상 밖이라 세지 않습니다.` }); continue; }
          const d = Math.abs(f[y][x] - c0), s = d <= t1 ? 1 : 0;
          area += s; done.set(k, s);
          fr.push({ line: s ? [3, 5] : [4, 5], cur: k, done: new Map(done), vars: { r: `(${y},${x})`, 'f(r)': f[y][x], '|f(r)−f(r0)|': d, s, usan_area: area }, note: `|${f[y][x]} − ${c0}| = ${d} ${s ? '≤' : '>'} t1=${t1} → s = ${s}${s ? ' (초록: 중심과 비슷)' : ' (빨강: 다름)'}` });
        }
        const C = area <= t2 ? t2 - area : 0;
        fr.push({ line: area <= t2 ? 7 : 8, done: new Map(done), vars: { usan_area: area, t2, q: t2, C }, note: `usan_area = <b>${area}</b> ${area <= t2 ? `≤ t2=${t2} → C = ${t2} − ${area} = <b>${C}</b>` : `> t2=${t2} → C = 0`}. ${area >= 30 ? '거의 다 비슷 → 평탄한 곳' : area >= 15 ? '절반 정도 → 에지' : '절반보다 훨씬 작음 → 코너'}` });
        st.load(fr, 'end');
        ivA.draw(res.area, 'norm', { width: 300, grid: true, marks: [{ kind: 'cross', y: y0, x: x0, color: '--orange', size: 5 }] }); ivA.setCaption('usan_area 맵 (밝을수록 넓음)');
        const peaks = CV.localMax(res.C, 0, 8);
        ivC.draw(res.C, 'norm', { width: 300, grid: true, marks: peaks.map(([y, x]) => ({ y, x, r: 0.9, color: '--orange' })) }); ivC.setCaption('C 맵 + 지역 최대(원)'); ivC.setInfo(`${peaks.length}개`);
      }
      function draw() { gF.draw(); }
      root.append(h('div', { class: 'lab' },
        h('div', { class: 'stack' },
          h('div', { class: 'card' }, h('div', { class: 'controls' }, UI.segmented([['a', '점 a (코너)'], ['b', '점 b (에지)'], ['c', '점 c (평탄)']], 'a', v => { pt = SPTS[v].slice(); rebuild(); }),
            UI.slider({ label: 't1', min: 5, max: 150, step: 1, value: t1, id: 'su-t1', oninput: v => { t1 = v; rebuild(); } }), UI.slider({ label: 't2 (= q)', min: 5, max: 37, step: 1, value: t2, id: 'su-t2', oninput: v => { t2 = v; rebuild(); } }), UI.slider({ label: '잡음', min: 0, max: 60, step: 5, value: 0, id: 'su-n', oninput: v => { noise = v; f = mk(); rebuild(); } })),
            h('div', { class: 'row', style: { marginTop: '10px' } }, h('div', { class: 'col' }, h('span', { class: 'caption' }, '그림 4-7 같은 삼각형 — 클릭해서 중심 r0를 옮기기. 초록: s=1, 빨강: s=0'), gF.el),
              h('div', { class: 'col' }, ivA.el, ivC.el))),
          h('div', { class: 'card' }, h('h3', {}, '원형 마스크', h('small', {}, '그림 4-8 · 넓이 37')), (() => { const g = UI.GridView({ rows: 7, cols: 7, cs: 26, fs: 12, axes: false, cell: (y, x) => ({ t: CV.SUSAN_MASK[y][x] || '', cls: CV.SUSAN_MASK[y][x] ? '' : 'dim' }) }); g.draw(); return g.el; })(),
            h('p', { class: 'caption' }, '교재는 q와 t2를 따로 적었지만 원 논문(Smith & Brady, 1997)은 둘 다 같은 기하 임계값 g(코너는 최대 넓이의 절반 정도)를 씁니다. 여기서는 q = t2로 두었습니다. 잡음을 올려 보면 미분을 쓰지 않아도 t1이 너무 작으면 결과가 흔들리는 것을 볼 수 있습니다.'))),
        h('div', { class: 'stack' }, st.panel)));
      rebuild();
    },
  });

  // ================= 4.3 localisation =================
  APP.mod({
    id: 'locate', ch: '4', num: '4.3', title: '위치 찾기 (비최대 억제)', src: '4강 p.22–26 · 알고리즘 4-1, 그림 4-9~4-11', star: true,
    blurb: '특징 가능성 맵에서 지역 최대만 남기기. 회전에는 불변, 스케일에는 불변이 아님을 직접 확인.',
    mount(root, m) {
      APP.scaffold(root, m, {
        lead: '특징 가능성 C는 코너 주위에서 <b>덩어리로</b> 커지므로 대표점 하나를 골라야 합니다. 알고리즘 4-1은 C가 임계값 T를 넘고 <b>이웃보다 클 때만</b> 특징점으로 취합니다 (비최대 억제). 아래 맵은 예제 4-2 영상에 식 (4.9)를 적용한 그림 4-9(a)입니다.',
        formulas: [
          [R`$$\text{모라벡 } C=\min(S(0,1),S(0,-1),S(1,0),S(-1,0))$$`, '(4.2)'],
          [R`$$\text{해리스 } C=(pq-r^2)-k(p+q)^2$$`, '(4.9)'],
          [R`$$\text{헤시안 } C=d_{yy}d_{xx}-d_{yx}^2$$`, '(4.12)'],
          [R`$$\text{LOG } C=d_{yy}+d_{xx}$$`, '(4.13)'],
          [R`$$\text{슈산 } C=q-usan\_area\ (\le t_2)$$`, '(4.15)'],
        ],
      });
      const Cm = CV.harris(APP.parseGrid(F43)).C;
      let T = 0.02, nb = 4, frame = null;
      const CODE = [
        'for(j=0 to N-1) for(i=0 to M-1)   // 1~3행: 특징 가능성 맵',
        '  (j,i)의 C를 계산하여 m(j,i)에 대입한다.',
        'F = ∅;   // 공집합으로 시작',
        'for(j=1 to N-2)',
        '  for(i=1 to M-2) {',
        '    c = m(j,i);',
        '    if((c>T) and (c>m(j,i+1)) and (c>m(j,i-1)) and (c>m(j+1,i)) and (c>m(j-1,i)))  // 4-이웃',
        '      F = F ∪ (j,i);   // 특징점으로 판정',
        '  }',
      ];
      const st = UI.Stepper({ code: CODE, title: '알고리즘 4-1 지역 특징 검출', render: fr => { frame = fr; draw(); } });
      const NB4 = [[0, 1], [0, -1], [1, 0], [-1, 0]];
      const gM = UI.GridView({ rows: 12, cols: 12, cs: 42, fs: 10, label: '특징 가능성 맵 m', cell: (y, x) => {
        const v = Cm[y][x], s = { t: f3(v), ...APP.signedCell(v, 0.2) };
        if (frame && frame.F && frame.F.some(([a, b]) => a === y && b === x)) { s.bold = true; s.badge = '★'; }
        if (frame && frame.j !== undefined) { if (y === frame.j && x === frame.i) s.cls = 'cur'; else if ((nb === 8 ? CV.DIR8 : NB4).some(([a, b]) => frame.j + a === y && frame.i + b === x)) s.cls = 'win'; }
        return s;
      } });
      const fBox = h('div');
      function rebuild() {
        const F = [], fr = [{ line: [1, 2], F: [], note: '예제 4-2 영상에 해리스 식 (4.9)를 적용한 맵입니다 (k=0.04). 굵은 지역 최대점이 어디인지 예상해 보세요.' }, { line: 3, F: [], vars: { T, '|F|': 0 }, note: 'F를 공집합으로 시작합니다.' }];
        const N = nb === 8 ? CV.DIR8 : NB4;
        for (let j = 1; j < 11; j++) for (let i = 1; i < 11; i++) {
          const c = Cm[j][i], big = c > T, beat = N.map(([a, b]) => c > Cm[j + a][i + b]), ok = big && beat.every(Boolean);
          if (ok) F.push([j, i]);
          if (!big && Math.abs(c) < 1e-9) continue;
          fr.push({ line: ok ? [6, 7, 8] : [6, 7], j, i, F: F.slice(), vars: { j, i, c: +c.toFixed(3), 'c > T': big ? '예' : '아니오', '이웃보다 큼': beat.filter(Boolean).length + '/' + N.length, '|F|': F.length }, note: big ? (ok ? `c = ${c.toFixed(3)} > T이고 ${N.length}개 이웃보다 모두 큼 → <b>특징점 (${j}, ${i})</b>` : `c = ${c.toFixed(3)} > T지만 이웃 중 ${N.length - beat.filter(Boolean).length}개가 같거나 큼 → 억제`) : `c = ${c.toFixed(3)} ≤ T=${T} → 탈락` });
        }
        fr.push({ line: 9, F: F.slice(), vars: { '|F|': F.length }, note: `특징점 ${F.length}개: ${F.map(p => `(${p[0]},${p[1]})`).join(', ')} — 교재 그림 4-9(b)는 세 꼭짓점 (3,3), (7,3), (7,7).` });
        st.load(fr, frame ? Math.min(st.i, fr.length - 1) : 0);
      }
      function draw() { gM.draw(); fBox.replaceChildren(h('span', { class: 'caption' }, `F = { ${(frame && frame.F || []).map(p => `(${p[0]},${p[1]})`).join(', ')} }`)); }
      // invariance experiment
      let meas = 'harris', deg = 0, scl = 1;
      const MEAS = { moravec: '모라벡', harris: '해리스', det: '헤시안 det', log: 'LOG', susan: '슈산' };
      const ivA = UI.FeatView({ width: 400 }), ivB = UI.FeatView({ width: 400 }), rep = h('div');
      function detect(g) {
        let C;
        if (meas === 'moravec') C = CV.moravecMap(g, 2);
        else if (meas === 'harris') C = CV.harris(g.map(r => r.map(v => v / 255)), { G: CV.gaussKernel2D(1.5), border: 'replicate' }).C;
        else if (meas === 'det') C = CV.hessian(g, 2).det;
        else if (meas === 'log') C = CV.hessian(g, 2).lap.map(r => r.map(Math.abs));
        else C = CV.susan(g, 25, 18).C;
        const hh = g.length, ww = g[0].length;
        return CV.localMax(C, 0.08 * Math.max(...C.flat()), 8).filter(([y, x]) => y >= 3 && x >= 3 && y < hh - 3 && x < ww - 3);
      }
      function inv() {
        const g = pk.gray(), W = CV.warp(g, deg, scl), A = detect(g), B = detect(W.img);
        const hb = W.img.length, wb = W.img[0].length;
        const mapped = A.map(([y, x]) => W.map(y, x)).filter(([y, x]) => y >= 3 && x >= 3 && y < hb - 3 && x < wb - 3);
        const hit = mapped.filter(([y, x]) => B.some(([b, a]) => (b - y) ** 2 + (a - x) ** 2 <= 2.25));
        ivA.draw(g, 'gray', { marks: A.map(([y, x]) => ({ y, x, r: 1.6, color: '--orange' })) }); ivA.setCaption('원래 영상'); ivA.setInfo(`${A.length}개`);
        ivB.draw(W.img, 'gray', { width: 400 * scl, marks: [...mapped.map(([y, x]) => ({ kind: 'cross', y, x, color: '--neg', size: 4 })), ...B.map(([y, x]) => ({ y, x, r: 1.6, color: '--orange' }))] }); ivB.setCaption(`${deg}° 회전 · ${scl}배`); ivB.setInfo(`${B.length}개`);
        const pct = mapped.length ? Math.round(hit.length / mapped.length * 100) : 0;
        rep.replaceChildren(h('span', { class: pct >= 60 ? 'pill ok' : pct >= 35 ? 'pill hot' : 'pill bad' }, `반복률 ${pct}%`), h('span', { class: 'caption' }, `  원래 점을 변환한 위치(파랑 +) ${mapped.length}개 중 ${hit.length}개 근처(1.5화소)에서 다시 검출(주황 원)`));
      }
      const pk = UI.figPicker('deer', () => inv());
      root.append(h('div', { class: 'lab' },
        h('div', { class: 'stack' },
          h('div', { class: 'card' }, h('div', { class: 'controls' }, UI.slider({ label: '임계값 T', min: 0, max: 0.15, step: 0.005, value: T, id: 'lc-t', fmt: v => v.toFixed(3), oninput: v => { T = v; rebuild(); } }), UI.segmented([[4, '4-이웃 (교재)'], [8, '8-이웃']], 4, v => { nb = v; rebuild(); })),
            h('div', { class: 'row', style: { marginTop: '10px' } }, h('div', { class: 'col' }, h('span', { class: 'caption' }, '그림 4-9(a) — 주황 칸: 지금 화소, 음영: 비교하는 이웃, ★: 특징점'), gM.el, fBox))),
          h('div', { class: 'card' }, h('h3', {}, '이동·회전에는 불변, 스케일에는?', h('small', {}, '그림 4-10 · 4-11')),
            h('div', { class: 'controls' }, pk.el, UI.labeled('측정', UI.select(Object.entries(MEAS), meas, v => { meas = v; inv(); }, 'lc-m')),
              UI.slider({ label: '회전', min: 0, max: 90, step: 5, value: 0, id: 'lc-r', fmt: v => v + '°', oninput: v => { deg = v; inv(); } }), UI.slider({ label: '스케일', min: 0.4, max: 1, step: 0.05, value: 1, id: 'lc-s', fmt: v => v.toFixed(2), oninput: v => { scl = v; inv(); } })),
            h('div', { style: { margin: '8px 0' } }, rep),
            h('div', { class: 'row' }, h('div', { class: 'col', style: { flex: '1 1 340px' } }, ivA.el), h('div', { class: 'col', style: { flex: '1 1 340px' } }, ivB.el)),
            h('p', { class: 'caption' }, '회전만 하면 반복률이 높게 유지됩니다(모라벡은 네 방향만 봐서 상대적으로 약함). 스케일을 줄이면 연산자 크기가 고정돼 있어 같은 점이 잘 안 잡힙니다 — 그림 4-11처럼 작은 삼각형에는 작은 연산자, 큰 삼각형에는 큰 연산자가 필요합니다. 이것이 4.4절의 출발점입니다.'))),
        h('div', { class: 'stack' }, st.panel)));
      rebuild(); inv();
    },
  });
})();

// Chapter 3 modules, part B: SPTA thinning, edge tracking, line approximation, Hough, RANSAC
(() => {
  const { h, fmt } = UI;
  const R = String.raw;
  const NAMES = ['동', '남동', '남', '남서', '서', '북서', '북', '북동'];
  const fromArt = s => s.trim().split('\n').map(r => [...r.trim()].map(c => (c === '#' ? 1 : 0)));

  // ================= 3.5.1 SPTA thinning =================
  const SPTA_PRESETS = {
    '두께 2~3 곡선': `................
....#####.......
...#######......
..###...###.....
..##.....##.....
..##.....###....
..###.....###...
...###.....###..
....####....##..
......#######...
................`,
    '두꺼운 L자·사선': `................
.###............
.###............
.###.......##...
.###......###...
.###.....###....
.###....###.....
.##########.....
.#########......
.########.......
................`,
    '두께 2 막대·ㄱ자': `................
................
..##########....
..##########....
..........##....
..........##....
..........##....
..........##....
................`,
    '직사각형': `................
................
..###########...
..###########...
..###########...
..###########...
..###########...
................
................`,
  };
  // each group: p lies on the boundary side b (n_b = 0); o = opposite side
  const GROUPS = [
    { key: 's0', b: 0, o: 4, others: [5, 6, 2, 3], corners: [[6, 7], [2, 1]], line: 5 },
    { key: 's4', b: 4, o: 0, others: [1, 2, 6, 7], corners: [[2, 3], [6, 5]], line: 6 },
    { key: 's2', b: 2, o: 6, others: [7, 0, 4, 5], corners: [[0, 1], [4, 3]], line: 7 },
    { key: 's6', b: 6, o: 2, others: [3, 4, 0, 1], corners: [[4, 5], [0, 7]], line: 8 },
  ];
  function evalGroups(n) {
    return GROUPS.map(g => {
      const lits = [
        { txt: `n${g.b}′`, val: !n[g.b], why: `${NAMES[g.b]}쪽 n${g.b}이 비어 있음 → p는 ${NAMES[g.b]}쪽 경계(껍질) 화소` },
        { txt: `n${g.o}`, val: !!n[g.o], why: `반대편 ${NAMES[g.o]} n${g.o}이 에지 → p를 지워도 안쪽 화소가 남음` },
        { txt: `(${g.others.map(k => 'n' + k).join('+')})`, val: g.others.some(k => n[k]), why: `${NAMES[g.o]} 말고 다른 이웃도 있어야 함 → 없으면 p는 선의 끝점이라 지우면 선이 짧아짐` },
        { txt: `(n${g.corners[0][0]}+n${g.corners[0][1]}′)`, val: !!n[g.corners[0][0]] || !n[g.corners[0][1]], why: `${NAMES[g.corners[0][1]]} n${g.corners[0][1]}만 있고 ${NAMES[g.corners[0][0]]} n${g.corners[0][0]}이 없으면 n${g.corners[0][1]}은 p를 통해서만 연결 → 지우면 끊어짐` },
        { txt: `(n${g.corners[1][0]}+n${g.corners[1][1]}′)`, val: !!n[g.corners[1][0]] || !n[g.corners[1][1]], why: `${NAMES[g.corners[1][1]]} n${g.corners[1][1]}만 있고 ${NAMES[g.corners[1][0]]} n${g.corners[1][0]}이 없으면 끊어짐` },
      ];
      return { ...g, lits, val: lits.every(l => l.val) };
    });
  }
  APP.mod({
    id: 'spta', ch: '3', num: '3.5.1', title: 'SPTA 세선화', src: '3강 p.38 · 그림 3-23, 알고리즘 3-5', star: true,
    blurb: '화소 p를 지울지 말지를 네 개의 논리식으로 판단하는 과정을 이웃 n0~n7 값과 함께.',
    mount(root, m) {
      APP.scaffold(root, m, {
        lead: '세선화는 두께 2~3인 에지를 두께 1로 깎되 <b>8-연결성을 끊지 않아야</b> 합니다. SPTA는 에지 화소 p의 여덟 이웃 n0~n7을 보고, p가 <b>경계(껍질)</b> 화소이면서 지워도 <b>끝점이 짧아지거나 연결이 끊기지 않을 때만</b> 지웁니다. 한 패스는 “껍질을 한 번 벗기는” 연산이고, 지우는 화소는 e<sub>out</sub>에서 0이 됩니다(빨간 0). 교재처럼 모든 화소를 원래 e로 동시에 판단하면 이웃한 두 화소가 함께 지워져 선이 끊길 수 있으므로, 기본값은 지운 화소를 <b>즉시 반영</b>하는 방식입니다(“방식”에서 교재 그대로와 비교 가능). 격자에서 화소를 클릭하면 그 화소의 판단 단계로 바로 이동합니다.',
        formulas: [[R`$$s_4=n_0\cdot(n_1+n_2+n_6+n_7)\cdot(n_2+n_3')\cdot(n_6+n_5')$$`, '그림 3-23 · n₄=0 그룹 (′ = NOT, + = OR, · = AND)']],
      });
      let base = fromArt(SPTA_PRESETS['두께 2~3 곡선']), e = base.map(r => r.slice()), pass = 1, frame = null, mode = 'inspect', hist = [];
      let M = e.length, N = e[0].length;
      const CODE = ['e를 e_out에 복사한다.', 'for(j=1 to M-2)', '  for(i=1 to N-2) {', '    if(e(j,i)=1 and', "      ((n0' and (n4 and (n5 or n6 or n2 or n3) and (n6 or n7') and (n2 or n1')))  // n0=비에지, s0=참", "      or (n4' and (n0 and (n1 or n2 or n6 or n7) and (n2 or n3') and (n6 or n5')))  // n4=비에지, s4=참", "      or (n2' and (n6 and (n7 or n0 or n4 or n5) and (n0 or n1') and (n4 or n3')))  // n2=비에지, s2=참", "      or (n6' and (n2 and (n3 or n4 or n0 or n1) and (n4 or n5') and (n0 or n7')))))  // n6=비에지, s6=참", '      e_out(j,i)=0;', '  }'];
      const st = UI.Stepper({ code: CODE, title: '알고리즘 3-5 SPTA (껍질을 한 번 벗기는 연산)', render: fr => { frame = fr; draw(); } });
      const OFF = CV.DIR8;
      const gv = UI.GridView({
        rows: M, cols: N, cs: 30, fs: 11, label: '에지 영상 e',
        cell: (y, x) => {
          const v = e[y][x], s = { t: v ? '1' : '', cls: v ? 'on' : '' };
          if (frame && frame.del && frame.del[y] && frame.del[y][x]) { s.cls = 'del'; s.t = '0'; }
          if (frame && frame.cur) {
            const [cy, cx] = frame.cur;
            if (cy === y && cx === x) s.cls += ' cur';
            const k = OFF.findIndex(([a, b]) => cy + a === y && cx + b === x);
            if (k >= 0) { s.sub = 'n' + k; s.cls += ' win'; }
          }
          return s;
        },
        onClick: (y, x) => { if (mode === 'edit') return; const k = st.frames.findIndex(f => f.cur && f.cur[0] === y && f.cur[1] === x); if (k >= 0) st.go(k); },
        paint: null,
      });
      // painting handled manually so inspect-mode clicks still work
      gv.el.addEventListener('pointerdown', e0 => {
        if (mode !== 'edit') return;
        const c = e0.target.closest('.c'); if (!c) return;
        const idx = [...gv.el.querySelectorAll('.c')].indexOf(c), y = Math.floor(idx / N), x = idx % N;
        const v = 1 - e[y][x]; e[y][x] = v; base = e.map(r => r.slice()); pass = 1; hist = [];
        const move = ev => { const t = document.elementFromPoint(ev.clientX, ev.clientY), cc = t && t.closest && t.closest('.c'); if (!cc || !gv.el.contains(cc)) return; const k = [...gv.el.querySelectorAll('.c')].indexOf(cc); e[Math.floor(k / N)][k % N] = v; base = e.map(r => r.slice()); gv.draw(); };
        const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); rebuild(); };
        window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
        gv.draw();
      });
      const nbBox = h('div'), rulesBox = h('div', { class: 'stack', style: { gap: '8px' } }), passInfo = h('span', { class: 'pill hot' });
      // 'seq': same four rules, but each deletion is applied at once, so later pixels see it (keeps 8-connectivity);
      // 'book': all four rules judged on the untouched e in one parallel scan, exactly as printed (can split lines)
      let algo = 'seq';
      function rebuild(at = 0) {
        const fr = [], del = CV.zeros(M, N), cur = e.map(r => r.slice()), rd = algo === 'seq' ? cur : e;
        fr.push({ line: 1, del: CV.clone(del), note: `패스 ${pass}: e를 e_out에 복사합니다. ` + (algo === 'seq' ? '이번 방식은 <b>지운 화소를 곧바로 e_out에 반영하고, 다음 화소는 e_out을 보고 판단</b>합니다. 그래서 이웃이 방금 지워졌다면 그 사실을 알고 판단합니다.' : '교재 그대로 모든 화소를 <b>원래 e</b>만 보고 동시에 판단합니다. 서로 “상대가 남을 것”이라 믿고 함께 지워져 선이 끊길 수 있습니다.'), vars: { 패스: pass } });
        let cnt = 0;
        for (let j = 1; j < M - 1; j++) for (let i = 1; i < N - 1; i++) {
          if (rd[j][i] !== 1) continue;
          const n = OFF.map(([a, b2]) => rd[j + a][i + b2]);
          const G = evalGroups(n), win = G.find(g => g.val);
          const gone = OFF.map(([a, b2], k) => (del[j + a] && del[j + a][i + b2] ? 'n' + k : null)).filter(Boolean);
          if (win) { del[j][i] = 1; cur[j][i] = 0; cnt++; }
          fr.push({ cur: [j, i], n, G, del: CV.clone(del), line: win ? [4, win.line, 9] : [4, 5, 6, 7, 8], vars: { j, i, ...Object.fromEntries(n.map((v, k) => ['n' + k, v])), s0: +G[0].val, s4: +G[1].val, s2: +G[2].val, s6: +G[3].val, '삭제': win ? '예' : '아니오' },
            note: (gone.length ? `이웃 ${gone.join(', ')}은 이번 패스에서 이미 지워졌으므로 ` + (algo === 'seq' ? '0으로 보고 판단합니다. ' : '<b>하지만 원래 e를 보므로 여전히 1로 봅니다</b> — 끊김의 원인. ') : '') +
              (win ? `p=(${j},${i}): <b>${win.key}가 참</b> (${NAMES[win.b]}쪽 경계이고, 지워도 끝점·연결이 유지됨) → <b>e_out(${j},${i}) = 0</b>` : `p=(${j},${i}): 네 식이 모두 거짓 → <b>유지</b>. ` + (G.every(g => !g.lits[0].val) ? '네 방향 모두 에지로 둘러싸인 안쪽 화소입니다.' : '경계이긴 하지만 지우면 끝점이 짧아지거나 연결이 끊깁니다.')) });
        }
        fr.push({ line: [], del: CV.clone(del), note: `패스 ${pass} 끝: <b>${cnt}개</b> 화소를 0으로 바꿉니다(빨간 0). ${cnt ? '“다음 패스”로 한 겹 더 벗기세요.' : '더 지울 화소가 없으므로 세선화가 끝났습니다.'}`, vars: { 패스: pass, '지운 화소': cnt } });
        passInfo.textContent = `패스 ${pass}`;
        st.load(fr, at);
      }
      function nextPass() { const last = st.frames[st.frames.length - 1]; if (!last.vars['지운 화소']) return false; hist.push(e.map(r => r.slice())); e = e.map((r, y) => r.map((v, x) => (last.del[y][x] ? 0 : v))); pass++; rebuild(); return true; }
      function draw() {
        gv.draw();
        if (!frame.n) { nbBox.replaceChildren(h('span', { class: 'caption' }, '에지 화소를 검사할 때 여기에 이웃 n0~n7이 나타납니다.')); rulesBox.replaceChildren(); return; }
        const n = frame.n, LAB = [[5, 6, 7], [4, -1, 0], [3, 2, 1]];
        const mini = UI.GridView({ rows: 3, cols: 3, cs: 50, fs: 16, axes: false, cell: (y, x) => { const k = LAB[y][x]; return k < 0 ? { t: 'p', cls: 'on cur' } : { t: n[k], sub: 'n' + k, cls: n[k] ? 'on' : '' }; } });
        mini.draw();
        nbBox.replaceChildren(h('div', { class: 'row', style: { alignItems: 'center' } }, mini.el, h('div', { class: 'caption' }, 'n0=동, n1=남동, n2=남, n3=남서,', h('br'), 'n4=서, n5=북서, n6=북, n7=북동', h('br'), '(그림 3-23(b) 이웃 표기)')));
        rulesBox.replaceChildren(...frame.G.map(g => h('div', { class: 'rule-card' + (g.val ? ' win' : !g.lits[0].val ? ' skip' : '') },
          h('h4', {}, h('span', { class: 'mono' }, g.key), h('span', {}, `n${g.b}=비에지 그룹 (${NAMES[g.b]}쪽 경계)`), h('span', { class: 'pill ' + (g.val ? 'ok' : 'bad') }, g.val ? '참 → 삭제' : '거짓')),
          h('div', { class: 'chips' }, g.lits.map((l, k) => [k ? h('span', { class: 'mono', style: { color: 'var(--muted)' } }, '·') : null, h('span', { class: 'lit ' + (l.val ? 't' : 'f'), title: l.why }, l.txt)])),
          !g.lits[0].val ? h('div', { class: 'why' }, `n${g.b}=1이라 이 그룹은 해당 없음`) : h('ul', { class: 'why', style: { margin: 0, paddingLeft: '18px' } }, g.lits.filter(l => !l.val).map(l => h('li', {}, h('b', {}, l.txt + ' 거짓: '), l.why)).concat(g.val ? [h('li', {}, '모든 항이 참 → p는 지워도 되는 껍질 화소')] : [])))));
      }
      const modeSeg = UI.segmented([['inspect', '조사 (클릭 = 그 화소로)'], ['edit', '편집 (드래그로 그리기)']], mode, v => (mode = v), '모드');
      root.append(h('div', { class: 'lab wide-code' },
        h('div', { class: 'stack' },
          h('div', { class: 'card' },
            h('div', { class: 'controls' }, modeSeg, h('div', { class: 'presets' }, Object.keys(SPTA_PRESETS).map(k => h('button', { class: 'btn', onclick: () => { base = fromArt(SPTA_PRESETS[k]); e = base.map(r => r.slice()); M = e.length; N = e[0].length; frame = null; gv.resize(M, N); pass = 1; hist = []; rebuild(); } }, k)))),
            h('div', { class: 'controls', style: { marginTop: '8px' } }, UI.labeled('방식', UI.segmented([['seq', '즉시 반영 (연결 유지)'], ['book', '교재 그대로 (원래 e로 동시 판단)']], algo, v => { algo = v; e = base.map(r => r.slice()); pass = 1; hist = []; rebuild(); })),
              h('span', { class: 'caption', style: { flexBasis: '100%' } }, '“교재 그대로”는 모든 화소를 원래 e로 동시에 판단합니다. 이웃한 두 화소가 서로 “상대가 남는다”고 믿고 함께 지워지면 선이 끊기거나 두께 2인 선이 사라집니다. “즉시 반영”은 식은 같고, 지운 결과를 바로 다음 판단에 씁니다.'), passInfo,
              h('button', { class: 'btn primary', onclick: () => nextPass() }, '다음 패스 ▶'),
              h('button', { class: 'btn', onclick: () => { let k = 0; while (k++ < 30 && nextPass()); } }, '끝까지 반복'),
              h('button', { class: 'btn', onclick: () => { if (hist.length) { e = hist.pop(); pass--; rebuild(); } } }, '이전 패스'),
              h('button', { class: 'btn', onclick: () => { e = base.map(r => r.slice()); pass = 1; hist = []; rebuild(); } }, '처음 영상')),
            h('div', { style: { marginTop: '10px' } }, gv.el),
            h('div', { class: 'legend', style: { marginTop: '6px' } }, h('span', {}, h('i', { style: { background: 'var(--cell-on)' } }), '에지 (1)'), h('span', {}, h('i', { style: { background: 'var(--bad)' } }), '이번 패스에서 지울 화소 (e_out=0)'), h('span', {}, h('i', { style: { background: 'color-mix(in srgb, var(--orange) 25%, var(--cell-bg))' } }), '지금 p의 이웃 n0~n7'))),
          st.root,
          h('div', { class: 'card' }, h('h3', {}, 'p의 이웃'), nbBox),
          h('div', { class: 'card' }, h('h3', {}, '네 그룹의 판단', h('small', {}, '초록 = 참인 항, 빨강 = 거짓인 항. 항에 마우스를 올리면 뜻이 나옵니다')), rulesBox)),
        h('div', { class: 'stack' }, st.panel, h('div', { class: 'note' }, '읽는 법: 각 줄은 “p가 어느 쪽 경계인가”(n0′, n4′, n2′, n6′)로 시작합니다. 나머지 항은 모두 “지워도 되는가”를 확인합니다 — 반대편에 화소가 있는가(두께), 끝점이 아닌가, 대각선 이웃이 p를 통해서만 이어져 있지 않은가(연결성). 네 식 중 하나라도 참이면 지웁니다.'))));
      rebuild();
    },
  });

  // ================= 3.5.1 edge tracking =================
  const TRACK_PTS = [[2, 1], [2, 2], [3, 3], [4, 4], [4, 5], [5, 5], [6, 6], [6, 7], [6, 8], [3, 6], [2, 7], [1, 8], [1, 9], [2, 10], [3, 9], [3, 8], [2, 13], [3, 14], [4, 15], [5, 14], [5, 13], [4, 12], [3, 12]];
  const SEGCOL = ['--orange', '--neg', '--ok', '--bad', '--ink'];
  APP.mod({
    id: 'track', ch: '3', num: '3.5.1', title: '에지 추적과 분기점', src: '3강 p.36, 39–42 · 그림 3-22·3-25·3-26, 알고리즘 3-6', star: true,
    blurb: '전환 횟수로 끝점·통과점·분기점을 가르고, 큐에서 꺼내 에지 토막과 체인 코드를 만드는 과정.',
    mount(root, m) {
      APP.scaffold(root, m, {
        lead: '세선화된 에지를 <b>에지 토막</b>(끝점·분기점 사이의 화소 열)으로 나눕니다. 화소의 여덟 이웃을 한 바퀴 돌며 <b>0→1로 바뀌는 횟수</b>(전환 횟수)를 세면 1이면 끝점, 2면 통과점, 3 이상이면 분기점입니다(그림 3-25). 알고리즘 3-6은 끝점과 분기점에서 각 방향을 큐에 넣고, 하나씩 꺼내 다음 끝점·분기점을 만날 때까지 따라갑니다. 격자의 화소를 클릭하면 그 화소의 전환 횟수를 세는 과정을 보여 줍니다.',
        formulas: [],
      });
      const M = 8, N = 16;
      let e = CV.zeros(M, N), frame = null, mode = 'inspect', sel = [4, 5];
      TRACK_PTS.forEach(([y, x]) => (e[y][x] = 1));
      const CODE = ['Q=∅;   // 큐를 생성하고 공집합으로 초기화', 'for(j=1 to M-2)   // 끝점(전환 횟수 1)과 분기점(전환 횟수 3 이상) 수집하여 큐에 저장', '  for(i=1 to N-2) {', '    (j,i)의 전환 횟수를 세어 c라 한다.', '    if(c=1 or c>=3)   // 끝점 또는 분기점', '      for(dir=0 to 7)   // 8-방향을 조사하여 추적 방향을 정하고 큐에 저장', '        if(dir 방향의 이웃 화소 (y,x)가 e(y,x)=1) addQueue(Q,(j,i,dir));', '  }', '', '// 큐에 들어있는 요소에서 에지 추적을 시작(에지 토막 추적 시작)', 'n=0;   // 에지 토막의 개수', 'visited(j,i)=0, 0≤j≤M-1, 0≤i≤N-1;   // 이중 추적을 방지하기 위해 사용', 'while(Q≠∅) {', '  (y,x,dir)=popQueue(Q);', '  (y,x)의 dir 방향의 이웃을 (cy,cx)라 하자.', '  if visited(cy,cx) continue;   // 반대쪽에서 이미 추적했음', '  n++;', '  segments(n)을 생성하고 (y,x)와 (cy,cx)를 삽입한다.', '  visited(y,x)=visited(cy,cx)=1;   // 방문했음을 표시', '  if((cy,cx)가 끝점 또는 분기점) continue;   // 두 점으로 구성되는 짧은 에지 토막', '  while(true) {', '    (cy,cx)의 dir 방향의 전방 화소를 조사한다.   // [그림 3-26]에서 f 표시된 화소들', '    if(끝점 또는 분기점 (y,x)가 있으면) {', '      segments(n)에 (y,x)를 추가한다.', '      visited(y,x)=1;', '      break;   // segments(n)의 추적이 끝났음', '    }', '    else {   // 전환 횟수가 2인 통과점', '      전방 화소 중 e(y,x)=1인 화소를 찾는다.', '      segments(n)에 (y,x)를 추가한다.', '      visited(y,x)=1;', '      dir을 (cy,cx)에서 (y,x)로 진행하는 방향으로 갱신한다.', '      (cy,cx)=(y,x);   // 앞으로 이동', '    }', '  }', '}'];
      const st = UI.Stepper({ code: CODE, title: '알고리즘 3-6 에지 토막 검출', render: fr => { frame = fr; draw(); } });
      const tc = (y, x) => CV.transitions(e, y, x).c;
      const kindOf = (y, x) => { if (!e[y][x]) return null; const c = tc(y, x); return c === 1 ? 'end' : c >= 3 ? 'branch' : c === 2 ? 'pass' : 'iso'; };
      const fwdDirs = d => (d % 2 === 0 ? [d, d - 1, d + 1] : [d, d - 1, d + 1, d - 2, d + 2]).map(k => (k + 8) % 8);
      const gv = UI.GridView({
        rows: M, cols: N, cs: 34, fs: 11, label: '에지 영상',
        cell: (y, x) => {
          const v = e[y][x];
          if (!v) return { t: '', cls: frame && frame.fwd && frame.fwd.some(([a, b]) => a === y && b === x) ? 'win' : '' };
          const k = kindOf(y, x), shown = !frame || frame.scanned === undefined || frame.scanned >= y * N + x;
          const s = { t: shown ? (k === 'end' ? '@' : k === 'branch' ? '+' : 'o') : '·', cls: 'on', sub: shown ? String(tc(y, x)) : undefined };
          if (frame && frame.vis && frame.vis[y][x]) s.cls = 'on';
          if (frame && frame.fwd && frame.fwd.some(([a, b]) => a === y && b === x)) s.cls += ' win';
          if (frame && frame.cur && frame.cur[0] === y && frame.cur[1] === x) s.cls += ' cur';
          if (k === 'end' || k === 'branch') { s.color = shown ? (k === 'end' ? 'var(--orange)' : 'var(--bad)') : ''; s.bold = true; }
          return s;
        },
        onClick: (y, x) => { if (mode === 'edit') { e[y][x] = 1 - e[y][x]; rebuild(); } else { sel = [y, x]; inspect(); } },
      });
      const segBox = h('div'), insBox = h('div');
      function inspect() {
        const [y, x] = sel;
        if (!e[y][x]) { insBox.replaceChildren(h('span', { class: 'caption' }, `(${y},${x})는 에지 화소가 아닙니다. 에지 화소를 클릭해 보세요.`)); return; }
        const { n, c } = CV.transitions(e, y, x), LAB = [[5, 6, 7], [4, -1, 0], [3, 2, 1]];
        const mini = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        mini.setAttribute('viewBox', '-110 -110 220 220'); mini.style.width = '210px';
        const P = k => [Math.cos(k * Math.PI / 4) * 70, Math.sin(k * Math.PI / 4) * 70];
        let sv = `<defs><marker id="trk-ar" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="var(--orange)"/></marker></defs>`;
        for (let k = 0; k < 8; k++) {
          const a = (k * 45 + 8) * Math.PI / 180, b = ((k + 1) * 45 - 8) * Math.PI / 180, hit = n[k] === 0 && n[(k + 1) % 8] === 1;
          sv += `<path d="M${Math.cos(a) * 70},${Math.sin(a) * 70} A70,70 0 0 1 ${Math.cos(b) * 70},${Math.sin(b) * 70}" fill="none" stroke="var(${hit ? '--orange' : '--rule'})" stroke-width="${hit ? 4 : 2}" ${hit ? 'marker-end="url(#trk-ar)"' : ''}/>`;
          if (hit) { const m = (k * 45 + 22.5) * Math.PI / 180; sv += `<text x="${Math.cos(m) * 98}" y="${Math.sin(m) * 98 + 4}" font-size="11" text-anchor="middle" fill="var(--orange)" font-weight="700">0→1</text>`; }
        }
        for (let k = 0; k < 8; k++) { const [x, y] = P(k); sv += `<circle cx="${x}" cy="${y}" r="15" fill="var(${n[k] ? '--cell-on' : '--cell-bg'})" stroke="var(--ink)"/><text x="${x}" y="${y + 4}" font-size="12" text-anchor="middle" fill="var(${n[k] ? '--cell-on-ink' : '--ink'})">n${k}</text>`; }
        sv += `<circle r="17" fill="var(--orange)"/><text y="5" font-size="14" text-anchor="middle" fill="#fff" font-weight="700">p</text>`;
        mini.innerHTML = sv;
        const kind = c === 1 ? '끝점 (@)' : c === 2 ? '통과점 (o)' : c >= 3 ? '분기점 (+)' : '고립점';
        insBox.replaceChildren(h('div', { class: 'row', style: { alignItems: 'center' } }, mini, h('div', { class: 'col', style: { flex: '1 1 260px' } },
          h('span', { class: 'mono' }, `(${y},${x}) 이웃 n0…n7 = ${n.join(' ')}`), h('span', {}, `n0→n1→…→n7→n0 순서로 한 바퀴 돌며 0 다음에 1이 오는 곳을 세면 `, h('b', {}, `c = ${c}`), ` → `, h('b', { style: { color: 'var(--orange)' } }, kind)),
          h('span', { class: 'caption' }, '이웃 화소의 개수가 아니라 “덩어리” 개수를 세는 셈입니다. 이웃 3개가 붙어 있으면(ㄱ자) 한 덩어리라 c=1 또는 2가 되어 분기점이 아닙니다 — 그림 3-25의 a, c가 그런 경우입니다.'))));
      }
      function rebuild() {
        const fr = [], Q = [], vis = CV.zeros(M, N), segs = [];
        const qs = () => Q.map(([y, x, d]) => `(${y}, ${x}, dir=${d})`);
        const snap = (line, note, extra = {}) => fr.push({ line, note, vis: CV.clone(vis), segs: segs.map(s => s.slice()), stack: qs(), ...extra, vars: { n: segs.length, '큐 길이': Q.length, ...(extra.vars || {}) } });
        snap(1, 'Q = ∅', { scanned: -1 });
        for (let j = 1; j < M - 1; j++) for (let i = 1; i < N - 1; i++) {
          if (!e[j][i]) continue;
          const c = tc(j, i);
          if (c === 1 || c >= 3) {
            const added = [];
            for (let d = 0; d < 8; d++) { const [a, b] = CV.DIR8[d]; if (e[j + a][i + b]) { Q.push([j, i, d]); added.push(d); } }
            snap([4, 5, 6, 7], `(${j},${i})의 전환 횟수 c = ${c} → <b>${c === 1 ? '끝점' : '분기점'}</b>. 이웃이 있는 방향 ${added.join(', ')}을 큐에 넣습니다.`, { cur: [j, i], scanned: j * N + i, vars: { j, i, c } });
          } else snap(4, `(${j},${i})의 전환 횟수 c = ${c} → ${c === 2 ? '통과점이라 건너뜀' : '고립점'}`, { cur: [j, i], scanned: j * N + i, vars: { j, i, c } });
        }
        snap([11, 12], `주사 끝. 큐에 ${Q.length}개 항목. 이제 하나씩 꺼내 추적합니다.`);
        let guard = 0;
        while (Q.length && guard++ < 200) {
          const [y, x, d0] = Q.shift(); let dir = d0;
          const [a, b] = CV.DIR8[dir]; let cy = y + a, cx = x + b;
          if (vis[cy][cx]) { snap([14, 15, 16], `pop (${y},${x}, dir=${dir}) → 이웃 (${cy},${cx})는 이미 방문함 → continue (반대쪽에서 이미 추적한 토막)`, { cur: [y, x], vars: { y, x, dir, cy, cx } }); continue; }
          segs.push([[y, x], [cy, cx]]); vis[y][x] = vis[cy][cx] = 1;
          snap([14, 15, 17, 18, 19], `pop (${y},${x}, dir=${dir}) → 새 토막 <b>${segs.length}</b> 시작: (${y},${x}), (${cy},${cx})`, { cur: [cy, cx], vars: { y, x, dir, cy, cx } });
          const k0 = kindOf(cy, cx);
          if (k0 === 'end' || k0 === 'branch') { snap(20, `(${cy},${cx})가 ${k0 === 'end' ? '끝점' : '분기점'}이라 두 점짜리 짧은 토막으로 끝`, { cur: [cy, cx] }); continue; }
          let steps = 0;
          while (steps++ < 100) {
            const fd = fwdDirs(dir), fwd = fd.map(k => [cy + CV.DIR8[k][0], cx + CV.DIR8[k][1]]).filter(([p, q]) => CV.inside(e, p, q));
            snap(22, `(${cy},${cx})에서 dir=${dir} 방향의 전방 화소 ${fwd.length}개(파란 칸)를 조사`, { cur: [cy, cx], fwd, vars: { cy, cx, dir } });
            const stop = fwd.find(([p, q]) => e[p][q] && ['end', 'branch'].includes(kindOf(p, q)));
            if (stop) {
              segs[segs.length - 1].push(stop); vis[stop[0]][stop[1]] = 1;
              snap([23, 24, 25, 26], `전방에 ${kindOf(...stop) === 'end' ? '끝점' : '분기점'} (${stop[0]},${stop[1]})이 있음 → 토막 ${segs.length}에 추가하고 추적 종료`, { cur: stop, fwd, vars: { cy, cx, dir } });
              break;
            }
            const nk = fd.find(k => { const p = cy + CV.DIR8[k][0], q = cx + CV.DIR8[k][1]; return CV.inside(e, p, q) && e[p][q] && !vis[p][q]; });
            if (nk === undefined) { snap(29, `전방에 이어지는 화소가 없어 추적 종료`, { cur: [cy, cx], fwd }); break; }
            const ny = cy + CV.DIR8[nk][0], nx = cx + CV.DIR8[nk][1];
            segs[segs.length - 1].push([ny, nx]); vis[ny][nx] = 1; dir = nk; cy = ny; cx = nx;
            snap([29, 30, 31, 32, 33], `통과점 → 전방의 에지 화소 (${ny},${nx})로 이동, dir = ${nk}`, { cur: [cy, cx], fwd, vars: { cy, cx, dir } });
          }
        }
        const un = []; for (let y = 0; y < M; y++) for (let x = 0; x < N; x++) if (e[y][x] && !vis[y][x]) un.push(`(${y},${x})`);
        snap([], `큐가 비어 끝났습니다. 에지 토막 ${segs.length}개. 교재 그림 3-22 표와 비교하면 1번·(4,5)→(6,8) 토막은 같고, 나머지는 큐에 넣는 방향 순서(dir 0→7) 때문에 반대 방향으로 추적되어 체인 코드가 거꾸로 나옵니다. 고리 토막은 추적 끝에서 분기점 (2,7)을 다시 만나 23~24행대로 추가합니다.` + (un.length ? ` 방문하지 못한 화소 ${un.length}개 — 끝점·분기점이 없는 닫힌 고리(교재 표의 5번 토막)는 큐에 들어가지 않으므로 알고리즘 3-6만으로는 찾지 못합니다.` : ''));
        st.load(fr, frame ? Math.min(st.i, fr.length - 1) : 0);
        inspect();
      }
      function draw() {
        gv.draw();
        gv.overlay((frame.segs || []).flatMap((s, k) => s.slice(1).map((p, i) => ({ type: 'arrow', pts: [s[i][0], s[i][1], p[0], p[1]], color: SEGCOL[k % SEGCOL.length], w: 3, op: 0.85 }))));
        const code = s => s.slice(1).map((p, i) => CV.DIR8.findIndex(([a, b]) => s[i][0] + a === p[0] && s[i][1] + b === p[1])).join('');
        segBox.replaceChildren(frame.segs && frame.segs.length ? UI.dataTable(['토막', '에지 열', '체인 코드'], frame.segs.map((s, k) => [h('span', { style: { color: `var(${SEGCOL[k % SEGCOL.length]})`, fontWeight: 700 } }, String(k + 1)), s.map(([y, x]) => `(${y},${x})`).join(''), `(${s[0][0]},${s[0][1]})${code(s)}`])) : h('span', { class: 'caption' }, '아직 만들어진 토막이 없습니다.'));
      }
      const modeSeg = UI.segmented([['inspect', '조사 (클릭 = 전환 횟수 보기)'], ['edit', '편집 (클릭 = 화소 켜고 끄기)']], mode, v => (mode = v), '모드');
      root.append(h('div', { class: 'lab wide-code' },
        h('div', { class: 'stack' },
          h('div', { class: 'card' }, h('div', { class: 'controls' }, modeSeg, h('button', { class: 'btn', onclick: () => { e = CV.zeros(M, N); TRACK_PTS.forEach(([y, x]) => (e[y][x] = 1)); rebuild(); } }, '그림 3-22로 되돌리기')),
            h('div', { style: { marginTop: '10px' } }, gv.el),
            h('div', { class: 'legend', style: { marginTop: '6px' } }, h('span', {}, '@ 끝점 · + 분기점 · o 통과점 · 칸 왼쪽 위 숫자 = 전환 횟수 · 파란 칸 = 그림 3-26의 전방 화소 f · 화살표 = 토막'))),
          st.root,
          h('div', { class: 'card' }, h('h3', {}, '전환 횟수 세기', h('small', {}, '그림 3-25')), insBox),
          h('div', { class: 'card' }, h('h3', {}, '에지 토막과 체인 코드', h('small', {}, '그림 3-22 표와 같은 형식 · 체인 코드 0=동, 1=남동, 2=남 … 7=북동')), segBox)),
        h('div', { class: 'stack' }, st.panel)));
      rebuild();
    },
  });

  // ================= 3.5.1 line approximation =================
  APP.mod({
    id: 'approx', ch: '3', num: '3.5.1', title: '선분 근사', src: '3강 p.43 · 그림 3-27', star: true,
    blurb: '두 끝점을 잇는 직선에서 가장 먼 점까지 거리 h가 임계값 이하가 될 때까지 재귀 분할.',
    mount(root, m) {
      APP.scaffold(root, m, {
        lead: '에지 토막(점의 열)을 몇 개의 선분으로 줄입니다. 두 끝점을 잇는 직선에서 <b>가장 먼 점까지의 거리 h</b>가 임계값보다 크면 그 점에서 나누고 양쪽을 다시 재귀적으로 처리합니다. 그림 영역에 마우스로 곡선을 새로 그릴 수 있습니다.',
        formulas: [],
      });
      const W = 640, H = 300;
      let pts = [], th = 12, frame = null;
      for (let i = 0; i <= 130; i++) { const t = i / 130; pts.push([150 - 105 * Math.sin(1.75 * Math.PI * t + 0.2) * (1 - 0.25 * t) + 20 * t, 40 + 560 * t]); }
      const CODE = ['function approx(s, e) {   // 점 s부터 e까지의 에지 토막', '  두 끝점 s, e를 잇는 직선 l을 만든다.', '  l에서 가장 먼 점 m과 그 거리 h를 구한다.', '  if(h ≤ 임계값) { 선분 (s, e)를 결과에 넣는다; return; }', '  approx(s, m);   // m에서 나누어 앞쪽을 재귀 처리', '  approx(m, e);   // 뒤쪽을 재귀 처리', '}'];
      const st = UI.Stepper({ code: CODE, title: '선분 근사 의사 코드', render: fr => { frame = fr; draw(); } });
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.style.width = '100%'; svg.style.touchAction = 'none'; svg.style.background = 'var(--surface-2)'; svg.style.borderRadius = '8px'; svg.style.cursor = 'crosshair';
      const dist = (p, a, b) => { const dy = b[0] - a[0], dx = b[1] - a[1], L = Math.hypot(dy, dx) || 1; return Math.abs(dx * (a[0] - p[0]) - dy * (a[1] - p[1])) / L; };
      function rebuild() {
        const fr = [], stack = [], out = [];
        const sn = (line, note, extra) => fr.push({ line, note, stack: stack.map(([s, e]) => `<span class="fname">approx</span>(${s}, ${e})`), out: out.slice(), ...extra, vars: { 임계값: th, '선분 수': out.length, ...(extra.vars || {}) } });
        const rec = (s, e) => {
          stack.push([s, e]);
          sn(2, `approx(${s}, ${e}): 끝점 ${s}번과 ${e}번 점을 직선으로 잇습니다`, { s, e });
          let hm = -1, mi = s;
          for (let i = s + 1; i < e; i++) { const d = dist(pts[i], pts[s], pts[e]); if (d > hm) { hm = d; mi = i; } }
          if (hm < 0) hm = 0;
          sn(3, `가장 먼 점은 ${mi}번, h = <b>${hm.toFixed(1)}</b>`, { s, e, mi, h: hm, vars: { s, e, m: mi, h: hm } });
          if (hm <= th) { out.push([s, e]); sn(4, `h = ${hm.toFixed(1)} ≤ ${th} → 선분 (${s}, ${e}) 확정`, { s, e, mi, h: hm, ok: true, vars: { s, e, h: hm } }); stack.pop(); return; }
          stack[stack.length - 1] = [s, e]; sn(5, `h = ${hm.toFixed(1)} > ${th} → ${mi}번 점에서 나눔. 앞쪽 (${s}, ${mi})부터 재귀`, { s, e, mi, h: hm, vars: { s, e, m: mi, h: hm } });
          rec(s, mi);
          sn(6, `이제 뒤쪽 (${mi}, ${e}) 재귀`, { s, e, mi, vars: { s, e, m: mi } });
          rec(mi, e);
          stack.pop();
        };
        rec(0, pts.length - 1);
        sn([], `완료: 점 ${pts.length}개를 선분 <b>${out.length}개</b>로 근사했습니다.`, {});
        st.load(fr, 'end');
      }
      function draw() {
        const P = p => `${p[1]},${p[0]}`;
        let s = `<polyline points="${pts.map(P).join(' ')}" fill="none" stroke="var(--faint)" stroke-width="2"/>`;
        s += pts.map(p => `<circle cx="${p[1]}" cy="${p[0]}" r="1.6" fill="var(--muted)"/>`).join('');
        s += frame.out.map(([a, b]) => `<line x1="${pts[a][1]}" y1="${pts[a][0]}" x2="${pts[b][1]}" y2="${pts[b][0]}" stroke="var(--ok)" stroke-width="3" stroke-linecap="round"/>`).join('');
        s += frame.out.flatMap(([a, b]) => [a, b]).map(i => `<circle cx="${pts[i][1]}" cy="${pts[i][0]}" r="4.5" fill="var(--ink)"/>`).join('');
        if (frame.s !== undefined) {
          const a = pts[frame.s], b = pts[frame.e];
          s += `<line x1="${a[1]}" y1="${a[0]}" x2="${b[1]}" y2="${b[0]}" stroke="var(--orange)" stroke-width="2" stroke-dasharray="6 4"/>`;
          s += `<circle cx="${a[1]}" cy="${a[0]}" r="6" fill="var(--orange)"/><circle cx="${b[1]}" cy="${b[0]}" r="6" fill="var(--orange)"/>`;
          if (frame.mi !== undefined && frame.h !== undefined) {
            const p = pts[frame.mi], dy = b[0] - a[0], dx = b[1] - a[1], L2 = dy * dy + dx * dx || 1, t = ((p[0] - a[0]) * dy + (p[1] - a[1]) * dx) / L2, q = [a[0] + t * dy, a[1] + t * dx];
            s += `<line x1="${p[1]}" y1="${p[0]}" x2="${q[1]}" y2="${q[0]}" stroke="var(--bad)" stroke-width="2"/><circle cx="${p[1]}" cy="${p[0]}" r="6" fill="var(--bad)"/><text x="${(p[1] + q[1]) / 2 + 8}" y="${(p[0] + q[0]) / 2}" font-size="14" fill="var(--bad)" font-weight="700">h=${frame.h.toFixed(1)}</text>`;
          }
        }
        svg.innerHTML = s;
      }
      let drawing = null;
      const pos = ev => { const r = svg.getBoundingClientRect(); return [(ev.clientY - r.top) / r.height * H, (ev.clientX - r.left) / r.width * W]; };
      svg.addEventListener('pointerdown', ev => { drawing = [pos(ev)]; svg.setPointerCapture(ev.pointerId); });
      svg.addEventListener('pointermove', ev => { if (!drawing) return; const p = pos(ev), l = drawing[drawing.length - 1]; if (Math.hypot(p[0] - l[0], p[1] - l[1]) >= 5) { drawing.push(p); svg.innerHTML = `<polyline points="${drawing.map(q => q[1] + ',' + q[0]).join(' ')}" fill="none" stroke="var(--orange)" stroke-width="2"/>`; } });
      svg.addEventListener('pointerup', () => { if (drawing && drawing.length > 5) { pts = drawing; rebuild(); } else if (frame) draw(); drawing = null; });
      root.append(h('div', { class: 'lab' },
        h('div', { class: 'stack' }, h('div', { class: 'card' }, h('div', { class: 'controls' }, UI.slider({ label: '임계값 (px)', min: 1, max: 60, value: th, id: 'ap-t', oninput: v => { th = v; rebuild(); } }), h('span', { class: 'caption' }, '그림 위를 드래그하면 새 곡선')), h('div', { style: { marginTop: '8px' } }, svg),
          h('div', { class: 'legend' }, h('span', {}, h('i', { style: { background: 'var(--orange)' } }), '지금 보는 끝점과 직선'), h('span', {}, h('i', { style: { background: 'var(--bad)' } }), '가장 먼 점과 거리 h'), h('span', {}, h('i', { style: { background: 'var(--ok)' } }), '확정된 선분'))), st.root),
        h('div', { class: 'stack' }, st.panel)));
      rebuild();
    },
  });

  // ================= 3.5.2 Hough =================
  APP.mod({
    id: 'hough', ch: '3', num: '3.5.2', title: '허프 변환', src: '3강 p.44–47 · 식 (3.16), 알고리즘 3-7, 예제 3-3', star: true,
    blurb: '점 하나 = ρ-θ 공간의 곡선 하나. 누적 배열에 투표하고 지역 최대점을 직선으로.',
    mount(root, m) {
      APP.scaffold(root, m, {
        lead: '영상 공간의 점 (y, x) 하나를 지나는 모든 직선은 ρ-θ 공간에서 <b>곡선 하나</b>가 됩니다. 같은 직선 위의 점들의 곡선은 한 점에서 만나므로, ρ-θ 공간을 칸으로 나눈 <b>누적 배열</b>에 투표해 표가 많이 모인 칸을 찾으면 직선을 얻습니다. 기울기-절편(b-a) 대신 극좌표를 쓰는 이유는 수직선의 기울기가 ∞이기 때문입니다. 왼쪽 격자를 클릭해 점을 더하거나 빼 보세요.',
        formulas: [[R`$$y\cos\theta+x\sin\theta=\rho$$`, '식 (3.16)']],
      });
      let pts = [[4, 1], [2, 4], [1, 6]], nT = 9, rs = 2, T = 3, frame = null;
      const CODE = ['2차원 누적 배열 A를 0으로 초기화한다.', 'for(에지 영상 e에 있는 에지 화소 (y_i,x_i) 각각에 대해)', '  y_i cosθ + x_i sinθ = ρ가 지나는 A의 모든 칸을 1만큼 증가시킨다.', 'A에서 T를 넘는 지역 최대점 (ρ_k,θ_k)를 모두 찾아 직선으로 취한다.'];
      const st = UI.Stepper({ code: CODE, title: '알고리즘 3-7 직선 검출을 위한 허프 변환', render: fr => { frame = fr; draw(); } });
      const gP = UI.GridView({ rows: 8, cols: 8, cs: 38, label: '영상 공간', cell: (y, x) => { const on = pts.some(([a, b]) => a === y && b === x), cur = frame && frame.p && frame.p[0] === y && frame.p[1] === x; return { t: on ? '●' : '', color: on ? 'var(--neg)' : '', cls: cur ? 'cur' : '' }; }, onClick: (y, x) => { const k = pts.findIndex(([a, b]) => a === y && b === x); if (k >= 0) pts.splice(k, 1); else pts.push([y, x]); rebuild(); } });
      let gA = null; const aBox = h('div'); const cv = h('canvas');
      const cfg = () => ({ thetaMin: -90, thetaMax: 90, nTheta: nT, rhoMin: -9, rhoMax: 9, nRho: Math.round(18 / rs) });
      function peaks(A) {
        const out = [];
        for (let r = 0; r < A.length; r++) for (let t = 0; t < A[0].length; t++) {
          const v = A[r][t]; if (v < T) continue;
          let isMax = true;
          for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { if (!a && !b) continue; const rr = r + a, tt = t + b; if (rr >= 0 && tt >= 0 && rr < A.length && tt < A[0].length && (A[rr][tt] > v || (A[rr][tt] === v && (a < 0 || (a === 0 && b < 0))))) isMax = false; }
          if (isMax) out.push([r, t]);
        }
        return out;
      }
      function rebuild() {
        const c = cfg(), HR = CV.hough(pts, c), nR = c.nRho, dT = HR.dT, dR = HR.dR;
        const A = CV.zeros(nR, nT), fr = [];
        fr.push({ line: 1, A: CV.clone(A), note: `누적 배열 A (${nR}×${nT})를 0으로. θ는 ${dT}° 간격 ${nT}칸, ρ는 [−9, 9]를 ${dR} 크기 ${nR}칸으로 양자화.`, vars: { 'A 크기': `${nR}×${nT}` } });
        pts.forEach((p, pi) => {
          HR.votes[pi].forEach(v => {
            A[v.r][v.t]++;
            fr.push({ line: [2, 3], A: CV.clone(A), p, cell: [v.r, v.t], k: pi, vars: { y: p[0], x: p[1], 'θ': v.deg + '°', 'ρ': +v.rho.toFixed(3), [`A(${v.r},${v.t})`]: A[v.r][v.t] }, note: `점 (${p[0]},${p[1]}), θ = ${v.deg}° (칸 ${v.t}): ρ = ${p[0]}·cos${v.deg}° + ${p[1]}·sin${v.deg}° = <b>${v.rho.toFixed(2)}</b> → ρ 칸 ${v.r} [${(-9 + v.r * dR)}, ${(-9 + (v.r + 1) * dR)}) → A(${v.r},${v.t}) = ${A[v.r][v.t]}` });
          });
        });
        const pk = peaks(A);
        fr.push({ line: 4, A: CV.clone(A), peaks: pk, vars: { T, '찾은 직선': pk.length }, note: pk.length ? pk.map(([r, t]) => { const th = -90 + (t + 0.5) * dT, rho = -9 + (r + 0.5) * dR; return `A(${r},${t}) = ${A[r][t]} → (ρ, θ) = (${rho}, ${th}°): <b>y·cos${th}° + x·sin${th}° = ${rho}</b>`; }).join('<br>') : `T = ${T} 이상인 지역 최대점이 없습니다.` });
        gA = UI.GridView({ rows: nR, cols: nT, cs: nT > 18 ? 22 : nT > 9 ? 30 : 36, fs: nT > 18 ? 9.5 : 12, rowLabels: [...Array(nR).keys()].map(r => String(-9 + (r + 0.5) * dR)), colLabels: [...Array(nT).keys()].map(t => String(Math.round(-90 + (t + 0.5) * dT))), label: '누적 배열 A',
          cell: (r, t) => { if (!frame) return {}; const v = frame.A[r][t], mx = Math.max(3, ...frame.A.flat()); const s = { t: v || '', bg: v ? `color-mix(in srgb, var(--orange) ${Math.round(v / mx * 70)}%, var(--cell-bg))` : '' }; if (frame.cell && frame.cell[0] === r && frame.cell[1] === t) s.cls = 'cur'; if (frame.peaks && frame.peaks.some(([a, b]) => a === r && b === t)) { s.cls = 'cur'; s.bold = true; } return s; } });
        aBox.replaceChildren(h('span', { class: 'caption' }, '행: ρ 칸 중심, 열: θ 칸 중심(°)'), gA.el);
        st.load(fr, 'end');
      }
      function draw() {
        gP.draw(); gA.draw();
        const cs = 38, lines = (frame.peaks || []).map(([r, t]) => { const dT = 180 / nT, th = (-90 + (t + 0.5) * dT) * Math.PI / 180, rho = -9 + (r + 0.5) * rs; return clipLine(Math.cos(th), Math.sin(th), rho); }).filter(Boolean);
        gP.overlay(lines.map(([y1, x1, y2, x2]) => ({ type: 'line', pts: [y1, x1, y2, x2], color: '--orange', w: 2.5, dash: true })));
        const c = cfg(), colors = ['--neg', '--ok', '--bad', '--orange', '--ink'];
        const series = pts.map((p, k) => ({ type: 'line', data: [...Array(181).keys()].map(d => { const th = (d - 90) * Math.PI / 180; return [d - 90, p[0] * Math.cos(th) + p[1] * Math.sin(th)]; }), color: colors[k % colors.length], width: frame.p === p ? 3 : 1.6, alpha: frame.p && frame.p !== p ? 0.45 : 1 }));
        const pl = UI.plot(cv, { w: 520, h: 300, x: [-90, 90], y: [9, -9], xticks: [-90, -60, -30, 0, 30, 60, 90], yticks: [-9, -6, -3, 0, 3, 6, 9], series, xfmt: v => v + '°' });
        const ctx = cv.getContext('2d'); ctx.save(); ctx.strokeStyle = UI.tok('--rule'); ctx.globalAlpha = 0.9; ctx.lineWidth = 1;
        for (let t = 0; t <= nT; t++) { const x = pl.X(-90 + t * 180 / nT); ctx.beginPath(); ctx.moveTo(x, pl.Y(-9)); ctx.lineTo(x, pl.Y(9)); ctx.stroke(); }
        for (let r = 0; r <= c.nRho; r++) { const y = pl.Y(-9 + r * rs); ctx.beginPath(); ctx.moveTo(pl.X(-90), y); ctx.lineTo(pl.X(90), y); ctx.stroke(); }
        const mark = (r, t, col) => { ctx.strokeStyle = UI.col(col); ctx.lineWidth = 2.5; ctx.strokeRect(pl.X(-90 + t * 180 / nT), pl.Y(-9 + r * rs), pl.X(-90 + (t + 1) * 180 / nT) - pl.X(-90 + t * 180 / nT), pl.Y(-9 + (r + 1) * rs) - pl.Y(-9 + r * rs)); };
        if (frame.cell) mark(frame.cell[0], frame.cell[1], '--orange');
        (frame.peaks || []).forEach(([r, t]) => mark(r, t, '--bad'));
        ctx.restore();
      }
      function clipLine(c, s, rho) {
        const lo = -0.5, hi = 7.5, out = [];
        if (Math.abs(s) > 1e-9) for (const y of [lo, hi]) { const x = (rho - y * c) / s; if (x >= lo - 1e-9 && x <= hi + 1e-9) out.push([y, x]); }
        if (Math.abs(c) > 1e-9) for (const x of [lo, hi]) { const y = (rho - x * s) / c; if (y >= lo - 1e-9 && y <= hi + 1e-9) out.push([y, x]); }
        if (out.length < 2) return null;
        return [out[0][0], out[0][1], out[out.length - 1][0], out[out.length - 1][1]];
      }
      root.append(h('div', { class: 'lab wide-code' },
        h('div', { class: 'stack' },
          h('div', { class: 'card' }, h('div', { class: 'controls' }, UI.labeled('θ 칸 수', UI.segmented([[9, '9 (20°)'], [18, '18 (10°)'], [36, '36 (5°)']], nT, v => { nT = v; rebuild(); })), UI.labeled('ρ 칸 크기', UI.segmented([[2, '2'], [1, '1']], rs, v => { rs = v; rebuild(); })), UI.slider({ label: '임계값 T', min: 1, max: 6, value: T, id: 'hg-t', oninput: v => { T = v; rebuild(); } }), h('button', { class: 'btn', onclick: () => { pts = [[4, 1], [2, 4], [1, 6]]; rebuild(); } }, '예제 3-3'), h('button', { class: 'btn', onclick: () => { pts = [[1, 1], [2, 2], [3, 3], [4, 4], [6, 6], [1, 6], [2, 5], [5, 2], [6, 1]]; rebuild(); } }, 'X자 두 직선')),
            h('div', { class: 'row', style: { marginTop: '10px' } }, h('div', { class: 'col' }, h('span', { class: 'caption' }, '영상 공간 (클릭: 점 추가/삭제) · 점선: 검출된 직선'), gP.el), h('div', { class: 'col', style: { flex: '1 1 300px' } }, h('span', { class: 'caption' }, 'ρ-θ 공간의 곡선 (ρ는 아래로 증가, 그림 3-29처럼)'), cv))),
          st.root,
          h('div', { class: 'card' }, h('h3', {}, '누적 배열 A', h('small', {}, '그림 3-30 오른쪽')), aBox)),
        h('div', { class: 'stack' }, st.panel, h('div', { class: 'note' }, '예제 3-3에서 세 점은 정확히 한 직선 위에 있지 않지만(디지털 위치 오차), 양자화된 칸 (ρ, θ) = (4, 40°)에 3표가 모여 직선 y·cos40° + x·sin40° = 4를 찾습니다. θ 칸을 더 잘게 나누면 세 곡선이 같은 칸에 모이지 않을 수도 있습니다 — 양자화 간격의 트레이드오프입니다.'))));
      rebuild();
    },
  });

  // ================= 3.5.3 RANSAC =================
  APP.mod({
    id: 'ransac', ch: '3', num: '3.5.3', title: 'RANSAC', src: '3강 p.48–49 · 그림 3-31, 알고리즘 3-8', star: true,
    blurb: '두 점을 무작위로 골라 직선을 만들고 인라이어를 세는 시도를 반복.',
    mount(root, m) {
      APP.scaffold(root, m, {
        lead: 'RANSAC은 <b>무작위로 두 점</b>을 골라 직선을 만들고, 그 직선에서 t 이내에 있는 점(인라이어)을 셉니다. 인라이어가 d개 이상이면 인라이어 전체로 직선을 다시 적합하고, 오차가 e보다 작으면 후보로 저장합니다. n번 반복한 뒤 가장 좋은 후보를 고릅니다. 난수를 쓰므로 결과에 임의성이 있습니다 — “다른 난수”를 눌러 보세요. 그림을 클릭하면 점을 추가합니다.',
        formulas: [[R`$$y=ax+b$$`, '모델: 직선의 방정식']],
      });
      const W = 560, H = 360;
      let seed = 3, n = 10, t = 12, d = 8, eMax = 8, frame = null, pts = [];
      const gen = () => { const r = UI.rng(101); pts = []; for (let i = 0; i < 14; i++) { const u = 0.08 + 0.84 * i / 13; pts.push([60 + u * 260 + (r() - 0.5) * 16, 120 + u * 360 + (r() - 0.5) * 12]); } for (let i = 0; i < 12; i++) pts.push([30 + r() * 300, 30 + r() * 500]); };
      gen();
      const CODE = ['line=∅;', 'for(loop=1 to n) {', '  에지 화소 두 개를 임의로 선택한다.', '  이 두 점으로 직선의 방정식 l을 계산한다.', '  이 두 점으로 집합 inlier를 초기화한다.', '  for(이 두 점을 제외한 모든 에지 화소 p에 대해)', '    if(p가 직선 l에 허용 오차 t 이내로 적합) p를 inlier에 넣는다.', '  if(|inlier|≥d) {   // 집합 inlier가 d개 이상의 샘플을 가지면', '    inlier에 있는 모든 샘플을 가지고 직선의 방정식 l을 새로 계산한다.', '    if(l의 적합 오차 < e) l을 집합 line에 넣는다.', '  }', '}', 'line에 있는 직선 중 가장 좋은 것을 취한다.'];
      const st = UI.Stepper({ code: CODE, title: '알고리즘 3-8 직선 검출을 위한 RANSAC', render: fr => { frame = fr; draw(); } });
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.style.width = '100%'; svg.style.background = 'var(--surface-2)'; svg.style.borderRadius = '8px'; svg.style.cursor = 'copy';
      // lines as (point, unit direction); distance is perpendicular
      const line2 = (p, q) => { const dy = q[0] - p[0], dx = q[1] - p[1], L = Math.hypot(dy, dx) || 1; return { p, u: [dy / L, dx / L] }; };
      const pd = (l, p) => Math.abs((p[0] - l.p[0]) * l.u[1] - (p[1] - l.p[1]) * l.u[0]);
      const fit = P => { const my = P.reduce((s, p) => s + p[0], 0) / P.length, mx = P.reduce((s, p) => s + p[1], 0) / P.length; let syy = 0, sxx = 0, sxy = 0; P.forEach(([y, x]) => { syy += (y - my) ** 2; sxx += (x - mx) ** 2; sxy += (y - my) * (x - mx); }); const ang = 0.5 * Math.atan2(2 * sxy, sxx - syy); return { p: [my, mx], u: [Math.sin(ang), Math.cos(ang)] }; };
      const ab = l => { if (Math.abs(l.u[1]) < 1e-9) return '수직선'; const a = l.u[0] / l.u[1], b = l.p[0] - a * l.p[1]; return `y = ${a.toFixed(3)}x + ${b.toFixed(1)}`; };
      function rebuild() {
        const r = UI.rng(seed * 7919), fr = [], cand = [];
        fr.push({ line: 1, note: `line = ∅. 점 ${pts.length}개, n=${n}, t=${t}, d=${d}, e=${eMax}`, cand: [] });
        for (let loop = 1; loop <= n; loop++) {
          const i = Math.floor(r() * pts.length); let j = Math.floor(r() * (pts.length - 1)); if (j >= i) j++;
          const l = line2(pts[i], pts[j]);
          fr.push({ line: [2, 3, 4], loop, pair: [i, j], l, cand: cand.slice(), note: `시도 ${loop}: 점 ${i}번과 ${j}번을 무작위로 골라 직선을 만듭니다.`, vars: { loop } });
          const inl = [i, j]; pts.forEach((p, k) => { if (k !== i && k !== j && pd(l, p) <= t) inl.push(k); });
          fr.push({ line: [5, 6, 7], loop, pair: [i, j], l, inl, band: true, cand: cand.slice(), note: `직선에서 t=${t} 이내인 점: <b>${inl.length}개</b> (두 점 포함)`, vars: { loop, '|inlier|': inl.length } });
          if (inl.length >= d) {
            const nl = fit(inl.map(k => pts[k])), err = Math.sqrt(inl.reduce((s, k) => s + pd(nl, pts[k]) ** 2, 0) / inl.length);
            const ok = err < eMax;
            if (ok) cand.push({ l: nl, n: inl.length, err, loop });
            fr.push({ line: [8, 9, 10], loop, pair: [i, j], l, nl, inl, cand: cand.slice(), note: `${inl.length} ≥ d(${d}) → 인라이어 전체로 다시 적합: ${ab(nl)}, 적합 오차(RMS 거리) = ${err.toFixed(2)} ${ok ? `< e(${eMax}) → <b>후보로 저장</b>` : `≥ e(${eMax}) → 버림`}`, vars: { loop, '|inlier|': inl.length, '오차': err, '후보 수': cand.length } });
          } else fr.push({ line: 8, loop, pair: [i, j], l, inl, band: true, cand: cand.slice(), note: `${inl.length} < d(${d}) → 인라이어가 부족해 이 시도는 버립니다.`, vars: { loop, '|inlier|': inl.length } });
        }
        const best = cand.slice().sort((a, b) => b.n - a.n || a.err - b.err)[0];
        fr.push({ line: 13, cand, best, note: best ? `후보 ${cand.length}개 중 인라이어가 가장 많은 것(시도 ${best.loop}, ${best.n}개, 오차 ${best.err.toFixed(2)}): <b>${ab(best.l)}</b>` : '후보가 없습니다. n을 늘리거나 t, d, e를 조정해 보세요.', vars: { '후보 수': cand.length } });
        st.load(fr, 'end');
      }
      function draw() {
        const L = (l, col, w, dash) => { const k = 1000; return `<line x1="${l.p[1] - l.u[1] * k}" y1="${l.p[0] - l.u[0] * k}" x2="${l.p[1] + l.u[1] * k}" y2="${l.p[0] + l.u[0] * k}" stroke="var(${col})" stroke-width="${w}" ${dash ? 'stroke-dasharray="6 4"' : ''}/>`; };
        let s = '<defs><clipPath id="rc"><rect width="' + W + '" height="' + H + '"/></clipPath></defs><g clip-path="url(#rc)">';
        (frame.cand || []).forEach(c => (s += L(c.l, '--faint', 1.5, true)));
        if (frame.band && frame.l) { const l = frame.l, k = 1000, nx = -l.u[0] * t, ny = l.u[1] * t; s += `<polygon points="${l.p[1] - l.u[1] * k + nx},${l.p[0] - l.u[0] * k + ny} ${l.p[1] + l.u[1] * k + nx},${l.p[0] + l.u[0] * k + ny} ${l.p[1] + l.u[1] * k - nx},${l.p[0] + l.u[0] * k - ny} ${l.p[1] - l.u[1] * k - nx},${l.p[0] - l.u[0] * k - ny}" fill="var(--orange)" fill-opacity="0.12"/>`; }
        if (frame.l) s += L(frame.l, '--orange', 2, false);
        if (frame.nl) s += L(frame.nl, '--ok', 3, false);
        if (frame.best) s += L(frame.best.l, '--ok', 4, false);
        s += '</g>';
        const inl = new Set(frame.inl || []), pair = new Set(frame.pair || []);
        const bestIn = frame.best ? new Set(pts.map((p, k) => (pd(frame.best.l, p) <= t ? k : -1))) : new Set();
        s += pts.map((p, k) => `<circle cx="${p[1]}" cy="${p[0]}" r="${pair.has(k) ? 7 : 5}" fill="var(${pair.has(k) ? '--orange' : inl.has(k) || bestIn.has(k) ? '--bad' : '--ink'})" stroke="${pair.has(k) ? 'var(--ink)' : 'none'}" stroke-width="1.5"/>`).join('');
        svg.innerHTML = s;
      }
      svg.addEventListener('pointerdown', ev => { const r = svg.getBoundingClientRect(); pts.push([(ev.clientY - r.top) / r.height * H, (ev.clientX - r.left) / r.width * W]); rebuild(); });
      root.append(h('div', { class: 'lab' },
        h('div', { class: 'stack' },
          h('div', { class: 'card' }, h('div', { class: 'controls' },
            UI.slider({ label: 'n 반복', min: 1, max: 40, value: n, id: 'rs-n', oninput: v => { n = v; rebuild(); } }),
            UI.slider({ label: 't 허용 오차', min: 2, max: 40, value: t, id: 'rs-t', oninput: v => { t = v; rebuild(); } }),
            UI.slider({ label: 'd 최소 인라이어', min: 3, max: 20, value: d, id: 'rs-d', oninput: v => { d = v; rebuild(); } }),
            UI.slider({ label: 'e 적합 오차', min: 1, max: 20, step: 0.5, value: eMax, id: 'rs-e', oninput: v => { eMax = v; rebuild(); } }),
            h('button', { class: 'btn primary', onclick: () => { seed++; rebuild(); } }, '다른 난수'), h('button', { class: 'btn', onclick: () => { gen(); rebuild(); } }, '점 초기화')),
            h('div', { style: { marginTop: '10px' } }, svg),
            h('div', { class: 'legend' }, h('span', {}, h('i', { style: { background: 'var(--orange)' } }), '임의로 고른 두 점과 그 직선, 허용 오차 띠'), h('span', {}, h('i', { style: { background: 'var(--bad)' } }), '인라이어'), h('span', {}, h('i', { style: { background: 'var(--ok)' } }), '다시 적합한 직선 / 최종'), h('span', {}, h('i', { style: { background: 'var(--faint)' } }), '저장된 후보'))),
          st.root),
        h('div', { class: 'stack' }, st.panel, h('div', { class: 'note' }, '허프 변환은 모든 점이 모든 직선에 투표하는 전역 방식이고, RANSAC은 운 좋게 인라이어 두 개를 고르는 시도를 반복하는 방식입니다. 아웃라이어 비율이 높을수록 n을 늘려야 좋은 두 점을 고를 확률이 커집니다.'))));
      rebuild();
    },
  });
})();

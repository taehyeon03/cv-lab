const QUIZ = (() => {
  const names = { mean: '평균 필터', median: '중앙값 필터', histogram: '히스토그램', sobel: '소벨 에지', eigen: '고윳값·고유벡터 (4강)', harrisEig: '특징 가능성 C — 고윳값으로 (4강)', harrisDet: '특징 가능성 C — det·trace로 (4강)' };
  // 2×2 symmetric A = [[p r][r q]] with integer eigenvalues λ1 ≥ λ2 ≥ 0 (a second moment matrix is never negative)
  const NICE = [];
  for (let p = 0; p <= 8; p++) for (let q = 0; q <= 8; q++) for (let r = -4; r <= 4; r++) {
    if (!r) continue;
    const d = (p - q) ** 2 + 4 * r * r, sq = Math.round(Math.sqrt(d));
    if (sq * sq !== d || (p + q + sq) % 2 || p * q - r * r < 0) continue;
    NICE.push([p, q, r, (p + q + sq) / 2, (p + q - sq) / 2]);
  }
  const frac = (a, b) => { if (b < 0) { a = -a; b = -b; } const g = (x, y) => (y ? g(y, x % y) : Math.abs(x)); const d = g(a, b) || 1; return b / d === 1 ? String(a / d) : `${a / d}/${b / d}`; };
  const matTxt = (p, q, r) => `A = ⎡ ${String(p).padStart(3)}  ${String(r).padStart(3)} ⎤\n    ⎣ ${String(r).padStart(3)}  ${String(q).padStart(3)} ⎦`;
  const K = 0.04;
  function eigenSteps(p, q, r, l1, l2) {
    return [
      `Av = λv  →  (A − λI)v = 0 이 0이 아닌 v를 가지려면 det(A − λI) = 0`,
      `det ⎡${p}−λ  ${r}⎤ = (${p}−λ)(${q}−λ) − (${r})² = 0\n    ⎣${r}  ${q}−λ⎦`,
      `전개: λ² − (${p}+${q})λ + (${p}×${q} − ${r * r}) = λ² − ${p + q}λ + ${p * q - r * r} = 0   (특성 방정식)`,
      `근의 공식: λ = (${p + q} ± √(${p + q}² − 4×${p * q - r * r}))/2 = (${p + q} ± √${(p + q) ** 2 - 4 * (p * q - r * r)})/2 → λ1 = ${l1}, λ2 = ${l2}`,
      `검산: λ1 + λ2 = ${l1 + l2} = p + q (trace),  λ1 × λ2 = ${l1 * l2} = pq − r² (det)`,
    ];
  }
  function vecSteps(p, r, l, name) {
    return `${name}: (A − ${l}I)v = 0 의 첫 줄에 v = (1, a)를 넣으면 (${p}−${l})·1 + (${r})·a = 0 → a = (${l}−${p})/(${r}) = ${frac(l - p, r)}  →  ${name.replace('λ', 'v')} = (1, ${frac(l - p, r)})`;
  }
  const judge = (l1, l2) => (l1 < 0.5 ? '두 고윳값 모두 0에 가까움 → 평탄한 곳' : l2 < 0.2 * l1 ? '하나만 큼 → 에지' : '둘 다 큼 → 코너(특징점)');
  const show = n => Number.isInteger(n) ? String(n) : String(Number(n.toFixed(6)));
  function generate(type, difficulty = 'easy', rng = Math.random) {
    const normal = difficulty === 'normal';
    const a = Array.from({ length: type === 'histogram' ? 6 : 9 }, () => Math.floor(rng() * (type === 'histogram' ? 4 : 9)));
    const q = { type, title: names[type], prompt: '', given: Array.from({ length: a.length / 3 }, (_, i) => a.slice(i * 3, i * 3 + 3).join('   ')).join('\n'), answers: [], labels: [], steps: [] };
    if (type === 'mean') {
      const sum = a.reduce((s, v) => s + v, 0);
      q.prompt = '3×3 평균 필터를 적용한 중심 화소 값을 구하세요. 9개 값에 동일한 가중치 1/9를 적용합니다. 반올림하지 말고 분수 또는 소수로 입력하세요.';
      q.answers = [sum / 9]; q.labels = ['중심 화소 값'];
      q.steps = ['공식: 중심 출력 = 9개 화소의 합 ÷ 9', `합 = ${a.join(' + ')} = ${sum}`, `중심 출력 = ${sum}/9 = ${show(sum / 9)} (분수 입력 가능)`];
    } else if (type === 'median') {
      const sorted = [...a].sort((x, y) => x - y);
      q.prompt = '3×3 중앙값 필터를 적용한 중심 화소 값을 구하세요.';
      q.answers = [sorted[4]]; q.labels = ['중심 화소 값'];
      q.steps = [`오름차순 정렬: ${sorted.join(', ')}`, '9개 값의 중앙은 5번째 값입니다.', `중심 출력 = ${sorted[4]}`];
    } else if (type === 'histogram') {
      q.prompt = '명암값은 0~3입니다. 각 명암값의 화소 개수 h(0), h(1), h(2), h(3)을 구하세요. 정규화하지 않은 개수입니다.';
      q.answers = [0, 1, 2, 3].map(v => a.filter(x => x === v).length);
      q.labels = [0, 1, 2, 3].map(v => `h(${v})`);
      q.steps = q.answers.map((v, i) => `명암값 ${i}: ${v}개 → h(${i}) = ${v}`);
      q.steps.push(`검산: ${q.answers.join(' + ')} = 6개`);
      if (normal) {
        const sum = q.answers.slice(0, 3).reduce((s, v) => s + v, 0);
        q.prompt += ' 추가로 명암값 2 이하의 누적 개수를 구하세요.';
        q.answers.push(sum); q.labels.push('2 이하 누적 개수');
        q.steps.push(`누적 개수 = h(0) + h(1) + h(2) = ${q.answers.slice(0, 3).join(' + ')} = ${sum}`);
      }
    } else if (type === 'eigen' || type === 'harrisEig' || (type === 'harrisDet' && !normal)) {
      const [p, qm, r, l1, l2] = NICE[Math.floor(rng() * NICE.length)];
      q.given = matTxt(p, qm, r);
      if (type === 'eigen') {
        q.prompt = '대칭 행렬 A의 고윳값 λ1 ≥ λ2를 구하세요.' + (normal ? '\n추가로 각 고윳값의 고유벡터를 (1, a) 꼴로 쓸 때 a를 구하세요 (분수 가능).' : '');
        q.answers = [l1, l2]; q.labels = ['λ1 (큰 값)', 'λ2 (작은 값)'];
        q.steps = eigenSteps(p, qm, r, l1, l2);
        if (normal) { q.answers.push((l1 - p) / r, (l2 - p) / r); q.labels.push('v1 = (1, a)의 a', 'v2 = (1, a)의 a'); q.steps.push(vecSteps(p, r, l1, 'λ1'), vecSteps(p, r, l2, 'λ2'), `두 고유벡터는 서로 수직: 1×1 + (${frac(l1 - p, r)})×(${frac(l2 - p, r)}) = 0. v1은 밝기 변화가 가장 큰 방향, v2는 가장 작은 방향.`); }
      } else if (type === 'harrisEig') {
        const C = l1 * l2 - K * (l1 + l2) ** 2;
        q.prompt = `2차 모멘트 행렬 A가 아래와 같습니다. 고윳값 λ1 ≥ λ2를 구하고, 식 (4.8) C = λ1λ2 − k(λ1+λ2)² 으로 특징 가능성 C를 구하세요. k = ${K}, C는 소수 둘째 자리까지.`;
        q.answers = [l1, l2, C]; q.labels = ['λ1', 'λ2', 'C'];
        q.steps = [...eigenSteps(p, qm, r, l1, l2), `C = ${l1}×${l2} − ${K}×(${l1}+${l2})² = ${l1 * l2} − ${K}×${(l1 + l2) ** 2} = ${C.toFixed(4)}`, `판정: ${judge(l1, l2)}`];
      } else {
        const det = p * qm - r * r, tr = p + qm, C = det - K * tr * tr;
        q.prompt = `고윳값을 구하지 않고 식 (4.9) C = det(A) − k·trace(A)² 으로 특징 가능성 C를 구하세요. A = [[p r][r q]], k = ${K}, C는 소수 둘째 자리까지.`;
        q.answers = [det, tr, C]; q.labels = ['det(A) = pq − r²', 'trace(A) = p + q', 'C'];
        q.steps = [`det(A) = ${p}×${qm} − (${r})² = ${p * qm} − ${r * r} = ${det}`, `trace(A) = ${p} + ${qm} = ${tr}`, `C = ${det} − ${K}×${tr}² = ${det} − ${K * tr * tr} = ${C.toFixed(4)}`, `고윳값이 필요 없는 이유: λ1λ2 = det(A), λ1+λ2 = trace(A) 이므로 식 (4.8)과 같은 값입니다 (이 행렬의 고윳값은 ${l1}, ${l2}). 제곱근 계산이 없어 빠릅니다.`, `판정: ${judge(l1, l2)}`];
      }
    } else if (type === 'harrisDet') {
      // normal: start from the derivatives of four pixels (box weights 1) → A → det, trace, C
      const g = Array.from({ length: 4 }, () => [Math.floor(rng() * 5) - 2, Math.floor(rng() * 5) - 2]);
      const p = g.reduce((s2, [y]) => s2 + y * y, 0), qq = g.reduce((s2, [, x]) => s2 + x * x, 0), r = g.reduce((s2, [y, x]) => s2 + y * x, 0);
      const det = p * qq - r * r, tr = p + qq, C = det - K * tr * tr;
      q.given = g.map(([y, x], i) => `화소 ${i + 1}:  d_y = ${String(y).padStart(2)},  d_x = ${String(x).padStart(2)}`).join('\n');
      q.prompt = `창 안 네 화소의 미분값입니다 (가중치는 모두 1). 2차 모멘트 행렬 A = [[p r][r q]] 를 만든 뒤, 고윳값 없이 C = det(A) − k·trace(A)² 을 구하세요. p = Σd_y², q = Σd_x², r = Σd_y·d_x, k = ${K}, C는 소수 둘째 자리까지.`;
      q.answers = [p, qq, r, det, tr, C]; q.labels = ['p = Σd_y²', 'q = Σd_x²', 'r = Σd_y·d_x', 'det(A)', 'trace(A)', 'C'];
      const [l1, l2] = [(tr + Math.sqrt((p - qq) ** 2 + 4 * r * r)) / 2, (tr - Math.sqrt((p - qq) ** 2 + 4 * r * r)) / 2];
      q.steps = [`p = ${g.map(([y]) => `(${y})²`).join(' + ')} = ${p}`, `q = ${g.map(([, x]) => `(${x})²`).join(' + ')} = ${qq}`, `r = ${g.map(([y, x]) => `(${y})(${x})`).join(' + ')} = ${r}`, `det(A) = ${p}×${qq} − (${r})² = ${det},  trace(A) = ${p} + ${qq} = ${tr}`, `C = ${det} − ${K}×${tr}² = ${C.toFixed(4)}`, `참고: 고윳값은 ${l1.toFixed(3)}, ${l2.toFixed(3)} → ${judge(l1, l2)}`];
    } else {
      const kx = [-1,0,1,-2,0,2,-1,0,1], ky = [-1,-2,-1,0,0,0,1,2,1];
      const gx = a.reduce((s, v, i) => s + v * kx[i], 0), gy = a.reduce((s, v, i) => s + v * ky[i], 0);
      q.prompt = '중심 화소에서 Gx, Gy를 계산하세요. 커널을 뒤집지 않고 같은 위치끼리 곱해서 더합니다. 경계 처리는 필요 없습니다.\nGx 커널: [-1 0 1; -2 0 2; -1 0 1]\nGy 커널: [-1 -2 -1; 0 0 0; 1 2 1]';
      q.answers = [gx, gy]; q.labels = ['Gx', 'Gy'];
      q.steps = [`Gx = ${a.map((v, i) => `${v}×(${kx[i]})`).join(' + ')} = ${gx}`, `Gy = ${a.map((v, i) => `${v}×(${ky[i]})`).join(' + ')} = ${gy}`];
      if (normal) {
        const mag = Math.hypot(gx, gy);
        q.prompt += '\n추가로 에지 강도 √(Gx² + Gy²)를 소수 둘째 자리까지 구하세요.';
        q.answers.push(mag); q.labels.push('에지 강도');
        q.steps.push(`강도 = √((${gx})² + (${gy})²) = √${gx * gx + gy * gy} = ${mag.toFixed(2)}`);
      }
    }
    if (normal && (type === 'mean' || type === 'median')) {
      const min = Math.min(...a), max = Math.max(...a);
      q.prompt += ' 추가로 입력 영역의 최댓값 − 최솟값을 구하세요.';
      q.answers.push(max - min); q.labels.push('입력 범위 (최댓값 − 최솟값)');
      q.steps.push(`최댓값 = ${max}, 최솟값 = ${min} → 범위 = ${max} − ${min} = ${max - min}`);
    }
    return q;
  }
  function parseAnswer(raw) {
    const s = String(raw ?? '').trim();
    const number = '[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)';
    if (!new RegExp(`^${number}(?:\\s*/\\s*${number})?$`).test(s)) return null;
    const parts = s.split('/').map(Number);
    if (parts.length === 2 && parts[1] === 0) return null;
    const value = parts.length === 2 ? parts[0] / parts[1] : parts[0];
    return Number.isFinite(value) ? value : null;
  }
  function grade(q, raw) {
    return q.answers.map((expected, i) => {
      const value = parseAnswer(raw[i]);
      const tolerance = (q.type === 'sobel' && i === 2) || (q.type.startsWith('harris') && q.labels[i] === 'C') ? 0.0051 : 1e-6;
      return { valid: value !== null, correct: value !== null && Math.abs(value - expected) <= tolerance, expected, value };
    });
  }
  function panel(topics = Object.keys(names), def = topics[0], idp = 'practice') {
    const { h } = UI;
    let topic = def, difficulty = 'easy', q, inputs = [];
    const problem = h('div', { class: 'card' });
    const feedback = h('div', { 'aria-live': 'polite', role: 'status' });
    const solution = h('div', { class: 'card', id: idp + '-solution' }); solution.hidden = true;
    const reveal = h('button', { type: 'button', class: 'btn', 'aria-expanded': 'false', 'aria-controls': idp + '-solution', onclick: () => {
      solution.hidden = !solution.hidden; reveal.setAttribute('aria-expanded', String(!solution.hidden)); reveal.textContent = solution.hidden ? '풀이 보기' : '풀이 닫기';
    } }, '풀이 보기');
    function fresh() {
      q = generate(topic, difficulty); inputs = [];
      feedback.replaceChildren(); solution.hidden = true; reveal.setAttribute('aria-expanded', 'false'); reveal.textContent = '풀이 보기';
      const fields = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: '12px' } });
      q.labels.forEach((label, i) => {
        const input = h('input', { id: `${idp}-answer-${i}`, type: 'text', autocomplete: 'off', placeholder: '예: 3 또는 7/9', style: { width: '100%', boxSizing: 'border-box', padding: '10px' }, oninput: () => feedback.replaceChildren() });
        inputs.push(input);
        fields.append(h('div', {}, h('label', { for: input.id }, label), input));
      });
      const form = h('form', { onsubmit: e => {
        e.preventDefault();
        const results = grade(q, inputs.map(x => x.value));
        feedback.replaceChildren(h('p', {}, results.every(x => x.correct) ? '모두 정답입니다!' : '입력한 답을 확인하세요.'), ...results.map((r, i) => h('p', {}, `${q.labels[i]}: ${!r.valid ? '숫자 또는 분수를 입력하세요. 분모는 0일 수 없습니다.' : r.correct ? '정답 ✓' : '오답 — 다시 계산해 보세요.'}`)));
      } }, fields, h('p', { class: 'caption' }, '분수와 소수 입력 가능 · 음수는 - 기호 사용'), h('button', { class: 'btn', type: 'submit' }, '채점하기'));
      problem.replaceChildren(h('h2', {}, q.title), h('p', { style: { whiteSpace: 'pre-line' } }, q.prompt), h('pre', { style: { fontSize: '22px', lineHeight: '1.8', overflowX: 'auto' }, 'aria-label': '입력 화소 행렬' }, q.given), form);
      solution.replaceChildren(h('h2', {}, '단계별 풀이'), h('ol', {}, q.steps.map(s => h('li', { style: { marginBottom: '12px', overflowWrap: 'anywhere' } }, s))));
    }
    const typeSelect = h('select', { id: idp + '-topic', onchange: e => { topic = e.target.value; fresh(); } }, topics.map(v => h('option', { value: v }, names[v])));
    typeSelect.value = topic;
    const levelSelect = h('select', { id: idp + '-level', onchange: e => { difficulty = e.target.value; fresh(); } }, h('option', { value: 'easy' }, '쉬움 · 기본 계산'), h('option', { value: 'normal' }, '보통 · 추가 계산'));
    fresh();
    return h('div', { class: 'stack' }, h('div', { class: 'card', style: { display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' } }, h('label', { for: idp + '-topic' }, '문제 유형'), typeSelect, h('label', { for: idp + '-level' }, '난이도'), levelSelect, h('button', { type: 'button', class: 'btn', onclick: fresh }, '새 문제')), problem, feedback, h('div', {}, reveal), solution);
  }
  function mount(root) {
    const { h } = UI;
    root.append(h('header', { class: 'mod-head' }, h('div', { class: 'mod-num' }, '연습'), h('h1', {}, '손으로 푸는 문제')), h('p', { class: 'lead' }, '작은 행렬과 정수로 직접 계산해 보세요. 쉬움은 약 3~5분, 보통은 약 5~10분입니다. 답을 제출한 뒤 다시 시도하거나 단계별 풀이를 확인할 수 있습니다.'), panel());
  }
  return { generate, parseAnswer, grade, mount, panel, NICE };
})();
if (typeof APP !== 'undefined') APP.mod({ id: 'practice', ch: 'practice', num: '연습', title: '손으로 푸는 문제', src: '2강 · 3강 · 4강 계산 연습', blurb: '출제 · 답안 채점 · 단계별 풀이', mount: QUIZ.mount });

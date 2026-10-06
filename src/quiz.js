const QUIZ = (() => {
  const names = { mean: '평균 필터', median: '중앙값 필터', histogram: '히스토그램', sobel: '소벨 에지' };
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
      const tolerance = q.type === 'sobel' && i === 2 ? 0.0051 : 1e-6;
      return { valid: value !== null, correct: value !== null && Math.abs(value - expected) <= tolerance, expected, value };
    });
  }
  function mount(root) {
    const { h } = UI;
    let topic = 'mean', difficulty = 'easy', q, inputs = [];
    const problem = h('div', { class: 'card' });
    const feedback = h('div', { 'aria-live': 'polite', role: 'status' });
    const solution = h('div', { class: 'card', id: 'practice-solution' }); solution.hidden = true;
    const reveal = h('button', { type: 'button', class: 'btn', 'aria-expanded': 'false', 'aria-controls': 'practice-solution', onclick: () => {
      solution.hidden = !solution.hidden; reveal.setAttribute('aria-expanded', String(!solution.hidden)); reveal.textContent = solution.hidden ? '풀이 보기' : '풀이 닫기';
    } }, '풀이 보기');
    function fresh() {
      q = generate(topic, difficulty); inputs = [];
      feedback.replaceChildren(); solution.hidden = true; reveal.setAttribute('aria-expanded', 'false'); reveal.textContent = '풀이 보기';
      const fields = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: '12px' } });
      q.labels.forEach((label, i) => {
        const input = h('input', { id: `practice-answer-${i}`, type: 'text', autocomplete: 'off', placeholder: '예: 3 또는 7/9', style: { width: '100%', boxSizing: 'border-box', padding: '10px' }, oninput: () => feedback.replaceChildren() });
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
    const typeSelect = h('select', { id: 'practice-topic', onchange: e => { topic = e.target.value; fresh(); } }, Object.entries(names).map(([v, name]) => h('option', { value: v }, name)));
    const levelSelect = h('select', { id: 'practice-level', onchange: e => { difficulty = e.target.value; fresh(); } }, h('option', { value: 'easy' }, '쉬움 · 기본 계산'), h('option', { value: 'normal' }, '보통 · 추가 계산'));
    root.append(h('header', { class: 'mod-head' }, h('div', { class: 'mod-num' }, '연습'), h('h1', {}, '손으로 푸는 문제')), h('p', { class: 'lead' }, '작은 행렬과 정수로 직접 계산해 보세요. 쉬움은 약 3~5분, 보통은 약 5~10분입니다. 답을 제출한 뒤 다시 시도하거나 단계별 풀이를 확인할 수 있습니다.'), h('div', { class: 'card', style: { display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' } }, h('label', { for: 'practice-topic' }, '문제 유형'), typeSelect, h('label', { for: 'practice-level' }, '난이도'), levelSelect, h('button', { type: 'button', class: 'btn', onclick: fresh }, '새 문제')), problem, feedback, reveal, solution);
    fresh();
  }
  return { generate, parseAnswer, grade, mount };
})();
if (typeof APP !== 'undefined') APP.mod({ id: 'practice', ch: 'practice', num: '연습', title: '손으로 푸는 문제', src: '2강 · 3강 계산 연습', blurb: '출제 · 답안 채점 · 단계별 풀이', mount: QUIZ.mount });

// Module registry, page scaffold and hash router.
const APP = (() => {
  const { h } = UI;
  const mods = [];
  const mounted = new Map();
  const mod = m => mods.push(m);

  const slidebar = () => h('div', { class: 'slidebar', 'aria-hidden': 'true' }, h('i'), h('i'), h('i'), h('i'));
  function scaffold(root, m, { lead, formulas }) {
    root.append(
      h('header', { class: 'mod-head' }, h('div', { class: 'mod-num' }, m.num), h('h1', {}, m.title), h('div', { class: 'src' }, m.src)),
      slidebar(),
      h('p', { class: 'lead', html: lead }));
    if (formulas && formulas.length) {
      root.append(h('div', { class: 'formula-card' }, h('div', { class: 'eqs' }, formulas.map(f => (typeof f === 'string' ? h('div', { class: 'eq' }, f) : h('div', { class: 'eq' }, f[0], h('div', { class: 'tag' }, f[1])))))));
    }
  }
  // grey value → readable cell colours in both themes
  function grayCell(v, max = 255) {
    const t = Math.max(0, Math.min(1, v / max)), g = Math.round(250 - t * 205);
    return { bg: `rgb(${g},${g},${g})`, color: g < 140 ? '#fff' : '#1b211d' };
  }
  function signedCell(v, amax) {
    const t = Math.min(1, Math.abs(v) / (amax || 1));
    return { bg: v >= 0 ? `color-mix(in srgb, var(--pos) ${Math.round(t * 60)}%, var(--cell-bg))` : `color-mix(in srgb, var(--neg) ${Math.round(t * 60)}%, var(--cell-bg))` };
  }
  const parseGrid = s => s.trim().split('\n').map(r => r.trim().split(/\s+/).map(Number));

  function intro(root) {
    root.append(
      h('header', { class: 'mod-head' }, h('div', { class: 'mod-num' }, 'CV'), h('h1', {}, '컴퓨터비전개론 알고리즘 실습실'), h('div', { class: 'src' }, '2강 영상처리 · 3강 에지 검출 — 강의자료의 알고리즘을 직접 돌려 보는 곳')),
      slidebar(),
      h('p', { class: 'lead', html: '각 페이지는 <b>① 강의자료의 수식</b>, <b>② 값을 직접 바꿀 수 있는 시각화</b>, <b>③ 교재 의사 코드와 한 줄씩 맞춰 보는 단계 실행기</b>로 되어 있습니다. 단계 실행기는 Python Tutor처럼 ◀ ▶ 버튼(또는 키보드 ← →)으로 한 단계씩 움직이며, 지금 실행 중인 코드 줄이 노란색으로 표시되고 변수 값과 호출 스택이 함께 바뀝니다. 격자의 숫자는 대부분 클릭해서 바꿀 수 있습니다.' }),
    );
    for (const ch of ['2', '3']) {
      root.append(h('h2', { style: { fontSize: '17px', margin: '26px 0 10px' } }, ch === '2' ? 'Chapter 2 · 영상처리' : 'Chapter 3 · 에지 검출'));
      root.append(h('div', { class: 'intro-grid' }, mods.filter(m => m.ch === ch).map(m => h('a', { href: '#' + m.id }, h('div', { class: 'card' }, h('span', { class: 'n' }, m.num + (m.star ? '  · 단계 실행' : '')), h('b', {}, m.title), h('span', { class: 'caption' }, m.blurb))))));
    }
    root.append(h('p', { class: 'caption', style: { marginTop: '28px' } }, '예제 숫자는 강의자료(교재 예제 2-1, 2-2, 2-5, 2-6, 3-1, 3-2, 3-3, 그림 3-22, 3-25)와 같게 맞췄고, 결과도 교재 값과 대조해 두었습니다.'));
  }

  function nav() {
    const rail = document.getElementById('rail'), msel = document.getElementById('msel');
    const groups = [['2', '2강 · 영상처리'], ['3', '3강 · 에지 검출']];
    rail.append(h('a', { href: '#', 'data-id': '' }, h('span', { class: 'n' }, '—'), h('span', {}, '개요')));
    msel.append(h('option', { value: '' }, '개요'));
    for (const [ch, label] of groups) {
      rail.append(h('h3', {}, label));
      const og = h('optgroup', { label });
      for (const m of mods.filter(x => x.ch === ch)) {
        rail.append(h('a', { href: '#' + m.id, 'data-id': m.id }, h('span', { class: 'n' }, m.num), h('span', {}, m.title, m.star ? h('span', { class: 'star', title: '단계 실행기 있음' }, '●') : null)));
        og.append(h('option', { value: m.id }, `${m.num} ${m.title}`));
      }
      msel.append(og);
    }
    msel.addEventListener('change', () => (location.hash = msel.value));
  }

  function route() {
    const id = location.hash.slice(1);
    const m = mods.find(x => x.id === id);
    const main = document.getElementById('main');
    for (const [, el] of mounted) el.hidden = true;
    const key = m ? m.id : '';
    if (!mounted.has(key)) {
      const el = h('section', { class: 'mod' });
      main.append(el);
      mounted.set(key, el);
      if (m) m.mount(el, m); else intro(el);
      UI.typeset(el);
    }
    mounted.get(key).hidden = false;
    document.querySelectorAll('#rail a').forEach(a => a.setAttribute('aria-current', String(a.dataset.id === key)));
    document.getElementById('msel').value = key;
    document.title = m ? `${m.title} · 컴퓨터비전 실습실` : '컴퓨터비전 실습실';
    window.scrollTo(0, 0);
  }

  function start() {
    nav();
    window.addEventListener('hashchange', route);
    route();
  }
  return { mod, mods, scaffold, slidebar, grayCell, signedCell, parseGrid, start };
})();

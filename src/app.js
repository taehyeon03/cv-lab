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
      h('header', { class: 'mod-head' }, h('div', { class: 'mod-num' }, 'CV'), h('h1', {}, '컴퓨터비전개론 알고리즘 실습실'), h('div', { class: 'src' }, '2강 영상처리 · 3강 에지 검출 · 4강 지역 특징 검출 · 5강 영상 분할 — 강의자료의 알고리즘을 직접 돌려 보는 곳')),
      slidebar(),
      h('p', { class: 'lead', html: '각 페이지는 <b>① 강의자료의 수식</b>, <b>② 값을 직접 바꿀 수 있는 시각화</b>, <b>③ 교재 의사 코드와 한 줄씩 맞춰 보는 단계 실행기</b>로 되어 있습니다. 단계 실행기는 Python Tutor처럼 ◀ ▶ 버튼(또는 키보드 ← →)으로 한 단계씩 움직이며, 지금 실행 중인 코드 줄이 노란색으로 표시되고 변수 값과 호출 스택이 함께 바뀝니다. 격자의 숫자는 대부분 클릭해서 바꿀 수 있습니다.' }),
    );
    const FLOW = [
      ['2강', '영상처리', '화소 값을 다듬는다', '히스토그램·이진화·필터(컨볼루션)·모폴로지 — 뒤의 모든 장이 쓰는 기본 도구', 'hist'],
      ['3강', '에지 검출', '밝기가 급변하는 곳을 찾는다', '미분 → 가우시안·LOG → 캐니 → 에지를 선분으로 (허프·RANSAC)', 'deriv'],
      ['4강', '지역 특징', '다시 찾기 쉬운 점을 찾는다', '모라벡 → 해리스 → 위치 찾기 → 크기까지 (스케일 공간, SIFT, SURF)', 'feat'],
      ['5강', '영상 분할', '화소를 물체별 영역으로 묶는다', '단순 규칙 → 그래프·민시프트·워터셰드 → 사용자와 함께 (스네이크, 그래프 절단)', 'seg51'],
    ];
    root.append(h('div', { class: 'card course-flow' }, h('h3', {}, '전체 흐름', h('small', {}, '앞 장의 결과가 다음 장의 재료가 됩니다')),
      h('div', { class: 'cf-row' }, FLOW.map(([n, t, goal, how, id]) => h('a', { href: '#' + id }, h('small', {}, n), h('b', {}, t), h('span', { class: 'goal' }, goal), h('span', { class: 'how' }, how)))),
      h('p', { class: 'caption' }, '처음이라면: 각 페이지 맨 위의 “쉽게 말하면” 카드를 먼저 읽고 → “먼저 해 볼 것”을 해 본 다음 → 수식과 단계 실행기를 보세요. 페이지 아래의 이전·다음 버튼으로 순서대로 넘어갈 수 있습니다.')));
    const CH = { 2: 'Chapter 2 · 영상처리', 3: 'Chapter 3 · 에지 검출', 4: 'Chapter 4 · 지역 특징 검출', 5: 'Chapter 5 · 영상 분할', practice: '직접 풀어 보기' };
    for (const ch of ['2', '3', '4', '5', 'practice']) {
      root.append(h('h2', { style: { fontSize: '17px', margin: '26px 0 10px' } }, CH[ch]));
      root.append(h('div', { class: 'intro-grid' }, mods.filter(m => m.ch === ch).map(m => h('a', { href: '#' + m.id }, h('div', { class: 'card' }, h('span', { class: 'n' }, m.num + (m.star ? '  · 단계 실행' : '')), h('b', {}, m.title), h('span', { class: 'caption' }, m.blurb))))));
    }
    root.append(h('p', { class: 'caption', style: { marginTop: '28px' } }, '예제 숫자는 강의자료(교재 예제 2-1, 2-2, 2-5, 2-6, 3-1, 3-2, 3-3, 4-1, 4-2, 5-1, 5-2, 그림 3-22, 3-25, 4-9, 5-7, 5-16, 5-20)와 같게 맞췄고, 결과도 교재 값과 대조해 두었습니다.'));
  }

  // Each answer starts with the intuition, then shows the mathematics separately.
  const R = String.raw;
  const FAQ = {
    deriv: [
      ['미분 결과를 이진화하면 무엇이 남나요?', R`<p class="faq-key">밝기가 충분히 급하게 변하는 위치만 에지로 남깁니다.</p><p>밝아지는 변화와 어두워지는 변화를 모두 잡으려고 미분의 절댓값을 씁니다.</p><div class="faq-math">$$b(x)=\begin{cases}1,&|f'(x)|\ge T\\0,&|f'(x)|\lt T\end{cases}$$</div><p>그림 3-2에서는 아래 값 중 4만 임계값을 넘으므로 해당 위치만 남습니다.</p><div class="faq-math">$$|f'|=[0,1,1,1,2,\mathbf{4},0,1,1],\qquad T=3$$</div><p class="faq-note">마지막 칸의 ‘−’는 에지가 없다는 뜻이 아닙니다. 다음 화소가 없어서 전방 차분을 계산하지 못한 칸입니다.</p>`],
      ['임계값은 어떻게 정하나요?', R`<p class="faq-key">어느 정도의 밝기 변화부터 에지로 인정할지 정하는 기준입니다.</p><p>너무 낮으면 잡음까지 남고, 너무 높으면 실제 경계도 사라집니다. 그림 3-2와 같은 결과가 나오는 범위는 다음과 같습니다.</p><div class="faq-math">$$2\lt T\le4$$</div><p>‘그림 3-2’ 버튼은 \(T=3\)을 사용합니다. 교재가 특정 값을 정해 준 것은 아닙니다.</p><p class="faq-note">실제 영상에서는 실험으로 고르거나, 미분 크기의 분포를 이용합니다. 캐니는 추적을 시작할 기준과 이어 갈 기준을 따로 둡니다.</p>`],
      ['미분 식에는 왜 나누는 값이 없나요?', R`<p class="faq-key">옆 화소까지의 간격이 1이어서, 1로 나누는 부분이 생략된 것입니다.</p><div class="faq-math">$$f'(x)\approx\frac{f(x+1)-f(x)}{1}$$</div><p>양옆 화소를 쓰면 거리가 2이므로 분모에도 2가 들어갑니다.</p><div class="faq-math">$$f'(x)\approx\frac{f(x+1)-f(x-1)}{2}$$</div><p>공통 배율을 생략한 마스크는 다음과 같습니다. 미분 크기는 달라지지만 에지 위치는 그대로입니다. 임계값도 배율에 맞춰 해석해야 합니다.</p><div class="faq-math">$$[-1,\;0,\;1]$$</div>`],
      ['2차 미분 마스크는 어떻게 나오나요?', R`<p class="faq-key">오른쪽 기울기에서 왼쪽 기울기를 빼는 것입니다.</p><p>밝기 자체의 변화가 아니라, 기울기가 얼마나 달라지는지 봅니다.</p><div class="faq-math">$$\begin{aligned}f''(x)&\approx [f(x+1)-f(x)]-[f(x)-f(x-1)]\\&=f(x+1)-2f(x)+f(x-1)\end{aligned}$$</div><p>각 화소에 곱하는 계수만 꺼내면 마스크가 됩니다.</p><div class="faq-math">$$[1,\;-2,\;1]$$</div><p class="faq-note">밝기가 일정한 기울기로 변하면 결과는 0입니다. 기울기가 바뀌는 곳에서 양수나 음수가 나타납니다.</p>`],
    ],
    sobel: [
      ['로버츠는 왜 대각선으로 비교하나요?', R`<p class="faq-key">작은 정사각형의 두 대각선은 같은 중심을 지나기 때문입니다.</p><p>현재 화소를 왼쪽 위에 놓고 두 대각선의 밝기 차이를 구합니다.</p><div class="faq-math">$$\begin{aligned}d_y&=f(y+1,x)-f(y,x+1)\\d_x&=f(y+1,x+1)-f(y,x)\end{aligned}$$</div><p>가로·세로 차분은 서로 다른 위치에서 측정되지만, 두 대각선은 정중앙에서 교차하므로 같은 위치의 변화를 비교할 수 있습니다.</p><p class="faq-note">대각선 간격은 \(\sqrt2\)입니다. 축이 가로·세로에서 \(45^\circ\) 돌아가 있어 크기와 방향의 기준도 다릅니다. 스무딩이 없어 잡음의 영향을 쉽게 받습니다.</p>`],
      ['프레윗과 소벨 마스크는 어떻게 만드나요?', R`<p class="faq-key">한 방향으로는 밝기 차이를 구하고, 그 수직 방향으로는 주변 값을 섞습니다.</p><p>프레윗은 세 줄에 같은 비중을 줍니다.</p><div class="faq-math">$$m_x=\begin{bmatrix}1\\1\\1\end{bmatrix}\begin{bmatrix}-1&0&1\end{bmatrix}=\begin{bmatrix}-1&0&1\\-1&0&1\\-1&0&1\end{bmatrix}$$</div><p>소벨은 가운데 줄에 더 큰 비중을 줍니다.</p><div class="faq-math">$$m_x=\begin{bmatrix}1\\2\\1\end{bmatrix}\begin{bmatrix}-1&0&1\end{bmatrix}=\begin{bmatrix}-1&0&1\\-2&0&2\\-1&0&1\end{bmatrix}$$</div><p class="faq-note">위 마스크는 정규화 배율을 생략한 형태입니다. 로버츠는 스무딩 없이, 프레윗은 균등하게, 소벨은 가운데를 더 크게 반영합니다.</p>`],
    ],
    zc: [
      ['한 화소만 설명하는데, 결과에는 왜 여러 에지가 있나요?', R`<p class="faq-key">설명에 나온 좌표는 예시 하나이고, 같은 검사를 모든 내부 화소에 반복합니다.</p><p>예제의 \((6,3)\)만 검사하는 것이 아닙니다. 교재 규칙인 ‘통과한 쌍이 두 개 이상’을 전체에 적용하면 그림 3-14의 에지 화소는 21개입니다.</p><p class="faq-note">‘한 쌍 이상’으로 바꾸면 이 예제에서는 28개가 되어 교재 결과와 달라집니다.</p>`],
      ['통과한 쌍이 세 개나 네 개면 어떻게 되나요?', R`<p class="faq-key">결과는 통과한 쌍의 개수가 아니라, 에지인지 아닌지만 저장합니다.</p><div class="faq-math">$$b(y,x)=\begin{cases}1,&\text{통과한 쌍이 2개 이상}\\0,&\text{그 외}\end{cases}$$</div><p>따라서 두 쌍, 세 쌍, 네 쌍 모두 결과는 1입니다. 이 예제에서는 각각 8개, 9개, 4개의 화소가 해당합니다.</p><div class="faq-math">$$8+9+4=21$$</div>`],
      ['영교차에서 임계값은 어떤 역할인가요?', R`<p class="faq-key">부호가 바뀌기만 한 작은 흔들림을 버리고, 충분히 큰 변화만 남깁니다.</p><p>마주 보는 두 값의 부호가 다르고, 그 차이도 기준보다 커야 통과합니다.</p><div class="faq-math">$$|a-b|>T$$</div><p>평탄한 곳에서도 잡음 때문에 LOG 값이 0 주변을 오갈 수 있습니다. 임계값은 이런 작은 흔들림을 걸러 줍니다.</p><p class="faq-note">예제에서 임계값을 높일수록 남는 에지 화소가 줄어듭니다.</p><div class="faq-math">$$\begin{array}{c|rrrr}T&0\sim1&3&5&12\\\hline\text{에지 개수}&21&18&14&2\end{array}$$</div>`],
    ],
    canny: [
      ['비최대 억제에서는 어느 이웃과 비교하나요?', R`<p class="faq-key">경계선을 따라가는 방향이 아니라, 경계선을 가로지르는 방향으로 비교합니다.</p><p>두께가 있는 경계에서 가장 강한 가운데 화소만 남기려는 것입니다.</p><ul><li>가로 경계 → 위·아래와 비교</li><li>세로 경계 → 왼쪽·오른쪽과 비교</li><li>↘ 경계 → 오른쪽 위·왼쪽 아래와 비교</li><li>↙ 경계 → 왼쪽 위·오른쪽 아래와 비교</li></ul><p class="faq-note">반대 방향은 같은 두 이웃을 순서만 바꿔 보는 것이므로 판정이 같습니다.</p>`],
      ['이웃이 더 크면 가운데 값은 없어지나요?', R`<p class="faq-key">이 실습의 교재 규칙에서는 양쪽 이웃보다 모두 커야 남습니다.</p><p>중심 강도를 \(S_c\), 두 이웃을 \(S_a,S_b\)라고 하면:</p><div class="faq-math">$$\text{유지 조건: }S_c>S_a\quad\text{그리고}\quad S_c>S_b$$</div><p>하나라도 중심보다 크거나 같으면 중심을 0으로 만듭니다.</p><div class="faq-math">$$[80,\;\mathbf{150},\;90]\ \longrightarrow\ \text{유지}$$$$[200,\;\mathbf{150},\;90]\ \longrightarrow\ \text{제거}$$</div>`],
      ['이웃과 값이 같아도 지워지는 게 맞나요?', R`<p class="faq-key">교재는 같은 값도 억제하도록 되어 있습니다.</p><div class="faq-math">$$S_c\le S_a\quad\text{또는}\quad S_c\le S_b\quad\Longrightarrow\quad 0$$</div><p>그래서 466처럼 같은 강도가 나란히 있으면 둘 다 지워질 수 있습니다. 실제 경계가 두 화소 사이에 있을 때 이런 동점이 생깁니다.</p><p class="faq-note">동점을 처리하는 규칙은 구현마다 다릅니다. 한쪽 비교에만 등호를 넣어 하나를 남기는 방법도 있지만, 이 실습은 교재의 비교 규칙을 따릅니다.</p>`],
      ['낮은 임계값과 높은 임계값은 언제 쓰나요?', R`<p class="faq-key">높은 기준은 추적을 시작할 때, 낮은 기준은 연결을 이어 갈 때 씁니다.</p><p>비최대 억제 이후의 이력 임계값 단계에서 적용합니다.</p><div class="faq-math">$$S>T_{\mathrm{high}}\quad\Rightarrow\quad\text{추적 시작}$$$$S>T_{\mathrm{low}}\quad\Rightarrow\quad\text{연결된 이웃으로 추적 계속}$$</div><p>낮은 기준만 넘은 화소는 강한 에지와 이어져 있어야 살아남습니다.</p><p class="faq-note">높은 임계값과 낮은 임계값의 비율로 흔히 제시되는 출발점은 다음과 같으며, 영상에 맞춰 조정합니다.</p><div class="faq-math">$$T_{\mathrm{high}}:T_{\mathrm{low}}\approx 2:1\sim3:1$$</div>`],
    ],
    moravec: [
      ['방향별 변화량 중 왜 최솟값을 쓰나요?', R`<p class="faq-key">가장 덜 변하는 방향에서도 변화가 커야 코너이기 때문입니다.</p><p>에지는 경계를 가로지르면 크게 바뀌지만, 경계를 따라 움직이면 거의 안 바뀝니다. 코너는 어느 방향으로 움직여도 달라집니다.</p><div class="faq-math">$$C=\min_{(v,u)}S(v,u)$$</div><p class="faq-note">최댓값이나 합을 쓰면 한 방향으로만 크게 변하는 에지도 높은 점수를 받을 수 있습니다.</p>`],
      ['예제에서 오른쪽으로 옮긴 변화량 4는 어떻게 나오나요?', R`<p class="faq-key">창 안의 각 화소를 오른쪽 이웃과 비교하고, 차이의 제곱을 모두 더합니다.</p><p>예제 4-1의 점 \(b=(5,3)\) 주변 창을 사용합니다.</p><div class="faq-math">$$S(0,1)=\sum_{y=4}^{6}\sum_{x=2}^{4}\big(f(y,x+1)-f(y,x)\big)^2=4$$</div><p>두 번째 열에서 세 번째 열로 넘어갈 때 값이 바뀌는 항이 세 개 있고, 네 번째 행에서 추가로 한 항이 바뀝니다. 나머지 항은 차이가 0입니다.</p><div class="faq-math">$$3\times1^2+1\times1^2=4$$</div><p class="faq-note">단계 실행기에서 창 안의 항을 하나씩 확인할 수 있습니다.</p>`],
    ],
    harris: [
      ['테일러 근사는 왜 쓰나요?', R`<p class="faq-key">이동할 때마다 다시 비교하지 않고, 현재 위치의 미분으로 작은 이동의 변화를 예상하려는 것입니다.</p><div class="faq-math">$$f(y+v,x+u)\approx f(y,x)+v\,d_y+u\,d_x$$</div><p>이 식을 대입하면 변화량을 하나의 행렬로 묶을 수 있습니다.</p><div class="faq-math">$$S(v,u)\approx\begin{bmatrix}v&u\end{bmatrix}A\begin{bmatrix}v\\u\end{bmatrix}$$</div><p>행렬 \(A\)는 한 번 계산해 두고 여러 이동 방향에 사용할 수 있습니다. 모라벡처럼 방향마다 창 전체를 다시 비교할 필요가 줄어듭니다.</p>`],
      ['고유값 대신 행렬식과 대각합을 쓰는 이유는?', R`<p class="faq-key">필요한 것은 고유값 각각이 아니라, 두 값의 곱과 합이기 때문입니다.</p><div class="faq-math">$$\lambda_1\lambda_2=\det(A),\qquad\lambda_1+\lambda_2=\operatorname{tr}(A)$$</div><p>따라서 해리스 점수는 고유값을 직접 풀지 않고 계산할 수 있습니다.</p><div class="faq-math">$$\begin{aligned}C&=\lambda_1\lambda_2-k(\lambda_1+\lambda_2)^2\\&=\det(A)-k\,\operatorname{tr}(A)^2\end{aligned}$$</div><ul><li>두 고유값이 모두 크고 한쪽으로 치우치지 않음 → 코너 후보</li><li>한 고유값만 큼 → 에지</li><li>둘 다 작음 → 평탄한 곳</li></ul><p class="faq-note">양수라고 무조건 코너는 아닙니다. 충분히 큰 점수인지도 확인합니다. 보통 \(k\)는 \(0.04\sim0.06\) 근처를 사용합니다.</p>`],
      ['미분 제곱에 가우시안을 적용한다는 건 무슨 뜻인가요?', R`<p class="faq-key">미분값을 먼저 제곱하고, 주변의 제곱값들을 가우시안 가중치로 섞는 것입니다.</p><div class="faq-math">$$G*d_y^2$$</div><p>중심 근처의 값에 더 큰 비중을 주어, 그 주변에서 세로 방향 변화가 얼마나 큰지 구합니다.</p><div class="faq-math">$$\sum_{\Delta y}\sum_{\Delta x}G(\Delta y,\Delta x)\,d_y(y-\Delta y,x-\Delta x)^2$$</div><p class="faq-note">평균한 뒤 제곱하는 것과는 다릅니다. 먼저 제곱해야 양수·음수 미분이 서로 상쇄되지 않습니다.</p>`],
    ],
    susan: [
      ['비슷한 밝기의 영역이 작을수록 왜 코너인가요?', R`<p class="faq-key">코너에서는 중심과 같은 쪽에 속하는 화소가 원형 창의 작은 부분만 차지하기 때문입니다.</p><ul><li>평탄한 곳 → 원 안 대부분이 비슷한 밝기</li><li>직선 경계 → 대략 반쪽이 비슷한 밝기</li><li>뾰족한 코너 → 더 작은 부채꼴 부분만 비슷한 밝기</li></ul><div class="faq-math">$$\text{코너 응답}=\max\big(0,\;q-\text{USAN 넓이}\big)$$</div><p class="faq-note">비슷한 밝기의 넓이가 작아질수록, 기준 넓이에서 뺀 값은 커집니다.</p>`],
    ],
    sift: [
      ['한 옥타브에 왜 가우시안 영상이 여섯 장인가요?', R`<p class="faq-key">극점인지 판단하려면 위·아래 스케일의 이웃도 필요하기 때문입니다.</p><p>검사할 DOG 영상 세 장에 양끝 이웃을 한 장씩 더하면 다섯 장입니다. 차분 다섯 장을 만들려면 원본 가우시안 영상은 여섯 장 필요합니다.</p><div class="faq-math">$$s=3\quad\Rightarrow\quad\underbrace{s+2=5}_{\text{DOG 영상}}\quad\Rightarrow\quad\underbrace{s+3=6}_{\text{가우시안 영상}}$$</div><p>한 단계마다 다음 비율로 스케일을 늘리면 세 단계 뒤에 두 배가 됩니다.</p><div class="faq-math">$$k=2^{1/3},\qquad k^3=2$$</div>`],
      ['검출 좌표에 옥타브 배율을 왜 곱하나요?', R`<p class="faq-key">작게 줄인 영상의 좌표를 원래 영상의 좌표로 되돌리기 위해서입니다.</p><p>옥타브 하나를 내려갈 때 가로·세로 크기를 절반으로 줄입니다. 따라서 줄인 영상의 한 칸은 원래 영상의 여러 칸에 해당합니다.</p><div class="faq-math">$$(y,x)=\big(2^o y',\;2^o x'\big)$$</div><p>예를 들어 한 번 절반으로 줄인 영상에서 찾은 좌표는 원래 영상에서 두 배 위치입니다.</p><div class="faq-math">$$o=1,\quad(y',x')=(3,5)\quad\Rightarrow\quad(y,x)=(6,10)$$</div><p class="faq-note">크기인 스케일도 좌표와 마찬가지로 원본 단위로 환산해야 합니다.</p>`],
    ],
    surf: [
      ['SIFT와 SURF는 스케일을 어떻게 다르게 바꾸나요?', R`<p class="faq-key">SIFT는 영상의 해상도를 바꾸고, SURF는 마스크 크기를 바꿉니다.</p><ul><li><b>SIFT:</b> 영상을 스무딩하고 축소하면서 특징을 찾습니다.</li><li><b>SURF:</b> 영상은 유지하고 박스 마스크를 점점 키웁니다.</li></ul><div class="faq-math">$$9,\;15,\;21,\;27,\;\ldots$$</div><p class="faq-note">SURF는 적분 영상을 미리 만들어 두므로, 사각형 영역의 합은 크기와 관계없이 네 모서리 값을 조회해 구합니다. 마스크가 커져도 사각형 합 하나를 구하는 비용은 일정합니다.</p>`],
    ],
    otsu2: [
      ['임계값이 하나일 때와 무엇이 다른가요?', R`<p class="faq-key">찾는 값이 \(t\) 하나에서 \((t_1,t_2)\) 쌍으로 늘고, 부류가 셋이 됩니다.</p><div class="faq-math">$$v_{between}=\sum_{k=0}^{2}w_k(\mu_k-\mu_g)^2$$</div><p>세 부류의 평균이 전체 평균에서 멀수록 잘 나뉜 것입니다. 가능한 쌍이 \((L-3)(L-2)/2\)개뿐이라 모두 계산해 봅니다(\(L=8\)이면 15쌍, \(L=256\)이면 32,385쌍).</p><p class="faq-note">부류를 넷 이상으로 늘릴 때도 같은 식을 항만 늘려 쓰면 됩니다(연습문제 2).</p>`],
    ],
    kmeans: [
      ['k-means가 자연 영상에서 자글자글한 이유는?', R`<p class="faq-key">색이 비슷한지만 보고, 두 화소가 서로 가까운지는 전혀 보지 않기 때문입니다.</p><p>해바라기 밭처럼 같은 물체 안에 노랑·갈색·초록이 섞여 있으면 화소마다 다른 군집으로 갑니다. 반대로 멀리 떨어진 하늘과 흰 건물이 같은 군집이 되기도 합니다.</p><p class="faq-note">해결 방향: 이웃 관계를 쓰는 그래프 방법(5.3), 위치와 색을 함께 쓰는 민시프트(5.4).</p>`],
    ],
    mst: [
      ['intra(C)가 왜 “가장 큰 MST 에지”인가요?', R`<p class="faq-key">연결요소 안에서 가장 크게 끊어진 “틈”이 얼마인지를 재는 값입니다.</p><div class="faq-math">$$intra(C)=\max_{e\in MST(C)}w_e$$</div><p>MST는 모든 노드를 가장 작은 에지들로 잇습니다. 그중 가장 큰 에지는 “이 영역을 이어 붙이려면 적어도 이만큼의 차이는 견뎌야 한다”는 뜻입니다. 두 화소가 직접은 많이 달라도, 작은 에지들로 이어진 길이 있으면 intra는 작게 유지됩니다.</p>`],
      ['k는 무슨 역할을 하나요?', R`<p class="faq-key">작은 영역에 주는 덤 \(\tau(C)=k/|C|\)의 크기입니다.</p><div class="faq-math">$$w_{pq}\le\min\big(intra(C_p)+\tfrac{k}{|C_p|},\ intra(C_q)+\tfrac{k}{|C_q|}\big)\Rightarrow\text{합침}$$</div><p>처음에는 모든 영역의 크기가 1이라 \(k\)만큼의 차이까지 합쳐집니다. 영역이 커질수록 덤이 줄어 더 까다로워집니다. \(k\)가 작으면 세밀하게(영역 많음), 크면 거칠게(영역 적음) 나뉩니다.</p>`],
    ],
    ncut: [
      ['고유 벡터가 왜 분할을 알려 주나요?', R`<p class="faq-key">ncut 최소 문제에서 “각 노드가 \(C_1\)이냐 \(C_2\)냐”를 실수값으로 풀어 주면 고유값 문제가 되기 때문입니다.</p><div class="faq-math">$$(\mathbf D-\mathbf W)\mathbf y=\lambda\mathbf D\mathbf y$$</div><p>가장 작은 고유값 0의 고유 벡터는 모든 성분이 같아서(자르지 않음) 쓸모가 없습니다. 두 번째로 작은 고유값의 고유 벡터에서 부호나 크기가 비슷한 노드끼리 묶으면 근사 최적 분할이 됩니다.</p><p class="faq-note">4강의 2×2 고윳값 계산이, 여기서는 노드 수 × 노드 수 행렬로 커진 것입니다.</p>`],
    ],
    meanshift: [
      ['민시프트는 왜 “언덕 오르기”인가요?', R`<p class="faq-key">한 번 이동할 때마다 커널 안 샘플의 평균 쪽, 즉 샘플이 더 빽빽한 쪽으로 가기 때문입니다.</p><div class="faq-math">$$\mathbf m(\mathbf y_t)=\frac{\sum_i(\mathbf x_i-\mathbf y_t)\,k\big(\frac{\mathbf x_i-\mathbf y_t}{h}\big)}{\sum_i k\big(\frac{\mathbf x_i-\mathbf y_t}{h}\big)}$$</div><p>밀도가 높은 쪽 샘플이 더 많이 평균에 들어가 그쪽으로 끌려갑니다. 이동량은 봉우리에 가까울수록 작아지고, 꼭대기에서 0이 됩니다.</p><p class="faq-note">함수 \(p(\mathbf x)\)를 그리지 않고도 봉우리를 찾는 점이 핵심입니다(차원의 저주 회피).</p>`],
    ],
    watershed: [
      ['7행에서 이웃 번호가 “모두 같을 때만” 번호를 주는 이유는?', R`<p class="faq-key">서로 다른 유역의 물이 만나는 화소에는 번호를 주지 않아야, 그 화소가 경계(댐)로 남기 때문입니다.</p><p>이웃 번호가 1과 2로 섞인 화소에 아무 번호나 주면 두 유역이 그 화소를 통해 이어져 경계가 사라집니다. 그래서 끝까지 번호를 받지 못한 화소가 워터셰드가 되고, 결과는 항상 닫힌 경계가 됩니다(연습문제 6).</p>`],
    ],
    graphcut: [
      ['O로 지정한 화소에 S와 100, T와 0을 주는 이유는?', R`<p class="faq-key">사용자의 표시를 절대 어기지 않게 하는 “엄격한 조건”입니다.</p><ul><li>S와의 에지가 아주 크면, 그 에지를 자르는 절단은 비용이 너무 커서 최소 절단이 될 수 없습니다 → 항상 S 쪽(물체)에 남음</li><li>T와의 에지가 0이면 처음부터 끊긴 것과 같습니다</li></ul><p>B로 지정한 화소는 반대(T와 큰 값, S와 0)입니다. 나머지 화소는 식 (5.28)(5.29)의 확률과 이웃 유사도의 균형으로 정해집니다.</p>`],
    ],
    backproj: [
      ['얼굴 검출에서 비율을 왜 1로 제한하나요?', R`<p class="faq-key">얼굴 모델에 흔하고 검사 영상에는 드문 색에 높은 점수를 주되, 최대 점수를 1로 맞추는 것입니다.</p><div class="faq-math">$$h_r=\min\left(\frac{\hat h_m}{\hat h_i},\;1\right)$$</div><p>분자는 얼굴 모델에서 그 색의 비율, 분모는 검사 영상 전체에서 그 색의 비율입니다. 분모가 작으면 나눈 값이 커집니다.</p><div class="faq-math">$$\frac{0.30}{0.05}=6\ \longrightarrow\ 1,\qquad\frac{0.10}{0.40}=0.25\ \longrightarrow\ 0.25$$</div><p><b>1은 얼굴임이 확실하다는 뜻이 아닙니다.</b> 피부색 손이나 벽에도 높은 점수가 나올 수 있습니다. 색의 분포만 비교하기 때문입니다.</p><p class="faq-note">이 결과는 이진 영상이 아닙니다. 0과 1 사이의 중간 점수도 남습니다. 분모가 0인 칸은 별도 처리가 필요하며, 이 실습에서는 0으로 처리합니다.</p>`],
    ],
  };
  // "수업에서 강조한 점" — from the 2026-09-22 lecture recording notes (voice-wiki); only points the notes mark as confirmed
  const LECTURE = '2026-09-22 강의 녹음 정리';
  const NOTES = {
    conv: { items: [
      '강의 예제: 마스크 <b>2 0 1</b>로 컨볼루션하려면 <b>1 0 2</b>로 뒤집어 놓고 상관처럼 밀면 편하다.',
      '수식에서는 f(i+x)면 상관, f(i−x)(인덱스에 마이너스)면 컨볼루션이다. 논문에 이런 식이 자주 나오므로 <b>식만 보고 둘을 구분</b>할 수 있어야 한다.',
    ], action: ['강의 예제 마스크 2 0 1 넣기', () => { const u = document.querySelector('input[aria-label="윈도우 u"]'); if (u) { u.value = '2 0 1'; u.dispatchEvent(new Event('change')); } }] },
    coloredge: { items: [
      '방법은 두 가지로 소개됐다: RGB 채널마다 에지를 구해 <b>OR로 합치기</b>(한 채널이라도 에지면 에지), 채널별 변화량을 함께 쓰는 <b>디 젠조</b> 방법.',
      '명암 차이가 없어도 <b>색 차이</b>로 생기는 경계를 잡을 수 있다는 것이 핵심.',
      '<b>컬러 에지는 개념만 알면 되고 시험 문제로는 내지 않겠다</b>고 했다 (전체 시험 범위는 미확정).',
    ] },
    spta: { items: [
      '실제 에지는 여러 화소 두께로 나오므로, <b>연결을 끊지 않으면서</b> 폭을 줄이는 세선화가 필요하다.',
      '조건식 기호: <b>+ = OR, 곱(·) = AND, ′ = NOT</b>. 네 조건이 모두 참일 때만 중심 화소를 지운다.',
      '지우면 연결이 끊기는 화소(예: 끝점)는 지우지 않는다 — 지운 뒤에도 주변이 이어져 있고 선 폭만 줄어드는지가 핵심 조건.',
    ] },
    track: { items: [
      '에지 토막 = 끝점에서 통과점들을 지나 다른 끝점이나 분기점까지 이어진 화소열. 폐곡선은 끝점이 없을 수 있다.',
      '체인 코드 = <b>시작 좌표 + 0~7 방향 번호의 열</b>. 좌표를 전부 저장하지 않고 모양을 표현한다.',
      '이웃이 1개면 끝점, 2개면 통과점이 기본이지만, 붙어 있는 이웃 때문에 <b>개수만 세면 분기점을 잘못 고를 수 있어</b> 한 바퀴 돌며 에지↔비에지 <b>전환 횟수</b>를 본다.',
      '이웃을 봐야 하므로 영상 가장자리 한 칸은 빼고 순회하고, 찾은 이웃 좌표·방향을 큐에 넣었다 꺼내며 추적한다.',
    ] },
    approx: { items: [
      '에지 검출이 끝이 아니다: <b>자율주행 차선</b>처럼 에지를 직선(선분)으로 바꿔야 중앙 위치·진행 방향을 구할 수 있다.',
      '임계값 h가 <b>작을수록 더 잘게 나뉘어 선분이 많아진다</b> — 아래 슬라이더로 확인해 보세요.',
    ] },
    hough: { items: [
      '허프 변환은 <b>에지를 먼저 연결하지 않아도</b>, 끊어진 점들이 한 직선 위에 정렬돼 있으면 직선을 찾는다.',
      '예: 아스팔트 위 <b>끊어진 흰 차선</b>도 하나의 직선으로 인식. 환경이 제한된 대회 트랙에서는 이런 전통적 직선 검출이 여전히 쓸모 있다.',
    ] },
  };
  function insertNotes(el, n) {
    const box = h('div', { class: 'card lecture-note' }, h('h3', {}, '수업에서 강조한 점', h('small', {}, LECTURE)),
      h('ul', {}, n.items.map(t => h('li', { html: t }))),
      n.action ? h('button', { class: 'btn', type: 'button', onclick: n.action[1] }, n.action[0]) : null);
    const after = el.querySelector('.formula-card') || el.querySelector('.lead');
    if (after) after.after(box); else el.prepend(box);
  }
  // plain-language card right under the lead, before the formulas
  function insertEasy(el, e) {
    const [one, like, steps, tryit, terms] = e;
    const box = h('div', { class: 'card easy' },
      h('h3', {}, '쉽게 말하면', h('small', {}, '수식 보기 전에')),
      h('p', { class: 'easy-one' }, one),
      h('div', { class: 'easy-grid' },
        h('div', {}, h('h4', {}, '비유'), h('p', {}, like)),
        h('div', {}, h('h4', {}, '세 단계'), h('ol', {}, steps.map(t => h('li', {}, t)))),
        h('div', {}, h('h4', {}, '용어'), h('dl', {}, terms.flatMap(([t, d]) => [h('dt', {}, t), h('dd', {}, d)])))),
      h('p', { class: 'easy-try' }, h('b', {}, '먼저 해 볼 것 '), tryit));
    const lead = el.querySelector('.lead');
    if (lead) lead.after(box); else el.prepend(box);
  }
  // previous / next page links at the bottom, in sidebar order
  function insertPager(el, m) {
    const i = mods.indexOf(m), prev = mods[i - 1], next = mods[i + 1];
    const link = (x, dir) => (x ? h('a', { href: '#' + x.id, class: dir }, h('small', {}, dir === 'prev' ? '← 이전' : '다음 →'), h('b', {}, `${x.num} ${x.title}`)) : h('span'));
    el.append(h('nav', { class: 'pager', 'aria-label': '이전·다음 페이지' }, link(prev, 'prev'), h('a', { href: '#', class: 'home' }, '개요'), link(next, 'next')));
  }
  function insertFaq(el, items) {
    const box = h('div', { class: 'card faq' }, h('h3', {}, '헷갈리기 쉬운 점', h('small', {}, '질문을 눌러 펼치기')),
      items.map(([q, a]) => h('details', {}, h('summary', {}, q), h('div', { class: 'a', html: a }))));
    const after = el.querySelector('.formula-card') || el.querySelector('.lead');
    if (after) after.after(box); else el.prepend(box);
  }

  function nav() {
    const rail = document.getElementById('rail'), msel = document.getElementById('msel');
    const groups = [['2', '2강 · 영상처리'], ['3', '3강 · 에지 검출'], ['4', '4강 · 지역 특징 검출'], ['5', '5강 · 영상 분할'], ['practice', '문제 풀기']];
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
      if (m && FAQ[m.id]) insertFaq(el, FAQ[m.id]);
      if (m && typeof EASY !== 'undefined' && EASY[m.id]) insertEasy(el, EASY[m.id]);
      if (m) insertPager(el, m);
      if (m && NOTES[m.id]) insertNotes(el, NOTES[m.id]);
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
    const app = document.querySelector('.app');
    let off = false; try { off = localStorage.getItem('cvlab-rail') === 'off'; } catch (e) {}
    const tg = h('button', { class: 'btn rail-toggle', type: 'button' });
    const setRail = v => { off = v; app.classList.toggle('rail-off', v); tg.textContent = v ? '☰ 목차 보이기' : '⇤ 목차 숨기기'; try { localStorage.setItem('cvlab-rail', v ? 'off' : 'on'); } catch (e) {} };
    tg.addEventListener('click', () => setRail(!off));
    document.body.append(tg); setRail(off);
    window.addEventListener('hashchange', route);
    route();
  }
  return { mod, mods, scaffold, slidebar, grayCell, signedCell, parseGrid, start };
})();

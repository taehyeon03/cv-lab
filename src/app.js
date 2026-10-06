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
      h('header', { class: 'mod-head' }, h('div', { class: 'mod-num' }, 'CV'), h('h1', {}, '컴퓨터비전개론 알고리즘 실습실'), h('div', { class: 'src' }, '2강 영상처리 · 3강 에지 검출 · 4강 지역 특징 검출 — 강의자료의 알고리즘을 직접 돌려 보는 곳')),
      slidebar(),
      h('p', { class: 'lead', html: '각 페이지는 <b>① 강의자료의 수식</b>, <b>② 값을 직접 바꿀 수 있는 시각화</b>, <b>③ 교재 의사 코드와 한 줄씩 맞춰 보는 단계 실행기</b>로 되어 있습니다. 단계 실행기는 Python Tutor처럼 ◀ ▶ 버튼(또는 키보드 ← →)으로 한 단계씩 움직이며, 지금 실행 중인 코드 줄이 노란색으로 표시되고 변수 값과 호출 스택이 함께 바뀝니다. 격자의 숫자는 대부분 클릭해서 바꿀 수 있습니다.' }),
    );
    const CH = { 2: 'Chapter 2 · 영상처리', 3: 'Chapter 3 · 에지 검출', 4: 'Chapter 4 · 지역 특징 검출', practice: '직접 풀어 보기' };
    for (const ch of ['2', '3', '4', 'practice']) {
      root.append(h('h2', { style: { fontSize: '17px', margin: '26px 0 10px' } }, CH[ch]));
      root.append(h('div', { class: 'intro-grid' }, mods.filter(m => m.ch === ch).map(m => h('a', { href: '#' + m.id }, h('div', { class: 'card' }, h('span', { class: 'n' }, m.num + (m.star ? '  · 단계 실행' : '')), h('b', {}, m.title), h('span', { class: 'caption' }, m.blurb))))));
    }
    root.append(h('p', { class: 'caption', style: { marginTop: '28px' } }, '예제 숫자는 강의자료(교재 예제 2-1, 2-2, 2-5, 2-6, 3-1, 3-2, 3-3, 4-1, 4-2, 그림 3-22, 3-25, 4-9)와 같게 맞췄고, 결과도 교재 값과 대조해 두었습니다.'));
  }

  // "헷갈리기 쉬운 점" — short Q&A shown under each module's formulas (collapsed)
  const FAQ = {
    deriv: [
      ['이진화(|f′| ≥ T)는 뭘 하는 건가요?', '미분 크기가 임계값 T 이상이면 1(에지), 아니면 0으로 바꿉니다. 절댓값이라 밝아지는 에지와 어두워지는 에지를 똑같이 잡습니다. 그림 3-2에서 |f′| = 0 1 1 1 2 <b>4</b> 0 1 1이므로 4 하나만 넘어 <b>x=5만 1</b>입니다. 마지막 칸이 “−”인 것은 f(10)이 없어 f′(9)를 계산할 수 없기 때문입니다.'],
      ['T는 어떻게 정하나요? (임계값 = 넘으면 예, 못 넘으면 아니오로 나누는 기준선)', '교재는 값을 주지 않습니다. 그림 3-2와 같은 결과는 <b>2 &lt; T ≤ 4</b>이면 모두 나오며, “그림 3-2” 버튼은 T=3을 씁니다. 실제로는 실험으로 고르거나, 최댓값의 비율, 히스토그램(오츄), 캐니처럼 두 개를 쓰는 방법이 있습니다. 너무 낮으면 거짓 에지, 너무 높으면 실종된 에지가 늘어납니다.'],
      ['f′(x) ≈ f(x+1) − f(x)에는 왜 분모가 없나요?', '분모 Δx = 1이라 1로 나눈 것입니다. 화소는 정수 위치에만 있어 간격을 1보다 줄일 수 없습니다. 양옆 화소를 쓰면 Δx=2라 식 (3.4)처럼 /2가 남지만, 모든 화소에 같은 수로 나누는 것은 크기만 바꾸고 에지 위치는 그대로라 마스크에서는 생략합니다 → [−1 0 1].'],
      ['2차 미분 마스크 [1 −2 1]은 어떻게 나오나요?', '1차 미분 차분을 한 번 더 적용합니다.<br>f″(x) ≈ f′(x+1) − f′(x) = [f(x+2) − f(x+1)] − [f(x+1) − f(x)] = f(x+2) − <b>2</b>f(x+1) + f(x)<br>가운데를 x로 옮기면 <b>f(x+1) − 2f(x) + f(x−1)</b> → [1 −2 1]. 뜻은 “오른쪽 기울기 − 왼쪽 기울기”라서, 직선이면 0이고 기울기가 꺾이는 곳에서 +, −가 나옵니다.'],
    ],
    sobel: [
      ['로버츠는 왜 2×2이고 대각선인가요?', '지금 화소 (y,x)를 마스크 왼쪽 위 칸에 놓습니다. d<sub>y</sub> = f(y+1,x) − f(y,x+1) (↙ 대각선), d<sub>x</sub> = f(y+1,x+1) − f(y,x) (↘ 대각선). 2×2에서 가로·세로 차분은 서로 다른 위치의 값이지만, 두 대각선은 모두 2×2의 <b>정중앙</b>을 지나므로 같은 점에서 잰 수직인 두 미분이 됩니다. 대각선 거리가 √2라 강도는 √2배, 방향은 <b>45° 돌아간 값</b>입니다(아래 다이얼도 그 값). 스무딩이 없어 잡음에 가장 약합니다.'],
      ['프레윗·소벨 행렬은 어떻게 만들어지나요?', '세로 성분 × 가로 성분으로 만듭니다. 미분 방향은 [−1 0 1] 차분, 그 <b>수직 방향</b>은 평균입니다.<br>프레윗 m<sub>x</sub> = [1 1 1]<sup>T</sup> × [−1 0 1] → 세 줄 모두 −1 0 1<br>소벨 m<sub>x</sub> = [1 2 1]<sup>T</sup> × [−1 0 1] → 가운데 줄만 −2 0 2<br>[1 2 1]은 가운데 줄을 더 믿는 가중 평균으로, 가장 작은 가우시안 근사입니다. 3, 4로 나누는 정규화는 생략합니다. 요약: 수직 방향 스무딩이 로버츠 없음 → 프레윗 평균 → 소벨 가중 평균.'],
    ],
    zc: [
      ['예제는 (6,3) 하나만 설명하는데, 결과에는 1이 왜 여러 개인가요?', '(6,3)은 판정 과정을 보여 주는 <b>예시</b>일 뿐이고, 그림 3-14(b)에는 1이 <b>21개</b> 있습니다. “두 개 이상” 규칙은 강의자료 21쪽 조건 그대로이며, 교재 g로 계산하면 그림과 정확히 같습니다(“하나 이상”으로 바꾸면 28개로 7칸이 틀립니다).'],
      ['통과한 쌍이 3개, 4개면 어떻게 되나요?', 'b는 이진 영상이라 2개든 3개든 4개든 모두 <b>1</b>입니다. 예제 3-2에서 2쌍 8개 + 3쌍 9개 + 4쌍 4개 = 21개가 그림 3-14(b)의 1입니다. 몇 쌍이 통과했는지는 따로 저장하지 않습니다.'],
      ['여기서 T는 무엇을 하나요?', '부호가 다른 쌍이라도 값 차이 |a − b|가 T를 넘어야 통과합니다. LOG 결과는 평탄한 곳에서 0 근처를 오르내려 잡음만으로도 부호가 바뀌므로, <b>급하게 뒤집힌 곳만</b> 영교차로 인정하려는 기준입니다. 예제 3-2에서 T를 0~1 → 3 → 5 → 12로 올리면 에지가 21 → 18 → 14 → 2개로 줄어듭니다.'],
    ],
    canny: [
      ['비최대 억제에서 비교할 두 이웃은 어떻게 고르나요?', '<b>에지 방향(경계선이 뻗은 방향)에 수직</b>, 즉 경계를 가로지르는 방향의 두 이웃입니다. 가로선(방향 0)은 위·아래, 세로선(2)은 왼쪽·오른쪽, ↘ 대각선(1)은 오른쪽 위·왼쪽 아래, ↙ 대각선(3)은 왼쪽 위·오른쪽 아래(그림 3-17). 같은 선 위의 이웃과 비교하면 값이 비슷해 모두 지워집니다. 방향 4~7은 같은 선을 반대로 본 것이라 0~3과 같은 이웃을 씁니다.'],
      ['이웃이 크면 가운데가 0이 되나요?', '네. 두 이웃 중 <b>하나라도 크거나 같으면</b> 0입니다(or, ≤). 양쪽보다 모두 커야 남습니다. 예: 80 / <b>150</b> / 90 → 유지, 200 / 150 / 90 → 0. “가로지르는 방향에서 꼭대기여야 산다.”'],
      ['466 vs 466처럼 같은데도 억제되는 게 맞나요?', '교재 8행이 ≤라서 맞습니다. 다만 이웃 (5,1)도 같은 이유로 지워져, 이 예제에서는 정사각형 왼쪽 경계의 4~6행이 <b>둘 다 사라져 끊깁니다</b>. 진짜 경계가 두 화소 사이에 있어 양쪽 강도가 같기 때문입니다. 실제 구현은 한쪽에만 등호를 붙여(&lt;, ≤) 동점이면 하나만 남깁니다. 시험은 교재 규칙(≤)대로 답하면 됩니다.'],
      ['T_low와 T_high는 언제 쓰나요?', '비최대 억제(5~9행)에는 임계값이 없습니다. 그다음 이력 임계값(12~23행)에서 씁니다. <b>T_high = 추적 시작</b>(16행: S &gt; T_high인 화소에서 follow_edge 시작), <b>T_low = 추적 이어 가기</b>(23행: 이웃 S &gt; T_low이면 따라감). T_low는 넘어도 강한 에지와 이어지지 않은 화소는 버려집니다. 캐니는 T_high : T_low를 2:1~3:1 정도로 권했습니다.'],
    ],
    moravec: [
      ['왜 S(v,u) 중 최솟값을 쓰나요?', '좋은 특징은 <b>어느 방향으로 옮겨도</b> 밝기가 크게 바뀌어야 합니다. 에지는 에지에 수직으로 옮기면 크게 바뀌지만 에지를 따라 옮기면 거의 안 바뀝니다. 최솟값은 “가장 덜 바뀌는 방향”의 변화량이라, 이것까지 커야 코너라고 볼 수 있습니다. 최댓값이나 합을 쓰면 에지도 높은 점수를 받습니다.'],
      ['예제 4-1에서 S(0,1)=4는 어떻게 나오나요?', '점 b=(5,3) 주위 3×3(4≤y≤6, 2≤x≤4)에서 (f(y,x+1) − f(y,x))²를 더합니다. x=2→3 경계(0→1)가 세 줄 있어 3, 행 5의 x=4→5는 1→1이라 0, 행 4의 x=4→5는 1→0이라 1 → 합 4입니다. 단계 실행기에서 한 항씩 확인할 수 있습니다.'],
    ],
    harris: [
      ['테일러 확장은 왜 쓰나요?', 'f(y+v,x+u) ≈ f(y,x) + v·d<sub>y</sub> + u·d<sub>x</sub>로 바꾸면 S(v,u)가 (v u)·A·(v u)<sup>T</sup>로 인수분해됩니다. 그러면 A는 (v,u)와 상관없이 <b>한 번만</b> 계산하면 되고, (v,u)가 실수여도 되어 모든 방향의 변화를 한꺼번에 알 수 있습니다. 모라벡은 방향마다 S를 다시 계산해야 했습니다.'],
      ['고유값 대신 det와 trace를 쓰는 이유는?', 'λ1λ2 = det(A) = pq − r², λ1+λ2 = trace(A) = p+q이므로 C = λ1λ2 − k(λ1+λ2)²를 고유값 없이 바로 계산할 수 있습니다(제곱근이 필요 없음). 둘 다 크면 곱이 커서 C &gt; 0, 하나만 크면 곱이 작고 합의 제곱이 커서 C &lt; 0, 둘 다 작으면 C ≈ 0입니다. k는 보통 0.04~0.06.'],
      ['G ⊛ d_y²에서 ⊛는 무엇인가요?', '컨볼루션입니다. 각 화소의 d<sub>y</sub>²를 그 주위 3×3에서 가우시안 가중치로 평균한다는 뜻이고, 식 (4.6)의 Σ<sub>y</sub>Σ<sub>x</sub> G(y,x)·d<sub>y</sub>²와 같습니다. 미분값을 먼저 제곱한 뒤 평균해야 +와 −가 상쇄되지 않습니다.'],
    ],
    susan: [
      ['왜 넓이가 작을수록 코너인가요?', '중심과 비슷한 밝기의 화소는 중심이 속한 영역 쪽에만 있습니다. 평탄한 곳은 원 전체(37)가, 직선 에지 위는 절반 정도가, 뾰족한 코너는 그 각도만큼만 같은 영역이라 넓이가 더 작습니다. 그래서 q − usan_area가 클수록 코너답습니다.'],
    ],
    sift: [
      ['한 옥타브에 왜 영상이 여섯 장인가요?', '스케일당 s=3장에서 극점을 찾으려면 DOG가 위·아래 하나씩 더 필요해 s+2=5장, DOG 5장을 만들려면 가우시안이 s+3=6장 필요합니다. k=2<sup>1/s</sup>=2<sup>1/3</sup>로 정하면 세 단계 뒤 σ가 정확히 두 배(3.2)가 되어, 그 영상을 반으로 줄여 다음 옥타브를 이어 갈 수 있습니다.'],
      ['식 (4.21)의 2^o는 왜 곱하나요?', '옥타브 o의 영상은 원래 영상을 2<sup>o</sup>배 줄인 것이라, 그 영상의 (y′,x′)는 원래 영상에서 (y′·2<sup>o</sup>, x′·2<sup>o</sup>)입니다. 스케일도 같은 이유로 1.6×2<sup>(o+i)/3</sup>: 옥타브가 하나 오를 때마다 2배, 옥타브 안에서 한 장마다 2<sup>1/3</sup>배입니다.'],
    ],
    surf: [
      ['SIFT와 SURF의 스케일 공간은 무엇이 다른가요?', 'SIFT는 <b>연산자 크기는 그대로</b> 두고 영상을 스무딩·축소하며(피라미드), SURF는 <b>영상은 그대로</b> 두고 마스크를 9, 15, 21, 27…로 키웁니다. 적분 영상 덕분에 마스크가 커져도 상자 하나의 합은 네 번 조회로 끝나므로 크기에 따른 비용이 없습니다.'],
    ],
    backproj: [
      ['식 (2.4)에서 min(·, 1.0)은 왜 쓰나요?', 'ĥ<sub>m</sub>/ĥ<sub>i</sub>로 나누면 영상 전체에 흔한 색은 깎이고 얼굴에 특징적인 색은 커집니다. 그런데 ĥ<sub>i</sub>가 작으면 비율이 몇십 배까지 커지므로, 1에서 잘라 ① 신뢰도를 0~1로 두고 ② 드문 색 몇 칸이 결과를 독차지하지 않게 하고 ③ 분모가 작은 칸의 불안정한 값을 막습니다. 예: 0.30/0.05 = 6.0 → 1.0, 0.10/0.40 = 0.25 → 0.25.'],
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
  function insertFaq(el, items) {
    const box = h('div', { class: 'card faq' }, h('h3', {}, '헷갈리기 쉬운 점', h('small', {}, '질문을 눌러 펼치기')),
      items.map(([q, a]) => h('details', {}, h('summary', {}, q), h('div', { class: 'a', html: a }))));
    const after = el.querySelector('.formula-card') || el.querySelector('.lead');
    if (after) after.after(box); else el.prepend(box);
  }

  function nav() {
    const rail = document.getElementById('rail'), msel = document.getElementById('msel');
    const groups = [['2', '2강 · 영상처리'], ['3', '3강 · 에지 검출'], ['4', '4강 · 지역 특징 검출'], ['practice', '문제 풀기']];
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

// Pure image-processing core. Images are arrays of rows: img[y][x].
const CV = (() => {
  const zeros = (h, w, v = 0) => Array.from({ length: h }, () => new Array(w).fill(v));
  const clone = g => g.map(r => r.slice());
  const H = g => g.length, W = g => g[0].length;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const inside = (g, y, x) => y >= 0 && x >= 0 && y < g.length && x < g[0].length;

  // 8 neighbours in textbook order: n0=E, n1=SE, n2=S, n3=SW, n4=W, n5=NW, n6=N, n7=NE
  // (also chain-code order 0..7 of Fig 3-22b)
  const DIR8 = [[0, 1], [1, 1], [1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [-1, 1]];

  function histogram(img, L) {
    const h = new Array(L).fill(0);
    for (const row of img) for (const v of row) h[v]++;
    return h;
  }

  function equalize(img, L) {
    const h = histogram(img, L), N = H(img) * W(img);
    const hn = h.map(v => v / N);
    const c = [];
    hn.reduce((s, v, i) => (c[i] = s + v), 0);
    const map = c.map(v => Math.round(v * (L - 1)));
    return { h, hn, c, map, out: img.map(r => r.map(v => map[v])) };
  }

  function otsu(h) {
    const L = h.length, N = h.reduce((a, b) => a + b, 0);
    const hn = h.map(v => v / N);
    const rows = [];
    let best = { t: 0, v: Infinity };
    for (let t = 0; t < L; t++) {
      let w0 = 0, w1 = 0, m0 = 0, m1 = 0;
      for (let i = 0; i <= t; i++) { w0 += hn[i]; m0 += i * hn[i]; }
      for (let i = t + 1; i < L; i++) { w1 += hn[i]; m1 += i * hn[i]; }
      m0 = w0 ? m0 / w0 : 0; m1 = w1 ? m1 / w1 : 0;
      let v0 = 0, v1 = 0;
      for (let i = 0; i <= t; i++) v0 += hn[i] * (i - m0) ** 2;
      for (let i = t + 1; i < L; i++) v1 += hn[i] * (i - m1) ** 2;
      v0 = w0 ? v0 / w0 : 0; v1 = w1 ? v1 / w1 : 0;
      const vw = w0 * v0 + w1 * v1;
      rows.push({ t, w0, w1, m0, m1, v0, v1, vw });
      if (vw < best.v) best = { t, v: vw };
    }
    return { rows, T: best.t };
  }

  function correlate1D(f, u) {
    const r = (u.length - 1) / 2;
    return f.map((_, i) => {
      if (i - r < 0 || i + r >= f.length) return null;
      let s = 0;
      for (let x = -r; x <= r; x++) s += u[x + r] * f[i + x];
      return s;
    });
  }
  const convolve1D = (f, u) => correlate1D(f, u.slice().reverse());

  // border: 'zero' | 'replicate'
  function correlate2D(img, k, border = 'replicate') {
    const kh = k.length, kw = k[0].length, ry = (kh - 1) >> 1, rx = (kw - 1) >> 1;
    const h = H(img), w = W(img), out = zeros(h, w);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let s = 0;
      for (let j = -ry; j <= ry; j++) for (let i = -rx; i <= rx; i++) {
        let yy = y + j, xx = x + i, v;
        if (yy < 0 || xx < 0 || yy >= h || xx >= w) {
          if (border === 'zero') continue;
          yy = clamp(yy, 0, h - 1); xx = clamp(xx, 0, w - 1);
        }
        v = img[yy][xx];
        s += k[j + ry][i + rx] * v;
      }
      out[y][x] = s;
    }
    return out;
  }

  const maskSize = sigma => { let n = Math.ceil(6 * sigma - 1e-9); if (n % 2 === 0) n++; return Math.max(n, 3); };

  function gaussian1D(sigma) {
    const n = maskSize(sigma), r = (n - 1) / 2;
    const k = []; let s = 0;
    for (let x = -r; x <= r; x++) { const v = Math.exp(-(x * x) / (2 * sigma * sigma)); k.push(v); s += v; }
    return k.map(v => v / s);
  }

  function gaussianBlur(img, sigma) {
    if (sigma <= 0) return clone(img);
    const k = gaussian1D(sigma);
    return correlate2D(correlate2D(img, [k]), k.map(v => [v]));
  }

  // Eq. 3.12, shifted to zero sum so flat regions give exactly 0
  function logKernel(sigma, zeroSum = true) {
    const n = maskSize(sigma), r = (n - 1) / 2, s2 = sigma * sigma;
    const k = zeros(n, n); let sum = 0;
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
      const g = Math.exp(-(x * x + y * y) / (2 * s2)) / (2 * Math.PI * s2);
      const v = ((x * x + y * y - 2 * s2) / (s2 * s2)) * g;
      k[y + r][x + r] = v; sum += v;
    }
    if (zeroSum) { const m = sum / (n * n); for (const row of k) for (let i = 0; i < n; i++) row[i] -= m; }
    return k;
  }

  const OPS = {
    roberts: { my: [[0, -1], [1, 0]], mx: [[-1, 0], [0, 1]] },
    prewitt: { my: [[-1, -1, -1], [0, 0, 0], [1, 1, 1]], mx: [[-1, 0, 1], [-1, 0, 1], [-1, 0, 1]] },
    sobel: { my: [[-1, -2, -1], [0, 0, 0], [1, 2, 1]], mx: [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]] },
  };

  // Roberts is 2x2: anchor at top-left (y,x)
  function applyAt(img, k, y, x, border = 'replicate') {
    const kh = k.length, kw = k[0].length;
    const oy = kh === 2 ? 0 : (kh - 1) >> 1, ox = kw === 2 ? 0 : (kw - 1) >> 1;
    let s = 0; const terms = [];
    for (let j = 0; j < kh; j++) for (let i = 0; i < kw; i++) {
      let yy = y + j - oy, xx = x + i - ox, v;
      if (!inside(img, yy, xx)) {
        if (border === 'zero') { terms.push({ yy, xx, v: 0, k: k[j][i] }); continue; }
        yy = clamp(yy, 0, H(img) - 1); xx = clamp(xx, 0, W(img) - 1);
      }
      v = img[yy][xx]; s += k[j][i] * v; terms.push({ yy, xx, v, k: k[j][i] });
    }
    return { s, terms };
  }

  // Edge direction (Fig 3-6): edge ⟂ gradient, 8 bins of 45° centred on 0°,
  // angles measured with y pointing down (so +angle turns clockwise on screen).
  function gradAngle(dy, dx) { return Math.atan2(dy, dx) * 180 / Math.PI; }
  function edgeDir8(dy, dx) {
    const e = ((gradAngle(dy, dx) + 90) % 360 + 360) % 360;
    return Math.floor(((e + 22.5) % 360) / 45);
  }
  // NMS neighbours (Fig 3-17): along the gradient, i.e. across the edge
  const NMS_NB = [[[-1, 0], [1, 0]], [[-1, 1], [1, -1]], [[0, -1], [0, 1]], [[-1, -1], [1, 1]]];

  function edgeMaps(img, op = 'sobel', border = 'replicate') {
    const { my, mx } = OPS[op], h = H(img), w = W(img);
    const dy = zeros(h, w), dx = zeros(h, w), S = zeros(h, w), D = zeros(h, w);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const a = applyAt(img, my, y, x, border).s, b = applyAt(img, mx, y, x, border).s;
      dy[y][x] = a; dx[y][x] = b; S[y][x] = Math.hypot(a, b); D[y][x] = edgeDir8(a, b);
    }
    return { dy, dx, S, D };
  }

  function nms(S, D) {
    const h = H(S), w = W(S), out = clone(S);
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const [[a, b], [c, d]] = NMS_NB[D[y][x] % 4];
      if (S[y][x] <= S[y + a][x + b] || S[y][x] <= S[y + c][x + d]) out[y][x] = 0;
    }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (y === 0 || x === 0 || y === h - 1 || x === w - 1) out[y][x] = 0;
    return out;
  }

  function hysteresis(S, tLow, tHigh) {
    const h = H(S), w = W(S), e = zeros(h, w), vis = zeros(h, w);
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      if (S[y][x] > tHigh && !vis[y][x]) {
        const stack = [[y, x]];
        while (stack.length) {
          const [cy, cx] = stack.pop();
          if (vis[cy][cx]) continue;
          vis[cy][cx] = 1; e[cy][cx] = 1;
          for (const [a, b] of DIR8) {
            const ny = cy + a, nx = cx + b;
            if (ny > 0 && nx > 0 && ny < h - 1 && nx < w - 1 && S[ny][nx] > tLow && !vis[ny][nx]) stack.push([ny, nx]);
          }
        }
      }
    }
    return e;
  }

  // Marr-Hildreth zero crossing: 4 opposing pairs (E-W, N-S, NE-SW, NW-SE)
  const ZC_PAIRS = [
    { name: '동-서', a: [0, 1], b: [0, -1] },
    { name: '남-북', a: [1, 0], b: [-1, 0] },
    { name: '북동-남서', a: [-1, 1], b: [1, -1] },
    { name: '북서-남동', a: [-1, -1], b: [1, 1] },
  ];
  function zcAt(g, y, x, T) {
    const pairs = ZC_PAIRS.map(p => {
      const va = g[y + p.a[0]][x + p.a[1]], vb = g[y + p.b[0]][x + p.b[1]];
      const opp = va * vb < 0, diff = Math.abs(va - vb);
      return { ...p, va, vb, opp, diff, pass: opp && diff > T };
    });
    const nPass = pairs.filter(p => p.pass).length;
    return { pairs, nPass, edge: nPass >= 2 };
  }
  function zeroCross(g, T) {
    const h = H(g), w = W(g), b = zeros(h, w);
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) b[y][x] = zcAt(g, y, x, T).edge ? 1 : 0;
    return b;
  }

  // SPTA (Alg 3-5). n[k] = neighbour k (0=E ... 7=NE)
  function sptaTerms(e, y, x) {
    const n = DIR8.map(([a, b]) => (inside(e, y + a, x + b) ? e[y + a][x + b] : 0));
    const N = k => n[k] === 1, NOT = k => n[k] !== 1;
    const s0 = NOT(0) && N(4) && (N(5) || N(6) || N(2) || N(3)) && (N(6) || NOT(7)) && (N(2) || NOT(1));
    const s4 = NOT(4) && N(0) && (N(1) || N(2) || N(6) || N(7)) && (N(2) || NOT(3)) && (N(6) || NOT(5));
    const s2 = NOT(2) && N(6) && (N(7) || N(0) || N(4) || N(5)) && (N(0) || NOT(1)) && (N(4) || NOT(3));
    const s6 = NOT(6) && N(2) && (N(3) || N(4) || N(0) || N(1)) && (N(4) || NOT(5)) && (N(0) || NOT(7));
    return { n, s0, s4, s2, s6, del: s0 || s4 || s2 || s6 };
  }
  function sptaPass(e) {
    const out = clone(e); let changed = 0;
    for (let y = 1; y < H(e) - 1; y++) for (let x = 1; x < W(e) - 1; x++)
      if (e[y][x] === 1 && sptaTerms(e, y, x).del) { out[y][x] = 0; changed++; }
    return { out, changed };
  }

  // Transition count: 0→1 changes walking the 8 neighbours in a circle
  function transitions(e, y, x) {
    const n = DIR8.map(([a, b]) => (inside(e, y + a, x + b) ? e[y + a][x + b] : 0));
    let c = 0;
    for (let k = 0; k < 8; k++) if (n[k] === 0 && n[(k + 1) % 8] === 1) c++;
    return { n, c };
  }

  // Hough (Ex 3-3): θ axis split into nTheta bins; each point casts one vote per θ bin,
  // evaluated at the bin centre, into the ρ bin that ρ = y cosθ + x sinθ falls in.
  function hough(points, { thetaMin = -90, thetaMax = 90, nTheta = 9, rhoMin = -9, rhoMax = 9, nRho = 9 } = {}) {
    const A = zeros(nRho, nTheta);
    const dT = (thetaMax - thetaMin) / nTheta, dR = (rhoMax - rhoMin) / nRho;
    const votes = points.map(([y, x]) => {
      const cells = [];
      for (let t = 0; t < nTheta; t++) {
        const deg = thetaMin + (t + 0.5) * dT, th = deg * Math.PI / 180;
        const rho = y * Math.cos(th) + x * Math.sin(th);
        const r = Math.floor((rho - rhoMin) / dR);
        if (r >= 0 && r < nRho) { A[r][t]++; cells.push({ r, t, rho, deg }); }
      }
      return cells;
    });
    return { A, votes, dT, dR };
  }

  // Binary / grey morphology with a structuring element given as offsets [{y,x,v}]
  function morph(f, se, op) {
    const h = H(f), w = W(f), out = zeros(h, w);
    const get = (y, x) => (inside(f, y, x) ? f[y][x] : null);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (op === 'dilate') {
        let m = -Infinity;
        for (const s of se) { const v = get(y - s.y, x - s.x); if (v !== null) m = Math.max(m, v + (s.v || 0)); }
        out[y][x] = m === -Infinity ? 0 : m;
      } else {
        let m = Infinity;
        for (const s of se) { const v = get(y + s.y, x + s.x); m = Math.min(m, v === null ? 0 : v - (s.v || 0)); }
        out[y][x] = Math.max(0, m);
      }
    }
    return out;
  }

  function median(img, r = 1) {
    const h = H(img), w = W(img), out = zeros(h, w);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const a = [];
      for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) a.push(img[clamp(y + j, 0, h - 1)][clamp(x + i, 0, w - 1)]);
      a.sort((p, q) => p - q); out[y][x] = a[a.length >> 1];
    }
    return out;
  }

  function bilinear(img, yf, xf) {
    const y = Math.floor(yf), x = Math.floor(xf), b = yf - y, a = xf - x;
    const g = (yy, xx) => img[clamp(yy, 0, H(img) - 1)][clamp(xx, 0, W(img) - 1)];
    const top = (1 - a) * g(y, x) + a * g(y, x + 1), bot = (1 - a) * g(y + 1, x) + a * g(y + 1, x + 1);
    return (1 - b) * top + b * bot;
  }

  // 3x3 homogeneous matrices, row-vector convention of the textbook: x' = x H
  const M = {
    T: (ty, tx) => [[1, 0, 0], [0, 1, 0], [ty, tx, 1]],
    R: deg => { const t = deg * Math.PI / 180, c = Math.cos(t), s = Math.sin(t); return [[c, -s, 0], [s, c, 0], [0, 0, 1]]; },
    S: (sy, sx) => [[sy, 0, 0], [0, sx, 0], [0, 0, 1]],
    mul: (A, B) => A.map((r, i) => B[0].map((_, j) => r.reduce((s, _, k) => s + A[i][k] * B[k][j], 0))),
    apply: (p, Hm) => [0, 1, 2].map(j => p[0] * Hm[0][j] + p[1] * Hm[1][j] + p[2] * Hm[2][j]),
    inv(A) {
      const [[a, b, c], [d, e, f], [g, h, i]] = A;
      const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
      return [[e * i - f * h, c * h - b * i, b * f - c * e], [f * g - d * i, a * i - c * g, c * d - a * f], [d * h - e * g, b * g - a * h, a * e - b * d]].map(r => r.map(v => v / det));
    },
  };

  function burtKernel() { const v = [0.05, 0.25, 0.4, 0.25, 0.05]; return v.map(a => v.map(b => a * b)); }
  function pyramidDown(img, smooth = true) {
    const src = smooth ? correlate2D(img, burtKernel()) : img;
    const h = Math.max(1, H(img) >> 1), w = Math.max(1, W(img) >> 1), out = zeros(h, w);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out[y][x] = src[y * 2][x * 2];
    return out;
  }

  function rgb2hsi(r, g, b) {
    const i = (r + g + b) / 3, mn = Math.min(r, g, b);
    const s = i === 0 ? 0 : 1 - mn / i;
    const num = 0.5 * ((r - g) + (r - b)), den = Math.sqrt((r - g) ** 2 + (r - b) * (g - b));
    let h = den === 0 ? 0 : Math.acos(clamp(num / den, -1, 1)) * 180 / Math.PI;
    if (b > g) h = 360 - h;
    return { h, s, i };
  }

  return {
    zeros, clone, clamp, inside, DIR8, histogram, equalize, otsu, correlate1D, convolve1D, correlate2D,
    maskSize, gaussian1D, gaussianBlur, logKernel, OPS, applyAt, gradAngle, edgeDir8, NMS_NB, edgeMaps, nms, hysteresis,
    ZC_PAIRS, zcAt, zeroCross, sptaTerms, sptaPass, transitions, hough, morph, median, bilinear, M, burtKernel, pyramidDown, rgb2hsi,
  };
})();
if (typeof module !== 'undefined') module.exports = CV;

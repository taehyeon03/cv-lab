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

  // ---------- Chapter 4: local feature detection ----------
  const zget = (f, y, x) => (inside(f, y, x) ? f[y][x] : 0);
  const mapImg = (f, fn) => f.map((r, y) => r.map((v, x) => fn(v, y, x)));

  // Eq. 4.1 with a (2r+1)² box window w; outside the image counts as 0 (Example 4-1)
  function moravecS(f, y0, x0, r = 1) {
    const S = zeros(3, 3);
    for (let v = -1; v <= 1; v++) for (let u = -1; u <= 1; u++) {
      let s = 0;
      for (let y = y0 - r; y <= y0 + r; y++) for (let x = x0 - r; x <= x0 + r; x++) s += (zget(f, y + v, x + u) - zget(f, y, x)) ** 2;
      S[v + 1][u + 1] = s;
    }
    return S;
  }
  // Eq. 4.2
  const moravecC = S => Math.min(S[1][2], S[1][0], S[2][1], S[0][1]);
  function moravecMap(f, r = 1) { return mapImg(f, (_, y, x) => moravecC(moravecS(f, y, x, r))); }

  // Example 4-2: d_y, d_x with [-1 0 1]ᵀ / [-1 0 1], then G ⊛ products (zero outside)
  const BOOK_G = [[.0751, .1238, .0751], [.1238, .2042, .1238], [.0751, .1238, .0751]];
  function gaussKernel2D(sigma) { const g = gaussian1D(sigma); return g.map(a => g.map(b => a * b)); }
  function harris(f, { G = BOOK_G, k = 0.04, border = 'zero' } = {}) {
    const g = border === 'zero' ? zget : (a, y, x) => a[clamp(y, 0, H(a) - 1)][clamp(x, 0, W(a) - 1)];
    const dy = mapImg(f, (_, y, x) => g(f, y + 1, x) - g(f, y - 1, x));
    const dx = mapImg(f, (_, y, x) => g(f, y, x + 1) - g(f, y, x - 1));
    const dyy = mapImg(dy, v => v * v), dxx = mapImg(dx, v => v * v), dyx = mapImg(dy, (v, y, x) => v * dx[y][x]);
    const p = correlate2D(dyy, G, border), q = correlate2D(dxx, G, border), r = correlate2D(dyx, G, border);
    const C = mapImg(p, (pv, y, x) => pv * q[y][x] - r[y][x] ** 2 - k * (pv + q[y][x]) ** 2);
    return { dy, dx, dyy, dxx, dyx, p, q, r, C };
  }
  // eigenvalues of the symmetric 2×2 [[p r][r q]]
  function eig2(p, r, q) { const t = (p + q) / 2, d = Math.sqrt(((p - q) / 2) ** 2 + r * r); return [t + d, t - d]; }

  // Eq. 4.11–4.13 on the Gaussian-smoothed image
  function hessian(f, sigma) {
    const g = gaussianBlur(f, sigma), h = H(f), w = W(f);
    const at = (y, x) => g[clamp(y, 0, h - 1)][clamp(x, 0, w - 1)];
    const dyy = zeros(h, w), dxx = zeros(h, w), dyx = zeros(h, w), det = zeros(h, w), lap = zeros(h, w);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const c = at(y, x);
      dyy[y][x] = at(y + 1, x) - 2 * c + at(y - 1, x);
      dxx[y][x] = at(y, x + 1) - 2 * c + at(y, x - 1);
      dyx[y][x] = (at(y + 1, x + 1) - at(y + 1, x - 1) - at(y - 1, x + 1) + at(y - 1, x - 1)) / 4;
      det[y][x] = dyy[y][x] * dxx[y][x] - dyx[y][x] ** 2;
      lap[y][x] = dyy[y][x] + dxx[y][x];
    }
    return { g, dyy, dxx, dyx, det, lap };
  }

  // Fig 4-8: 7×7 circular mask, area 37
  const SUSAN_MASK = [[0, 0, 1, 1, 1, 0, 0], [0, 1, 1, 1, 1, 1, 0], [1, 1, 1, 1, 1, 1, 1], [1, 1, 1, 1, 1, 1, 1], [1, 1, 1, 1, 1, 1, 1], [0, 1, 1, 1, 1, 1, 0], [0, 0, 1, 1, 1, 0, 0]];
  // Eq. 4.14 (pixels outside the image are not counted)
  function usanArea(f, y0, x0, t1) {
    let n = 0; const c = f[y0][x0];
    for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) if (SUSAN_MASK[j + 3][i + 3] && inside(f, y0 + j, x0 + i) && Math.abs(f[y0 + j][x0 + i] - c) <= t1) n++;
    return n;
  }
  // Eq. 4.15
  function susan(f, t1, t2, q = t2) {
    const area = mapImg(f, (_, y, x) => usanArea(f, y, x, t1));
    return { area, C: mapImg(area, a => (a <= t2 ? q - a : 0)) };
  }

  // Algorithm 4-1: strict local maxima above T (4- or 8-neighbour), borders skipped
  function localMax(m, T, nb = 4) {
    const out = [], N4 = [[0, 1], [0, -1], [1, 0], [-1, 0]], NB = nb === 8 ? DIR8 : N4;
    for (let y = 1; y < H(m) - 1; y++) for (let x = 1; x < W(m) - 1; x++) {
      const c = m[y][x];
      if (c > T && NB.every(([dy, dx]) => c > m[y + dy][x + dx])) out.push([y, x, c]);
    }
    return out;
  }

  // σ²|d_yy + d_xx| at one pixel (Eq. 4.17), Gaussian weights summed directly
  function normLapAt(f, y0, x0, sigma) {
    const r = Math.ceil(3 * sigma) + 1, s2 = sigma * sigma, val = (yc, xc) => {
      let s = 0, ws = 0;
      for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) { const w = Math.exp(-(j * j + i * i) / (2 * s2)); s += w * f[clamp(yc + j, 0, H(f) - 1)][clamp(xc + i, 0, W(f) - 1)]; ws += w; }
      return s / ws;
    };
    const c = val(y0, x0);
    return s2 * Math.abs(val(y0 + 1, x0) + val(y0 - 1, x0) + val(y0, x0 + 1) + val(y0, x0 - 1) - 4 * c);
  }
  function normLap(f, sigma) { const hs = hessian(f, sigma); return mapImg(hs.lap, v => sigma * sigma * Math.abs(v)); }

  // Eq. 4.18–4.19: scale-adapted second moment matrix
  function harrisScale(f, sI, sD, k = 0.04) {
    const g = gaussianBlur(f, sD), h = H(f), w = W(f);
    const at = (y, x) => g[clamp(y, 0, h - 1)][clamp(x, 0, w - 1)];
    const dy = zeros(h, w), dx = zeros(h, w);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { dy[y][x] = (at(y + 1, x) - at(y - 1, x)) / 2; dx[y][x] = (at(y, x + 1) - at(y, x - 1)) / 2; }
    const s2 = sD * sD, sm = m => gaussianBlur(m, sI);
    const p = sm(mapImg(dy, v => s2 * v * v)), q = sm(mapImg(dx, v => s2 * v * v)), r = sm(mapImg(dy, (v, y, x) => s2 * v * dx[y][x]));
    return mapImg(p, (pv, y, x) => pv * q[y][x] - r[y][x] ** 2 - k * (pv + q[y][x]) ** 2);
  }

  // SIFT scale space (Fig 4-16): six Gaussians per octave, σ_i = σ0·k^i, five DOGs
  function siftPyramid(f, nOct = 2, sigma0 = 1.6, s = 3) {
    const k = Math.pow(2, 1 / s), sig = Array.from({ length: s + 3 }, (_, i) => sigma0 * Math.pow(k, i));
    const octs = [];
    let base = null;
    for (let o = 0; o < nOct; o++) {
      const gauss = sig.map((sg, i) => (o === 0 ? gaussianBlur(f, sg) : i === 0 ? base : gaussianBlur(base, Math.sqrt(sg * sg - sigma0 * sigma0))));
      const dog = gauss.slice(1).map((g, i) => mapImg(g, (v, y, x) => v - gauss[i][y][x]));
      octs.push({ o, gauss, dog, sig });
      const g3 = gauss[s];
      base = g3.filter((_, y) => y % 2 === 0).map(r => r.filter((_, x) => x % 2 === 0));
      if (H(base) < 8 || W(base) < 8) break;
    }
    return octs;
  }
  // Fig 4-17: extremum among 26 neighbours in DOG i-1, i, i+1
  function dogExtremum(dog, i, y, x) {
    const c = dog[i][y][x]; let isMax = true, isMin = true;
    for (let d = -1; d <= 1; d++) for (let j = -1; j <= 1; j++) for (let a = -1; a <= 1; a++) {
      if (!d && !j && !a) continue;
      const v = dog[i + d][y + j][x + a];
      if (v >= c) isMax = false;
      if (v <= c) isMin = false;
    }
    return isMax ? 1 : isMin ? -1 : 0;
  }
  function siftKeypoints(octs, thr = 0.03 * 255, edgeR = 0) {
    const kps = [];
    for (const O of octs) {
      const { dog, o } = O, h = H(dog[0]), w = W(dog[0]);
      for (let i = 1; i < dog.length - 1; i++) for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
        const c = dog[i][y][x];
        if (Math.abs(c) < thr) continue;
        const e = dogExtremum(dog, i, y, x);
        if (!e) continue;
        if (edgeR) {
          const D = dog[i], dyy = D[y + 1][x] - 2 * c + D[y - 1][x], dxx = D[y][x + 1] - 2 * c + D[y][x - 1];
          const dyx = (D[y + 1][x + 1] - D[y + 1][x - 1] - D[y - 1][x + 1] + D[y - 1][x - 1]) / 4;
          const det = dyy * dxx - dyx * dyx, tr = dyy + dxx;
          if (det <= 0 || tr * tr / det >= (edgeR + 1) ** 2 / edgeR) continue;
        }
        // Eq. 4.21 (without sub-pixel refinement)
        kps.push({ o, i, y, x, v: c, type: e, Y: y * 2 ** o, X: x * 2 ** o, s: 1.6 * Math.pow(2, (o + i) / 3) });
      }
    }
    return kps;
  }

  // integral image with a zero row/column in front: ii[y+1][x+1] = Σ f[0..y][0..x]
  function integral(f) {
    const h = H(f), w = W(f), ii = zeros(h + 1, w + 1);
    for (let y = 0; y < h; y++) { let row = 0; for (let x = 0; x < w; x++) { row += f[y][x]; ii[y + 1][x + 1] = ii[y][x + 1] + row; } }
    return ii;
  }
  // Σ f over rows y0..y1, cols x0..x1 (inclusive) with four lookups
  const boxSum = (ii, y0, x0, y1, x1) => ii[y1 + 1][x1 + 1] - ii[y0][x1 + 1] - ii[y1 + 1][x0] + ii[y0][x0];
  // SURF box filters (Fig 4-18 c,d) for size L = 3l: lists of [y0, x0, y1, x1, weight] relative to the centre
  function surfBoxes(L) {
    const l = L / 3, hw = l - 1, top = -(3 * l - 1) / 2;
    const yy = [[top, -hw, top + l - 1, hw, 1], [top + l, -hw, top + 2 * l - 1, hw, -2], [top + 2 * l, -hw, top + 3 * l - 1, hw, 1]];
    return { yy, xx: yy.map(([a, b, c, d, wt]) => [b, a, d, c, wt]), yx: [[-l, -l, -1, -1, 1], [-l, 1, -1, l, -1], [1, -l, l, -1, -1], [1, 1, l, l, 1]] };
  }
  function surfMask(L, which) {
    const m = zeros(L, L), c = (L - 1) / 2;
    for (const [y0, x0, y1, x1, wt] of surfBoxes(L)[which]) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) m[y + c][x + c] = wt;
    return m;
  }
  function surfDet(ii, L, h, w, wgt = 0.9) {
    const B = surfBoxes(L), c = (L - 1) / 2, out = zeros(h, w), area = L * L;
    const resp = (list, y, x) => list.reduce((s, [y0, x0, y1, x1, wt]) => s + wt * boxSum(ii, y + y0, x + x0, y + y1, x + x1), 0) / area;
    for (let y = c; y < h - c; y++) for (let x = c; x < w - c; x++) {
      const dyy = resp(B.yy, y, x), dxx = resp(B.xx, y, x), dyx = resp(B.yx, y, x);
      out[y][x] = dyy * dxx - (wgt * dyx) ** 2;
    }
    return out;
  }
  // octave o (0-based) → four filter sizes (9,15,21,27 / 15,27,39,51 / 27,51,75,99)
  function surfSizes(o) { let start = 9, step = 6; for (let k = 0; k < o; k++) { start += step; step *= 2; } return [0, 1, 2, 3].map(i => start + i * step); }

  // whole-image warps (bilinear, background = border value)
  function warp(f, deg, scale = 1, outH, outW) {
    const h = H(f), w = W(f), oh = outH || Math.round(h * scale), ow = outW || Math.round(w * scale);
    const t = deg * Math.PI / 180, c = Math.cos(t), s = Math.sin(t), cy = (h - 1) / 2, cx = (w - 1) / 2, oy = (oh - 1) / 2, ox = (ow - 1) / 2;
    const out = zeros(oh, ow);
    // forward: p' = R·S·(p − c) + o   ⇒   p = Sᐨ¹·Rᵀ·(p' − o) + c
    for (let y = 0; y < oh; y++) for (let x = 0; x < ow; x++) {
      const dy = y - oy, dx = x - ox, sy = (c * dy - s * dx) / scale + cy, sx = (s * dy + c * dx) / scale + cx;
      out[y][x] = bilinear(f, sy, sx);
    }
    return { img: out, map: (y, x) => { const dy = (y - cy) * scale, dx = (x - cx) * scale; return [c * dy + s * dx + oy, -s * dy + c * dx + ox]; } };
  }

  return {
    zeros, clone, clamp, inside, DIR8, histogram, equalize, otsu, correlate1D, convolve1D, correlate2D,
    maskSize, gaussian1D, gaussianBlur, logKernel, OPS, applyAt, gradAngle, edgeDir8, NMS_NB, edgeMaps, nms, hysteresis,
    ZC_PAIRS, zcAt, zeroCross, sptaTerms, sptaPass, transitions, hough, morph, median, bilinear, M, burtKernel, pyramidDown, rgb2hsi,
    moravecS, moravecC, moravecMap, BOOK_G, gaussKernel2D, harris, eig2, hessian, SUSAN_MASK, usanArea, susan, localMax,
    normLapAt, normLap, harrisScale, siftPyramid, dogExtremum, siftKeypoints, integral, boxSum, surfBoxes, surfMask, surfDet, surfSizes, warp,
  };
})();
if (typeof module !== 'undefined') module.exports = CV;

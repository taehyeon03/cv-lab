// Chapter 5 (image segmentation): pure algorithms. Images are arrays of rows img[y][x]; graph nodes use row-major ids.
const SEG = (() => {
  const H = g => g.length, W = g => g[0].length;
  const zeros = (h, w, v = 0) => Array.from({ length: h }, () => new Array(w).fill(v));
  const N4 = [[0, 1], [1, 0], [0, -1], [-1, 0]];
  const N8 = [[0, 1], [1, 1], [1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [-1, 1]];

  // ---------- 5.2.1 thresholding ----------
  function histogram(img, L) { const h = new Array(L).fill(0); for (const r of img) for (const v of r) h[Math.min(L - 1, Math.max(0, Math.round(v)))]++; return h; }
  // Eq. 5.2 for one (t1, t2): classes [0..t1], [t1+1..t2], [t2+1..L-1]
  function vBetween(hn, t1, t2) {
    const L = hn.length, mg = hn.reduce((s, v, i) => s + i * v, 0), part = [[0, t1], [t1 + 1, t2], [t2 + 1, L - 1]];
    const cls = part.map(([a, b]) => { let w = 0, m = 0; for (let i = a; i <= b; i++) { w += hn[i]; m += i * hn[i]; } return { w, mu: w > 0 ? m / w : 0 }; });
    return { v: cls.reduce((s, c) => s + c.w * (c.mu - mg) ** 2, 0), cls, mg };
  }
  // Algorithm 5-1: exhaustive search over 1 ≤ t1 ≤ L-3, t1 < t2 ≤ L-2
  function otsu2(hn) {
    const L = hn.length; let best = { v: -1, t1: 0, t2: 0 };
    const table = zeros(L, L, null);
    for (let t1 = 1; t1 <= L - 3; t1++) for (let t2 = t1 + 1; t2 <= L - 2; t2++) { const r = vBetween(hn, t1, t2); table[t1][t2] = r.v; if (r.v > best.v) best = { v: r.v, t1, t2 }; }
    return { ...best, table };
  }
  const ternarize = (img, t1, t2) => img.map(r => r.map(v => (v <= t1 ? 0 : v <= t2 ? 1 : 2)));
  // Eq. 5.4 with t(j,i) = (mean of the n×n neighbourhood) − C
  function adaptive(img, n, C) {
    const h = H(img), w = W(img), r = (n - 1) >> 1, ii = zeros(h + 1, w + 1);
    for (let y = 0; y < h; y++) { let s = 0; for (let x = 0; x < w; x++) { s += img[y][x]; ii[y + 1][x + 1] = ii[y][x + 1] + s; } }
    const t = zeros(h, w), b = zeros(h, w);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const y0 = Math.max(0, y - r), y1 = Math.min(h - 1, y + r), x0 = Math.max(0, x - r), x1 = Math.min(w - 1, x + r);
      const s = ii[y1 + 1][x1 + 1] - ii[y0][x1 + 1] - ii[y1 + 1][x0] + ii[y0][x0];
      t[y][x] = s / ((y1 - y0 + 1) * (x1 - x0 + 1)) - C; b[y][x] = img[y][x] >= t[y][x] ? 1 : 0;
    }
    return { t, b };
  }

  // ---------- 5.2.2 k-means (Algorithm 5-2) ----------
  const d2 = (a, b) => a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0);
  function kmeans(X, k, initIdx, maxIter = 50) {
    let Z = initIdx.map(i => X[i].slice()), prev = null;
    const trace = [{ Z: Z.map(z => z.slice()), assign: null }];
    for (let it = 0; it < maxIter; it++) {
      const assign = X.map(x => { let b = 0, bd = Infinity; Z.forEach((z, j) => { const d = d2(x, z); if (d < bd) { bd = d; b = j; } }); return b; });
      const same = prev && assign.every((a, i) => a === prev[i]);
      trace.push({ Z: Z.map(z => z.slice()), assign: assign.slice(), converged: !!same });
      if (same) break;
      Z = Z.map((z, j) => { const m = new Array(z.length).fill(0); let c = 0; X.forEach((x, i) => { if (assign[i] === j) { c++; x.forEach((v, d) => (m[d] += v)); } }); return c ? m.map(v => v / c) : z; });
      trace.push({ Z: Z.map(z => z.slice()), assign: assign.slice(), update: true });
      prev = assign;
    }
    const last = trace[trace.length - 1];
    return { trace, assign: last.assign, Z: last.Z };
  }

  // ---------- 5.2.3 split and merge (Algorithm 5-3) ----------
  // Q(r): max − min ≤ T over the block. Children in the book's order: 1 = top-right, 2 = bottom-right, 3 = bottom-left, 4 = top-left
  function splitMerge(img, T = 0, s = 1) {
    const stat = (y, x, hh, ww) => { let lo = Infinity, hi = -Infinity, sum = 0; for (let j = y; j < y + hh; j++) for (let i = x; i < x + ww; i++) { const v = img[j][i]; lo = Math.min(lo, v); hi = Math.max(hi, v); sum += v; } return { lo, hi, mean: sum / (hh * ww) }; };
    const steps = [], leaves = [];
    let id = 0;
    function split(y, x, hh, ww, depth, path) {
      const st = stat(y, x, hh, ww), q = st.hi - st.lo <= T, node = { id: id++, y, x, hh, ww, depth, path, q, mean: st.mean, children: [] };
      steps.push({ kind: 'test', node, q, area: hh * ww });
      if (!q && hh * ww > s && hh > 1 && ww > 1) {
        const h2 = hh >> 1, w2 = ww >> 1;
        const quads = [[y, x + w2, h2, ww - w2], [y + h2, x + w2, hh - h2, ww - w2], [y + h2, x, hh - h2, w2], [y, x, h2, w2]];
        quads.forEach((qd, i) => node.children.push(split(...qd, depth + 1, path + (i + 1))));
      } else { node.leaf = leaves.length; leaves.push(node); steps.push({ kind: 'leaf', node }); }
      return node;
    }
    const root = split(0, 0, H(img), W(img), 0, '');
    // merge: union-find over leaves, merge adjacent pairs while Q(union) holds
    const parent = leaves.map((_, i) => i), find = a => (parent[a] === a ? a : (parent[a] = find(parent[a])));
    const lo = leaves.map(l => stat(l.y, l.x, l.hh, l.ww).lo), hi = leaves.map(l => stat(l.y, l.x, l.hh, l.ww).hi);
    const lab = zeros(H(img), W(img));
    leaves.forEach((l, i) => { for (let j = l.y; j < l.y + l.hh; j++) for (let k = l.x; k < l.x + l.ww; k++) lab[j][k] = i; });
    const merges = [];
    for (let changed = true; changed;) {
      changed = false;
      for (let y = 0; y < H(img); y++) for (let x = 0; x < W(img); x++) for (const [dy, dx] of [[0, 1], [1, 0]]) {
        const yy = y + dy, xx = x + dx; if (yy >= H(img) || xx >= W(img)) continue;
        const a = find(lab[y][x]), b = find(lab[yy][xx]); if (a === b) continue;
        if (Math.max(hi[a], hi[b]) - Math.min(lo[a], lo[b]) <= T) { parent[b] = a; lo[a] = Math.min(lo[a], lo[b]); hi[a] = Math.max(hi[a], hi[b]); merges.push([a, b, leaves[a].path || '루트', leaves[b].path || '루트']); changed = true; }
      }
    }
    const region = lab.map(r => r.map(v => find(v)));
    return { root, leaves, steps, merges, leafLab: lab, region };
  }

  // ---------- 5.3 graphs ----------
  // Eq. 5.5 distance weights between r-neighbours (r=1 → 4-neighbours); feature may be a number or a vector (Eq. 5.10)
  function gridGraph(img, nb = 4) {
    const h = H(img), w = W(img), E = [], fd = (a, b) => (Array.isArray(a) ? Math.sqrt(d2(a, b)) : Math.abs(a - b));
    const offs = nb === 8 ? [[0, 1], [1, -1], [1, 0], [1, 1]] : [[0, 1], [1, 0]];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (const [dy, dx] of offs) { const yy = y + dy, xx = x + dx; if (yy < h && xx >= 0 && xx < w) E.push({ p: y * w + x, q: yy * w + xx, w: fd(img[y][x], img[yy][xx]) }); }
    return E;
  }
  // Kruskal on a node subset → MST edges and intra(C) (Eq. 5.6)
  function mstIntra(nodes, E) {
    const set = new Set(nodes), es = E.filter(e => set.has(e.p) && set.has(e.q)).sort((a, b) => a.w - b.w);
    const par = new Map(nodes.map(v => [v, v])), f = a => (par.get(a) === a ? a : (par.set(a, f(par.get(a))), par.get(a)));
    const mst = [];
    for (const e of es) { const a = f(e.p), b = f(e.q); if (a !== b) { par.set(b, a); mst.push(e); } }
    const comps = new Set(nodes.map(f)).size;
    return { mst, intra: mst.length ? Math.max(...mst.map(e => e.w)) : 0, connected: comps === 1, internal: es };
  }
  // Algorithm 5-4 (Felzenszwalb–Huttenlocher) with an optional step trace
  function felzenszwalb(n, E, k, { trace = false, minArea = 0 } = {}) {
    const es = E.slice().sort((a, b) => a.w - b.w || a.p - b.p || a.q - b.q);
    const par = Array.from({ length: n }, (_, i) => i), size = new Array(n).fill(1), intra = new Array(n).fill(0);
    const find = a => { while (par[a] !== a) { par[a] = par[par[a]]; a = par[a]; } return a; };
    const steps = [];
    for (let i = 0; i < es.length; i++) {
      const e = es[i], a = find(e.p), b = find(e.q);
      let rec = null;
      if (a !== b) {
        const mi = Math.min(intra[a] + k / size[a], intra[b] + k / size[b]);
        const ok = e.w <= mi;
        if (trace) rec = { i, e, a, b, sa: size[a], sb: size[b], ia: intra[a], ib: intra[b], mi, ok };
        if (ok) { par[b] = a; size[a] += size[b]; intra[a] = Math.max(intra[a], intra[b], e.w); }
      } else if (trace) rec = { i, e, a, b, same: true };
      if (trace) steps.push({ ...rec, comp: Array.from({ length: n }, (_, v) => find(v)), intraNow: intra.slice(), sizeNow: size.slice() });
    }
    if (minArea > 0) for (const e of es) { const a = find(e.p), b = find(e.q); if (a !== b && (size[a] < minArea || size[b] < minArea)) { par[b] = a; size[a] += size[b]; } }
    return { comp: Array.from({ length: n }, (_, v) => find(v)), steps, sorted: es };
  }
  // Eq. 5.11, 5.12 on a weight matrix
  function cutVal(Wm, A, B) { let s = 0; for (const p of A) for (const q of B) s += Wm[p][q]; return s; }
  function ncut(Wm, A, B) { const all = [...A, ...B], c = cutVal(Wm, A, B); const aA = cutVal(Wm, A, all), aB = cutVal(Wm, B, all); return { cut: c, assocA: aA, assocB: aB, ncut: c / aA + c / aB }; }
  // symmetric eigen-decomposition (cyclic Jacobi); returns ascending eigenvalues and column eigenvectors
  function jacobi(M0) {
    const n = M0.length, M = M0.map(r => r.slice()), V = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => +(i === j)));
    for (let sweep = 0; sweep < 100; sweep++) {
      let off = 0; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += M[i][j] ** 2;
      if (off < 1e-20) break;
      for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
        if (Math.abs(M[p][q]) < 1e-15) continue;
        const th = (M[q][q] - M[p][p]) / (2 * M[p][q]), t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1)), c = 1 / Math.sqrt(t * t + 1), s = t * c;
        for (let k = 0; k < n; k++) { const a = M[k][p], b = M[k][q]; M[k][p] = c * a - s * b; M[k][q] = s * a + c * b; }
        for (let k = 0; k < n; k++) { const a = M[p][k], b = M[q][k]; M[p][k] = c * a - s * b; M[q][k] = s * a + c * b; }
        for (let k = 0; k < n; k++) { const a = V[k][p], b = V[k][q]; V[k][p] = c * a - s * b; V[k][q] = s * a + c * b; }
      }
    }
    const idx = Array.from({ length: n }, (_, i) => i).sort((a, b) => M[a][a] - M[b][b]);
    return { values: idx.map(i => M[i][i]), vectors: idx.map(i => V.map(r => r[i])) };
  }
  // Eq. 5.13/5.14: second smallest eigenvector of D^-1/2 (D−W) D^-1/2, mapped back by D^-1/2, split at the best ncut threshold
  function spectral(Wm) {
    const n = Wm.length, d = Wm.map(r => r.reduce((a, b) => a + b, 0)), is = d.map(v => 1 / Math.sqrt(v || 1e-12));
    const A = Wm.map((r, i) => r.map((v, j) => ((i === j ? d[i] : 0) - v) * is[i] * is[j]));
    const eg = jacobi(A), z = eg.vectors[1], y = z.map((v, i) => v * is[i]);
    const order = y.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
    let best = null;
    for (let c = 1; c < n; c++) { const S1 = order.slice(0, c).map(o => o[1]), S2 = order.slice(c).map(o => o[1]); const r = ncut(Wm, S1, S2); if (!best || r.ncut < best.ncut) best = { ...r, A: S1, B: S2, thr: (order[c - 1][0] + order[c][0]) / 2 }; }
    return { D: d, Lsym: A, values: eg.values, vectors: eg.vectors, y, best };
  }

  // ---------- 5.4 mean shift ----------
  // Eq. 5.17 kernels (non-zero only for ||u|| ≤ 1)
  const KER = { flat: u2 => (u2 <= 1 ? 1 : 0), gauss: u2 => (u2 <= 1 ? Math.exp(-u2) : 0) };
  // Eq. 5.16 in 1-D
  function parzen1D(X, x, h, ker = 'flat') { const k = KER[ker]; return X.reduce((s, xi) => s + k(((x - xi) / h) ** 2), 0) / (X.length * h); }
  // Eq. 5.18/5.19 from y0 until ||y_{t+1} − y_t|| ≤ ε
  function meanShiftPath(X, y0, h, ker = 'flat', eps = 1e-3, maxIt = 100) {
    const k = KER[ker], path = [y0.slice()];
    let y = y0.slice();
    for (let t = 0; t < maxIt; t++) {
      let ws = 0; const num = new Array(y.length).fill(0), inside = [];
      X.forEach((x, i) => { const w = k(d2(x, y) / (h * h)); if (w > 0) { ws += w; x.forEach((v, j) => (num[j] += w * v)); inside.push(i); } });
      if (!ws) break;
      const yn = num.map(v => v / ws);
      path.push(yn);
      const done = Math.sqrt(d2(yn, y)) <= eps;
      y = yn;
      if (done) break;
    }
    return path;
  }
  // Algorithm 5-6: converge every sample, then group convergence points closer than h
  function meanShiftCluster(X, h, ker = 'flat', eps = 1e-3) {
    const paths = X.map(x => meanShiftPath(X, x, h, ker, eps)), v = paths.map(p => p[p.length - 1]);
    const modes = [], label = v.map(p => { let j = modes.findIndex(m => Math.sqrt(d2(m, p)) < h / 2); if (j < 0) { modes.push(p.slice()); j = modes.length - 1; } return j; });
    return { paths, v, modes, label };
  }
  // RGB → CIE Luv (D65)
  function rgb2luv([r, g, b]) {
    const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
    const R = lin(r), G = lin(g), B = lin(b), X = 0.4124 * R + 0.3576 * G + 0.1805 * B, Y = 0.2126 * R + 0.7152 * G + 0.0722 * B, Z = 0.0193 * R + 0.1192 * G + 0.9505 * B;
    const L = Y > 0.008856 ? 116 * Math.cbrt(Y) - 16 : 903.3 * Y, den = X + 15 * Y + 3 * Z, up = den ? 4 * X / den : 0, vp = den ? 9 * Y / den : 0;
    return [L, 13 * L * (up - 0.19784), 13 * L * (vp - 0.46832)];
  }
  // Algorithm 5-7/5-8 on a small colour image with flat kernels in (y,x) and (L,u,v)
  function meanShiftImage(rgb, hs, hr, { maxIt = 20, minArea = 0 } = {}) {
    const h = H(rgb), w = W(rgb), F = rgb.map(r => r.map(rgb2luv)), modes = zeros(h, w, null), iters = zeros(h, w);
    for (let y0 = 0; y0 < h; y0++) for (let x0 = 0; x0 < w; x0++) {
      let cy = y0, cx = x0, c = F[y0][x0].slice(), it = 0;
      for (; it < maxIt; it++) {
        let n = 0, sy = 0, sx = 0, s = [0, 0, 0];
        const ya = Math.max(0, Math.floor(cy - hs)), yb = Math.min(h - 1, Math.ceil(cy + hs)), xa = Math.max(0, Math.floor(cx - hs)), xb = Math.min(w - 1, Math.ceil(cx + hs));
        for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) {
          if ((y - cy) ** 2 + (x - cx) ** 2 > hs * hs) continue;
          const f = F[y][x]; if ((f[0] - c[0]) ** 2 + (f[1] - c[1]) ** 2 + (f[2] - c[2]) ** 2 > hr * hr) continue;
          n++; sy += y; sx += x; s[0] += f[0]; s[1] += f[1]; s[2] += f[2];
        }
        const ny = sy / n, nx = sx / n, nc = s.map(v => v / n), sh = (ny - cy) ** 2 + (nx - cx) ** 2 + d2(nc, c);
        cy = ny; cx = nx; c = nc;
        if (sh < 0.01) break;
      }
      modes[y0][x0] = { y: cy, x: cx, c }; iters[y0][x0] = it + 1;
    }
    // post-processing: neighbouring pixels whose modes are within (hs, hr) share a region
    const lab = zeros(h, w, -1); let nl = 0; const sizes = [], mean = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (lab[y][x] >= 0) continue;
      const st = [[y, x]]; lab[y][x] = nl; let cnt = 0; const acc = [0, 0, 0];
      while (st.length) {
        const [a, b] = st.pop(), m = modes[a][b]; cnt++; rgb[a][b].forEach((v, i) => (acc[i] += v));
        for (const [dy, dx] of N4) { const yy = a + dy, xx = b + dx; if (yy < 0 || xx < 0 || yy >= h || xx >= w || lab[yy][xx] >= 0) continue; const m2 = modes[yy][xx]; if (d2(m.c, m2.c) <= (hr / 2) ** 2 && (m.y - m2.y) ** 2 + (m.x - m2.x) ** 2 <= hs * hs) { lab[yy][xx] = nl; st.push([yy, xx]); } }
      }
      sizes.push(cnt); mean.push(acc.map(v => v / cnt)); nl++;
    }
    if (minArea > 0) {
      // merge small regions into the neighbouring region with the closest mean colour
      for (let pass = 0; pass < 3; pass++) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const l = lab[y][x]; if (sizes[l] >= minArea) continue;
        let best = -1, bd = Infinity;
        for (const [dy, dx] of N4) { const yy = y + dy, xx = x + dx; if (yy < 0 || xx < 0 || yy >= h || xx >= w) continue; const l2 = lab[yy][xx]; if (l2 !== l) { const dd = d2(mean[l], mean[l2]); if (dd < bd) { bd = dd; best = l2; } } }
        if (best >= 0) { for (let a = 0; a < h; a++) for (let b = 0; b < w; b++) if (lab[a][b] === l) lab[a][b] = best; sizes[best] += sizes[l]; sizes[l] = 0; }
      }
    }
    return { modes, iters, lab, mean };
  }

  // ---------- 5.5 watershed ----------
  // flooding by water level (Fig 5-16): basins start at regional minima, a dam goes where two lakes would meet
  function floodLevels(e, maxLevel) {
    const n = e.length, lab = new Array(n).fill(0), dam = new Array(n).fill(false), frames = [];
    let next = 1;
    for (let lev = 1; lev <= maxLevel; lev++) {
      // water fills every cell whose height is < lev, growing from already-wet cells or starting new lakes
      for (let changed = true; changed;) {
        changed = false;
        for (let i = 0; i < n; i++) {
          if (lab[i] || dam[i] || !(e[i] < lev)) continue;
          const nb = [i - 1, i + 1].filter(j => j >= 0 && j < n && lab[j]).map(j => lab[j]);
          const u = [...new Set(nb)];
          if (u.length === 1) { lab[i] = u[0]; changed = true; } else if (u.length > 1) { dam[i] = true; changed = true; }
        }
      }
      for (let i = 0; i < n; i++) if (!lab[i] && !dam[i] && e[i] < lev && ![i - 1, i + 1].some(j => j >= 0 && j < n && lab[j])) {
        let j = i; const id = next++; while (j < n && !lab[j] && !dam[j] && e[j] < lev) lab[j++] = id;
      }
      frames.push({ level: lev, lab: lab.slice(), dam: dam.slice() });
    }
    return frames;
  }
  // Algorithm 5-9 (Meyer) on a 1-D or 2-D height map, with trace
  function meyer(e2d, { trace = false } = {}) {
    const h = H(e2d), w = W(e2d), lab = zeros(h, w, 0), inQ = zeros(h, w, false), steps = [];
    const nb = (y, x) => N4.map(([dy, dx]) => [y + dy, x + dx]).filter(([a, b]) => a >= 0 && b >= 0 && a < h && b < w);
    // regional minima: plateaus with no lower neighbour
    const seen = zeros(h, w, false); let nl = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (seen[y][x] || !isFinite(e2d[y][x])) continue;
      const v = e2d[y][x], plat = [], st = [[y, x]]; seen[y][x] = true; let lower = false;
      while (st.length) { const [a, b] = st.pop(); plat.push([a, b]); for (const [c, d] of nb(a, b)) { if (e2d[c][d] < v) lower = true; else if (e2d[c][d] === v && !seen[c][d]) { seen[c][d] = true; st.push([c, d]); } } }
      if (!lower) { nl++; for (const [a, b] of plat) lab[a][b] = nl; }
    }
    // priority queue (binary heap), ties broken by insertion order
    const heap = []; let cnt = 0;
    const push = (y, x) => { heap.push([e2d[y][x], cnt++, y, x]); inQ[y][x] = true; let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (cmp(heap[i], heap[p]) < 0) { [heap[i], heap[p]] = [heap[p], heap[i]]; i = p; } else break; } };
    const cmp = (a, b) => a[0] - b[0] || a[1] - b[1];
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && cmp(heap[l], heap[m]) < 0) m = l; if (r < heap.length && cmp(heap[r], heap[m]) < 0) m = r; if (m === i) break; [heap[i], heap[m]] = [heap[m], heap[i]]; i = m; } } return top; };
    const minima = nl;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (lab[y][x]) for (const [a, b] of nb(y, x)) if (!lab[a][b] && !inQ[a][b] && isFinite(e2d[a][b])) push(a, b);
    if (trace) steps.push({ kind: 'init', lab: lab.map(r => r.slice()), queue: heap.map(q => [q[2], q[3], q[0]]) });
    while (heap.length) {
      const [, , y, x] = pop();
      const ls = [...new Set(nb(y, x).map(([a, b]) => lab[a][b]).filter(Boolean))];
      if (ls.length === 1) lab[y][x] = ls[0];
      const added = [];
      for (const [a, b] of nb(y, x)) if (!lab[a][b] && !inQ[a][b] && isFinite(e2d[a][b])) { push(a, b); added.push([a, b]); }
      if (trace) steps.push({ kind: 'pop', y, x, ls, got: lab[y][x], added, lab: lab.map(r => r.slice()), queue: heap.slice().sort(cmp).map(q => [q[2], q[3], q[0]]) });
    }
    return { lab, steps, minima };
  }

  // ---------- 5.6.1 snake (Algorithm 5-10, Eq. 5.26) ----------
  function snakeStep(pts, mag, alpha, beta, gamma) {
    const n = pts.length, dbar = pts.reduce((s, p, i) => s + Math.hypot(p[0] - pts[(i - 1 + n) % n][0], p[1] - pts[(i - 1 + n) % n][1]), 0) / n;
    const H2 = mag.length, W2 = mag[0].length, cand = [], next = pts.map(p => p.slice());
    let moved = 0;
    for (let s = 0; s < n; s++) {
      const prev = next[(s - 1 + n) % n], nxt = next[(s + 1) % n], c = next[s], opts = [];
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const y = c[0] + dy, x = c[1] + dx; if (y >= 0 && x >= 0 && y < H2 && x < W2) opts.push([y, x]); }
      const mags = opts.map(([y, x]) => mag[y][x]); let mx = Math.max(...mags), mn = Math.min(...mags); if (mx - mn < 5) mn = mx - 5;
      const rows = opts.map(([y, x], i) => {
        const ec = Math.abs(dbar - Math.hypot(y - prev[0], x - prev[1])), ek = (prev[0] - 2 * y + nxt[0]) ** 2 + (prev[1] - 2 * x + nxt[1]) ** 2, ei = (mn - mags[i]) / (mx - mn);
        return { y, x, ec, ek, ei, mag: mags[i] };
      });
      // normalise continuity and curvature by their largest value among the 9 candidates (Williams & Shah)
      const mc = Math.max(...rows.map(r => r.ec)) || 1, mk = Math.max(...rows.map(r => r.ek)) || 1;
      rows.forEach(r => { r.ecn = r.ec / mc; r.ekn = r.ek / mk; r.E = alpha[s] * r.ecn + beta[s] * r.ekn + gamma[s] * r.ei; });
      let best = rows.findIndex(r => r.y === c[0] && r.x === c[1]);
      rows.forEach((r, i) => { if (r.E < rows[best].E - 1e-12) best = i; });
      cand.push({ s, rows, best, from: c.slice(), dbar });
      if (rows[best].y !== c[0] || rows[best].x !== c[1]) { next[s] = [rows[best].y, rows[best].x]; moved++; }
    }
    return { next, moved, cand };
  }
  function snakeCorners(pts, mag, T1, T2) {
    const n = pts.length, u = pts.map((p, s) => [p[0] - pts[(s - 1 + n) % n][0], p[1] - pts[(s - 1 + n) % n][1]]);
    const cs = u.map((us, s) => { const un = u[(s + 1) % n], a = Math.hypot(...us) || 1, b = Math.hypot(...un) || 1; return Math.hypot(us[0] / a - un[0] / b, us[1] / a - un[1] / b) ** 2; });
    return cs.map((c, s) => c > cs[(s - 1 + n) % n] && c > cs[(s + 1) % n] && c > T1 && mag[pts[s][0]][pts[s][1]] > T2);
  }

  // ---------- 5.6.2 max flow / min cut ----------
  // Edmonds–Karp (BFS augmenting paths) on a capacity matrix, with trace
  function maxflow(cap, s, t, { trace = false } = {}) {
    const n = cap.length, f = Array.from({ length: n }, () => new Array(n).fill(0)), steps = [];
    let total = 0;
    for (;;) {
      const prev = new Array(n).fill(-1); prev[s] = s; const q = [s];
      while (q.length && prev[t] < 0) { const u = q.shift(); for (let v = 0; v < n; v++) if (prev[v] < 0 && cap[u][v] - f[u][v] > 1e-12) { prev[v] = u; q.push(v); } }
      if (prev[t] < 0) break;
      let b = Infinity, path = [t];
      for (let v = t; v !== s; v = prev[v]) { b = Math.min(b, cap[prev[v]][v] - f[prev[v]][v]); path.unshift(prev[v]); }
      for (let v = t; v !== s; v = prev[v]) { f[prev[v]][v] += b; f[v][prev[v]] -= b; }
      total += b;
      if (trace) steps.push({ path, b, total, f: f.map(r => r.slice()) });
    }
    // min cut: nodes reachable from s in the residual graph
    const reach = new Array(n).fill(false); reach[s] = true; const q = [s];
    while (q.length) { const u = q.shift(); for (let v = 0; v < n; v++) if (!reach[v] && cap[u][v] - f[u][v] > 1e-12) { reach[v] = true; q.push(v); } }
    const cutEdges = []; for (let u = 0; u < n; u++) for (let v = 0; v < n; v++) if (reach[u] && !reach[v] && cap[u][v] > 0) cutEdges.push([u, v, cap[u][v]]);
    return { total, f, reach, cutEdges, steps };
  }
  // Dinic on an adjacency list, for image-sized graphs
  function dinic(n, edges, s, t) {
    const head = new Array(n).fill(-1), to = [], cap = [], nxt = [];
    const add = (u, v, c1, c2) => { to.push(v); cap.push(c1); nxt.push(head[u]); head[u] = to.length - 1; to.push(u); cap.push(c2); nxt.push(head[v]); head[v] = to.length - 1; };
    for (const [u, v, c1, c2] of edges) add(u, v, c1, c2 ?? 0);
    let flow = 0; const level = new Array(n), it = new Array(n);
    const bfs = () => { level.fill(-1); level[s] = 0; const q = [s]; for (let k = 0; k < q.length; k++) { const u = q[k]; for (let e = head[u]; e >= 0; e = nxt[e]) if (cap[e] > 1e-12 && level[to[e]] < 0) { level[to[e]] = level[u] + 1; q.push(to[e]); } } return level[t] >= 0; };
    const dfs = (u, fl) => { if (u === t) return fl; for (; it[u] >= 0; it[u] = nxt[it[u]]) { const e = it[u], v = to[e]; if (cap[e] > 1e-12 && level[v] === level[u] + 1) { const d = dfs(v, Math.min(fl, cap[e])); if (d > 0) { cap[e] -= d; cap[e ^ 1] += d; return d; } } } return 0; };
    while (bfs()) { for (let i = 0; i < n; i++) it[i] = head[i]; let fl; while ((fl = dfs(s, Infinity)) > 0) flow += fl; }
    const reach = new Array(n).fill(false); reach[s] = true; const q = [s];
    for (let k = 0; k < q.length; k++) { const u = q[k]; for (let e = head[u]; e >= 0; e = nxt[e]) if (cap[e] > 1e-12 && !reach[to[e]]) { reach[to[e]] = true; q.push(to[e]); } }
    return { flow, reach };
  }
  // Algorithm 5-11: graph G = pixels + {S, T}; n-links by Eq. 5.27, t-links by Eq. 5.28/5.29, seeds as hard constraints
  function graphCutImage(img, seeds, { lambda = 1, sigma = 1, pObj, pBg, big = 100, simple = false } = {}) {
    const h = H(img), w = W(img), n = h * w, S = n, T = n + 1, E = [], tl = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const p = y * w + x;
      for (const [dy, dx] of [[0, 1], [1, 0]]) { const yy = y + dy, xx = x + dx; if (yy >= h || xx >= w) continue; const q = yy * w + xx, d = img[y][x] - img[yy][xx], wt = simple ? Math.max(0, 9 - Math.abs(d)) : Math.exp(-(d * d) / (2 * sigma * sigma)); E.push([p, q, wt, wt]); }
      const sd = seeds[y][x];
      let wS, wT;
      if (sd === 'O') { wS = big; wT = 0; } else if (sd === 'B') { wS = 0; wT = big; }
      else { const v = img[y][x]; wS = lambda * -Math.log(pBg(v)); wT = lambda * -Math.log(pObj(v)); }
      tl.push({ p, wS, wT });
      if (wS > 0) E.push([S, p, wS, 0]); if (wT > 0) E.push([p, T, wT, 0]);
    }
    const r = dinic(n + 2, E, S, T);
    return { obj: zeros(h, w).map((row, y) => row.map((_, x) => (r.reach[y * w + x] ? 1 : 0))), flow: r.flow, tlinks: tl, nlinks: E.filter(e => e[0] < n && e[1] < n) };
  }

  return { zeros, N4, N8, histogram, vBetween, otsu2, ternarize, adaptive, kmeans, splitMerge, gridGraph, mstIntra, felzenszwalb, cutVal, ncut, jacobi, spectral, KER, parzen1D, meanShiftPath, meanShiftCluster, rgb2luv, meanShiftImage, floodLevels, meyer, snakeStep, snakeCorners, maxflow, dinic, graphCutImage };
})();
if (typeof module !== 'undefined') module.exports = SEG;

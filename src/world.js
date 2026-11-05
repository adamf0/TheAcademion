import * as THREE from 'three';

export const N = 96;
export const K = { EMPTY: 0, ROAD: 1, HOUSE: 2, APT: 3, TOWER: 4, SHOP: 5, IND: 6, CAMPUS: 7 };
export const CAMPUS_SIZE = 12;
const STEP = 0.22, WATER_Y = 3.6 * STEP, GRID = 6;

const kind = new Uint8Array(N * N), height = new Int8Array(N * N), lvl = new Uint8Array(N * N), variant = new Uint8Array(N * N), forest = new Uint8Array(N * N);
const idx = (x, z) => z * N + x;
const inMap = (x, z) => x >= 0 && z >= 0 && x < N && z < N;
const top = i => (height[i] + 4) * STEP;
let seed = 20270101;
export const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const hash = (i, k) => { const s = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return s - Math.floor(s); };

function noiseGrid(cells) {
  const g = Array.from({ length: (cells + 1) ** 2 }, rnd);
  const sm = t => t * t * (3 - 2 * t), at = (a, b) => g[b * (cells + 1) + a];
  return (x, z) => {
    const fx = x / N * cells, fz = z / N * cells, ix = Math.min(cells - 1, fx | 0), iz = Math.min(cells - 1, fz | 0), tx = sm(fx - ix), tz = sm(fz - iz);
    const a = at(ix, iz) + (at(ix + 1, iz) - at(ix, iz)) * tx, b = at(ix, iz + 1) + (at(ix + 1, iz + 1) - at(ix, iz + 1)) * tx;
    return a + (b - a) * tz;
  };
}

// ---------- world generation & autonomous city growth
const centers = [];
let campus = null, dirty = true, cityPop = 0;

function setRoad(i) {
  if (kind[i] === K.CAMPUS) return;
  if (height[i] < 0) height[i] = 0; // causeway over water
  kind[i] = K.ROAD; forest[i] = 0; lvl[i] = 0; dirty = true;
}
function adjRoad(x, z, r) {
  for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++)
    if (inMap(x + dx, z + dz) && kind[idx(x + dx, z + dz)] === K.ROAD) return true;
  return false;
}
function connect(a, b) {
  let x = a.x, z = a.z;
  while (x !== b.x) { setRoad(idx(x, z)); x += Math.sign(b.x - x); }
  while (z !== b.z) { setRoad(idx(x, z)); z += Math.sign(b.z - z); }
  setRoad(idx(x, z));
}

function generate() {
  const n1 = noiseGrid(3), n2 = noiseGrid(7), n3 = noiseGrid(17), nf = noiseGrid(9);
  for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
    const i = idx(x, z);
    let v = n1(x, z) * 0.55 + n2(x, z) * 0.3 + n3(x, z) * 0.15 + (z / N - 0.4) * 0.6; // sea to the north
    height[i] = Math.max(-3, Math.min(14, Math.round((v - 0.45) * 28)));
    variant[i] = (rnd() * 4) | 0;
    forest[i] = height[i] >= 1 && nf(x, z) > 0.47 ? 1 : 0;
  }
  const land = (x, z) => {
    let s = 0;
    for (let dz = -10; dz <= 10; dz += 2) for (let dx = -10; dx <= 10; dx += 2)
      if (inMap(x + dx, z + dz)) { const h = height[idx(x + dx, z + dz)]; if (h >= 1 && h <= 7) s++; }
    return s;
  };
  const cands = [];
  for (let t = 0; t < 600; t++) {
    const x = Math.round((10 + rnd() * (N - 20)) / GRID) * GRID, z = Math.round((10 + rnd() * (N - 20)) / GRID) * GRID;
    cands.push({ x, z, s: land(x, z) });
  }
  cands.sort((a, b) => b.s - a.s);
  const a = cands[0], b = cands.find(c => Math.hypot(c.x - a.x, c.z - a.z) > 36) ?? cands[1];
  centers.push({ x: a.x, z: a.z, r: 6, max: 34, rate: 0.004, big: true }, { x: b.x, z: b.z, r: 5, max: 22, rate: 0.003 });
  for (const c of centers) for (let d = -3; d <= 3; d++) { setRoad(idx(c.x + d, c.z)); setRoad(idx(c.x, c.z + d)); }
  connect(a, b);
  for (let s = 0; s < 9000; s++) growStep();
}

function pickType(dist, c) {
  const rel = dist / c.max;
  if (c.campus) return rnd() < 0.75 ? K.HOUSE : rnd() < 0.6 ? K.SHOP : K.APT; // kos-kosan & warung
  if (rnd() < 0.06 && rel > 0.4) return K.IND;
  if (rel < 0.15) return rnd() < 0.5 ? K.TOWER : rnd() < 0.5 ? K.SHOP : K.APT;
  if (rel < 0.35) return rnd() < 0.55 ? K.APT : rnd() < 0.5 ? K.SHOP : K.HOUSE;
  return rnd() < 0.85 ? K.HOUSE : K.SHOP;
}
function growStep() {
  const c = centers[(rnd() * centers.length) | 0];
  if (c.r < c.max) c.r += c.rate;
  const ang = rnd() * Math.PI * 2, d = c.r * Math.sqrt(rnd());
  const x = Math.round(c.x + Math.cos(ang) * d), z = Math.round(c.z + Math.sin(ang) * d);
  if (!inMap(x, z)) return;
  const i = idx(x, z), k = kind[i], h = height[i];
  if (k === K.CAMPUS || h < 1 || h > 9) return;
  const dist = Math.hypot(x - c.x, z - c.z);
  if (k === K.EMPTY) {
    if (x % GRID === 0 || z % GRID === 0) { if (adjRoad(x, z, 1) && !nearCampus(x, z)) setRoad(i); return; }
    if (!adjRoad(x, z, 2)) return;
    if (forest[i] && dist > 8 && rnd() < 0.85) return; // forests resist sprawl
    forest[i] = 0; kind[i] = pickType(dist, c); lvl[i] = 1; dirty = true;
  } else if (k >= K.HOUSE && k <= K.IND && lvl[i] < 4 && rnd() < 0.3) {
    lvl[i]++;
    if (k === K.HOUSE && lvl[i] > 2 && dist < c.r * 0.45 && !c.campus) { kind[i] = K.APT; lvl[i] = 1; }
    else if (k === K.APT && lvl[i] > 3 && dist < c.r * 0.25 && c.big) { kind[i] = K.TOWER; lvl[i] = 1; }
    dirty = true;
  }
}
const nearCampus = (x, z) => campus && x >= campus.x - 1 && z >= campus.z - 1 && x <= campus.x + CAMPUS_SIZE && z <= campus.z + CAMPUS_SIZE;

export function findSites() {
  const S = CAMPUS_SIZE, evals = [];
  for (let t = 0; t < 2500; t++) {
    const x = (2 + rnd() * (N - S - 4)) | 0, z = (2 + rnd() * (N - S - 4)) | 0;
    let ok = true, hmin = 99, hmax = -99, fc = 0;
    for (let dz = 0; dz < S && ok; dz++) for (let dx = 0; dx < S; dx++) {
      const i = idx(x + dx, z + dz);
      if (height[i] < 1 || kind[i] !== K.EMPTY) { ok = false; break; }
      hmin = Math.min(hmin, height[i]); hmax = Math.max(hmax, height[i]); fc += forest[i];
    }
    if (!ok || hmax - hmin > 5) continue;
    const cx = x + S / 2, cz = z + S / 2;
    const dCity = Math.min(...centers.filter(c => !c.campus).map(c => Math.hypot(c.x - cx, c.z - cz)));
    let water = 0;
    for (let dz = -4; dz < S + 4; dz += 2) for (let dx = -4; dx < S + 4; dx += 2)
      if (inMap(x + dx, z + dz) && height[idx(x + dx, z + dz)] < 0) water++;
    evals.push({ x, z, dCity, water, forest: fc, hAvg: (hmin + hmax) / 2 });
  }
  const out = [];
  const pick = (type, f) => {
    const e = [...evals].sort(f).find(e => out.every(o => Math.abs(o.x - e.x) > S + 2 || Math.abs(o.z - e.z) > S + 2));
    if (e) out.push({ ...e, type });
  };
  pick('kota', (a, b) => a.dCity - b.dCity);
  pick('pantai', (a, b) => b.water - a.water || a.dCity - b.dCity);
  pick('bukit', (a, b) => (b.forest + b.hAvg * 4) - (a.forest + a.hAvg * 4));
  return out;
}

export function reserveCampus(s) {
  const S = CAMPUS_SIZE, hs = [];
  for (let dz = 0; dz < S; dz++) for (let dx = 0; dx < S; dx++) hs.push(height[idx(s.x + dx, s.z + dz)]);
  hs.sort((a, b) => a - b);
  const h = hs[hs.length >> 1];
  for (let dz = 0; dz < S; dz++) for (let dx = 0; dx < S; dx++) {
    const i = idx(s.x + dx, s.z + dz);
    kind[i] = K.CAMPUS; forest[i] = 0; height[i] = h;
  }
  campus = { x: s.x, z: s.z };
  // access road: BFS from campus edge to the nearest existing road
  const prev = new Int32Array(N * N).fill(-2), q = [];
  for (let d = -1; d <= S; d++) for (const [x, z] of [[s.x + d, s.z - 1], [s.x + d, s.z + S], [s.x - 1, s.z + d], [s.x + S, s.z + d]])
    if (inMap(x, z) && prev[idx(x, z)] === -2) { prev[idx(x, z)] = -1; q.push(idx(x, z)); }
  for (let p = 0; p < q.length; p++) {
    const i = q[p];
    if (kind[i] === K.ROAD) { for (let j = i; j !== -1; j = prev[j]) if (kind[j] !== K.ROAD) setRoad(j); break; }
    const x = i % N, z = (i / N) | 0;
    for (const [a, b] of [[x + 1, z], [x - 1, z], [x, z + 1], [x, z - 1]]) {
      if (!inMap(a, b)) continue;
      const j = idx(a, b);
      if (prev[j] === -2 && (kind[j] === K.EMPTY || kind[j] === K.ROAD)) { prev[j] = i; q.push(j); }
    }
  }
  dirty = true;
}
export function addCampusTown() {
  centers.push({ x: campus.x + CAMPUS_SIZE / 2, z: campus.z + CAMPUS_SIZE / 2, r: 8, max: 16, rate: 0.01, campus: true });
}
export function tickCity(steps) { for (let s = 0; s < steps; s++) growStep(); }
export const getCityPop = () => cityPop;

// ---------- rendering
function winTex(bg, win, lit, cols = 4, rows = 8) {
  const c = document.createElement('canvas'); c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, 64, 128);
  const cw = 64 / cols, rh = 128 / rows;
  for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) {
    g.fillStyle = rnd() < 0.12 ? lit : win;
    g.fillRect(k * cw + cw * 0.18, r * rh + rh * 0.22, cw * 0.64, rh * 0.5);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function label(text, color) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = color; g.beginPath(); g.arc(64, 64, 56, 0, Math.PI * 2); g.fill();
  g.lineWidth = 8; g.strokeStyle = '#fff'; g.stroke();
  g.fillStyle = '#fff'; g.font = 'bold 72px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 64, 68);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false }));
  s.scale.set(3, 3, 1);
  return s;
}

export function createWorld(container, onPick) {
  generate();
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x2a9fb0);
  scene.add(new THREE.HemisphereLight(0xe6f6ff, 0x4a6b3a, 1.0));
  const sun = new THREE.DirectionalLight(0xfff1d6, 2.0);
  sun.position.set(N / 2 + 40, 60, N / 2 + 25);
  sun.target.position.set(N / 2, 0, N / 2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  Object.assign(sun.shadow.camera, { left: -75, right: 75, top: 75, bottom: -75, near: 1, far: 250 });
  sun.shadow.bias = -0.0004;
  scene.add(sun, sun.target);

  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, -500, 500);
  const view = { x: N / 2, z: N / 2, zoom: 26, rot: 1 };
  const ang = () => Math.PI / 2 * view.rot + Math.PI / 4;
  function placeCamera() {
    const a = ang(), d = 100;
    cam.position.set(view.x + Math.cos(a) * d, d * 0.82, view.z + Math.sin(a) * d);
    cam.lookAt(view.x, 0, view.z);
    const w = container.clientWidth / container.clientHeight;
    Object.assign(cam, { left: -view.zoom * w, right: view.zoom * w, top: view.zoom, bottom: -view.zoom });
    cam.updateProjectionMatrix();
  }
  function resize() { renderer.setSize(container.clientWidth, container.clientHeight); placeCamera(); }
  new ResizeObserver(resize).observe(container);

  const box = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const L = o => new THREE.MeshLambertMaterial(o);
  const roofTop = L({ color: 0x9a9a96 });
  const textured = tex => [L({ map: tex }), L({ map: tex }), roofTop, roofTop, L({ map: tex }), L({ map: tex })];
  const IM = (geo, mat, n, shadow = true) => {
    const m = new THREE.InstancedMesh(geo, mat, n);
    m.castShadow = shadow; m.receiveShadow = true; m.count = 0;
    m.setColorAt(0, new THREE.Color()); // allocate instanceColor
    scene.add(m); return m;
  };
  const ground = IM(box, L(), N * N, false);
  const houses = IM(box, L(), N * N), roofs = IM(new THREE.ConeGeometry(0.72, 1, 4).rotateY(Math.PI / 4).translate(0, 0.5, 0), L({ flatShading: true }), N * N);
  const apts = IM(box, textured(winTex('#e4ddcf', '#5d7189', '#ffe9a8')), N * N);
  const towers = IM(box, textured(winTex('#8fb0cc', '#2c4560', '#cfe6ff', 5, 12)), N * N);
  const shops = IM(box, textured(winTex('#efe7d6', '#7d93ad', '#ffe9a8', 3, 3)), N * N);
  const inds = IM(box, L(), N * N);
  const chims = IM(new THREE.CylinderGeometry(0.08, 0.12, 1, 8).translate(0, 0.5, 0), L({ color: 0x7a7a7a }), N * N);
  const trees = IM(new THREE.IcosahedronGeometry(0.3, 1), L({ flatShading: true }), N * N * 3);
  const all = [ground, houses, roofs, apts, towers, shops, inds, chims, trees];

  const water = new THREE.Mesh(new THREE.PlaneGeometry(N * 4, N * 4).rotateX(-Math.PI / 2), new THREE.MeshPhongMaterial({ color: 0x2aa3b3, transparent: true, opacity: 0.82, shininess: 90 }));
  water.position.set(N / 2, WATER_Y, N / 2);
  scene.add(water);

  const dummy = new THREE.Object3D(), col = new THREE.Color();
  function put(m, x, y, z, sx, sy, sz, c, ry = 0) {
    dummy.position.set(x, y, z); dummy.rotation.set(0, ry, 0); dummy.scale.set(sx, sy, sz); dummy.updateMatrix();
    m.setMatrixAt(m.count, dummy.matrix); m.setColorAt(m.count, col.set(c)); m.count++;
  }
  const GRASS = [0x77b05a, 0x6fa955, 0x7db760, 0x72ab58], TREE = [0x2e6b2a, 0x3a7d32, 0x285e25, 0x4a8a3a];
  const HOUSE = [0xf3ead8, 0xe6d3b3, 0xdfe3e6, 0xf0d9c4], ROOF = [0xb5523b, 0x8e3b2e, 0x5c6670, 0xa0643a];
  const TINT = [0xffffff, 0xf0e6d8, 0xe0e8f0, 0xf5efe0], GLASS = [0xffffff, 0xbcd0e8, 0xd8e4f0, 0x5a6878];
  let roads = [];

  function groundColor(i) {
    const h = height[i], k = kind[i];
    if (h < 0) return [0, 0x3f6f78, 0x7f9a8a, 0xbfb58a][h + 4] ?? 0x3f6f78;
    if (k === K.ROAD) return 0x5c6168;
    if (h === 0) return 0xead9a6;
    if (k === K.CAMPUS) return 0x86c56f;
    if (k === K.APT || k === K.TOWER || k === K.SHOP || k === K.IND) return 0xa9aaa4;
    if (forest[i]) return 0x4f8a3c;
    if (h >= 11) return 0x9a968a;
    return GRASS[variant[i]];
  }
  function tree(i, cx, y, cz, n) {
    for (let t = 0; t < n; t++) {
      const s = 0.7 + hash(i, t * 3) * 0.6;
      put(trees, cx + (hash(i, t * 3 + 1) - 0.5) * 0.7, y + 0.25 * s, cz + (hash(i, t * 3 + 2) - 0.5) * 0.7, s, s * 1.25, s, TREE[(i + t) % 4]);
    }
  }
  function refresh() {
    for (const m of all) m.count = 0;
    roads = []; cityPop = 0;
    for (let i = 0; i < N * N; i++) {
      const x = i % N, z = (i / N) | 0, k = kind[i], y = top(i), cx = x + 0.5, cz = z + 0.5, v = variant[i], L = lvl[i];
      put(ground, cx, 0, cz, 1, y, 1, groundColor(i));
      if (k === K.ROAD) roads.push(i);
      else if (k === K.EMPTY && forest[i]) tree(i, cx, y, cz, 3);
      else if (k === K.EMPTY && height[i] >= 1 && hash(i, 9) < 0.08) tree(i, cx, y, cz, 1);
      else if (k === K.HOUSE) {
        const w = 0.55, hh = 0.3 + 0.1 * (L - 1), ox = (hash(i, 1) - 0.5) * 0.2, oz = (hash(i, 2) - 0.5) * 0.2;
        put(houses, cx + ox, y, cz + oz, w, hh, w * 0.85, HOUSE[v]);
        put(roofs, cx + ox, y + hh, cz + oz, w, 0.28, w * 0.85, ROOF[(v + L) % 4]);
        if (hash(i, 5) < 0.4) tree(i, cx - ox * 2 + 0.25, y, cz - oz * 2 + 0.25, 1);
        cityPop += 5 * L;
      } else if (k === K.APT) {
        put(apts, cx, y, cz, 0.82, 0.6 + L * 0.45, 0.82, TINT[v]); cityPop += 40 * L;
      } else if (k === K.TOWER) {
        const w = 0.66 + (v % 2) * 0.12;
        put(towers, cx, y, cz, w, 2 + L * 1.3 + v * 0.4, w, GLASS[v]); cityPop += 150 * L;
      } else if (k === K.SHOP) {
        put(shops, cx, y, cz, 0.88, 0.35 + L * 0.15, 0.88, TINT[(v + 1) % 4]); cityPop += 3 * L;
      } else if (k === K.IND) {
        const hh = 0.5 + L * 0.1;
        put(inds, cx, y, cz, 0.9, hh, 0.9, [0xb8a888, 0xa0a4a8, 0xc4b494, 0x9a9488][v]);
        put(chims, cx - 0.25, y + hh, cz - 0.25, 1, 0.6 + L * 0.2, 1, 0x7a7a7a);
      }
    }
    for (const m of all) { m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; }
    ground.computeBoundingSphere();
    dirty = false;
  }

  // ---------- cars & boats
  const CAR = [0xd33d3d, 0xf2f2f2, 0x2d5da8, 0x222222, 0xe8c33a, 0x8a8f96];
  const carMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.22, 0.1, 0.12), L(), 220);
  const boatMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.4, 0.08, 0.16), L({ color: 0xffffff }), 30);
  scene.add(carMesh, boatMesh);
  let cars = [];
  const spawnCar = () => { const r = roads[(rnd() * roads.length) | 0]; return { i: r, j: r, t: 1, lane: rnd() < 0.5 ? 0.17 : -0.17, sp: 0.8 + rnd() * 0.8 }; };
  const boats = [];
  for (let b = 0; b < 30 && boats.length < 30; b++) for (let t = 0; t < 50; t++) {
    const x = rnd() * N, z = rnd() * N;
    if (height[idx(x | 0, z | 0)] <= -2) { const a = rnd() * 6.28; boats.push({ x, z, vx: Math.cos(a) * 0.3, vz: Math.sin(a) * 0.3 }); break; }
  }
  boatMesh.count = boats.length;
  function moveVehicles(dt) {
    if (cars.length === 0 && roads.length) { cars = Array.from({ length: 220 }, spawnCar); cars.forEach((_, n) => carMesh.setColorAt(n, col.set(CAR[n % CAR.length]))); carMesh.instanceColor.needsUpdate = true; }
    cars.forEach((c, n) => {
      c.t += dt * c.sp;
      if (c.t >= 1) {
        const x = c.j % N, nb = [];
        for (const [d, ok] of [[1, x < N - 1], [-1, x > 0], [N, c.j + N < N * N], [-N, c.j - N >= 0]])
          if (ok && kind[c.j + d] === K.ROAD && c.j + d !== c.i) nb.push(c.j + d);
        if (kind[c.j] !== K.ROAD) Object.assign(c, spawnCar());
        else { c.i = c.j; c.j = nb.length ? nb[(rnd() * nb.length) | 0] : c.i; c.t = 0; }
      }
      const ax = c.i % N + 0.5, az = ((c.i / N) | 0) + 0.5, bx = c.j % N + 0.5, bz = ((c.j / N) | 0) + 0.5;
      const dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz) || 1;
      dummy.position.set(ax + dx * c.t - dz / len * c.lane, Math.max(top(c.i), top(c.j)) + 0.05, az + dz * c.t + dx / len * c.lane);
      dummy.rotation.set(0, -Math.atan2(dz, dx), 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix();
      carMesh.setMatrixAt(n, dummy.matrix);
    });
    carMesh.instanceMatrix.needsUpdate = true;
    boats.forEach((b, n) => {
      const nx = b.x + b.vx * dt, nz = b.z + b.vz * dt;
      if (!inMap(nx | 0, nz | 0) || height[idx(nx | 0, nz | 0)] > -2) { b.vx *= -1; b.vz *= -1; } else { b.x = nx; b.z = nz; }
      dummy.position.set(b.x, WATER_Y + 0.03, b.z); dummy.rotation.set(0, -Math.atan2(b.vz, b.vx), 0); dummy.updateMatrix();
      boatMesh.setMatrixAt(n, dummy.matrix);
    });
    boatMesh.instanceMatrix.needsUpdate = true;
  }

  // ---------- site markers & campus
  const siteGroup = new THREE.Group(), campusGroup = new THREE.Group();
  scene.add(siteGroup, campusGroup);
  function showSites(sites, selected) {
    siteGroup.clear();
    const colors = ['#d9480f', '#1971c2', '#2b8a3e'];
    sites.forEach((s, n) => {
      const y = top(idx(s.x + 6, s.z + 6));
      const plate = new THREE.Mesh(new THREE.BoxGeometry(CAMPUS_SIZE, 0.08, CAMPUS_SIZE), new THREE.MeshBasicMaterial({ color: colors[n], transparent: true, opacity: n === selected ? 0.55 : 0.3 }));
      plate.position.set(s.x + CAMPUS_SIZE / 2, y + 0.3, s.z + CAMPUS_SIZE / 2);
      const sp = label('ABC'[n], colors[n]);
      sp.position.set(s.x + CAMPUS_SIZE / 2, y + 4, s.z + CAMPUS_SIZE / 2);
      siteGroup.add(plate, sp);
    });
  }
  const campusTex = winTex('#efe6d6', '#6d7f95', '#ffe9a8', 6, 4);
  function setFacilities(list) {
    campusGroup.clear();
    if (!campus) return;
    const y0 = top(idx(campus.x, campus.z)), X = campus.x, Z = campus.z;
    const add = (geo, mat, x, y, z, shadow = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(X + x, y0 + y, Z + z); m.castShadow = shadow; m.receiveShadow = true; campusGroup.add(m); return m; };
    const path = L({ color: 0xd9d2c2 });
    add(new THREE.BoxGeometry(0.6, 0.03, CAMPUS_SIZE), path, 6, 0, 6, false);
    add(new THREE.BoxGeometry(CAMPUS_SIZE, 0.03, 0.6), path, 6, 0, 3.8, false);
    add(new THREE.BoxGeometry(CAMPUS_SIZE, 0.03, 0.6), path, 6, 0, 7.6, false);
    const tg = new THREE.IcosahedronGeometry(0.3, 1);
    for (let t = 0.5; t < CAMPUS_SIZE; t += 1.4) for (const [x, z] of [[t, 0.3], [t, CAMPUS_SIZE - 0.3], [0.3, t], [CAMPUS_SIZE - 0.3, t]])
      add(tg, L({ color: TREE[(t * 7 | 0) % 4], flatShading: true }), x, 0.3, z);
    for (const f of list) {
      const { x, z, w, d, h } = f.slot;
      if (f.state === 'built') {
        if (f.slot.field) {
          add(new THREE.BoxGeometry(w, 0.05, d), L({ color: 0xb5533c }), x, 0, z, false);
          add(new THREE.BoxGeometry(w * 0.75, 0.07, d * 0.8), L({ color: 0x4fa64a }), x, 0, z, false);
          continue;
        }
        const roof = L({ color: f.slot.roof ?? 0x8a8a86 });
        const body = new THREE.MeshLambertMaterial({ map: campusTex, color: f.slot.color });
        add(new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0), [body, body, roof, roof, body, body], x, 0, z);
        if (f.slot.dome) add(new THREE.SphereGeometry(Math.min(w, d) * 0.35, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), L({ color: 0x2f7d6b }), x, h, z);
        if (f.slot.flag) { add(new THREE.CylinderGeometry(0.03, 0.03, 1.6), L({ color: 0xdddddd }), x + w / 2 + 0.3, 0.8, z + d / 2 + 0.3); add(new THREE.BoxGeometry(0.5, 0.3, 0.02), L({ color: 0xd62828 }), x + w / 2 + 0.55, 1.45, z + d / 2 + 0.3); }
      } else if (f.state === 'building') {
        const ph = Math.max(0.05, (f.slot.field ? 0.1 : h) * f.progress);
        add(new THREE.BoxGeometry(w * 0.95, ph, d * 0.95).translate(0, ph / 2, 0), L({ color: 0xbdb5a6 }), x, 0, z);
        const frame = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w, Math.max(h, 0.3), d)), new THREE.LineBasicMaterial({ color: 0xf2b705 }));
        frame.position.set(X + x, y0 + Math.max(h, 0.3) / 2, Z + z); campusGroup.add(frame);
      }
    }
  }

  // ---------- input: drag to pan, wheel/pinch to zoom, Q/E rotate, click to pick
  const el = renderer.domElement, pts = new Map(), ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let downAt = null, moved = false, pinch0 = 0, zoom0 = 0;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const spread = () => { const [a, b] = [...pts.values()]; return Math.hypot(a[0] - b[0], a[1] - b[1]); };
  function pan(dx, dy) {
    const k = 2 * view.zoom / container.clientHeight, a = ang(), s = 1.58; // 1/sin(elevation)
    view.x = clamp(view.x - Math.sin(a) * dx * k - Math.cos(a) * dy * k * s, 0, N);
    view.z = clamp(view.z + Math.cos(a) * dx * k - Math.sin(a) * dy * k * s, 0, N);
    placeCamera();
  }
  function pick(e) {
    const r = el.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, cam);
    const hit = ray.intersectObject(ground)[0];
    return hit ? { x: hit.instanceId % N, z: (hit.instanceId / N) | 0 } : null;
  }
  el.style.touchAction = 'none';
  el.addEventListener('pointerdown', e => {
    el.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]);
    downAt = [e.clientX, e.clientY]; moved = false;
    if (pts.size === 2) { pinch0 = spread(); zoom0 = view.zoom; }
  });
  el.addEventListener('pointermove', e => {
    const p = pts.get(e.pointerId); if (!p) return;
    if (pts.size === 1) {
      if (Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 5) moved = true;
      if (moved) pan(e.clientX - p[0], e.clientY - p[1]);
      pts.set(e.pointerId, [e.clientX, e.clientY]);
    } else {
      pts.set(e.pointerId, [e.clientX, e.clientY]); moved = true;
      view.zoom = clamp(zoom0 * pinch0 / spread(), 6, 55); placeCamera();
    }
  });
  const up = e => {
    pts.delete(e.pointerId);
    if (!moved && pts.size === 0 && e.type === 'pointerup') { const t = pick(e); if (t) onPick(t); }
  };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  el.addEventListener('wheel', e => { e.preventDefault(); view.zoom = clamp(view.zoom * (e.deltaY > 0 ? 1.1 : 0.9), 6, 55); placeCamera(); }, { passive: false });
  const rotate = d => { view.rot += d; placeCamera(); };
  addEventListener('keydown', e => { if (e.target.closest?.('input,select,textarea')) return; if (e.key === 'q') rotate(-1); if (e.key === 'e') rotate(1); });

  let last = performance.now(), lastRefresh = 0;
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (dirty && now - lastRefresh > 400) { refresh(); lastRefresh = now; }
    moveVehicles(dt);
    renderer.render(scene, cam);
    requestAnimationFrame(frame);
  }
  resize(); refresh(); requestAnimationFrame(frame);

  return {
    showSites, setFacilities, rotate,
    focus(x, z, zoom) { view.x = x; view.z = z; if (zoom) view.zoom = zoom; placeCamera(); },
    zoomBy(f) { view.zoom = clamp(view.zoom * f, 6, 55); placeCamera(); },
  };
}

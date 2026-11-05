import { createWorld, findSites, reserveCampus, addCampusTown, tickCity, getCityPop, CAMPUS_SIZE, rnd } from './world.js';

// ---------- data (units: juta rupiah, days)
const FAC = [
  { id: 'rektorat', name: 'Gedung Rektorat', cost: 8000, days: 120, upkeep: 40, info: 'Pusat administrasi. Syarat SLF.', slot: { x: 6, z: 1.6, w: 3, d: 1.6, h: 1.8, color: 0xf6f1e7, roof: 0x8e3b2e, flag: true } },
  { id: 'kuliah', name: 'Gedung Kuliah', cost: 12000, days: 150, upkeep: 60, info: 'Kapasitas 2.000 mahasiswa. Syarat SLF.', slot: { x: 2.2, z: 2.2, w: 2.6, d: 2.6, h: 1.6, color: 0xe9d7c0 } },
  { id: 'perpus', name: 'Perpustakaan', cost: 6000, days: 100, upkeep: 30, info: 'Mutu pendidikan naik. Syarat izin PT.', slot: { x: 9.8, z: 2.2, w: 2.4, d: 2.4, h: 1.4, color: 0xd8c3a5, roof: 0x5c6670 } },
  { id: 'lab', name: 'Laboratorium Terpadu', cost: 9000, days: 120, upkeep: 70, info: 'Mutu & riset naik. Syarat prodi teknik/kesehatan.', slot: { x: 2.2, z: 5.6, w: 2.6, d: 2, h: 1.2, color: 0xdfe6ec } },
  { id: 'lapangan', name: 'Lapangan & Trek Atletik', cost: 2500, days: 60, upkeep: 10, info: 'Kepuasan mahasiswa, prestasi olahraga.', slot: { x: 6, z: 5.7, w: 3.6, d: 3.2, h: 0, field: true } },
  { id: 'auditorium', name: 'Auditorium', cost: 7000, days: 120, upkeep: 30, info: '+500 kapasitas kuliah umum, wisuda.', slot: { x: 9.8, z: 5.6, w: 2.4, d: 2, h: 1.3, color: 0xf0e2c8, roof: 0x8e3b2e } },
  { id: 'riset', name: 'Pusat Riset', cost: 10000, days: 150, upkeep: 80, info: 'Publikasi ×1,5.', slot: { x: 2.2, z: 9.2, w: 2.6, d: 2, h: 2.4, color: 0xcfdbe6 } },
  { id: 'masjid', name: 'Masjid Kampus', cost: 3000, days: 90, upkeep: 10, info: 'Kepuasan & kegiatan pengabdian.', slot: { x: 9.8, z: 9.2, w: 1.8, d: 1.8, h: 1, color: 0xf6f3ea, dome: true } },
  { id: 'kantin', name: 'Kantin & Gedung PKM', cost: 2500, days: 60, upkeep: 15, info: 'Kepuasan mahasiswa, ormawa.', slot: { x: 6, z: 9.4, w: 3, d: 1.3, h: 0.6, color: 0xf2d6a2, roof: 0xb5523b } },
  { id: 'asrama', name: 'Asrama Mahasiswa', cost: 8000, days: 120, upkeep: 40, info: 'Pendapatan sewa, kepuasan.', slot: { x: 6, z: 11.1, w: 4.4, d: 1.1, h: 1.4, color: 0xe6cfb5 } },
  { id: 'klinik', name: 'Klinik Kampus', cost: 2000, days: 60, upkeep: 20, info: 'Kepuasan, syarat prodi kesehatan.', slot: { x: 2.2, z: 11.1, w: 1.6, d: 1.1, h: 0.7, color: 0xffffff, roof: 0x2b8a3e } },
  { id: 'technopark', name: 'Technopark & Inkubator', cost: 9000, days: 150, upkeep: 50, info: 'Kerja sama industri, pengabdian.', slot: { x: 9.8, z: 11.1, w: 2.4, d: 1.1, h: 1, color: 0xbcd0e8 } },
];
const PERMITS = [
  { id: 'yayasan', name: 'Akta Pendirian Yayasan', by: 'Notaris & Kemenkumham', cost: 50, days: 14, req: [], fail: 0.05 },
  { id: 'lahan', name: 'Sertifikat Hak atas Tanah', by: 'BPN', cost: 250, days: 45, req: ['yayasan'], fail: 0.1 },
  { id: 'kkpr', name: 'KKPR (Kesesuaian Pemanfaatan Ruang)', by: 'Pemda via OSS', cost: 40, days: 20, req: ['lahan'], fail: 0.1 },
  { id: 'amdal', name: 'AMDAL / UKL-UPL', by: 'Dinas Lingkungan Hidup', cost: 350, days: 60, req: ['kkpr'], fail: 0.12 },
  { id: 'pbg', name: 'PBG (Persetujuan Bangunan Gedung)', by: 'Pemda via SIMBG', cost: 180, days: 30, req: ['amdal'], fail: 0.1 },
  { id: 'slf', name: 'SLF (Sertifikat Laik Fungsi)', by: 'Pemda via SIMBG', cost: 80, days: 21, req: ['pbg'], fail: 0.08, need: () => built('rektorat') && built('kuliah'), needText: 'Gedung Rektorat & Gedung Kuliah selesai' },
  { id: 'izinpt', name: 'Izin Pendirian Perguruan Tinggi', by: 'Kementerian Pendidikan Tinggi', cost: 600, days: 120, req: ['yayasan', 'lahan', 'slf'], fail: 0.15,
    need: () => built('perpus') && planned().length >= 3 && dosenTotal() >= 5 * planned().length, needText: 'Perpustakaan, ≥3 prodi rencana, 5 dosen tetap per prodi' },
];
const PRODI = [
  { id: 'if', name: 'Informatika', demand: 1.4, needs: ['lab'] },
  { id: 'mn', name: 'Manajemen', demand: 1.3, needs: [] },
  { id: 'ak', name: 'Akuntansi', demand: 1.1, needs: [] },
  { id: 'hk', name: 'Ilmu Hukum', demand: 1.0, needs: [] },
  { id: 'ps', name: 'Psikologi', demand: 1.0, needs: [] },
  { id: 'ts', name: 'Teknik Sipil', demand: 0.9, needs: ['lab'] },
  { id: 'pb', name: 'Pendidikan Bahasa Inggris', demand: 0.8, needs: [] },
  { id: 'km', name: 'Kesehatan Masyarakat', demand: 0.9, needs: ['klinik'] },
  { id: 'kd', name: 'Kedokteran', demand: 1.7, needs: ['lab', 'klinik'] },
  { id: 'ag', name: 'Agribisnis', demand: 0.7, needs: [] },
];
const UKT = { rendah: 5, sedang: 9, tinggi: 16 }, GAJI = { rendah: 8, standar: 12, tinggi: 18 };
const AKRED = { Unggul: 100, 'Baik Sekali': 75, Baik: 55, 'Tidak Terakreditasi': 10, '—': 30 };
const SITE = {
  kota: { name: 'Pinggir Kota', ppm: 0.3, demand: 1.25, risk: 'Rendah', note: 'Dekat pusat kota, akses mudah, lahan mahal.' },
  pantai: { name: 'Tepi Pantai', ppm: 0.16, demand: 1.0, risk: 'Banjir rob & abrasi', note: 'Pemandangan bagus, kepuasan +5, AMDAL lebih ketat.' },
  bukit: { name: 'Perbukitan Hijau', ppm: 0.06, demand: 0.8, risk: 'Longsor', note: 'Murah dan sejuk, jauh dari kota.' },
};
const AREA = CAMPUS_SIZE * CAMPUS_SIZE * 900; // m², 1 tile ≈ 30×30 m

// ---------- state
const S = {
  phase: 'site', day: 0, speed: 1, cash: 90000, loan: 0, site: null, sites: [], sel: 0,
  permits: {}, fac: {}, prodi: {},
  pol: { ukt: 'sedang', kuota: 600, beasiswa: 10, gaji: 'standar', rasio: 30, kualifikasi: 'S2', rekrut: true, wajibPub: false, mbkm: true, ppks: true, antiPlagiat: true, ormawa: 'bebas', dana: 500, pend: 50, pen: 30, peng: 20 },
  dosen: { s2: 0, s3: 0 }, tendik: 0, cohorts: [], alumni: 0,
  q: 35, res: 5, com: 5, rep: 20, sat: 60,
  pubs: [], pubTotal: 0, akred: { grade: '—', next: 0 }, log: [], hist: [], red: 0, over: false,
};
const built = id => S.fac[id]?.state === 'built';
const planned = () => PRODI.filter(p => S.prodi[p.id]);
const active = () => PRODI.filter(p => S.prodi[p.id]?.state === 'aktif');
const dosenTotal = () => S.dosen.s2 + S.dosen.s3;
const students = () => S.cohorts.reduce((s, c) => s + c.n, 0);
const operational = () => S.permits.izinpt?.status === 'ok';
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const fmt = jt => Math.abs(jt) >= 1000 ? `Rp ${(jt / 1000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} M` : `Rp ${Math.round(jt).toLocaleString('id-ID')} jt`;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const dateStr = d => `${1 + (d % 30)} ${MONTHS[((d % 360) / 30) | 0]} ${2027 + ((d / 360) | 0)}`;

function log(msg, type = 'info') {
  S.log.unshift({ d: S.day, msg, type });
  if (S.log.length > 200) S.log.pop();
  const t = document.createElement('div');
  t.className = `toast ${type}`; t.textContent = msg;
  document.getElementById('toasts').appendChild(t);
  setTimeout(() => t.remove(), 5000);
}
function pay(cost) { if (S.cash < cost) { log('Kas tidak cukup.', 'bad'); return false; } S.cash -= cost; return true; }

// ---------- world
const world = createWorld(document.getElementById('view'), t => {
  if (S.phase !== 'site') return;
  const n = S.sites.findIndex(s => t.x >= s.x && t.z >= s.z && t.x < s.x + CAMPUS_SIZE && t.z < s.z + CAMPUS_SIZE);
  if (n >= 0) { S.sel = n; world.showSites(S.sites, n); render(true); }
});
S.sites = findSites();
world.showSites(S.sites, 0);
const facList = () => FAC.filter(f => S.fac[f.id]).map(f => ({ slot: f.slot, state: S.fac[f.id].state, progress: 1 - S.fac[f.id].left / f.days }));

function buySite(n) {
  const s = S.sites[n], info = SITE[s.type], price = Math.round(AREA * info.ppm);
  if (!pay(price)) return;
  S.site = { ...s, ...info, price };
  reserveCampus(s);
  world.showSites([]);
  world.focus(s.x + CAMPUS_SIZE / 2, s.z + CAMPUS_SIZE / 2, 14);
  S.phase = 'run'; tab = 'ikhtisar';
  log(`Lahan ${info.name} seluas ${(AREA / 10000).toFixed(1)} ha dibeli seharga ${fmt(price)}.`, 'good');
  log('Mulai urus Akta Pendirian Yayasan di tab Perizinan.');
}

// ---------- actions
const ACT = {
  site: n => { S.sel = +n; world.showSites(S.sites, S.sel); const s = S.sites[S.sel]; world.focus(s.x + 6, s.z + 6); },
  buy: n => buySite(+n),
  permit: id => {
    const p = PERMITS.find(p => p.id === id);
    if (!pay(p.cost)) return;
    S.permits[id] = { status: 'proses', left: p.days };
    log(`Berkas ${p.name} diajukan ke ${p.by}.`);
  },
  build: id => {
    const f = FAC.find(f => f.id === id);
    if (!pay(f.cost)) return;
    S.fac[id] = { state: 'building', left: f.days };
    world.setFacilities(facList());
    log(`Pembangunan ${f.name} dimulai (${f.days} hari).`);
  },
  plan: id => { S.prodi[id] ? delete S.prodi[id] : (S.prodi[id] = { state: 'rencana' }); },
  prodi: id => {
    const p = PRODI.find(p => p.id === id);
    if (!pay(300)) return;
    S.prodi[id] = { state: 'proses', left: 90 };
    log(`Usulan pembukaan prodi ${p.name} diajukan (90 hari).`);
  },
  loan: () => { S.cash += 20000; S.loan += 20000; log('Pinjaman bank Rp 20 M cair (bunga 1%/bulan).'); },
  repay: () => { if (S.loan >= 20000 && pay(20000)) { S.loan -= 20000; log('Pinjaman Rp 20 M dilunasi.', 'good'); } },
  speed: v => { S.speed = +v; },
  tab: t => { tab = t; },
  rot: d => world.rotate(+d),
  zoom: f => world.zoomBy(+f),
  start: () => document.getElementById('intro').remove(),
};

// ---------- simulation
function resolvePermit(p) {
  let fail = p.fail;
  if (p.id === 'amdal' && S.site.type !== 'kota') fail += 0.1;
  if (rnd() < fail) {
    S.permits[p.id] = { status: 'tolak' };
    log(`${p.name} ditolak. Perbaiki berkas dan ajukan ulang.`, 'bad');
    return;
  }
  S.permits[p.id] = { status: 'ok' };
  log(`${p.name} disetujui.`, 'good');
  if (p.id === 'izinpt') {
    for (const pr of planned()) S.prodi[pr.id] = { state: 'aktif' };
    S.akred = { grade: 'Baik', next: S.day + 720 };
    addCampusTown();
    log('Kampus resmi beroperasi. Penerimaan mahasiswa baru dibuka setiap Agustus.', 'good');
  }
}
function hire() {
  if (!S.pol.rekrut) return;
  const mhs = students(), need = Math.max(5 * planned().length, Math.ceil(mhs / S.pol.rasio)) - dosenTotal();
  const gf = GAJI[S.pol.gaji] / 12, s3only = S.pol.kualifikasi === 'S3';
  if (need > 0) {
    const pool = Math.round((1 + S.rep / 20) * gf * (0.5 + rnd()) * (s3only ? 0.6 : 1.6));
    const n = Math.min(need, pool);
    for (let k = 0; k < n; k++) (s3only || rnd() < clamp(0.12 + 0.3 * gf * S.rep / 100, 0, 0.7)) ? S.dosen.s3++ : S.dosen.s2++;
    S.cash -= n * 5;
  }
  const tNeed = 3 + Math.ceil(dosenTotal() * 0.6 + mhs / 80) - S.tendik;
  if (tNeed > 0) S.tendik += Math.min(tNeed, 3);
}
function monthTick() {
  const P = S.pol, mhs = students(), D = dosenTotal(), ratio = mhs / Math.max(1, D), s3 = D ? S.dosen.s3 / D : 0;
  const has = id => built(id) ? 1 : 0;
  // finances
  const rev = mhs * UKT[P.ukt] / 6 * (1 - P.beasiswa / 100) + has('asrama') * Math.min(mhs, 800) * 0.8 + has('technopark') * (150 + S.com * 5);
  const upkeep = FAC.reduce((s, f) => s + (built(f.id) ? f.upkeep : 0), 0);
  const cost = D * GAJI[P.gaji] + S.dosen.s3 * 4 + S.tendik * 6 + upkeep + (operational() ? P.dana : 0)
    + (P.mbkm ? mhs * 0.05 : 0) + (P.ppks ? 15 : 0) + (P.antiPlagiat ? 10 : 0) + S.loan * 0.01;
  S.cash += rev - cost;
  S.lastRev = rev; S.lastCost = cost;
  if (operational()) {
    const fPend = P.dana * P.pend / 100, fPen = P.dana * P.pen / 100, fPeng = P.dana * P.peng / 100;
    const qT = 20 + 30 * clamp(25 / Math.max(ratio, 1), 0, 1) + 15 * s3 + 6 * has('perpus') + 6 * has('lab') + 3 * has('auditorium')
      + 10 * clamp(fPend / (mhs * 0.05 + 1), 0, 1) + (P.mbkm ? 5 : 0) + (P.antiPlagiat ? 3 : 0);
    const pubs = D * (0.03 + 0.12 * s3) * (0.5 + clamp(fPen / (D * 3 + 1), 0, 1.5)) * (has('riset') ? 1.5 : 1) * (has('lab') ? 1.2 : 1) * (P.wajibPub ? 1.4 : 1) * (0.7 + rnd() * 0.6);
    S.pubs.push(pubs); if (S.pubs.length > 12) S.pubs.shift(); S.pubTotal += pubs;
    const rT = clamp(100 * S.pubs.reduce((a, b) => a + b, 0) / (D * 1.2 + 5), 0, 100);
    const cT = clamp(10 + fPeng / 8 + 15 * has('technopark') + 8 * has('klinik') + 5 * has('masjid') + S.alumni / 200, 0, 100);
    const satT = 35 + 8 * has('kantin') + 6 * has('asrama') + 6 * has('lapangan') + 4 * has('klinik') + 4 * has('masjid')
      + { rendah: 10, sedang: 3, tinggi: -8 }[P.ukt] + P.beasiswa * 0.3 + S.q * 0.15 + (P.ormawa === 'bebas' ? 6 : -4) - (ratio > 40 ? 8 : 0) + (S.site.type === 'pantai' ? 5 : 0);
    S.q += (qT - S.q) * 0.15; S.res += (rT - S.res) * 0.15; S.com += (cT - S.com) * 0.15; S.sat += (clamp(satT, 0, 100) - S.sat) * 0.15;
    const repT = 0.3 * S.q + 0.25 * S.res + 0.15 * S.com + 0.15 * S.sat + 0.15 * AKRED[S.akred.grade] + Math.log10(S.alumni + 1) * 3;
    S.rep += (clamp(repT, 0, 100) - S.rep) * 0.08;
    if (rnd() < S.res / 250) { const g = Math.round(200 + rnd() * S.res * 30); S.cash += g; log(`Dosen memenangkan hibah penelitian ${fmt(g)}.`, 'good'); }
    if (built('technopark') && rnd() < S.com / 300) { S.cash += 400; log('Kerja sama industri baru ditandatangani (+Rp 400 jt).', 'good'); }
    for (const c of S.cohorts) c.n -= Math.round(c.n * 0.003 * (100 - S.sat) / 50);
  }
  // dosen resign
  const resign = Math.round(D * { rendah: 0.02, standar: 0.006, tinggi: 0.002 }[P.gaji] * (P.wajibPub ? 1.5 : 1) + (rnd() < 0.3 ? 1 : 0) * (D > 10 ? 1 : 0));
  for (let k = 0; k < resign && dosenTotal() > 0; k++) (S.dosen.s2 && rnd() < 0.7) || !S.dosen.s3 ? S.dosen.s2-- : S.dosen.s3--;
  if (resign >= 3) log(`${resign} dosen mengundurkan diri bulan ini.`, 'bad');
  S.hist.push({ cash: S.cash, mhs, rep: S.rep });
  if (S.hist.length > 120) S.hist.shift();
  S.red = S.cash < 0 ? S.red + 1 : 0;
  if (S.red === 3) log('Kas negatif 3 bulan berturut-turut. Yayasan terancam bangkrut!', 'bad');
  if (S.red >= 6) { S.over = true; S.speed = 0; log('Yayasan bangkrut. Permainan berakhir.', 'bad'); }
}
function pmb() {
  const act = active(); if (!act.length) return;
  const room = (built('kuliah') ? 2000 : 0) + (built('auditorium') ? 500 : 0) - students();
  const uktF = { rendah: 1.4, sedang: 1, tinggi: 0.6 }[S.pol.ukt];
  const akF = { Unggul: 1.6, 'Baik Sekali': 1.25, Baik: 1, 'Tidak Terakreditasi': 0.15, '—': 0.8 }[S.akred.grade];
  const daftar = Math.round(act.reduce((s, p) => s + p.demand, 0) * 180 * (0.4 + S.rep / 50) * uktF * akF * S.site.demand
    * clamp(0.6 + getCityPop() / 40000, 0.6, 1.6) * (0.8 + rnd() * 0.4) * (1 + S.pol.beasiswa / 100));
  const terima = Math.max(0, Math.min(S.pol.kuota, room, Math.round(daftar * 0.7)));
  S.cohorts.push({ year: (S.day / 360) | 0, n: terima });
  log(`PMB: ${daftar.toLocaleString('id-ID')} pendaftar, ${terima.toLocaleString('id-ID')} diterima${terima < Math.round(daftar * 0.7) ? ' (terbatas kuota/kapasitas)' : ''}.`, 'good');
}
function wisuda() {
  const y = (S.day / 360) | 0; let g = 0, out = 0;
  for (const c of S.cohorts) {
    const age = y - c.year;
    if (age >= 4) { const n = Math.round(c.n * (0.45 + S.q / 200)); c.n -= n; g += n; }
    if (age >= 7) { out += c.n; c.n = 0; }
  }
  S.cohorts = S.cohorts.filter(c => c.n > 0);
  S.alumni += g;
  if (g) log(`Wisuda: ${g.toLocaleString('id-ID')} lulusan${out ? `, ${out} mahasiswa DO karena melewati masa studi` : ''}.`, 'good');
}
function accreditation() {
  const D = dosenTotal(), mhs = students();
  let score = 0.25 * S.q + 0.25 * S.res + 0.15 * S.com + 0.15 * (mhs ? clamp(100 * 30 / (mhs / Math.max(D, 1)), 0, 100) : 50)
    + 0.1 * (FAC.filter(f => built(f.id)).length / FAC.length * 100) + 0.1 * (S.cash > 0 ? 100 : 30);
  if (!S.pol.ppks) score -= 15;
  const grade = score >= 80 ? 'Unggul' : score >= 65 ? 'Baik Sekali' : score >= 45 ? 'Baik' : 'Tidak Terakreditasi';
  S.akred = { grade, next: S.day + 720, score };
  log(`Hasil akreditasi institusi: ${grade} (skor ${score.toFixed(0)}).`, grade === 'Tidak Terakreditasi' ? 'bad' : 'good');
}
function events() {
  const P = S.pol, r = rnd();
  if (S.sat < 45 && r < 0.004) { S.rep -= 5; S.sat -= 3; log('Demo mahasiswa memprotes biaya dan fasilitas kampus.', 'bad'); }
  else if (!P.antiPlagiat && r < 0.006) { S.rep -= 6; log('Kasus plagiarisme skripsi viral di media sosial.', 'bad'); }
  else if (!P.ppks && r < 0.008) { S.rep -= 10; S.sat -= 10; log('Kasus kekerasan seksual mencuat, kampus dikritik tidak punya Satgas PPKS.', 'bad'); }
  else if (P.ormawa === 'bebas' && r < 0.003 * S.q / 50) { S.rep += 3; log('Tim mahasiswa juara lomba tingkat nasional!', 'good'); }
  else if (built('lapangan') && r < 0.0015) { S.rep += 2; log('Atlet kampus meraih medali di kejuaraan antar-universitas.', 'good'); }
  else if (S.site.type === 'pantai' && r < 0.0012) { S.cash -= 600; log('Banjir rob merendam area kampus. Biaya perbaikan Rp 600 jt.', 'bad'); }
  else if (S.site.type === 'bukit' && r < 0.001) { S.cash -= 500; log('Longsor kecil di lereng kampus. Biaya penanganan Rp 500 jt.', 'bad'); }
}
function dayTick() {
  S.day++;
  tickCity(operational() ? 18 : 12);
  for (const p of PERMITS) { const st = S.permits[p.id]; if (st?.status === 'proses' && --st.left <= 0) resolvePermit(p); }
  let facChanged = false;
  for (const f of FAC) {
    const st = S.fac[f.id];
    if (st?.state !== 'building') continue;
    st.left--; facChanged = true;
    if (st.left <= 0) { st.state = 'built'; log(`${f.name} selesai dibangun.`, 'good'); }
  }
  if (facChanged) world.setFacilities(facList());
  for (const p of PRODI) { const st = S.prodi[p.id]; if (st?.state === 'proses' && --st.left <= 0) { st.state = 'aktif'; log(`Prodi ${p.name} resmi dibuka.`, 'good'); } }
  if (S.day % 7 === 0) hire();
  if (S.day % 30 === 0) monthTick();
  if (operational()) {
    const doy = S.day % 360;
    if (doy === 210) pmb();
    if (doy === 300) wisuda();
    if (S.day >= S.akred.next) accreditation();
    events();
  }
}

// ---------- UI
let tab = 'lokasi';
const $ = s => document.querySelector(s);
const bar = (v, c = '') => `<div class="meter ${c}"><i style="width:${clamp(v, 0, 100)}%"></i></div>`;
const btn = (act, arg, text, dis = false, cls = '') => `<button class="${cls}" data-act="${act}" data-arg="${arg}" ${dis ? 'disabled' : ''}>${text}</button>`;
function spark(vals, color) {
  if (vals.length < 2) return '<p class="dim">Data muncul setelah beberapa bulan.</p>';
  const mn = Math.min(...vals), mx = Math.max(...vals), w = 300, h = 60;
  const pts = vals.map((v, i) => `${(i / (vals.length - 1) * w).toFixed(1)},${(h - (v - mn) / ((mx - mn) || 1) * h).toFixed(1)}`).join(' ');
  return `<svg viewBox="0 0 ${w} ${h}" class="spark" role="img" aria-label="grafik"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2"/></svg>`;
}
function nextStep() {
  const ok = id => S.permits[id]?.status === 'ok';
  for (const p of PERMITS) {
    if (ok(p.id)) continue;
    if (p.id === 'slf' && !(built('rektorat') && built('kuliah'))) return ok('pbg') ? 'Bangun Gedung Rektorat dan Gedung Kuliah (tab Fasilitas).' : 'Lanjutkan perizinan sampai PBG terbit.';
    if (p.id === 'izinpt') {
      if (planned().length < 3) return 'Pilih minimal 3 program studi rencana di tab Akademik.';
      if (!built('perpus')) return 'Bangun Perpustakaan (tab Fasilitas).';
      if (dosenTotal() < 5 * planned().length) return `Tunggu rekrutmen dosen: ${dosenTotal()}/${5 * planned().length} (tab SDM).`;
    }
    return S.permits[p.id]?.status === 'proses' ? `Menunggu ${p.name} diproses…` : `Ajukan ${p.name} (tab Perizinan).`;
  }
  return 'Kampus beroperasi. Atur kebijakan, tridarma, dan fasilitas untuk naik akreditasi.';
}
const TABS = { ikhtisar: 'Ikhtisar', izin: 'Perizinan', akademik: 'Akademik', aturan: 'Aturan', sdm: 'SDM', tridarma: 'Tridarma', fasilitas: 'Fasilitas', keuangan: 'Keuangan', log: 'Kabar' };
const VIEWS = {
  lokasi() {
    return `<h2>Pilih lokasi kampus</h2><p class="dim">Tiga lahan tersedia (±${(AREA / 10000).toFixed(1)} ha). Klik kartu atau penanda di peta.</p>` +
      S.sites.map((s, n) => {
        const i = SITE[s.type], price = Math.round(AREA * i.ppm);
        return `<div class="card ${n === S.sel ? 'sel' : ''}" data-act="site" data-arg="${n}">
          <h3><span class="badge b${n}">${'ABC'[n]}</span> ${i.name}</h3>
          <dl><dt>Harga lahan</dt><dd>${fmt(price)}</dd><dt>Jarak ke pusat kota</dt><dd>${(s.dCity * 0.3).toFixed(1)} km</dd>
          <dt>Minat calon mahasiswa</dt><dd>×${i.demand}</dd><dt>Risiko bencana</dt><dd>${i.risk}</dd></dl>
          <p>${i.note}</p>${n === S.sel ? btn('buy', n, 'Beli lahan ini', S.cash < price, 'primary') : ''}</div>`;
      }).join('');
  },
  ikhtisar() {
    const mhs = students(), D = dosenTotal();
    return `<div class="next"><b>Langkah berikutnya</b><br>${nextStep()}</div>
      <h3>Indikator</h3>
      <label>Reputasi ${S.rep.toFixed(0)}</label>${bar(S.rep)}
      <label>Mutu pendidikan ${S.q.toFixed(0)}</label>${bar(S.q)}
      <label>Kinerja penelitian ${S.res.toFixed(0)}</label>${bar(S.res)}
      <label>Dampak pengabdian ${S.com.toFixed(0)}</label>${bar(S.com)}
      <label>Kepuasan mahasiswa ${S.sat.toFixed(0)}</label>${bar(S.sat, S.sat < 45 ? 'warn' : '')}
      <dl><dt>Mahasiswa aktif</dt><dd>${mhs.toLocaleString('id-ID')}</dd><dt>Dosen (S2/S3)</dt><dd>${S.dosen.s2}/${S.dosen.s3}</dd>
      <dt>Rasio dosen:mahasiswa</dt><dd>1:${D ? Math.round(mhs / D) : 0}</dd><dt>Alumni</dt><dd>${S.alumni.toLocaleString('id-ID')}</dd>
      <dt>Publikasi total</dt><dd>${Math.round(S.pubTotal)}</dd><dt>Akreditasi</dt><dd>${S.akred.grade}${S.akred.next ? ` · berikutnya ${dateStr(S.akred.next)}` : ''}</dd>
      <dt>Penduduk kota</dt><dd>${getCityPop().toLocaleString('id-ID')}</dd></dl>`;
  },
  izin() {
    return `<p class="dim">Urutan mengikuti alur perizinan nyata (disederhanakan). Berkas bisa ditolak dan diajukan ulang.</p>` + PERMITS.map(p => {
      const st = S.permits[p.id], reqOk = p.req.every(r => S.permits[r]?.status === 'ok'), needOk = !p.need || p.need();
      const status = st?.status === 'ok' ? '<span class="ok">Disetujui</span>' : st?.status === 'proses' ? `<span class="wait">Diproses · ${st.left} hari</span>` : st?.status === 'tolak' ? '<span class="bad">Ditolak</span>' : '<span class="dim">Belum diajukan</span>';
      const can = (!st || st.status === 'tolak') && reqOk && needOk;
      return `<div class="row"><div><b>${p.name}</b><br><small>${p.by} · ${fmt(p.cost)} · ${p.days} hari</small>
        ${p.req.length ? `<br><small class="dim">Syarat: ${p.req.map(r => PERMITS.find(x => x.id === r).name).join(', ')}</small>` : ''}
        ${p.needText ? `<br><small class="${needOk ? 'ok' : 'bad'}">${p.needText}</small>` : ''}<br>${status}</div>
        ${st?.status === 'ok' || st?.status === 'proses' ? '' : btn('permit', p.id, st?.status === 'tolak' ? 'Ajukan ulang' : 'Ajukan', !can)}</div>`;
    }).join('');
  },
  akademik() {
    const pre = !operational();
    return `<p class="dim">${pre ? 'Pilih program studi yang diusulkan bersama Izin Pendirian PT (minimal 3, tiap prodi butuh 5 dosen tetap).' : 'Buka prodi baru: Rp 300 jt, 90 hari, butuh fasilitas pendukung.'}</p>` + PRODI.map(p => {
      const st = S.prodi[p.id], facOk = p.needs.every(built);
      const needs = p.needs.length ? `<br><small class="${facOk ? 'ok' : 'bad'}">Butuh: ${p.needs.map(n => FAC.find(f => f.id === n).name).join(', ')}</small>` : '';
      let right;
      if (pre) right = btn('plan', p.id, st ? 'Batalkan' : 'Usulkan', S.permits.izinpt?.status === 'proses', st ? '' : 'primary');
      else right = st?.state === 'aktif' ? '<span class="ok">Aktif</span>' : st?.state === 'proses' ? `<span class="wait">${st.left} hari</span>` : btn('prodi', p.id, 'Buka', !facOk);
      return `<div class="row"><div><b>${p.name}</b><br><small>Minat ×${p.demand}${st?.state === 'rencana' ? ' · <span class="wait">Rencana</span>' : ''}</small>${needs}</div>${right}</div>`;
    }).join('');
  },
  aturan() {
    const P = S.pol;
    const sel = (k, opts) => `<select data-pol="${k}">${opts.map(o => `<option ${P[k] === o ? 'selected' : ''}>${o}</option>`).join('')}</select>`;
    const rng = (k, mn, mx, st, suf = '') => `<input type="range" data-pol="${k}" min="${mn}" max="${mx}" step="${st}" value="${P[k]}"><output>${P[k]}${suf}</output>`;
    const chk = (k, t) => `<label class="chk"><input type="checkbox" data-pol="${k}" ${P[k] ? 'checked' : ''}> ${t}</label>`;
    return `<h3>Biaya & penerimaan</h3>
      <label>UKT per semester (${fmt(UKT[P.ukt])})</label>${sel('ukt', ['rendah', 'sedang', 'tinggi'])}
      <label>Kuota mahasiswa baru per tahun</label>${rng('kuota', 100, 3000, 50)}
      <label>Porsi beasiswa (% potongan UKT)</label>${rng('beasiswa', 0, 40, 1, '%')}
      <h3>Tata kelola & etika</h3>
      ${chk('ppks', 'Satgas Pencegahan & Penanganan Kekerasan (wajib regulasi)')}
      ${chk('antiPlagiat', 'Sistem cek plagiarisme untuk skripsi & publikasi')}
      ${chk('mbkm', 'Program magang & pertukaran (MBKM)')}
      ${chk('wajibPub', 'Wajib publikasi bagi dosen (riset naik, dosen lebih mudah resign)')}
      <label>Organisasi mahasiswa</label>${sel('ormawa', ['bebas', 'terbatas'])}`;
  },
  sdm() {
    const P = S.pol, mhs = students(), target = Math.max(5 * planned().length, Math.ceil(mhs / P.rasio));
    return `<dl><dt>Dosen</dt><dd>${dosenTotal()} / target ${target}</dd><dt>Dosen S3</dt><dd>${S.dosen.s3}</dd><dt>Tenaga kependidikan</dt><dd>${S.tendik}</dd></dl>
      <p class="dim">Pelamar datang sendiri tiap minggu, jumlahnya tergantung reputasi dan gaji. Kamu hanya menentukan kebijakannya.</p>
      <label class="chk"><input type="checkbox" data-pol="rekrut" ${P.rekrut ? 'checked' : ''}> Rekrutmen dibuka</label>
      <label>Tingkat gaji dosen (${fmt(GAJI[P.gaji])}/bulan)</label><select data-pol="gaji">${['rendah', 'standar', 'tinggi'].map(o => `<option ${P.gaji === o ? 'selected' : ''}>${o}</option>`).join('')}</select>
      <label>Kualifikasi minimal</label><select data-pol="kualifikasi">${['S2', 'S3'].map(o => `<option ${P.kualifikasi === o ? 'selected' : ''}>${o}</option>`).join('')}</select>
      <label>Target rasio dosen : mahasiswa</label><input type="range" data-pol="rasio" min="15" max="60" step="1" value="${P.rasio}"><output>1:${P.rasio}</output>`;
  },
  tridarma() {
    const P = S.pol;
    return `<label>Dana tridarma per bulan</label><input type="range" data-pol="dana" min="0" max="3000" step="50" value="${P.dana}"><output>${fmt(P.dana)}</output>
      <h3>Alokasi</h3>
      <label>Pendidikan</label><input type="range" data-pol="pend" min="0" max="100" value="${P.pend}"><output>${P.pend}%</output>
      <label>Penelitian</label><input type="range" data-pol="pen" min="0" max="100" value="${P.pen}"><output>${P.pen}%</output>
      <label>Pengabdian masyarakat</label><input type="range" data-pol="peng" min="0" max="100" value="${P.peng}"><output>${P.peng}%</output>
      <p class="dim">Alokasi otomatis dinormalisasi menjadi 100%. Dana mulai terpakai setelah izin PT terbit.</p>
      <dl><dt>Publikasi 12 bulan terakhir</dt><dd>${Math.round(S.pubs.reduce((a, b) => a + b, 0))}</dd><dt>Publikasi total</dt><dd>${Math.round(S.pubTotal)}</dd></dl>`;
  },
  fasilitas() {
    const pbg = S.permits.pbg?.status === 'ok';
    return `${pbg ? '' : '<p class="bad">Pembangunan butuh PBG terbit lebih dulu.</p>'}` + FAC.map(f => {
      const st = S.fac[f.id];
      const right = st?.state === 'built' ? '<span class="ok">Beroperasi</span>' : st ? `<span class="wait">${st.left} hari</span>` : btn('build', f.id, 'Bangun', !pbg || S.cash < f.cost);
      return `<div class="row"><div><b>${f.name}</b><br><small>${fmt(f.cost)} · ${f.days} hari · perawatan ${fmt(f.upkeep)}/bln</small><br><small class="dim">${f.info}</small></div>${right}</div>`;
    }).join('');
  },
  keuangan() {
    return `<dl><dt>Kas</dt><dd>${fmt(S.cash)}</dd><dt>Pendapatan bulan lalu</dt><dd>${fmt(S.lastRev ?? 0)}</dd><dt>Pengeluaran bulan lalu</dt><dd>${fmt(S.lastCost ?? 0)}</dd><dt>Pinjaman</dt><dd>${fmt(S.loan)}</dd></dl>
      <h3>Kas</h3>${spark(S.hist.map(h => h.cash), '#2f9e44')}
      <h3>Mahasiswa</h3>${spark(S.hist.map(h => h.mhs), '#1971c2')}
      <h3>Reputasi</h3>${spark(S.hist.map(h => h.rep), '#e8590c')}
      <div class="btns">${btn('loan', 0, 'Pinjam Rp 20 M')}${btn('repay', 0, 'Lunasi Rp 20 M', S.loan < 20000 || S.cash < 20000)}</div>`;
  },
  log() { return S.log.map(l => `<p class="${l.type}"><small>${dateStr(l.d)}</small><br>${l.msg}</p>`).join('') || '<p class="dim">Belum ada kabar.</p>'; },
};
let lastHtml = '';
function render(force) {
  const P = S.pol, mhs = students();
  $('#hud').innerHTML = `<span><b>${fmt(S.cash)}</b> kas</span><span><b>${mhs.toLocaleString('id-ID')}</b> mahasiswa</span>
    <span><b>${dosenTotal()}</b> dosen</span><span>reputasi <b>${S.rep.toFixed(0)}</b></span><span>akreditasi <b>${S.akred.grade}</b></span><span>${dateStr(S.day)}</span>
    <span class="speed">${[[0, '❚❚'], [1, '▶'], [2, '▶▶'], [3, '▶▶▶']].map(([v, t]) => `<button data-act="speed" data-arg="${v}" class="${S.speed === v ? 'on' : ''}" aria-label="kecepatan ${v}">${t}</button>`).join('')}</span>`;
  $('#tabs').innerHTML = S.phase === 'site' ? '' : Object.entries(TABS).map(([k, t]) => `<button data-act="tab" data-arg="${k}" class="${tab === k ? 'on' : ''}">${t}</button>`).join('');
  const busy = document.activeElement?.closest?.('#body') && /INPUT|SELECT/.test(document.activeElement.tagName);
  if (busy && !force) return;
  const html = VIEWS[tab]();
  if (html !== lastHtml || force) { $('#body').innerHTML = html; lastHtml = html; }
  if (S.over) $('#body').insertAdjacentHTML('afterbegin', '<p class="bad"><b>Permainan berakhir: yayasan bangkrut.</b> Muat ulang halaman untuk mulai lagi.</p>');
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (!b || b.disabled) return;
  ACT[b.dataset.act]?.(b.dataset.arg);
  render(true);
});
$('#body').addEventListener('input', e => {
  const k = e.target.dataset.pol; if (!k) return;
  const P = S.pol;
  P[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.type === 'range' ? +e.target.value : e.target.value;
  if (['pend', 'pen', 'peng'].includes(k)) { // keep allocation at 100%
    const others = ['pend', 'pen', 'peng'].filter(x => x !== k), rest = 100 - P[k], sum = P[others[0]] + P[others[1]] || 1;
    P[others[0]] = Math.round(P[others[0]] / sum * rest); P[others[1]] = rest - P[others[0]];
  }
  if (e.target.type === 'range' || e.target.tagName === 'SELECT') render(true);
});

const RATE = [0, 3, 10, 30]; // days per second
let acc = 0, prev = performance.now(), lastUi = 0;
function loop(now) {
  if (S.phase === 'run' && !S.over) {
    acc += (now - prev) / 1000 * RATE[S.speed];
    let n = 0;
    while (acc >= 1 && n++ < 40) { acc -= 1; dayTick(); }
  }
  prev = now;
  if (now - lastUi > 250) { render(); lastUi = now; }
  requestAnimationFrame(loop);
}
render(true); requestAnimationFrame(loop);

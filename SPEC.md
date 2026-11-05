# Spesifikasi: TheoTown-style City Builder (Three.js / WebGL)

## 0. Catatan Penting
- TheoTown adalah game komersial milik Lukas Hermann. Aset (sprite, suara, nama bangunan, UI) dilindungi hak cipta. "1:1" di sini berarti **kesetaraan mekanik dan pengalaman bermain**, bukan menyalin aset. Semua aset harus dibuat sendiri/CC0 (mis. Kenney.nl).
- TheoTown aslinya 2D isometrik. Versi ini merender dunia dengan kamera ortografis isometrik 3D di Three.js, sehingga tampilan mirip tetapi bisa diputar dan di-zoom.

## 1. Tujuan & Ruang Lingkup
Simulasi pembangunan kota: zonasi, jalan, utilitas, layanan publik, ekonomi, bencana, dan save/load. Berjalan di browser desktop dan mobile (touch).

**MVP (v0.1):** grid, jalan, zona R/C/I, listrik, air, pajak, populasi, save/load.
**v0.2:** layanan (polisi, pemadam, kesehatan, pendidikan), kebahagiaan, bencana, kereta/bus.
**v0.3:** plugin/mod JSON, mode sandbox, achievement, multi-kota.

## 2. Tech Stack
| Area | Pilihan |
|---|---|
| Render | Three.js (WebGL2), `OrthographicCamera` |
| Bahasa | TypeScript, Vite |
| State | ECS ringan (bitecs) atau class sederhana |
| UI | HTML/CSS overlay (bukan canvas) |
| Simulasi | Web Worker untuk tick simulasi |
| Penyimpanan | IndexedDB (save), LocalStorage (setting) |
| Audio | Howler.js / WebAudio |
| Tes | Vitest (simulasi), Playwright (e2e) |

## 3. Arsitektur
```
src/
  core/        game loop, event bus, time, RNG (seeded)
  world/       grid, tile, terrain, chunk
  sim/         worker: demand, traffic, utilities, economy, disasters
  render/      scene, camera, instanced meshes, picking, effects
  input/       mouse, touch, keyboard, tool controller
  ui/          toolbar, panel, dialog, minimap, budget
  data/        buildings.json, zones.json, balance.json
  save/        serializer, IndexedDB, versioning
  audio/
```
- **Pemisahan:** sim (worker, tick tetap) ←postMessage→ render (main thread, rAF). Render hanya membaca snapshot.
- **Tick:** 1 tick sim = 1 hari game (kecepatan: pause, 1x, 2x, 4x).

## 4. Dunia & Grid
- Ukuran peta: 64², 128², 256², 512² (pilihan saat membuat kota).
- Tile: `{ height, terrain(grass|water|sand|forest), zoneId, buildingId, roadMask, power, water, pollution, crime, happiness }` disimpan di typed array (struct-of-arrays).
- Chunk 16×16 untuk culling dan rebuild mesh parsial.
- Generator terrain: simplex noise + seed, air, hutan, bukit rendah. Opsi peta kosong/rata.
- Koordinat: tile (x,z) → dunia `(x*TILE, h*STEP, z*TILE)`.

## 5. Rendering (Three.js)
- **Kamera:** ortografis, sudut isometrik default (azimuth 45°, elevasi ~35.26°). Rotasi 90° snap (Q/E) + rotasi bebas opsional. Zoom roda mouse/pinch. Pan: drag kanan/dua jari.
- **Terrain:** satu mesh per chunk, vertex color per tipe; air = plane dengan shader sederhana (gelombang, transparansi).
- **Bangunan:** `InstancedMesh` per tipe model (low-poly glTF/GLB). Level/tahap pertumbuhan = model berbeda.
- **Jalan:** auto-tiling via bitmask 4 arah (lurus, tikungan, T, perempatan, ujung) ke model/tekstur; jembatan di atas air; penanda kemiringan.
- **Zona:** overlay warna transparan (R hijau, C biru, I kuning) + grid.
- **Cahaya:** DirectionalLight + shadow map (cascade tunggal), siklus siang-malam, lampu jendela malam via emissive.
- **Efek:** asap, api, hujan/salju (Points), kendaraan dan warga animasi (instanced, batas jumlah).
- **Picking:** raycast ke bidang tanah → tile; hover highlight + ghost bangunan saat menaruh.
- **Performa:** target 60 FPS di 256² pada laptop menengah; 30 FPS mobile. Frustum culling per chunk, LOD sederhana, atlas tekstur, batas draw call < 300.
- **Pengaturan grafis:** Low/Med/High (shadow, resolusi, partikel).

## 6. Alat Pemain (Toolbar)
1. Pilih/Info (klik tile untuk detail)
2. Jalan (drag untuk menarik garis), Jalan raya, Rel, Stasiun
3. Zona: Residensial, Komersial, Industri (3 kepadatan: rendah/sedang/tinggi), Agrikultur
4. Utilitas: Pembangkit listrik (batu bara, surya, angin, nuklir), Menara air, Pompa, Kabel/pipa (opsional: cakupan radius)
5. Layanan: Polisi, Pemadam, Rumah sakit, Sekolah, Universitas, Taman, Perpustakaan, Tempat sampah
6. Dekorasi: pohon, plaza, monumen
7. Terraform: naik/turun/ratakan, tanam/bersihkan pohon
8. Bulldoze
9. Undo/Redo (stack perintah), Pause/kecepatan
10. Peta data (overlay): listrik, air, polusi, kriminalitas, kebahagiaan, nilai tanah, lalu lintas

## 7. Aturan Simulasi
### 7.1 Zona & Pertumbuhan
- Bangunan hanya tumbuh pada zona yang **terhubung jalan** (jarak ≤ 3 tile ke jalan) dan **dialiri listrik**.
- Permintaan (demand) R/C/I dihitung global: R bergantung pada lapangan kerja & kebahagiaan; C pada populasi; I pada tenaga kerja.
- Tiap tick, tile zona acak dicek: peluang tumbuh/naik level/menurun/ditinggalkan berdasarkan demand, nilai tanah, polusi, kriminalitas, layanan.
- Bangunan level 1–5 per jenis zona dengan kapasitas penduduk/pekerja berbeda.

### 7.2 Utilitas
- Listrik: BFS dari pembangkit melalui tile bangunan/jalan/kabel; kapasitas MW vs kebutuhan, kekurangan → brownout semua zona.
- Air: serupa, dari menara/pompa lewat pipa; kebutuhan per kapita.
- Sampah: kapasitas tempat sampah/insinerator; penumpukan menurunkan kebahagiaan.

### 7.3 Lalu Lintas
- Graf jalan; kendaraan dihasilkan sebanding kepadatan zona; A* ke tujuan terdekat; kemacetan = jumlah kendaraan/kapasitas segmen; memengaruhi polusi, kebahagiaan, dan pertumbuhan.

### 7.4 Layanan
- Tiap bangunan layanan punya radius dan kapasitas efek: kriminalitas (polisi), api (pemadam), kesehatan, pendidikan. Cakupan dihitung dengan distance field per tick lambat (tiap 10 tick).

### 7.5 Polusi, Nilai Tanah, Kebahagiaan
- Polusi udara/suara dari industri, jalan raya, pembangkit; difusi dengan blur kernel.
- Nilai tanah = f(taman, layanan, air, kedekatan pusat) − polusi − kriminalitas.
- Kebahagiaan = rata-rata tertimbang: pekerjaan, utilitas, layanan, polusi, pajak, kemacetan. Rendah → warga pindah.

### 7.6 Ekonomi
- Pendapatan: pajak R/C/I (tarif 0–20% per kategori), bisnis khusus, hadiah/ekspansi.
- Pengeluaran: biaya layanan, pemeliharaan jalan/rel, bunga pinjaman.
- Anggaran bulanan; saldo negatif beruntun → layanan dimatikan; pinjaman bank (opsi).
- Uang awal tergantung mode (Kreatif tak terbatas / Normal).

### 7.7 Bencana
- Kebakaran (menyebar antar tile, dipadamkan pemadam), gempa, banjir, tornado, meteor, monster (opsional). Dapat dimatikan di pengaturan; pemicu manual di sandbox.

### 7.8 Populasi & Tujuan
- Populasi = Σ kapasitas bangunan R terisi. Milestone populasi membuka bangunan baru (unlock tree) dan memberi hadiah.
- Quest/permintaan walikota (opsional v0.3).

## 9. Data Driven (JSON)
`buildings.json` contoh:
```json
{
  "id": "res_low_1",
  "type": "residential",
  "size": [1, 1],
  "model": "models/res_low_1.glb",
  "cost": 100,
  "upkeep": 0,
  "capacity": 8,
  "power": 1,
  "water": 1,
  "level": 1,
  "unlockPop": 0
}
```
Semua nilai keseimbangan di `balance.json` agar mudah disetel tanpa mengubah kode.

## 10. UI/UX
- Layout: toolbar bawah (kategori → alat), HUD atas (uang, populasi, tanggal, kecepatan), panel kanan (info tile/bangunan), minimap pojok.
- Panel anggaran, statistik (grafik populasi/uang/demand dengan canvas chart), pengaturan, menu utama, kota baru, load/save.
- Notifikasi toast (kebakaran, tanpa listrik, uang habis).
- Mobile: tombol besar, gestur pinch/pan, long-press = info.
- Aksesibilitas: tombol dapat difokus keyboard di luar kanvas, kontras memadai, skala UI 80–150%, mode warna aman buta warna untuk overlay.
- Lokalisasi: i18n JSON (id, en).

## 11. Input
| Aksi | Desktop | Touch |
|---|---|---|
| Pan | Drag kanan / WASD | Drag dua jari |
| Zoom | Scroll | Pinch |
| Rotasi | Q / E | Twist dua jari |
| Tempatkan/tarik | Klik kiri / drag | Tap / drag satu jari |
| Batal | Esc / klik kanan | Tombol batal |
| Undo/Redo | Ctrl+Z / Ctrl+Y | Tombol |
| Kecepatan | 1 / 2 / 3, Space | Tombol |

## 12. Save/Load
- Serialisasi typed array ke binary (+ kompresi `CompressionStream` gzip) di IndexedDB.
- Header: versi skema, seed, ukuran, tanggal, ringkasan. Migrasi antar versi.
- Autosave tiap 5 menit game; slot manual; ekspor/impor file `.city`.

## 13. Audio
- Musik latar yang bisa dimatikan, efek (bangun, bulldoze, sirene, klakson), suara ambient dinamis menurut zoom. Mulai audio hanya setelah interaksi pertama (kebijakan autoplay).

## 14. Performa & Kualitas
- Sim worker: 256² dihitung < 8 ms/tick pada 1x.
- Memori < 500 MB; ukuran bundle awal < 3 MB (model dimuat lazy, Draco/Meshopt untuk GLB, KTX2 untuk tekstur).
- Deterministik: RNG seeded sehingga replay dan tes konsisten.

## 15. Tes
- Unit: BFS utilitas, demand, ekonomi, serializer round-trip.
- Snapshot sim: seed + N tick → hash state tetap.
- E2E: bangun jalan + zona + pembangkit → populasi > 0.
- Perf budget CI: FPS dan waktu tick pada skenario kota 256² penuh.

## 16. Roadmap
| Fase | Isi | Estimasi |
|---|---|---|
| 1 | Skeleton Vite/TS, kamera iso, terrain, picking | 1–2 minggu |
| 2 | Jalan + auto-tiling, zona, bangunan tumbuh | 2–3 minggu |
| 3 | Listrik/air, ekonomi, UI HUD, save/load | 2–3 minggu |
| 4 | Layanan, polusi, kebahagiaan, overlay data | 2–3 minggu |
| 5 | Lalu lintas, kendaraan, rel, bencana | 3–4 minggu |
| 6 | Audio, mobile, lokalisasi, polish, mod JSON | 2–3 minggu |

## 17. Di Luar Lingkup
Multiplayer/kota bersama, akun cloud, toko dalam game, aset resmi TheoTown, kompatibilitas plugin `.ttp` asli.

## 18. Risiko
- Auto-tiling jalan 3D dan jembatan di terrain berbukit: kompleks, mulai dari tanah rata.
- Kendaraan/warga dalam jumlah besar: batasi dan gunakan instancing.
- Keseimbangan ekonomi: butuh iterasi playtest, simpan semua konstanta di JSON.
- Hak cipta: gunakan aset orisinal atau berlisensi bebas.

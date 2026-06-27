# 📡 MKSLB Stream Deck — PWA

Custom Stream Deck berasaskan PWA (Progressive Web App) untuk kawalan siaran langsung OBS Studio menggunakan **obs-websocket v5**.

---

## 📁 Struktur Fail

```
stream-deck/
├── index.html          ← Struktur DOM utama
├── style.css           ← UI dark mode (CSS Grid/Flexbox)
├── app.js              ← Entry point + Service Worker registration
├── obs-api.js          ← OBS WebSocket v5 API module
├── ui-controller.js    ← Butang, klik, keyboard shortcuts
├── sw.js               ← Service Worker (PWA caching)
├── manifest.json       ← PWA install config
├── icons/
│   ├── icon-192.png
│   └── icon-512.png
└── README.md
```

---

## 🚀 Setup & Deploy ke GitHub Pages

1. **Upload semua fail** ke GitHub repository awam
2. Pergi ke `Settings → Pages → Source: Deploy from branch → main`
3. Akses PWA di: `https://[username].github.io/[repo-name]/`

---

## 🔌 Setup OBS WebSocket

1. Buka OBS Studio
2. Pergi ke **Tools → WebSocket Server Settings**
3. Enable: ✅ **Enable WebSocket Server**
4. Port: `4455` (default)
5. Set password (pilihan)
6. Klik OK

---

## ⚙️ Sambungan Pertama

1. Buka PWA di browser/tablet
2. Klik butang **⚙️** (Settings)
3. Isi:
   - **Host**: IP komputer OBS (cth: `192.168.1.100`) atau `localhost`
   - **Port**: `4455`
   - **Password**: (jika ada)
4. Klik **Simpan & Sambung**

---

## ⌨️ Keyboard Shortcuts (Boleh Ubah Suai)

Shortcut keys dikonfigurasikan dalam `ui-controller.js` di dalam objek `SHORTCUT_MAP`:

```javascript
export const SHORTCUT_MAP = {
  // Scenes
  'F1':       { action: 'scene', value: 'POSTER' },
  'F2':       { action: 'scene', value: 'STARTING SOON' },
  'F3':       { action: 'scene', value: 'BREAKBUMPER' },
  'F4':       { action: 'scene', value: 'AZAN SOLAT' },
  'Digit1':   { action: 'scene', value: 'MAIN VIEW' },      // Alt+1
  'Digit2':   { action: 'scene', value: 'IMAM VIEW' },      // Alt+2
  // ... dll

  // Transition
  'KeyT':     { action: 'transition' },                     // Alt+T

  // Sources
  'KeyL':     { action: 'source', value: 'LT' },           // Alt+L
  'KeyG':     { action: 'source', value: 'MKSLB LOGO GIF 5' }, // Alt+G
};
```

### Cara Ubah Shortcut

| Anda Mahu         | Tukar Key Code kepada... |
|-------------------|--------------------------|
| Alt + A           | `'KeyA'`                 |
| Alt + 0           | `'Digit0'`               |
| F5                | `'F5'`                   |
| Alt + Enter       | `'Enter'`                |
| Alt + Space       | `'Space'`                |
| Alt + ↑           | `'ArrowUp'`              |

> Rujuk senarai lengkap Key Codes: https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/code

### Contoh Ubah Suai

Tukar `Alt+T` (Transition) kepada `Alt+Space`:
```javascript
// Sebelum:
'KeyT': { action: 'transition' },

// Selepas:
'Space': { action: 'transition' },
```

---

## 🎬 Cara Guna (Studio Mode Workflow)

```
1. Klik/tekan shortcut SCENE  →  Scene masuk PREVIEW (kotak hijau)
2. Semak di OBS Monitor       →  Pastikan PREVIEW betul
3. Klik/tekan Alt+T           →  PREVIEW dihantar ke PROGRAM (LIVE)
```

> ✅ **Studio Mode** memastikan anda tidak tersalah klik ke Live secara langsung.

---

## 🎛️ Source Toggles

Butang Source akan **toggle visibility** (On/Off) untuk source dalam scene **Program** yang sedang aktif.

---

## 📱 Install sebagai PWA

### Android/Chrome:
1. Buka URL di Chrome
2. Ketuk ikon **⋮** → **Add to Home Screen**

### iOS/Safari:
1. Buka URL di Safari
2. Ketuk ikon **Share** → **Add to Home Screen**

### Desktop (Chrome/Edge):
1. Lihat ikon **install** (📥) di address bar
2. Klik dan pilih **Install**

---

## 🔧 Troubleshooting

| Masalah | Penyelesaian |
|---------|--------------|
| Gagal sambung | Pastikan OBS dibuka & WebSocket diaktifkan |
| Source tidak jumpa | Semak nama source dalam OBS (kes-sensitif) |
| F-keys tidak berfungsi | Cuba disable browser shortcuts atau guna Alt+angka |
| PWA tak install | Mesti guna HTTPS (GitHub Pages sudah HTTPS) |

---

## 📝 Nota Pembangun

- Menggunakan `obs-websocket-js@5.0.6` dari CDN `esm.sh`
- Semua state disimpan dalam `localStorage`
- Tiada backend — semua client-side
- Compatible: Chrome 90+, Edge 90+, Safari 15+

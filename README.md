# EV Charging Station Locator Dashboard — Johor Bahru

Web-Based GIS dashboard untuk memantau & mencari stesen pengecasan EV di Johor Bahru (**108 stesen** sebenar). Reka bentuk moden, *responsive*, ada *dark mode*, dan mengambil kira **6 hukum UI/UX**.

## Struktur Fail
```
ev-dashboard/
├── index.html          # struktur halaman
├── start-server.bat     # pelancar server tempatan (Windows)
├── css/
│   └── styles.css      # design tokens (CSS variables) + light/dark + animasi
├── js/
│   ├── data.js          # dataset 108 stesen (tukar di sini bila perlu)
│   └── app.js            # logik: peta, cluster, carta, arah, locate me
└── README.md
```

## Ahli Kumpulan
| Bil | Nama | No. Matrik |
|-----|------|-----------|
| 1 | __________ | __________ |
| 2 | __________ | __________ |
| 3 | __________ | __________ |

## Fungsi Utama
- **Dashboard** — KPI (count-up animation), peta interaktif, carta jenis pengecas, carta kawasan, senarai stesen.
- **Dark / Light mode** — butang 🌙/☀ di kanan atas; peta turut tukar tema (Esri World Street Map + gaya CSS gelap).
- **Marker clustering** — point bergroup bila zoom out (rupa GIS profesional), buka bila zoom in.
- **Click point → buka dalam app** — Get Directions → **Google Maps / Waze / Apple Maps / default map**.
- **Locate Me & nearest EV** — kesan lokasi, kira **5 stesen terdekat** (Haversine) + **garis laluan** ke yang #1.
- **Filter peta** — ikut jenis, **operator**, dan **kuasa (kW)**.
- **Statistics** — Stations by Area, Operator Market Share, Station by Location Type, Area Density Ranking.
- **Charger Types** — kad ringkasan + donut taburan.
- **Station List** — jadual penuh + carian + penapis + butang Directions.
- **Responsive** — di telefon, sidebar jadi menu hamburger (☰).

## 6 Hukum UI/UX yang Diterapkan
1. **Aesthetic-Usability Effect** — reka bentuk kemas, animasi halus, dark mode → pengguna rasa lebih mudah guna.
2. **Jakob's Law** — susun atur ikut konvensyen dashboard biasa (sidebar kiri, KPI atas, peta tengah) supaya terus biasa.
3. **Fitts's Law** — butang & sasaran klik besar (min 30px), mudah dicapai, terutama di telefon.
4. **Hick's Law** — pilihan menu dikecilkan kepada 5 item utama; penapis dikumpul, kurangkan beban keputusan.
5. **Law of Proximity (Gestalt)** — maklumat berkaitan dikumpul dalam kad/seksyen yang sama.
6. **Law of Prägnanz** — bentuk ringkas (kad, ikon, carta mudah) supaya senang difahami sepintas lalu.

## Cara Jalankan
**Cara 1 (paling senang):** double-click `index.html`.

**Cara 2 (disyorkan untuk Locate Me):** double-click `start-server.bat` → buka `http://localhost:8000`.
Atau manual: `python -m http.server 8000`.

> Nota: **Locate Me** perlukan kebenaran lokasi & paling tepat melalui `http://localhost` atau `https://` (GitHub Pages), bukan `file://`. Peta, library & fon guna CDN — perlu internet.

## Publish ke GitHub Pages
1. Push seluruh folder (`index.html`, `css/`, `js/`) ke repo GitHub.
2. Settings → Pages → branch `main` + folder root.
3. Buka `https://<username>.github.io/<repo>/` — Locate Me terus berfungsi (https).

## Stack
HTML5 · CSS (design tokens) · Vanilla JavaScript · Leaflet.js + MarkerCluster · Chart.js · Esri World Street Map basemap · Google Fonts (Inter). Data JSON tertanam dalam `js/data.js` (tak perlu Excel/GeoJSON). Kawasan `UTM / Skudai` digabung ke `Skudai`.

## Nota Teknikal
Jika plugin clustering gagal dimuat (CDN), sistem auto-fallback ke marker biasa — peta tetap berfungsi. Marker diwarnakan ikut jenis pengecas: biru = DC, hijau = AC, oren = DC+AC.

## Basemap untuk GitHub Pages (versi pembetulan 403)
Kedua-dua peta menggunakan Esri World Street Map melalui HTTPS:
https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}

Tiada permintaan tile ke tile.openstreetmap.org atau CARTO.
Endpoint awam digunakan tanpa API key dalam aplikasi; atribusi penyedia dikekalkan.
Zoom native maksimum 18; zoom 19 membesarkan tile sedia ada.
Mod gelap menggunakan CSS pada basemap sahaja.

Gantikan index.html, css/ dan js/ di repository dengan fail dalam folder ini.
Selepas GitHub Pages selesai deploy, tekan Ctrl+F5.
Data stesen, carta, clustering, carian, penapis dan Directions dikekalkan.
Belum disahkan pada URL GitHub Pages pengguna. Ketersediaan tertakluk kepada penyedia.

World Street Map raster dijadualkan bersara pada Disember 2029:
https://www.esri.com/arcgis-blog/products/arcgis-living-atlas/announcements/sunsetting-legacy-basemaps
# RP Chat

Aplikasi chat roleplay bergaya Messenger, dibuat dengan HTML/CSS/JS murni dan
dibungkus jadi aplikasi Android memakai [Capacitor](https://capacitorjs.com/).
Kamu menulis sendiri kedua sisi percakapan: tekan ikon ⚙️ di pojok kanan atas
chat untuk berpindah peran. Saat peran aktif "Aku", bubble pesan biru di
kanan; kalau sudah pindah ke karakter/anggota lain, bubble jadi abu-abu di
kiri — jadi jelas siapa yang sedang "bicara" tanpa perlu ganti akun.

## Fitur

- Layar utama mirip daftar chat Facebook/Messenger.
- Tombol **+** untuk membuat **Karakter** (chat 1 lawan 1) atau **Grup**
  (banyak peran dalam satu chat).
- Ganti peran cukup dengan menekan ikon pengaturan di chat — tidak perlu
  logout/login.
- Pesan bisa dibalas (swipe/klik → reply), diedit, dan dihapus lewat
  long-press.
- Kirim foto/video sebagai lampiran.
- Kustomisasi per chat: foto profil, bio karakter, warna bubble, latar
  belakang chat, gaya & ukuran teks.
- Semua data tersimpan otomatis di penyimpanan lokal HP (tidak perlu internet
  setelah APK terpasang).

## Cara build jadi APK lewat GitHub Actions

1. Buat repository baru di GitHub, lalu push seluruh isi folder ini
   (jangan lupa folder `.github` ikut ter-upload, itu yang berisi workflow-nya).
2. Buka tab **Actions** di repo tersebut. Workflow **Build APK** akan otomatis
   jalan setiap kamu push ke branch `master`. Bisa juga dijalankan manual lewat
   tombol **Run workflow**.
3. Tunggu sampai proses selesai (tanda centang hijau). Buka run tersebut,
   scroll ke bagian **Artifacts**, lalu unduh `rp-chat-debug-apk.zip`.
4. Ekstrak zip itu, di dalamnya ada `app-debug.apk`. Pindahkan ke HP Android
   dan install seperti biasa (aktifkan dulu "Izinkan dari sumber tidak
   dikenal" kalau diminta).

## Uji coba tanpa APK

Karena ini murni HTML/CSS/JS biasa, kamu bisa langsung buka `www/index.html`
di browser HP/laptop untuk uji coba tampilan sebelum build APK.

## Struktur folder

```
again/
├── www/                  ← isi aplikasi (HTML/CSS/JS)
│   ├── index.html
│   ├── style.css
│   └── app.js
├── package.json
├── capacitor.config.json
└── .github/workflows/build-apk.yml   ← workflow build APK otomatis
```

## Kustomisasi lanjutan

- Warna avatar karakter/grup diambil otomatis dari daftar warna di
  `app.js` (variabel `AVATAR_COLORS`) — bisa ditambah/diubah sesuka hati.
- Semua logika ada di `www/app.js`, terstruktur per fungsi (buat karakter,
  buat grup, kirim pesan, dll) supaya gampang dikembangkan.
- App ID (`cloud.wumboing.rpchat` di `capacitor.config.json`) bisa diganti
  sesuai keinginan sebelum build pertama kali.

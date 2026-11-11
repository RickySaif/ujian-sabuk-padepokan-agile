# Ujian Sabuk Padepokan Agile

Permainan onboarding untuk calon anggota Padepokan Agile. Pemain membuat karakter, berjalan keliling padepokan, dan berlatih bersama lima pelatih:

| Sabuk | Materi |
|---|---|
| Putih | Mengenal Padepokan: pengurus, anggota, sebutan Pendekar Agile |
| Kuning | Visi: “Membangun masyarakat Indonesia yang tangkas dan adaptif” |
| Hijau | Dua misi Padepokan Agile |
| Biru | Tiga Ikrar Pendekar Agile, termasuk mengucapkan ikrar |
| Coklat | Bidang kompetensi, bidang kerja sama, dan jejak kegiatan |

Setelah kelima sabuk diraih, Eyang Guru di pendopo membuka **Ujian Sabuk**: 10 soal acak, lulus jika minimal 8 benar. Yang lulus mendapat sertifikat dengan tautan sendiri, misalnya `…/?s=PA-1A2B3C4D5E`, yang bisa difoto layar dan dibagikan. Siapa pun yang membuka tautan itu melihat isi sertifikat langsung dari database.

Materi diambil dari deck *Profil Padepokan Agile*. Tokoh pelatih (Eyang Guru, Mbak Laras, dan lainnya) adalah tokoh rekaan permainan.

Dibangun dari starter kit Onboarderr: HTML, CSS, dan modul JavaScript biasa. Tidak ada build step dan tidak ada berkas gambar.

## Tanpa login

Nama dan karakter disimpan di browser pemain. Kemajuan latihan tidak disinkronkan antar perangkat. Hanya hasil ujian yang lulus yang disimpan di Supabase.

## Supabase

| Bagian | Isi |
|---|---|
| `supabase/setup.sql` | Skema `padepokan` (bank soal dan sertifikat) dan tiga fungsi untuk pemain. Aman dijalankan berulang. |
| `js/config.js` | URL proyek dan kunci publishable. Jangan pernah menaruh kunci service-role. |

Skema `padepokan` tidak dibuka ke API, jadi tabelnya tidak bisa dibaca atau diisi langsung dari browser. Pemain hanya bisa memanggil:

- `padepokan_soal()` mengirim 10 soal acak tanpa kunci jawaban.
- `padepokan_ujian(nama, look, jawaban)` menilai di server dan membuat sertifikat hanya jika lulus.
- `padepokan_sertifikat(kode)` mengirim satu sertifikat. Tidak ada cara untuk melihat daftar semua sertifikat.

Untuk mengubah soal ujian, ubah bagian `insert into padepokan.soal` di `setup.sql`, lalu jalankan ulang file itu di SQL editor Supabase. Untuk melihat siapa saja yang sudah lulus, jalankan di SQL editor:

```sql
select kode, nama, skor, total, terbit_at from padepokan.sertifikat order by terbit_at desc;
```

## Mengubah materi latihan

Materi kelima sabuk ada di `content/company.json`. Formatnya dijelaskan di [docs/CONTENT.md](docs/CONTENT.md). Kalau mengubah visi, misi, atau ikrar, ubah juga bank soal ujian di `setup.sql` supaya tetap sejalan.

## Menjalankan dan memeriksa

```
npm start            # http://localhost:4810
npm run check        # semua modul terbaca; materi valid
npm run test:db      # aturan database, di Postgres lokal sekali pakai (butuh initdb, pg_ctl, psql)
npm run test:play    # memainkan seluruh permainan di Chrome ukuran ponsel; ujian disimulasikan (butuh npm i dan npm start)
```

## Publikasi

Situs statis di GitHub Pages: https://rickysaif.github.io/ujian-sabuk-padepokan-agile/

## Lisensi

MIT. Lihat [LICENSE](LICENSE).

# Ujian Sabuk Padepokan Agile — catatan untuk Claude

Permainan onboarding calon anggota Padepokan Agile, dibangun dari starter kit Onboarderr. Baca `README.md` dulu; format materi ada di `docs/CONTENT.md`.

## Aturan
- **Tanpa build step.** HTML, CSS, dan modul ES biasa. Pustaka dari CDN dengan versi yang dipatok.
- **Tanpa berkas gambar.** Sprite digambar di `js/art.js`. Jaga tetap mulus di ponsel kelas menengah: tanpa CSS blur, animasikan hanya transform dan opacity.
- **Tanpa login.** Kemajuan latihan di localStorage. Hanya sertifikat yang disimpan di Supabase.
- **Materi adalah data.** Teks materi ada di `content/company.json`. Soal ujian dan kuncinya hanya ada di `supabase/setup.sql`; jangan pernah mengirim kunci jawaban ke browser.
- **Aturan akses ada di database.** Skema `padepokan` tidak dibuka ke API; pemain hanya memanggil fungsi `padepokan_*`. `setup.sql` harus aman dijalankan dua kali. Setelah mengubahnya, jalankan `npm run test:db` dan tambahkan kasusnya.
- **Hanya kunci publishable** di `js/config.js`. Jangan pernah kunci service-role.
- Teks antarmuka dalam bahasa Indonesia. Teks untuk pemain di-escape dengan `esc()`; tautan dari materi lewat `safeUrl()`.

## Pemeriksaan sebelum menyatakan berhasil
`npm run check`, `npm run test:db`, dan dengan `npm start` berjalan, `npm run test:play`.

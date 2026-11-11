#!/bin/bash
# Menjalankan supabase/setup.sql di Postgres lokal sekali pakai, lalu memeriksa aturan yang penting:
# kunci jawaban tidak bocor, penilaian di server, sertifikat hanya untuk yang lulus. Butuh initdb/pg_ctl/psql di PATH.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIR="$(mktemp -d)"; PORT=54329
trap 'pg_ctl -D "$DIR/db" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$DIR"' EXIT
initdb -D "$DIR/db" -U postgres -A trust >/dev/null
pg_ctl -D "$DIR/db" -o "-p $PORT -c listen_addresses='' -k $DIR" -l "$DIR/log" -w start >/dev/null
P="psql -X -q -h $DIR -p $PORT -U postgres -v ON_ERROR_STOP=1"
$P -d postgres -c "create database t" >/dev/null
P="$P -d t"
$P -c "create role anon nologin; create role authenticated nologin; grant usage on schema public to anon, authenticated;" >/dev/null
$P -f "$ROOT/supabase/setup.sql" >/dev/null
$P -f "$ROOT/supabase/setup.sql" >/dev/null          # dijalankan dua kali harus aman

PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "ok    $1"; }
bad() { FAIL=$((FAIL+1)); echo "FAIL  $1"; }
expect_err() { if $P -c "$2" >/dev/null 2>&1; then bad "$1"; else ok "$1"; fi; }
expect_val() { local got; got="$($P -At -c "$2" 2>&1 | tail -1 || true)"; if [ "$got" = "$3" ]; then ok "$1"; else bad "$1 (dapat: $got, seharusnya: $3)"; fi; }
ANON="begin; set local role anon;"
# jawaban benar / salah untuk 10 soal pertama (dibaca sebagai superuser, seperti penguji)
RIGHT="'$($P -At -c "select jsonb_object_agg(id, jawaban) from (select id, jawaban from padepokan.soal order by id limit 10) s")'::jsonb"
SEVEN="'$($P -At -c "select jsonb_object_agg(id, case when rn <= 7 then jawaban else (jawaban + 1) % array_length(options,1) end) from (select id, jawaban, options, row_number() over (order by id) rn from padepokan.soal order by id limit 10) s")'::jsonb"

expect_val "bank soal berisi 14 soal, juga setelah dijalankan dua kali" "select count(*) from padepokan.soal" "14"
expect_err "pengunjung tidak bisa membaca bank soal"              "$ANON select * from padepokan.soal; commit"
expect_err "pengunjung tidak bisa membaca sertifikat"             "$ANON select * from padepokan.sertifikat; commit"
expect_err "pengunjung tidak bisa membuat sertifikat langsung"    "$ANON insert into padepokan.sertifikat (kode, nama, skor, total) values ('PA-X', 'Palsu', 10, 10); commit"
expect_val "pengunjung mendapat 10 soal"                          "$ANON select jsonb_array_length(public.padepokan_soal()); commit" "10"
expect_val "soal yang dikirim tidak memuat kunci jawaban"         "$ANON select count(*) from jsonb_array_elements(public.padepokan_soal()) e where e ? 'jawaban'; commit" "0"
expect_val "7 benar dari 10 tidak lulus"                          "begin; set local role anon; select public.padepokan_ujian('Robin', '{}', $SEVEN)->>'lulus'; commit" "false"
expect_val "… dan tidak ada sertifikat yang dibuat"               "select count(*) from padepokan.sertifikat" "0"
expect_val "… dan topik yang perlu diulang disebutkan"            "$ANON select jsonb_array_length(public.padepokan_ujian('Robin', '{}', $SEVEN)->'ulang') > 0; commit" "t"
expect_err "ujian dengan kurang dari 10 soal ditolak"             "$ANON select public.padepokan_ujian('Robin', '{}', '{\"visi-1\":0}'); commit"
expect_err "soal yang tidak ada di bank tidak dihitung"           "$ANON select public.padepokan_ujian('Robin', '{}', $RIGHT - 'visi-1' || '{\"palsu\":0}'); commit"
expect_err "nama kosong ditolak"                                  "$ANON select public.padepokan_ujian('   ', '{}', $RIGHT); commit"
expect_err "nama lebih dari 40 huruf ditolak"                     "$ANON select public.padepokan_ujian(repeat('a', 41), '{}', $RIGHT); commit"
expect_val "10 benar lulus dan mendapat kode"                     "$ANON select (public.padepokan_ujian('  Robin   Hood ', '{\"skin\":2}', $RIGHT)->>'kode') like 'PA-%'; commit" "t"
expect_val "sertifikat tersimpan dengan nama yang dirapikan"      "select nama || '|' || skor || '/' || total || '|' || (look->>'skin') from padepokan.sertifikat" "Robin Hood|10/10|2"
K="$($P -At -c "select kode from padepokan.sertifikat limit 1")"
expect_val "sertifikat bisa dilihat dengan kodenya"               "$ANON select public.padepokan_sertifikat('$K')->>'nama'; commit" "Robin Hood"
expect_val "kode huruf kecil juga ditemukan"                      "$ANON select public.padepokan_sertifikat(lower('$K'))->>'skor'; commit" "10"
expect_val "kode yang salah tidak menemukan apa-apa"              "$ANON select coalesce(public.padepokan_sertifikat('PA-TIDAKADA')::text, 'kosong'); commit" "kosong"
K2="$($P -At -c "$ANON select public.padepokan_ujian('Ani', jsonb_build_object('x', repeat('a', 900)), $RIGHT)->>'kode'; commit" | tail -1)"
expect_val "tampilan (look) yang terlalu besar dibuang"           "$ANON select public.padepokan_sertifikat('$K2')->'look'; commit" "{}"

echo; echo "$PASS lulus, $FAIL gagal"; [ "$FAIL" = 0 ]

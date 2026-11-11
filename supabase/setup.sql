-- setup.sql — Ujian Sabuk Padepokan Agile: bank soal ujian dan sertifikat.
-- Aman dijalankan berulang kali. Tidak ada login: pemain anonim hanya bisa memanggil tiga fungsi di bawah.
--   padepokan_soal()                       → 10 soal acak, TANPA kunci jawaban
--   padepokan_ujian(nama, look, jawaban)   → dinilai di server; jika lulus, sertifikat dibuat
--   padepokan_sertifikat(kode)             → satu sertifikat, untuk dibagikan dan diverifikasi
-- Tabelnya ada di skema `padepokan`, yang tidak dibuka ke API, jadi tidak bisa dibaca atau diisi langsung.

create schema if not exists padepokan;
revoke all on schema padepokan from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then execute 'revoke all on schema padepokan from anon'; end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then execute 'revoke all on schema padepokan from authenticated'; end if;
end $$;

create table if not exists padepokan.soal (
  id       text primary key,
  topik    text not null,
  q        text not null,
  options  text[] not null check (array_length(options, 1) between 2 and 6),
  jawaban  int  not null,
  check (jawaban >= 0 and jawaban < array_length(options, 1))
);
alter table padepokan.soal enable row level security;

create table if not exists padepokan.sertifikat (
  kode      text primary key,
  nama      text not null check (char_length(nama) between 1 and 40),
  look      jsonb not null default '{}'::jsonb check (jsonb_typeof(look) = 'object' and octet_length(look::text) < 600),
  skor      int  not null,
  total     int  not null,
  terbit_at timestamptz not null default now()
);
alter table padepokan.sertifikat enable row level security;

-- Bank soal. Ubah di sini lalu jalankan ulang file ini. Kolom jawaban = posisi opsi yang benar, mulai dari 0.
insert into padepokan.soal (id, topik, q, options, jawaban) values
 ('visi-1', 'Visi', 'Apa visi Padepokan Agile?', array['Membangun masyarakat Indonesia yang tangkas dan adaptif','Menjadi komunitas Agile terbesar di Asia Tenggara','Mencetak Scrum Master bersertifikat sebanyak-banyaknya','Membangun perusahaan Indonesia yang cepat dan efisien'], 0),
 ('visi-2', 'Visi', 'Dua sifat masyarakat yang ingin dibangun menurut visi adalah …', array['Cepat dan hemat','Tangkas dan adaptif','Disiplin dan patuh','Kreatif dan kompetitif'], 1),
 ('misi-1', 'Misi', 'Menurut misi pertama, Padepokan Agile menjadi sasana diskusi dan kolaborasi bagi …', array['para Pendekar Agile','pengurus harian saja','perusahaan mitra','pemerintah daerah'], 0),
 ('misi-2', 'Misi', 'Sasana diskusi dan kolaborasi itu bertujuan agar para Pendekar Agile …', array['mendapat sertifikat internasional','mencari pekerjaan baru','berinovasi dan meningkatkan potensi diri','bersaing satu sama lain'], 2),
 ('misi-3', 'Misi', 'Misi kedua: menyediakan informasi dan media untuk …', array['mempromosikan produk anggota','meningkatkan wawasan dan kemampuan masyarakat dalam menghadapi tantangan perubahan','menjual pelatihan berbayar','mengumpulkan data peserta acara'], 1),
 ('misi-4', 'Misi', 'Kamu merangkum materi meetup lalu membagikannya terbuka untuk umum. Ini paling dekat dengan …', array['misi pertama','misi kedua','visi','bukan bagian dari misi'], 1),
 ('ikrar-1', 'Ikrar', 'Mana yang merupakan ikrar Pendekar Agile?', array['Menjaga rahasia komunitas dari orang luar','Mengutamakan senioritas dalam diskusi','Menjunjung tinggi keterbukaan dan integritas','Selalu mengikuti metode yang paling populer'], 2),
 ('ikrar-2', 'Ikrar', 'Lengkapi ikrar: “Mengutamakan kolaborasi dan sinergi …”', array['dalam kompetisi','dalam interaksi','dengan sponsor','di media sosial'], 1),
 ('ikrar-3', 'Ikrar', 'Lengkapi ikrar: “Senantiasa menempa diri dan berpartisipasi aktif dalam …”', array['rapat dan laporan','lomba dan kejuaraan','promosi dan pemasaran','kreasi dan inovasi'], 3),
 ('ikrar-4', 'Ikrar', 'Kamu menemukan data keliru di materi yang sudah kamu presentasikan. Sikap yang sesuai ikrar?', array['Mengakui secara terbuka lalu memperbaikinya','Diam saja karena belum ada yang sadar','Menyalahkan sumber datanya','Menghapus materi tanpa penjelasan'], 0),
 ('ikrar-5', 'Ikrar', 'Dua anggota merencanakan acara serupa di waktu yang sama. Yang paling sesuai ikrar?', array['Biarkan bersaing, yang terbaik menang','Batalkan keduanya','Pilih yang lebih senior','Ajak keduanya bergabung dan bersinergi'], 3),
 ('ikrar-6', 'Ikrar', 'Ada panggilan relawan fasilitator, dan kamu belum pernah jadi fasilitator. Sikap yang sesuai ikrar?', array['Menunggu sampai merasa ahli','Mendaftar dan belajar sambil berkontribusi','Menolak karena bukan tugasmu','Menyuruh orang lain saja'], 1),
 ('profil-1', 'Profil', 'Apa sebutan untuk anggota Padepokan Agile?', array['Santri Scrum','Ksatria Kanban','Pendekar Agile','Murid Lean'], 2),
 ('profil-2', 'Profil', 'Mana yang termasuk bidang kerja sama Padepokan Agile?', array['Coaching','Jual-beli perangkat lunak','Rekrutmen tenaga kerja','Audit keuangan'], 0)
on conflict (id) do update set topik = excluded.topik, q = excluded.q, options = excluded.options, jawaban = excluded.jawaban;

-- 10 soal acak, tanpa kunci jawaban.
create or replace function public.padepokan_soal()
returns jsonb language sql volatile security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'q', s.q, 'options', to_jsonb(s.options))), '[]'::jsonb)
  from (select id, q, options from padepokan.soal order by random() limit 10) s;
$$;

-- Menilai ujian. p_jawaban = {"id soal": posisi opsi yang dipilih, …} untuk tepat 10 soal berbeda dari bank.
-- Lulus jika minimal 8 benar; hanya saat lulus sebuah sertifikat dibuat.
create or replace function public.padepokan_ujian(p_nama text, p_look jsonb, p_jawaban jsonb)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  v_nama text := btrim(regexp_replace(coalesce(p_nama, ''), '\s+', ' ', 'g'));
  v_total int; v_skor int; v_kode text; v_salah text[];
begin
  if char_length(v_nama) < 1 or char_length(v_nama) > 40 then raise exception 'Nama harus 1 sampai 40 huruf.'; end if;
  if p_jawaban is null or jsonb_typeof(p_jawaban) <> 'object' then raise exception 'Jawaban tidak valid.'; end if;
  if p_look is null or jsonb_typeof(p_look) <> 'object' or octet_length(p_look::text) >= 600 then p_look := '{}'::jsonb; end if;
  select count(*),
         count(*) filter (where (j.value #>> '{}') ~ '^\d+$' and (j.value #>> '{}')::int = s.jawaban),
         coalesce(array_agg(distinct s.topik) filter (where not ((j.value #>> '{}') ~ '^\d+$' and (j.value #>> '{}')::int = s.jawaban)), '{}')
    into v_total, v_skor, v_salah
    from jsonb_each(p_jawaban) j join padepokan.soal s on s.id = j.key;
  if v_total <> 10 or (select count(*) from jsonb_object_keys(p_jawaban)) <> 10 then raise exception 'Ujian harus berisi tepat 10 soal.'; end if;
  if v_skor < 8 then return jsonb_build_object('lulus', false, 'skor', v_skor, 'total', v_total, 'ulang', v_salah); end if;
  loop
    v_kode := 'PA-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
    begin
      insert into padepokan.sertifikat (kode, nama, look, skor, total) values (v_kode, v_nama, p_look, v_skor, v_total);
      exit;
    exception when unique_violation then null;
    end;
  end loop;
  return jsonb_build_object('lulus', true, 'skor', v_skor, 'total', v_total, 'kode', v_kode, 'ulang', v_salah);
end $$;

-- Satu sertifikat berdasarkan kodenya (null jika tidak ada). Tidak ada cara untuk melihat daftar semua sertifikat.
create or replace function public.padepokan_sertifikat(p_kode text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('kode', kode, 'nama', nama, 'look', look, 'skor', skor, 'total', total, 'terbit_at', terbit_at)
  from padepokan.sertifikat where kode = upper(btrim(p_kode));
$$;

revoke all on function public.padepokan_soal() from public;
revoke all on function public.padepokan_ujian(text, jsonb, jsonb) from public;
revoke all on function public.padepokan_sertifikat(text) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'grant execute on function public.padepokan_soal(), public.padepokan_ujian(text, jsonb, jsonb), public.padepokan_sertifikat(text) to anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant execute on function public.padepokan_soal(), public.padepokan_ujian(text, jsonb, jsonb), public.padepokan_sertifikat(text) to authenticated';
  end if;
end $$;

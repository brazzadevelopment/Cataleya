# Turnir: upute

Aplikacija za praćenje nogometnog turnira: raspored, rezultati uživo, tablice skupina, ždrijeb i konačni poredak. Gledatelji ne trebaju prijavu. Prvi turnir: **Cataleya Cup 2026**.

- [1. Isprobavanje bez baze (demo)](#1-isprobavanje-bez-baze-demo)
- [2. Postavljanje (Supabase + Vercel)](#2-postavljanje-supabase--vercel)
- [3. Upute za organizatora](#3-upute-za-organizatora)
- [4. Upute za zapisničara](#4-upute-za-zapisničara)
- [5. Za programere](#5-za-programere)

---

## 1. Isprobavanje bez baze (demo)

Bez Supabase varijabli aplikacija radi u **demo načinu**: podaci Cataleya Cupa spremaju se samo u pregledniku na tom uređaju.

```bash
npm install
npm run dev        # http://localhost:5173
```

Demo PIN-ovi: **9000** (organizator), a tereni redom **1001** do **1011** (popis je na ekranu Prijava).
U uređivanju, na dnu stranice, gumb „Izmisli rezultate skupina” popuni rezultate pa se vide tablice i ždrijeb. Gumb „Vrati početno stanje” sve vraća.

## 2. Postavljanje (Supabase + Vercel)

### 2.1 Supabase (baza i server)

1. Na https://supabase.com napravi novi projekt (regija **Frankfurt**, `eu-central-1`).
2. **SQL Editor → New query**: zalijepi cijeli `supabase/schema.sql` i klikni **Run**. Shema sama napravi i tajnu za prijavu (tablica `app_secrets`).
3. Opet **New query**: zalijepi `supabase/seed.sql` (Cataleya Cup: 4 godišta, momčadi, skupine, raspored, osmine A i B turnira) i klikni **Run**.
4. Postavi PIN-ove (glavni i za svaki teren). PIN ima 4 do 8 znamenki, a svi PIN-ovi u turniru moraju biti različiti:

   ```sql
   -- glavni PIN (organizator)
   select set_pin(md5('cataleya:T')::uuid, null, 'XXXX');
   -- PIN terena, po nazivu terena
   select set_pin(md5('cataleya:T')::uuid, id, 'YYYY') from fields where name = 'Miro Surać 1';
   ```

   Kasnije ih organizator mijenja u aplikaciji.
5. Serverska funkcija (Edge Function `api`): `npm run build:edge`, zatim `supabase functions deploy api --no-verify-jwt`. Ona provjerava PIN i jedina piše u bazu. Ključ `service_role` Supabase joj daje sam; ne upisuje se nigdje.
6. **Project Settings → API**: zapiši **Project URL** i javni ključ (**publishable** ili **anon public**).

### 2.2 Vercel (hosting)

1. Na https://vercel.com: **Add New → Project**, odaberi repozitorij `brazzadevelopment/Cataleya`.
2. Framework se sam prepozna (Vite). Root Directory ostaje prazan.
3. **Environment Variables** (samo dvije, obje su javne):

   | Naziv | Vrijednost |
   |---|---|
   | `VITE_SUPABASE_URL` | Project URL |
   | `VITE_SUPABASE_ANON_KEY` | publishable / anon ključ |

4. **Deploy**. Aplikacija je na adresi poput `https://cataleya.vercel.app/t/cataleya-cup-2026`.
5. Po želji: **Settings → Domains** za vlastitu domenu.

Nakon promjene varijabli treba **Redeploy**, jer se `VITE_` varijable ugrade u aplikaciju pri izradi.

### 2.3 Provjera

- Otvori adresu na mobitelu: raspored mora biti tu.
- **Prijava** (dno početne) → glavni PIN → otvara se Uređivanje.
- Na drugom mobitelu otvori početnu, a na prvom u Rezultatima pokreni utakmicu i dodaj gol. Na drugom se rezultat mora pojaviti sam, za sekundu ili dvije.

## 3. Upute za organizatora

**Prijava:** dno početne stranice → **Prijava** → glavni PIN. Gore desno pojavi se gumb olovke, koji vodi na Uređivanje.

### Kartice u Uređivanju

| Kartica | Što radiš |
|---|---|
| **Rezultati** | Utakmice po terenima. Dodirni utakmicu za upis rezultata (isto kao zapisničar). |
| **Raspored** | Popis utakmica po danima. Dodirni utakmicu za izmjenu termina, terena ili momčadi. **+ Utakmica** dodaje novu. **Uvoz iz Excela** učitava raspored. |
| **Nastavak** | Utakmice nakon skupina (četvrtfinale, polufinale…) i pravila tko u njih ulazi. Ovdje je i **ždrijeb kod izjednačenja**. |
| **Momčadi** | Kategorije, skupine i momčadi. **+ Momčadi** prima popis, jedna momčad po retku. |
| **Turnir** | Naziv, datumi, opis, logo, bodovi, **redoslijed kriterija kod jednakih bodova**, tekst pravila. |
| **Tereni i PIN** | Tereni, link na Google Maps, glavni PIN i PIN svakog terena. |

### Uvoz rasporeda iz Excela

Excel može izgledati kao organizatorov raspored:

| Vrijeme | Teren 1 | Teren 2 |
|---|---|---|
| 16:00 – 16:25 | NK Špansko – NK Sabunjar | NK Zadarnova plavi – NK Varaždin plavi |

Iznad tablice može biti redak s datumom („Petak 23. 10.”). Drugi oblik je popis sa stupcima **Datum, Vrijeme, Teren, Domaćin, Gost** (i po želji **Skupina**).

Prije uvoza aplikacija pokaže što je prepoznala:
- momčadi koje ne poznaje (provjeri naziv),
- utakmice koje već postoje (one se preskaču).

Skupina se pogodi sama ako su obje momčadi u istoj skupini.

### Nastavak turnira (ždrijeb)

Za svaku utakmicu nastavka upišeš **oznaku** (npr. `ČF1`) i **tko ulazi**:

| Upis | Značenje |
|---|---|
| `1A` | 1. u skupini A |
| `2B` | 2. u skupini B |
| `2#6` | 6. najbolji drugoplasirani iz svih skupina |
| `4#2` | 2. najbolji četvrtoplasirani |
| `W:ČF1` | pobjednik utakmice ČF1 |
| `L:PF1` | poraženi u utakmici PF1 |

U finalu upiši i **„Pobjednik osvaja mjesto” 1** i **„Poraženi” 2**; u utakmici za 3. mjesto 3 i 4, i tako dalje. Iz toga nastaje konačni poredak.

Za 2016., 2017. i 2018. već su upisane subotnje osmine A i B turnira iz rasporeda (OS1–OS8 i U1–U8), s terminima i terenima. Za 2019. upisano je četvrtfinale A turnira (1A–2B, 1B–2A, 1C–2D, 1D–2C) bez termina; provjeri parove kad dobiješ nedjeljni raspored. Nedjeljne krugove dodaješ sam: npr. četvrtfinale `W:OS1` – `W:OS2`, s turnirom A ili B. Kad dobiješ raspored za nedjelju, upiši termin i teren svakoj utakmici. Gumb **„Dodaj polufinala, za 3. mjesto i finale”** doda PF1 (W:ČF1–W:ČF2), PF2 (W:ČF3–W:ČF4), utakmicu za 3. mjesto i finale. Ako pravila turnira kažu drukčije, uredi ili obriši te utakmice.

**Što se događa samo:**
- Kad su sve utakmice skupine završene, momčadi se upišu u sljedeću fazu.
- Kad utakmica nastavka završi, pobjednik (i poraženi, ako je tako upisano) ide dalje.
- Kod neriješenog upiši jedanaesterce. Dok ih nema, mjesto ostaje prazno.
- Ako ispraviš rezultat, momčad u sljedećoj utakmici se ispravi, ali samo ako ta utakmica još nije počela.

**Ručna promjena:** ako u utakmici nastavka ručno promijeniš momčad, utakmica se označi kao „ručno” i automatika je više ne dira. Kvačica „Ručno određene momčadi” to uključuje i isključuje.

**Najbolji drugoplasirani:** u Tablicama je poredak svih drugoplasiranih (i četvrtoplasiranih) s oznakom tko ide u A, a tko u B turnir. Uspoređuju se bodovi, gol-razlika, postignuti i primljeni golovi te kartoni. Ako su dvije momčadi i tada potpuno jednake, mjesto u osmini ostaje prazno: odredi momčad ručno u utakmici (Nastavak → utakmica → Momčad).

**Jednake momčadi:** ako nijedan kriterij ne razdvoji momčadi, u tablici se pojavi `*`, a mjesto u nastavku ostaje prazno. U kartici **Nastavak → Ždrijeb kod izjednačenja** upiši redoslijed iz ždrijeba (1 = bolji).

### Kriteriji kod jednakih bodova

Prema propozicijama: **bodovi → međusobni susret → gol-razlika → više postignutih golova → manje primljenih golova → manje žutih/crvenih kartona → ždrijeb**. Kartoni se broje ukupno (žuti i crveni zajedno). Mijenja se u kartici **Turnir** (strelice gore i dolje, ✕ miče, + dodaje).

- **Međusobni susret:** bodovi samo iz utakmica između izjednačenih momčadi. Kod tri ili više momčadi to je mala tablica samo njihovih međusobnih utakmica.
- Ako kriterij razdvoji samo dio momčadi, za one koje su i dalje izjednačene gleda se sljedeći kriterij.

Ako pravila turnira traže drukčije, javi: to je jedna funkcija u `src/lib/standings.ts`.

### Dijeljenje i QR plakat

- Svaka utakmica i momčad ima gumb **Podijeli** (WhatsApp, Instagram, kopiranje linka).
- **O turniru** (dno početne) → **QR plakat za ispis** → odaberi A4 ili A5 → **Ispiši / PDF**. U prozoru za ispis odaberi „Spremi kao PDF” ili pisač; uključi „Pozadinska grafika”.

### PIN-ovi

- Promjena PIN-a odmah odjavljuje sve koji su ušli starim PIN-om.
- PIN se nakon spremanja ne prikazuje, pa ga zapiši. Ako ga zaboraviš, postavi novi glavnim PIN-om.
- Ako zaboraviš glavni PIN: Supabase → SQL Editor → `select set_pin(md5('cataleya:T')::uuid, null, 'NOVI');`.

## 4. Upute za zapisničara

Iste upute su i u aplikaciji: `/t/cataleya-cup-2026/upute-zapisnicar` (link je na ekranu Prijava). Upute za roditelje su na `/t/cataleya-cup-2026/upute` (dno početne, „Kako koristiti”).

1. Otvori aplikaciju → dno početne → **Prijava** → PIN svog terena.
2. Vidiš samo utakmice na svom terenu, sljedeća je na vrhu. Dodirni utakmicu.
3. **Počni utakmicu** kad sudac zazvižda. Gledatelji vide „Uživo”.
4. Za svaki gol dodirni veliki žuti **+** ispod momčadi. Za pogrešku dodirni **−**.
5. Kartone upiši ispod rezultata (žuti i crveni, za svaku momčad). Oni odlučuju kod jednakih bodova.
6. **Kraj utakmice** na kraju. U osmini i dalje neriješeno se ne može završiti dok ne upišeš jedanaesterce.
7. Pogriješio si nakon kraja? **Ispravi rezultat**.

Bez signala: rezultat ostaje spremljen na mobitelu i pošalje se sam kad se veza vrati (piše žutom porukom).

## 5. Za programere

```bash
npm test           # logika tablica, ždrijeba, uvoza i prava (Vitest)
npm run typecheck
npm run build
npm run seed-sql   # iz src/data/seed.ts napravi supabase/seed.sql
npm run build:edge # iz server/core.ts napravi supabase/functions/api/core.js
```

| Mjesto | Što je |
|---|---|
| `src/lib/standings.ts` | tablica skupine i kriteriji kod jednakih bodova |
| `src/lib/advancement.ts` | pravila prolaska (`1A`, `W:ČF1`), jedanaesterci, konačni poredak |
| `src/lib/mutations.ts` | tko smije što; ista pravila u demo načinu i na serveru |
| `src/lib/excel.ts` | uvoz rasporeda |
| `src/data/demo.ts`, `src/data/live.ts` | demo (localStorage) i pravi način (Supabase) |
| `server/core.ts` | serverska logika: provjera PIN-a, sve izmjene, logo |
| `supabase/functions/api/` | Supabase Edge Function; `core.js` nastaje iz `server/core.ts` (`npm run build:edge`) |
| `supabase/schema.sql` | tablice, RLS (svi čitaju, nitko ne piše izravno), PIN-ovi kao bcrypt hash |

**Kako radi pisanje:** preglednik nikad ne piše u bazu. Šalje izmjenu na Edge Function (`/functions/v1/api/mutate`) s tokenom koji dobije prijavom PIN-om. Server provjeri pravo, zapiše izmjenu i preračuna nastavak turnira. Realtime zatim javi svim gledateljima da se utakmica promijenila.

**Novi turnir za drugog organizatora:** u `seed.ts` promijeni podatke, pokreni `npm run seed-sql` i SQL pokreni u Supabaseu. Zatim postavi glavni PIN (`set_pin`). Turnir je na `/t/<slug>`, a početna stranica pokazuje popis turnira.

**Faza 2 (još nije napravljeno):** obavijesti na mobitel (web push), strijelci, sponzori, fotografije.

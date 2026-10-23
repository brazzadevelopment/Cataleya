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
cd turnir
npm install
npm run dev        # http://localhost:5173
```

Demo PIN-ovi: **9000** (organizator), **1111** (Teren 1), **2222** (Teren 2).
U uređivanju, na dnu stranice, gumb „Izmisli rezultate skupina” popuni rezultate pa se vide tablice i ždrijeb. Gumb „Vrati početno stanje” sve vraća.

## 2. Postavljanje (Supabase + Vercel)

### 2.1 Supabase (baza)

1. Na https://supabase.com napravi novi projekt (regija **Frankfurt**, `eu-central-1`).
2. **SQL Editor → New query**: zalijepi cijeli `supabase/schema.sql` i klikni **Run**.
3. Opet **New query**: zalijepi `supabase/seed.sql` (Cataleya Cup: momčadi, skupine, raspored, četvrtfinale) i klikni **Run**.
4. Postavi PIN-ove. Na dnu `seed.sql` piše ID turnira i terena. U **SQL Editoru** upiši svoje PIN-ove umjesto `XXXX`:

   ```sql
   select set_pin('e0bd4789-db5e-406e-817b-520be1fc82fe', null, 'XXXX');                                    -- glavni PIN
   select set_pin('e0bd4789-db5e-406e-817b-520be1fc82fe', '9c7f2e30-86bd-4eca-8d87-e6e159b3cae7', 'XXXX');  -- Teren 1
   select set_pin('e0bd4789-db5e-406e-817b-520be1fc82fe', '531568b7-4758-4946-87ec-cfd113ed015e', 'XXXX');  -- Teren 2
   ```

   PIN ima 4 do 8 znamenki, a svi PIN-ovi u turniru moraju biti različiti. Kasnije ih organizator mijenja u aplikaciji.
5. **Project Settings → API**: zapiši **Project URL**, ključ **anon public** i ključ **service_role**. Ključ `service_role` je tajan: ide samo na Vercel, nikad u kod ni u poruke.

### 2.2 Vercel (hosting)

1. Na https://vercel.com: **Add New → Project**, odaberi repozitorij `fran`.
2. **Root Directory**: `turnir`. Framework se sam prepozna (Vite).
3. **Environment Variables**:

   | Naziv | Vrijednost |
   |---|---|
   | `VITE_SUPABASE_URL` | Project URL |
   | `VITE_SUPABASE_ANON_KEY` | anon public ključ |
   | `SUPABASE_URL` | Project URL |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role ključ (tajno) |
   | `SESSION_SECRET` | dugi nasumični niz, npr. iz `openssl rand -hex 32` |

4. **Deploy**. Aplikacija je na adresi poput `https://turnir-xxxx.vercel.app/t/cataleya-cup-2026`.
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
| `W:ČF1` | pobjednik utakmice ČF1 |
| `L:PF1` | poraženi u utakmici PF1 |

U finalu upiši i **„Pobjednik osvaja mjesto” 1** i **„Poraženi” 2**; u utakmici za 3. mjesto 3 i 4, i tako dalje. Iz toga nastaje konačni poredak.

Četvrtfinale iz zadatka (1A–2B, 1B–2A, 1C–2D, 1D–2C) već je upisano, bez termina i terena. Kad dobiješ raspored za nedjelju, upiši termin i teren svakoj utakmici. Gumb **„Dodaj polufinala, za 3. mjesto i finale”** doda PF1 (W:ČF1–W:ČF2), PF2 (W:ČF3–W:ČF4), utakmicu za 3. mjesto i finale. Ako pravila turnira kažu drukčije, uredi ili obriši te utakmice.

**Što se događa samo:**
- Kad su sve utakmice skupine završene, momčadi se upišu u sljedeću fazu.
- Kad utakmica nastavka završi, pobjednik (i poraženi, ako je tako upisano) ide dalje.
- Kod neriješenog upiši jedanaesterce. Dok ih nema, mjesto ostaje prazno.
- Ako ispraviš rezultat, momčad u sljedećoj utakmici se ispravi, ali samo ako ta utakmica još nije počela.

**Ručna promjena:** ako u utakmici nastavka ručno promijeniš momčad, utakmica se označi kao „ručno” i automatika je više ne dira. Kvačica „Ručno određene momčadi” to uključuje i isključuje.

**Jednake momčadi:** ako nijedan kriterij ne razdvoji momčadi, u tablici se pojavi `*`, a mjesto u nastavku ostaje prazno. U kartici **Nastavak → Ždrijeb kod izjednačenja** upiši redoslijed iz ždrijeba (1 = bolji).

### Kriteriji kod jednakih bodova

Zadani redoslijed: **međusobni susret → gol-razlika → više postignutih golova → ždrijeb**. Mijenja se u kartici **Turnir** (strelice gore i dolje, ✕ miče, + dodaje).

- **Međusobni susret:** bodovi samo iz utakmica između izjednačenih momčadi. Kod tri ili više momčadi to je mala tablica samo njihovih međusobnih utakmica.
- Ako kriterij razdvoji samo dio momčadi, za one koje su i dalje izjednačene gleda se sljedeći kriterij.

Ako pravila turnira traže drukčije, javi: to je jedna funkcija u `src/lib/standings.ts`.

### Dijeljenje i QR plakat

- Svaka utakmica i momčad ima gumb **Podijeli** (WhatsApp, Instagram, kopiranje linka).
- **O turniru** (dno početne) → **QR plakat za ispis** → odaberi A4 ili A5 → **Ispiši / PDF**. U prozoru za ispis odaberi „Spremi kao PDF” ili pisač; uključi „Pozadinska grafika”.

### PIN-ovi

- Promjena PIN-a odmah odjavljuje sve koji su ušli starim PIN-om.
- PIN se nakon spremanja ne prikazuje, pa ga zapiši. Ako ga zaboraviš, postavi novi glavnim PIN-om.
- Ako zaboraviš glavni PIN: Supabase → SQL Editor → `select set_pin('<ID turnira>', null, 'NOVI');`.

## 4. Upute za zapisničara

1. Otvori aplikaciju → dno početne → **Prijava** → PIN svog terena.
2. Vidiš samo utakmice na svom terenu, sljedeća je na vrhu. Dodirni utakmicu.
3. **Počni utakmicu** kad sudac zazvižda. Gledatelji vide „Uživo”.
4. Za svaki gol dodirni veliki žuti **+** ispod momčadi. Za pogrešku dodirni **−**.
5. **Kraj utakmice** na kraju. Ako je neriješeno a pravila traže jedanaesterce, prije kraja dodirni **Jedanaesterci** i upiši ih.
6. Pogriješio si nakon kraja? **Ispravi rezultat**.

Bez signala: rezultat ostaje spremljen na mobitelu i pošalje se sam kad se veza vrati (piše žutom porukom).

## 5. Za programere

```bash
npm test           # logika tablica, ždrijeba, uvoza i prava (Vitest)
npm run typecheck
npm run build
npm run seed-sql   # iz src/data/seed.ts napravi supabase/seed.sql
```

| Mjesto | Što je |
|---|---|
| `src/lib/standings.ts` | tablica skupine i kriteriji kod jednakih bodova |
| `src/lib/advancement.ts` | pravila prolaska (`1A`, `W:ČF1`), jedanaesterci, konačni poredak |
| `src/lib/mutations.ts` | tko smije što; ista pravila u demo načinu i na serveru |
| `src/lib/excel.ts` | uvoz rasporeda |
| `src/data/demo.ts`, `src/data/live.ts` | demo (localStorage) i pravi način (Supabase) |
| `api/login.ts`, `api/mutate.ts`, `api/upload.ts` | serverske funkcije: provjera PIN-a, sve izmjene, logo |
| `supabase/schema.sql` | tablice, RLS (svi čitaju, nitko ne piše izravno), PIN-ovi kao bcrypt hash |

**Kako radi pisanje:** preglednik nikad ne piše u bazu. Šalje izmjenu na `/api/mutate` s tokenom koji dobije prijavom PIN-om. Server provjeri pravo, zapiše izmjenu i preračuna nastavak turnira. Realtime zatim javi svim gledateljima da se utakmica promijenila.

**Novi turnir za drugog organizatora:** u `seed.ts` promijeni podatke, pokreni `npm run seed-sql` i SQL pokreni u Supabaseu. Zatim postavi glavni PIN (`set_pin`). Turnir je na `/t/<slug>`, a početna stranica pokazuje popis turnira.

**Faza 2 (još nije napravljeno):** obavijesti na mobitel (web push), strijelci, sponzori, fotografije.

# Turnir: prijedlog sheme i ekrana (korak 1)

Shema baze: [`supabase/schema.sql`](supabase/schema.sql). Isprobana na Postgresu 16 sa simuliranim Supabaseom (auth, storage, realtime), uključujući RLS slučajeve opisane niže.

## 1. Baza ukratko

| Tablica | Što drži |
|---|---|
| `tournaments` | naziv, `slug` za link (`/t/cataleya-cup-2026`), mjesto, datumi, logo, 2 boje, opis, pravila, bodovi 3/1/0, **redoslijed kriterija** (`tiebreakers`), objavljen da/ne |
| `tournament_admins` | tko uređuje turnir (vlasnik + dodatni organizatori) |
| `categories` | godište, naziv („2019. – U8”), trajanje utakmice, broj igrača, sustav natjecanja |
| `fields` | Teren 1, Teren 2, link na Google Maps |
| `teams` | naziv kluba, kratki naziv, logo (po želji) |
| `groups` + `group_teams` | skupine A–D i momčadi u njima; `lot_rank` = ručni ždrijeb kad kriteriji ne razdvoje momčadi |
| `matches` | faza, skupina, oznaka (`ČF1`, `PF1`, `F`), momčadi **ili** mjesto (`1A`, `W:ČF1`, `L:PF2`), teren, početak, rezultat, jedanaesterci, status, `winner_place`/`loser_place` za konačni poredak, `teams_locked` za ručnu promjenu |
| `field_pins` | PIN po terenu, **samo bcrypt hash** |
| `pin_attempts` | ograničenje pogađanja PIN-a |

**Pravila prolaska** su upisana izravno u mjesta utakmice. Primjer četvrtfinala:

| Oznaka | Domaćin | Gost |
|---|---|---|
| ČF1 | `1A` | `2B` |
| ČF2 | `1B` | `2A` |
| ČF3 | `1C` | `2D` |
| ČF4 | `1D` | `2C` |
| PF1 | `W:ČF1` | `W:ČF2` |
| PF2 | `W:ČF3` | `W:ČF4` |
| 3M (za 3. mjesto, 3/4) | `L:PF1` | `L:PF2` |
| F (finale, 1/2) | `W:PF1` | `W:PF2` |
| 5-8 PF / 5M / 7M | `L:ČF1` … | |

Na ekranu se prikazuje „1. A”, „Pobjednik ČF1”, „Poraženi PF2” dok momčad nije poznata.

**Tablice skupina se ne spremaju.** Računa ih jedna čista TypeScript funkcija iz utakmica, ista u pregledniku i na serveru. Isto vrijedi za upis u sljedeću fazu.

**Prava (RLS):**
- svi (i bez prijave) čitaju **objavljene** turnire; neobjavljene vidi samo organizator,
- organizator piše samo u turnire u kojima je u `tournament_admins`; tko napravi turnir, automatski je vlasnik,
- PIN-ove nitko ne čita; organizator ih postavlja funkcijom `set_field_pin`, a provjerava ih samo server (`verify_field_pin`, samo `service_role`),
- logotipi: javno čitanje, upis samo u mapu svog turnira,
- `matches` je u Supabase Realtime.

**Upis rezultata ide preko serverskih funkcija** (`api/` na Vercelu), i za organizatora i za zapisničara. Tako se nakon svakog rezultata na jednom mjestu izračunaju tablice i momčadi se upišu u sljedeću fazu.
- Zapisničar: odabere teren, upiše PIN → server vrati potpisani token za taj teren (vrijedi do kraja dana). Smije mijenjati samo rezultat, status i jedanaesterce utakmica na tom terenu. Nakon 5 krivih PIN-ova pauza 15 minuta.
- Organizator: šalje svoj Supabase token, smije sve u svom turniru.

## 2. Ekrani

**Gledatelj (bez prijave), donji izbornik: Početna · Raspored · Tablice · Ždrijeb · Moje**

1. **Početna** `/t/:turnir`: logo i boje turnira, odabir kategorije, kartice „Uživo sada”, „Sljedeće utakmice”, „Moje momčadi”.
2. **Raspored**: kartice po danu (Pet 23. 10., Sub 24. 10., Ned 25. 10.), filteri kategorija / teren / momčad, „16:00 – 16:25 · Teren 1”.
3. **Tablice**: sve skupine kategorije, P/N/I, golovi, GR, bodovi; označene momčadi koje prolaze; napomena kad treba ždrijeb.
4. **Ždrijeb**: grafički prikaz (na mobitelu stupci koji se listaju vodoravno: ČF → PF → Finale), utakmice za plasman ispod.
5. **Moje**: utakmice označenih momčadi (⭐), odigrane s rezultatom, sljedeće s terminom i terenom.
6. **Utakmica**: rezultat (uživo), teren s linkom na kartu, faza, gumb Podijeli.
7. **Momčad**: sve utakmice momčadi, položaj u skupini, ⭐.
8. **Konačni poredak**: postolje 1. / 2. / 3. i ostala mjesta.
9. **Info**: opis, pravila, tereni na karti, Podijeli, QR plakat.
10. **Plakat** (ispis): A4 ili A5, logo, naziv, veliki QR kod, „Rezultati uživo”.

**Zapisničar terena** `/t/:turnir/zapisnik`
11. Odabir terena + PIN.
12. Popis današnjih utakmica na terenu (sljedeća na vrhu).
13. Upis: velike tipke **+ / −** za oba tima, Počni / Završi, jedanaesterci kad je neriješeno u eliminaciji. Radi i uz slab signal (red čekanja, šalje kad se veza vrati).

**Organizator** `/admin` (prijava linkom na e-mail)
14. Moji turniri + Novi turnir.
15. Postavke turnira: osnovno, logo, boje, opis, pravila, kriteriji kod jednakih bodova (poredak povlačenjem), objavi.
16. Kategorije.
17. Tereni + PIN za svaki teren.
18. Momčadi i skupine (brzi unos: jedna momčad po retku).
19. Raspored: popis utakmica, dodaj / uredi, **uvoz iz Excela** (pregled prije spremanja, javlja nepoznate momčadi).
20. Pravila ždrijeba: predložak „4 skupine → četvrtfinale” (gornji primjer) koji se onda mijenja; termin i teren za svaku utakmicu.
21. Rezultati: brzi upis i ispravak, ručna promjena momčadi u utakmici (zaključa je od automatike), ručni ždrijeb kod jednakih momčadi.

**Demo način**: ako nema Supabase varijabli, aplikacija radi s podacima Cataleya Cupa u `localStorage`. Organizatorski dio i zapisnik se otvaraju bez prijave (PIN u demu: `1234`), uz traku „Demo”.

## 3. Odluke koje sam donio (javi ako želiš drukčije)

- **Međusobni susret kod 3 ili više momčadi s istim bodovima**: napravi se mala tablica samo njihovih utakmica (bodovi, pa GR, pa golovi u tim utakmicama). Ako to razdvoji samo dio momčadi, za ostatak se ide na sljedeći kriterij iz postavki.
- **Jedanaesterci** samo u eliminaciji; neriješeno u skupini ostaje neriješeno.
- **Sljedeća faza se popuni** tek kad su sve utakmice skupine završene. Ako treba ždrijeb, mjesto ostaje „1. A” dok organizator ne odredi redoslijed.
- **Ispravak rezultata** nakon što je momčad već upisana u sljedeću fazu: automatika je zamijeni samo ako ta utakmica još nije počela; inače organizator dobije upozorenje.
- **Excel uvoz** prima dva oblika: (a) kao u primjeru, redak = vrijeme, stupac = teren, ćelija „NK A – NK B”; (b) ravna tablica Datum / Vrijeme / Teren / Domaćin / Gost / Skupina. Skupina se pogodi iz popisa momčadi.
- Vremena su u zoni `Europe/Zagreb`.
- Aplikacija ide u mapu **`turnir/`** ovog repozitorija (na Vercelu se postavi *Root Directory* = `turnir`), da ne dira postojeći Ponte.

## 4. Pitanja

1. Je li u redu mapa `turnir/` u repozitoriju `fran`, ili želiš novi repozitorij?
2. Utakmice za 5. – 8. mjesto: igraju li ih poraženi u četvrtfinalu? Igraju li 3. i 4. iz skupina nešto u nedjelju (9. – 16. mjesto)?
3. PIN zapisničara: 4 znamenke dovoljno? (zaštita: 5 pokušaja pa 15 minuta pauze)

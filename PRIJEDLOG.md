# Turnir: prijedlog sheme i ekrana (korak 1)

Shema baze: [`supabase/schema.sql`](supabase/schema.sql). Isprobana na Postgresu 16 sa simuliranim Supabaseom (storage, realtime).

## Pristup: tri PIN-a, bez e-maila i bez računa

| PIN | Tko | Što smije |
|---|---|---|
| Glavni PIN | organizator | uređivanje svega: turnir, momčadi, raspored, rezultati, pravila, PIN-ovi terena |
| PIN Terena 1 | zapisničar 1 | upis rezultata samo za utakmice na Terenu 1 |
| PIN Terena 2 | zapisničar 2 | upis rezultata samo za utakmice na Terenu 2 |

- Upiše se samo PIN; aplikacija iz njega zna tko je tko. Zato dva PIN-a u istom turniru ne smiju biti ista.
- Nema blokiranja nakon krivih pokušaja.
- Gledatelji ne vide dio za upis. Do njega se dolazi diskretnim linkom „Prijava” na dnu stranice.
- PIN ostaje zapamćen na mobitelu dok se osoba ne odjavi.
- PIN-ovi su u bazi spremljeni samo kao hash. Ako se zaboravi, organizator postavi novi.

## 1. Baza ukratko

| Tablica | Što drži |
|---|---|
| `tournaments` | naziv, `slug` za link (`/t/cataleya-cup-2026`), mjesto, datumi, logo, naslovna slika, 2 boje, opis, pravila, bodovi 3/1/0, **redoslijed kriterija** (`tiebreakers`) |
| `categories` | godište, naziv („2019. – U8”), trajanje utakmice, broj igrača |
| `fields` | Teren 1, Teren 2, link na Google Maps |
| `teams` | naziv kluba, kratki naziv, logo (po želji) |
| `groups` + `group_teams` | skupine A–D i momčadi u njima; `lot_rank` = ručni ždrijeb kad kriteriji ne razdvoje momčadi |
| `matches` | faza, skupina, oznaka (`ČF1`, `PF1`, `F`), momčadi **ili** mjesto (`1A`, `W:ČF1`, `L:PF2`), teren, početak, rezultat, jedanaesterci, status, `winner_place`/`loser_place` za konačni poredak, `teams_locked` za ručnu promjenu |
| `pins` | glavni PIN i PIN-ovi terena, **samo hash** |

**Pravila prolaska** upisuje organizator, izravno u mjesta utakmice. Primjer četvrtfinala iz zadatka:

| Oznaka | Domaćin | Gost |
|---|---|---|
| ČF1 | `1A` | `2B` |
| ČF2 | `1B` | `2A` |
| ČF3 | `1C` | `2D` |
| ČF4 | `1D` | `2C` |
| PF1 | `W:ČF1` | `W:ČF2` |
| PF2 | `W:ČF3` | `W:ČF4` |

Na ekranu se prikazuje „1. A”, „Pobjednik ČF1”, „Poraženi PF2” dok momčad nije poznata.

**Tablice skupina se ne spremaju.** Računa ih jedna čista TypeScript funkcija iz utakmica, ista u pregledniku i na serveru. Isto vrijedi za upis u sljedeću fazu.

**Prava (RLS):** svi čitaju, nitko ne piše izravno u bazu. Svaka izmjena ide preko serverske funkcije (`api/` na Vercelu), koja provjeri PIN i tek onda zapiše. PIN-ove ne može pročitati nitko. `matches` je u Supabase Realtime, pa se rezultati osvježavaju sami.

Nakon svakog upisanog rezultata server na jednom mjestu preračuna tablice i upiše momčadi u sljedeću fazu, prema pravilima koja je upisao organizator.

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

**Prijava** `/t/:turnir/prijava`: jedno polje za PIN.

**Zapisničar terena**
11. Popis današnjih utakmica na njegovom terenu (sljedeća na vrhu).
12. Upis: velike tipke **+ / −** za oba tima, Počni / Završi, jedanaesterci po potrebi. Radi i uz slab signal (šalje kad se veza vrati).

**Organizator** (glavni PIN)
14. Moji turniri + Novi turnir.
15. Postavke turnira: osnovno, logo, boje, opis, pravila, kriteriji kod jednakih bodova (poredak povlačenjem), objavi.
16. Kategorije.
17. Tereni i PIN-ovi (glavni i za svaki teren).
18. Momčadi i skupine (brzi unos: jedna momčad po retku).
19. Raspored: popis utakmica, dodaj / uredi, **uvoz iz Excela** (pregled prije spremanja, javlja nepoznate momčadi).
20. Pravila ždrijeba: organizator upiše utakmice sljedeće faze i tko u njih ulazi; termin i teren za svaku utakmicu.
21. Rezultati: brzi upis i ispravak, ručna promjena momčadi u utakmici (zaključa je od automatike), ručni ždrijeb kod jednakih momčadi.

**Demo način**: ako nema Supabase varijabli, aplikacija radi s podacima Cataleya Cupa u `localStorage`. Demo PIN-ovi: glavni `9000`, Teren 1 `1111`, Teren 2 `2222`.

## 3. Pravila natjecanja

Aplikacija ne izmišlja nogometna pravila. Organizator upisuje:
- bodove za pobjedu, neriješeno i poraz (zadano 3 / 1 / 0),
- redoslijed kriterija kod jednakih bodova (zadano: međusobni susret → gol-razlika → više postignutih golova → ždrijeb),
- tko ulazi u koju utakmicu sljedeće faze, i za koje mjesto se igra,
- tekst pravila turnira, koji gledatelji vide na stranici Info.

Jedanaesterci se mogu upisati u bilo kojoj utakmici. Ako kriteriji ne razdvoje momčadi, organizator ručno odredi redoslijed.


## 4. Pitanja

1. Na slici turnira piše **NK Nova Zora**, a u zadatku **NŠK Nova Zora**. Koji je naziv točan?

# Cataleya Cup u App Storeu i Google Playu

Mobilne aplikacije su ista web aplikacija, zapakirana Capacitorom
(`android/`, `ios/`, `capacitor.config.ts`). Što se popravi na webu,
nakon `npm run app:sync` vrijedi i u aplikacijama.

- ID aplikacije: `hr.cataleyacup.app`
- Naziv: **Cataleya Cup**
- Ikona i početni ekran: `assets/` (bijeli cvijet na zelenoj #019C61);
  nakon promjene `npx @capacitor/assets generate`.
- Pravila privatnosti: https://cataleya.klubapp.hr/privatnost

## 1. Računi (napravi odmah, traje)

| Što | Cijena | Napomena |
|---|---|---|
| Apple Developer Program, kao organizacija | 99 USD godišnje | Treba **D-U-N-S broj** udruge ili kluba (besplatan, do 2 tjedna). Prijava na developer.apple.com. |
| Google Play Console, kao organizacija | 25 USD jednokratno | play.google.com/console. Za organizaciju isto traži D-U-N-S. |
| Firebase projekt | besplatno | console.firebase.google.com, projekt „Cataleya Cup”. Treba za obavijesti. |

Za organizaciju trebaju: puni naziv, OIB, adresa, web stranica, e-mail i
telefon za kontakt.

## 2. Firebase (obavijesti u aplikacijama)

1. U Firebaseu dodaj **Android aplikaciju** s ID-jem `hr.cataleyacup.app` i
   preuzmi `google-services.json` → stavi u `android/app/`.
2. Dodaj **iOS aplikaciju** s istim ID-jem i preuzmi
   `GoogleService-Info.plist` → u Xcodeu ga dodaj u `App/App`.
3. Za iPhone: u Apple Developeru napravi **APNs ključ** (Keys → +, Apple Push
   Notifications service) i učitaj ga u Firebase (Project settings → Cloud
   Messaging → Apple app configuration).
4. Firebase → Project settings → Service accounts → **Generate new private
   key**. Taj JSON je tajna: upiši ga u Supabase kao tajnu Edge Functiona
   `FIREBASE_SERVICE_ACCOUNT` (Supabase → Edge Functions → Secrets). Nikad ga
   ne stavljaj u repozitorij.

Bez tog koraka aplikacije rade, samo bez obavijesti. Web obavijesti rade i
dalje.

## 3. Izrada

Android (bilo koje računalo s Android Studijem):

```bash
npm install
npm run app:android      # izradi web, kopira u android/ i otvori Android Studio
```

U Android Studiju: Build → Generate Signed App Bundle → `.aab` → Google Play
Console → Internal testing pa Production.

iPhone (treba Mac s Xcodeom):

```bash
npm install
npm run app:ios          # otvori Xcode
```

U Xcodeu: Signing & Capabilities → tim (Apple Developer račun), dodaj
**Push Notifications** i **Background Modes → Remote notifications**.
Zatim Product → Archive → Distribute → App Store Connect → TestFlight pa
pregled.

## 4. Što trgovine traže

- **Opis** (hrvatski i engleski), 3–6 snimki ekrana (mobitel), ikona 1024×1024
  (`assets/icon-only.png`).
- **Kategorija**: Sport. **Dob**: 4+ / Everyone.
- **Privatnost**: aplikacija ne prikuplja osobne podatke; obavijesti koriste
  token uređaja (vidi /privatnost). U App Storeu: „Data Not Collected”, osim
  „Device ID” za obavijesti ako Apple to traži.
- **Prijava za pregled**: Apple traži testni pristup. Daj im PIN nekog
  turnira u demo/skica stanju ili napiši da gledatelji ne trebaju prijavu.
- Apple ponekad odbija aplikacije koje su „samo web stranica” (pravilo 4.2).
  Ova ima prave obavijesti, rad bez signala i ikone na početnom zaslonu, što
  obično prolazi. Ako odbiju, u odgovoru istakni obavijesti o golovima za
  praćene klubove i offline rad zapisničara.

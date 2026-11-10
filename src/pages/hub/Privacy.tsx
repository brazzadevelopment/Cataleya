import { PageTitle } from '../../components/HubLayout';

/** Pravila privatnosti (traže ih App Store i Google Play). */
export function Privacy() {
  return (
    <div className="space-y-4 text-[14px] leading-relaxed text-white/80">
      <PageTitle sub="Vrijedi od 10. 11. 2026.">Privatnost</PageTitle>
      <p>
        Aplikacija Cataleya Cup prikazuje raspored, rezultate, tablice i ždrijeb nogometnih turnira Cataleya Cup. Za gledanje ne treba
        račun ni prijava.
      </p>
      <h2 className="heading text-base text-white">Što aplikacija ne prikuplja</h2>
      <p>
        Ne traži i ne sprema ime, e-mail, broj mobitela, lokaciju ni fotografije. Ne sprema imena ni druge podatke djece. Nema oglasa ni
        praćenja korisnika.
      </p>
      <h2 className="heading text-base text-white">Što ostaje samo na tvom uređaju</h2>
      <p>Klubovi koje pratiš, odabrano godište i postavke obavijesti spremaju se samo na tvom uređaju.</p>
      <h2 className="heading text-base text-white">Obavijesti</h2>
      <p>
        Ako uključiš obavijesti, server sprema adresu za obavijesti koju daje tvoj uređaj (Apple, Google ili preglednik) i popis klubova
        koje pratiš, da bi znao kome poslati obavijest o golu, početku, kraju utakmice ili kartonu. Ta adresa ne otkriva tko si.
        Kad isključiš obavijesti, podatak se briše.
      </p>
      <h2 className="heading text-base text-white">Organizatori i zapisničari</h2>
      <p>Prijavljuju se PIN-om. PIN se sprema samo zaštićeno (kao hash), a prijava traje najviše četiri dana.</p>
      <h2 className="heading text-base text-white">Gdje su podaci</h2>
      <p>Podaci o turnirima su na serverima u Europskoj uniji (Supabase, Frankfurt). Stranica se poslužuje preko Vercela.</p>
      <h2 className="heading text-base text-white">Kontakt</h2>
      <p>Za pitanja o privatnosti javi se organizatoru Cataleya Cupa.</p>
    </div>
  );
}

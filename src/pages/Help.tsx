import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icon, SectionTitle } from '../components/ui';
import { useTournament } from '../data/TournamentContext';
import { BackLink } from './MatchPage';

function Steps({ children }: { children: ReactNode }) {
  return <ol className="card list-none space-y-0 divide-y divide-line p-0 [counter-reset:step]">{children}</ol>;
}

function Step({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <li className="flex gap-3 px-4 py-3 [counter-increment:step] before:grid before:size-7 before:shrink-0 before:place-items-center before:rounded-full before:bg-gold before:text-[13px] before:font-black before:text-pitch-950 before:content-[counter(step)]">
      <div className="min-w-0 text-[14px] leading-relaxed">
        <div className="font-bold">{title}</div>
        {children && <div className="mt-0.5 text-white/70">{children}</div>}
      </div>
    </li>
  );
}

function Tip({ children }: { children: ReactNode }) {
  return <div className="card p-4 text-[14px] leading-relaxed text-white/80">{children}</div>;
}

/** Upute za roditelje, igrače i klubove (gledatelje). */
export function HelpParents() {
  const { snap } = useTournament();
  const base = `/t/${snap.tournament.slug}`;
  return (
    <div>
      <BackLink />
      <h1 className="heading text-xl">Kako pratiti turnir</h1>
      <p className="mt-2 text-[14px] leading-relaxed text-white/70">
        Za roditelje, igrače i klubove. Ne treba prijava ni lozinka, a aplikacija ne traži nikakve podatke o djeci.
      </p>

      <SectionTitle>Prvi put</SectionTitle>
      <Steps>
        <Step title="Otvori link ili skeniraj QR kod">Link dobiješ od kluba ili organizatora, a QR kod je na plakatu uz teren.</Step>
        <Step title="Dodaj aplikaciju na početni zaslon">
          iPhone: u Safariju dodirni Dijeli, pa „Dodaj na početni zaslon”. Android: u Chromeu dodirni ⋮, pa „Instaliraj aplikaciju”. Otvara se kao prava aplikacija.
        </Step>
        <Step title="Odaberi godište">Gore ispod naziva turnira: 2016., 2017., 2018. ili 2019.</Step>
        <Step title="Označi svoju momčad zvjezdicom">
          Dodirni <Icon name="star" className="inline size-4 -translate-y-px text-gold" /> uz ime momčadi. Možeš označiti i više momčadi, u različitim godištima.
        </Step>
      </Steps>

      <SectionTitle>Što gdje naći</SectionTitle>
      <div className="card divide-y divide-line text-[14px] leading-relaxed">
        {[
          ['star', 'Moje', 'Samo utakmice tvojih momčadi: odigrane s rezultatom, sljedeće s vremenom i terenom.'],
          ['home', 'Početna', 'Utakmice koje se upravo igraju, sljedeće utakmice i tvoje momčadi.'],
          ['calendar', 'Raspored', 'Sve utakmice po danima. Filter po terenu ili momčadi.'],
          ['table', 'Tablice', 'Poredak u skupinama i poredak drugoplasiranih. Žuto: ide u A turnir, tirkizno: ide u B turnir.'],
          ['bracket', 'Ždrijeb', 'Osmina finala i dalje, posebno za A i B turnir. Momčadi se upisuju same kad završe skupine.'],
        ].map(([icon, title, text]) => (
          <div key={title} className="flex gap-3 px-4 py-3">
            <Icon name={icon} className="mt-0.5 size-5 shrink-0 text-gold" />
            <div><b>{title}:</b> <span className="text-white/75">{text}</span></div>
          </div>
        ))}
      </div>

      <SectionTitle>Dobro je znati</SectionTitle>
      <div className="space-y-3">
        <Tip><b>Obavijesti na mobitel.</b> Za svaki gol, početak, kraj i karton tvojih momčadi. Uključuju se u Moje, a <Link to={`${base}/obavijesti`} className="font-bold text-gold">ovdje su upute i video</Link>.</Tip>
        <Tip><b>Rezultat uživo.</b> Zapisničar uz teren upisuje golove, a rezultat se kod tebe osvježi sam za sekundu-dvije. Ne treba osvježavati stranicu.</Tip>
        <Tip><b>Gdje je teren?</b> Otvori utakmicu: piše teren i lokacija. Popis svih terena je u <Link to={`${base}/info`} className="font-bold text-gold">O turniru</Link>.</Tip>
        <Tip><b>Podijeli.</b> Svaka utakmica i momčad ima gumb Podijeli (WhatsApp, Instagram, link).</Tip>
        <Tip><b>Privatnost.</b> Aplikacija ne sprema imena ni podatke djece. Tvoje zvjezdice ostaju samo na tvom mobitelu.</Tip>
        <Tip><b>Nešto ne štima?</b> Ako je rezultat ili raspored pogrešan, javi se organizatoru turnira. Samo organizator i zapisničari mogu mijenjati podatke.</Tip>
      </div>
    </div>
  );
}

/** Upute za zapisničara terena. */
export function HelpScorekeeper() {
  const { snap } = useTournament();
  const base = `/t/${snap.tournament.slug}`;
  return (
    <div>
      <BackLink />
      <h1 className="heading text-xl">Upute za zapisničara</h1>
      <p className="mt-2 text-[14px] leading-relaxed text-white/70">
        Ti upisuješ rezultate utakmica na svom terenu. Roditelji ih odmah vide na mobitelima, a tablice i ždrijeb se računaju sami.
      </p>

      <SectionTitle>Prije prve utakmice</SectionTitle>
      <Steps>
        <Step title="Uzmi PIN od organizatora">Svaki teren ima svoj PIN. S njim vidiš i upisuješ samo utakmice svog terena.</Step>
        <Step title="Prijavi se">
          Otvori aplikaciju, na dnu početne dodirni <Link to={`${base}/prijava`} className="font-bold text-gold">Prijava</Link> i upiši PIN. Ostaješ prijavljen do kraja turnira, pa se ne odjavljuj.
        </Step>
        <Step title="Provjeri popis">Vidiš utakmice svog terena, sljedeća je na vrhu. Provjeri jesu li momčadi i vrijeme točni.</Step>
      </Steps>

      <SectionTitle>Za vrijeme utakmice</SectionTitle>
      <Steps>
        <Step title="Dodirni utakmicu">Otvara se ekran s dvije momčadi i velikim tipkama.</Step>
        <Step title="Počni utakmicu">Kad sudac zazviždi početak. Gledatelji tada vide „Uživo”.</Step>
        <Step title="Gol: veliki žuti +">Ispod momčadi koja je zabila. Pogriješio si? Dodirni − ispod te momčadi.</Step>
        <Step title="Kartoni">Ispod rezultata, za svaku momčad: + uz žuti ili crveni karton. Kartoni su važni kad su momčadi izjednačene u tablici.</Step>
        <Step title="Kraj utakmice">Kad sudac zazviždi kraj. Tablica i ždrijeb se odmah preračunaju.</Step>
      </Steps>

      <SectionTitle>Osmina finala i dalje</SectionTitle>
      <Tip>
        Ako je utakmica neriješena, izvode se jedanaesterci. Upiši ih u dijelu <b>Jedanaesterci</b> (+ za svaki pogođeni). Utakmica se ne može završiti dok jedanaesterci ne odluče pobjednika.
      </Tip>

      <SectionTitle>Kad nešto pođe krivo</SectionTitle>
      <div className="space-y-3">
        <Tip><b>Krivi rezultat nakon kraja:</b> otvori utakmicu i dodirni <b>Ispravi rezultat</b>, popravi i ponovno <b>Kraj utakmice</b>.</Tip>
        <Tip><b>Nema signala:</b> nastavi upisivati. Rezultat se sprema na mobitelu i šalje sam kad se veza vrati. To piše žutom porukom.</Tip>
        <Tip><b>Ne vidiš utakmicu ili su krive momčadi:</b> javi organizatoru. On može promijeniti momčadi, vrijeme i teren.</Tip>
        <Tip><b>Odjavio si se ili je mobitel ugašen:</b> ponovno Prijava i isti PIN.</Tip>
      </div>

      <SectionTitle>Savjeti</SectionTitle>
      <Tip>
        Ponesi punjač ili powerbank i pojačaj svjetlinu ekrana. Ne upisuj imena djece ni druge osobne podatke.
      </Tip>
    </div>
  );
}

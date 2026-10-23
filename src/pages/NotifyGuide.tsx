import { useState, type ReactNode } from 'react';
import { NotificationsCard } from '../components/Notifications';
import { Button, Chip, Icon, SectionTitle } from '../components/ui';
import { canInstall, isIos, isStandalone, promptInstall } from '../lib/push';
import { BackLink } from './MatchPage';

function Steps({ children }: { children: ReactNode }) {
  return <ol className="card list-none p-0 divide-y divide-line [counter-reset:step]">{children}</ol>;
}

function Step({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <li className="flex gap-3 px-4 py-3 [counter-increment:step] before:grid before:size-7 before:shrink-0 before:place-items-center before:rounded-full before:bg-gold before:text-[13px] before:font-black before:text-pitch-950 before:content-[counter(step)]">
      <div className="min-w-0 text-[14px] leading-relaxed">
        <div className="font-bold">{title}</div>
        {children && <div className="mt-0.5 text-white/70">{children}</div>}
      </div>
    </li>
  );
}

function Video({ name }: { name: string }) {
  return (
    <video
      className="card mx-auto block aspect-[9/16] w-full max-w-[300px] bg-black object-cover"
      src={`/upute/${name}.mp4`}
      poster={`/upute/${name}.jpg`}
      controls
      playsInline
      muted
      preload="none"
    />
  );
}

/** Kako dodati aplikaciju na početni zaslon i uključiti obavijesti. */
export function NotifyGuide() {
  const [tab, setTab] = useState<'iphone' | 'android'>(() => (isIos() ? 'iphone' : 'android'));
  const [installable, setInstallable] = useState(canInstall);
  const installed = isStandalone();

  return (
    <div>
      <BackLink />
      <h1 className="heading text-xl">Obavijesti na mobitel</h1>
      <p className="mt-2 text-[14px] leading-relaxed text-white/70">
        Dobij obavijest kad tvoja momčad zabije gol, kad utakmica počne i završi, i za svaki karton. Treba samo jednom namjestiti.
      </p>

      {installed && (
        <div className="card mt-4 flex items-center gap-2.5 p-3 text-[14px]">
          <Icon name="check" className="size-5 text-gold" /> Aplikacija je već na početnom zaslonu. Samo uključi obavijesti ispod.
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <Chip active={tab === 'iphone'} onClick={() => setTab('iphone')}>iPhone</Chip>
        <Chip active={tab === 'android'} onClick={() => setTab('android')}>Android</Chip>
      </div>

      {tab === 'iphone' ? (
        <>
          <SectionTitle>Video</SectionTitle>
          <Video name="iphone" />
          <SectionTitle>Korak po korak</SectionTitle>
          <Steps>
            <Step title="Otvori stranicu u Safariju">U Chromeu ili Facebooku na iPhoneu ne ide; mora biti Safari.</Step>
            <Step title={<>Dodirni Dijeli <span className="text-white/60">(kvadrat sa strelicom prema gore)</span></>}>Na dnu ekrana, ili gore desno na iPadu.</Step>
            <Step title="Odaberi „Dodaj na početni zaslon”">Ako ga ne vidiš, pomakni popis prema dolje. Zatim dodirni „Dodaj”.</Step>
            <Step title="Otvori Cataleya Cup s početnog zaslona">Ikona s cvijetom. Od sada aplikaciju otvaraj s te ikone.</Step>
            <Step title="Označi svoju momčad zvjezdicom">Možeš i više momčadi.</Step>
            <Step title="Moje → Uključi obavijesti → Dopusti">iPhone pita smije li aplikacija slati obavijesti. Dodirni „Dopusti”.</Step>
          </Steps>
          <p className="mt-2 text-[12px] text-white/50">Treba iOS 16.4 ili noviji (Postavke → Općenito → Informacije).</p>
        </>
      ) : (
        <>
          <SectionTitle>Video</SectionTitle>
          <Video name="android" />
          <SectionTitle>Korak po korak</SectionTitle>
          {installable && !installed && (
            <Button className="mb-3 w-full" onClick={() => void promptInstall().then(() => setInstallable(false))}>
              Instaliraj aplikaciju
            </Button>
          )}
          <Steps>
            <Step title="Otvori stranicu u Chromeu" />
            <Step title={<>Dodirni ⋮ gore desno</>}>Pa „Dodaj na početni zaslon” ili „Instaliraj aplikaciju”. Može i bez toga, ali je ovako lakše.</Step>
            <Step title="Označi svoju momčad zvjezdicom">Možeš i više momčadi.</Step>
            <Step title="Moje → Uključi obavijesti → Dopusti">Mobitel pita smije li stranica slati obavijesti. Dodirni „Dopusti”.</Step>
          </Steps>
        </>
      )}

      <SectionTitle>Uključi ili isključi</SectionTitle>
      <NotificationsCard />

      <SectionTitle>Dobro je znati</SectionTitle>
      <div className="card divide-y divide-line text-[14px] leading-relaxed">
        <p className="px-4 py-3"><b>Isključivanje:</b> Moje → Isključi obavijesti. Možeš isključiti i samo golove, kartone ili početak i kraj.</p>
        <p className="px-4 py-3"><b>Druga momčad:</b> obavijesti stižu za sve momčadi sa zvjezdicom. Makni zvjezdicu i obavijesti za tu momčad prestaju.</p>
        <p className="px-4 py-3"><b>Kad stižu:</b> čim zapisničar upiše gol. Ako se rezultat upiše tek na kraju, stigne samo obavijest o kraju.</p>
        <p className="px-4 py-3"><b>Privatnost:</b> ne treba ime, e-mail ni broj mobitela.</p>
      </div>
    </div>
  );
}

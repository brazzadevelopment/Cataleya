import { PageTitle } from '../../components/HubLayout';
import { useOrgSession } from '../../data/follow';
import { RowLink } from './common';

/** Sve ostalo: o nama, vijesti, galerija, video, sponzori, kontakt… */
export function More() {
  const org = useOrgSession();
  const groups: [string, string, string, string?][][] = [
    [
      ['/vijesti', 'news', 'Vijesti'],
      ['/galerija', 'image', 'Galerija'],
      ['/video', 'play', 'Video', 'Prijenosi uživo i snimke'],
      ['/sponzori', 'gem', 'Sponzori'],
    ],
    [
      ['/klubovi', 'users', 'Klubovi', 'Rezultati kluba kroz sve turnire'],
      ['/pobjednici', 'trophy', 'Pobjednici'],
      ['/obavijesti', 'bell', 'Obavijesti', 'Obavijest za svaki gol tvog kluba'],
    ],
    [
      ['/o-nama', 'info', 'O nama'],
      ['/kontakt', 'mail', 'Kontakt'],
      ['/impresum', 'file', 'Impresum'],
      ['/privatnost', 'lock', 'Privatnost'],
      [org ? '/organizacija' : '/prijava', 'key', 'Za organizatore', 'Prijava PIN-om'],
    ],
  ];
  return (
    <div>
      <PageTitle>Više</PageTitle>
      <div className="mt-3 space-y-3">
        {groups.map((g, i) => (
          <div key={i} className="card divide-y divide-line">
            {g.map(([to, icon, title, sub]) => <RowLink key={to} to={to} icon={icon} title={title} sub={sub} />)}
          </div>
        ))}
      </div>
      <p className="mt-6 text-center text-[12px] text-white/55">Cataleya Cup · međunarodni nogometni turnir za djecu · Zadar</p>
    </div>
  );
}

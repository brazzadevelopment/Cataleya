// Primjer sadržaja za demo način (i za izgled dok organizacija ne upiše svoje).
// Sponzori su mjesta za logotipe (organizacija ih zamijeni pravima).
import type { SiteContent } from '../lib/types';

/** Jednostavan logo-natpis (SVG) za primjer sponzora. */
export function sampleLogo(text: string, color: string, sub = ''): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 96"><rect width="240" height="96" rx="14" fill="#fff"/>` +
    `<circle cx="44" cy="48" r="24" fill="${color}"/><text x="44" y="56" font-family="Arial,sans-serif" font-size="24" font-weight="900" fill="#fff" text-anchor="middle">${text[0]}</text>` +
    `<text x="80" y="${sub ? 50 : 58}" font-family="Arial,sans-serif" font-size="${text.length > 9 ? 19 : 24}" font-weight="800" fill="#1f2a24">${text}</text>` +
    (sub ? `<text x="81" y="72" font-family="Arial,sans-serif" font-size="13" font-weight="600" fill="#6b7a71">${sub}</text>` : '') +
    `</svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

export const SAMPLE_SPONSORS: [string, string, string, 'glavni' | 'zlatni' | 'partner'][] = [
  ['Glavni sponzor', '#1f6fb2', 'vaš logo ovdje', 'glavni'],
  ['Zlatni sponzor', '#e0663a', 'vaš logo ovdje', 'zlatni'],
  ['Zlatni sponzor', '#8a4fd6', 'vaš logo ovdje', 'zlatni'],
  ['Partner', '#0f8f86', 'vaš logo ovdje', 'partner'],
  ['Partner', '#3d5a80', 'vaš logo ovdje', 'partner'],
  ['Partner', '#c0392b', 'vaš logo ovdje', 'partner'],
];

export function sampleContent(): SiteContent {
  const day = (d: number) => new Date(Date.now() - d * 86400000).toISOString();
  return {
    news: [
      { id: 'n1', title: 'Otvorene prijave za Cataleya Indoor', summary: 'Zimski turnir u dvorani u Svetom Filipu i Jakovu. Prijave klubova su otvorene.', body: 'Zimski Cataleya Indoor igra se u siječnju u sportskoj dvorani u Svetom Filipu i Jakovu.\n\nKlubovi se mogu prijaviti preko kontakt forme u aplikaciji. Točan raspored objavit ćemo kad se zaključe prijave.', image_path: null, published_at: day(1), is_published: true },
      { id: 'n2', title: 'Hvala svima na Cataleya Cupu 2026!', summary: 'Tri dana nogometa, stotine golova i puno osmijeha. Pogledajte pobjednike po godištima.', body: 'Hvala svim klubovima, trenerima, roditeljima i djeci koji su bili s nama u Zadru.\n\nSvi rezultati, tablice i pobjednici i dalje su u aplikaciji.', image_path: null, published_at: day(16), is_published: true },
      { id: 'n3', title: 'Nova aplikacija Cataleya Cupa', summary: 'Raspored, rezultati uživo, tablice i obavijesti za svaki gol tvog kluba.', body: 'Sve o turnirima Cataleya Cupa sada je na jednom mjestu. Označi svoj klub zvjezdicom i uključi obavijesti.', image_path: null, published_at: day(20), is_published: true },
    ],
    gallery: [],
    videos: [],
    sponsors: SAMPLE_SPONSORS.map(([name, color, sub, tier], i) => ({
      id: `s${i}`, name, logo_path: sampleLogo(name, color, sub), url: null, tier, sort_order: i, is_active: true,
    })),
    settings: {
      about: 'Cataleya Cup je međunarodni nogometni turnir za mlade nogometaše koji se u Zadru održava od 2022. godine.',
      instagram: 'https://www.instagram.com/cataleya.cup/',
      website: 'https://cataleya-cup.com',
      youtube: 'https://www.youtube.com/@cataleyacup',
      publisher: 'Cataleya Cup',
      address: 'Zadar, Hrvatska',
    },
  };
}

import { Link, useParams } from 'react-router-dom';
import { PageTitle } from '../../components/HubLayout';
import { Empty } from '../../components/ui';
import { publishedNews, useContent } from '../../data/content';
import { assetUrl } from '../../data/source';
import { Splash } from '../../data/TournamentContext';
import { BackLink } from '../MatchPage';
import type { NewsItem } from '../../lib/types';
import { newsDate, Paragraphs } from './common';

export function NewsCard({ n, big = false }: { n: NewsItem; big?: boolean }) {
  const img = assetUrl(n.image_path);
  return (
    <Link to={`/vijesti/${n.id}`} className="card block overflow-hidden">
      {img && <img src={img} alt="" className={`w-full object-cover ${big ? 'aspect-[16/9]' : 'aspect-[2/1]'}`} />}
      <div className="p-4">
        <div className="text-[11px] font-bold tracking-wider text-white/60 uppercase">{newsDate(n.published_at)}</div>
        <div className="mt-1 text-[16px] font-extrabold leading-snug">{n.title}</div>
        {n.summary && <p className="mt-1.5 text-[13px] leading-relaxed text-white/75">{n.summary}</p>}
      </div>
    </Link>
  );
}

export function NewsList() {
  const c = useContent();
  if (!c) return <Splash text="Učitavam…" />;
  const list = publishedNews(c);
  return (
    <div>
      <PageTitle>Vijesti</PageTitle>
      <div className="mt-3 space-y-3">
        {list.length ? list.map((n, i) => <NewsCard key={n.id} n={n} big={i === 0} />) : <Empty>Još nema vijesti.</Empty>}
      </div>
    </div>
  );
}

export function NewsPage() {
  const { id } = useParams();
  const c = useContent();
  if (!c) return <Splash text="Učitavam…" />;
  const n = publishedNews(c).find((x) => x.id === id);
  if (!n) return <div><BackLink /><Empty>Vijest nije pronađena.</Empty></div>;
  const img = assetUrl(n.image_path);
  return (
    <article>
      <BackLink />
      {img && <img src={img} alt="" className="card mb-4 aspect-[16/9] w-full object-cover" />}
      <div className="text-[12px] font-bold tracking-wider text-white/60 uppercase">{newsDate(n.published_at)}</div>
      <h1 className="heading mt-1 text-[22px] leading-tight">{n.title}</h1>
      {n.summary && <p className="mt-3 text-[16px] font-semibold leading-relaxed">{n.summary}</p>}
      <Paragraphs text={n.body} className="mt-4" />
    </article>
  );
}

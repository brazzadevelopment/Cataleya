import { useState } from 'react';
import { Button, Icon, SectionTitle } from '../components/ui';
import { useTournament } from '../data/TournamentContext';
import type { Mutation } from '../lib/mutations';
import type { Category, Team } from '../lib/types';
import { Field, Input, newId, Sheet, Status, TextArea, useSave } from './kit';

export function TeamsTab() {
  const { snap, categoryId, setCategoryId } = useTournament();
  const { save, status, busy } = useSave();
  const [editTeam, setEditTeam] = useState<Team | null>(null);
  const [editCat, setEditCat] = useState<Category | 'new' | null>(null);
  const [bulk, setBulk] = useState<{ groupId: string | null } | null>(null);

  const groups = snap.groups.filter((g) => g.category_id === categoryId).sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  const teams = snap.teams.filter((t) => t.category_id === categoryId);
  const groupOf = (teamId: string) => snap.groupTeams.find((g) => g.team_id === teamId)?.group_id ?? null;
  const ungrouped = teams.filter((t) => !groupOf(t.id));

  async function addGroup() {
    const used = new Set(groups.map((g) => g.name));
    const name = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').find((l) => !used.has(l)) ?? 'Z';
    await save([{ type: 'upsert', table: 'groups', row: { id: newId(), category_id: categoryId, name, sort_order: groups.length } }]);
  }

  async function moveTeam(team: Team, groupId: string | null) {
    const m: Mutation[] = [];
    if (groupOf(team.id)) m.push({ type: 'delete', table: 'group_teams', id: team.id });
    if (groupId) m.push({ type: 'upsert', table: 'group_teams', row: { category_id: categoryId, group_id: groupId, team_id: team.id, lot_rank: null } });
    await save(m);
  }

  return (
    <div>
      <SectionTitle action={<button type="button" onClick={() => setEditCat('new')} className="text-[12px] font-bold text-gold">+ Kategorija</button>}>
        Kategorije
      </SectionTitle>
      <div className="flex flex-wrap gap-2">
        {snap.categories.map((c) => (
          <button key={c.id} type="button" onClick={() => (c.id === categoryId ? setEditCat(c) : setCategoryId(c.id))}
            className={`inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-[13px] font-bold ${c.id === categoryId ? 'bg-gold text-pitch-950' : 'bg-white/8 ring-1 ring-white/12'}`}>
            {c.name}{c.id === categoryId && <Icon name="edit" className="size-3.5" />}
          </button>
        ))}
      </div>

      {[...groups, null].map((g) => {
        const list = g ? teams.filter((t) => groupOf(t.id) === g.id) : ungrouped;
        if (!g && !list.length) return null;
        return (
          <section key={g?.id ?? 'none'}>
            <SectionTitle action={
              <span className="flex gap-3">
                <button type="button" onClick={() => setBulk({ groupId: g?.id ?? null })} className="text-[12px] font-bold text-gold">+ Momčadi</button>
                {g && list.length === 0 && (
                  <button type="button" onClick={() => save([{ type: 'delete', table: 'groups', id: g.id }])} className="text-[12px] font-bold text-white/45">Obriši</button>
                )}
              </span>
            }>
              {g ? `Skupina ${g.name}` : 'Bez skupine'}
            </SectionTitle>
            <div className="card divide-y divide-line">
              {list.map((t) => (
                <div key={t.id} className="flex items-center gap-2 py-1.5 pl-3.5 pr-1.5">
                  <button type="button" onClick={() => setEditTeam(t)} className="min-w-0 flex-1 truncate text-left text-[14px] font-bold">{t.name}</button>
                  <select
                    value={g?.id ?? ''}
                    onChange={(e) => void moveTeam(t, e.target.value || null)}
                    aria-label="Skupina"
                    className="h-9 rounded-lg bg-white/8 px-2 text-[12px] font-bold ring-1 ring-white/12"
                  >
                    <option value="">—</option>
                    {groups.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                  </select>
                </div>
              ))}
              {!list.length && <p className="px-3.5 py-3 text-[13px] text-white/45">Prazno</p>}
            </div>
          </section>
        );
      })}

      <div className="mt-5 flex items-center gap-3">
        <Button variant="ghost" onClick={addGroup} disabled={busy}><Icon name="plus" className="size-4" /> Skupina</Button>
        <Status status={status} />
      </div>

      {editTeam && <TeamEditor team={editTeam} onClose={() => setEditTeam(null)} />}
      {editCat && <CategoryEditor category={editCat === 'new' ? null : editCat} onClose={() => setEditCat(null)} />}
      {bulk && <BulkTeams groupId={bulk.groupId} onClose={() => setBulk(null)} />}
    </div>
  );
}

function TeamEditor({ team, onClose }: { team: Team; onClose(): void }) {
  const [name, setName] = useState(team.name);
  const [short, setShort] = useState(team.short_name ?? '');
  const { save, status, busy } = useSave();
  return (
    <Sheet title="Momčad" onClose={onClose}>
      <form className="space-y-3" onSubmit={async (e) => {
        e.preventDefault();
        if (await save([{ type: 'upsert', table: 'teams', row: { id: team.id, category_id: team.category_id, name: name.trim(), short_name: short.trim() || null } }])) onClose();
      }}>
        <Field label="Naziv"><Input value={name} onChange={(e) => setName(e.target.value)} required /></Field>
        <Field label="Kratki naziv (po želji)"><Input value={short} onChange={(e) => setShort(e.target.value)} /></Field>
        <div className="flex items-center gap-2">
          <Button type="submit" disabled={busy}>Spremi</Button>
          <Button variant="danger" disabled={busy} onClick={async () => {
            if (confirm(`Obrisati ${team.name}? Utakmice ostaju, ali bez ove momčadi.`) && await save([{ type: 'delete', table: 'teams', id: team.id }])) onClose();
          }}>Obriši</Button>
          <Status status={status} />
        </div>
      </form>
    </Sheet>
  );
}

function BulkTeams({ groupId, onClose }: { groupId: string | null; onClose(): void }) {
  const { snap, categoryId } = useTournament();
  const [text, setText] = useState('');
  const { save, status, busy } = useSave();
  return (
    <Sheet title="Dodaj momčadi" onClose={onClose}>
      <form className="space-y-3" onSubmit={async (e) => {
        e.preventDefault();
        const existing = new Set(snap.teams.filter((t) => t.category_id === categoryId).map((t) => t.name.toLowerCase()));
        const names = [...new Set(text.split('\n').map((s) => s.trim()).filter(Boolean))].filter((n) => !existing.has(n.toLowerCase()));
        const m: Mutation[] = [];
        for (const name of names) {
          const id = newId();
          m.push({ type: 'upsert', table: 'teams', row: { id, category_id: categoryId, name } });
          if (groupId) m.push({ type: 'upsert', table: 'group_teams', row: { category_id: categoryId, group_id: groupId, team_id: id, lot_rank: null } });
        }
        if (m.length && await save(m, `Dodano ${names.length}.`)) onClose();
      }}>
        <Field label="Jedna momčad po retku"><TextArea value={text} onChange={(e) => setText(e.target.value)} className="min-h-48" placeholder={'NK Arbanasi\nNK Zagreb'} autoFocus /></Field>
        <div className="flex items-center gap-2"><Button type="submit" disabled={busy}>Dodaj</Button><Status status={status} /></div>
      </form>
    </Sheet>
  );
}

function CategoryEditor({ category, onClose }: { category: Category | null; onClose(): void }) {
  const { snap, setCategoryId } = useTournament();
  const [c, setC] = useState<Omit<Category, 'tournament_id'>>(category ?? {
    id: newId(), name: '', birth_year: null, match_minutes: 25, players_on_field: null, sort_order: snap.categories.length,
  });
  const { save, status, busy } = useSave();
  return (
    <Sheet title={category ? 'Kategorija' : 'Nova kategorija'} onClose={onClose}>
      <form className="space-y-3" onSubmit={async (e) => {
        e.preventDefault();
        if (await save([{ type: 'upsert', table: 'categories', row: { ...c } }])) {
          setCategoryId(c.id);
          onClose();
        }
      }}>
        <Field label="Naziv" hint="npr. 2019. – U8"><Input value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} required /></Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Godište"><Input type="number" value={c.birth_year ?? ''} onChange={(e) => setC({ ...c, birth_year: e.target.value ? Number(e.target.value) : null })} /></Field>
          <Field label="Minuta"><Input type="number" min={1} value={c.match_minutes} onChange={(e) => setC({ ...c, match_minutes: Number(e.target.value) })} required /></Field>
          <Field label="Igrača"><Input type="number" min={1} max={11} value={c.players_on_field ?? ''} onChange={(e) => setC({ ...c, players_on_field: e.target.value ? Number(e.target.value) : null })} /></Field>
        </div>
        <div className="flex items-center gap-2">
          <Button type="submit" disabled={busy}>Spremi</Button>
          {category && snap.categories.length > 1 && (
            <Button variant="danger" disabled={busy} onClick={async () => {
              if (confirm('Obrisati kategoriju sa svim momčadima i utakmicama?') && await save([{ type: 'delete', table: 'categories', id: category.id }])) onClose();
            }}>Obriši</Button>
          )}
          <Status status={status} />
        </div>
      </form>
    </Sheet>
  );
}

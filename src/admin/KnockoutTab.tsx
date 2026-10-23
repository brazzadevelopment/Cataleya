import { useState } from 'react';
import { Button, Empty, Icon, SectionTitle } from '../components/ui';
import { useTournament } from '../data/TournamentContext';
import { blankMatch } from '../data/seed';
import { sourceLabel } from '../lib/advancement';
import type { Mutation } from '../lib/mutations';
import { computeGroupTable } from '../lib/standings';
import type { Match, MatchStage } from '../lib/types';
import { byTime, fieldName, matchTime, STAGE_LABEL, STAGE_ORDER, teamName } from '../lib/view';
import { Input, newId, Status, useSave } from './kit';
import { MatchEditor } from './MatchEditor';

export function KnockoutTab() {
  const { snap, categoryId } = useTournament();
  const [editing, setEditing] = useState<Match | 'new' | null>(null);
  const { save, status, busy } = useSave();
  const ko = snap.matches.filter((m) => m.category_id === categoryId && m.stage !== 'group').sort(byTime);
  const codes = new Set(ko.map((m) => m.code));
  const canTemplate = ['ČF1', 'ČF2', 'ČF3', 'ČF4'].every((c) => codes.has(c)) && !['PF1', 'PF2', 'F', '3M'].some((c) => codes.has(c));

  async function addTemplate() {
    const mk = (code: string, label: string, stage: MatchStage, home: string, away: string, wp: number | null, lp: number | null): Mutation => {
      const { tournament_id: _t, ...row } = blankMatch({
        id: newId(), tournament_id: snap.tournament.id, category_id: categoryId, stage, code, label,
        home_source: home, away_source: away, winner_place: wp, loser_place: lp,
      });
      return { type: 'upsert', table: 'matches', row };
    };
    await save([
      mk('PF1', 'Polufinale 1', 'semifinal', 'W:ČF1', 'W:ČF2', null, null),
      mk('PF2', 'Polufinale 2', 'semifinal', 'W:ČF3', 'W:ČF4', null, null),
      mk('3M', 'Za 3. mjesto', 'third_place', 'L:PF1', 'L:PF2', 3, 4),
      mk('F', 'Finale', 'final', 'W:PF1', 'W:PF2', 1, 2),
    ], 'Dodano. Termine i terene upiši kad ih znaš.');
  }

  return (
    <div>
      <p className="mt-2 text-[13px] leading-relaxed text-white/65">
        Za svaku utakmicu nastavka upiši tko u nju ulazi, npr. <b>1A</b> (1. u skupini A), <b>W:ČF1</b> (pobjednik ČF1) ili <b>L:PF1</b> (poraženi PF1).
        Momčadi se upišu same kad su rezultati poznati.
      </p>
      <div className="mt-3 grid gap-2">
        <Button onClick={() => setEditing('new')}><Icon name="plus" className="size-4" /> Utakmica nastavka</Button>
        {canTemplate && (
          <Button variant="ghost" onClick={addTemplate} disabled={busy}>Dodaj polufinala, za 3. mjesto i finale</Button>
        )}
        <Status status={status} />
      </div>

      {ko.length === 0 && <div className="mt-4"><Empty>Još nema utakmica nastavka.</Empty></div>}
      {STAGE_ORDER.filter((s) => s !== 'group').map((stage) => {
        const list = ko.filter((m) => m.stage === stage);
        if (!list.length) return null;
        return (
          <section key={stage}>
            <SectionTitle>{STAGE_LABEL[stage]}</SectionTitle>
            <div className="card divide-y divide-line">
              {list.map((m) => (
                <button key={m.id} type="button" onClick={() => setEditing(m)} className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left">
                  <span className="w-10 shrink-0 text-[13px] font-black text-gold">{m.code ?? '—'}</span>
                  <div className="min-w-0 flex-1 text-[13px] leading-snug">
                    {(['home', 'away'] as const).map((side) => {
                      const id = side === 'home' ? m.home_team_id : m.away_team_id;
                      const src = sourceLabel(side === 'home' ? m.home_source : m.away_source);
                      return (
                        <div key={side} className="truncate">
                          <b>{teamName(snap, id) ?? src ?? '—'}</b>
                          {id && src && <span className="text-white/45"> · {src}</span>}
                        </div>
                      );
                    })}
                    <div className="truncate text-[11px] text-white/50">
                      {[matchTime(snap, m) ?? 'bez termina', fieldName(snap, m.field_id), m.winner_place && `mjesta ${m.winner_place}/${m.loser_place ?? '–'}`, m.teams_locked && 'ručno'].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <Icon name="edit" className="size-4 shrink-0 text-white/40" />
                </button>
              ))}
            </div>
          </section>
        );
      })}

      <LotSection />

      {editing && <MatchEditor match={editing === 'new' ? undefined : editing} stage="quarterfinal" onClose={() => setEditing(null)} />}
    </div>
  );
}

/** Ručni ždrijeb kad kriteriji ne razdvoje momčadi u završenoj skupini. */
function LotSection() {
  const { snap, categoryId } = useTournament();
  const { save, status, busy } = useSave();
  const [ranks, setRanks] = useState<Record<string, string>>({});
  const groups = snap.groups.filter((g) => g.category_id === categoryId);
  const tied = groups.map((g) => {
    const gts = snap.groupTeams.filter((gt) => gt.group_id === g.id);
    const table = computeGroupTable(gts, snap.matches.filter((m) => m.group_id === g.id && m.stage === 'group'), snap.tournament);
    return { g, gts, rows: table.complete ? table.rows.filter((r) => r.needsLot || gts.find((x) => x.team_id === r.teamId)?.lot_rank != null) : [] };
  }).filter((x) => x.rows.length);

  if (!tied.length) return null;

  return (
    <section>
      <SectionTitle>Ždrijeb kod izjednačenja</SectionTitle>
      <p className="mb-3 text-[13px] text-white/65">Ove momčadi nijedan kriterij nije razdvojio. Upiši redoslijed iz ždrijeba (1 = bolji).</p>
      {tied.map(({ g, gts, rows }) => (
        <div key={g.id} className="card mb-3 p-3">
          <div className="mb-2 text-[12px] font-extrabold text-gold uppercase">Skupina {g.name}</div>
          {rows.map((r) => {
            const gt = gts.find((x) => x.team_id === r.teamId)!;
            return (
              <div key={r.teamId} className="flex items-center gap-3 py-1">
                <span className="flex-1 text-[14px] font-bold">{teamName(snap, r.teamId)}</span>
                <Input
                  type="number" min={1} className="w-20 text-center"
                  value={ranks[r.teamId] ?? gt.lot_rank ?? ''}
                  onChange={(e) => setRanks({ ...ranks, [r.teamId]: e.target.value })}
                />
              </div>
            );
          })}
        </div>
      ))}
      <div className="flex items-center gap-3">
        <Button
          disabled={busy}
          onClick={() => save(Object.entries(ranks).map(([teamId, v]) => {
            const gt = snap.groupTeams.find((x) => x.team_id === teamId)!;
            return { type: 'upsert', table: 'group_teams', row: { category_id: gt.category_id, group_id: gt.group_id, team_id: teamId, lot_rank: v ? Number(v) : null } };
          }))}
        >
          Spremi ždrijeb
        </Button>
        <Status status={status} />
      </div>
    </section>
  );
}

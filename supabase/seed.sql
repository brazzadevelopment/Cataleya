-- Cataleya Cup 2026: početni podaci. Napravljeno skriptom scripts/seed-sql.ts.
-- Pokreni NAKON schema.sql. Zatim postavi PIN-ove (UPUTE.md).

begin;

insert into public.tournaments (id, slug, name, place, venue, start_date, end_date, timezone, logo_path, cover_path, color_primary, color_secondary, description, rules, points_win, points_draw, points_loss, tiebreakers, scorers_enabled, is_published) values
  ('e0bd4789-db5e-406e-817b-520be1fc82fe', 'cataleya-cup-2026', 'Cataleya Cup 2026', 'Privlaka, Zadar', 'prirodni teren', '2026-10-23', '2026-10-25', 'Europe/Zagreb', null, null, '#0f3d24', '#f2c230', 'Šesnaest momčadi u četiri skupine. Utakmice skupina igraju se u petak i subotu, nastavak u nedjelju.', null, 3, 1, 0, array['head_to_head', 'goal_difference', 'goals_for', 'lot']::text[], false, true)
on conflict (id) do nothing;

insert into public.categories (id, tournament_id, name, birth_year, match_minutes, players_on_field, sort_order) values
  ('bb598fc5-28ed-48ec-86a8-a240afae82f0', 'e0bd4789-db5e-406e-817b-520be1fc82fe', '2019. – U8', 2019, 25, null, 0)
on conflict (id) do nothing;

insert into public.fields (id, tournament_id, name, maps_url, sort_order) values
  ('9c7f2e30-86bd-4eca-8d87-e6e159b3cae7', 'e0bd4789-db5e-406e-817b-520be1fc82fe', 'Teren 1', null, 1),
  ('531568b7-4758-4946-87ec-cfd113ed015e', 'e0bd4789-db5e-406e-817b-520be1fc82fe', 'Teren 2', null, 2)
on conflict (id) do nothing;

insert into public.teams (id, tournament_id, category_id, name, short_name, logo_path) values
  ('8c61e284-45d9-4fd7-8593-75226e271497', 'e0bd4789-db5e-406e-817b-520be1fc82fe', 'bb598fc5-28ed-48ec-86a8-a240afae82f0', 'NK Arbanasi', null, null),
  ('223f0153-03ff-4ae7-89bf-e1ad69ffeb88', 'e0bd4789-db5e-406e-817b-520be1fc82fe', 'bb598fc5-28ed-48ec-86a8-a240afae82f0', 'NK Varaždin narančasti', null, null),
  ('019541fa-9709-41a6-8c6b-407ae24fb914', 'e0bd4789-db5e-406e-817b-520be1fc82fe', 'bb598fc5-28ed-48ec-86a8-a240afae82f0', 'NK Zadarnova bijeli', null, null),
  ('a4463232-c6b9-4c6d-84cc-03319d77c646', 'e0bd4789-db5e-406e-817b-520be1fc82fe', 'bb598fc5-28ed-48ec-86a8-a240afae82f0', 'NK Zagreb', null, null),
  ('49b01aa1-0ce4-4e5d-8be9-40716a944c6e', 'e0bd4789-db5e-406e-817b-520be1fc82fe', 'bb598fc5-28ed-48ec-86a8-a240afae82f0', 'HNK Zadar', null, null),
  ('dc2eea52-c6cc-4772-8f60-50fd3e5a89c2', 'e0bd4789-db5e-406e-817b-520be1fc82fe', 'bb598fc5-28ed-48ec-86a8-a240afae82f0', 'NK Lokomotiva plavi', null, null),
  ('b59a1db8-9274-4943-80f6-359261e0aa9e', 'e0bd4789-db5e-406e-817b-520be1fc82fe', 'bb598fc5-28ed-48ec-86a8-a240afae82f0', 'NK Inker', null, null),
  ('8204c8c4-bcda-41c0-8549-f64d78608499', 'e0bd4789-db5e-406e-817b-520be1fc82fe', 'bb598fc5-28ed-48ec-86a8-a240afae82f0', 'NŠK Nova Zora', null, null),
  ('4e358341-8345-4031-845d-dd9444ccb248', 'e0bd4789-db5e-406e-817b-520be1fc82fe', 'bb598fc5-28ed-48ec-86a8-a240afae82f0', 'NK Abeceda', null, null),
  ('fa37072c-da0f-4976-81f7-0562ab513cd1', 'e0bd4789-db5e-406e-817b-520be1fc82fe', 'bb598fc5-28ed-48ec-86a8-a240afae82f0', 'NK Rudeš', null, null),
  ('f874bda1-18ac-4cc5-81b8-16afbd4367f5', 'e0bd4789-db5e-406e-817b-520be1fc82fe', 'bb598fc5-28ed-48ec-86a8-a240afae82f0', 'NK Lokomotiva bijeli', null, null),
  ('4f7e64f7-4e22-4342-8b89-fa04bb2265e1', 'e0bd4789-db5e-406e-817b-520be1fc82fe', 'bb598fc5-28ed-48ec-86a8-a240afae82f0', 'NK Pakoštane', null, null),
  ('33a2072b-5940-4afc-871a-6dfcc2b83618', 'e0bd4789-db5e-406e-817b-520be1fc82fe', 'bb598fc5-28ed-48ec-86a8-a240afae82f0', 'NK Špansko', null, null),
  ('e7507b2e-a142-4503-8879-855605a75094', 'e0bd4789-db5e-406e-817b-520be1fc82fe', 'bb598fc5-28ed-48ec-86a8-a240afae82f0', 'NK Sabunjar', null, null),
  ('7d4a871d-5b86-4379-8e46-00ff7c08aea2', 'e0bd4789-db5e-406e-817b-520be1fc82fe', 'bb598fc5-28ed-48ec-86a8-a240afae82f0', 'NK Zadarnova plavi', null, null),
  ('5773d329-b511-456e-8497-bd3cf4570fd8', 'e0bd4789-db5e-406e-817b-520be1fc82fe', 'bb598fc5-28ed-48ec-86a8-a240afae82f0', 'NK Varaždin plavi', null, null)
on conflict (id) do nothing;

insert into public.groups (id, tournament_id, category_id, name, sort_order) values
  ('c126d7af-62ba-463d-8f22-46e8a408c688', 'e0bd4789-db5e-406e-817b-520be1fc82fe', 'bb598fc5-28ed-48ec-86a8-a240afae82f0', 'A', 0),
  ('58b7fc04-c2ba-4e8b-88d2-e2cd6f67b998', 'e0bd4789-db5e-406e-817b-520be1fc82fe', 'bb598fc5-28ed-48ec-86a8-a240afae82f0', 'B', 1),
  ('4fab8866-354f-4f4a-8b4b-5c463ed34e04', 'e0bd4789-db5e-406e-817b-520be1fc82fe', 'bb598fc5-28ed-48ec-86a8-a240afae82f0', 'C', 2),
  ('20836249-82d9-41f7-8fcc-9b493d80fbc2', 'e0bd4789-db5e-406e-817b-520be1fc82fe', 'bb598fc5-28ed-48ec-86a8-a240afae82f0', 'D', 3)
on conflict (id) do nothing;

insert into public.group_teams (tournament_id, category_id, group_id, team_id, lot_rank) values
  ('e0bd4789-db5e-406e-817b-520be1fc82fe', 'bb598fc5-28ed-48ec-86a8-a240afae82f0', 'c126d7af-62ba-463d-8f22-46e8a408c688', '8c61e284-45d9-4fd7-8593-75226e271497', null),
  ('e0bd4789-db5e-406e-817b-520be1fc82fe', 'bb598fc5-28ed-48ec-86a8-a240afae82f0', 'c126d7af-62ba-463d-8f22-46e8a408c688', '223f0153-03ff-4ae7-89bf-e1ad69ffeb88', null),
  ('e0bd4789-db5e-406e-817b-520be1fc82fe', 'bb598fc5-28ed-48ec-86a8-a240afae82f0', 'c126d7af-62ba-463d-8f22-46e8a408c688', '019541fa-9709-41a6-8c6b-407ae24fb914', null),
  ('e0bd4789-db5e-406e-817b-520be1fc82fe', 'bb598fc5-28ed-48ec-86a8-a240afae82f0', 'c126d7af-62ba-463d-8f22-46e8a408c688', 'a4463232-c6b9-4c6d-84cc-03319d77c646', null),
  ('e0bd4789-db5e-406e-817b-520be1fc82fe', 'bb598fc5-28ed-48ec-86a8-a240afae82f0', '58b7fc04-c2ba-4e8b-88d2-e2cd6f67b998', '49b01aa1-0ce4-4e5d-8be9-40716a944c6e', null),
  ('e0bd4789-db5e-406e-817b-520be1fc82fe', 'bb598fc5-28ed-48ec-86a8-a240afae82f0', '58b7fc04-c2ba-4e8b-88d2-e2cd6f67b998', 'dc2eea52-c6cc-4772-8f60-50fd3e5a89c2', null),
  ('e0bd4789-db5e-406e-817b-520be1fc82fe', 'bb598fc5-28ed-48ec-86a8-a240afae82f0', '58b7fc04-c2ba-4e8b-88d2-e2cd6f67b998', 'b59a1db8-9274-4943-80f6-359261e0aa9e', null),
  ('e0bd4789-db5e-406e-817b-520be1fc82fe', 'bb598fc5-28ed-48ec-86a8-a240afae82f0', '58b7fc04-c2ba-4e8b-88d2-e2cd6f67b998', '8204c8c4-bcda-41c0-8549-f64d78608499', null),
  ('e0bd4789-db5e-406e-817b-520be1fc82fe', 'bb598fc5-28ed-48ec-86a8-a240afae82f0', '4fab8866-354f-4f4a-8b4b-5c463ed34e04', '4e358341-8345-4031-845d-dd9444ccb248', null),
  ('e0bd4789-db5e-406e-817b-520be1fc82fe', 'bb598fc5-28ed-48ec-86a8-a240afae82f0', '4fab8866-354f-4f4a-8b4b-5c463ed34e04', 'fa37072c-da0f-4976-81f7-0562ab513cd1', null),
  ('e0bd4789-db5e-406e-817b-520be1fc82fe', 'bb598fc5-28ed-48ec-86a8-a240afae82f0', '4fab8866-354f-4f4a-8b4b-5c463ed34e04', 'f874bda1-18ac-4cc5-81b8-16afbd4367f5', null),
  ('e0bd4789-db5e-406e-817b-520be1fc82fe', 'bb598fc5-28ed-48ec-86a8-a240afae82f0', '4fab8866-354f-4f4a-8b4b-5c463ed34e04', '4f7e64f7-4e22-4342-8b89-fa04bb2265e1', null),
  ('e0bd4789-db5e-406e-817b-520be1fc82fe', 'bb598fc5-28ed-48ec-86a8-a240afae82f0', '20836249-82d9-41f7-8fcc-9b493d80fbc2', '33a2072b-5940-4afc-871a-6dfcc2b83618', null),
  ('e0bd4789-db5e-406e-817b-520be1fc82fe', 'bb598fc5-28ed-48ec-86a8-a240afae82f0', '20836249-82d9-41f7-8fcc-9b493d80fbc2', 'e7507b2e-a142-4503-8879-855605a75094', null),
  ('e0bd4789-db5e-406e-817b-520be1fc82fe', 'bb598fc5-28ed-48ec-86a8-a240afae82f0', '20836249-82d9-41f7-8fcc-9b493d80fbc2', '7d4a871d-5b86-4379-8e46-00ff7c08aea2', null),
  ('e0bd4789-db5e-406e-817b-520be1fc82fe', 'bb598fc5-28ed-48ec-86a8-a240afae82f0', '20836249-82d9-41f7-8fcc-9b493d80fbc2', '5773d329-b511-456e-8497-bd3cf4570fd8', null)
on conflict (group_id, team_id) do nothing;

insert into public.matches (stage, group_id, code, label, home_team_id, away_team_id, home_source, away_source, field_id, starts_at, duration_minutes, home_score, away_score, home_penalties, away_penalties, status, winner_place, loser_place, teams_locked, id, tournament_id, category_id) values
  ('group', '20836249-82d9-41f7-8fcc-9b493d80fbc2', null, null, '33a2072b-5940-4afc-871a-6dfcc2b83618', 'e7507b2e-a142-4503-8879-855605a75094', null, null, '9c7f2e30-86bd-4eca-8d87-e6e159b3cae7', '2026-10-23T14:00:00.000Z', null, null, null, null, null, 'scheduled', null, null, false, '40d61204-f63a-4c92-8644-9678b5557f1c', 'e0bd4789-db5e-406e-817b-520be1fc82fe', 'bb598fc5-28ed-48ec-86a8-a240afae82f0'),
  ('group', '20836249-82d9-41f7-8fcc-9b493d80fbc2', null, null, '7d4a871d-5b86-4379-8e46-00ff7c08aea2', '5773d329-b511-456e-8497-bd3cf4570fd8', null, null, '531568b7-4758-4946-87ec-cfd113ed015e', '2026-10-23T14:00:00.000Z', null, null, null, null, null, 'scheduled', null, null, false, '66af04cd-4aeb-4636-8322-d19a3430a681', 'e0bd4789-db5e-406e-817b-520be1fc82fe', 'bb598fc5-28ed-48ec-86a8-a240afae82f0'),
  ('group', '4fab8866-354f-4f4a-8b4b-5c463ed34e04', null, null, 'fa37072c-da0f-4976-81f7-0562ab513cd1', '4f7e64f7-4e22-4342-8b89-fa04bb2265e1', null, null, '9c7f2e30-86bd-4eca-8d87-e6e159b3cae7', '2026-10-23T14:30:00.000Z', null, null, null, null, null, 'scheduled', null, null, false, '6d28fc14-1b5c-4e90-8cc8-b926ef561b5a', 'e0bd4789-db5e-406e-817b-520be1fc82fe', 'bb598fc5-28ed-48ec-86a8-a240afae82f0'),
  ('group', '58b7fc04-c2ba-4e8b-88d2-e2cd6f67b998', null, null, 'b59a1db8-9274-4943-80f6-359261e0aa9e', '49b01aa1-0ce4-4e5d-8be9-40716a944c6e', null, null, '531568b7-4758-4946-87ec-cfd113ed015e', '2026-10-23T14:30:00.000Z', null, null, null, null, null, 'scheduled', null, null, false, '9df8452a-b425-4463-8645-5af85d775c67', 'e0bd4789-db5e-406e-817b-520be1fc82fe', 'bb598fc5-28ed-48ec-86a8-a240afae82f0'),
  ('group', '58b7fc04-c2ba-4e8b-88d2-e2cd6f67b998', null, null, 'dc2eea52-c6cc-4772-8f60-50fd3e5a89c2', '8204c8c4-bcda-41c0-8549-f64d78608499', null, null, '9c7f2e30-86bd-4eca-8d87-e6e159b3cae7', '2026-10-23T15:00:00.000Z', null, null, null, null, null, 'scheduled', null, null, false, 'ff0b23fc-4eef-4317-818c-683b4a32fec5', 'e0bd4789-db5e-406e-817b-520be1fc82fe', 'bb598fc5-28ed-48ec-86a8-a240afae82f0'),
  ('group', 'c126d7af-62ba-463d-8f22-46e8a408c688', null, null, 'a4463232-c6b9-4c6d-84cc-03319d77c646', '8c61e284-45d9-4fd7-8593-75226e271497', null, null, '531568b7-4758-4946-87ec-cfd113ed015e', '2026-10-23T15:00:00.000Z', null, null, null, null, null, 'scheduled', null, null, false, 'a0b4ac13-3ba8-4368-8600-cb1d417ed03a', 'e0bd4789-db5e-406e-817b-520be1fc82fe', 'bb598fc5-28ed-48ec-86a8-a240afae82f0'),
  ('group', 'c126d7af-62ba-463d-8f22-46e8a408c688', null, null, '223f0153-03ff-4ae7-89bf-e1ad69ffeb88', '019541fa-9709-41a6-8c6b-407ae24fb914', null, null, '9c7f2e30-86bd-4eca-8d87-e6e159b3cae7', '2026-10-23T15:30:00.000Z', null, null, null, null, null, 'scheduled', null, null, false, '971a280e-da6a-4d30-8075-2db080a40ebf', 'e0bd4789-db5e-406e-817b-520be1fc82fe', 'bb598fc5-28ed-48ec-86a8-a240afae82f0'),
  ('group', '4fab8866-354f-4f4a-8b4b-5c463ed34e04', null, null, '4e358341-8345-4031-845d-dd9444ccb248', 'f874bda1-18ac-4cc5-81b8-16afbd4367f5', null, null, '531568b7-4758-4946-87ec-cfd113ed015e', '2026-10-23T15:30:00.000Z', null, null, null, null, null, 'scheduled', null, null, false, '22c7bdf7-0200-4549-8810-7d00e439a4b9', 'e0bd4789-db5e-406e-817b-520be1fc82fe', 'bb598fc5-28ed-48ec-86a8-a240afae82f0'),
  ('group', '4fab8866-354f-4f4a-8b4b-5c463ed34e04', null, null, 'fa37072c-da0f-4976-81f7-0562ab513cd1', 'f874bda1-18ac-4cc5-81b8-16afbd4367f5', null, null, '9c7f2e30-86bd-4eca-8d87-e6e159b3cae7', '2026-10-24T07:00:00.000Z', null, null, null, null, null, 'scheduled', null, null, false, '671b31de-b10a-4367-815c-916a71bf4fbd', 'e0bd4789-db5e-406e-817b-520be1fc82fe', 'bb598fc5-28ed-48ec-86a8-a240afae82f0'),
  ('group', '4fab8866-354f-4f4a-8b4b-5c463ed34e04', null, null, '4e358341-8345-4031-845d-dd9444ccb248', '4f7e64f7-4e22-4342-8b89-fa04bb2265e1', null, null, '531568b7-4758-4946-87ec-cfd113ed015e', '2026-10-24T07:00:00.000Z', null, null, null, null, null, 'scheduled', null, null, false, '42dea173-0adc-4e23-82c7-febc73fd10cc', 'e0bd4789-db5e-406e-817b-520be1fc82fe', 'bb598fc5-28ed-48ec-86a8-a240afae82f0'),
  ('group', '20836249-82d9-41f7-8fcc-9b493d80fbc2', null, null, '33a2072b-5940-4afc-871a-6dfcc2b83618', '5773d329-b511-456e-8497-bd3cf4570fd8', null, null, '9c7f2e30-86bd-4eca-8d87-e6e159b3cae7', '2026-10-24T07:30:00.000Z', null, null, null, null, null, 'scheduled', null, null, false, '2cd797ec-eeb9-4486-81bb-b28900852a06', 'e0bd4789-db5e-406e-817b-520be1fc82fe', 'bb598fc5-28ed-48ec-86a8-a240afae82f0'),
  ('group', '20836249-82d9-41f7-8fcc-9b493d80fbc2', null, null, 'e7507b2e-a142-4503-8879-855605a75094', '7d4a871d-5b86-4379-8e46-00ff7c08aea2', null, null, '531568b7-4758-4946-87ec-cfd113ed015e', '2026-10-24T07:30:00.000Z', null, null, null, null, null, 'scheduled', null, null, false, '7099a1e1-d8f7-41f0-8768-934f1f40dac1', 'e0bd4789-db5e-406e-817b-520be1fc82fe', 'bb598fc5-28ed-48ec-86a8-a240afae82f0'),
  ('group', '4fab8866-354f-4f4a-8b4b-5c463ed34e04', null, null, 'fa37072c-da0f-4976-81f7-0562ab513cd1', '4e358341-8345-4031-845d-dd9444ccb248', null, null, '9c7f2e30-86bd-4eca-8d87-e6e159b3cae7', '2026-10-24T08:00:00.000Z', null, null, null, null, null, 'scheduled', null, null, false, '418093c8-2699-4b78-876c-c38acb70d292', 'e0bd4789-db5e-406e-817b-520be1fc82fe', 'bb598fc5-28ed-48ec-86a8-a240afae82f0'),
  ('group', '4fab8866-354f-4f4a-8b4b-5c463ed34e04', null, null, 'f874bda1-18ac-4cc5-81b8-16afbd4367f5', '4f7e64f7-4e22-4342-8b89-fa04bb2265e1', null, null, '531568b7-4758-4946-87ec-cfd113ed015e', '2026-10-24T08:00:00.000Z', null, null, null, null, null, 'scheduled', null, null, false, 'd508090c-ba3f-47ad-8f67-08036a53b945', 'e0bd4789-db5e-406e-817b-520be1fc82fe', 'bb598fc5-28ed-48ec-86a8-a240afae82f0'),
  ('group', '20836249-82d9-41f7-8fcc-9b493d80fbc2', null, null, '33a2072b-5940-4afc-871a-6dfcc2b83618', '7d4a871d-5b86-4379-8e46-00ff7c08aea2', null, null, '9c7f2e30-86bd-4eca-8d87-e6e159b3cae7', '2026-10-24T08:30:00.000Z', null, null, null, null, null, 'scheduled', null, null, false, '0d30a71a-6e8b-40f6-82c6-88caee2fac12', 'e0bd4789-db5e-406e-817b-520be1fc82fe', 'bb598fc5-28ed-48ec-86a8-a240afae82f0'),
  ('group', '20836249-82d9-41f7-8fcc-9b493d80fbc2', null, null, 'e7507b2e-a142-4503-8879-855605a75094', '5773d329-b511-456e-8497-bd3cf4570fd8', null, null, '531568b7-4758-4946-87ec-cfd113ed015e', '2026-10-24T08:30:00.000Z', null, null, null, null, null, 'scheduled', null, null, false, '4d32e6c0-0bc8-4fcb-852f-b4589a9ee4c0', 'e0bd4789-db5e-406e-817b-520be1fc82fe', 'bb598fc5-28ed-48ec-86a8-a240afae82f0'),
  ('group', 'c126d7af-62ba-463d-8f22-46e8a408c688', null, null, '223f0153-03ff-4ae7-89bf-e1ad69ffeb88', '8c61e284-45d9-4fd7-8593-75226e271497', null, null, '9c7f2e30-86bd-4eca-8d87-e6e159b3cae7', '2026-10-24T09:00:00.000Z', null, null, null, null, null, 'scheduled', null, null, false, 'b784eed7-12a9-43c0-8165-efc7f703f46a', 'e0bd4789-db5e-406e-817b-520be1fc82fe', 'bb598fc5-28ed-48ec-86a8-a240afae82f0'),
  ('group', 'c126d7af-62ba-463d-8f22-46e8a408c688', null, null, 'a4463232-c6b9-4c6d-84cc-03319d77c646', '019541fa-9709-41a6-8c6b-407ae24fb914', null, null, '531568b7-4758-4946-87ec-cfd113ed015e', '2026-10-24T09:00:00.000Z', null, null, null, null, null, 'scheduled', null, null, false, 'c6783b8f-88b6-4b6f-8fd0-f41dd319fa82', 'e0bd4789-db5e-406e-817b-520be1fc82fe', 'bb598fc5-28ed-48ec-86a8-a240afae82f0'),
  ('group', '58b7fc04-c2ba-4e8b-88d2-e2cd6f67b998', null, null, 'dc2eea52-c6cc-4772-8f60-50fd3e5a89c2', '49b01aa1-0ce4-4e5d-8be9-40716a944c6e', null, null, '9c7f2e30-86bd-4eca-8d87-e6e159b3cae7', '2026-10-24T09:30:00.000Z', null, null, null, null, null, 'scheduled', null, null, false, 'c939ec3b-8c28-48c7-897b-41ccebed667e', 'e0bd4789-db5e-406e-817b-520be1fc82fe', 'bb598fc5-28ed-48ec-86a8-a240afae82f0'),
  ('group', '58b7fc04-c2ba-4e8b-88d2-e2cd6f67b998', null, null, 'b59a1db8-9274-4943-80f6-359261e0aa9e', '8204c8c4-bcda-41c0-8549-f64d78608499', null, null, '531568b7-4758-4946-87ec-cfd113ed015e', '2026-10-24T09:30:00.000Z', null, null, null, null, null, 'scheduled', null, null, false, 'c87de9e1-6d08-4f3c-8890-df4bd6f15864', 'e0bd4789-db5e-406e-817b-520be1fc82fe', 'bb598fc5-28ed-48ec-86a8-a240afae82f0'),
  ('group', 'c126d7af-62ba-463d-8f22-46e8a408c688', null, null, '223f0153-03ff-4ae7-89bf-e1ad69ffeb88', 'a4463232-c6b9-4c6d-84cc-03319d77c646', null, null, '9c7f2e30-86bd-4eca-8d87-e6e159b3cae7', '2026-10-24T10:00:00.000Z', null, null, null, null, null, 'scheduled', null, null, false, '23acd96a-8fb6-4aae-8a57-ae4d2a2b5839', 'e0bd4789-db5e-406e-817b-520be1fc82fe', 'bb598fc5-28ed-48ec-86a8-a240afae82f0'),
  ('group', 'c126d7af-62ba-463d-8f22-46e8a408c688', null, null, '8c61e284-45d9-4fd7-8593-75226e271497', '019541fa-9709-41a6-8c6b-407ae24fb914', null, null, '531568b7-4758-4946-87ec-cfd113ed015e', '2026-10-24T10:00:00.000Z', null, null, null, null, null, 'scheduled', null, null, false, 'c417bca0-3b39-40c2-8323-050e65e58531', 'e0bd4789-db5e-406e-817b-520be1fc82fe', 'bb598fc5-28ed-48ec-86a8-a240afae82f0'),
  ('group', '58b7fc04-c2ba-4e8b-88d2-e2cd6f67b998', null, null, 'dc2eea52-c6cc-4772-8f60-50fd3e5a89c2', 'b59a1db8-9274-4943-80f6-359261e0aa9e', null, null, '9c7f2e30-86bd-4eca-8d87-e6e159b3cae7', '2026-10-24T10:30:00.000Z', null, null, null, null, null, 'scheduled', null, null, false, '0d86e46e-d692-4e04-8498-e92ba8bcb46b', 'e0bd4789-db5e-406e-817b-520be1fc82fe', 'bb598fc5-28ed-48ec-86a8-a240afae82f0'),
  ('group', '58b7fc04-c2ba-4e8b-88d2-e2cd6f67b998', null, null, '49b01aa1-0ce4-4e5d-8be9-40716a944c6e', '8204c8c4-bcda-41c0-8549-f64d78608499', null, null, '531568b7-4758-4946-87ec-cfd113ed015e', '2026-10-24T10:30:00.000Z', null, null, null, null, null, 'scheduled', null, null, false, '2640cae2-3f8d-4852-8dd3-ab882b344b5e', 'e0bd4789-db5e-406e-817b-520be1fc82fe', 'bb598fc5-28ed-48ec-86a8-a240afae82f0'),
  ('quarterfinal', null, 'ČF1', 'Četvrtfinale 1', null, null, '1A', '2B', null, null, null, null, null, null, null, 'scheduled', null, null, false, '9be74565-7cf4-40db-83c3-12972fc5d288', 'e0bd4789-db5e-406e-817b-520be1fc82fe', 'bb598fc5-28ed-48ec-86a8-a240afae82f0'),
  ('quarterfinal', null, 'ČF2', 'Četvrtfinale 2', null, null, '1B', '2A', null, null, null, null, null, null, null, 'scheduled', null, null, false, 'a507a3ba-32d8-44d4-8729-d61215dfa299', 'e0bd4789-db5e-406e-817b-520be1fc82fe', 'bb598fc5-28ed-48ec-86a8-a240afae82f0'),
  ('quarterfinal', null, 'ČF3', 'Četvrtfinale 3', null, null, '1C', '2D', null, null, null, null, null, null, null, 'scheduled', null, null, false, 'e50ae26f-7d00-46af-8e0a-a28d4dbe8dd3', 'e0bd4789-db5e-406e-817b-520be1fc82fe', 'bb598fc5-28ed-48ec-86a8-a240afae82f0'),
  ('quarterfinal', null, 'ČF4', 'Četvrtfinale 4', null, null, '1D', '2C', null, null, null, null, null, null, null, 'scheduled', null, null, false, 'fa0317fa-f950-40c7-857a-fb6b1c6f2719', 'e0bd4789-db5e-406e-817b-520be1fc82fe', 'bb598fc5-28ed-48ec-86a8-a240afae82f0')
on conflict (id) do nothing;

commit;

-- Turnir: e0bd4789-db5e-406e-817b-520be1fc82fe
-- Teren 1: 9c7f2e30-86bd-4eca-8d87-e6e159b3cae7
-- Teren 2: 531568b7-4758-4946-87ec-cfd113ed015e

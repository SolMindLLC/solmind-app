\set ON_ERROR_STOP on

-- SolMind login step 7: the local demo accounts' SolMind records. Run only by New-SolmindLocalDemoSetup.ps1, as the
-- local PostgreSQL owner (docker exec ... psql), after its local-target gates pass. It passes these psql variables:
--   :'admin_email' :'guide_email' :'explorer_email' :'admin_auth_id' :'guide_auth_id' :'explorer_auth_id' :report_only
-- A Paul-approved maintenance script (AUTH-RLS-DEC-027 named exception); local demo only, never real users.
-- Every row it writes carries metadata demo_setup = 'prj01-demo-v1' (consent records: acceptance_metadata) and a fixed
-- id with the reserved prefix de770000-. It never updates or deletes a row.
-- - report_only = true: reads the demo state and prints one STATE line, then rolls back. It writes nothing.
-- - report_only = false: creates the demo set in one transaction: any error leaves nothing committed.
-- One list of the demo tables and their expected counts (demo_setup_counts) serves the preflight, the post-validation
-- and Report alike.

begin;

do $demo_schema$
begin
  if pg_catalog.to_regclass('identity.auth_provider_identity') is null
     or pg_catalog.to_regclass('core.guide_explorer_relationship') is null
     or pg_catalog.to_regclass('core.consent_record') is null
     or pg_catalog.to_regclass('audit.audit_event') is null then
    raise exception 'demo setup requires the banked identity, core, consent and audit schema';
  end if;
end;
$demo_schema$;

-- psql variables do not expand inside dollar-quoted blocks, so the checks read them from this temporary table.
create temp table demo_setup_params on commit drop as
  select array[:'admin_email', :'guide_email', :'explorer_email']::text[] as emails,
         array[:'admin_auth_id', :'guide_auth_id', :'explorer_auth_id']::text[] as auth_ids;

-- Every demo table, with the rows the complete demo set holds: a row counts when its id has the reserved prefix or it
-- carries a demo_setup key. The last three rows count what would collide with the inserts, whoever owns it: contacts
-- with the demo emails, accounts whose username is a demo email, and consent documents of the five demo types at
-- version 1. (The column is found_rows: found is PL/pgSQL's own FOUND variable.)
create function pg_temp.demo_setup_counts(p_emails text[])
returns table (table_name text, found_rows bigint, expected bigint)
language plpgsql
as $counts$
declare
  r record;
begin
  for r in
    select * from (values
      ('identity.user_account', 'user_account_id', 'metadata', 3),
      ('identity.user_role_assignment', 'user_role_assignment_id', 'metadata', 3),
      ('identity.user_contact_method', 'user_contact_method_id', 'metadata', 3),
      ('identity.auth_provider_identity', 'auth_provider_identity_id', 'metadata', 3),
      ('core.organization', 'organization_id', 'metadata', 1),
      ('core.practice', 'practice_id', 'metadata', 1),
      ('core.guide_profile', 'guide_profile_id', 'metadata', 1),
      ('core.practice_guide', 'practice_guide_id', 'metadata', 1),
      ('core.explorer_profile', 'explorer_profile_id', 'metadata', 1),
      ('core.guide_explorer_relationship', 'guide_explorer_relationship_id', 'metadata', 1),
      ('core.consent_document', 'consent_document_id', 'metadata', 5),
      ('core.consent_record', 'consent_record_id', 'acceptance_metadata', 5),
      ('audit.audit_event', 'audit_event_id', 'metadata', 5)
    ) v(t, id_col, tag_col, n)
  loop
    table_name := r.t;
    expected := r.n;
    execute pg_catalog.format('select pg_catalog.count(*) from %s where %I::text like %L or %I ? %L',
                              r.t, r.id_col, 'de770000-%', r.tag_col, 'demo_setup')
      into found_rows;
    return next;
  end loop;
  table_name := 'identity.user_contact_method (the demo emails)';
  expected := 3;
  select pg_catalog.count(*) into found_rows
    from identity.user_contact_method where normalized_contact_value = any (p_emails);
  return next;
  table_name := 'identity.user_account (usernames equal to the demo emails)';
  expected := 3;
  select pg_catalog.count(*) into found_rows
    from identity.user_account where pg_catalog.lower(username) = any (p_emails);
  return next;
  table_name := 'core.consent_document (the five demo types at version 1)';
  expected := 5;
  select pg_catalog.count(*) into found_rows
    from core.consent_document
   where version_number = 1
     and consent_type in ('user_agreement', 'privacy_policy', 'ai_disclosure', 'admin_visibility', 'crisis_limitation');
  return next;
end;
$counts$;

-- The complete demo set: exact counts in every demo table, each row tied to the right account, and the Auth bindings
-- equal to the given Auth user ids (Admin, Guide, Explorer, in the order of p_emails and p_auth_ids).
create function pg_temp.demo_setup_complete(p_emails text[], p_auth_ids text[])
returns boolean
language sql
as $complete$
  select
    not exists (select 1 from pg_temp.demo_setup_counts(p_emails) c where c.found_rows <> c.expected)
    -- Each fixed row by id, with the status and links the script writes (review #111b).
    and (select pg_catalog.count(*) from identity.user_account u
          where u.user_account_id in ('de770000-0000-4000-8000-000000000001', 'de770000-0000-4000-8000-000000000002',
                                      'de770000-0000-4000-8000-000000000003')
            and u.account_status = 'active' and u.metadata ->> 'demo_setup' = 'prj01-demo-v1') = 3
    and exists (select 1 from core.organization o
                 where o.organization_id = 'de770000-4000-4000-8000-000000000001'
                   and o.approval_status = 'approved' and o.status = 'active'
                   and o.metadata ->> 'demo_setup' = 'prj01-demo-v1')
    and exists (select 1 from core.practice p
                 where p.practice_id = 'de770000-4100-4000-8000-000000000001'
                   and p.organization_id = 'de770000-4000-4000-8000-000000000001'
                   and p.approval_status = 'approved' and p.status = 'active'
                   and p.metadata ->> 'demo_setup' = 'prj01-demo-v1')
    and exists (select 1 from core.guide_profile g
                 where g.guide_profile_id = 'de770000-5000-4000-8000-000000000001'
                   and g.user_account_id = 'de770000-0000-4000-8000-000000000002'
                   and g.setup_status = 'approved' and g.status = 'active'
                   and g.metadata ->> 'demo_setup' = 'prj01-demo-v1')
    and exists (select 1 from core.practice_guide pg
                 where pg.practice_guide_id = 'de770000-5100-4000-8000-000000000001'
                   and pg.practice_id = 'de770000-4100-4000-8000-000000000001'
                   and pg.guide_profile_id = 'de770000-5000-4000-8000-000000000001'
                   and pg.relationship_status = 'active' and pg.metadata ->> 'demo_setup' = 'prj01-demo-v1')
    and exists (select 1 from core.explorer_profile e
                 where e.explorer_profile_id = 'de770000-5200-4000-8000-000000000001'
                   and e.user_account_id = 'de770000-0000-4000-8000-000000000003'
                   and e.onboarding_status = 'active' and e.status = 'active'
                   and e.metadata ->> 'demo_setup' = 'prj01-demo-v1')
    and (select pg_catalog.count(*) from identity.user_role_assignment a
           join (values (1, 'admin'), (2, 'guide'), (3, 'explorer')) v(i, role_code)
             on a.user_account_id = ('de770000-0000-4000-8000-00000000000' || v.i)::uuid and a.role_code = v.role_code
          where a.role_status = 'active') = 3
    and (select pg_catalog.count(*) from identity.user_contact_method m
           join pg_catalog.generate_subscripts(p_emails, 1) i
             on m.user_account_id = ('de770000-0000-4000-8000-00000000000' || i)::uuid
            and m.normalized_contact_value = p_emails[i]
          where m.login_enabled and m.is_verified and m.status = 'active') = 3
    and (select pg_catalog.count(*) from identity.auth_provider_identity b
           join pg_catalog.generate_subscripts(p_auth_ids, 1) i
             on b.user_account_id = ('de770000-0000-4000-8000-00000000000' || i)::uuid
            and b.provider_user_id = p_auth_ids[i]
          where b.provider_name = 'supabase' and b.status = 'active') = 3
    -- The Explorer accepted each demo document as an Explorer, for its own type and version, with the adult affirmation.
    and (select pg_catalog.count(*) from core.consent_record r
           join core.consent_document d on d.consent_document_id = r.consent_document_id
          where r.user_account_id = 'de770000-0000-4000-8000-000000000003'
            and r.role_context = 'explorer' and r.consent_type = d.consent_type
            and r.document_version = d.version_label and r.adult_affirmation
            and d.metadata ->> 'demo_setup' = 'prj01-demo-v1'
            and d.document_status = 'active' and d.is_required_for_explorer) = 5
    -- No active required document, demo or not, lacks the Explorer's acceptance.
    and not exists (select 1 from core.consent_document d
                     where d.document_status = 'active' and d.is_required_for_explorer
                       and not exists (select 1 from core.consent_record r
                                        where r.consent_document_id = d.consent_document_id
                                          and r.user_account_id = 'de770000-0000-4000-8000-000000000003'
                                          and r.adult_affirmation))
    -- Exactly one activation audit per demo document: five audits, five distinct documents.
    and (select pg_catalog.count(*) = 5 and pg_catalog.count(distinct e.target_entity_id) = 5
           from audit.audit_event e
           join core.consent_document d on d.consent_document_id = e.target_entity_id
          where e.event_type = 'consent_document_activated' and e.metadata ->> 'demo_setup' = 'prj01-demo-v1'
            and d.metadata ->> 'demo_setup' = 'prj01-demo-v1')
    and exists (select 1 from core.guide_explorer_relationship g
                 where g.guide_explorer_relationship_id = 'de770000-5300-4000-8000-000000000001'
                   and g.guide_profile_id = 'de770000-5000-4000-8000-000000000001'
                   and g.explorer_profile_id = 'de770000-5200-4000-8000-000000000001'
                   and g.practice_id = 'de770000-4100-4000-8000-000000000001'
                   and g.relationship_status = 'active' and g.metadata ->> 'demo_setup' = 'prj01-demo-v1');
$complete$;

\if :report_only

-- STATE|<demo matches found>|<complete: true or false>|<each table: found/expected>
select 'STATE|' || (select pg_catalog.sum(c.found_rows) from pg_temp.demo_setup_counts(p.emails) c)
       || '|' || pg_temp.demo_setup_complete(p.emails, p.auth_ids)::text
       || '|' || (select pg_catalog.string_agg(c.table_name || ' ' || c.found_rows || '/' || c.expected, ', ')
                    from pg_temp.demo_setup_counts(p.emails) c)
  from demo_setup_params p;
rollback;

\else

-- No consent document may be added or activated while this transaction checks and writes.
lock table core.consent_document in share row exclusive mode;

do $demo_preflight$
declare
  v_found bigint;
  v_active_consent integer;
begin
  select pg_catalog.sum(c.found_rows) into v_found from demo_setup_params p, pg_temp.demo_setup_counts(p.emails) c;
  if v_found <> 0 then
    raise exception 'demo setup preflight found % existing demo or contact row(s); nothing was changed', v_found;
  end if;
  -- The demo never replaces a real consent document: it needs the five types free of any active version.
  select pg_catalog.count(*)::integer into v_active_consent from core.consent_document where document_status = 'active';
  if v_active_consent <> 0 then
    raise exception 'demo setup found % active consent document(s); it does not replace them; nothing was changed', v_active_consent;
  end if;
end;
$demo_preflight$;

-- Accounts (Admin first: other rows reference it).
insert into identity.user_account (user_account_id, display_name, username, account_status, metadata) values
  ('de770000-0000-4000-8000-000000000001', 'Demo Admin', :'admin_email', 'active', '{"demo_setup":"prj01-demo-v1"}'),
  ('de770000-0000-4000-8000-000000000002', 'Demo Guide', :'guide_email', 'active', '{"demo_setup":"prj01-demo-v1"}'),
  ('de770000-0000-4000-8000-000000000003', 'Demo Explorer', :'explorer_email', 'active', '{"demo_setup":"prj01-demo-v1"}');

insert into identity.user_role_assignment (user_role_assignment_id, user_account_id, role_code, role_status, granted_by_role_context, metadata) values
  ('de770000-1000-4000-8000-000000000001', 'de770000-0000-4000-8000-000000000001', 'admin', 'active', 'system', '{"demo_setup":"prj01-demo-v1"}'),
  ('de770000-1000-4000-8000-000000000002', 'de770000-0000-4000-8000-000000000002', 'guide', 'active', 'system', '{"demo_setup":"prj01-demo-v1"}'),
  ('de770000-1000-4000-8000-000000000003', 'de770000-0000-4000-8000-000000000003', 'explorer', 'active', 'system', '{"demo_setup":"prj01-demo-v1"}');

-- Verified, login-enabled primary email contacts.
insert into identity.user_contact_method (user_contact_method_id, user_account_id, contact_method_type, contact_label,
  contact_value, normalized_contact_value, login_enabled, is_verified, verified_at, verification_method, status, metadata) values
  ('de770000-2000-4000-8000-000000000001', 'de770000-0000-4000-8000-000000000001', 'email', 'primary', :'admin_email', :'admin_email', true, true, pg_catalog.now(), 'demo_setup_script', 'active', '{"demo_setup":"prj01-demo-v1"}'),
  ('de770000-2000-4000-8000-000000000002', 'de770000-0000-4000-8000-000000000002', 'email', 'primary', :'guide_email', :'guide_email', true, true, pg_catalog.now(), 'demo_setup_script', 'active', '{"demo_setup":"prj01-demo-v1"}'),
  ('de770000-2000-4000-8000-000000000003', 'de770000-0000-4000-8000-000000000003', 'email', 'primary', :'explorer_email', :'explorer_email', true, true, pg_catalog.now(), 'demo_setup_script', 'active', '{"demo_setup":"prj01-demo-v1"}');

-- Bindings to the Supabase Auth users the script created.
insert into identity.auth_provider_identity (auth_provider_identity_id, user_account_id, provider_name, provider_user_id,
  provider_email, status, metadata) values
  ('de770000-3000-4000-8000-000000000001', 'de770000-0000-4000-8000-000000000001', 'supabase', :'admin_auth_id', :'admin_email', 'active', '{"demo_setup":"prj01-demo-v1"}'),
  ('de770000-3000-4000-8000-000000000002', 'de770000-0000-4000-8000-000000000002', 'supabase', :'guide_auth_id', :'guide_email', 'active', '{"demo_setup":"prj01-demo-v1"}'),
  ('de770000-3000-4000-8000-000000000003', 'de770000-0000-4000-8000-000000000003', 'supabase', :'explorer_auth_id', :'explorer_email', 'active', '{"demo_setup":"prj01-demo-v1"}');

-- Organisation and practice, approved by the demo Admin.
insert into core.organization (organization_id, organization_name, approval_status, approved_at, approved_by_user_account_id,
  status, created_by_user_account_id, metadata) values
  ('de770000-4000-4000-8000-000000000001', 'Demo Organisation', 'approved', pg_catalog.now(), 'de770000-0000-4000-8000-000000000001',
   'active', 'de770000-0000-4000-8000-000000000001', '{"demo_setup":"prj01-demo-v1"}');
insert into core.practice (practice_id, organization_id, practice_name, approval_status, approved_at, approved_by_user_account_id,
  status, created_by_user_account_id, metadata) values
  ('de770000-4100-4000-8000-000000000001', 'de770000-4000-4000-8000-000000000001', 'Demo Practice', 'approved', pg_catalog.now(),
   'de770000-0000-4000-8000-000000000001', 'active', 'de770000-0000-4000-8000-000000000001', '{"demo_setup":"prj01-demo-v1"}');

-- Consent (Paul's night decision 4, 2026-09-28: for the local demo only, the script writes consent directly). Five
-- demo placeholder documents, one per consent type, each active and required for the Explorer, created by the demo
-- Admin; each activation is audited as the data model requires. They are not legal text and never for real users.
insert into core.consent_document (consent_document_id, consent_type, version_number, version_label, title, body_markdown,
  document_status, is_required_for_explorer, is_required_for_guide, effective_at, created_by_user_account_id,
  created_by_role_context, metadata)
select ('de770000-6000-4000-8000-00000000000' || v.n)::uuid, v.consent_type, 1, 'demo-v1',
       'DEMO PLACEHOLDER - ' || v.title,
       'Local demo placeholder only. Not legal text, and never shown to real users. ' || v.body,
       'active', true, false, pg_catalog.now(), 'de770000-0000-4000-8000-000000000001', 'admin',
       '{"demo_setup":"prj01-demo-v1"}'::jsonb
  from (values
    (1, 'user_agreement', 'User agreement', 'SolMind MVP 0 is adults-only: users must affirm they are 18 or older.'),
    (2, 'privacy_policy', 'Privacy notice', 'It would say what data is collected, who can see it, and how it is used.'),
    (3, 'ai_disclosure', 'AI disclosure', 'SolMind uses AI; AI may be wrong; AI is bounded and human-supervised.'),
    (4, 'admin_visibility', 'Sharing and Admin visibility', 'The Guide normally sees only submitted onboarding answers and Shared Snapshots the Explorer confirms; there is no routine Admin access to private content.'),
    (5, 'crisis_limitation', 'Crisis limitation', 'SolMind is not a crisis service and cannot guarantee emergency response or a human response time; any Level 3-4 responder role needs a separately approved design and disclosure.')
  ) v(n, consent_type, title, body);

insert into audit.audit_event (audit_event_id, event_type, actor_user_account_id, actor_role_context, target_entity_type,
  target_entity_id, action, reason_code, event_summary, metadata, retention_class)
select ('de770000-7000-4000-8000-00000000000' || pg_catalog.right(d.consent_document_id::text, 1))::uuid,
       'consent_document_activated', 'de770000-0000-4000-8000-000000000001', 'admin', 'consent_document',
       d.consent_document_id, 'activate', 'demo_setup', 'Demo consent document activated by the local demo setup.',
       '{"demo_setup":"prj01-demo-v1"}'::jsonb, 'consent_legal'
  from core.consent_document d
 where d.metadata ->> 'demo_setup' = 'prj01-demo-v1';

-- Approved Guide in the practice; Explorer with every required consent accepted; active relationship.
insert into core.guide_profile (guide_profile_id, user_account_id, guide_display_name, setup_status, approved_by_user_account_id,
  approved_at, status, metadata) values
  ('de770000-5000-4000-8000-000000000001', 'de770000-0000-4000-8000-000000000002', 'Demo Guide', 'approved',
   'de770000-0000-4000-8000-000000000001', pg_catalog.now(), 'active', '{"demo_setup":"prj01-demo-v1"}');
insert into core.practice_guide (practice_guide_id, practice_id, guide_profile_id, relationship_status, is_primary_for_mvp0,
  created_by_user_account_id, metadata) values
  ('de770000-5100-4000-8000-000000000001', 'de770000-4100-4000-8000-000000000001', 'de770000-5000-4000-8000-000000000001',
   'active', true, 'de770000-0000-4000-8000-000000000001', '{"demo_setup":"prj01-demo-v1"}');

insert into core.consent_record (consent_record_id, user_account_id, role_context, consent_type, document_version,
  consent_document_id, adult_affirmation, acceptance_metadata)
select ('de770000-6100-4000-8000-00000000000' || pg_catalog.right(d.consent_document_id::text, 1))::uuid,
       'de770000-0000-4000-8000-000000000003', 'explorer', d.consent_type, d.version_label, d.consent_document_id, true,
       '{"demo_setup":"prj01-demo-v1"}'::jsonb
  from core.consent_document d
 where d.metadata ->> 'demo_setup' = 'prj01-demo-v1';

insert into core.explorer_profile (explorer_profile_id, user_account_id, explorer_display_name, onboarding_status, status, metadata) values
  ('de770000-5200-4000-8000-000000000001', 'de770000-0000-4000-8000-000000000003', 'Demo Explorer', 'active', 'active', '{"demo_setup":"prj01-demo-v1"}');
insert into core.guide_explorer_relationship (guide_explorer_relationship_id, guide_profile_id, explorer_profile_id, practice_id,
  relationship_status, started_at, created_by_user_account_id, metadata) values
  ('de770000-5300-4000-8000-000000000001', 'de770000-5000-4000-8000-000000000001', 'de770000-5200-4000-8000-000000000001',
   'de770000-4100-4000-8000-000000000001', 'active', pg_catalog.now(), 'de770000-0000-4000-8000-000000000001',
   '{"demo_setup":"prj01-demo-v1"}');

-- Post-validation inside the transaction: the same complete-set test Report uses, against the Auth ids just bound.
do $demo_validate$
begin
  if not (select pg_temp.demo_setup_complete(p.emails, p.auth_ids) from demo_setup_params p) then
    raise exception 'demo setup post-validation failed';
  end if;
end;
$demo_validate$;

drop function pg_temp.demo_setup_complete(text[], text[]);
drop function pg_temp.demo_setup_counts(text[]);
commit;

\endif

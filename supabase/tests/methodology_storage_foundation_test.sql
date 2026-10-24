-- SolMind MVP0 dormant methodology storage foundation SQL regression.
-- The migration supplies the two tables; this test does not recreate their DDL.
-- Direct-owner synthetic FK/constraint fixtures do not prove Auth sign-in,
-- active human roles, genuine AI screening, semantic audit validity, human
-- checklist/approval or operational activation. No real users or provider I/O.
-- pgTAP uses the existing cached extension in the isolated validation image;
-- extension setup, fixtures and temporary helpers are inside this transaction.

begin;
create extension if not exists pgtap with schema extensions;
set local statement_timeout = '120s';

set local search_path = public, extensions, pg_catalog, pg_temp;
select plan(67);

select is((select count(*)::integer from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'methodology' and c.relkind = 'r'), 2,
  'exactly the two proposed methodology tables exist');
select is((select count(*)::integer from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'methodology' and c.relkind = 'r'
    and c.relrowsecurity and not c.relforcerowsecurity), 2,
  'both tables have enabled non-forced RLS');
select is((select count(*)::integer from pg_catalog.pg_policies
  where schemaname = 'methodology'), 0, 'methodology has zero policies');
select ok(not exists(select 1 from pg_catalog.pg_namespace n
  cross join lateral pg_catalog.aclexplode(coalesce(n.nspacl,
    pg_catalog.acldefault('n', n.nspowner))) a
  where n.nspname = 'methodology' and a.grantee = 0),
  'PUBLIC has no methodology schema ACL privilege');
select ok((select bool_and(not pg_catalog.has_schema_privilege(r, 'methodology', 'USAGE,CREATE'))
  from unnest(array['anon', 'authenticated', 'service_role']) r),
  'all three API roles lack effective schema USAGE and CREATE');
select ok(not exists(select 1 from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  cross join lateral pg_catalog.aclexplode(coalesce(c.relacl,
    pg_catalog.acldefault('r', c.relowner))) a
  where n.nspname = 'methodology' and c.relkind = 'r' and a.grantee = 0),
  'PUBLIC has no direct table ACL privilege');
select ok((select bool_and(not pg_catalog.has_table_privilege(r, c.oid,
    'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'))
  from unnest(array['anon', 'authenticated', 'service_role']) r
  cross join pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'methodology' and c.relkind = 'r'),
  'all three API roles lack effective table privileges on both tables');
select ok(not exists(select 1 from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  cross join lateral pg_catalog.aclexplode(coalesce(c.relacl,
    pg_catalog.acldefault('r', c.relowner))) a
  cross join unnest(array['anon', 'authenticated', 'service_role']) r
  where n.nspname = 'methodology' and c.relkind = 'r'
    and case when a.grantee = 0 then true
      else pg_catalog.pg_has_role(r, a.grantee, 'USAGE') end),
  'no table ACL privilege, including version-specific privileges, is inherited by API roles');
select ok((select bool_and(not pg_catalog.has_column_privilege(r, c.oid, a.attnum,
    'SELECT,INSERT,UPDATE,REFERENCES'))
  from unnest(array['anon', 'authenticated', 'service_role']) r
  cross join pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  join pg_catalog.pg_attribute a on a.attrelid = c.oid
  where n.nspname = 'methodology' and c.relkind = 'r'
    and a.attnum > 0 and not a.attisdropped),
  'column-level effective privileges do not bypass table revocation');
select ok(not exists(select 1 from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  cross join lateral pg_catalog.aclexplode(coalesce(p.proacl,
    pg_catalog.acldefault('f', p.proowner))) a
  where n.nspname = 'methodology' and a.grantee = 0),
  'PUBLIC default function EXECUTE has been revoked');
select ok((select bool_and(not pg_catalog.has_function_privilege(r,
    'methodology.guard_methodology_version_immutability()', 'EXECUTE'))
  from unnest(array['anon', 'authenticated', 'service_role']) r),
  'all three API roles lack effective internal-trigger EXECUTE');
select is((select count(*)::integer from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'methodology' and p.proname = 'guard_methodology_version_immutability'
    and p.prorettype = 'pg_catalog.trigger'::regtype and not p.prosecdef), 1,
  'the only intended helper is an invoker trigger, not an approval RPC');
select is((select count(*)::integer from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'methodology'), 1,
  'no screen, human approval or activation stub function exists');

-- Actual negative role execution supplements effective-privilege inspection.
set local role anon;
select throws_ok($$select * from methodology.methodology_context_pack$$,
  '42501', null, 'anon cannot read methodology tables');
select throws_ok($$delete from methodology.methodology_context_pack_version$$,
  '42501', null, 'anon cannot mutate methodology tables');
reset role;
set local role authenticated;
select throws_ok($$select * from methodology.methodology_context_pack_version$$,
  '42501', null, 'authenticated cannot read methodology content');
select throws_ok($$delete from methodology.methodology_context_pack$$,
  '42501', null, 'authenticated cannot mutate methodology tables');
reset role;
set local role service_role;
select throws_ok($$select * from methodology.methodology_context_pack_version$$,
  '42501', null, 'service_role RLS bypass does not confer schema/table access');
select throws_ok($$delete from methodology.methodology_context_pack$$,
  '42501', null, 'service_role has no direct methodology mutation path');
reset role;

-- Collision-free synthetic identifiers. No real identity is resolved or reused.
create function pg_temp.r04_id(n integer) returns uuid language sql immutable as $$
  select ('f4240000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid
$$;
insert into identity.user_account(user_account_id, display_name, account_status) values
  (pg_temp.r04_id(1), 'Synthetic R04 Admin FK target only', 'active'),
  (pg_temp.r04_id(2), 'Synthetic R04 Guide FK target only', 'active');
-- No role assignment or Auth identity is fabricated: these sessions are only
-- FK-shaped storage prerequisites, not proof of operational session authority.
insert into identity.user_session(user_session_id, user_account_id,
  active_role_context, created_at, expires_at, session_status) values
  (pg_temp.r04_id(11), pg_temp.r04_id(1), 'admin', now(), now() + interval '1 hour', 'active'),
  (pg_temp.r04_id(12), pg_temp.r04_id(2), 'guide', now(), now() + interval '1 hour', 'active');
insert into core.organization(organization_id, organization_name)
  values(pg_temp.r04_id(21), 'Synthetic R04 Organization');
insert into core.practice(practice_id, organization_id, practice_name)
  values(pg_temp.r04_id(22), pg_temp.r04_id(21), 'Synthetic R04 Practice');
insert into core.guide_profile(guide_profile_id, user_account_id, guide_display_name)
  values(pg_temp.r04_id(23), pg_temp.r04_id(2), 'Synthetic R04 Guide');
-- These explicitly synthetic invocation/audit records satisfy FK existence only.
-- Their unrelated fixture vocabulary deliberately does not pretend to be a
-- permitted operational methodology audit family or a genuine screening call.
insert into ai.ai_model_invocation(ai_model_invocation_id, provider_name,
  model_name, prompt_version, request_status, started_at, completed_at)
  values(pg_temp.r04_id(30), 'synthetic-fixture-no-provider', 'synthetic-fixture',
    'r04-fixture-not-an-ai-call', 'completed', now(), now());
insert into audit.audit_event(audit_event_id, event_type, actor_role_context,
  action, event_summary, metadata) values
  (pg_temp.r04_id(31), 'r04_synthetic_fk_fixture', 'system', 'fixture',
    'Synthetic storage FK target; no screen or human approval occurred.', '{"fixture_only":true}'),
  (pg_temp.r04_id(32), 'r04_synthetic_fk_fixture', 'system', 'fixture',
    'Second synthetic storage FK target; no operational event occurred.', '{"fixture_only":true}');

insert into methodology.methodology_context_pack(methodology_context_pack_id,
  scope_type, guide_profile_id, practice_id, pack_name, created_by_role_context)
  select pg_temp.r04_id(n), case when n < 102 then 'guide' else 'practice' end,
    case when n < 102 then pg_temp.r04_id(23) else null end,
    case when n >= 102 then pg_temp.r04_id(22) else null end,
    'Synthetic R04 pack ' || n, 'system' from generate_series(100,103) n;

-- Fixture-only insertion convenience; no authorization/approval behavior.
create function pg_temp.r04_fixture_version(n integer, pack_n integer,
  number_n integer default 1, previous_n integer default null,
  digest_override text default null) returns void language plpgsql as $$
declare b text := 'Synthetic R04 methodology content ' || n || '.';
begin
  insert into methodology.methodology_context_pack_version(
    methodology_context_pack_version_id, methodology_context_pack_id,
    version_number, previous_version_id, content_markdown, content_sha256,
    created_by_actor_type, created_by_role_context, source_type, source_actor_label,
    source_provenance, ai_change_summary)
  values(pg_temp.r04_id(n), pg_temp.r04_id(pack_n), number_n,
    case when previous_n is null then null else pg_temp.r04_id(previous_n) end,
    b, coalesce(digest_override, upper(encode(extensions.digest(convert_to(b,'UTF8'),'sha256'),'hex'))),
    'system_migration', 'system', 'system_migration', 'Synthetic R04 fixture author',
    '[{"source":"synthetic-fixture-only","rights":"not-a-real-source"}]',
    'Synthetic fixture change summary; no human or AI approval.');
end;
$$;
select pg_temp.r04_fixture_version(200,100);
select pg_temp.r04_fixture_version(201,101);
select pg_temp.r04_fixture_version(202,102);
select pg_temp.r04_fixture_version(203,103);

select ok((select bool_and(scope_id = case when scope_type = 'guide'
  then pg_temp.r04_id(23) else pg_temp.r04_id(22) end)
  from methodology.methodology_context_pack), 'generated scope_id matches its actual typed FK');
select throws_ok($$insert into methodology.methodology_context_pack(scope_type,
  guide_profile_id, practice_id, pack_name, created_by_role_context)
  values('guide', pg_temp.r04_id(23), pg_temp.r04_id(22), 'Invalid combined scope', 'system')$$,
  '23514', null, 'two simultaneous typed scopes reject');
select throws_ok($$insert into methodology.methodology_context_pack(scope_type,
  practice_id, pack_name, created_by_role_context)
  values('guide', pg_temp.r04_id(22), 'Invalid mismatched scope', 'system')$$,
  '23514', null, 'scope_type cannot masquerade as another typed FK');
select throws_ok($$insert into methodology.methodology_context_pack(scope_type,
  pack_name, created_by_role_context) values('guide', 'Missing scope', 'system')$$,
  '23514', null, 'missing typed scope rejects');
select throws_ok($$insert into methodology.methodology_context_pack(scope_type,
  guide_profile_id, pack_name, created_by_role_context)
  values('guide', pg_temp.r04_id(9999), 'Missing FK target', 'system')$$,
  '23503', null, 'typed scope must reference an existing real schema row');

-- These direct-owner pointer/status writes test only the declared structural
-- limits. They are NOT genuine pack activations or human approvals. In fact,
-- draft versions are structurally selectable until the missing workflow exists.
select lives_ok($$update methodology.methodology_context_pack
  set active_version_id = pg_temp.r04_id(200), pack_status = 'active'
  where methodology_context_pack_id = pg_temp.r04_id(100)$$,
  'same-pack version pointer is structurally accepted, without operational approval claim');
select throws_ok($$update methodology.methodology_context_pack
  set active_version_id = pg_temp.r04_id(201)
  where methodology_context_pack_id = pg_temp.r04_id(100)$$,
  '23503', null, 'a pointer to another pack version rejects');
select throws_ok($$update methodology.methodology_context_pack
  set active_version_id = pg_temp.r04_id(201), pack_status = 'active'
  where methodology_context_pack_id = pg_temp.r04_id(101)$$,
  '23505', null, 'a second active Guide-scope pack rejects');
select lives_ok($$update methodology.methodology_context_pack
  set active_version_id = pg_temp.r04_id(202), pack_status = 'active'
  where methodology_context_pack_id = pg_temp.r04_id(102)$$,
  'one Practice-scope active pointer is structurally accepted');
select throws_ok($$update methodology.methodology_context_pack
  set active_version_id = pg_temp.r04_id(203), pack_status = 'active'
  where methodology_context_pack_id = pg_temp.r04_id(103)$$,
  '23505', null, 'a second active Practice-scope pack rejects');
select throws_ok($$update methodology.methodology_context_pack set pack_status = 'active'
  where methodology_context_pack_id = pg_temp.r04_id(103)$$,
  '23514', null, 'active status without an active pointer rejects');

select throws_ok($$select pg_temp.r04_fixture_version(204,100,2,201)$$,
  '23503', null, 'predecessor must belong to the same pack');
select lives_ok($$select pg_temp.r04_fixture_version(204,100,2,200)$$,
  'same-pack predecessor with next version number is accepted');
select throws_ok($$select pg_temp.r04_fixture_version(205,100,2,200)$$,
  '23505', null, 'a repeated version number within a pack rejects');
select throws_ok($$select pg_temp.r04_fixture_version(205,103,2,null)$$,
  '23514', null, 'a later version without a predecessor rejects');
select throws_ok($$select pg_temp.r04_fixture_version(205,103,2,203,repeat('0',64))$$,
  '23514', null, 'a false exact-content digest rejects on insert');
select ok((select bool_and(content_sha256 = upper(encode(extensions.digest(
  convert_to(content_markdown,'UTF8'),'sha256'),'hex')))
  from methodology.methodology_context_pack_version), 'all stored fixture digests match exact content bytes');
select throws_ok($$update methodology.methodology_context_pack_version
  set content_markdown = 'Changed content.', content_sha256 = upper(encode(
    extensions.digest(convert_to('Changed content.','UTF8'),'sha256'),'hex'))
  where methodology_context_pack_version_id = pg_temp.r04_id(200)$$,
  'P0001', 'solmind_methodology_version_immutable', 'even a matching replacement text/digest cannot rewrite content');
select throws_ok($$update methodology.methodology_context_pack_version
  set source_provenance = '[{"source":"changed synthetic provenance"}]'
  where methodology_context_pack_version_id = pg_temp.r04_id(200)$$,
  'P0001', 'solmind_methodology_version_immutable', 'source provenance cannot be rewritten');
select throws_ok($$update methodology.methodology_context_pack_version
  set ai_change_summary = 'Changed summary.'
  where methodology_context_pack_version_id = pg_temp.r04_id(200)$$,
  'P0001', 'solmind_methodology_version_immutable', 'creation change summary is immutable');
select throws_ok($$delete from methodology.methodology_context_pack_version
  where methodology_context_pack_version_id = pg_temp.r04_id(204)$$,
  'P0001', 'solmind_methodology_version_immutable', 'ordinary row DELETE rejects');

select throws_ok($$update methodology.methodology_context_pack_version
  set safety_screen_result = 'pass'
  where methodology_context_pack_version_id = pg_temp.r04_id(200)$$,
  '23514', null, 'a screen result without invocation/audit/time/metadata rejects');
select throws_ok($$update methodology.methodology_context_pack_version
  set safety_screen_completed_at = now()
  where methodology_context_pack_version_id = pg_temp.r04_id(200)$$,
  '23514', null, 'screen time without a result rejects');
select throws_ok($$update methodology.methodology_context_pack_version set
  safety_screen_result = 'pass', safety_screen_invocation_id = pg_temp.r04_id(30),
  safety_screen_audit_event_id = pg_temp.r04_id(31), safety_screen_completed_at = now(),
  metadata = jsonb_build_object('safety_screen', jsonb_build_object('result','pass',
    'screen_invocation_id',pg_temp.r04_id(30)::text,'content_sha256',repeat('0',64),'cited_excerpts','[]'::jsonb))
  where methodology_context_pack_version_id = pg_temp.r04_id(200)$$,
  '23514', null, 'screen metadata must bind the exact immutable content digest');
select throws_ok($$update methodology.methodology_context_pack_version set
  safety_screen_result = 'pass', safety_screen_invocation_id = pg_temp.r04_id(30),
  safety_screen_audit_event_id = pg_temp.r04_id(31), safety_screen_completed_at = now(),
  metadata = jsonb_build_object('safety_screen', jsonb_build_object('result','review',
    'screen_invocation_id',pg_temp.r04_id(30)::text,'content_sha256',content_sha256,'cited_excerpts','[]'::jsonb))
  where methodology_context_pack_version_id = pg_temp.r04_id(200)$$,
  '23514', null, 'screen metadata cannot disagree with its normal result column');
select throws_ok($$update methodology.methodology_context_pack_version set
  safety_screen_result = 'pass', safety_screen_invocation_id = pg_temp.r04_id(30),
  safety_screen_audit_event_id = pg_temp.r04_id(31), safety_screen_completed_at = now(),
  metadata = jsonb_build_object('safety_screen', jsonb_build_object('result','pass',
    'screen_invocation_id',pg_temp.r04_id(30)::text,'content_sha256',content_sha256,'cited_excerpts','wrong type'))
  where methodology_context_pack_version_id = pg_temp.r04_id(200)$$,
  '23514', null, 'screen cited excerpts must be an array');
select lives_ok($$update methodology.methodology_context_pack_version set
  safety_screen_result = 'pass', safety_screen_invocation_id = pg_temp.r04_id(30),
  safety_screen_audit_event_id = pg_temp.r04_id(31), safety_screen_completed_at = now(),
  metadata = jsonb_build_object('safety_screen', jsonb_build_object('result','pass',
    'screen_invocation_id',pg_temp.r04_id(30)::text,'content_sha256',content_sha256,
    'cited_excerpts','[]'::jsonb,'fixture_only',true))
  where methodology_context_pack_version_id = pg_temp.r04_id(200)$$,
  'a coherent synthetic screen-shaped FK record passes structure only');
select throws_ok($$update methodology.methodology_context_pack_version
  set metadata = jsonb_set(metadata,'{safety_screen,cited_excerpts}','["changed"]')
  where methodology_context_pack_version_id = pg_temp.r04_id(200)$$,
  'P0001', 'solmind_methodology_screen_immutable', 'completed screen metadata cannot be rewritten');
select throws_ok($$update methodology.methodology_context_pack_version
  set safety_screen_audit_event_id = pg_temp.r04_id(32)
  where methodology_context_pack_version_id = pg_temp.r04_id(200)$$,
  'P0001', 'solmind_methodology_screen_immutable', 'completed screen audit linkage cannot be replaced');

select throws_ok($$update methodology.methodology_context_pack_version
  set admin_consistency_reviewed_at = now()
  where methodology_context_pack_version_id = pg_temp.r04_id(200)$$,
  '23514', null, 'Admin review time without actor/session/audit rejects');
select throws_ok($$update methodology.methodology_context_pack_version set
  approval_status = 'guide_approved', approved_by_user_account_id = pg_temp.r04_id(2),
  approved_by_role_context = 'guide', approved_by_user_session_id = pg_temp.r04_id(12),
  guide_checklist_affirmed = true, guide_approval_audit_event_id = pg_temp.r04_id(31), approved_at = now()
  where methodology_context_pack_version_id = pg_temp.r04_id(200)$$,
  '23514', null, 'Guide-shaped approval without Admin consistency evidence rejects');
select lives_ok($$update methodology.methodology_context_pack_version set
  admin_consistency_reviewer_user_account_id = pg_temp.r04_id(1),
  admin_consistency_user_session_id = pg_temp.r04_id(11),
  admin_consistency_audit_event_id = pg_temp.r04_id(31), admin_consistency_reviewed_at = now()
  where methodology_context_pack_version_id = pg_temp.r04_id(200)$$,
  'coherent synthetic Admin FK evidence passes structure only');
select throws_ok($$update methodology.methodology_context_pack_version
  set admin_consistency_reviewed_at = now() + interval '1 second'
  where methodology_context_pack_version_id = pg_temp.r04_id(200)$$,
  'P0001', 'solmind_methodology_admin_evidence_immutable', 'completed Admin evidence cannot be rewritten');

select throws_ok($$update methodology.methodology_context_pack_version set
  approval_status = 'guide_approved', approved_by_user_account_id = pg_temp.r04_id(2),
  approved_by_role_context = null, approved_by_user_session_id = pg_temp.r04_id(12),
  guide_checklist_affirmed = true, guide_approval_audit_event_id = pg_temp.r04_id(31), approved_at = now()
  where methodology_context_pack_version_id = pg_temp.r04_id(200)$$,
  '23514', null, 'NULL Guide role cannot pass a nullable CHECK loophole');
select throws_ok($$update methodology.methodology_context_pack_version set
  approval_status = 'guide_approved', approved_by_user_account_id = pg_temp.r04_id(2),
  approved_by_role_context = 'admin', approved_by_user_session_id = pg_temp.r04_id(12),
  guide_checklist_affirmed = true, guide_approval_audit_event_id = pg_temp.r04_id(31), approved_at = now()
  where methodology_context_pack_version_id = pg_temp.r04_id(200)$$,
  '23514', null, 'Admin role label cannot replace required Guide role context');
select throws_ok($$update methodology.methodology_context_pack_version set
  approval_status = 'guide_approved', approved_by_user_account_id = pg_temp.r04_id(2),
  approved_by_role_context = 'guide', approved_by_user_session_id = pg_temp.r04_id(12),
  guide_checklist_affirmed = false, guide_approval_audit_event_id = pg_temp.r04_id(31), approved_at = now()
  where methodology_context_pack_version_id = pg_temp.r04_id(200)$$,
  '23514', null, 'approval-shaped evidence without checklist affirmation rejects');
select throws_ok($$update methodology.methodology_context_pack_version set
  approval_status = 'guide_approved', approved_by_user_account_id = pg_temp.r04_id(2),
  approved_by_role_context = 'guide', approved_by_user_session_id = null,
  guide_checklist_affirmed = true, guide_approval_audit_event_id = pg_temp.r04_id(31), approved_at = now()
  where methodology_context_pack_version_id = pg_temp.r04_id(200)$$,
  '23514', null, 'missing Guide application-session linkage rejects');
select throws_ok($$update methodology.methodology_context_pack_version set
  approval_status = 'guide_approved', approved_by_user_account_id = pg_temp.r04_id(2),
  approved_by_role_context = 'guide', approved_by_user_session_id = pg_temp.r04_id(12),
  guide_checklist_affirmed = true, guide_approval_audit_event_id = null, approved_at = now()
  where methodology_context_pack_version_id = pg_temp.r04_id(200)$$,
  '23514', null, 'missing Guide audit linkage rejects');
select lives_ok($$update methodology.methodology_context_pack_version set
  approval_status = 'guide_approved', approved_by_user_account_id = pg_temp.r04_id(2),
  approved_by_role_context = 'guide', approved_by_user_session_id = pg_temp.r04_id(12),
  guide_checklist_affirmed = true, guide_approval_audit_event_id = pg_temp.r04_id(31), approved_at = now()
  where methodology_context_pack_version_id = pg_temp.r04_id(200)$$,
  'complete synthetic Guide FK shape passes; no human approval is inferred');
select throws_ok($$update methodology.methodology_context_pack_version
  set approved_at = now() + interval '1 second'
  where methodology_context_pack_version_id = pg_temp.r04_id(200)$$,
  'P0001', 'solmind_methodology_guide_evidence_immutable', 'completed Guide approval timestamp cannot be rewritten');
select throws_ok($$update methodology.methodology_context_pack_version
  set guide_approval_audit_event_id = pg_temp.r04_id(32)
  where methodology_context_pack_version_id = pg_temp.r04_id(200)$$,
  'P0001', 'solmind_methodology_guide_evidence_immutable', 'completed Guide audit linkage cannot be replaced');

select lives_ok($$update methodology.methodology_context_pack_version set
  safety_screen_result = 'fail', safety_screen_invocation_id = pg_temp.r04_id(30),
  safety_screen_audit_event_id = pg_temp.r04_id(31), safety_screen_completed_at = now(),
  metadata = jsonb_build_object('safety_screen', jsonb_build_object('result','fail',
    'screen_invocation_id',pg_temp.r04_id(30)::text,'content_sha256',content_sha256,
    'cited_excerpts',jsonb_build_array(content_markdown),'fixture_only',true))
  where methodology_context_pack_version_id = pg_temp.r04_id(201)$$,
  'failed synthetic screen evidence may be retained without approval');
select throws_ok($$update methodology.methodology_context_pack_version set
  admin_consistency_reviewer_user_account_id = pg_temp.r04_id(1),
  admin_consistency_user_session_id = pg_temp.r04_id(11),
  admin_consistency_audit_event_id = pg_temp.r04_id(31), admin_consistency_reviewed_at = now(),
  approval_status = 'guide_approved', approved_by_user_account_id = pg_temp.r04_id(2),
  approved_by_role_context = 'guide', approved_by_user_session_id = pg_temp.r04_id(12),
  guide_checklist_affirmed = true, guide_approval_audit_event_id = pg_temp.r04_id(31), approved_at = now()
  where methodology_context_pack_version_id = pg_temp.r04_id(201)$$,
  '23514', null, 'even complete Admin/Guide-shaped fields cannot override fail');
select lives_ok($$update methodology.methodology_context_pack_version set active_from = now()
  where methodology_context_pack_version_id = pg_temp.r04_id(200)$$,
  'first effective-time marker is structurally accepted after approval-shaped evidence');
select throws_ok($$update methodology.methodology_context_pack_version
  set active_from = now() + interval '1 second'
  where methodology_context_pack_version_id = pg_temp.r04_id(200)$$,
  'P0001', 'solmind_methodology_effective_time_immutable', 'once-set effective time cannot be rewritten');
select lives_ok($$update methodology.methodology_context_pack_version
  set approval_status = 'superseded', superseded_at = now()
  where methodology_context_pack_version_id = pg_temp.r04_id(200)$$,
  'supersession retains original content and synthetic approval-shaped evidence');
select throws_ok($$update methodology.methodology_context_pack_version
  set superseded_at = now() + interval '1 second'
  where methodology_context_pack_version_id = pg_temp.r04_id(200)$$,
  'P0001', 'solmind_methodology_effective_time_immutable', 'once-set supersession time cannot be rewritten');
select is((select count(*)::integer from methodology.methodology_context_pack_version
  where methodology_context_pack_version_id = pg_temp.r04_id(201)
    and approval_status = 'draft' and safety_screen_result = 'fail'
    and approved_at is null and admin_consistency_reviewed_at is null), 1,
  'failed approval update leaves failed-screen version unapproved without partial Admin fields');

-- Structural limits intentionally disclosed rather than fabricated as passes:
-- FK existence does not prove session role/account linkage or event semantics.
-- Active-pointer selection of a draft version above demonstrates that missing
-- operational approval enforcement; no service-role path can do it today.
-- This fragment makes no historical snapshot alteration or compatibility claim
-- beyond leaving every existing snapshot/writer definition untouched.
select * from finish();
rollback;

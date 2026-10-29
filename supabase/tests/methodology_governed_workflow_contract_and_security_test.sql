-- Synthetic contract/security proof. Disposable local migrated database only.
-- Current executed evidence: solmind-docs/execution/08_SolMind_MVP0_Test_Plan_v1_0.md.
-- Pure catalog/validator/negative-role checks; no Auth or provider evidence.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions,pg_catalog,pg_temp;
set local statement_timeout='120s';
select no_plan();

select is((select count(*)::integer from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='methodology' and c.relkind='r'),5,'five named methodology tables exist after additive governance');
select is((select count(*)::integer from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='methodology' and c.relkind='r' and c.relrowsecurity and not c.relforcerowsecurity),5,
  'all private methodology tables enable nonforced RLS');
select is((select count(*)::integer from pg_policies where schemaname='methodology'),0,'no methodology policy grants access');
select ok((select bool_and(not has_schema_privilege(r,'methodology','USAGE,CREATE'))
  from unnest(array['anon','authenticated','service_role']) r),'API roles have no methodology schema access');
select ok((select bool_and(not has_table_privilege(r,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'))
  from unnest(array['anon','authenticated','service_role']) r cross join pg_class c
  join pg_namespace n on n.oid=c.relnamespace where n.nspname='methodology' and c.relkind='r'),
  'service-role bypass does not confer direct table access');
select ok(not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
  cross join lateral aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
  where n.nspname='methodology' and c.relkind='r' and a.grantee=0),'PUBLIC has no methodology table grants');
select ok((select bool_and(not has_column_privilege(r,c.oid,a.attnum,'SELECT,INSERT,UPDATE,REFERENCES'))
  from unnest(array['anon','authenticated','service_role']) r cross join pg_class c
  join pg_namespace n on n.oid=c.relnamespace join pg_attribute a on a.attrelid=c.oid
  where n.nspname='methodology' and c.relkind='r' and a.attnum>0 and not a.attisdropped),
  'inherited/default/column grants do not bypass revocation');
select ok((select bool_and(not has_function_privilege(r,p.oid,'EXECUTE'))
  from unnest(array['anon','authenticated','service_role']) r cross join pg_proc p
  join pg_namespace n on n.oid=p.pronamespace where n.nspname='methodology'),
  'all internal functions deny all API roles');
select is((select count(*)::integer from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname in ('solmind_register_methodology_version','solmind_read_methodology_version',
    'solmind_prepare_methodology_screen','solmind_record_methodology_screen','solmind_confirm_methodology_admin_review',
    'solmind_decide_methodology_guide_review','solmind_resolve_explorer_methodology','solmind_prepare_governed_explorer_conversation_turn')
    and (p.proname<>'solmind_prepare_methodology_screen' or (p.pronargs=11 and p.proargnames[11]='p_model_name'))
    and p.prosecdef and p.proowner='postgres'::regrole and has_function_privilege('service_role',p.oid,'EXECUTE')
    and not has_function_privilege('anon',p.oid,'EXECUTE') and not has_function_privilege('authenticated',p.oid,'EXECUTE')
    and 'search_path=""'=any(p.proconfig) and 'lock_timeout=2000ms'=any(p.proconfig)),7,
  'seven active governance ports include eleven-argument screen preparation; legacy governed write remains retired');
select ok((select p.proowner='postgres'::regrole
  and not exists(select 1 from unnest(array['anon','authenticated','service_role']) r
    where has_function_privilege(r,p.oid,'EXECUTE'))
  from pg_proc p where p.oid=
    'public.solmind_prepare_methodology_screen(uuid,uuid,uuid,uuid,uuid,uuid,text,text,text,text)'::regprocedure),
  'retired ten-argument screen preparation remains postgres-owned and denies all API roles');
select ok(not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
  where (n.nspname='methodology' or (n.nspname='public' and p.proname in
    ('solmind_register_methodology_version','solmind_read_methodology_version','solmind_prepare_methodology_screen',
     'solmind_record_methodology_screen','solmind_confirm_methodology_admin_review','solmind_decide_methodology_guide_review',
     'solmind_resolve_explorer_methodology','solmind_prepare_governed_explorer_conversation_turn'))) and a.grantee=0),
  'PUBLIC default function EXECUTE is absent');
select is((select pronargs::integer from pg_proc where oid=
  'public.solmind_prepare_explorer_conversation_turn(uuid,uuid,uuid,uuid,integer,uuid,uuid,uuid,text,text,text,uuid[],text,uuid,uuid,text,text,text,text,text,text,text,uuid)'::regprocedure),23,
  'old v2 public signature remains unchanged');
select is((select pronargs::integer from pg_proc where oid=
  'public.solmind_prepare_governed_explorer_conversation_turn(uuid,uuid,uuid,uuid,integer,uuid,uuid,uuid,text,text,text,uuid[],text,uuid,uuid,text,text,text,text,text,text,text,uuid,uuid,text,text)'::regprocedure),26,
  'governed wrapper adds exactly the pinned three arguments');
select is((select count(*)::integer from pg_constraint where conrelid='ai.ai_context_snapshot'::regclass
  and contype='f' and confrelid='methodology.methodology_context_pack_version'::regclass),0,
  'historical arbitrary snapshot version UUIDs receive no blanket FK');

set local role anon;
select throws_ok($$select * from public.solmind_resolve_explorer_methodology(null,null,null,'guide',null)$$,
  '42501',null,'anon cannot call resolver');
select throws_ok($$select * from methodology.screen_attempt$$,'42501',null,'anon cannot read screen receipts');
reset role;
set local role authenticated;
select throws_ok($$select * from public.solmind_read_methodology_version(null,null,null,null)$$,
  '42501',null,'browser authenticated role cannot read workflow content directly');
select throws_ok($$update methodology.methodology_context_pack set pack_status='active'$$,
  '42501',null,'authenticated cannot activate a pack directly');
reset role;
set local role service_role;
select throws_ok($$select * from methodology.methodology_context_pack_version$$,
  '42501',null,'service role has no direct methodology read');
select throws_ok($$delete from methodology.workflow_operation$$,'42501',null,'service role cannot rewrite operation ledger');
select throws_ok($$select * from public.solmind_resolve_explorer_methodology(null,null,null,'guide',null)$$,
  'P0001','solmind_methodology_denied','privileged RPC still denies absent authority');
reset role;

select ok(methodology.text_valid(repeat('a',24000),24000,true),'exact 24000 ASCII UTF16 units allowed');
select ok(not methodology.text_valid(repeat('a',24001),24000,true),'24001 ASCII units refused');
select ok(methodology.text_valid(repeat(chr(128512),12000),24000,true),'12000 astral scalars count as 24000 UTF16 units');
select ok(not methodology.text_valid(repeat(chr(128512),12001),24000,true),'12001 astral scalars exceed the JS limit');
select ok(methodology.text_valid(E'One\nTwo',24000,true),'internal LF is preserved');
select ok(not methodology.text_valid(E'One\r\nTwo',24000,true),'CRLF is refused without normalization');
select ok(not methodology.text_valid(E'One\tTwo',24000,true),'TAB is unsafe under the banked parser');
select ok((select bool_and(not methodology.text_valid(chr(cp)||'Content',24000,true)
  and not methodology.text_valid('Content'||chr(cp),24000,true))
  from unnest(array[10,32,160,5760,8192,8193,8194,8195,8196,8197,8198,8199,8200,8201,8202,8239,8287,12288]) cp),
  'full allowed JS trim-edge whitespace is refused at either edge');
select ok(methodology.text_valid('One'||chr(160)||'Two',24000,true),'internal NBSP remains exact accepted bytes');
select ok((select bool_and(not methodology.text_valid('A'||chr(cp)||'B',24000,true))
  from unnest(array[1,9,11,13,31,127,159,1564,8203,8204,8205,8206,8207,8232,8233,8234,8238,8288,8294,8297,65279]) cp),
  'control/Bidi/zero-width unsafe scalars all refuse');

create function pg_temp.screen_result(result_name text,findings jsonb default '[]'::jsonb) returns jsonb
language sql immutable as $$ select jsonb_build_object('result',result_name,'subject_sha256',repeat('A',64),'findings',findings) $$;
select ok(methodology.screen_result_valid(pg_temp.screen_result('pass'),'Exact content',repeat('A',64)),
  'closed pass with no findings is structurally valid');
select ok(not methodology.screen_result_valid(pg_temp.screen_result(null),'Exact content',repeat('A',64)),
  'JSON null result never falls through SQL three-valued logic');
select ok(not methodology.screen_result_valid(pg_temp.screen_result('pass')||'{"extra":true}', 'Exact content',repeat('A',64)),
  'extra result key refuses');
select ok(not methodology.screen_result_valid(pg_temp.screen_result('pass'),'Exact content',repeat('B',64)),
  'subject mismatch refuses');
select ok(methodology.screen_result_valid(pg_temp.screen_result('review',
  '[{"criterion":"concealment","severity":"review","excerpt":"Exact","explanation":"Synthetic concern."}]'),
  'Exact content',repeat('A',64)),'nonempty review findings require only review severities');
select ok(methodology.screen_result_valid(pg_temp.screen_result('fail',
  '[{"criterion":"concealment","severity":"fail","excerpt":"Exact","explanation":"Synthetic concern."}]'),
  'Exact content',repeat('A',64)),'failure requires a cited fail finding');
select ok(not methodology.screen_result_valid(pg_temp.screen_result('review'), 'Exact content',repeat('A',64)),
  'empty review refuses');
select ok(not methodology.screen_result_valid(pg_temp.screen_result('fail'), 'Exact content',repeat('A',64)),
  'empty fail refuses');
select ok(not methodology.screen_result_valid(pg_temp.screen_result('pass',
  '[{"criterion":"concealment","severity":"review","excerpt":"Exact","explanation":"Synthetic concern."}]'),
  'Exact content',repeat('A',64)),'pass cannot retain findings');
select ok(not methodology.screen_result_valid(pg_temp.screen_result('review',
  '[{"criterion":null,"severity":"review","excerpt":"Exact","explanation":"Synthetic concern."}]'),
  'Exact content',repeat('A',64)),'JSON-null criterion refuses');
select ok(not methodology.screen_result_valid(pg_temp.screen_result('review',
  '[{"criterion":"concealment","severity":"review","excerpt":"Absent","explanation":"Synthetic concern."}]'),
  'Exact content',repeat('A',64)),'invented citation refuses');
select ok(not methodology.screen_result_valid(pg_temp.screen_result('review',
  '[{"criterion":"concealment","severity":"review","excerpt":"Exact","explanation":"Synthetic concern."},
    {"criterion":"concealment","severity":"review","excerpt":"Exact","explanation":"Another concern."}]'),
  'Exact content',repeat('A',64)),'duplicate criterion plus excerpt refuses');
select ok(not methodology.screen_result_valid(pg_temp.screen_result('review',
  '[{"criterion":"unknown","severity":"review","excerpt":"Exact","explanation":"Synthetic concern."}]'),
  'Exact content',repeat('A',64)),'unapproved criterion refuses');

select * from finish();
rollback;

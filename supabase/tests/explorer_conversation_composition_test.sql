-- Rollback-only, synthetic SQL contract fixture. UNRUN initial proposal.
-- Direct postgres fixtures model a trusted Root request. They do not prove Auth
-- login, cookie authorization, browser composition or actual provider behavior.
-- The context/config and terminal reply below are explicitly synthetic. No Auth
-- account, password, token, provider call, seed mutation or external I/O is used.
-- Run only against Root's isolated migration-proof database, never a shared DB.
begin;
select plan(76);

create function pg_temp.cid(n integer) returns uuid language sql immutable as $$
  select ('f4200000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid
$$;
do $$ begin
  if exists(select 1 from core.consent_document
    where document_status='active' and is_required_for_explorer is true) then
    raise exception 'synthetic_composition_fixture_requires_isolated_consent_state';
  end if;
end $$;

insert into identity.user_account(user_account_id,display_name,account_status) values
  (pg_temp.cid(1),'Synthetic Composition Explorer','active'),
  (pg_temp.cid(2),'Synthetic Composition Guide','active'),
  (pg_temp.cid(3),'Synthetic Composition Admin','active'),
  (pg_temp.cid(4),'Synthetic Other Explorer','active');
insert into identity.user_role_assignment(user_role_assignment_id,user_account_id,role_code,role_status) values
  (pg_temp.cid(11),pg_temp.cid(1),'explorer','active'),
  (pg_temp.cid(12),pg_temp.cid(2),'guide','active'),
  (pg_temp.cid(13),pg_temp.cid(3),'admin','active'),
  (pg_temp.cid(14),pg_temp.cid(4),'explorer','active');
insert into core.organization(organization_id,organization_name,approval_status,approved_by_user_account_id,approved_at)
  values(pg_temp.cid(21),'Synthetic Composition Organization','approved',pg_temp.cid(3),now());
insert into core.practice(practice_id,organization_id,practice_name,approval_status,approved_by_user_account_id,approved_at)
  values(pg_temp.cid(22),pg_temp.cid(21),'Synthetic Composition Practice','approved',pg_temp.cid(3),now());
insert into core.guide_profile(guide_profile_id,user_account_id,guide_display_name,setup_status,approved_by_user_account_id,approved_at,status)
  values(pg_temp.cid(23),pg_temp.cid(2),'Synthetic Guide Private Canary','approved',pg_temp.cid(3),now(),'active');
insert into core.explorer_profile(explorer_profile_id,user_account_id,explorer_display_name,onboarding_status,status) values
  (pg_temp.cid(24),pg_temp.cid(1),'Synthetic Composition Explorer','active','active'),
  (pg_temp.cid(26),pg_temp.cid(4),'Synthetic Other Explorer','active','active');
insert into core.guide_explorer_relationship(guide_explorer_relationship_id,guide_profile_id,explorer_profile_id,practice_id,relationship_status,started_at) values
  (pg_temp.cid(25),pg_temp.cid(23),pg_temp.cid(24),pg_temp.cid(22),'active',now()),
  (pg_temp.cid(27),pg_temp.cid(23),pg_temp.cid(26),pg_temp.cid(22),'active',now());
insert into core.consent_document(consent_document_id,consent_type,version_number,version_label,title,body_markdown,
  document_status,is_required_for_explorer,effective_at,created_by_user_account_id) values
  (pg_temp.cid(31),'user_agreement',9420,'synthetic-composition-9420','Synthetic Agreement','SQL fixture only.','active',true,now(),pg_temp.cid(3)),
  (pg_temp.cid(32),'ai_disclosure',9420,'synthetic-composition-9420','Synthetic AI Disclosure','SQL fixture only.','active',true,now(),pg_temp.cid(3));
insert into core.consent_record(consent_record_id,user_account_id,role_context,consent_type,document_version,consent_document_id,adult_affirmation) values
  (pg_temp.cid(41),pg_temp.cid(1),'explorer','user_agreement','synthetic-composition-9420',pg_temp.cid(31),true),
  (pg_temp.cid(42),pg_temp.cid(1),'explorer','ai_disclosure','synthetic-composition-9420',pg_temp.cid(32),true),
  (pg_temp.cid(43),pg_temp.cid(4),'explorer','user_agreement','synthetic-composition-9420',pg_temp.cid(31),true),
  (pg_temp.cid(44),pg_temp.cid(4),'explorer','ai_disclosure','synthetic-composition-9420',pg_temp.cid(32),true);
insert into identity.user_session(user_session_id,user_account_id,active_role_context,created_at,expires_at,session_status) values
  (pg_temp.cid(50),pg_temp.cid(1),'explorer',now()-interval '2 hours',now()+interval '1 hour','active'),
  (pg_temp.cid(54),pg_temp.cid(4),'explorer',now()-interval '2 hours',now()+interval '1 hour','active');
insert into core.intake_response_set(intake_response_set_id,guide_explorer_relationship_id,started_at,completed_at,intake_status,response_json) values
  (pg_temp.cid(52),pg_temp.cid(25),now()-interval '1 hour',now(),'completed',
    '{"supportNow":"Synthetic support source","usefulOutcome":"Synthetic useful outcome","supportStyle":"Synthetic style","guideContext":"Synthetic shared answer","communicationPreference":"Synthetic preference","doNotEmphasize":"Synthetic excluded topic"}'),
  (pg_temp.cid(55),pg_temp.cid(27),now()-interval '1 hour',now(),'completed',
    '{"supportNow":"Synthetic other support","usefulOutcome":"Synthetic other outcome","supportStyle":"Synthetic other style"}');

-- Compact fixed scalar-array serialization mirrors Root's JSON.stringify for
-- these ASCII fixture inputs. This is caller attestation, not DB command parsing.
create function pg_temp.command_fp(k text,op uuid,rev integer,b text default null,
  source_id uuid default null,item uuid default null,waypoint uuid default null,
  label text default null,destination text default null,meaning text default null,
  arrival text default null,evidence text default null)
returns text language sql immutable as $$
  select upper(encode(extensions.digest(convert_to('['||string_agg(x.value::text,',' order by x.ord)||']','UTF8'),'sha256'),'hex'))
  from jsonb_array_elements(jsonb_build_array('explorer-conversation.v1',k,op,rev,b,source_id,item,waypoint,label,destination,meaning,arrival,evidence))
    with ordinality x(value,ord)
$$;
create function pg_temp.prepare_turn(slot integer default 0,b text default 'Synthetic Explorer message',rev integer default 0,c uuid default null)
returns table(outcome text,conversation_state jsonb,dispatch_permitted boolean) language plpgsql as $$
declare a jsonb; op uuid:=pg_temp.cid(60+slot*10); msg uuid:=pg_temp.cid(61+slot*10);
  src uuid[]; context_bytes text:='{"syntheticSqlAttestation":true}';
begin
  select r.authority_context into a from public.solmind_read_explorer_conversation(pg_temp.cid(1),pg_temp.cid(50)) r;
  select array_agg(x order by x) into src from unnest(array[pg_temp.cid(52),msg,pg_temp.cid(90)]) x;
  return query select * from public.solmind_prepare_explorer_conversation_turn(
    pg_temp.cid(1),pg_temp.cid(50),coalesce(c,pg_temp.cid(51)),op,rev,msg,pg_temp.cid(62+slot*10),pg_temp.cid(63+slot*10),
    b,context_bytes,upper(encode(extensions.digest(convert_to(context_bytes,'UTF8'),'sha256'),'hex')),src,
    a->>'authorizationVersion',pg_temp.cid(52),pg_temp.cid(90),
    'synthetic-prompt.v1','synthetic-policy.v1','synthetic-behavior.v1','synthetic-crisis.v1',
    'synthetic-role.v1','synthetic-instruction.v1',pg_temp.command_fp('send',op,rev,b),pg_temp.cid(66+slot*10));
end $$;
create function pg_temp.mutate(op integer,rev integer,k text,source_id uuid default null,item uuid default null,
  waypoint uuid default null,label text default null,destination text default null,meaning text default null,
  arrival text default null,evidence text default null)
returns table(outcome text,conversation_state jsonb) language sql as $$
  select * from public.solmind_mutate_explorer_conversation(pg_temp.cid(1),pg_temp.cid(50),pg_temp.cid(51),pg_temp.cid(op),rev,k,
    pg_temp.command_fp(k,pg_temp.cid(op),rev,null,source_id,item,waypoint,label,destination,meaning,arrival,evidence),
    source_id,item,waypoint,label,destination,meaning,arrival,evidence)
$$;

select is((select count(*)::integer from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where (n.nspname='ai' and c.relname in ('explorer_conversation_state','explorer_conversation_operation','explorer_conversation_compass_item')
    or n.nspname='content' and c.relname='waypoint') and c.relrowsecurity),4,'all four private tables enable RLS');
select is((select count(*)::integer from pg_policies where (schemaname='ai' and tablename like 'explorer_conversation_%')
  or (schemaname='content' and tablename='waypoint')),0,'no permissive policies introduced');
select ok(not has_table_privilege('service_role','ai.explorer_conversation_state','SELECT')
  and not has_table_privilege('authenticated','content.waypoint','SELECT'),'private tables have no application SELECT grant');
select is((select count(*)::integer from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname in ('solmind_read_explorer_conversation','solmind_prepare_explorer_conversation_turn',
    'solmind_complete_explorer_conversation_turn','solmind_mutate_explorer_conversation')
    and p.prosecdef and has_function_privilege('service_role',p.oid,'EXECUTE')
    and not has_function_privilege('anon',p.oid,'EXECUTE') and not has_function_privilege('authenticated',p.oid,'EXECUTE')),4,
  'exact four SECURITY DEFINER RPCs expose only service-role execution');
select ok(not has_function_privilege('service_role','ai.solmind_conversation_authority(uuid,uuid,uuid)','EXECUTE'),
  'internal authority helper is not an application RPC');

select is((select conversation_state from public.solmind_read_explorer_conversation(pg_temp.cid(1),pg_temp.cid(50))),
  '{"version":"explorer-conversation.v1","conversationId":null,"revision":0,"pendingTurn":false,"providerState":"unavailable","messages":[],"compassItems":[],"priorityId":null,"attentionId":null,"waypoints":[]}'::jsonb,
  'authorized empty Discovery has the exact closed browser shape');
select ok((select authority_context->>'authorizationVersion' ~ '^AV2:[0-9A-F]{64}$'
  and authority_context->>'relationshipStatus'='active' and authority_context->>'adultAffirmation'='true'
  and authority_context->'onboarding'->'answers'->>'supportNow'='Synthetic support source'
  and authority_context::text not like '%Private Canary%'
  from public.solmind_read_explorer_conversation(pg_temp.cid(1),pg_temp.cid(50))),
  'whitelisted authority derives real fixture predicates and omits Guide private display content');

select ok((select outcome='ok' and dispatch_permitted and conversation_state->>'pendingTurn'='true'
  and conversation_state->>'revision'='1' from pg_temp.prepare_turn()),'new preparation persists one pending turn before any hypothetical dispatch');
select is((select count(*)::integer from ai.ai_interaction_message where ai_interaction_session_id=pg_temp.cid(51)),1,'preparation saves one Explorer message');
select ok((select outcome='stale_revision' and conversation_state is null and dispatch_permitted is false
  from pg_temp.prepare_turn(500,'Synthetic stale empty-state second tab',0,pg_temp.cid(9999))),
  'stale empty-state second tab cannot start a second active conversation');
select ok(not exists(select 1 from ai.ai_interaction_session where ai_interaction_session_id=pg_temp.cid(9999))
  and not exists(select 1 from ai.explorer_conversation_operation where operation_id=pg_temp.cid(5060)),
  'stale first-turn rejection creates no extra session or operation');
select ok((select evidence_contract_version='virtual-guide-predispatch-evidence.v2'
  and application_session_id=pg_temp.cid(50) and immediate_message_id=pg_temp.cid(61)
  and intake_response_set_id=pg_temp.cid(52) and methodology_context_pack_version_id=pg_temp.cid(90)
  and solmind_policy_version='synthetic-policy.v1' and crisis_policy_version='synthetic-crisis.v1'
  and cardinality(related_prior_session_ids)=0 from ai.ai_context_snapshot where ai_context_snapshot_id=pg_temp.cid(62)),
  'successor records actual session/source IDs and explicitly synthetic attested versions');
select ok((select request_status='started' and dispatch_contract_version='virtual-guide-predispatch-evidence.v2'
  and ai_context_snapshot_id=pg_temp.cid(62) and logical_operation_id=pg_temp.cid(66)
  from ai.ai_model_invocation where ai_model_invocation_id=pg_temp.cid(63)),
  'started invocation is bound to the persisted successor snapshot');
select is((select count(*)::integer from audit.audit_event where actor_user_account_id=pg_temp.cid(1)
  and event_type in ('ai_context_snapshot_created','ai_model_invocation_started')),2,'preparation atomically emits the exact two Family E event types');
select ok((select outcome='exact_replay' and not dispatch_permitted from pg_temp.prepare_turn()),'exact preparation replay never permits another dispatch');
select throws_ok($$select * from pg_temp.prepare_turn(0,'Changed bytes',0)$$,'P0001',
  'solmind_explorer_conversation_operation_conflict','same operation with changed body denies');
select ok((select outcome='exact_replay' and conversation_state->>'pendingTurn'='true'
  and jsonb_array_length(conversation_state->'messages')=1 from public.solmind_read_explorer_conversation(
    pg_temp.cid(1),pg_temp.cid(50),null,pg_temp.cid(60),pg_temp.command_fp('send',pg_temp.cid(60),0,'Synthetic Explorer message'))),
  'first-send replay preflight returns honest pending state without another preparation');
select throws_ok($$select * from public.solmind_read_explorer_conversation(pg_temp.cid(1),pg_temp.cid(50),null,pg_temp.cid(60),repeat('F',64))$$,
  'P0001','solmind_explorer_conversation_operation_conflict','replay preflight rejects changed canonical command fingerprint');
select throws_ok($$select * from public.solmind_read_explorer_conversation(pg_temp.cid(4),pg_temp.cid(54),pg_temp.cid(51))$$,
  'P0001','solmind_explorer_conversation_denied','a fully authorized other Explorer cannot read this conversation');
select throws_ok($$select * from public.solmind_read_explorer_conversation(pg_temp.cid(2),pg_temp.cid(50))$$,
  'P0001','solmind_explorer_conversation_denied','Guide actor cannot reuse the Explorer application session');
select throws_ok($$update ai.ai_context_snapshot set prompt_version='changed' where ai_context_snapshot_id=pg_temp.cid(62)$$,
  'P0001','solmind_explorer_conversation_snapshot_immutable','successor snapshot cannot be enriched or rewritten');

select is((select outcome from public.solmind_complete_explorer_conversation_turn(pg_temp.cid(1),pg_temp.cid(50),pg_temp.cid(51),
  pg_temp.cid(60),'completed',pg_temp.cid(64),'Synthetic SQL-only Virtual Guide reply')),'ok','synthetic terminal completion is retained once');
select ok((select conversation_state->>'pendingTurn'='false' and conversation_state->>'revision'='2'
  and conversation_state->'messages'->0->>'role'='explorer' and conversation_state->'messages'->1->>'role'='virtualGuide'
  from public.solmind_read_explorer_conversation(pg_temp.cid(1),pg_temp.cid(50),pg_temp.cid(51))),
  'completion produces ordered Explorer/reply state and clears pending');
select is((select outcome from public.solmind_complete_explorer_conversation_turn(pg_temp.cid(1),pg_temp.cid(50),pg_temp.cid(51),
  pg_temp.cid(60),'completed',pg_temp.cid(64),'Synthetic SQL-only Virtual Guide reply')),'exact_replay','exact terminal replay is idempotent');
select throws_ok($$select * from public.solmind_complete_explorer_conversation_turn(pg_temp.cid(1),pg_temp.cid(50),pg_temp.cid(51),
  pg_temp.cid(60),'completed',pg_temp.cid(64),'Changed reply')$$,'P0001','solmind_explorer_conversation_operation_conflict','terminal changed-byte reuse denies');
select ok((select outcome='exact_replay' and jsonb_array_length(conversation_state->'messages')=2
  and conversation_state->>'pendingTurn'='false' from public.solmind_read_explorer_conversation(pg_temp.cid(1),pg_temp.cid(50),null,
    pg_temp.cid(60),pg_temp.command_fp('send',pg_temp.cid(60),0,'Synthetic Explorer message'))),
  'first-send retry after history growth succeeds before context rebuilding and adds no messages');
select is((select count(*)::integer from ai.explorer_conversation_operation where conversation_id=pg_temp.cid(51)),1,'all send retries retain one operation');

select is((select outcome from pg_temp.mutate(100,2,'add_compass',pg_temp.cid(61),null,null,'Synthetic first Compass')),'ok','Explorer explicitly selects a saved own message as Compass input');
select is((select outcome from pg_temp.mutate(100,2,'add_compass',pg_temp.cid(61),null,null,'Synthetic first Compass')),'exact_replay','Compass operation replay is idempotent');
select throws_ok($$select * from pg_temp.mutate(100,2,'add_compass',pg_temp.cid(61),null,null,'Changed label')$$,
  'P0001','solmind_explorer_conversation_operation_conflict','changed Compass command bytes deny');
update ai.ai_interaction_message set ai_role='solmind_guide_assistant' where ai_interaction_message_id=pg_temp.cid(64);
select throws_ok($$select * from pg_temp.mutate(109,3,'add_compass',pg_temp.cid(64),null,null,'Other AI role')$$,
  'P0001','solmind_explorer_conversation_denied','another AI role is not an allowed Explorer formation source');
update ai.ai_interaction_message set ai_role='solmind_virtual_guide' where ai_interaction_message_id=pg_temp.cid(64);
select is((select outcome from pg_temp.mutate(101,3,'add_compass',pg_temp.cid(64),null,null,'Synthetic selected Virtual Guide text')),'ok',
  'Explorer may explicitly select a saved owned Virtual Guide message without implying its truth');
select is((select outcome from pg_temp.mutate(102,4,'confirm_priority',null,pg_temp.cid(100))),'ok','Priority requires explicit selection of an owned Compass item');
select is((select outcome from pg_temp.mutate(103,5,'set_attention',null,pg_temp.cid(101))),'ok','attention is an independent explicit selection');
select ok((select conversation_state->>'priorityId'=pg_temp.cid(100)::text and conversation_state->>'attentionId'=pg_temp.cid(101)::text
  from public.solmind_read_explorer_conversation(pg_temp.cid(1),pg_temp.cid(50))),'Priority and attention persist independently');
select is((select outcome from pg_temp.mutate(104,6,'confirm_waypoint',pg_temp.cid(61),null,null,null,
  E'Synthetic destination\nwith a paragraph',E'Synthetic meaning\nwith a paragraph',E'Synthetic arrival\nwith a paragraph')),'ok',
  'explicit Explorer confirmation creates a private chosen Waypoint with multiline scalar fields');
select ok((select lifecycle_status='chosen' and visibility='explorer_private' and reached_evidence is null
  and chosen_by_explorer_user_account_id=pg_temp.cid(1) from content.waypoint where waypoint_id=pg_temp.cid(104)),
  'confirmed destination is chosen and private without inferred arrival');
select is((select conversation_state->'waypoints'->0->>'status' from public.solmind_read_explorer_conversation(pg_temp.cid(1),pg_temp.cid(50))),
  'chosen','browser projection preserves canonical chosen lifecycle');
select throws_ok($$select * from pg_temp.mutate(105,7,'confirm_reached',null,null,pg_temp.cid(104))$$,
  'P0001','solmind_explorer_conversation_invalid_input','reached requires explicit nonblank evidence');
select is((select outcome from pg_temp.mutate(105,7,'confirm_reached',null,null,pg_temp.cid(104),null,null,null,null,
  E'Synthetic reviewed arrival evidence\nSecond paragraph')),'ok','explicit reviewed reached action retains multiline evidence');
select ok((select lifecycle_status='reached' and reached_by_explorer_user_account_id=pg_temp.cid(1)
  and reached_evidence=E'Synthetic reviewed arrival evidence\nSecond paragraph' from content.waypoint where waypoint_id=pg_temp.cid(104)),
  'reached evidence is stored in normal columns with Explorer provenance');
select throws_ok($$select * from pg_temp.mutate(106,8,'add_compass',pg_temp.cid(61),null,null,repeat('L',161))$$,
  'P0001','solmind_explorer_conversation_invalid_input','label bound rejects oversized input before effects');
select throws_ok($$select * from pg_temp.mutate(106,8,'add_compass',pg_temp.cid(61),null,null,E'Label\nline')$$,
  'P0001','solmind_explorer_conversation_invalid_input','Compass label remains single-line');
select throws_ok($$select * from pg_temp.mutate(106,8,'confirm_waypoint',pg_temp.cid(61),null,null,null,'Destination','Meaning',E'Arrival\001control')$$,
  'P0001','solmind_explorer_conversation_invalid_input','multiline fields reject other C0 controls');
select is((select outcome from pg_temp.mutate(106,0,'add_compass',pg_temp.cid(61),null,null,'Stale selection')),'stale_revision','stale revision refuses formation without saving an operation');

update identity.user_session set expires_at=now()-interval '1 minute' where user_session_id=pg_temp.cid(50);
select throws_ok($$select * from public.solmind_read_explorer_conversation(pg_temp.cid(1),pg_temp.cid(50))$$,
  'P0001','solmind_explorer_conversation_denied','current expiry is reverified on every read');
update identity.user_session set expires_at=now()+interval '1 hour' where user_session_id=pg_temp.cid(50);
update identity.user_session set session_status='logged_out',ended_at=now() where user_session_id=pg_temp.cid(50);
select throws_ok($$select * from public.solmind_read_explorer_conversation(pg_temp.cid(1),pg_temp.cid(50))$$,
  'P0001','solmind_explorer_conversation_denied','logged-out application session denies');
update identity.user_session set session_status='active',ended_at=null where user_session_id=pg_temp.cid(50);
update core.organization set status='inactive' where organization_id=pg_temp.cid(21);
select throws_ok($$select * from public.solmind_read_explorer_conversation(pg_temp.cid(1),pg_temp.cid(50))$$,
  'P0001','solmind_explorer_conversation_denied','inactive Organization denies despite retained conversation ownership');
update core.organization set status='active' where organization_id=pg_temp.cid(21);
update core.consent_record set adult_affirmation=false where consent_record_id=pg_temp.cid(41);
select throws_ok($$select * from public.solmind_read_explorer_conversation(pg_temp.cid(1),pg_temp.cid(50))$$,
  'P0001','solmind_explorer_conversation_denied','missing current adult affirmation denies');
update core.consent_record set adult_affirmation=true where consent_record_id=pg_temp.cid(41);
update core.explorer_profile set onboarding_status='intake_pending' where explorer_profile_id=pg_temp.cid(24);
select throws_ok($$select * from public.solmind_read_explorer_conversation(pg_temp.cid(1),pg_temp.cid(50))$$,
  'P0001','solmind_explorer_conversation_denied','incomplete onboarding denies');
update core.explorer_profile set onboarding_status='active' where explorer_profile_id=pg_temp.cid(24);
update ai.ai_interaction_session set metadata='{"restricted_mode":true}' where ai_interaction_session_id=pg_temp.cid(51);
select throws_ok($$select * from public.solmind_read_explorer_conversation(pg_temp.cid(1),pg_temp.cid(50))$$,
  'P0001','solmind_explorer_conversation_denied','restricted safety mode denies');
update ai.ai_interaction_session set metadata='{}' where ai_interaction_session_id=pg_temp.cid(51);
update core.guide_explorer_relationship set relationship_status='paused' where guide_explorer_relationship_id=pg_temp.cid(25);
select is((select authority_context->>'relationshipStatus' from public.solmind_read_explorer_conversation(pg_temp.cid(1),pg_temp.cid(50))),
  'paused','allowed paused relationship remains truthfully paused in server authority');
update core.guide_explorer_relationship set relationship_status='active' where guide_explorer_relationship_id=pg_temp.cid(25);

select ok((select outcome='ok' and dispatch_permitted and conversation_state->>'pendingTurn'='true'
  and conversation_state->>'revision'='9' from pg_temp.prepare_turn(1,'Synthetic second message',8)),
  'later valid preparation creates a new pending turn at the current revision');
select is((select outcome from pg_temp.mutate(106,9,'add_compass',pg_temp.cid(61),null,null,'Blocked while pending')),
  'unavailable','new formation is held while the reply remains unconfirmed');
select is((select outcome from public.solmind_complete_explorer_conversation_turn(pg_temp.cid(1),pg_temp.cid(50),pg_temp.cid(51),
  pg_temp.cid(70),'failed',null,null)),'ok','explicit failed terminalization settles the owned pending operation');
select ok((select conversation_state->>'pendingTurn'='false' and conversation_state->>'revision'='10'
  and jsonb_array_length(conversation_state->'messages')=3 from public.solmind_read_explorer_conversation(pg_temp.cid(1),pg_temp.cid(50))),
  'failure retains the accepted human message and adds no fabricated reply');
select is((select outcome from public.solmind_complete_explorer_conversation_turn(pg_temp.cid(1),pg_temp.cid(50),pg_temp.cid(51),
  pg_temp.cid(70),'failed',null,null)),'exact_replay','failed terminal replay is idempotent');
select ok((select request_status='failed' and ai_interaction_message_id is null and error_summary='provider_unavailable'
  from ai.ai_model_invocation where ai_model_invocation_id=pg_temp.cid(73)),'failed invocation has a fixed value-free error and no response link');
select is((select outcome from pg_temp.prepare_turn(2,'Synthetic stale turn',8)),'stale_revision','stale new send refuses before evidence writes');
select is((select count(*)::integer from ai.ai_context_snapshot where ai_interaction_session_id=pg_temp.cid(51)),2,
  'only two accepted turns produced successor snapshots');
select is((select count(*)::integer from ai.explorer_conversation_compass_item where conversation_id=pg_temp.cid(51)),2,
  'denied, stale and pending formation attempts leave exactly two accepted Compass items');
select is((select count(*)::integer from ai.explorer_conversation_operation where operation_id=pg_temp.cid(106)),0,
  'failed or stale commands do not consume the operation identifier');

select is((select outcome from pg_temp.prepare_turn(2,'Synthetic logout-during-attempt message',10)),
  'ok','a third authorized turn is retained before its session ends');
update identity.user_session set session_status='logged_out',ended_at=now() where user_session_id=pg_temp.cid(50);
select throws_ok($$select * from public.solmind_complete_explorer_conversation_turn(pg_temp.cid(1),pg_temp.cid(50),pg_temp.cid(51),
  pg_temp.cid(80),'completed',pg_temp.cid(84),'Must not be appended after logout')$$,
  'P0001','solmind_explorer_conversation_denied','a completed reply still requires current full authorization');
select ok((select outcome='ok' and conversation_state is null from public.solmind_complete_explorer_conversation_turn(
  pg_temp.cid(1),pg_temp.cid(50),pg_temp.cid(51),pg_temp.cid(80),'canceled',null,null)),
  'original server operation can settle canceled after logout without returning private state');
select ok((select pending_operation_id is null and revision=12 from ai.explorer_conversation_state where conversation_id=pg_temp.cid(51))
  and (select count(*) from ai.ai_interaction_message where ai_interaction_session_id=pg_temp.cid(51))=4,
  'post-logout settlement clears only pending control state and adds no reply');
select is((select outcome from public.solmind_complete_explorer_conversation_turn(pg_temp.cid(1),pg_temp.cid(50),pg_temp.cid(51),
  pg_temp.cid(80),'canceled',null,null)),'exact_replay','post-logout cleanup is idempotent');
select throws_ok($$select * from public.solmind_complete_explorer_conversation_turn(pg_temp.cid(4),pg_temp.cid(54),pg_temp.cid(51),
  pg_temp.cid(80),'canceled',null,null)$$,'P0001','solmind_explorer_conversation_denied',
  'another actor cannot use retained cleanup authority');
update identity.user_session set session_status='active',ended_at=null where user_session_id=pg_temp.cid(50);

-- Exercise finite capacity using only synthetic rows in this rollback scope.
do $$ declare x integer; r record; begin
  for x in 0..5 loop
    select * into r from pg_temp.mutate(200+x,12+x,'add_compass',pg_temp.cid(61),null,null,'Synthetic capacity item '||x);
    if r.outcome is distinct from 'ok' then raise exception 'synthetic_compass_capacity_setup_failed'; end if;
  end loop;
end $$;
select is((select count(*)::integer from ai.explorer_conversation_compass_item where conversation_id=pg_temp.cid(51)),8,
  'eight explicitly accepted Compass items fit the finite bound');
select is((select outcome from pg_temp.mutate(206,18,'add_compass',pg_temp.cid(61),null,null,'Synthetic ninth item')),
  'unavailable','ninth Compass item is refused without an operation');
select is((select count(*)::integer from ai.explorer_conversation_operation where operation_id=pg_temp.cid(206)),0,
  'Compass capacity refusal has no retained operation');
do $$ declare x integer; r record; begin
  for x in 0..18 loop
    select * into r from pg_temp.mutate(300+x,18+x,'confirm_waypoint',pg_temp.cid(64),null,null,null,
      'Synthetic capacity destination '||x,'Synthetic capacity meaning','Synthetic capacity arrival');
    if r.outcome is distinct from 'ok' then raise exception 'synthetic_waypoint_capacity_setup_failed'; end if;
  end loop;
end $$;
select is((select count(*)::integer from content.waypoint where source_ai_interaction_session_id=pg_temp.cid(51)),20,
  '20 explicit private Waypoints fit the finite bound');
select is((select outcome from pg_temp.mutate(319,37,'confirm_waypoint',pg_temp.cid(61),null,null,null,
  'Synthetic twenty-first destination','Synthetic meaning','Synthetic arrival')),'unavailable','twenty-first Waypoint is refused');
select is((select count(*)::integer from ai.explorer_conversation_operation where operation_id=pg_temp.cid(319)),0,
  'Waypoint capacity refusal has no retained operation');
-- Direct synthetic message rows isolate the pair-reservation boundary. These
-- rows are fixture setup, not claims of RPC/provider/browser execution.
insert into ai.ai_interaction_message(ai_interaction_message_id,ai_interaction_session_id,sequence_number,
  sender_type,sender_user_account_id,sender_role_context,content_text)
select pg_temp.cid(1000+n),pg_temp.cid(51),n,'user',pg_temp.cid(1),'explorer','Synthetic capacity history '||n
  from generate_series(5,99) n;
select is((select outcome from pg_temp.prepare_turn(3,'Synthetic turn beyond reserved pair capacity',37)),
  'unavailable','99 saved messages cannot reserve an Explorer/reply pair under the 100-message cap');
select is((select count(*)::integer from ai.ai_context_snapshot where ai_interaction_session_id=pg_temp.cid(51)),3,
  'message-cap refusal creates no additional successor evidence');
select * from finish();
rollback;

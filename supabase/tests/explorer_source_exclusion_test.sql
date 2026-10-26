-- Synthetic rollback-only source contract tests. UNRUN proposal.
-- Root runs these only after its following private-lifecycle migration in one
-- owned isolated database. No shared data, Auth login, provider, real user,
-- operational maintenance interval, concurrency or paging claim is made here.
begin;
select no_plan();

create function pg_temp.xid(n integer) returns uuid language sql immutable as $$
  select ('f5120000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid
$$;
create function pg_temp.compact(value jsonb) returns text language plpgsql immutable as $$
declare result text;
begin
  if jsonb_typeof(value)='object' then
    select '{'||coalesce(string_agg(to_jsonb(x.key)::text||':'||pg_temp.compact(x.value),',' order by x.key),'')||'}'
      into result from jsonb_each(value) x;
  elsif jsonb_typeof(value)='array' then
    select '['||coalesce(string_agg(pg_temp.compact(x.value),',' order by x.ord),'')||']'
      into result from jsonb_array_elements(value) with ordinality x(value,ord);
  else result:=value::text; end if;
  return result;
end $$;

insert into identity.user_account(user_account_id,display_name,account_status) values
  (pg_temp.xid(1),'Synthetic Source Explorer','active'),
  (pg_temp.xid(2),'Synthetic Source Guide','active'),
  (pg_temp.xid(3),'Synthetic Source Admin','active'),
  (pg_temp.xid(4),'Synthetic Other Source Explorer','active');
insert into identity.user_role_assignment(user_role_assignment_id,user_account_id,role_code,role_status) values
  (pg_temp.xid(11),pg_temp.xid(1),'explorer','active'),
  (pg_temp.xid(12),pg_temp.xid(2),'guide','active'),
  (pg_temp.xid(13),pg_temp.xid(3),'admin','active'),
  (pg_temp.xid(14),pg_temp.xid(4),'explorer','active');
insert into core.organization(organization_id,organization_name,approval_status,approved_by_user_account_id,approved_at)
  values(pg_temp.xid(21),'Synthetic Source Organization','approved',pg_temp.xid(3),now());
insert into core.practice(practice_id,organization_id,practice_name,approval_status,approved_by_user_account_id,approved_at)
  values(pg_temp.xid(22),pg_temp.xid(21),'Synthetic Source Practice','approved',pg_temp.xid(3),now());
insert into core.guide_profile(guide_profile_id,user_account_id,guide_display_name,setup_status,approved_by_user_account_id,approved_at,status)
  values(pg_temp.xid(23),pg_temp.xid(2),'Synthetic Source Guide','approved',pg_temp.xid(3),now(),'active');
insert into core.explorer_profile(explorer_profile_id,user_account_id,explorer_display_name,onboarding_status,status) values
  (pg_temp.xid(24),pg_temp.xid(1),'Synthetic Source Explorer','active','active'),
  (pg_temp.xid(26),pg_temp.xid(4),'Synthetic Other Source Explorer','active','active');
insert into core.guide_explorer_relationship(guide_explorer_relationship_id,guide_profile_id,explorer_profile_id,practice_id,relationship_status,started_at)
  values(pg_temp.xid(25),pg_temp.xid(23),pg_temp.xid(24),pg_temp.xid(22),'active',now()),
    (pg_temp.xid(27),pg_temp.xid(23),pg_temp.xid(26),pg_temp.xid(22),'active',now());
insert into identity.user_session(user_session_id,user_account_id,active_role_context,created_at,expires_at,session_status)
  values(pg_temp.xid(50),pg_temp.xid(1),'explorer',now()-interval '1 hour',now()+interval '1 hour','active'),
    (pg_temp.xid(54),pg_temp.xid(4),'explorer',now()-interval '1 hour',now()+interval '1 hour','active');
insert into core.intake_response_set(intake_response_set_id,guide_explorer_relationship_id,started_at,completed_at,intake_status,response_json)
  values(pg_temp.xid(52),pg_temp.xid(25),now()-interval '1 hour',now()-interval '1 minute','completed',
    '{"supportNow":"Synthetic submitted support","usefulOutcome":"Synthetic submitted outcome","supportStyle":"Synthetic submitted style","guideContext":"Synthetic submitted Guide context","communicationPreference":"Synthetic submitted preference","doNotEmphasize":"Synthetic submitted boundary"}');
insert into ai.ai_interaction_session(ai_interaction_session_id,session_type,actor_user_account_id,actor_role_context,
  guide_profile_id,explorer_profile_id,guide_explorer_relationship_id,practice_id,metadata)
  values(pg_temp.xid(51),'explorer_reflection',pg_temp.xid(1),'explorer',pg_temp.xid(23),pg_temp.xid(24),pg_temp.xid(25),pg_temp.xid(22),
    '{"restricted_mode":false}');
insert into ai.explorer_conversation_state(conversation_id,actor_user_account_id) values(pg_temp.xid(51),pg_temp.xid(1));

create function pg_temp.context(body text default 'Synthetic ordinary immediate text') returns jsonb language sql stable as $$
  select jsonb_build_object('contractVersion','wi007-v0.1+onboarding-fields-v2','aiRole','solmind_virtual_guide','actorRoleContext','explorer',
    'globalPolicy',jsonb_build_object('version','synthetic-global.v1','text','Synthetic global behavior rules.'),
    'roleBehavior',jsonb_build_object('version','synthetic-role.v1','text','Synthetic role behavior rules.'),
    'crisisBehavior',jsonb_build_object('version','synthetic-crisis.v1','text','Synthetic crisis behavior rules.'),
    'methodologyContext',jsonb_build_object('version','methodology:'||pg_temp.xid(90),'text','Synthetic methodology context.'),
    'sessionContext',jsonb_build_object('sessionType','explorer_virtual_guide','explorerId',pg_temp.xid(24),
      'sessionId',pg_temp.xid(51),'continuityBindingId',pg_temp.xid(25),'explorerDisplayName',null,
      'activeFocusItems','[]'::jsonb,'nextAppointment',null,'explorerSafeGuardrail',null),
    'approvedContinuity',(select jsonb_agg(jsonb_build_object('sourceId',pg_temp.xid(52),'order',f.ord-1,
      'kind','onboarding_answer','field',f.name,'content',ai.solmind_exclusion_normalize_v3(i.response_json->>f.name)) order by f.ord)
      from core.intake_response_set i cross join unnest(array['supportNow','usefulOutcome','supportStyle','guideContext',
        'communicationPreference','doNotEmphasize']) with ordinality f(name,ord) where i.intake_response_set_id=pg_temp.xid(52)),
    'currentSessionMessages',coalesce((select jsonb_agg(jsonb_build_object('messageId',h.ai_interaction_message_id,'order',h.ord-1,
      'explorerId',pg_temp.xid(24),'sessionId',pg_temp.xid(51),'role',case when h.sender_type='user' then 'explorer' else 'solmind_virtual_guide' end,
      'content',ai.solmind_exclusion_normalize_v3(h.content_text)) order by h.ord)
      from (select x.*,row_number() over(order by x.sequence_number) as ord from (select * from ai.ai_interaction_message
        where ai_interaction_session_id=pg_temp.xid(51) order by sequence_number desc limit 24) x) h),'[]'::jsonb),
    'immediateExplorerMessage',jsonb_build_object('messageId',pg_temp.xid(61),'explorerId',pg_temp.xid(24),
      'sessionId',pg_temp.xid(51),'role','explorer','content',ai.solmind_exclusion_normalize_v3(body)),
    'outputRequirements',jsonb_build_object('format','plain_text','includeCitations',false,'allowMarkdown',false))
$$;
create function pg_temp.source_ids() returns uuid[] language sql stable as $$
  select array_agg(distinct id order by id) from (
    select unnest(array[pg_temp.xid(52),pg_temp.xid(61),pg_temp.xid(90)]) as id
    union all select m.ai_interaction_message_id from (select * from ai.ai_interaction_message
      where ai_interaction_session_id=pg_temp.xid(51) order by sequence_number desc limit 24) m) x
$$;
create function pg_temp.inspect(body text default 'Synthetic ordinary immediate text')
returns table(outcome text,excluded_entity_type text,excluded_entity_id uuid) language sql volatile as $$
  select * from ai.solmind_inspect_explorer_context_v3(pg_temp.xid(1),pg_temp.xid(50),pg_temp.xid(24),pg_temp.xid(25),
    pg_temp.xid(51),pg_temp.compact(pg_temp.context(body)),pg_temp.source_ids())
$$;
create function pg_temp.inspect_json(value jsonb)
returns table(outcome text,excluded_entity_type text,excluded_entity_id uuid) language sql volatile as $$
  select * from ai.solmind_inspect_explorer_context_v3(pg_temp.xid(1),pg_temp.xid(50),pg_temp.xid(24),pg_temp.xid(25),
    pg_temp.xid(51),pg_temp.compact(value),pg_temp.source_ids())
$$;
create function pg_temp.record_exclusion(body text)
returns table(outcome text,excluded_entity_type text,excluded_entity_id uuid,audit_event_id uuid) language sql volatile as $$
  select * from ai.solmind_record_explorer_context_exclusion_v3(pg_temp.xid(1),pg_temp.xid(50),pg_temp.xid(24),pg_temp.xid(25),
    pg_temp.xid(51),pg_temp.compact(pg_temp.context(body)),pg_temp.source_ids())
$$;

select ok(to_regclass('ai.explorer_safety_evidence') is not null,'following Root lifecycle owner exists; no fake capability is manufactured');
select ok(to_regprocedure('ai.solmind_exclusion_strings_v3(json,boolean)') is not null
  and to_regprocedure('ai.solmind_exclusion_strings_v3(json)') is null,'exact bounded helper signature exists without an unreviewed old overload');
select is((select count(*)::integer from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='ai'
  and p.proname in ('solmind_exclusion_normalize_v3','solmind_exclusion_fingerprint_v3','solmind_exclusion_keys_v3',
    'solmind_exclusion_strings_v3','solmind_inspect_explorer_context_v3','solmind_record_explorer_context_exclusion_v3')
  and not p.prosecdef and p.proowner=(select oid from pg_roles where rolname='postgres') and p.proconfig@>array['search_path=""']),6,
  'six exact internal helpers use invoker security, postgres ownership and empty search paths');
select ok(not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  cross join unnest(array['anon','authenticated','service_role']) actor(name)
  where n.nspname='ai' and p.proname in ('solmind_exclusion_normalize_v3','solmind_exclusion_fingerprint_v3','solmind_exclusion_keys_v3',
    'solmind_exclusion_strings_v3','solmind_inspect_explorer_context_v3','solmind_record_explorer_context_exclusion_v3')
    and has_function_privilege(actor.name,p.oid,'EXECUTE')),'no API actor can execute any internal source helper');
select is(ai.solmind_exclusion_normalize_v3(U&'\00A0\FEFFa\000D\000Ab\000Dc\3000'),E'a\nb\nc',
  'normalization uses CRLF/CR to LF and the exact ECMAScript outer trim set');
select is(ai.solmind_exclusion_normalize_v3(U&'\0085a\200B'),U&'\0085a\200B','non-ECMAScript trim characters remain unchanged');
select is(ai.solmind_exclusion_fingerprint_v3('abc'),'BA7816BF8F01CFEA414140DE5DAE2223B00361A396177A9CB410FF61F20015AD',
  'fingerprint uses uppercase exact UTF8 SHA256');
select isnt(ai.solmind_exclusion_fingerprint_v3(U&'\00E9'),ai.solmind_exclusion_fingerprint_v3(U&'e\0301'),
  'normalization does not claim NFC equivalence');
select ok(not ai.solmind_exclusion_keys_v3('{"a":1,"a":2}'::json,array['a']),'duplicate JSON keys are not erased before validation');
select is((select outcome from pg_temp.inspect()),'clear','real owned empty conversation and exact submitted sources inspect clear');
select ok((select excluded_entity_type is null and excluded_entity_id is null from pg_temp.inspect()),'clear carries no private references');
select is((select outcome from pg_temp.inspect_json(pg_temp.context()||'{"unknown":true}'::jsonb)),'unavailable','extra input envelope field is unavailable');
select is((select outcome from pg_temp.inspect_json(jsonb_set(pg_temp.context(),'{sessionContext,continuityBindingId}',to_jsonb(pg_temp.xid(27))))),
  'unavailable','foreign relationship binding is unavailable');
select is((select outcome from pg_temp.inspect_json(jsonb_set(pg_temp.context(),'{approvedContinuity,0,content}','"invented submitted content"'))),
  'unavailable','onboarding content is derived from actual current row');
select is((select outcome from pg_temp.inspect_json(jsonb_set(pg_temp.context(),'{approvedContinuity,0,kind}','"summary"'))),
  'unavailable','actual builder cannot add Summary continuity');
select is((select outcome from ai.solmind_inspect_explorer_context_v3(pg_temp.xid(1),pg_temp.xid(50),pg_temp.xid(24),pg_temp.xid(25),
  pg_temp.xid(51),' '||pg_temp.compact(pg_temp.context()),pg_temp.source_ids())),'unavailable','noncompact bytes are unavailable');
select is((select outcome from ai.solmind_inspect_explorer_context_v3(pg_temp.xid(1),pg_temp.xid(50),pg_temp.xid(24),pg_temp.xid(25),
  pg_temp.xid(51),'{bad',pg_temp.source_ids())),'unavailable','malformed JSON returns only unavailable');
select is((select outcome from ai.solmind_inspect_explorer_context_v3(pg_temp.xid(4),pg_temp.xid(54),pg_temp.xid(24),pg_temp.xid(25),
  pg_temp.xid(51),pg_temp.compact(pg_temp.context()),pg_temp.source_ids())),'unavailable','other account and valid other application session cannot inspect this source scope');
select is((select outcome from ai.solmind_inspect_explorer_context_v3(pg_temp.xid(1),pg_temp.xid(50),pg_temp.xid(24),pg_temp.xid(25),
  pg_temp.xid(999),pg_temp.compact(pg_temp.context()),pg_temp.source_ids())),'unavailable','prospective absent conversation cannot anchor source evidence');
select is((select outcome from ai.solmind_inspect_explorer_context_v3(pg_temp.xid(1),pg_temp.xid(50),pg_temp.xid(24),pg_temp.xid(25),
  pg_temp.xid(51),pg_temp.compact(pg_temp.context()),array[pg_temp.xid(52),pg_temp.xid(61),pg_temp.xid(90),pg_temp.xid(999)])),
  'unavailable','caller cannot add an arbitrary included source identity');

insert into content.summary(summary_id,guide_explorer_relationship_id,summary_type,summary_status,created_by_actor_type,created_by_user_account_id,metadata)
  values(pg_temp.xid(100),pg_temp.xid(25),'guide_summary','approved','guide',pg_temp.xid(2),'{"nested":{"canary":"Canary container metadata 100."}}'),
    (pg_temp.xid(200),pg_temp.xid(27),'guide_summary','approved','guide',pg_temp.xid(2),'{}');
insert into content.summary_revision(summary_revision_id,summary_id,revision_number,content_markdown,revision_status,
  created_by_actor_type,created_by_user_account_id,created_by_role_context,ai_change_summary,metadata)
  values(pg_temp.xid(101),pg_temp.xid(100),1,'Canary raw revision body 101.','guide_approved','guide',pg_temp.xid(2),'guide',
    'Canary AI change 101.','{"nested":["Canary revision metadata 101."]}'),
    (pg_temp.xid(201),pg_temp.xid(200),1,'Canary other relationship body 201.','guide_approved','guide',pg_temp.xid(2),'guide',null,'{}');
update content.summary set current_revision_id=pg_temp.xid(101) where summary_id=pg_temp.xid(100);
update content.summary set current_revision_id=pg_temp.xid(201) where summary_id=pg_temp.xid(200);
insert into content.summary_section(summary_section_id,summary_revision_id,section_type,section_title,content_markdown,visibility,display_order)
  values(pg_temp.xid(102),pg_temp.xid(101),'guide_only','Canary private title 102.','Canary private body 102.','guide_only',1),
    (pg_temp.xid(103),pg_temp.xid(101),'explorer_facing','Canary eligible title 103.','Canary eligible body 103.','explorer_publishable',2);
insert into content.trigger_observation(trigger_observation_id,guide_explorer_relationship_id,trigger_label,observation_text,created_by_actor_type,metadata)
  values(pg_temp.xid(110),pg_temp.xid(25),'Canary trigger label 110.','Canary trigger text 110.','guide','{"nested":["Canary trigger metadata 110."]}'),
    (pg_temp.xid(210),pg_temp.xid(27),'Canary other trigger label 210.','Canary other trigger text 210.','guide','{}');

select is((select outcome from pg_temp.inspect('Canary trigger label 110.')),'blocked','actual trigger label is covered independently');
select is((select outcome from pg_temp.inspect('Canary trigger text 110.')),'blocked','actual trigger observation text is covered independently');
select is((select outcome from pg_temp.inspect('Canary trigger metadata 110.')),'blocked','decoded nested trigger metadata strings are covered');
select is((select outcome from pg_temp.inspect('Canary raw revision body 101.')),'blocked','raw nonpublished revision body is excluded');
select is((select outcome from pg_temp.inspect('Canary AI change 101.')),'blocked','AI change summary is independently excluded');
select is((select outcome from pg_temp.inspect('Canary revision metadata 101.')),'blocked','revision metadata is independently excluded');
select is((select outcome from pg_temp.inspect('Canary private title 102.')),'blocked','private section title is independently excluded');
select is((select outcome from pg_temp.inspect('Canary private body 102.')),'blocked','private section body is independently excluded');
select is((select outcome from pg_temp.inspect('Canary container metadata 100.')),'blocked','container metadata is covered with real containing revision');
select ok((select excluded_entity_type='summary_revision' and excluded_entity_id=pg_temp.xid(101)
  from pg_temp.inspect('Canary private body 102.')),'section retains independent match identity internally and reports its actual containing revision');
select is((select outcome from pg_temp.inspect('Canary eligible body 103.')),'blocked','publishable section without actual publication stays excluded');
select is((select outcome from pg_temp.inspect('prefix '||upper(pg_temp.xid(102)::text)||' suffix')),'blocked','embedded case-insensitive section UUID is inspected');
select is((select outcome from pg_temp.inspect('prefix '||upper(pg_temp.xid(110)::text)||' suffix')),'blocked','embedded case-insensitive trigger UUID is inspected');
select is((select outcome from pg_temp.inspect(U&'\00A0Canary trigger text 110.\3000')),'blocked','source and context share exact outer Unicode trim mechanics');
select is((select outcome from pg_temp.inspect('prefix Canary trigger text 110. suffix')),'clear','whole-field guard explicitly does not claim embedded-fragment coverage');
select is((select outcome from pg_temp.inspect('Canary other trigger text 210.')),'clear','denylist is relationship-bound rather than a cross-Explorer content oracle');

select is((select outcome from public.solmind_publish_summary_to_explorer(pg_temp.xid(100),pg_temp.xid(101),pg_temp.xid(24),
  pg_temp.xid(2),(select version from content.summary where summary_id=pg_temp.xid(100)),pg_temp.xid(120))),
  'published','actual existing publication transition creates a target-bound projection');
select is((select outcome from pg_temp.inspect('Canary eligible body 103.')),'clear','exact currently published Explorer-facing section body can be eligible');
select is((select outcome from pg_temp.inspect('Canary eligible title 103.')),'clear','exact currently published Explorer-facing section title can be eligible');
select is((select outcome from pg_temp.inspect(pg_temp.xid(101)::text)),'clear','eligible published revision identity does not authorize or falsely match its other private fields');
select is((select outcome from pg_temp.inspect(pg_temp.xid(103)::text)),'clear','eligible published section UUID is independently permitted');
savepoint eligible_id_private_duplicate;
insert into content.summary_section(summary_section_id,summary_revision_id,section_type,section_title,content_markdown,visibility,display_order)
  values(pg_temp.xid(105),pg_temp.xid(101),'guide_only','Synthetic private UUID duplicate.',pg_temp.xid(101)::text,'guide_only',4);
select is((select outcome from pg_temp.inspect(pg_temp.xid(101)::text)),'blocked','actual private text equal to eligible UUID still independently blocks');
rollback to savepoint eligible_id_private_duplicate;
savepoint wrong_current_revision;
update content.summary set current_revision_id=pg_temp.xid(201) where summary_id=pg_temp.xid(100);
select is((select outcome from pg_temp.inspect('Canary container metadata 100.')),'unavailable','foreign containing-revision pointer is uncertainty, not another relationship audit target');
select ok((select outcome='unavailable' and audit_event_id is null from pg_temp.record_exclusion('Canary container metadata 100.')),'mismatched pointer creates no false violation event');
rollback to savepoint wrong_current_revision;
select is((select outcome from pg_temp.inspect('Canary container metadata 100.')),'blocked','restored actual containing revision is covered again');
savepoint null_current_revision;
update content.summary set current_revision_id=null where summary_id=pg_temp.xid(100);
select ok((select outcome='blocked' and excluded_entity_id=pg_temp.xid(101) from pg_temp.inspect('Canary container metadata 100.')),'null current pointer uses actual latest owned containing revision');
rollback to savepoint null_current_revision;
savepoint summary_identity_without_metadata;
update content.summary set metadata='{}' where summary_id=pg_temp.xid(100);
select is((select outcome from pg_temp.inspect(pg_temp.xid(100)::text)),'blocked','Summary identity exclusion does not depend on metadata leaf existence');
rollback to savepoint summary_identity_without_metadata;
savepoint metadata_key_content;
update content.trigger_observation set metadata='{"Private metadata key canary":0}' where trigger_observation_id=pg_temp.xid(110);
select is((select outcome from pg_temp.inspect('Private metadata key canary')),'blocked','actual decoded metadata key is independently content-matched');
rollback to savepoint metadata_key_content;

select is((select outcome from pg_temp.inspect('Canary private body 102.')),'blocked','publication does not authorize a private section');
select is((select outcome from pg_temp.inspect('Canary raw revision body 101.')),'blocked','publication does not authorize arbitrary raw revision body');
select is((select outcome from pg_temp.inspect('Canary AI change 101.')),'blocked','publication does not authorize AI change metadata');
insert into content.summary_section(summary_section_id,summary_revision_id,section_type,section_title,content_markdown,visibility,display_order)
  values(pg_temp.xid(104),pg_temp.xid(101),'guide_only','Synthetic duplicate private title.','Canary eligible body 103.','guide_only',3);
select is((select outcome from pg_temp.inspect('Canary eligible body 103.')),'blocked','eligible duplicate never clears a second private field match');
select is((select outcome from public.solmind_unpublish_summary_from_explorer(
  (select summary_publication_id from content.summary_publication where summary_id=pg_temp.xid(100) and publication_status='published'),
  pg_temp.xid(2),(select version from content.summary where summary_id=pg_temp.xid(100)),pg_temp.xid(121))),
  'unpublished','actual unpublish transition changes current eligibility');
select is((select outcome from pg_temp.inspect('Canary eligible title 103.')),'blocked','fresh inspection observes actual unpublication');

select ok((select outcome='clear' and audit_event_id is null from pg_temp.record_exclusion('Synthetic ordinary immediate text')),
  'clear records no exclusion event');
select is((select count(*)::integer from audit.audit_event where event_type='explorer_context_exclusion_violation'
  and target_entity_id=pg_temp.xid(51)),0,'pure inspection and clear paths are writeless');
select ok((select outcome='blocked' and audit_event_id is not null from pg_temp.record_exclusion('Canary trigger text 110.')),
  'confirmed actual match returns blocked with one exact inserted event');
select is((select count(*)::integer from audit.audit_event where event_type='explorer_context_exclusion_violation'
  and target_entity_id=pg_temp.xid(51)),1,'one evaluated confirmed refusal inserts one event');
select ok((select actor_user_account_id is null and actor_role_context='system' and target_entity_type='ai_interaction_session'
  and target_entity_id=pg_temp.xid(51) and action='deny' and reason_code='excluded_source_detected'
  and event_summary='Explorer context dispatch blocked.' and ip_address is null and user_agent is null
  and metadata=jsonb_build_object('ai_interaction_session_id',pg_temp.xid(51)::text,'excluded_entity_type','trigger_observation',
    'excluded_entity_id',pg_temp.xid(110)::text,'assembly_path','explorer_conversation_context_v1')
  from audit.audit_event where event_type='explorer_context_exclusion_violation' and target_entity_id=pg_temp.xid(51)),
  'event is exactly the fixed content-free system tuple and four-key metadata');
select ok(not exists(select 1 from audit.audit_event where event_type='explorer_context_exclusion_violation'
  and (metadata::text like '%Canary%' or event_summary like '%Canary%' or length(metadata::text)>1024)),
  'source content and digests do not enter audit metadata or summary');
select ok(not exists(select 1 from ai.ai_interaction_message where ai_interaction_session_id=pg_temp.xid(51))
  and not exists(select 1 from ai.ai_context_snapshot where ai_interaction_session_id=pg_temp.xid(51))
  and not exists(select 1 from ai.ai_model_invocation where ai_interaction_session_id=pg_temp.xid(51))
  and not exists(select 1 from ai.explorer_conversation_operation where conversation_id=pg_temp.xid(51)),
  'confirmed refusal creates no message, snapshot, invocation, send operation or dispatch evidence');
select ok((select pending_operation_id is null and revision=0 from ai.explorer_conversation_state where conversation_id=pg_temp.xid(51)),
  'refusal preserves honest empty conversation revision and pending state');
select ok((select count(*)=5 from pg_locks where pid=pg_backend_pid() and mode='ShareLock' and granted and relation in (
  'content.summary'::regclass,'content.summary_revision'::regclass,'content.summary_section'::regclass,
  'content.summary_publication'::regclass,'content.trigger_observation'::regclass)),
  'successful inspection retains all five real source-table SHARE locks until transaction end');

savepoint audit_failure;
create function pg_temp.fail_source_audit() returns trigger language plpgsql as $$ begin
  if new.event_type='explorer_context_exclusion_violation' then raise exception 'synthetic_source_audit_failure'; end if;
  return new;
end $$;
create trigger source_audit_failure_fixture before insert on audit.audit_event for each row execute function pg_temp.fail_source_audit();
select throws_ok($$select * from pg_temp.record_exclusion('Canary trigger text 110.')$$,'P0001','solmind_explorer_source_unavailable',
  'induced audit failure propagates as fixed failure instead of successful refusal');
select is((select count(*)::integer from audit.audit_event where event_type='explorer_context_exclusion_violation'
  and target_entity_id=pg_temp.xid(51)),1,'failed audit attempt adds no row');
rollback to savepoint audit_failure;

savepoint capability_private_note;
create table content.private_note(fixture_id uuid);
select is((select outcome from pg_temp.inspect()),'unavailable','new unsupported private-note owner refuses instead of an empty index');
select ok((select outcome='unavailable' and audit_event_id is null from pg_temp.record_exclusion('Canary trigger text 110.')),
  'capability uncertainty wins over earlier known match and creates no false incident');
rollback to savepoint capability_private_note;
savepoint capability_private_evidence;
alter table ai.explorer_safety_evidence rename column explorer_safety_evidence_id to incompatible_fixture_id;
select is((select outcome from pg_temp.inspect()),'unavailable','incompatible private-evidence owner cannot be certified clear');
rollback to savepoint capability_private_evidence;
savepoint capability_field_change;
alter table content.summary_section add column unreviewed_fixture_field text;
select is((select outcome from pg_temp.inspect()),'unavailable','changed covered source field inventory invalidates capability');
rollback to savepoint capability_field_change;
savepoint capability_privilege;
grant select on ai.explorer_safety_evidence to authenticated;
select is((select outcome from pg_temp.inspect()),'unavailable','private-evidence API grant invalidates structural exclusion capability');
rollback to savepoint capability_privilege;

savepoint source_single_bound;
insert into content.trigger_observation(trigger_observation_id,guide_explorer_relationship_id,trigger_label,observation_text,created_by_actor_type)
  values(pg_temp.xid(300),pg_temp.xid(25),'Synthetic large source.',repeat('x',262145),'guide');
select is((select outcome from pg_temp.inspect()),'unavailable','individual source text bound refuses complete inspection');
select is((select outcome from pg_temp.inspect('Canary trigger text 110.')),'unavailable','an earlier confirmed candidate cannot bypass a later source overflow');
rollback to savepoint source_single_bound;
savepoint source_total_bound;
insert into content.trigger_observation(trigger_observation_id,guide_explorer_relationship_id,trigger_label,observation_text,created_by_actor_type)
  select pg_temp.xid(300+n),pg_temp.xid(25),'Synthetic aggregate bound '||n,repeat('x',262144),'guide' from generate_series(1,17) n;
select is((select outcome from pg_temp.inspect()),'unavailable','combined inspected text above four MiB refuses');
rollback to savepoint source_total_bound;
savepoint source_cell_bound;
insert into content.trigger_observation(trigger_observation_id,guide_explorer_relationship_id,trigger_label,observation_text,created_by_actor_type)
  select pg_temp.xid(1000+n),pg_temp.xid(25),'Synthetic cell label '||n,'Synthetic cell body '||n,'guide' from generate_series(1,1400) n;
select is((select outcome from pg_temp.inspect()),'unavailable','inspected cells and identities above 4096 refuse');
rollback to savepoint source_cell_bound;

insert into ai.ai_interaction_message(ai_interaction_message_id,ai_interaction_session_id,sequence_number,sender_type,
  sender_user_account_id,sender_role_context,content_text)
  values(pg_temp.xid(70),pg_temp.xid(51),1,'user',pg_temp.xid(1),'explorer',E'  Synthetic saved history\r\nline  ');
select is((select outcome from pg_temp.inspect()),'clear','actual owned recent history joins the exact context and source identity set');
select is((select outcome from pg_temp.inspect_json(jsonb_set(pg_temp.context(),'{currentSessionMessages,0,content}','"invented history"'))),
  'unavailable','caller cannot substitute saved history content');
select is((select outcome from pg_temp.inspect_json(jsonb_set(pg_temp.context(),'{currentSessionMessages}','[]'))),
  'unavailable','caller cannot omit actual selected history');
update ai.ai_interaction_session set metadata='{"restricted_mode":true}' where ai_interaction_session_id=pg_temp.xid(51);
select is((select outcome from pg_temp.inspect()),'clear','internal source inspection does not wrongly reuse old restricted-reflection authority');
savepoint source_identity_cross_kind_collision;
insert into ai.ai_interaction_message(ai_interaction_message_id,ai_interaction_session_id,sequence_number,sender_type,
  sender_user_account_id,sender_role_context,content_text)
  values(pg_temp.xid(52),pg_temp.xid(51),2,'user',pg_temp.xid(1),'explorer','Synthetic history whose UUID collides across source kinds.');
select is((select cardinality(pg_temp.source_ids())),4,'deduplicated transport identities alone would hide the actual intake/history collision');
select is((select outcome from pg_temp.inspect()),'unavailable','independent SQL source check rejects cross-kind identity reuse before deduplication');
rollback to savepoint source_identity_cross_kind_collision;
update identity.user_session set expires_at=now()-interval '1 second' where user_session_id=pg_temp.xid(50);
select is((select outcome from pg_temp.inspect()),'unavailable','expired application session cannot anchor a new source operation');
update identity.user_session set expires_at=now()+interval '1 hour' where user_session_id=pg_temp.xid(50);
update identity.user_role_assignment set role_status='revoked',revoked_at=now() where user_role_assignment_id=pg_temp.xid(11);
select is((select outcome from pg_temp.inspect()),'unavailable','revoked actual Explorer role refuses');

-- Additional Root-owned proofs: actual separate-session NOWAIT contention,
-- owner insert/identity/trigger writes and DDL; commit survival of denial audit;
-- unknown acknowledgement/no retry; complete v3 prepare/rollback/replay; exact
-- private-evidence IDs under the common actor lock; scheduled integrity/paging.
-- Bounded traversal counts containers and scalar nodes before returning leaves.
create function pg_temp.nested_source(n integer) returns json language plpgsql immutable as $$
declare value jsonb:='"Synthetic depth canary"'; i integer;
begin for i in 1..n loop value:=jsonb_build_array(value); end loop; return value::json; end $$;
select lives_ok($$select * from ai.solmind_exclusion_strings_v3(pg_temp.nested_source(16),true)$$,'depth16 metadata root is bounded and supported');
select throws_ok($$select * from ai.solmind_exclusion_strings_v3(pg_temp.nested_source(17),true)$$,'P0001','solmind_explorer_source_unavailable','depth17 is unavailable even with one leaf');
select throws_ok($$select * from ai.solmind_exclusion_strings_v3((select json_agg(n) from generate_series(1,4096) n),true)$$,'P0001','solmind_explorer_source_unavailable','numeric width counts root plus all scalar nodes');
select throws_ok($$select * from ai.solmind_exclusion_strings_v3((select json_agg('{}'::json) from generate_series(1,4096)),true)$$,'P0001','solmind_explorer_source_unavailable','empty container width cannot evade source budget');
select throws_ok($$select * from ai.solmind_exclusion_strings_v3(json_build_object(repeat('k',262145),0),true)$$,'P0001','solmind_explorer_source_unavailable','oversized metadata key is bounded before expansion');
select throws_ok($$select * from ai.solmind_exclusion_strings_v3(json_build_array(repeat('v',262145)),true)$$,'P0001','solmind_explorer_source_unavailable','oversized root is unavailable before any leaf');
savepoint early_match_late_numeric_overflow;
update identity.user_role_assignment set role_status='active',revoked_at=null where user_role_assignment_id=pg_temp.xid(11);
update content.summary set metadata=jsonb_build_object('wide',(select jsonb_agg(n) from generate_series(1,4096) n)) where summary_id=pg_temp.xid(100);
select ok((select outcome='unavailable' and audit_event_id is null from pg_temp.record_exclusion('Canary trigger text 110.')),'earlier real match cannot hide later all-numeric metadata overflow or create false audit');
rollback to savepoint early_match_late_numeric_overflow;
-- pgTAP's final counter row was inside the rolled-back savepoint. A meaningful
-- post-rollback assertion both proves fixture restoration and refreshes it.
select ok((select role_status='revoked' from identity.user_role_assignment where user_role_assignment_id=pg_temp.xid(11))
  and (select metadata=jsonb_build_object('nested',jsonb_build_object('canary','Canary container metadata 100.'))
    from content.summary where summary_id=pg_temp.xid(100)),
  'late-overflow rollback restores original revoked role and bounded source metadata');

select * from finish();
rollback;

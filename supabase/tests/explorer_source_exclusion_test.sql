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

-- Independent rebuild of the saved Compass and Waypoint section (chat step slice S3, 2026-11-03) from the
-- fixture rows: current points in display order, the saved Priority and attention, the last five needle moves
-- on a current point (oldest first, each with the point's current label), the current Waypoint heads, no drafts.
-- S4 adds the actor and whether the latest Explorer move still awaits its first saved reply.
create function pg_temp.compass() returns jsonb language sql stable as $$
  select jsonb_build_object('version','explorer-compass-context.v3',
    'points',coalesce((select jsonb_agg(jsonb_build_object('id',c.item_id,'label',ai.solmind_exclusion_normalize_v3(c.label),
      'order',c.ord-1,'formation',case when c.formation_status='proposed' then 'forming' else 'saved' end,'anchor',c.compass_anchor,'emphasis',c.relative_emphasis)
      ||case when c.formation_status='proposed' then jsonb_build_object('suggestedInPreviousReply',coalesce(
        c.wording_message_id=(select previous.ai_interaction_message_id from ai.ai_interaction_message previous
          where previous.ai_interaction_session_id=c.conversation_id and previous.sender_type='ai'
            and previous.ai_role='solmind_virtual_guide' order by previous.sequence_number desc limit 1),false))
        else '{}'::jsonb end order by c.ord)
      from (select x.*,row_number() over(order by x.display_order) as ord from ai.explorer_conversation_compass_item x
        where x.conversation_id=pg_temp.xid(51) and x.merged_into_item_id is null and x.formation_status is distinct from 'rejected') c),'[]'::jsonb),
    'priorityId',(select s.priority_id from ai.explorer_conversation_state s where s.conversation_id=pg_temp.xid(51)),
    'attentionId',(select s.attention_id from ai.explorer_conversation_state s where s.conversation_id=pg_temp.xid(51)),
    'recentRoute',coalesce((select jsonb_agg(jsonb_build_object('kind',r.compass_route_kind,'pointId',r.compass_route_item_id,
      'label',ai.solmind_exclusion_normalize_v3(r.current_label),
      'actor',case when r.kind='follow_attention' then 'virtual_guide' else 'explorer' end,
      'awaitingReply',r.kind='set_attention'
        and r.operation_id=(select latest.operation_id from ai.explorer_conversation_operation latest
          where latest.conversation_id=pg_temp.xid(51) and latest.compass_route_kind='attention_changed'
          order by latest.initial_revision desc,latest.operation_id desc limit 1)
        and not exists(select 1 from ai.ai_interaction_message reply where reply.ai_interaction_session_id=pg_temp.xid(51)
          and reply.sender_type='ai' and reply.created_at>=r.completed_at)) order by r.initial_revision,r.operation_id)
      from (select o.*,c.label as current_label from ai.explorer_conversation_operation o join ai.explorer_conversation_compass_item c
          on c.conversation_id=o.conversation_id and c.item_id=o.compass_route_item_id and c.merged_into_item_id is null and c.formation_status is distinct from 'rejected'
        where o.conversation_id=pg_temp.xid(51) and o.compass_route_kind='attention_changed'
        order by o.initial_revision desc,o.operation_id desc limit 5) r),'[]'::jsonb),
    'waypoints',coalesce((select jsonb_agg(jsonb_build_object('id',w.waypoint_id,'title',ai.solmind_exclusion_normalize_v3(w.title),
      'destination',ai.solmind_exclusion_normalize_v3(w.destination),'meaning',ai.solmind_exclusion_normalize_v3(w.why_it_matters),
      'arrivalSignal',ai.solmind_exclusion_normalize_v3(w.arrival_signal),
      'stage',case when w.lifecycle_status='reached' then 'reached' when w.released_at is not null then 'released' else 'formed' end,
      'reachedEvidence',case when w.lifecycle_status='reached' then ai.solmind_exclusion_normalize_v3(w.reached_evidence) end)
      order by w.created_at,w.waypoint_id)
      from content.waypoint w where w.source_ai_interaction_session_id=pg_temp.xid(51)
        and not exists(select 1 from content.waypoint s where s.predecessor_waypoint_id=w.waypoint_id)),'[]'::jsonb),
    'drafts','[]'::jsonb)
$$;
create function pg_temp.context(body text default 'Synthetic ordinary immediate text',classification_only boolean default false)
returns jsonb language sql stable as $$
  select jsonb_build_object('contractVersion',case when classification_only then 'wi007-v0.1+onboarding-fields-v2'
    else 'wi007-v0.1+onboarding-fields-v2+compass-v3' end,'aiRole','solmind_virtual_guide','actorRoleContext','explorer',
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
    || case when classification_only then '{}'::jsonb else jsonb_build_object('compassContext',pg_temp.compass()) end
$$;
create function pg_temp.source_ids(classification_only boolean default false) returns uuid[] language sql stable as $$
  select array_agg(distinct id order by id) from (
    select unnest(array[pg_temp.xid(52),pg_temp.xid(61),pg_temp.xid(90)]) as id
    union all select m.ai_interaction_message_id from (select * from ai.ai_interaction_message
      where ai_interaction_session_id=pg_temp.xid(51) order by sequence_number desc limit 24) m
    union all select c.item_id from ai.explorer_conversation_compass_item c
      where not classification_only and c.conversation_id=pg_temp.xid(51) and c.merged_into_item_id is null and c.formation_status is distinct from 'rejected'
    union all select w.waypoint_id from content.waypoint w where not classification_only and w.source_ai_interaction_session_id=pg_temp.xid(51)
      and not exists(select 1 from content.waypoint s where s.predecessor_waypoint_id=w.waypoint_id)) x
$$;
create function pg_temp.inspect(body text default 'Synthetic ordinary immediate text')
returns table(outcome text,excluded_entity_type text,excluded_entity_id uuid) language sql volatile as $$
  select * from ai.solmind_inspect_explorer_context_v3(pg_temp.xid(1),pg_temp.xid(50),pg_temp.xid(24),pg_temp.xid(25),
    pg_temp.xid(51),pg_temp.compact(pg_temp.context(body)),pg_temp.source_ids())
$$;
create function pg_temp.inspect_json(value jsonb,classification_only boolean default false,extra_ids uuid[] default array[]::uuid[])
returns table(outcome text,excluded_entity_type text,excluded_entity_id uuid) language sql volatile as $$
  select * from ai.solmind_inspect_explorer_context_v3(pg_temp.xid(1),pg_temp.xid(50),pg_temp.xid(24),pg_temp.xid(25),
    pg_temp.xid(51),pg_temp.compact(value),
    (select array_agg(id order by id) from unnest(pg_temp.source_ids(classification_only)||extra_ids) id))
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
-- A legacy unknown policy supplies no authority for either request envelope.
savepoint unknown_policy;
insert into ai.explorer_conversation_state(conversation_id,actor_user_account_id) values(pg_temp.xid(51),pg_temp.xid(1));
select is((select outcome from pg_temp.inspect()),'unavailable','unknown policy rejects the ordinary Compass envelope');
select is((select outcome from pg_temp.inspect_json(pg_temp.context(classification_only=>true),true)),
  'unavailable','unknown policy also rejects the reduced classification-only envelope');
rollback to savepoint unknown_policy;
insert into ai.explorer_conversation_state(conversation_id,actor_user_account_id,safety_contract_version,
  adult_reflection_stopped,safety_version)
  values(pg_temp.xid(51),pg_temp.xid(1),'explorer-conversation-safety.v1',false,0);
select is((select outcome from pg_temp.inspect()),'clear','real owned empty conversation and exact submitted sources inspect clear');
select ok((select excluded_entity_type is null and excluded_entity_id is null from pg_temp.inspect()),'clear carries no private references');
select is((select outcome from pg_temp.inspect_json(pg_temp.context()||'{"unknown":true}'::jsonb)),'unavailable','extra input envelope field is unavailable');
select is((select outcome from pg_temp.inspect_json((pg_temp.context()-'compassContext')||'{"contractVersion":"wi007-v0.1+onboarding-fields-v2"}'::jsonb)),
  'unavailable','ordinary mode rejects the reduced twelve-key classification-only envelope');
select is((select outcome from pg_temp.inspect_json(pg_temp.context()-'compassContext')),
  'unavailable','S3: the new contract version requires the Compass and Waypoint section');
select is((select outcome from pg_temp.inspect_json(pg_temp.context()||'{"contractVersion":"wi007-v0.1+onboarding-fields-v2"}'::jsonb)),
  'unavailable','S3: the section under the previous contract version is refused');
select is((select outcome from pg_temp.inspect_json(jsonb_set(pg_temp.context(),'{compassContext,drafts}','[{"label":"Synthetic draft"}]'))),
  'unavailable','S3: the reserved drafts slot must stay empty');
select is((select outcome from pg_temp.inspect_json(jsonb_set(pg_temp.context(),'{compassContext,version}','"explorer-compass-context.v2"'))),
  'unavailable','S3: the section version is exact');
select is((select outcome from pg_temp.inspect_json(pg_temp.context()||jsonb_build_object('compassContext',pg_temp.compass()||'{"extra":[]}'::jsonb))),
  'unavailable','S3: an extra section key is unavailable');
select is((select outcome from ai.solmind_inspect_explorer_context_v3(pg_temp.xid(1),pg_temp.xid(50),pg_temp.xid(24),pg_temp.xid(25),
  pg_temp.xid(51),pg_temp.compact(pg_temp.context()),(select array_agg(pg_temp.xid(n) order by pg_temp.xid(n)) from generate_series(2000,2103) n))),
  'unavailable','S3: a list of 104 arbitrary source ids is unavailable (the bound itself is pinned by the catalog check below)');
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
savepoint policy_incoherent;
update ai.ai_interaction_session set metadata='{"restricted_mode":true}' where ai_interaction_session_id=pg_temp.xid(51);
select is((select outcome from pg_temp.inspect()),'unavailable','incoherent restriction metadata cannot authorize the ordinary mode');
select is((select outcome from pg_temp.inspect_json(pg_temp.context(classification_only=>true),true)),
  'unavailable','incoherent restriction metadata cannot authorize classification-only mode either');
rollback to savepoint policy_incoherent;
select is((select outcome from pg_temp.inspect()),'clear','restored known policy keeps owned history inspection available');
savepoint source_identity_cross_kind_collision;
insert into ai.ai_interaction_message(ai_interaction_message_id,ai_interaction_session_id,sequence_number,sender_type,
  sender_user_account_id,sender_role_context,content_text)
  values(pg_temp.xid(52),pg_temp.xid(51),2,'user',pg_temp.xid(1),'explorer','Synthetic history whose UUID collides across source kinds.');
select is((select cardinality(pg_temp.source_ids())),4,'deduplicated transport identities alone would hide the actual intake/history collision');
select is((select outcome from pg_temp.inspect()),'unavailable','independent SQL source check rejects cross-kind identity reuse before deduplication');
rollback to savepoint source_identity_cross_kind_collision;

-- Chat step slice S3 (2026-11-03): the saved Compass and Waypoint section is rebuilt exactly from the rows.
-- The same synthetic rows are the state in src/lib/solmind/virtual-guide/explorerConversationContext.test.ts
-- ("S3 golden vector"); the TypeScript serialization of the section is the literal below (compared here as jsonb).
-- S4 extends that same vector with actor and awaitingReply; the fixture has no saved AI reply.
savepoint compass_context;
insert into ai.explorer_conversation_compass_item(item_id,conversation_id,source_message_id,label,display_order,compass_anchor,relative_emphasis)
  values(pg_temp.xid(401),pg_temp.xid(51),pg_temp.xid(70),'  Money worries ',1,'apex',3),
    (pg_temp.xid(402),pg_temp.xid(51),pg_temp.xid(70),'Sleep',2,null,null),
    (pg_temp.xid(403),pg_temp.xid(51),pg_temp.xid(70),'Work stress',3,'upper_left',2),
    (pg_temp.xid(404),pg_temp.xid(51),pg_temp.xid(70),'Family',4,null,1);
update ai.explorer_conversation_compass_item set merged_into_item_id=pg_temp.xid(401) where item_id=pg_temp.xid(403);
update ai.explorer_conversation_state set priority_id=pg_temp.xid(401),attention_id=pg_temp.xid(402) where conversation_id=pg_temp.xid(51);
insert into ai.explorer_conversation_operation(actor_user_account_id,operation_id,application_session_id,conversation_id,kind,
  request_fingerprint,command_fingerprint,initial_revision,status,completed_at,compass_route_kind,compass_route_item_id,compass_route_label)
  select pg_temp.xid(1),pg_temp.xid(410+r.n),pg_temp.xid(50),pg_temp.xid(51),r.kind,repeat('A',64),repeat('B',64),r.n,'completed',
    timestamptz '2026-11-03 09:00:00+00'+r.n*interval '1 minute',r.route_kind,pg_temp.xid(r.item),r.label
  -- Round 2 (2026-11-03): needle moves only, with each point's current label. The needle move on the combined-away
  -- point 403 (revision 5) is among the newest five needle moves; leaving it out lets the oldest one (revision 1) in.
  from (values(1,'set_attention','attention_changed',404,'Family'),
    (2,'confirm_priority','priority_confirmed',404,'Family'),
    (3,'set_attention','attention_changed',401,'  Money worries '),
    (4,'set_attention','attention_changed',402,'Sleep'),
    (5,'set_attention','attention_changed',403,'Work stress'),
    (6,'confirm_priority','priority_reoriented',401,'  Money worries '),
    (7,'set_attention','attention_changed',404,'Family'),
    (8,'set_attention','attention_changed',402,'Sleep')) r(n,kind,route_kind,item,label);
insert into ai.explorer_conversation_operation(actor_user_account_id,operation_id,application_session_id,conversation_id,kind,
  request_fingerprint,command_fingerprint,initial_revision,status,completed_at)
  values(pg_temp.xid(1),pg_temp.xid(431),pg_temp.xid(50),pg_temp.xid(51),'release_waypoint',repeat('A',64),repeat('B',64),9,'completed',
    timestamptz '2026-11-03 12:00:00+00');
insert into content.waypoint(waypoint_id,guide_explorer_relationship_id,source_ai_interaction_session_id,source_message_id,title,
  destination,why_it_matters,arrival_signal,lifecycle_status,chosen_by_explorer_user_account_id,chosen_at,
  reached_by_explorer_user_account_id,reached_at,reached_evidence,released_at,released_by_user_account_id,released_operation_id,
  predecessor_waypoint_id,creation_reason,created_at)
  values(pg_temp.xid(421),pg_temp.xid(25),pg_temp.xid(51),pg_temp.xid(70),'Find a calmer morning','Find a calmer morning',
      E'Mornings set\r\nmy whole day','I start two mornings a week without rushing','chosen',pg_temp.xid(1),timestamptz '2026-11-03 10:00:00+00',
      null,null,null,null,null,null,null,null,timestamptz '2026-11-03 10:00:00+00'),
    (pg_temp.xid(422),pg_temp.xid(25),pg_temp.xid(51),pg_temp.xid(70),'Walk after dinner','Walk after dinner',
      'It clears my head','I walk three evenings in one week','reached',pg_temp.xid(1),timestamptz '2026-11-03 10:01:00+00',
      pg_temp.xid(1),timestamptz '2026-11-03 11:00:00+00','  I walked four evenings last week ',null,null,null,null,null,
      timestamptz '2026-11-03 10:01:00+00'),
    (pg_temp.xid(423),pg_temp.xid(25),pg_temp.xid(51),pg_temp.xid(70),'Call my sister','Call my sister',
      'We have drifted apart','We talk once a week for a month','chosen',pg_temp.xid(1),timestamptz '2026-11-03 10:02:00+00',
      null,null,null,timestamptz '2026-11-03 12:00:00+00',pg_temp.xid(1),pg_temp.xid(431),null,null,timestamptz '2026-11-03 10:02:00+00'),
    (pg_temp.xid(424),pg_temp.xid(25),pg_temp.xid(51),pg_temp.xid(70),'Read before bed','Read before bed',
      'Screens keep me awake','I read on five nights','chosen',pg_temp.xid(1),timestamptz '2026-11-03 10:03:00+00',
      null,null,null,null,null,null,null,null,timestamptz '2026-11-03 10:03:00+00'),
    (pg_temp.xid(425),pg_temp.xid(25),pg_temp.xid(51),pg_temp.xid(70),'Read before bed','Read before bed',
      'Screens keep me awake','I read on three nights','chosen',pg_temp.xid(1),timestamptz '2026-11-03 10:04:00+00',
      null,null,null,null,null,null,pg_temp.xid(424),'revision',timestamptz '2026-11-03 10:04:00+00');
create temp table s3_golden(section jsonb) on commit drop;
insert into s3_golden values('{"version":"explorer-compass-context.v3","points":[{"id":"f5120000-0000-4000-8000-000000000401","label":"Money worries","order":0,"formation":"saved","anchor":"apex","emphasis":3},{"id":"f5120000-0000-4000-8000-000000000402","label":"Sleep","order":1,"formation":"saved","anchor":null,"emphasis":null},{"id":"f5120000-0000-4000-8000-000000000404","label":"Family","order":2,"formation":"saved","anchor":null,"emphasis":1}],"priorityId":"f5120000-0000-4000-8000-000000000401","attentionId":"f5120000-0000-4000-8000-000000000402","recentRoute":[{"kind":"attention_changed","pointId":"f5120000-0000-4000-8000-000000000404","label":"Family","actor":"explorer","awaitingReply":false},{"kind":"attention_changed","pointId":"f5120000-0000-4000-8000-000000000401","label":"Money worries","actor":"explorer","awaitingReply":false},{"kind":"attention_changed","pointId":"f5120000-0000-4000-8000-000000000402","label":"Sleep","actor":"explorer","awaitingReply":false},{"kind":"attention_changed","pointId":"f5120000-0000-4000-8000-000000000404","label":"Family","actor":"explorer","awaitingReply":false},{"kind":"attention_changed","pointId":"f5120000-0000-4000-8000-000000000402","label":"Sleep","actor":"explorer","awaitingReply":true}],"waypoints":[{"id":"f5120000-0000-4000-8000-000000000421","title":"Find a calmer morning","destination":"Find a calmer morning","meaning":"Mornings set\nmy whole day","arrivalSignal":"I start two mornings a week without rushing","stage":"formed","reachedEvidence":null},{"id":"f5120000-0000-4000-8000-000000000422","title":"Walk after dinner","destination":"Walk after dinner","meaning":"It clears my head","arrivalSignal":"I walk three evenings in one week","stage":"reached","reachedEvidence":"I walked four evenings last week"},{"id":"f5120000-0000-4000-8000-000000000423","title":"Call my sister","destination":"Call my sister","meaning":"We have drifted apart","arrivalSignal":"We talk once a week for a month","stage":"released","reachedEvidence":null},{"id":"f5120000-0000-4000-8000-000000000425","title":"Read before bed","destination":"Read before bed","meaning":"Screens keep me awake","arrivalSignal":"I read on three nights","stage":"formed","reachedEvidence":null}],"drafts":[]}');
create function pg_temp.with_compass(section jsonb) returns jsonb language sql stable as $$
  select jsonb_set(pg_temp.context(),'{compassContext}',section)
$$;
select is(pg_temp.compass(),(select section from s3_golden),
  'S3: the independent SQL rebuild equals the content of the TypeScript serialization of the same saved rows (as jsonb)');
select is((select outcome from pg_temp.inspect()),'clear','S3: saved points, Priority, unplaced needle, recent needle moves and Waypoint heads inspect clear');
select is((select outcome from pg_temp.inspect_json(pg_temp.with_compass((select section from s3_golden)))),'clear',
  'S3: the TypeScript section content, set into the context as jsonb, inspects clear');
select is((select cardinality(pg_temp.source_ids())),11,'S3: the three points and four Waypoint heads join the source ids');
-- Classification scope is decided from the protected policy, never an input mode.
-- Every probe starts with the same populated saved points and Waypoints, then
-- rolls back only its policy change; the ordinary golden section remains intact.
create function pg_temp.classification_scope_probe(lvl smallint,adult_stop boolean) returns text language plpgsql as $$
declare reduced jsonb; full_context jsonb; stray uuid;
begin
  begin
    full_context:=pg_temp.context();
    reduced:=pg_temp.context(classification_only=>true);
    if reduced is distinct from ((full_context-'compassContext')
      || jsonb_build_object('contractVersion','wi007-v0.1+onboarding-fields-v2'))
      or cardinality(pg_temp.source_ids(true))<>4
      or jsonb_array_length(full_context->'compassContext'->'points')<>3
      or jsonb_array_length(full_context->'compassContext'->'waypoints')<>4
      then raise exception 'classification_fixture_shape'; end if;
    perform ai.solmind_raise_private_policy_v3(pg_temp.xid(51),lvl,adult_stop);
    if (select outcome from pg_temp.inspect_json(reduced,true)) is distinct from 'clear'
      then raise exception 'classification_reduced_refused'; end if;
    if (select outcome from pg_temp.inspect_json(full_context)) is distinct from 'unavailable'
      or (select outcome from pg_temp.inspect_json(reduced||jsonb_build_object(
        'contractVersion','wi007-v0.1+onboarding-fields-v2+compass-v3'),true)) is distinct from 'unavailable'
      or (select outcome from pg_temp.inspect_json(full_context||jsonb_build_object(
        'contractVersion','wi007-v0.1+onboarding-fields-v2'))) is distinct from 'unavailable'
      or (select outcome from pg_temp.inspect_json(reduced||'{"compassContext":null}'::jsonb,true)) is distinct from 'unavailable'
      then raise exception 'classification_wrong_envelope_accepted'; end if;
    foreach stray in array array[pg_temp.xid(401),pg_temp.xid(402),pg_temp.xid(404),
      pg_temp.xid(421),pg_temp.xid(422),pg_temp.xid(423),pg_temp.xid(425)] loop
      if (select outcome from pg_temp.inspect_json(reduced,true,array[stray])) is distinct from 'unavailable'
        then raise exception 'classification_stray_source_accepted'; end if;
    end loop;
    raise exception 'classification_scope_probe_rolled_back';
  exception when raise_exception then
    if sqlerrm<>'classification_scope_probe_rolled_back' then raise; end if;
  end;
  return 'ok';
end $$;
select is(pg_temp.classification_scope_probe(3::smallint,false),'ok',
  'level 3 omits populated Compass/Waypoints and rejects full, wrong-version, null-section and stray-id contexts');
select is(pg_temp.classification_scope_probe(4::smallint,false),'ok',
  'level 4 requires the exact reduced envelope and rejects every saved point and Waypoint id');
select is(pg_temp.classification_scope_probe(0::smallint,true),'ok',
  'adult stop alone requires the exact reduced envelope and rejects full or malformed mode pairings');
select is(pg_temp.compass(),(select section from s3_golden),'classification probes preserve the ordinary golden Compass section');
select is((select outcome from pg_temp.inspect()),'clear','ordinary populated envelope still inspects clear after policy rollback');

select is((select outcome from ai.solmind_inspect_explorer_context_v3(pg_temp.xid(1),pg_temp.xid(50),pg_temp.xid(24),pg_temp.xid(25),
  pg_temp.xid(51),pg_temp.compact(pg_temp.context()),array_remove(pg_temp.source_ids(),pg_temp.xid(425)))),'unavailable',
  'S3: a Waypoint head missing from the source ids is unavailable');
select is((select outcome from ai.solmind_inspect_explorer_context_v3(pg_temp.xid(1),pg_temp.xid(50),pg_temp.xid(24),pg_temp.xid(25),
  pg_temp.xid(51),pg_temp.compact(pg_temp.context()),array_remove(pg_temp.source_ids(),pg_temp.xid(404)))),'unavailable',
  'S3: a point missing from the source ids is unavailable');
select is((select outcome from ai.solmind_inspect_explorer_context_v3(pg_temp.xid(1),pg_temp.xid(50),pg_temp.xid(24),pg_temp.xid(25),
  pg_temp.xid(51),pg_temp.compact(pg_temp.context()),(select array_agg(x order by x) from unnest(pg_temp.source_ids()||pg_temp.xid(403)) x))),
  'unavailable','S3: a combined-away point cannot join the source ids');
select is((select outcome from pg_temp.inspect_json(jsonb_set(pg_temp.context(),'{compassContext,points,0,label}','"Money"'))),
  'unavailable','S3: a tampered point label is unavailable');
select is((select outcome from pg_temp.inspect_json(jsonb_set(pg_temp.context(),'{compassContext,points,0,label}','"  Money worries "'))),
  'unavailable','S3: an unnormalized point label is unavailable');
select is((select outcome from pg_temp.inspect_json(jsonb_insert(pg_temp.context(),'{compassContext,points,3}',jsonb_build_object('id',pg_temp.xid(403),
  'label','Work stress','order',3,'formation','saved','anchor','upper_left','emphasis',2)))),'unavailable','S3: an extra (combined-away) point is unavailable');
select is((select outcome from pg_temp.inspect_json(jsonb_set(pg_temp.context(),'{compassContext,points}',
  (select jsonb_agg(p order by ord desc) from jsonb_array_elements(pg_temp.compass()->'points') with ordinality x(p,ord))))),
  'unavailable','S3: points in the wrong order are unavailable');
select is((select outcome from pg_temp.inspect_json(jsonb_set(pg_temp.context(),'{compassContext,points,1,order}','2'))),
  'unavailable','S3: a wrong order number is unavailable');
select is((select outcome from pg_temp.inspect_json(jsonb_set(pg_temp.context(),'{compassContext,points,0,formation}','"forming"'))),
  'unavailable','S5: an Explorer-saved row cannot be relabeled forming in model context');
select is((select outcome from pg_temp.inspect_json(jsonb_set(pg_temp.context(),'{compassContext,points,1,anchor}','"lower_center"'))),
  'unavailable','S3: an invented position is unavailable');
select is((select outcome from pg_temp.inspect_json(jsonb_set(pg_temp.context(),'{compassContext,priorityId}','null'))),
  'unavailable','S3: the saved Priority cannot be omitted');
select is((select outcome from pg_temp.inspect_json(jsonb_set(pg_temp.context(),'{compassContext,attentionId}',to_jsonb(pg_temp.xid(401))))),
  'unavailable','S3: the needle is the saved attention, here on an unplaced point');
select is((select outcome from pg_temp.inspect_json(jsonb_set(pg_temp.context(),'{compassContext,recentRoute}','[]'))),
  'unavailable','S3: the recent Route cannot be omitted');
-- Round 2b (2026-11-03, REV225b-01): the fixture holds exactly five needle moves on current points, so a real
-- needle move older than revision 1 (revision 0, on the current point 402) is added for the cap: the rebuild leaves
-- it out, and the context that gives it as a sixth needle move is unavailable.
savepoint compass_cap;
insert into ai.explorer_conversation_operation(actor_user_account_id,operation_id,application_session_id,conversation_id,kind,
  request_fingerprint,command_fingerprint,initial_revision,status,completed_at,compass_route_kind,compass_route_item_id,compass_route_label)
  values(pg_temp.xid(1),pg_temp.xid(410),pg_temp.xid(50),pg_temp.xid(51),'set_attention',repeat('A',64),repeat('B',64),0,'completed',
    timestamptz '2026-11-03 09:00:00+00','attention_changed',pg_temp.xid(402),'Sleep');
select is(pg_temp.compass(),(select section from s3_golden),
  'S3: a sixth, older needle move on a current point is capped away (the rebuild still equals the golden section)');
select is((select outcome from pg_temp.inspect_json(jsonb_insert(pg_temp.context(),'{compassContext,recentRoute,0}',jsonb_build_object(
  'kind','attention_changed','pointId',pg_temp.xid(402),'label','Sleep','actor','explorer','awaitingReply',false)))),
  'unavailable','S3: only the last five needle moves are given');
rollback to savepoint compass_cap;
-- Round 2 (2026-11-03): the combined-away filter comes before the cap of five, and Priority changes are not given.
create function pg_temp.needle(n integer,label text,awaiting_reply boolean default false) returns jsonb language sql immutable as $$
  select jsonb_build_object('kind','attention_changed','pointId',pg_temp.xid(n),'label',label,
    'actor','explorer','awaitingReply',awaiting_reply)
$$;
select ok((select bool_or(x.compass_route_item_id=pg_temp.xid(403)) from (select o.compass_route_item_id from ai.explorer_conversation_operation o
    where o.conversation_id=pg_temp.xid(51) and o.compass_route_kind='attention_changed' order by o.initial_revision desc limit 5) x),
  'S3 fixture: a needle move on the combined-away point is among the newest five needle moves');
select is((select jsonb_agg(e->'pointId' order by i) from jsonb_array_elements(pg_temp.compass()->'recentRoute') with ordinality x(e,i)),
  jsonb_build_array(pg_temp.xid(404),pg_temp.xid(401),pg_temp.xid(402),pg_temp.xid(404),pg_temp.xid(402)),
  'S3: the rebuild omits the combined-away needle move and fills the five from the next older one (revision 1, on 404)');
select is((select outcome from pg_temp.inspect_json(jsonb_set(pg_temp.context(),'{compassContext,recentRoute}',jsonb_build_array(
  pg_temp.needle(401,'Money worries'),pg_temp.needle(402,'Sleep'),pg_temp.needle(403,'Work stress'),pg_temp.needle(404,'Family'),
  pg_temp.needle(402,'Sleep',true))))),'unavailable','S3: a needle move on a combined-away point is not given');
select is((select outcome from pg_temp.inspect_json(jsonb_set(pg_temp.context(),'{compassContext,recentRoute}',jsonb_build_array(
  pg_temp.needle(401,'Money worries'),pg_temp.needle(402,'Sleep'),pg_temp.needle(404,'Family'),pg_temp.needle(402,'Sleep',true))))),
  'unavailable','S3: the five are counted after the combined-away filter, so four is too few');
select is((select outcome from pg_temp.inspect_json(jsonb_set(pg_temp.context(),'{compassContext,recentRoute}',jsonb_build_array(
  pg_temp.needle(401,'Money worries'),pg_temp.needle(402,'Sleep'),
  jsonb_build_object('kind','priority_reoriented','pointId',pg_temp.xid(401),'label','Money worries','actor','explorer','awaitingReply',false),
  pg_temp.needle(404,'Family'),pg_temp.needle(402,'Sleep',true))))),'unavailable',
  'S3: Priority changes are not given (the round-1 window of all single-point events is unavailable)');
select is((select outcome from pg_temp.inspect_json(jsonb_set(pg_temp.context(),'{compassContext,recentRoute,0,kind}','"priority_confirmed"'))),
  'unavailable','S3: a needle move cannot be relabelled as a Priority change');
select is((select outcome from pg_temp.inspect_json(jsonb_insert(pg_temp.context(),'{compassContext,recentRoute,5}',jsonb_build_object(
  'kind','category_confirmed','pointId',pg_temp.xid(401),'label','Work stress','actor','explorer','awaitingReply',false)))),'unavailable',
  'S3: a category event and its before-label never enter the section');
select is((select outcome from pg_temp.inspect_json(jsonb_set(pg_temp.context(),'{compassContext,recentRoute,1,label}','"Money"'))),
  'unavailable','S3: a tampered needle-move label is unavailable');
select is((select outcome from pg_temp.inspect_json(jsonb_insert(pg_temp.context(),'{compassContext,waypoints,3}',jsonb_build_object(
  'id',pg_temp.xid(424),'title','Read before bed','destination','Read before bed','meaning','Screens keep me awake',
  'arrivalSignal','I read on five nights','stage','formed','reachedEvidence',null)))),'unavailable',
  'S3: an earlier version of a revised Waypoint is not a current head');
select is((select outcome from pg_temp.inspect_json(jsonb_set(pg_temp.context(),'{compassContext,waypoints,2,stage}','"formed"'))),
  'unavailable','S3: a released Waypoint is staged released');
select is((select outcome from pg_temp.inspect_json(jsonb_set(pg_temp.context(),'{compassContext,waypoints,1,reachedEvidence}','null'))),
  'unavailable','S3: a reached Waypoint carries its saved evidence');
select is((select outcome from pg_temp.inspect_json(jsonb_set(pg_temp.context(),'{compassContext,waypoints,0,title}','"Calmer"'))),
  'unavailable','S3: a Waypoint title unlike the saved wording is unavailable (the saved title and destination are equal here)');
select is((select outcome from pg_temp.inspect_json(jsonb_set(pg_temp.context(),'{compassContext,waypoints,0,meaning}',
  to_jsonb(E'Mornings set\r\nmy whole day'::text)))),'unavailable','S3: Waypoint text uses the same normalization as history');
-- Round 2 (2026-11-03, DB-F1 and PRIV-F2): a needle move captured with the old wording, then a real category rename
-- of that point with the statements public.solmind_confirm_explorer_compass_category_v1 runs (the snapshot built
-- from the rows, the label update, the completed confirm_compass_category operation). The same rows are the rename
-- test of explorerConversationContext.test.ts.
savepoint compass_rename;
insert into ai.explorer_conversation_operation(actor_user_account_id,operation_id,application_session_id,conversation_id,kind,
  request_fingerprint,command_fingerprint,initial_revision,status,completed_at,compass_route_kind,compass_route_item_id,compass_route_label)
  values(pg_temp.xid(1),pg_temp.xid(441),pg_temp.xid(50),pg_temp.xid(51),'set_attention',repeat('A',64),repeat('B',64),10,'completed',
    timestamptz '2026-11-03 13:00:00+00','attention_changed',pg_temp.xid(402),'Sleep');
create temp table s3_rename(snapshot jsonb) on commit drop;
insert into s3_rename select jsonb_build_object('targetItemId',c.item_id,'memberItemIds',jsonb_build_array(c.item_id),'beforeItems',
    jsonb_build_array(jsonb_build_object('compassItemId',c.item_id,'sourceMessageId',c.source_message_id,'label',c.label,
      'mergedIntoItemId',c.merged_into_item_id,'anchor',c.compass_anchor,'emphasis',c.relative_emphasis)),'label','Evening rest')
  from ai.explorer_conversation_compass_item c where c.conversation_id=pg_temp.xid(51) and c.item_id=pg_temp.xid(402);
select ok((select ai.solmind_compass_category_change_valid(snapshot) from s3_rename),
  'S3 rename: the category rename snapshot passes the shape check');
update ai.explorer_conversation_compass_item set label='Evening rest' where conversation_id=pg_temp.xid(51) and item_id=pg_temp.xid(402);
insert into ai.explorer_conversation_operation(actor_user_account_id,operation_id,application_session_id,conversation_id,kind,
  request_fingerprint,command_fingerprint,initial_revision,status,completed_at,compass_route_kind,compass_category_change)
  select pg_temp.xid(1),pg_temp.xid(442),pg_temp.xid(50),pg_temp.xid(51),'confirm_compass_category',repeat('A',64),repeat('B',64),11,
    'completed',timestamptz '2026-11-03 13:01:00+00','category_confirmed',snapshot from s3_rename;
select ok((select o.compass_route_label='Sleep' from ai.explorer_conversation_operation o where o.operation_id=pg_temp.xid(441))
  and (select o.compass_category_change->'beforeItems'->0->>'label'='Sleep' from ai.explorer_conversation_operation o
    where o.operation_id=pg_temp.xid(442)),'S3 rename: the saved rows keep the old wording as captured history');
select is(pg_temp.compass()->'recentRoute',jsonb_build_array(pg_temp.needle(401,'Money worries'),pg_temp.needle(402,'Evening rest'),
  pg_temp.needle(404,'Family'),pg_temp.needle(402,'Evening rest'),pg_temp.needle(402,'Evening rest',true)),
  'S3 rename: every needle move on the renamed point carries its current label');
select is(strpos(pg_temp.compact(pg_temp.context()),'Sleep'),0,'S3 rename: the old wording appears nowhere in the context');
select is((select outcome from pg_temp.inspect()),'clear','S3 rename: the context with only the current label inspects clear');
-- Round 2b (2026-11-03, REV225b-02): the needle moves at indices 1, 3 and 4 (revisions 4 and 8 and operation 441,
-- all on 402) captured "Sleep"; with those labels the window is the one an inspector that kept the captured labels
-- would rebuild, so this passes only under the current-label rule.
select is((select outcome from pg_temp.inspect_json(jsonb_set(jsonb_set(jsonb_set(pg_temp.context(),
  '{compassContext,recentRoute,1,label}','"Sleep"'),'{compassContext,recentRoute,3,label}','"Sleep"'),
  '{compassContext,recentRoute,4,label}','"Sleep"'))),
  'unavailable','S3 rename: the wording the needle move captured before the rename is unavailable');
-- Round 2b (2026-11-03, REV225b-07): the old wording as excluded private content of this relationship.
insert into content.trigger_observation(trigger_observation_id,guide_explorer_relationship_id,trigger_label,observation_text,created_by_actor_type)
  values(pg_temp.xid(443),pg_temp.xid(25),'Synthetic rename trigger label.','Sleep','guide');
select is((select outcome from pg_temp.inspect('Sleep')),'blocked','S3 rename: the old wording is now excluded private content');
select is((select outcome from pg_temp.inspect()),'clear',
  'S3 rename: with the old wording excluded, the context with only the current label still inspects clear');
rollback to savepoint compass_rename;
select is(pg_temp.compass(),(select section from s3_golden),'S3 rename: the rollback restores the golden section');
savepoint compass_private_label;
update ai.explorer_conversation_compass_item set label='Canary trigger text 110.' where item_id=pg_temp.xid(404);
select ok((select outcome='blocked' and excluded_entity_id=pg_temp.xid(110) from pg_temp.inspect()),
  'S3: a Compass label equal to excluded private text is blocked like any other context string');
rollback to savepoint compass_private_label;
savepoint compass_private_waypoint;
insert into content.waypoint(waypoint_id,guide_explorer_relationship_id,source_ai_interaction_session_id,source_message_id,title,
  destination,why_it_matters,arrival_signal,lifecycle_status,chosen_by_explorer_user_account_id,chosen_at,created_at)
  values(pg_temp.xid(426),pg_temp.xid(25),pg_temp.xid(51),pg_temp.xid(70),'Synthetic destination','Synthetic destination',
    'Canary trigger label 110.','Synthetic arrival','chosen',pg_temp.xid(1),now(),timestamptz '2026-11-03 10:05:00+00');
select ok((select outcome='blocked' and excluded_entity_id=pg_temp.xid(110) from pg_temp.inspect()),
  'S3: Waypoint wording equal to excluded private text is blocked');
rollback to savepoint compass_private_waypoint;
insert into ai.ai_interaction_message(ai_interaction_message_id,ai_interaction_session_id,sequence_number,sender_type,
  sender_user_account_id,sender_role_context,content_text)
  select pg_temp.xid(600+n),pg_temp.xid(51),1+n,'user',pg_temp.xid(1),'explorer','Synthetic later message '||n from generate_series(1,20) n;
select is((select cardinality(pg_temp.source_ids())),31,'S3: 21 messages, 3 points and 4 Waypoints make 31 source ids, above the old bound of 27');
select is((select outcome from pg_temp.inspect()),'clear','S3: a legitimate context with more than 27 source ids inspects clear');
rollback to savepoint compass_context;
select is((select outcome from pg_temp.inspect()),'clear','S3: the empty saved Compass inspects clear again after the fixture rollback');
-- Round 2 (2026-11-03, REV225-02): pin the source-id bound. The largest legitimate set is 3 + 24 history messages
-- + 24 current points + 20 Waypoint heads = 71 (the writers keep at most 24 saved points and 20 Waypoints per
-- conversation); it inspects clear, and the deployed inspector's bound is exactly 3 to 103, as prepare's.
select is((select count(*)::integer from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='ai' and p.proname='solmind_inspect_explorer_context_v3'
      and strpos(p.prosrc,'pg_catalog.cardinality(p_context_source_ids) not between 3 and 103')>0),1,
  'S3: the deployed inspector bounds its source ids between 3 and 103');
savepoint compass_maximum;
insert into ai.ai_interaction_message(ai_interaction_message_id,ai_interaction_session_id,sequence_number,sender_type,
  sender_user_account_id,sender_role_context,content_text)
  select pg_temp.xid(600+n),pg_temp.xid(51),1+n,'user',pg_temp.xid(1),'explorer','Synthetic later message '||n from generate_series(1,30) n;
insert into ai.explorer_conversation_compass_item(item_id,conversation_id,source_message_id,label,display_order,compass_anchor,relative_emphasis)
  select pg_temp.xid(700+n),pg_temp.xid(51),pg_temp.xid(70),'Synthetic point '||n,n,
    (array['apex','upper_left','upper_right','side_left','side_right','lower_left','lower_center','lower_right'])[n],
    case when n<=8 then 2 end from generate_series(1,24) n;
update ai.explorer_conversation_state set priority_id=pg_temp.xid(701),attention_id=pg_temp.xid(724) where conversation_id=pg_temp.xid(51);
insert into ai.explorer_conversation_operation(actor_user_account_id,operation_id,application_session_id,conversation_id,kind,
  request_fingerprint,command_fingerprint,initial_revision,status,completed_at,compass_route_kind,compass_route_item_id,compass_route_label)
  select pg_temp.xid(1),pg_temp.xid(900+n),pg_temp.xid(50),pg_temp.xid(51),'set_attention',repeat('A',64),repeat('B',64),n,'completed',
    timestamptz '2026-11-03 09:00:00+00'+n*interval '1 minute','attention_changed',pg_temp.xid(718+n),'Synthetic point '||(18+n)
  from generate_series(1,6) n;
insert into content.waypoint(waypoint_id,guide_explorer_relationship_id,source_ai_interaction_session_id,source_message_id,title,
  destination,why_it_matters,arrival_signal,lifecycle_status,chosen_by_explorer_user_account_id,chosen_at,created_at)
  select pg_temp.xid(800+n),pg_temp.xid(25),pg_temp.xid(51),pg_temp.xid(70),'Synthetic destination '||n,'Synthetic destination '||n,
    'Synthetic meaning '||n,'Synthetic arrival '||n,'chosen',pg_temp.xid(1),timestamptz '2026-11-03 10:00:00+00'+n*interval '1 minute',
    timestamptz '2026-11-03 10:00:00+00'+n*interval '1 minute'
  from generate_series(1,20) n;
select is((select cardinality(pg_temp.source_ids())),71,
  'S3: 24 history messages, 24 current points and 20 Waypoint heads make 71 source ids, the largest legitimate set');
select is((select jsonb_array_length(pg_temp.compass()->'recentRoute')),5,'S3: the largest context carries five recent needle moves');
select is((select outcome from pg_temp.inspect()),'clear','S3: the largest legitimate context (71 source ids) inspects clear');
rollback to savepoint compass_maximum;
select is((select outcome from pg_temp.inspect()),'clear','S3: the empty saved Compass inspects clear again after the largest-context rollback');

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

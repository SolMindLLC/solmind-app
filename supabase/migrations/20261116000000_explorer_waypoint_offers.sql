-- Saved Waypoint offers. Step 1 only; apply with the matching application candidate.
begin;

-- Offer identities and Explorer-private storage.
create function ai.solmind_waypoint_offer_uuid_v1(p_domain text,p_actor uuid,p_operation uuid)
returns uuid language plpgsql immutable set search_path='' as $$
declare bytes bytea;
begin
  bytes:=substring(extensions.digest(convert_to(p_domain||'|'||p_actor::text||'|'||p_operation::text,'UTF8'),'sha256') from 1 for 16);
  bytes:=set_byte(set_byte(bytes,6,(get_byte(bytes,6)&15)|80),8,(get_byte(bytes,8)&63)|128);
  return encode(bytes,'hex')::uuid;
end $$;
alter function ai.solmind_waypoint_offer_uuid_v1(text,uuid,uuid) owner to postgres;
revoke all on function ai.solmind_waypoint_offer_uuid_v1(text,uuid,uuid) from public,anon,authenticated,service_role;

create function ai.solmind_waypoint_lineage_root_v1(p_waypoint uuid)
returns uuid language sql stable security definer set search_path='' as $$
  with recursive ancestors as (
    select w.waypoint_id,w.predecessor_waypoint_id from content.waypoint w where w.waypoint_id=p_waypoint
    union all
    select w.waypoint_id,w.predecessor_waypoint_id from content.waypoint w
      join ancestors a on a.predecessor_waypoint_id=w.waypoint_id
  ) select waypoint_id from ancestors where predecessor_waypoint_id is null
$$;
alter function ai.solmind_waypoint_lineage_root_v1(uuid) owner to postgres;
revoke all on function ai.solmind_waypoint_lineage_root_v1(uuid) from public,anon,authenticated,service_role;

create table content.waypoint_offer (
  waypoint_offer_id uuid primary key,
  source_ai_interaction_session_id uuid not null references ai.explorer_conversation_state(conversation_id),
  guide_explorer_relationship_id uuid not null references core.guide_explorer_relationship(guide_explorer_relationship_id),
  offer_kind text not null check(offer_kind in ('reached','change','revisit')),
  target_waypoint_id uuid not null,
  lineage_root_waypoint_id uuid not null,
  source_message_id uuid not null references ai.ai_interaction_message(ai_interaction_message_id),
  suggestion_message_id uuid not null references ai.ai_interaction_message(ai_interaction_message_id),
  target_title text not null,
  target_destination text not null,
  target_why_it_matters text not null,
  target_arrival_signal text not null,
  target_stage text not null check(target_stage in ('chosen','reached','released')),
  title text null,
  destination text null,
  why_it_matters text null,
  arrival_signal text null,
  evidence text null,
  offer_status text not null default 'proposed' check(offer_status in ('proposed','confirmed','declined','superseded')),
  result_waypoint_id uuid null,
  superseded_by_offer_id uuid null,
  created_at timestamptz not null default clock_timestamp(),
  visibility text not null default 'explorer_private' check(visibility='explorer_private'),
  retention_class text not null default 'sensitive_content' check(retention_class='sensitive_content'),
  unique(source_ai_interaction_session_id,waypoint_offer_id),
  foreign key(source_ai_interaction_session_id,target_waypoint_id)
    references content.waypoint(source_ai_interaction_session_id,waypoint_id),
  foreign key(source_ai_interaction_session_id,lineage_root_waypoint_id)
    references content.waypoint(source_ai_interaction_session_id,waypoint_id),
  foreign key(source_ai_interaction_session_id,result_waypoint_id)
    references content.waypoint(source_ai_interaction_session_id,waypoint_id),
  foreign key(source_ai_interaction_session_id,superseded_by_offer_id)
    references content.waypoint_offer(source_ai_interaction_session_id,waypoint_offer_id) deferrable initially deferred,
  check((offer_status='confirmed')=(result_waypoint_id is not null)),
  check((offer_status='superseded')=(superseded_by_offer_id is not null)),
  check(superseded_by_offer_id is null or superseded_by_offer_id<>waypoint_offer_id),
  check((offer_kind='reached' and title is null and destination is null and why_it_matters is null
      and arrival_signal is null and evidence is not null and ai.solmind_conversation_text_valid(evidence,1000,false)
      and evidence=ai.solmind_exclusion_normalize_v3(evidence))
    or (offer_kind in ('change','revisit') and evidence is null and title is not null and destination is not null
      and why_it_matters is not null and arrival_signal is not null
      and ai.solmind_waypoint_draft_text_valid(title) and ai.solmind_waypoint_draft_text_valid(destination)
      and ai.solmind_waypoint_draft_text_valid(why_it_matters) and ai.solmind_waypoint_draft_text_valid(arrival_signal)))
);
alter table content.waypoint_offer owner to postgres;
alter table content.waypoint_offer enable row level security;
revoke all on content.waypoint_offer from public,anon,authenticated,service_role;
create unique index waypoint_offer_one_proposed on content.waypoint_offer(source_ai_interaction_session_id)
  where offer_status='proposed';
create unique index waypoint_offer_reached_once on content.waypoint_offer(source_ai_interaction_session_id,lineage_root_waypoint_id)
  where offer_kind='reached';
comment on table content.waypoint_offer is
  'Explorer-private reply-carried offers. Immutable target snapshot and lineage; Reached may be offered once per root in this conversation.';
comment on column content.waypoint_offer.superseded_by_offer_id is
  'Deferred same-conversation proof that supersession creates its replacement in the same settlement. The guard binds this id to the pending Send.';

alter table content.waypoint
  add column suggestion_offer_id uuid null,
  add constraint waypoint_suggestion_offer_fkey foreign key(source_ai_interaction_session_id,suggestion_offer_id)
    references content.waypoint_offer(source_ai_interaction_session_id,waypoint_offer_id),
  add constraint waypoint_suggestion_offer_unique unique(suggestion_offer_id),
  drop constraint waypoint_suggestion_provenance_shape,
  add constraint waypoint_suggestion_provenance_shape check(
    (suggested_by_actor_type is null and suggestion_draft_id is null and suggestion_offer_id is null and suggestion_message_id is null)
    or (suggested_by_actor_type='solmind_virtual_guide' and suggested_by_actor_type is not null
      and suggestion_message_id is not null
      and ((suggestion_draft_id is not null and suggestion_offer_id is null)
        or (suggestion_draft_id is null and suggestion_offer_id is not null))));

-- The original question-key check was unnamed. Identify its exact expression
-- instead of depending on PostgreSQL's generated constraint name; fail closed
-- if that original check is absent or ambiguous.
do $$
declare constraint_names text[];
begin
  select array_agg(c.conname::text) into constraint_names from pg_catalog.pg_constraint c
    where c.conrelid='content.waypoint_clarification'::regclass and c.contype='c'
      and regexp_replace(replace(pg_catalog.pg_get_expr(c.conbin,c.conrelid),'::text',''),'[[:space:]()]','','g')
        = 'question_key=''waypoint.''||component||''.v1''';
  if cardinality(constraint_names) is distinct from 1 then
    raise exception 'solmind_explorer_private_migration_identity'; end if;
  execute format('alter table content.waypoint_clarification drop constraint %I',constraint_names[1]);
end $$;
alter table content.waypoint_clarification
  add constraint waypoint_clarification_offer_question_key_check check(question_key in
    ('waypoint.'||component||'.v1','waypoint.'||component||'.offer.v1'));
comment on table content.waypoint_clarification is
  'Immutable changed-component confirmation source. .v1 records an application question answered by typing; .offer.v1 records Virtual Guide wording confirmed by the Explorer. Original whole-message origin stays separate.';

alter table ai.explorer_conversation_operation
  add column offer_id uuid null,
  add column offer_kind text null,
  add column offer_target_waypoint_id uuid null,
  add column offer_suggestion_message_id uuid null references ai.ai_interaction_message(ai_interaction_message_id),
  add column offer_response text null,
  add column offer_typed boolean not null default false,
  add column offer_outcome text null,
  add column offer_result_waypoint_id uuid null,
  add constraint explorer_waypoint_offer_response_fkey foreign key(conversation_id,offer_id)
    references content.waypoint_offer(source_ai_interaction_session_id,waypoint_offer_id),
  add constraint explorer_waypoint_offer_target_fkey foreign key(conversation_id,offer_target_waypoint_id)
    references content.waypoint(source_ai_interaction_session_id,waypoint_id),
  add constraint explorer_waypoint_offer_result_fkey foreign key(conversation_id,offer_result_waypoint_id)
    references content.waypoint(source_ai_interaction_session_id,waypoint_id) deferrable initially deferred,
  add constraint explorer_waypoint_offer_response_shape check(
    (kind='respond_waypoint_offer' and offer_id is not null and offer_kind is not null
      and offer_kind in ('reached','change','revisit') and offer_target_waypoint_id is not null
      and offer_suggestion_message_id is not null and offer_response is not null
      and offer_response in ('right','close','not_it') and (offer_kind<>'reached' or offer_response<>'close')
      and offer_outcome is not null and offer_outcome=case offer_response
        when 'right' then 'confirmed' when 'not_it' then 'declined' else 'kept_open' end
      and ((offer_outcome='confirmed')=(offer_result_waypoint_id is not null))
      and status='completed' and reply_message_id is null and compass_route_kind is null)
    or (kind<>'respond_waypoint_offer' and offer_id is null and offer_kind is null
      and offer_target_waypoint_id is null and offer_suggestion_message_id is null and offer_response is null
      and not offer_typed and offer_outcome is null and offer_result_waypoint_id is null)),
  drop constraint explorer_conversation_operation_kind_check,
  add constraint explorer_conversation_operation_kind_check check(kind in ('send','add_compass','confirm_priority','set_attention',
    'confirm_waypoint','confirm_reached','confirm_compass_arrangement','end_conversation','confirm_compass_category',
    'release_waypoint','revise_waypoint','revisit_waypoint','follow_attention','confirm_compass_point','reject_compass_point',
    'respond_compass_suggestion','respond_waypoint_draft','respond_waypoint_offer'));
create trigger explorer_waypoint_offer_reply_guard before update or delete on ai.explorer_conversation_operation
  for each row when(old.kind='respond_waypoint_offer') execute function ai.solmind_compass_suggestion_reply_guard();

create table ai.explorer_waypoint_offer_event (
  event_id uuid primary key,
  actor_user_account_id uuid not null,
  operation_id uuid not null,
  conversation_id uuid not null references ai.explorer_conversation_state(conversation_id),
  event_kind text not null check(event_kind in ('offer_dropped','typed_answer_refused')),
  offer_kind text null check(offer_kind in ('reached','change','revisit')),
  waypoint_offer_id uuid null,
  suggestion_message_id uuid not null references ai.ai_interaction_message(ai_interaction_message_id),
  reason text not null,
  created_at timestamptz not null,
  retention_class text not null default 'sensitive_content' check(retention_class='sensitive_content'),
  foreign key(actor_user_account_id,operation_id)
    references ai.explorer_conversation_operation(actor_user_account_id,operation_id),
  foreign key(conversation_id,waypoint_offer_id)
    references content.waypoint_offer(source_ai_interaction_session_id,waypoint_offer_id),
  unique(actor_user_account_id,operation_id,event_kind),
  check((event_kind='offer_dropped' and waypoint_offer_id is null
      and reason in ('invalid','target_not_available','already_offered','evidence_not_found','no_change','not_allowed_now'))
    or (event_kind='typed_answer_refused' and waypoint_offer_id is not null and offer_kind is not null
      and reason in ('history_limit','active_limit','target_changed')))
);
alter table ai.explorer_waypoint_offer_event owner to postgres;
alter table ai.explorer_waypoint_offer_event enable row level security;
revoke all on ai.explorer_waypoint_offer_event from public,anon,authenticated,service_role;
create trigger explorer_waypoint_offer_event_immutable before update or delete on ai.explorer_waypoint_offer_event
  for each row execute function ai.solmind_compass_suggestion_reply_guard();

-- Latest body: 20261105010000_explorer_forming_compass_points.sql.
-- Only the new answer kind joins the existing immutable operation list.
create or replace function ai.solmind_private_operation_guard_v3() returns trigger
language plpgsql set search_path='' as $$
begin
  if tg_op='INSERT' then
    if new.kind='follow_attention' and not exists(select 1 from ai.explorer_conversation_operation source
      where source.actor_user_account_id=new.actor_user_account_id and source.operation_id=new.origin_operation_id
        and source.conversation_id=new.conversation_id and source.application_session_id=new.application_session_id
        and source.kind='send' and source.status='completed' and source.reply_message_id is not null
        and source.safety_protocol_version='explorer-safety-reply.v2')
      then raise exception 'solmind_explorer_private_operation_conflict'; end if;
    if new.kind='set_attention' and new.origin_operation_id is not null and not exists(
      select 1 from ai.explorer_conversation_operation source
      join ai.explorer_conversation_compass_item point on point.conversation_id=source.conversation_id
        and point.item_id=source.followed_attention_item_id
      where source.actor_user_account_id=new.actor_user_account_id and source.operation_id=new.origin_operation_id
        and source.conversation_id=new.conversation_id and source.application_session_id=new.application_session_id
        and source.kind='set_attention' and source.status='completed' and source.compass_route_kind is null
        and source.origin_operation_id is null and source.followed_attention_item_id=new.compass_route_item_id
        and point.formation_status='confirmed' and point.label=new.compass_route_label
        and source.initial_revision=new.initial_revision and source.completed_at=new.completed_at)
      then raise exception 'solmind_explorer_private_operation_conflict'; end if;
    return new;
  end if;
  -- Route facts are insert-only. Legacy rows cannot be enriched into history.
  if old.compass_route_kind is not null or old.kind in ('end_conversation','confirm_compass_category','release_waypoint','revise_waypoint','revisit_waypoint','confirm_compass_point','reject_compass_point','respond_waypoint_offer') then
    raise exception 'solmind_explorer_private_immutable';
  end if;
  if old.kind='set_attention' and old.followed_attention_item_id is not null then
    raise exception 'solmind_explorer_private_immutable'; end if;
  if tg_op='UPDATE' and old.kind='set_attention'
    and new.followed_attention_item_id is distinct from old.followed_attention_item_id then
    raise exception 'solmind_explorer_private_immutable'; end if;
  if tg_op='UPDATE' and (new.compass_route_kind,new.compass_route_item_id,new.compass_route_label,new.compass_arrangement,new.ending_directions_text,new.ending_route_revision,new.compass_category_change,new.origin_operation_id)
    is distinct from (old.compass_route_kind,old.compass_route_item_id,old.compass_route_label,old.compass_arrangement,old.ending_directions_text,old.ending_route_revision,old.compass_category_change,old.origin_operation_id) then
    raise exception 'solmind_explorer_private_immutable';
  end if;
  if old.safety_protocol_version is null then
    if tg_op='UPDATE' and new.safety_protocol_version is not null then
      raise exception 'solmind_explorer_private_immutable'; end if;
    if tg_op='DELETE' then return old; end if;
    return new;
  end if;
  if tg_op='DELETE' or old.status<>'started' then raise exception 'solmind_explorer_private_immutable'; end if;
  if (to_jsonb(new)-array['status','completed_at','terminal_fingerprint','reply_message_id','followed_attention_item_id']) is distinct from
      (to_jsonb(old)-array['status','completed_at','terminal_fingerprint','reply_message_id','followed_attention_item_id'])
    or new.status not in ('completed','failed','canceled') or new.completed_at is null or new.terminal_fingerprint is null
    then raise exception 'solmind_explorer_private_immutable'; end if;
  return new;
end $$;

-- Offer persistence and typed-answer eligibility.
-- This is the eligibility used both by the state projection and by settlement.
-- A before-message id asks about the presentation preceding this Send, even
-- after settlement has inserted the Send's new Virtual Guide reply.
create function ai.solmind_waypoint_draft_typed_answer_eligible(p_conversation uuid,p_draft uuid,p_before_message uuid default null)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from content.waypoint_draft d
    join ai.explorer_conversation_state st on st.conversation_id=d.source_ai_interaction_session_id
    join ai.ai_interaction_message carrying on carrying.ai_interaction_message_id=d.suggestion_message_id
      and carrying.ai_interaction_session_id=p_conversation
    where d.source_ai_interaction_session_id=p_conversation and d.waypoint_draft_id=p_draft and d.draft_status='proposed'
      and d.suggestion_message_id=(select m.ai_interaction_message_id from ai.ai_interaction_message m
        where m.ai_interaction_session_id=p_conversation and m.sender_type='ai' and m.ai_role='solmind_virtual_guide'
          and m.sender_user_account_id is null and (p_before_message is null or m.sequence_number<(
            select b.sequence_number from ai.ai_interaction_message b where b.ai_interaction_message_id=p_before_message
              and b.ai_interaction_session_id=p_conversation)) order by m.sequence_number desc limit 1)
      and not exists(select 1 from ai.explorer_conversation_operation r
        where r.actor_user_account_id=st.actor_user_account_id and r.conversation_id=p_conversation
          and r.kind='respond_waypoint_draft' and r.status='completed' and r.waypoint_suggestion_draft_id=p_draft
          and r.completed_at>=carrying.created_at))
$$;
alter function ai.solmind_waypoint_draft_typed_answer_eligible(uuid,uuid,uuid) owner to postgres;
revoke all on function ai.solmind_waypoint_draft_typed_answer_eligible(uuid,uuid,uuid) from public,anon,authenticated,service_role;

create function ai.solmind_waypoint_offer_typed_answer_eligible(p_conversation uuid,p_offer uuid,p_before_message uuid default null)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from content.waypoint_offer o
    join ai.explorer_conversation_state st on st.conversation_id=o.source_ai_interaction_session_id
    join ai.ai_interaction_message carrying on carrying.ai_interaction_message_id=o.suggestion_message_id
      and carrying.ai_interaction_session_id=p_conversation
    where o.source_ai_interaction_session_id=p_conversation and o.waypoint_offer_id=p_offer and o.offer_status='proposed'
      and o.suggestion_message_id=(select m.ai_interaction_message_id from ai.ai_interaction_message m
        where m.ai_interaction_session_id=p_conversation and m.sender_type='ai' and m.ai_role='solmind_virtual_guide'
          and m.sender_user_account_id is null and (p_before_message is null or m.sequence_number<(
            select b.sequence_number from ai.ai_interaction_message b where b.ai_interaction_message_id=p_before_message
              and b.ai_interaction_session_id=p_conversation)) order by m.sequence_number desc limit 1)
      and not exists(select 1 from ai.explorer_conversation_operation r
        where r.actor_user_account_id=st.actor_user_account_id and r.conversation_id=p_conversation
          and r.kind='respond_waypoint_offer' and r.status='completed' and r.offer_id=p_offer
          and r.completed_at>=carrying.created_at))
$$;
alter function ai.solmind_waypoint_offer_typed_answer_eligible(uuid,uuid,uuid) owner to postgres;
revoke all on function ai.solmind_waypoint_offer_typed_answer_eligible(uuid,uuid,uuid) from public,anon,authenticated,service_role;

create function ai.solmind_plan_waypoint_offer_v1(p_actor uuid,p_conversation uuid,p_operation uuid,p_offer jsonb)
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare st ai.explorer_conversation_state%rowtype; w content.waypoint%rowtype; current_offer content.waypoint_offer%rowtype;
  k text; target uuid; root_id uuid; offer_id uuid; normalized_evidence text; stage text;
begin
  perform ai.solmind_private_owner_lock_v3(p_actor);
  select s.* into st from ai.explorer_conversation_state s where s.conversation_id=p_conversation for update;
  k:=case when jsonb_typeof(p_offer->'kind')='string' and p_offer->>'kind' in ('reached','change','revisit') then p_offer->>'kind' end;
  if jsonb_typeof(p_offer) is distinct from 'object' then return jsonb_build_object('kind',k,'reason','invalid'); end if;
  if k is null
    or jsonb_typeof(p_offer->'waypointId') is distinct from 'string'
    or (p_offer->>'waypointId') collate "C" !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or (k='reached' and (not(p_offer ?& array['kind','waypointId','evidence'])
      or exists(select 1 from jsonb_object_keys(p_offer) key where key not in ('kind','waypointId','evidence'))
      or jsonb_typeof(p_offer->'evidence') is distinct from 'string'))
    or (k<>'reached' and (not(p_offer ?& array['kind','waypointId','title','destination','whyItMatters','arrivalSignal'])
      or exists(select 1 from jsonb_object_keys(p_offer) key where key not in ('kind','waypointId','title','destination','whyItMatters','arrivalSignal'))
      or jsonb_typeof(p_offer->'title') is distinct from 'string' or jsonb_typeof(p_offer->'destination') is distinct from 'string'
      or jsonb_typeof(p_offer->'whyItMatters') is distinct from 'string' or jsonb_typeof(p_offer->'arrivalSignal') is distinct from 'string'
      or ai.solmind_waypoint_draft_text_valid(p_offer->>'title') is not true
      or ai.solmind_waypoint_draft_text_valid(p_offer->>'destination') is not true
      or ai.solmind_waypoint_draft_text_valid(p_offer->>'whyItMatters') is not true
      or ai.solmind_waypoint_draft_text_valid(p_offer->>'arrivalSignal') is not true)) then
    return jsonb_build_object('kind',k,'reason','invalid');
  end if;
  normalized_evidence:=case when k='reached' then ai.solmind_exclusion_normalize_v3(p_offer->>'evidence') end;
  if k='reached' and ai.solmind_conversation_text_valid(normalized_evidence,1000,false) is not true then
    return jsonb_build_object('kind',k,'reason','invalid'); end if;
  if st.actor_user_account_id is distinct from p_actor or st.restricted_level is not null or st.adult_reflection_stopped then
    return jsonb_build_object('kind',k,'reason','not_allowed_now'); end if;
  target:=(p_offer->>'waypointId')::uuid;
  select t.* into w from content.waypoint t where t.waypoint_id=target
    and t.source_ai_interaction_session_id=p_conversation and t.chosen_by_explorer_user_account_id=p_actor for update;
  if not found or exists(select 1 from content.waypoint successor where successor.predecessor_waypoint_id=target)
    or w.guide_explorer_relationship_id is distinct from (select s.guide_explorer_relationship_id
      from ai.ai_interaction_session s where s.ai_interaction_session_id=p_conversation)
    or (k in ('reached','change') and (w.lifecycle_status<>'chosen' or w.released_at is not null))
    or (k='revisit' and w.lifecycle_status<>'reached' and w.released_at is null) then
    return jsonb_build_object('kind',k,'reason','target_not_available'); end if;
  root_id:=ai.solmind_waypoint_lineage_root_v1(target);
  if k='reached' and exists(select 1 from content.waypoint_offer o
    where o.source_ai_interaction_session_id=p_conversation and o.lineage_root_waypoint_id=root_id and o.offer_kind='reached') then
    return jsonb_build_object('kind',k,'reason','already_offered'); end if;
  if k='reached' and not exists(select 1 from ai.ai_interaction_message m
    where m.ai_interaction_session_id=p_conversation and m.sender_type='user' and m.sender_role_context='explorer'
      and m.sender_user_account_id=p_actor and strpos(ai.solmind_exclusion_normalize_v3(m.content_text),normalized_evidence)>0) then
    return jsonb_build_object('kind',k,'reason','evidence_not_found'); end if;
  if k='change' and (p_offer->>'destination',p_offer->>'whyItMatters',p_offer->>'arrivalSignal')
    is not distinct from (w.destination,w.why_it_matters,w.arrival_signal) then
    return jsonb_build_object('kind',k,'reason','no_change'); end if;
  select o.* into current_offer from content.waypoint_offer o where o.source_ai_interaction_session_id=p_conversation
    and o.offer_status='proposed' for update;
  offer_id:=case when k in ('change','revisit') and current_offer.offer_kind=k and current_offer.target_waypoint_id=target
    then current_offer.waypoint_offer_id else ai.solmind_waypoint_offer_uuid_v1('explorer-waypoint-offer.v1',p_actor,p_operation) end;
  stage:=case when w.released_at is not null then 'released' else w.lifecycle_status end;
  return jsonb_build_object('kind',k,'offerId',offer_id,'targetId',target,'rootId',root_id,
    'relationshipId',w.guide_explorer_relationship_id,'targetTitle',w.title,'targetDestination',w.destination,
    'targetWhyItMatters',w.why_it_matters,'targetArrivalSignal',w.arrival_signal,'targetStage',stage,
    'title',p_offer->>'title','destination',p_offer->>'destination','whyItMatters',p_offer->>'whyItMatters',
    'arrivalSignal',p_offer->>'arrivalSignal','evidence',normalized_evidence);
end $$;
alter function ai.solmind_plan_waypoint_offer_v1(uuid,uuid,uuid,jsonb) owner to postgres;
revoke all on function ai.solmind_plan_waypoint_offer_v1(uuid,uuid,uuid,jsonb) from public,anon,authenticated,service_role;

create function content.solmind_waypoint_offer_guard_v1() returns trigger
language plpgsql set search_path='' as $$
declare st ai.explorer_conversation_state%rowtype; receipt ai.explorer_conversation_operation%rowtype;
  settled_reply uuid; w content.waypoint%rowtype;
begin
  if tg_op='DELETE' then raise exception 'solmind_explorer_private_immutable'; end if;
  select s.* into st from ai.explorer_conversation_state s where s.conversation_id=new.source_ai_interaction_session_id for update;
  if not found or not exists(select 1 from ai.ai_interaction_session s
    where s.ai_interaction_session_id=st.conversation_id and s.guide_explorer_relationship_id=new.guide_explorer_relationship_id
      and s.actor_user_account_id=st.actor_user_account_id) then raise exception 'solmind_explorer_private_formation_conflict'; end if;
  if tg_op='UPDATE' then
    if old.offer_status<>'proposed' or
      (to_jsonb(new)-array['title','destination','why_it_matters','arrival_signal','suggestion_message_id','offer_status','result_waypoint_id','superseded_by_offer_id'])
      is distinct from
      (to_jsonb(old)-array['title','destination','why_it_matters','arrival_signal','suggestion_message_id','offer_status','result_waypoint_id','superseded_by_offer_id'])
      then raise exception 'solmind_explorer_private_immutable'; end if;
    if (new.offer_status<>'proposed' or new.offer_kind='reached') and
      (new.title,new.destination,new.why_it_matters,new.arrival_signal,new.suggestion_message_id) is distinct from
      (old.title,old.destination,old.why_it_matters,old.arrival_signal,old.suggestion_message_id)
      then raise exception 'solmind_explorer_private_immutable'; end if;
    if new.offer_status in ('confirmed','declined') then
      select o.* into receipt from ai.explorer_conversation_operation o
        where o.actor_user_account_id=st.actor_user_account_id and o.conversation_id=st.conversation_id
          and o.kind='respond_waypoint_offer' and o.status='completed' and o.initial_revision=st.revision
          and o.offer_id=new.waypoint_offer_id and o.offer_kind=new.offer_kind
          and o.offer_target_waypoint_id=new.target_waypoint_id and o.offer_suggestion_message_id=new.suggestion_message_id
          and o.offer_response=case when new.offer_status='confirmed' then 'right' else 'not_it' end
          and o.offer_result_waypoint_id is not distinct from new.result_waypoint_id;
      if not found or st.pending_operation_id is not null or st.restricted_level is not null or st.adult_reflection_stopped
        then raise exception 'solmind_explorer_private_immutable'; end if;
      if new.offer_status='confirmed' then
        select t.* into w from content.waypoint t where t.waypoint_id=new.result_waypoint_id
          and t.source_ai_interaction_session_id=st.conversation_id and t.chosen_by_explorer_user_account_id=st.actor_user_account_id;
        if not found or (new.offer_kind='reached' and (w.waypoint_id<>new.target_waypoint_id
          or w.lifecycle_status<>'reached' or w.reached_evidence is distinct from new.evidence))
          or (new.offer_kind<>'reached' and ((w.title,w.destination,w.why_it_matters,w.arrival_signal)
            is distinct from (new.title,new.destination,new.why_it_matters,new.arrival_signal)
            or w.predecessor_waypoint_id is distinct from new.target_waypoint_id or w.lifecycle_status<>'chosen'
            or w.suggestion_offer_id is distinct from new.waypoint_offer_id
            or w.suggestion_message_id is distinct from new.suggestion_message_id)) then
          raise exception 'solmind_explorer_private_formation_conflict'; end if;
      end if;
      return new;
    end if;
  elsif new.offer_status<>'proposed' or new.source_message_id is distinct from new.suggestion_message_id
    or new.waypoint_offer_id is distinct from ai.solmind_waypoint_offer_uuid_v1('explorer-waypoint-offer.v1',st.actor_user_account_id,st.pending_operation_id) then
    raise exception 'solmind_explorer_private_formation_conflict';
  end if;
  select op.reply_message_id into settled_reply from ai.explorer_conversation_operation op
    join ai.ai_interaction_message m on m.ai_interaction_message_id=op.reply_message_id
    where op.actor_user_account_id=st.actor_user_account_id and op.operation_id=st.pending_operation_id
      and op.conversation_id=st.conversation_id and op.kind='send' and op.status='completed'
      and op.safety_protocol_version='explorer-safety-reply.v2' and op.safety_request_mode='classification_and_reply'
      and m.ai_interaction_session_id=st.conversation_id and m.sender_type='ai' and m.ai_role='solmind_virtual_guide'
      and m.sender_user_account_id is null;
  if settled_reply is null or st.restricted_level is not null or st.adult_reflection_stopped then
    raise exception 'solmind_explorer_private_formation_conflict'; end if;
  if new.offer_status='superseded' then
    if new.superseded_by_offer_id is distinct from ai.solmind_waypoint_offer_uuid_v1('explorer-waypoint-offer.v1',st.actor_user_account_id,st.pending_operation_id)
      then raise exception 'solmind_explorer_private_formation_conflict'; end if;
  elsif new.offer_status<>'proposed' or new.suggestion_message_id<>settled_reply
    or (tg_op='UPDATE' and new.offer_kind='reached') then
    raise exception 'solmind_explorer_private_formation_conflict';
  end if;
  if new.offer_status='proposed' then
    select t.* into w from content.waypoint t where t.waypoint_id=new.target_waypoint_id
      and t.source_ai_interaction_session_id=st.conversation_id and t.chosen_by_explorer_user_account_id=st.actor_user_account_id;
    if not found or exists(select 1 from content.waypoint successor where successor.predecessor_waypoint_id=w.waypoint_id)
      or new.lineage_root_waypoint_id is distinct from ai.solmind_waypoint_lineage_root_v1(w.waypoint_id)
      or (new.target_title,new.target_destination,new.target_why_it_matters,new.target_arrival_signal,new.target_stage)
        is distinct from (w.title,w.destination,w.why_it_matters,w.arrival_signal,
          case when w.released_at is not null then 'released' else w.lifecycle_status end)
      or (new.offer_kind in ('reached','change') and new.target_stage<>'chosen')
      or (new.offer_kind='revisit' and new.target_stage not in ('reached','released'))
      or (new.offer_kind='change' and (new.destination,new.why_it_matters,new.arrival_signal)
        is not distinct from (w.destination,w.why_it_matters,w.arrival_signal))
      or (new.offer_kind='reached' and not exists(select 1 from ai.ai_interaction_message m
        where m.ai_interaction_session_id=st.conversation_id and m.sender_type='user'
          and m.sender_role_context='explorer' and m.sender_user_account_id=st.actor_user_account_id
          and strpos(ai.solmind_exclusion_normalize_v3(m.content_text),new.evidence)>0)) then
      raise exception 'solmind_explorer_private_formation_conflict'; end if;
  end if;
  return new;
end $$;
alter function content.solmind_waypoint_offer_guard_v1() owner to postgres;
revoke all on function content.solmind_waypoint_offer_guard_v1() from public,anon,authenticated,service_role;
create trigger waypoint_offer_guard before insert or update or delete on content.waypoint_offer
  for each row execute function content.solmind_waypoint_offer_guard_v1();

create function ai.solmind_apply_waypoint_offer_v1(
  p_actor uuid,p_conversation uuid,p_operation uuid,p_reply uuid,p_plan jsonb,p_created_at timestamptz
) returns uuid language plpgsql volatile security invoker set search_path='' as $$
declare offer_id uuid;
begin
  if p_plan is null or p_plan ? 'reason' then return null; end if;
  offer_id:=(p_plan->>'offerId')::uuid;
  if exists(select 1 from content.waypoint_offer o where o.waypoint_offer_id=offer_id
    and o.source_ai_interaction_session_id=p_conversation and o.offer_status='proposed') then
    update content.waypoint_offer set title=p_plan->>'title',destination=p_plan->>'destination',
      why_it_matters=p_plan->>'whyItMatters',arrival_signal=p_plan->>'arrivalSignal',suggestion_message_id=p_reply
      where waypoint_offer_id=offer_id;
  else
    update content.waypoint_offer set offer_status='superseded',superseded_by_offer_id=offer_id
      where source_ai_interaction_session_id=p_conversation and offer_status='proposed';
    insert into content.waypoint_offer(waypoint_offer_id,source_ai_interaction_session_id,guide_explorer_relationship_id,
      offer_kind,target_waypoint_id,lineage_root_waypoint_id,source_message_id,suggestion_message_id,
      target_title,target_destination,target_why_it_matters,target_arrival_signal,target_stage,
      title,destination,why_it_matters,arrival_signal,evidence,created_at)
      values(offer_id,p_conversation,(p_plan->>'relationshipId')::uuid,p_plan->>'kind',(p_plan->>'targetId')::uuid,
        (p_plan->>'rootId')::uuid,p_reply,p_reply,p_plan->>'targetTitle',p_plan->>'targetDestination',
        p_plan->>'targetWhyItMatters',p_plan->>'targetArrivalSignal',p_plan->>'targetStage',
        p_plan->>'title',p_plan->>'destination',p_plan->>'whyItMatters',p_plan->>'arrivalSignal',p_plan->>'evidence',p_created_at);
  end if;
  return offer_id;
end $$;
alter function ai.solmind_apply_waypoint_offer_v1(uuid,uuid,uuid,uuid,jsonb,timestamptz) owner to postgres;
revoke all on function ai.solmind_apply_waypoint_offer_v1(uuid,uuid,uuid,uuid,jsonb,timestamptz) from public,anon,authenticated,service_role;

-- Provenance, answers, replay results and event receipts.
create function content.solmind_waypoint_offer_provenance_guard_v1() returns trigger
language plpgsql set search_path='' as $$
begin
  if new.suggestion_offer_id is not null and not exists(select 1 from content.waypoint_offer o
    join ai.explorer_conversation_operation r on r.conversation_id=o.source_ai_interaction_session_id
      and r.offer_id=o.waypoint_offer_id and r.kind='respond_waypoint_offer' and r.status='completed'
      and r.offer_outcome='confirmed' and r.offer_result_waypoint_id=new.waypoint_id
      and r.actor_user_account_id=new.chosen_by_explorer_user_account_id
    where o.waypoint_offer_id=new.suggestion_offer_id and o.source_ai_interaction_session_id=new.source_ai_interaction_session_id
      and o.offer_status='proposed' and o.offer_kind in ('change','revisit')
      and o.suggestion_message_id=new.suggestion_message_id and o.target_waypoint_id=new.predecessor_waypoint_id
      and new.creation_reason=case o.offer_kind when 'change' then 'revision' else 'revisit' end
      and (o.title,o.destination,o.why_it_matters,o.arrival_signal) is not distinct from
        (new.title,new.destination,new.why_it_matters,new.arrival_signal)) then
    raise exception 'solmind_explorer_private_formation_conflict'; end if;
  return new;
end $$;
alter function content.solmind_waypoint_offer_provenance_guard_v1() owner to postgres;
revoke all on function content.solmind_waypoint_offer_provenance_guard_v1() from public,anon,authenticated,service_role;
create trigger waypoint_offer_provenance_guard before insert on content.waypoint
  for each row execute function content.solmind_waypoint_offer_provenance_guard_v1();

-- Answer validation is deliberately separate from offer creation. In particular,
-- an existing Reached offer has already consumed its once-per-root place.
-- New helper patterned on ai.solmind_apply_waypoint_draft_response from
-- 20261106000000_explorer_waypoint_active_limits.sql; successor insertion and
-- clarification audit follow 20261106060000_explorer_five_waypoints_per_conversation.sql.
create function ai.solmind_apply_waypoint_offer_response_v1(
  p_actor_user_account_id uuid,p_user_session_id uuid,p_conversation_id uuid,p_operation_id uuid,
  p_request_fingerprint text,p_command_fingerprint text,p_offer_id uuid,p_response text,
  p_completed_at timestamptz,p_typed boolean
) returns text language plpgsql volatile security invoker set search_path='' as $$
declare st ai.explorer_conversation_state%rowtype; offer_row content.waypoint_offer%rowtype;
  w content.waypoint%rowtype; result_id uuid; answer_outcome text; reason text; component_name text; answer_value text;
begin
  perform ai.solmind_private_owner_lock_v3(p_actor_user_account_id);
  select s.* into st from ai.explorer_conversation_state s where s.conversation_id=p_conversation_id for update;
  if not found or st.actor_user_account_id is distinct from p_actor_user_account_id
    or st.pending_operation_id is not null or st.restricted_level is not null or st.adult_reflection_stopped then
    return 'not_allowed_now'; end if;
  select o.* into offer_row from content.waypoint_offer o where o.waypoint_offer_id=p_offer_id
    and o.source_ai_interaction_session_id=p_conversation_id for update;
  if not found or offer_row.offer_status<>'proposed' then return 'offer_not_pending'; end if;
  if p_response is null or p_response not in ('right','close','not_it')
    or (offer_row.offer_kind='reached' and p_response='close') then return 'invalid'; end if;
  if p_response='right' then
    select t.* into w from content.waypoint t where t.waypoint_id=offer_row.target_waypoint_id
      and t.source_ai_interaction_session_id=p_conversation_id and t.chosen_by_explorer_user_account_id=p_actor_user_account_id for update;
    if not found or exists(select 1 from content.waypoint successor where successor.predecessor_waypoint_id=w.waypoint_id)
      or (w.title,w.destination,w.why_it_matters,w.arrival_signal,
          case when w.released_at is not null then 'released' else w.lifecycle_status end)
        is distinct from (offer_row.target_title,offer_row.target_destination,offer_row.target_why_it_matters,
          offer_row.target_arrival_signal,offer_row.target_stage) then return 'target_changed'; end if;
  end if;
  if p_response='right' and offer_row.offer_kind in ('change','revisit')
    and not ai.solmind_waypoint_insert_allowed_v2(p_actor_user_account_id,p_conversation_id,offer_row.offer_kind='revisit',false) then
    if (select count(*) from content.waypoint t where t.source_ai_interaction_session_id=p_conversation_id)
      >=(select p.history_limit from ai.solmind_waypoint_policy_v1() p) then return 'history_limit'; end if;
    return 'active_limit';
  end if;
  answer_outcome:=case p_response when 'right' then 'confirmed' when 'not_it' then 'declined' else 'kept_open' end;
  result_id:=case when p_response='right' then case when offer_row.offer_kind='reached' then offer_row.target_waypoint_id
    else ai.solmind_waypoint_offer_uuid_v1('explorer-waypoint-offer-result.v1',p_actor_user_account_id,p_operation_id) end end;
  insert into ai.explorer_conversation_operation(actor_user_account_id,operation_id,application_session_id,conversation_id,
    kind,request_fingerprint,command_fingerprint,initial_revision,status,completed_at,
    offer_id,offer_kind,offer_target_waypoint_id,offer_suggestion_message_id,offer_response,offer_typed,offer_outcome,offer_result_waypoint_id)
    values(p_actor_user_account_id,p_operation_id,p_user_session_id,p_conversation_id,'respond_waypoint_offer',
      p_request_fingerprint,p_command_fingerprint,st.revision,'completed',p_completed_at,
      p_offer_id,offer_row.offer_kind,offer_row.target_waypoint_id,offer_row.suggestion_message_id,
      p_response,p_typed,answer_outcome,result_id);
  if p_response='right' and offer_row.offer_kind='reached' then
    update content.waypoint set lifecycle_status='reached',reached_at=p_completed_at,
      reached_by_explorer_user_account_id=p_actor_user_account_id,reached_evidence=offer_row.evidence
      where waypoint_id=offer_row.target_waypoint_id and source_ai_interaction_session_id=p_conversation_id
        and chosen_by_explorer_user_account_id=p_actor_user_account_id and lifecycle_status='chosen';
  elsif p_response='right' then
    reason:=case offer_row.offer_kind when 'change' then 'revision' else 'revisit' end;
    insert into content.waypoint(waypoint_id,guide_explorer_relationship_id,source_ai_interaction_session_id,source_message_id,title,
      destination,why_it_matters,arrival_signal,lifecycle_status,chosen_by_explorer_user_account_id,chosen_at,
      predecessor_waypoint_id,creation_reason,suggested_by_actor_type,suggestion_offer_id,suggestion_message_id)
      values(result_id,w.guide_explorer_relationship_id,p_conversation_id,w.source_message_id,offer_row.title,
        offer_row.destination,offer_row.why_it_matters,offer_row.arrival_signal,'chosen',p_actor_user_account_id,p_completed_at,
        w.waypoint_id,reason,'solmind_virtual_guide',p_offer_id,offer_row.suggestion_message_id);
    for component_name,answer_value in select component,answer from (values
      ('destination',offer_row.destination,offer_row.target_destination),
      ('meaning',offer_row.why_it_matters,offer_row.target_why_it_matters),
      ('arrivalSignal',offer_row.arrival_signal,offer_row.target_arrival_signal)) parts(component,answer,previous)
      where answer is distinct from previous loop
      insert into content.waypoint_clarification(waypoint_id,component,question_key,answer_text,source_actor_user_account_id,created_at)
        values(result_id,component_name,'waypoint.'||component_name||'.offer.v1',answer_value,p_actor_user_account_id,p_completed_at);
    end loop;
    insert into audit.audit_event(event_type,actor_user_account_id,actor_role_context,target_entity_type,target_entity_id,
      action,reason_code,event_summary,metadata,ip_address,user_agent,created_at)
      values(case offer_row.offer_kind when 'change' then 'waypoint_revised' else 'waypoint_revisited' end,
        p_actor_user_account_id,'explorer','waypoint',result_id,reason,
        case offer_row.offer_kind when 'change' then 'explorer_revised_waypoint' else 'explorer_revisited_waypoint' end,
        case offer_row.offer_kind when 'change' then 'Explorer revised a private Waypoint.' else 'Explorer revisited a private Waypoint.' end,
        '{}',null,null,p_completed_at);
  end if;
  if p_response<>'close' then
    update content.waypoint_offer set offer_status=answer_outcome,result_waypoint_id=result_id where waypoint_offer_id=p_offer_id;
  end if;
  return 'applied';
end $$;
alter function ai.solmind_apply_waypoint_offer_response_v1(uuid,uuid,uuid,uuid,text,text,uuid,text,timestamptz,boolean) owner to postgres;
revoke all on function ai.solmind_apply_waypoint_offer_response_v1(uuid,uuid,uuid,uuid,text,text,uuid,text,timestamptz,boolean) from public,anon,authenticated,service_role;

create function ai.solmind_waypoint_offer_result_v1(p_actor uuid,p_operation uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('offerId',r.offer_id,'kind',r.offer_kind,'waypointId',r.offer_target_waypoint_id,
    'suggestionMessageId',r.offer_suggestion_message_id,'response',r.offer_response,'typed',r.offer_typed,
    'outcome',r.offer_outcome,'resultWaypointId',r.offer_result_waypoint_id)
  from ai.explorer_conversation_operation r where r.actor_user_account_id=p_actor and r.operation_id=p_operation
    and r.kind='respond_waypoint_offer' and r.status='completed'
$$;
alter function ai.solmind_waypoint_offer_result_v1(uuid,uuid) owner to postgres;
revoke all on function ai.solmind_waypoint_offer_result_v1(uuid,uuid) from public,anon,authenticated,service_role;

-- Same authority/replay/revision order as the latest draft command in
-- 20261105060000_explorer_typed_waypoint_replies.sql. Only this RPC increments
-- the revision; the shared helper does not. Exact replay returns before it.
create function public.solmind_respond_explorer_waypoint_offer_v1(
  p_actor_user_account_id uuid,p_user_session_id uuid,p_conversation_id uuid,p_operation_id uuid,
  p_expected_revision integer,p_command_fingerprint text,p_offer_id uuid,p_response text
) returns table(outcome text,conversation_state jsonb,operation_result jsonb)
language plpgsql volatile security definer set search_path='' set lock_timeout='2000ms' set statement_timeout='5000ms' as $$
declare a jsonb; st ai.explorer_conversation_state%rowtype; op ai.explorer_conversation_operation%rowtype;
  h text; ts timestamptz; result text;
begin
  perform ai.solmind_private_owner_lock_v3(p_actor_user_account_id);
  if p_conversation_id is null or p_operation_id is null or p_expected_revision is null or p_expected_revision<0
    or p_offer_id is null or p_response is null or p_response not in ('right','close','not_it')
    or p_command_fingerprint is null or p_command_fingerprint !~ '^[0-9A-F]{64}$'
    then raise exception 'solmind_explorer_private_invalid_input'; end if;
  h:=methodology.hash_json(jsonb_build_array('explorer-waypoint-offer-response.v1',p_user_session_id,p_conversation_id,
    p_expected_revision,p_offer_id,p_response,p_command_fingerprint));
  a:=ai.solmind_private_owned_authority_v3(p_actor_user_account_id,p_user_session_id,p_conversation_id);
  select s.* into st from ai.explorer_conversation_state s where s.conversation_id=p_conversation_id for update;
  if not found or st.actor_user_account_id is distinct from p_actor_user_account_id
    then raise exception 'solmind_explorer_private_denied'; end if;
  select o.* into op from ai.explorer_conversation_operation o
    where o.actor_user_account_id=p_actor_user_account_id and o.operation_id=p_operation_id for update;
  if found then
    if op.request_fingerprint is distinct from h or op.command_fingerprint is distinct from p_command_fingerprint
      or op.kind is distinct from 'respond_waypoint_offer' or op.conversation_id is distinct from p_conversation_id
      or op.application_session_id is distinct from p_user_session_id or op.status is distinct from 'completed'
      or op.offer_id is distinct from p_offer_id or op.offer_response is distinct from p_response or op.offer_typed
      then raise exception 'solmind_explorer_private_operation_conflict'; end if;
    if (a->>'applicationSessionExpiresAt')::timestamptz<=clock_timestamp() then raise exception 'solmind_explorer_private_denied'; end if;
    return query select 'exact_replay'::text,ai.solmind_conversation_state_json(p_conversation_id),
      ai.solmind_waypoint_offer_result_v1(p_actor_user_account_id,p_operation_id); return;
  end if;
  if ai.solmind_private_policy_v3(p_conversation_id)->'known' is distinct from 'true'::jsonb
    or st.restricted_level is not null or st.adult_reflection_stopped then raise exception 'solmind_explorer_private_denied'; end if;
  if st.revision<>p_expected_revision then return query select 'stale_revision'::text,null::jsonb,null::jsonb; return; end if;
  if st.pending_operation_id is not null then return query select 'operation_conflict'::text,null::jsonb,null::jsonb; return; end if;
  ts:=clock_timestamp();
  result:=ai.solmind_apply_waypoint_offer_response_v1(p_actor_user_account_id,p_user_session_id,p_conversation_id,
    p_operation_id,h,p_command_fingerprint,p_offer_id,p_response,ts,false);
  if result<>'applied' then return query select 'operation_conflict'::text,null::jsonb,null::jsonb; return; end if;
  update ai.explorer_conversation_state set revision=revision+1 where conversation_id=p_conversation_id;
  update ai.ai_interaction_session set last_activity_at=ts where ai_interaction_session_id=p_conversation_id;
  if (a->>'applicationSessionExpiresAt')::timestamptz<=clock_timestamp() then raise exception 'solmind_explorer_private_denied'; end if;
  return query select 'ok'::text,ai.solmind_conversation_state_json(p_conversation_id),
    ai.solmind_waypoint_offer_result_v1(p_actor_user_account_id,p_operation_id);
end $$;
alter function public.solmind_respond_explorer_waypoint_offer_v1(uuid,uuid,uuid,uuid,integer,text,uuid,text) owner to postgres;
revoke all on function public.solmind_respond_explorer_waypoint_offer_v1(uuid,uuid,uuid,uuid,integer,text,uuid,text) from public,anon,authenticated;
grant execute on function public.solmind_respond_explorer_waypoint_offer_v1(uuid,uuid,uuid,uuid,integer,text,uuid,text) to service_role;

create function ai.solmind_waypoint_offer_event_guard_v1() returns trigger
language plpgsql set search_path='' as $$
declare st ai.explorer_conversation_state%rowtype; op ai.explorer_conversation_operation%rowtype;
begin
  select s.* into st from ai.explorer_conversation_state s where s.conversation_id=new.conversation_id for update;
  select o.* into op from ai.explorer_conversation_operation o
    where o.actor_user_account_id=new.actor_user_account_id and o.operation_id=new.operation_id;
  if st.actor_user_account_id is distinct from new.actor_user_account_id or op.conversation_id is distinct from new.conversation_id
    or op.kind is distinct from 'send' or op.status is distinct from 'completed' or op.reply_message_id is null
    or new.event_id is distinct from ai.solmind_waypoint_offer_uuid_v1('explorer-waypoint-'||new.event_kind||'.v1',new.actor_user_account_id,new.operation_id)
    or new.created_at is distinct from op.completed_at then raise exception 'solmind_explorer_private_operation_conflict'; end if;
  if new.event_kind='offer_dropped' then
    if st.pending_operation_id is distinct from new.operation_id or new.suggestion_message_id is distinct from op.reply_message_id then
      raise exception 'solmind_explorer_private_operation_conflict'; end if;
  elsif st.pending_operation_id is not null or not exists(select 1 from content.waypoint_offer o
    where o.waypoint_offer_id=new.waypoint_offer_id and o.source_ai_interaction_session_id=new.conversation_id
      and o.offer_kind=new.offer_kind and o.offer_status='proposed' and o.suggestion_message_id=new.suggestion_message_id)
    or not ai.solmind_waypoint_offer_typed_answer_eligible(new.conversation_id,new.waypoint_offer_id,op.message_id) then
    raise exception 'solmind_explorer_private_operation_conflict';
  end if;
  return new;
end $$;
alter function ai.solmind_waypoint_offer_event_guard_v1() owner to postgres;
revoke all on function ai.solmind_waypoint_offer_event_guard_v1() from public,anon,authenticated,service_role;
create trigger explorer_waypoint_offer_event_guard before insert on ai.explorer_waypoint_offer_event
  for each row execute function ai.solmind_waypoint_offer_event_guard_v1();

create function ai.solmind_record_waypoint_offer_event_v1(
  p_actor uuid,p_conversation uuid,p_operation uuid,p_event_kind text,p_offer_kind text,
  p_offer uuid,p_reply uuid,p_reason text,p_created_at timestamptz
) returns void language plpgsql volatile security invoker set search_path='' as $$
begin
  insert into ai.explorer_waypoint_offer_event(event_id,actor_user_account_id,operation_id,conversation_id,
    event_kind,offer_kind,waypoint_offer_id,suggestion_message_id,reason,created_at)
    values(ai.solmind_waypoint_offer_uuid_v1('explorer-waypoint-'||p_event_kind||'.v1',p_actor,p_operation),
      p_actor,p_operation,p_conversation,p_event_kind,p_offer_kind,p_offer,p_reply,p_reason,p_created_at);
end $$;
alter function ai.solmind_record_waypoint_offer_event_v1(uuid,uuid,uuid,text,text,uuid,uuid,text,timestamptz) owner to postgres;
revoke all on function ai.solmind_record_waypoint_offer_event_v1(uuid,uuid,uuid,text,text,uuid,uuid,text,timestamptz) from public,anon,authenticated,service_role;

-- Restated from 20261111000000_explorer_automatic_compass_v1.sql (latest settlement).
-- Null new arguments preserve the historical fingerprint byte structure.
drop function public.solmind_settle_explorer_conversation_turn_v4(uuid,uuid,uuid,uuid,text,uuid,text,text,smallint,boolean,text,text,text,text,text,text,text,smallint,boolean,boolean,uuid,jsonb,jsonb,jsonb,jsonb,jsonb,text,jsonb);
create function public.solmind_settle_explorer_conversation_turn_v4(
  p_actor_user_account_id uuid,p_user_session_id uuid,p_conversation_id uuid,p_operation_id uuid,
  p_status text,p_reply_message_id uuid,p_reply_kind text,p_reply_body text,
  p_model_level smallint,p_model_minor_indicated boolean,p_protocol_version text,p_request_mode text,
  p_configuration_fingerprint text,p_fallback_policy_version text,p_model_policy_version text,
  p_trusted_response_version text,p_resource_policy_version text,p_fallback_level smallint,
  p_fallback_minor_indicated boolean,p_delivery_interested boolean,p_attention_item_id uuid,p_choices jsonb,p_compass_suggestions jsonb default null,p_compass_responses jsonb default null,p_waypoint_suggestion jsonb default null,p_waypoint_response jsonb default null,
  p_failure_reason text default null,p_compass_topics jsonb default null,
  p_waypoint_offer jsonb default null,p_waypoint_offer_response jsonb default null,p_waypoint_offer_drop jsonb default null
) returns table(outcome text,conversation_state jsonb,policy_state jsonb,saved_reply boolean)
language plpgsql volatile security definer set search_path='' set lock_timeout='2000ms' set statement_timeout='5000ms' as $$
declare st ai.explorer_conversation_state%rowtype; op ai.explorer_conversation_operation%rowtype;
  a jsonb; intent text; h text; observed_fallback text; ts timestamptz; n integer;
  may_return boolean:=false; may_save boolean:=false; saved_id uuid; saved_body text; saved_kind text:='none';
  saved_choices jsonb; followed_id uuid; followed_operation_id uuid; followed_label text; follow_hash text; follow_bytes bytea; followed_formation text; suggestion jsonb; suggestion_label text; suggestion_id uuid; suggestion_index integer:=0; item_count integer;
  response jsonb; response_id uuid; response_name text; response_hash text; response_operation_id uuid;
  new_draft_id uuid; automatic_plan jsonb; followed_is_planned boolean:=false;
  offer_plan jsonb; offer_result text; offered_kind text; answered_offer content.waypoint_offer%rowtype;
  draft_applied boolean:=false;
  response_ids uuid[]:=array[]::uuid[]; refined_ids uuid[]:=array[]::uuid[];
begin
  perform ai.solmind_private_owner_lock_v3(p_actor_user_account_id);
  if p_user_session_id is null or p_conversation_id is null or p_operation_id is null
    or p_status is null or p_status not in ('completed','failed','canceled')
    or p_protocol_version is distinct from 'explorer-safety-reply.v2'
    or p_request_mode is null or p_request_mode not in ('classification_and_reply','classification_only')
    or p_reply_kind is null or p_reply_kind not in ('ordinary','urgent','crisis','restricted','adult_only','none')
    or (p_reply_kind='none' and (p_reply_message_id is not null or p_reply_body is not null))
    or (p_reply_kind<>'none' and (p_reply_message_id is null or not ai.solmind_conversation_text_valid(p_reply_body,8192,false)))
    or (p_status<>'completed' and p_reply_kind<>'none')
    or (p_model_level is null) is distinct from (p_model_minor_indicated is null)
    or (p_model_level is not null and p_model_level not between 0 and 4)
    or (p_status='completed' and p_model_level is null)
    or p_fallback_level is null or p_fallback_level not between 0 and 4 or p_fallback_minor_indicated is null
    or p_delivery_interested is null
    or (p_failure_reason is not null and (p_failure_reason not in
      ('deadline','transport_failed','invalid_response','delivery_canceled_before_dispatch','dispatch_not_admitted','trusted_render_unavailable')
      or p_reply_kind<>'none'
      or (p_model_level is not null and p_failure_reason not in ('invalid_response','trusted_render_unavailable'))
      or (p_status='canceled' and p_failure_reason='trusted_render_unavailable')))
    then raise exception 'solmind_explorer_private_invalid_input'; end if;
  -- Technical settlement owns the already-prepared operation, not a new login
  -- authority. Preserve actual positives after logout without returning content.
  perform s.ai_interaction_session_id from ai.ai_interaction_session s
    where s.ai_interaction_session_id=p_conversation_id and s.actor_user_account_id=p_actor_user_account_id
      and s.actor_role_context='explorer' and s.session_type='explorer_reflection' for update;
  if not found then raise exception 'solmind_explorer_private_denied'; end if;
  perform u.user_session_id from identity.user_session u where u.user_session_id=p_user_session_id
    and u.user_account_id=p_actor_user_account_id and u.active_role_context='explorer' for share;
  if not found then raise exception 'solmind_explorer_private_denied'; end if;
  select x.* into st from ai.explorer_conversation_state x where x.conversation_id=p_conversation_id for update;
  if not found or st.actor_user_account_id is distinct from p_actor_user_account_id
    or ai.solmind_private_policy_v3(p_conversation_id)->'known' is distinct from 'true'::jsonb
    then raise exception 'solmind_explorer_private_legacy_unknown'; end if;
  select x.* into op from ai.explorer_conversation_operation x where x.actor_user_account_id=p_actor_user_account_id
    and x.operation_id=p_operation_id for update;
  if not found or op.kind is distinct from 'send' or op.conversation_id is distinct from p_conversation_id
    or op.application_session_id is distinct from p_user_session_id
    or op.safety_protocol_version is distinct from p_protocol_version or op.safety_request_mode is distinct from p_request_mode
    or op.configuration_fingerprint is distinct from p_configuration_fingerprint
    or op.fallback_policy_version is distinct from p_fallback_policy_version
    or op.model_policy_version is distinct from p_model_policy_version
    or op.trusted_response_version is distinct from p_trusted_response_version
    or op.resource_policy_version is distinct from p_resource_policy_version
    then raise exception 'solmind_explorer_private_operation_conflict'; end if;
  observed_fallback:=methodology.hash_json(jsonb_build_array('explorer-fallback-observation.v1',p_user_session_id,p_conversation_id,
    op.logical_operation_id,op.command_fingerprint,p_configuration_fingerprint,p_fallback_policy_version,
    p_model_policy_version,p_fallback_level,p_fallback_minor_indicated));
  if op.fallback_observation_fingerprint is distinct from observed_fallback
    then raise exception 'solmind_explorer_private_operation_conflict'; end if;
  intent:=methodology.hash_json(jsonb_build_array(p_actor_user_account_id,p_user_session_id,p_conversation_id,p_operation_id,
    op.logical_operation_id,op.message_id,op.snapshot_id,op.invocation_id,p_status,p_reply_message_id,p_reply_kind,p_reply_body,
    p_model_level,p_model_minor_indicated,p_protocol_version,p_request_mode,p_configuration_fingerprint,p_fallback_policy_version,
    p_model_policy_version,p_trusted_response_version,p_resource_policy_version,p_fallback_level,p_fallback_minor_indicated,
    p_delivery_interested,p_attention_item_id,p_choices)
    ||case when p_compass_responses is null then
      case when p_compass_suggestions is null then '[]'::jsonb else jsonb_build_array(p_compass_suggestions) end
      else jsonb_build_array('explorer-typed-compass-responses.v1',p_compass_suggestions,p_compass_responses) end
    ||case when p_waypoint_suggestion is null then '[]'::jsonb
      else jsonb_build_array('explorer-waypoint-suggestion.v1',p_waypoint_suggestion) end
    ||case when p_waypoint_response is null then '[]'::jsonb
      else jsonb_build_array('explorer-typed-waypoint-response.v1',p_waypoint_response) end
    ||case when p_failure_reason is null then '[]'::jsonb
      else jsonb_build_array('explorer-failed-reply-reason.v1',p_failure_reason) end
    ||case when p_compass_topics is null then '[]'::jsonb
      else jsonb_build_array('explorer-automatic-compass.v1',p_compass_topics) end
    ||case when p_waypoint_offer is null then '[]'::jsonb
      else jsonb_build_array('explorer-waypoint-offer.v1',p_waypoint_offer) end
    ||case when p_waypoint_offer_response is null then '[]'::jsonb
      else jsonb_build_array('explorer-typed-waypoint-offer-response.v1',p_waypoint_offer_response) end
    ||case when p_waypoint_offer_drop is null then '[]'::jsonb
      else jsonb_build_array('explorer-waypoint-offer-drop.v1',p_waypoint_offer_drop) end);
  if op.status<>'started' then
    if op.reply_message_id is not null then
      select m.content_text,m.explorer_reply_choices into saved_body,saved_choices from ai.ai_interaction_message m
        where m.ai_interaction_message_id=op.reply_message_id and m.ai_interaction_session_id=p_conversation_id;
      if not found then raise exception 'solmind_explorer_private_operation_conflict'; end if;
      saved_kind:=p_reply_kind;
    end if;
    select coalesce(op.followed_attention_item_id,o.compass_route_item_id) into followed_id from (select 1) dummy left join ai.explorer_conversation_operation o on true
      where o.actor_user_account_id=p_actor_user_account_id and o.origin_operation_id=p_operation_id;
    followed_id:=coalesce(followed_id,op.followed_attention_item_id);
    h:=methodology.hash_json(jsonb_build_array(intent,op.reply_message_id,saved_kind,saved_body,saved_choices,followed_id));
    if op.terminal_fingerprint is distinct from h then raise exception 'solmind_explorer_private_operation_conflict'; end if;
    begin
      a:=ai.solmind_private_owned_authority_v3(p_actor_user_account_id,p_user_session_id,p_conversation_id);
      may_return:=(a->>'applicationSessionExpiresAt')::timestamptz>clock_timestamp();
    exception when others then may_return:=false; end;
    return query select 'exact_replay'::text,
      case when may_return then ai.solmind_conversation_state_json(p_conversation_id) else null::jsonb end,
      case when may_return then ai.solmind_private_policy_v3(p_conversation_id) else null::jsonb end,
      op.reply_message_id is not null; return;
  end if;
  if st.pending_operation_id is distinct from p_operation_id then raise exception 'solmind_explorer_private_operation_conflict'; end if;
  perform inv.ai_model_invocation_id from ai.ai_model_invocation inv
    join ai.ai_context_snapshot sn on sn.ai_context_snapshot_id=op.snapshot_id
    join ai.ai_interaction_message msg on msg.ai_interaction_message_id=op.message_id
    join methodology.explorer_methodology_binding mb on mb.ai_context_snapshot_id=sn.ai_context_snapshot_id
    where inv.ai_model_invocation_id=op.invocation_id and inv.request_status='started'
      and inv.ai_interaction_session_id=p_conversation_id and inv.ai_context_snapshot_id=op.snapshot_id
      and inv.logical_operation_id=op.logical_operation_id and inv.dispatch_contract_version='virtual-guide-predispatch-evidence.v3'
      and inv.provider_name='openai' and inv.model_name=coalesce(op.model_name,'gpt-5.6-luna') and inv.safety_result='{}'::jsonb
      and sn.ai_interaction_session_id=p_conversation_id and sn.actor_user_account_id=p_actor_user_account_id
      and sn.application_session_id=p_user_session_id and sn.ai_interaction_message_id=op.message_id
      and sn.immediate_message_id=op.message_id and sn.evidence_contract_version=inv.dispatch_contract_version
      and sn.explorer_safety_protocol_version=op.safety_protocol_version and sn.explorer_safety_request_mode=op.safety_request_mode
      and sn.explorer_configuration_fingerprint=op.configuration_fingerprint
      and sn.fallback_policy_version=op.fallback_policy_version and sn.model_policy_version=op.model_policy_version
      and sn.trusted_response_version=op.trusted_response_version and sn.resource_policy_version=op.resource_policy_version
      and mb.methodology_context_pack_version_id=sn.methodology_context_pack_version_id
      and msg.ai_interaction_session_id=p_conversation_id and msg.sender_type='user'
      and msg.sender_user_account_id=p_actor_user_account_id and msg.sender_role_context='explorer'
    for update of inv;
  if not found then raise exception 'solmind_explorer_private_operation_conflict'; end if;
  perform ai.solmind_store_private_observation_v3(p_conversation_id,p_user_session_id,op.logical_operation_id,
    op.command_fingerprint,p_fallback_policy_version,p_model_policy_version,p_fallback_level,p_fallback_minor_indicated,
    op.invocation_id,p_model_level,p_model_minor_indicated);
  -- Full CURRENT user authority is separate from positive-preserving settlement.
  -- A denial is caught locally, preserving the approved observation outside this
  -- subtransaction; it saves/returns no private response after an expired login.
  begin
    a:=ai.solmind_private_owned_authority_v3(p_actor_user_account_id,p_user_session_id,p_conversation_id);
    may_return:=(a->>'applicationSessionExpiresAt')::timestamptz>clock_timestamp();
  exception when others then may_return:=false; end;
  select x.* into st from ai.explorer_conversation_state x where x.conversation_id=p_conversation_id;
  may_save:=may_return and p_delivery_interested and p_status='completed' and p_reply_kind<>'none'
    and case p_reply_kind
      when 'ordinary' then p_request_mode='classification_and_reply' and st.restricted_level is null
        and not st.adult_reflection_stopped
      when 'crisis' then st.restricted_level=4 and greatest(p_fallback_level,coalesce(p_model_level,0))=4
      when 'urgent' then st.restricted_level>=3 and greatest(p_fallback_level,coalesce(p_model_level,0))=3
      when 'adult_only' then st.adult_reflection_stopped and greatest(p_fallback_level,coalesce(p_model_level,0))<3
      when 'restricted' then st.restricted_level is not null and greatest(p_fallback_level,coalesce(p_model_level,0))<3
        and not st.adult_reflection_stopped
      else false end;
  -- A minor indication may accompany urgent/crisis support only when the trusted
  -- server renderer includes the adults-only boundary and verified suitable help.
  -- SQL binds that reviewed configuration/version; it does not certify semantics.
  if may_save and (a->>'applicationSessionExpiresAt')::timestamptz<=clock_timestamp() then
    may_save:=false; may_return:=false;
  end if;
  if may_save then
    select count(*)::integer into n from ai.ai_interaction_message m where m.ai_interaction_session_id=p_conversation_id;
    if n>=100 then may_save:=false; end if;
  end if;
  ts:=clock_timestamp();
  if may_save then
    saved_id:=p_reply_message_id; saved_body:=p_reply_body; saved_kind:=p_reply_kind;
    if p_reply_kind='ordinary' and p_request_mode='classification_and_reply' and st.restricted_level is null
      and not st.adult_reflection_stopped then
      if greatest(p_fallback_level,coalesce(p_model_level,0))<2
        and ai.solmind_explorer_reply_choices_valid_v2(p_choices) then saved_choices:=p_choices; end if;
      -- Invalid, foreign or combined-away targets are absent, never a failed reply.
      -- In the automatic view a model attention target must be placed. An older (legacy)
      -- conversation keeps the rule of 2026-11-03: a current point need not have a position
      -- in the saved arrangement. Forming targets are excluded in both.
      if p_attention_item_id is not null and p_attention_item_id is distinct from st.attention_id
        and not exists(select 1 from (
          select move.kind,move.completed_at,coalesce(move.compass_route_item_id,move.followed_attention_item_id) as item_id
          from ai.explorer_conversation_operation move where move.conversation_id=p_conversation_id
            and (move.compass_route_kind='attention_changed' or
              (move.kind='set_attention' and move.followed_attention_item_id is not null))
          order by move.initial_revision desc,move.operation_id desc limit 1
        ) latest where latest.kind='set_attention' and latest.item_id=st.attention_id
          and not exists(select 1 from ai.ai_interaction_message prior_reply
            where prior_reply.ai_interaction_session_id=p_conversation_id and prior_reply.sender_type='ai'
              and prior_reply.created_at>=latest.completed_at)) then
        select c.item_id,c.label,c.formation_status into followed_id,followed_label,followed_formation from ai.explorer_conversation_compass_item c
          where c.conversation_id=p_conversation_id and c.item_id=p_attention_item_id and c.merged_into_item_id is null and c.formation_status is distinct from 'rejected'
            and c.formation_status is distinct from 'proposed'
            and (st.compass_mode is distinct from 'automatic' or c.compass_anchor is not null);
      end if;
    end if;
    insert into ai.ai_interaction_message(ai_interaction_message_id,ai_interaction_session_id,sequence_number,
      sender_type,ai_role,content_text,created_at,explorer_reply_choices)
      values(saved_id,p_conversation_id,n+1,'ai','solmind_virtual_guide',saved_body,ts,saved_choices);
  end if;
  -- Observation and turn are different facts: an accepted complete
  -- classification remains a completed invocation even if prose was invalid,
  -- delivery canceled, or the operation intentionally records failed/canceled.
  update ai.ai_model_invocation set request_status=case when p_model_level is not null then 'completed' else p_status end,
    completed_at=ts,ai_interaction_message_id=saved_id,
    error_summary=case when p_failure_reason is not null then p_failure_reason
      when p_model_level is null and p_status='failed' then 'provider_unavailable' else null end
    where ai_model_invocation_id=op.invocation_id;
  if saved_id is not null and saved_kind='ordinary' and p_request_mode='classification_and_reply'
    and p_delivery_interested and st.restricted_level is null and not st.adult_reflection_stopped
    and greatest(p_fallback_level,coalesce(p_model_level,0))<2 and st.compass_mode='automatic' then
    automatic_plan:=ai.solmind_plan_automatic_compass_v1(p_actor_user_account_id,p_conversation_id,p_operation_id,saved_id,p_compass_topics);
    if followed_id is null and st.attention_id is null and jsonb_array_length(automatic_plan->'changes')>0
      and not exists(select 1 from ai.explorer_conversation_compass_item c where c.conversation_id=p_conversation_id
        and c.merged_into_item_id is null and c.formation_status is distinct from 'rejected') then
      followed_id:=(automatic_plan->'changes'->0->>'pointId')::uuid;
      followed_label:=automatic_plan->'changes'->0->>'label'; followed_formation:='automatic'; followed_is_planned:=true;
    end if;
  end if;
  -- Plan before the one terminal operation write. A deliberately set-aside
  -- same-reply competitor has no drop receipt. No offer can displace a draft
  -- suggestion supplied in this call; composition chooses the winner upstream.
  if saved_id is not null and saved_kind='ordinary' and p_waypoint_suggestion is null
    and (p_waypoint_offer is not null or p_waypoint_offer_drop is not null) then
    offered_kind:=case when p_waypoint_offer is not null then p_waypoint_offer->>'kind'
      else p_waypoint_offer_drop->>'kind' end;
    if offered_kind is null or offered_kind not in ('reached','change','revisit') then offered_kind:=null; end if;
    if p_request_mode<>'classification_and_reply'
      or not p_delivery_interested or st.restricted_level is not null or st.adult_reflection_stopped
      or greatest(p_fallback_level,coalesce(p_model_level,0))>=2 then
      offer_plan:=jsonb_build_object('kind',offered_kind,'reason','not_allowed_now');
    elsif p_waypoint_offer is not null then
      offer_plan:=ai.solmind_plan_waypoint_offer_v1(p_actor_user_account_id,p_conversation_id,p_operation_id,p_waypoint_offer);
    else
      -- The application can report an invalid optional field, never invent a
      -- saved presentation or supply any other creation-refusal conclusion.
      offer_plan:=jsonb_build_object('kind',offered_kind,'reason','invalid');
    end if;
  end if;
  h:=methodology.hash_json(jsonb_build_array(intent,saved_id,saved_kind,saved_body,saved_choices,followed_id));
  -- A first automatic point does not exist until the plan is applied below, so its
  -- needle move lives only on the single follow_attention child (replay recovers it
  -- through origin_operation_id); the fingerprint still binds followed_id.
  update ai.explorer_conversation_operation set status=p_status,completed_at=ts,terminal_fingerprint=h,reply_message_id=saved_id,
    followed_attention_item_id=case when followed_is_planned then null else followed_id end
    where actor_user_account_id=p_actor_user_account_id and operation_id=p_operation_id;
  -- The terminal operation is written once. Apply before clearing pending.
  if automatic_plan is not null then
    perform ai.solmind_apply_automatic_compass_v1(p_actor_user_account_id,p_conversation_id,p_operation_id,saved_id,automatic_plan);
  end if;
  if offer_plan is not null then
    if offer_plan ? 'reason' then
      perform ai.solmind_record_waypoint_offer_event_v1(p_actor_user_account_id,p_conversation_id,p_operation_id,
        'offer_dropped',offer_plan->>'kind',null,saved_id,offer_plan->>'reason',ts);
    else
      perform ai.solmind_apply_waypoint_offer_v1(p_actor_user_account_id,p_conversation_id,p_operation_id,saved_id,offer_plan,ts);
    end if;
  end if;
  -- Retired Compass arguments remain fingerprint-only for historical replay.
  -- One complete Waypoint proposal is independent of Compass entries and never
  -- invalidates saved prose. Existing proposed wording is refined in place.
  if saved_id is not null and saved_kind='ordinary' and p_request_mode='classification_and_reply'
    and p_delivery_interested and st.restricted_level is null and not st.adult_reflection_stopped
    and greatest(p_fallback_level,coalesce(p_model_level,0))<2 and jsonb_typeof(p_waypoint_suggestion)='object' then
    if p_waypoint_suggestion ?& array['title','destination','whyItMatters','arrivalSignal']
      and not exists(select 1 from jsonb_object_keys(p_waypoint_suggestion) k
        where k not in ('title','destination','whyItMatters','arrivalSignal'))
      and jsonb_typeof(p_waypoint_suggestion->'title')='string'
      and jsonb_typeof(p_waypoint_suggestion->'destination')='string'
      and jsonb_typeof(p_waypoint_suggestion->'whyItMatters')='string'
      and jsonb_typeof(p_waypoint_suggestion->'arrivalSignal')='string'
      and ai.solmind_waypoint_draft_text_valid(p_waypoint_suggestion->>'title')
      and ai.solmind_waypoint_draft_text_valid(p_waypoint_suggestion->>'destination')
      and ai.solmind_waypoint_draft_text_valid(p_waypoint_suggestion->>'whyItMatters')
      and ai.solmind_waypoint_draft_text_valid(p_waypoint_suggestion->>'arrivalSignal') then
      select d.waypoint_draft_id into new_draft_id from content.waypoint_draft d
        where d.source_ai_interaction_session_id=p_conversation_id and d.draft_status='proposed' for update;
      if found then
        update content.waypoint_draft d set title=p_waypoint_suggestion->>'title',
          destination=p_waypoint_suggestion->>'destination',why_it_matters=p_waypoint_suggestion->>'whyItMatters',
          arrival_signal=p_waypoint_suggestion->>'arrivalSignal',suggestion_message_id=saved_id
          where d.waypoint_draft_id=new_draft_id;
      else
        follow_bytes:=substring(extensions.digest(convert_to('explorer-waypoint-suggestion.v1|'||p_actor_user_account_id::text
          ||'|'||p_operation_id::text,'UTF8'),'sha256') from 1 for 16);
        follow_bytes:=set_byte(set_byte(follow_bytes,6,(get_byte(follow_bytes,6)&15)|80),8,(get_byte(follow_bytes,8)&63)|128);
        new_draft_id:=encode(follow_bytes,'hex')::uuid;
        insert into content.waypoint_draft(waypoint_draft_id,guide_explorer_relationship_id,source_ai_interaction_session_id,
          title,destination,why_it_matters,arrival_signal,source_message_id,suggestion_message_id)
          select new_draft_id,s.guide_explorer_relationship_id,p_conversation_id,p_waypoint_suggestion->>'title',
            p_waypoint_suggestion->>'destination',p_waypoint_suggestion->>'whyItMatters',
            p_waypoint_suggestion->>'arrivalSignal',saved_id,saved_id
          from ai.ai_interaction_session s where s.ai_interaction_session_id=p_conversation_id;
      end if;
    end if;
  end if;
  if followed_id is not null then
    follow_hash:=methodology.hash_json(jsonb_build_array('explorer-follow-attention.v1',p_actor_user_account_id,
      p_user_session_id,p_conversation_id,p_operation_id,followed_id));
    follow_bytes:=substring(extensions.digest(convert_to('explorer-follow-attention-operation.v1|'||p_actor_user_account_id::text||'|'||p_operation_id::text,'UTF8'),'sha256') from 1 for 16);
    follow_bytes:=set_byte(set_byte(follow_bytes,6,(get_byte(follow_bytes,6)&15)|80),8,(get_byte(follow_bytes,8)&63)|128);
    followed_operation_id:=encode(follow_bytes,'hex')::uuid;
    if followed_formation is distinct from 'proposed' then
    insert into ai.explorer_conversation_operation(actor_user_account_id,operation_id,application_session_id,
      conversation_id,kind,request_fingerprint,command_fingerprint,initial_revision,status,completed_at,
      compass_route_kind,compass_route_item_id,compass_route_label,origin_operation_id)
      values(p_actor_user_account_id,followed_operation_id,p_user_session_id,p_conversation_id,'follow_attention',
        follow_hash,follow_hash,st.revision,'completed',ts,'attention_changed',followed_id,followed_label,p_operation_id);
    end if;
    update ai.explorer_conversation_state set attention_id=followed_id where conversation_id=p_conversation_id;
  end if;
  update ai.explorer_conversation_state set revision=revision+1,pending_operation_id=null where conversation_id=p_conversation_id;
  -- A valid same-reply rewording wins. The current draft must still name the
  -- saved reply immediately preceding the Explorer message answered by this Send.
  if saved_id is not null and saved_kind='ordinary' and p_request_mode='classification_and_reply'
    and p_delivery_interested and st.restricted_level is null and not st.adult_reflection_stopped
    and greatest(p_fallback_level,coalesce(p_model_level,0))<2 and jsonb_typeof(p_waypoint_response)='object' then
    if p_waypoint_response ?& array['draftId','response']
      and not exists(select 1 from jsonb_object_keys(p_waypoint_response) k where k not in ('draftId','response'))
      and jsonb_typeof(p_waypoint_response->'draftId')='string'
      and jsonb_typeof(p_waypoint_response->'response')='string'
      and length(p_waypoint_response->>'draftId')=36
      and (p_waypoint_response->>'draftId') collate "C" ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      and p_waypoint_response->>'response' in ('right','close','not_it') then
      response_id:=(p_waypoint_response->>'draftId')::uuid; response_name:=p_waypoint_response->>'response';
      if response_id is distinct from new_draft_id
        and ai.solmind_waypoint_draft_typed_answer_eligible(p_conversation_id,response_id,op.message_id) then
        response_hash:=methodology.hash_json(jsonb_build_array('explorer-typed-waypoint-response.v1',p_actor_user_account_id,
          p_user_session_id,p_conversation_id,p_operation_id,response_id,response_name));
        follow_bytes:=substring(extensions.digest(convert_to('explorer-typed-waypoint-response.v1|'||p_actor_user_account_id::text
          ||'|'||p_operation_id::text||'|'||response_id::text,'UTF8'),'sha256') from 1 for 16);
        follow_bytes:=set_byte(set_byte(follow_bytes,6,(get_byte(follow_bytes,6)&15)|80),8,(get_byte(follow_bytes,8)&63)|128);
        response_operation_id:=encode(follow_bytes,'hex')::uuid;
        -- This helper reads the post-Send revision for the receipt and guard.
        -- At either bound it returns false without inserting a receipt.
        draft_applied:=ai.solmind_apply_waypoint_draft_response(p_actor_user_account_id,p_user_session_id,p_conversation_id,
          response_operation_id,response_hash,response_hash,response_id,response_name,ts,true);
      end if;
    end if;
  end if;
  -- Typed answers share exactly the server eligibility fact exposed to the
  -- screen. The owner lock keeps the presentation and target fixed while checked.
  -- An applied draft answer takes precedence over an offer answer.
  if not draft_applied and saved_id is not null and saved_kind='ordinary'
    and p_request_mode='classification_and_reply' and p_delivery_interested
    and st.restricted_level is null and not st.adult_reflection_stopped
    and greatest(p_fallback_level,coalesce(p_model_level,0))<2
    and p_waypoint_suggestion is null and p_waypoint_offer is null
    and jsonb_typeof(p_waypoint_offer_response)='object' then
    if p_waypoint_offer_response ?& array['offerId','response']
      and not exists(select 1 from jsonb_object_keys(p_waypoint_offer_response) k where k not in ('offerId','response'))
      and jsonb_typeof(p_waypoint_offer_response->'offerId')='string'
      and jsonb_typeof(p_waypoint_offer_response->'response')='string'
      and length(p_waypoint_offer_response->>'offerId')=36
      and (p_waypoint_offer_response->>'offerId') collate "C" ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      and p_waypoint_offer_response->>'response' in ('right','close','not_it') then
      response_id:=(p_waypoint_offer_response->>'offerId')::uuid;
      response_name:=p_waypoint_offer_response->>'response';
      if ai.solmind_waypoint_offer_typed_answer_eligible(p_conversation_id,response_id,op.message_id) then
        select x.* into answered_offer from content.waypoint_offer x
          where x.source_ai_interaction_session_id=p_conversation_id and x.waypoint_offer_id=response_id;
        if answered_offer.offer_kind<>'reached' or response_name<>'close' then
          response_hash:=methodology.hash_json(jsonb_build_array('explorer-typed-waypoint-offer-response.v1',
            p_actor_user_account_id,p_user_session_id,p_conversation_id,p_operation_id,response_id,response_name));
          follow_bytes:=substring(extensions.digest(convert_to('explorer-typed-waypoint-offer-response.v1|'||
            p_actor_user_account_id::text||'|'||p_operation_id::text||'|'||response_id::text,'UTF8'),'sha256') from 1 for 16);
          follow_bytes:=set_byte(set_byte(follow_bytes,6,(get_byte(follow_bytes,6)&15)|80),8,(get_byte(follow_bytes,8)&63)|128);
          response_operation_id:=encode(follow_bytes,'hex')::uuid;
          offer_result:=ai.solmind_apply_waypoint_offer_response_v1(p_actor_user_account_id,p_user_session_id,
            p_conversation_id,response_operation_id,response_hash,response_hash,response_id,response_name,ts,true);
          if offer_result in ('history_limit','active_limit','target_changed') then
            perform ai.solmind_record_waypoint_offer_event_v1(p_actor_user_account_id,p_conversation_id,p_operation_id,
              'typed_answer_refused',answered_offer.offer_kind,response_id,answered_offer.suggestion_message_id,offer_result,ts);
          end if;
        end if;
      end if;
    end if;
  end if;
  update ai.ai_interaction_session set last_activity_at=ts where ai_interaction_session_id=p_conversation_id;
  if may_return and (a->>'applicationSessionExpiresAt')::timestamptz<=clock_timestamp() then
    -- Do not raise after accepting a positive. A saved reply's authority was
    -- checked immediately before its insert under the locked current facts.
    may_return:=false;
  end if;
  return query select case when saved_id is not null or p_reply_kind='none' then 'ok' else 'withheld' end,
    case when may_return then ai.solmind_conversation_state_json(p_conversation_id) else null::jsonb end,
    case when may_return then ai.solmind_private_policy_v3(p_conversation_id) else null::jsonb end,
    saved_id is not null;
end $$;
alter function public.solmind_settle_explorer_conversation_turn_v4(uuid,uuid,uuid,uuid,text,uuid,text,text,smallint,boolean,text,text,text,text,text,text,text,smallint,boolean,boolean,uuid,jsonb,jsonb,jsonb,jsonb,jsonb,text,jsonb,jsonb,jsonb,jsonb) owner to postgres;
revoke all on function public.solmind_settle_explorer_conversation_turn_v4(uuid,uuid,uuid,uuid,text,uuid,text,text,smallint,boolean,text,text,text,text,text,text,text,smallint,boolean,boolean,uuid,jsonb,jsonb,jsonb,jsonb,jsonb,text,jsonb,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.solmind_settle_explorer_conversation_turn_v4(uuid,uuid,uuid,uuid,text,uuid,text,text,smallint,boolean,text,text,text,text,text,text,text,smallint,boolean,boolean,uuid,jsonb,jsonb,jsonb,jsonb,jsonb,text,jsonb,jsonb,jsonb,jsonb) to service_role;

-- Restated from 20261111000000_explorer_automatic_compass_v1.sql (latest definition).
create or replace function ai.solmind_conversation_state_json(p_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('version','explorer-conversation.v1','conversationId',p_id,
    'revision',coalesce(s.revision,0),'providerState','unavailable',
    'pendingTurn',s.pending_operation_id is not null,
    'compassMode',coalesce(s.compass_mode,'automatic'),
    'compassChanges',coalesce((select jsonb_agg(jsonb_build_object('operationId',b.operation_id,
      'replyMessageId',b.reply_message_id,'revision',b.revision,'changes',
      (select jsonb_agg(jsonb_build_object('kind',c->>'kind','pointId',c->>'pointId','label',c->>'label',
        'anchor',c->>'anchor','noticeKind',c->>'noticeKind') order by ord)
        from jsonb_array_elements(b.changes) with ordinality entries(c,ord))) order by b.revision,b.operation_id)
      from ai.explorer_compass_change_bundle b where b.conversation_id=p_id),'[]'::jsonb),
    'turnedDownLimitReached',(select count(*)>=24 from ai.explorer_conversation_compass_item c
      where c.conversation_id=p_id and c.formation_status='rejected'),
    'sessionStatus',session_row.session_status,
    'ending',(select jsonb_build_object('operationId',e.operation_id,'revision',e.initial_revision+1,
      'endedAt',e.completed_at,'directionsTaken',e.ending_directions_text,'routeThroughRevision',e.ending_route_revision)
      from ai.explorer_conversation_operation e where e.conversation_id=p_id and e.kind='end_conversation' and e.status='completed'),
    'messages',coalesce((select jsonb_agg(jsonb_build_object('id',m.ai_interaction_message_id,
      'role',case when m.sender_type='user' then 'explorer' else 'virtualGuide' end,
      'body',m.content_text,'createdAt',m.created_at)
      || case when m.explorer_reply_choices is null then '{}'::jsonb else jsonb_build_object('choices',m.explorer_reply_choices) end
      order by m.sequence_number)
      from ai.ai_interaction_message m where m.ai_interaction_session_id=p_id and m.sender_type in ('user','ai')),'[]'::jsonb),
    'compassItems',coalesce((select jsonb_agg(jsonb_build_object('id',c.item_id,'sourceMessageId',c.source_message_id,
      'label',c.label,'anchor',c.compass_anchor,'emphasis',c.relative_emphasis,'mergedIntoItemId',c.merged_into_item_id,'formation',case when c.formation_status='proposed' then 'forming' when c.formation_status='automatic' then 'automatic' else 'saved' end)
      || case when c.formation_status='automatic' then jsonb_build_object('topicId',c.automatic_topic_id) else '{}'::jsonb end
      || case when c.formation_status='proposed' then jsonb_build_object('wordingMessageId',c.wording_message_id) else '{}'::jsonb end
      order by c.display_order) from ai.explorer_conversation_compass_item c where c.conversation_id=p_id and c.formation_status is distinct from 'rejected'),'[]'::jsonb),
    'priorityId',s.priority_id,'attentionId',s.attention_id,
    'route',coalesce((select jsonb_agg(case when o.compass_route_kind='category_confirmed' then
      jsonb_build_object('operationId',o.operation_id,'revision',o.initial_revision+1,'kind',o.compass_route_kind,
        'change',o.compass_category_change,'recordedAt',o.completed_at)
      when o.compass_route_kind='arrangement_confirmed' then
      jsonb_build_object('operationId',o.operation_id,'revision',o.initial_revision+1,'kind',o.compass_route_kind,
        'previousPriorityId',o.compass_arrangement->'previousPriorityId','priorityId',o.compass_arrangement->'priorityId',
        'items',o.compass_arrangement->'items','recordedAt',o.completed_at)
      else jsonb_build_object('operationId',o.operation_id,
        'revision',o.initial_revision+1,'kind',o.compass_route_kind,'compassItemId',o.compass_route_item_id,
        'label',o.compass_route_label,'recordedAt',o.completed_at)
        || case when o.compass_route_kind='attention_changed' then jsonb_build_object('actor',
          case when o.kind='follow_attention' then 'virtual_guide' else 'explorer' end) else '{}'::jsonb end
      end order by o.initial_revision,o.operation_id)
      from ai.explorer_conversation_operation o where o.conversation_id=p_id and o.compass_route_kind is not null),'[]'::jsonb),
    'waypointDraft',(select jsonb_build_object('id',d.waypoint_draft_id,'title',d.title,
      'destination',d.destination,'whyItMatters',d.why_it_matters,'arrivalSignal',d.arrival_signal,
      'suggestionMessageId',d.suggestion_message_id,
      'typedAnswerEligible',ai.solmind_waypoint_draft_typed_answer_eligible(p_id,d.waypoint_draft_id))
      from content.waypoint_draft d
      where d.source_ai_interaction_session_id=p_id and d.draft_status='proposed'),
    'waypointOffer',(select jsonb_build_object('id',o.waypoint_offer_id,'kind',o.offer_kind,
      'status',o.offer_status,'waypointId',o.target_waypoint_id,
      'targetBefore',jsonb_build_object('title',o.target_title,'destination',o.target_destination,
        'whyItMatters',o.target_why_it_matters,'arrivalSignal',o.target_arrival_signal,
        'stage',case when o.target_stage='chosen' then 'formed' else o.target_stage end),
      'suggestionMessageId',o.suggestion_message_id,'resultWaypointId',o.result_waypoint_id,
      'targetCurrent',exists(select 1 from content.waypoint w where w.waypoint_id=o.target_waypoint_id
        and w.source_ai_interaction_session_id=p_id and w.chosen_by_explorer_user_account_id=s.actor_user_account_id
        and not exists(select 1 from content.waypoint successor where successor.predecessor_waypoint_id=w.waypoint_id)
        and (w.title,w.destination,w.why_it_matters,w.arrival_signal,
          case when w.released_at is not null then 'released' else w.lifecycle_status end)
          is not distinct from (o.target_title,o.target_destination,o.target_why_it_matters,o.target_arrival_signal,o.target_stage)),
      'typedAnswerEligible',ai.solmind_waypoint_offer_typed_answer_eligible(p_id,o.waypoint_offer_id),
      'typedAnswerRefusal',case when o.offer_status='proposed' then
        (select e.reason from ai.explorer_waypoint_offer_event e
          where e.conversation_id=p_id and e.waypoint_offer_id=o.waypoint_offer_id
            and e.event_kind='typed_answer_refused' and e.suggestion_message_id=o.suggestion_message_id
          order by e.created_at desc,e.event_id desc limit 1) else null end)
      || case when o.offer_kind='reached' then jsonb_build_object('evidence',o.evidence)
        else jsonb_build_object('title',o.title,'destination',o.destination,
          'whyItMatters',o.why_it_matters,'arrivalSignal',o.arrival_signal) end
      from content.waypoint_offer o join ai.ai_interaction_message m
        on m.ai_interaction_message_id=o.suggestion_message_id
      where o.source_ai_interaction_session_id=p_id
      order by (o.offer_status='proposed') desc,m.sequence_number desc,o.waypoint_offer_id desc limit 1),
    'waypointOfferDrop',(select jsonb_build_object('kind',e.offer_kind,'reason',e.reason)
      from ai.explorer_waypoint_offer_event e where e.conversation_id=p_id and e.event_kind='offer_dropped'
        and e.suggestion_message_id=(select m.ai_interaction_message_id from ai.ai_interaction_message m
          where m.ai_interaction_session_id=p_id and m.sender_type='ai' and m.ai_role='solmind_virtual_guide'
          order by m.sequence_number desc limit 1)
      order by e.created_at desc,e.event_id desc limit 1),
    'reachedOfferedWaypointIds',coalesce((select jsonb_agg(w.waypoint_id
      order by case when w.lifecycle_status='chosen' and w.released_at is null then 0 else 1 end,w.created_at desc,w.waypoint_id)
      from (select h.* from content.waypoint h where h.source_ai_interaction_session_id=p_id
        and not exists(select 1 from content.waypoint successor where successor.predecessor_waypoint_id=h.waypoint_id)
        order by case when h.lifecycle_status='chosen' and h.released_at is null then 0 else 1 end,h.created_at desc,h.waypoint_id
        limit 20) w where exists(select 1 from content.waypoint_offer o
          where o.source_ai_interaction_session_id=p_id and o.offer_kind='reached'
            and o.lineage_root_waypoint_id=ai.solmind_waypoint_lineage_root_v1(w.waypoint_id))),'[]'::jsonb),
    'waypointCapacity',case when s.actor_user_account_id is null then null
      else ai.solmind_waypoint_capacity_v1(s.actor_user_account_id,p_id) end,
    'waypointProjection',jsonb_build_object('kind','current_heads','limit',20,
      'totalHeads',(select count(*) from content.waypoint w where w.source_ai_interaction_session_id=p_id
        and not exists(select 1 from content.waypoint successor where successor.predecessor_waypoint_id=w.waypoint_id)),
      'hasMore',(select count(*)>20 from content.waypoint w where w.source_ai_interaction_session_id=p_id
        and not exists(select 1 from content.waypoint successor where successor.predecessor_waypoint_id=w.waypoint_id))),
    'waypoints',coalesce((select jsonb_agg(ai.solmind_waypoint_row_json_v1(w.waypoint_id,false)
      order by case when w.lifecycle_status='chosen' and w.released_at is null then 0 else 1 end,w.created_at desc,w.waypoint_id)
      from (select h.* from content.waypoint h where h.source_ai_interaction_session_id=p_id
        and not exists(select 1 from content.waypoint successor where successor.predecessor_waypoint_id=h.waypoint_id)
        order by case when h.lifecycle_status='chosen' and h.released_at is null then 0 else 1 end,h.created_at desc,h.waypoint_id
        limit 20) w),'[]'::jsonb))
  from (select 1) anchor left join ai.explorer_conversation_state s on s.conversation_id=p_id
    left join ai.ai_interaction_session session_row on session_row.ai_interaction_session_id=s.conversation_id
$$;

-- Restated from 20261111000000_explorer_automatic_compass_v1.sql (latest definition).
create or replace function ai.solmind_inspect_explorer_context_v3(
  p_actor_user_account_id uuid,p_user_session_id uuid,p_explorer_profile_id uuid,
  p_relationship_id uuid,p_conversation_id uuid,p_context_serialization text,p_context_source_ids uuid[],
  p_reply_choice boolean default false
) returns table(outcome text,excluded_entity_type text,excluded_entity_id uuid)
language plpgsql volatile security invoker set search_path='' set lock_timeout='2000ms' as $$
declare
  envelope json; part json; item json; immediate json; intake core.intake_response_set%rowtype;
  expected_fields text[]; actual_ids uuid[]; expected_ids uuid[]; history jsonb;
  source_hashes text[]; source_lower text[]; context_strings text[];
  immediate_id uuid; methodology_id uuid; cell record; capability_row record; seen integer:=0;
  total_bytes bigint:=0; field_index integer:=0; max_bytes integer; matched boolean; metadata_root record; metadata_roots integer:=0;
  winner_type text; winner_id uuid; winner_key text; candidate_key text;
  unknown_match boolean:=false; private_owner regclass; private_id uuid;
  compass_mode text; compass_topics jsonb; compass_refs jsonb; compass_capacity jsonb;
  topic_ids uuid[]; support_ids uuid[];
  compass_priority uuid; compass_attention uuid; compass_points jsonb; compass_route jsonb; compass_waypoints jsonb;
  point_ids uuid[]; waypoint_ids uuid[]; draft_ids uuid[]; compass_drafts jsonb; policy jsonb; classification_only boolean;
  offer_ids uuid[]; compass_offers jsonb; reached_offered_waypoint_ids jsonb;
begin
  outcome:='unavailable'; excluded_entity_type:=null; excluded_entity_id:=null;
  if p_reply_choice is null or pg_catalog.current_setting('transaction_isolation') is distinct from 'read committed'
    or p_actor_user_account_id is null or p_user_session_id is null or p_explorer_profile_id is null
    or p_relationship_id is null or p_conversation_id is null or p_context_serialization is null
    or pg_catalog.octet_length(p_context_serialization) not between 2 and 524288
    or p_context_source_ids is null or pg_catalog.cardinality(p_context_source_ids) not between 3 and 169
    or pg_catalog.array_position(p_context_source_ids,null) is not null
  then return next; return; end if;
  select pg_catalog.array_agg(distinct x order by x) into actual_ids from pg_catalog.unnest(p_context_source_ids) x;
  if actual_ids is distinct from p_context_source_ids then return next; return; end if;
  -- Prepare already holds the state lock and has applied the current fallback
  -- observation. Derive the mode from that authoritative state, never the envelope.
  policy:=ai.solmind_private_policy_v3(p_conversation_id);
  if policy->'known' is distinct from 'true'::jsonb then return next; return; end if;
  classification_only:=policy->>'restrictedLevel' is not null or (policy->>'adultReflectionStopped')::boolean;
  envelope:=p_context_serialization::json;
  if not ai.solmind_exclusion_keys_v3(envelope,array['contractVersion','aiRole','actorRoleContext','globalPolicy',
    'roleBehavior','crisisBehavior','methodologyContext','sessionContext','approvedContinuity']
    ||case when classification_only then array[]::text[] else array['compassContext'] end
    ||array['currentSessionMessages','immediateExplorerMessage','outputRequirements'])
    or envelope->>'contractVersion' is distinct from (case when classification_only
      then 'wi007-v0.1+onboarding-fields-v2' else 'wi007-v0.1+onboarding-fields-v2+compass-v9' end)
    or envelope->>'aiRole' is distinct from 'solmind_virtual_guide'
    or envelope->>'actorRoleContext' is distinct from 'explorer'
    -- Strip complete JSON string tokens first; whitespace outside them is not
    -- part of the exact compact assembler serialization.
    or pg_catalog.regexp_replace(p_context_serialization,'"([^"\\]|\\.)*"','""','g') ~ '[[:space:]]'
  then return next; return; end if;
  select pg_catalog.array_agg(s.field_text order by s.field_path) into context_strings
    from ai.solmind_exclusion_strings_v3(envelope) s;
  if context_strings is null then return next; return; end if;

  -- Root owns the full locked consent/configuration/role authority check. These
  -- additional real-row checks bind the internal source/audit operation and do
  -- not call the old ordinary-reflection-only restricted-mode authority helper.
  if not exists(select 1 from identity.user_account a
    join identity.user_role_assignment ra on ra.user_account_id=a.user_account_id
    join identity.user_session u on u.user_account_id=a.user_account_id
    join core.explorer_profile e on e.user_account_id=a.user_account_id
    join core.guide_explorer_relationship r on r.explorer_profile_id=e.explorer_profile_id
    join ai.ai_interaction_session s on s.actor_user_account_id=a.user_account_id
      and s.explorer_profile_id=e.explorer_profile_id and s.guide_explorer_relationship_id=r.guide_explorer_relationship_id
    where a.user_account_id=p_actor_user_account_id and a.account_status='active'
      and ra.role_code='explorer' and ra.role_status='active' and ra.revoked_at is null and ra.granted_at<=clock_timestamp()
      and u.user_session_id=p_user_session_id and u.active_role_context='explorer' and u.session_status='active'
      and u.ended_at is null and u.expires_at>clock_timestamp()
      and e.explorer_profile_id=p_explorer_profile_id and e.status='active' and e.onboarding_status='active'
      and r.guide_explorer_relationship_id=p_relationship_id and r.relationship_status in ('active','paused')
      and s.ai_interaction_session_id=p_conversation_id and s.session_type='explorer_reflection'
      and s.actor_role_context='explorer' and s.session_status='active'
      and s.guide_profile_id=r.guide_profile_id and s.practice_id=r.practice_id)
    or (select count(*) from identity.user_session u where u.user_account_id=p_actor_user_account_id and u.session_status='active')<>1
  then return next; return; end if;

  part:=envelope->'sessionContext';
  if not ai.solmind_exclusion_keys_v3(part,array['sessionType','explorerId','sessionId','continuityBindingId',
      'explorerDisplayName','activeFocusItems','nextAppointment','explorerSafeGuardrail'])
    or part->>'sessionType' is distinct from 'explorer_virtual_guide'
    or part->>'explorerId' is distinct from p_explorer_profile_id::text
    or part->>'sessionId' is distinct from p_conversation_id::text
    or part->>'continuityBindingId' is distinct from p_relationship_id::text
    or (part->'explorerDisplayName')::text is distinct from 'null'
    or (part->'nextAppointment')::text is distinct from 'null'
    or (part->'explorerSafeGuardrail')::text is distinct from 'null'
    or (part->'activeFocusItems')::text is distinct from '[]'
  then return next; return; end if;
  foreach winner_type in array array['globalPolicy','roleBehavior','crisisBehavior','methodologyContext'] loop
    part:=envelope->winner_type;
    if not ai.solmind_exclusion_keys_v3(part,array['version','text'])
      or pg_catalog.json_typeof(part->'version') is distinct from 'string'
      or pg_catalog.json_typeof(part->'text') is distinct from 'string'
      or pg_catalog.char_length(part->>'version') not between 1 and 64
      or (part->>'version') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]*$'
      or pg_catalog.char_length(part->>'text') not between 1 and (case when winner_type='methodologyContext' then 24000 when winner_type='roleBehavior' then 25000 else 20000 end)
      or ai.solmind_exclusion_normalize_v3(part->>'text') is distinct from part->>'text'
    then return next; return; end if;
  end loop;
  winner_type:=null;
  if envelope->'methodologyContext'->>'version' !~ '^methodology:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then return next; return; end if;
  methodology_id:=pg_catalog.substr(envelope->'methodologyContext'->>'version',13)::uuid;
  part:=envelope->'outputRequirements';
  if not ai.solmind_exclusion_keys_v3(part,array['format','includeCitations','allowMarkdown'])
    or part->>'format' is distinct from 'plain_text' or (part->'includeCitations')::text is distinct from 'false'
    or (part->'allowMarkdown')::text is distinct from 'false'
  then return next; return; end if;
  immediate:=envelope->'immediateExplorerMessage';
  if not ai.solmind_exclusion_keys_v3(immediate,array['messageId','explorerId','sessionId','role','content'])
    or immediate->>'explorerId' is distinct from p_explorer_profile_id::text
    or immediate->>'sessionId' is distinct from p_conversation_id::text or immediate->>'role' is distinct from 'explorer'
    or pg_catalog.json_typeof(immediate->'content') is distinct from 'string'
    or not ai.solmind_conversation_text_valid(immediate->>'content',8192,false)
    or immediate->>'content' is distinct from ai.solmind_exclusion_normalize_v3(immediate->>'content')
    or immediate->>'messageId' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  then return next; return; end if;
  immediate_id:=(immediate->>'messageId')::uuid;
  if exists(select 1 from ai.ai_interaction_message m where m.ai_interaction_message_id=immediate_id)
    then return next; return; end if;

  select x.* into intake from core.intake_response_set x
    where x.guide_explorer_relationship_id=p_relationship_id and x.intake_status='completed'
    order by x.completed_at desc,x.intake_response_set_id desc limit 1;
  if not found or intake.completed_at is null or intake.completed_at>clock_timestamp()
    or pg_catalog.jsonb_typeof(intake.response_json) is distinct from 'object'
  then return next; return; end if;
  expected_ids:=array[immediate_id,intake.intake_response_set_id,methodology_id];
  select pg_catalog.array_agg(f.name order by f.ord) into expected_fields
  from pg_catalog.unnest(array['supportNow','usefulOutcome','supportStyle','guideContext','communicationPreference','doNotEmphasize'])
    with ordinality f(name,ord)
  where f.ord<=3 or pg_catalog.char_length(ai.solmind_exclusion_normalize_v3(coalesce(intake.response_json->>f.name,'')))>0;
  if pg_catalog.json_typeof(envelope->'approvedContinuity') is distinct from 'array'
    or pg_catalog.json_array_length(envelope->'approvedContinuity')<>pg_catalog.cardinality(expected_fields)
  then return next; return; end if;
  field_index:=0;
  for item in select value from pg_catalog.json_array_elements(envelope->'approvedContinuity') loop
    field_index:=field_index+1;
    if not ai.solmind_exclusion_keys_v3(item,array['sourceId','order','kind','field','content'])
      or item->>'sourceId' is distinct from intake.intake_response_set_id::text
      or item->>'order' is distinct from (field_index-1)::text or pg_catalog.json_typeof(item->'order') is distinct from 'number'
      or item->>'kind' is distinct from 'onboarding_answer' or item->>'field' is distinct from expected_fields[field_index]
      or pg_catalog.json_typeof(item->'content') is distinct from 'string'
      or pg_catalog.jsonb_typeof(intake.response_json->expected_fields[field_index]) is distinct from 'string'
      or item->>'content' is distinct from ai.solmind_exclusion_normalize_v3(intake.response_json->>expected_fields[field_index])
      or pg_catalog.char_length(item->>'content') not between 1 and 2000
    then return next; return; end if;
  end loop;
  if exists(select 1 from ai.ai_interaction_message m where m.ai_interaction_session_id=p_conversation_id and
    ((m.sender_type='user' and m.sender_user_account_id=p_actor_user_account_id and m.sender_role_context='explorer')
      or (m.sender_type='ai' and m.ai_role='solmind_virtual_guide' and m.sender_user_account_id is null)) is not true)
  then return next; return; end if;
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'messageId',h.ai_interaction_message_id,'order',h.ord-1,'explorerId',p_explorer_profile_id,'sessionId',p_conversation_id,
    'role',case when h.sender_type='user' then 'explorer' else 'solmind_virtual_guide' end,
    'content',ai.solmind_exclusion_normalize_v3(h.content_text)) order by h.ord),'[]'::jsonb),
    expected_ids||coalesce(pg_catalog.array_agg(h.ai_interaction_message_id order by h.ord),array[]::uuid[])
    into history,expected_ids
  from (select x.*,pg_catalog.row_number() over(order by x.sequence_number) as ord
    from (select m.* from ai.ai_interaction_message m where m.ai_interaction_session_id=p_conversation_id
      order by m.sequence_number desc limit 24) x) h;
  if envelope->'currentSessionMessages' is null or (envelope->'currentSessionMessages')::jsonb is distinct from history
    then return next; return; end if;

  if not classification_only then
  -- The saved Compass and Waypoint section (chat step slice S3), rebuilt exactly from the saved rows.
  -- Current points: not combined into another point, in display order. Priority and attention are the
  -- state's own values. The Route gives only needle moves (attention_changed) on a current point, the
  -- last five by (initial revision, operation), oldest first, each with that point's current normalized
  -- label, never the label the Route captured (it may be wording from before a rename); Priority changes,
  -- arrangement and category snapshots (and their before-labels) never enter model context. Waypoints:
  -- current heads only.
  select s.compass_mode,null::uuid,s.attention_id into compass_mode,compass_priority,compass_attention
    from ai.explorer_conversation_state s where s.conversation_id=p_conversation_id;
  if not found then return next; return; end if;
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id',c.item_id,
      'label',ai.solmind_exclusion_normalize_v3(c.label),'order',c.ord-1,'formation',case when c.formation_status='automatic' then 'automatic' else 'saved' end,
      'anchor',c.compass_anchor,'emphasis',c.relative_emphasis)
 order by c.ord),'[]'::jsonb),
    coalesce(pg_catalog.array_agg(c.item_id order by c.ord),array[]::uuid[])
    into compass_points,point_ids
  from (select x.*,pg_catalog.row_number() over(order by x.display_order) as ord
    from ai.explorer_conversation_compass_item x
    where x.conversation_id=p_conversation_id and x.merged_into_item_id is null and x.formation_status is distinct from 'rejected' and x.formation_status is distinct from 'proposed') c;
  if compass_attention is not null and not compass_attention=any(point_ids) then compass_attention:=null; end if;
  -- Retain forming-move chronology to suppress older acknowledgments, while
  -- excluding forming points and their transient moves from v9.
  with moves as (
    select o.kind,o.completed_at,coalesce(o.compass_route_kind,'attention_changed') as compass_route_kind,
      coalesce(o.compass_route_item_id,o.followed_attention_item_id) as compass_route_item_id,
      o.initial_revision,o.operation_id,o.compass_route_kind is null as deferred
    from ai.explorer_conversation_operation o
    where o.conversation_id=p_conversation_id and (o.compass_route_kind='attention_changed'
      or (o.kind='set_attention' and o.followed_attention_item_id is not null
        and not exists(select 1 from ai.explorer_conversation_operation materialized
          where materialized.actor_user_account_id=o.actor_user_account_id and materialized.origin_operation_id=o.operation_id)))
  ), eligible as (
    select o.*,c.label as current_label,c.formation_status,
      o.kind='set_attention'
        and o.compass_route_item_id=compass_attention
        and o.operation_id=(select last_move.operation_id from moves last_move
          order by last_move.initial_revision desc,last_move.operation_id desc limit 1)
        and not exists(select 1 from ai.ai_interaction_message reply where reply.ai_interaction_session_id=p_conversation_id
          and reply.sender_type='ai' and reply.created_at>=o.completed_at) as awaiting_reply
    from moves o join ai.explorer_conversation_compass_item c on c.conversation_id=p_conversation_id
      and c.item_id=o.compass_route_item_id and c.merged_into_item_id is null and c.formation_status is distinct from 'rejected'
  )
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('kind',r.compass_route_kind,
      'pointId',r.compass_route_item_id,'label',ai.solmind_exclusion_normalize_v3(r.current_label),
      'actor',case when r.kind='follow_attention' then 'virtual_guide' else 'explorer' end,
      'awaitingReply',r.awaiting_reply)
      order by r.initial_revision,r.operation_id),'[]'::jsonb)
    into compass_route
  from (select * from eligible e where e.formation_status is distinct from 'proposed'
    order by e.initial_revision desc,e.operation_id desc limit 5) r;
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id',w.waypoint_id,
      'title',ai.solmind_exclusion_normalize_v3(w.title),'destination',ai.solmind_exclusion_normalize_v3(w.destination),
      'meaning',ai.solmind_exclusion_normalize_v3(w.why_it_matters),'arrivalSignal',ai.solmind_exclusion_normalize_v3(w.arrival_signal),
      'stage',case when w.lifecycle_status='reached' then 'reached' when w.released_at is not null then 'released' else 'formed' end,
      'reachedEvidence',case when w.lifecycle_status='reached' then ai.solmind_exclusion_normalize_v3(w.reached_evidence) end)
      order by case when w.lifecycle_status='chosen' and w.released_at is null then 0 else 1 end,w.created_at desc,w.waypoint_id),'[]'::jsonb),
    coalesce(pg_catalog.array_agg(w.waypoint_id order by case when w.lifecycle_status='chosen' and w.released_at is null then 0 else 1 end,w.created_at desc,w.waypoint_id),array[]::uuid[])
    into compass_waypoints,waypoint_ids
  from (select h.* from content.waypoint h where h.source_ai_interaction_session_id=p_conversation_id
    and not exists(select 1 from content.waypoint successor where successor.predecessor_waypoint_id=h.waypoint_id)
    order by case when h.lifecycle_status='chosen' and h.released_at is null then 0 else 1 end,h.created_at desc,h.waypoint_id
    limit 20) w;
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id',d.waypoint_draft_id,
      'title',ai.solmind_exclusion_normalize_v3(d.title),'destination',ai.solmind_exclusion_normalize_v3(d.destination),
      'whyItMatters',ai.solmind_exclusion_normalize_v3(d.why_it_matters),
      'arrivalSignal',ai.solmind_exclusion_normalize_v3(d.arrival_signal),
      'suggestedInPreviousReply',coalesce(d.suggestion_message_id=(select m.ai_interaction_message_id
        from ai.ai_interaction_message m where m.ai_interaction_session_id=p_conversation_id
          and m.sender_type='ai' and m.ai_role='solmind_virtual_guide'
        order by m.sequence_number desc limit 1),false))),'[]'::jsonb),
    coalesce(pg_catalog.array_agg(d.waypoint_draft_id),array[]::uuid[]) into compass_drafts,draft_ids
  from content.waypoint_draft d where d.source_ai_interaction_session_id=p_conversation_id and d.draft_status='proposed';
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id',o.waypoint_offer_id,'kind',o.offer_kind,'waypointId',o.target_waypoint_id,
      'stage',case when o.target_stage='chosen' then 'formed' else o.target_stage end,
      'suggestedInPreviousReply',coalesce(o.suggestion_message_id=(select m.ai_interaction_message_id
        from ai.ai_interaction_message m where m.ai_interaction_session_id=p_conversation_id
          and m.sender_type='ai' and m.ai_role='solmind_virtual_guide'
        order by m.sequence_number desc limit 1),false))
      || case when o.offer_kind='reached' then jsonb_build_object('evidence',ai.solmind_exclusion_normalize_v3(o.evidence))
        else jsonb_build_object('title',ai.solmind_exclusion_normalize_v3(o.title),
          'destination',ai.solmind_exclusion_normalize_v3(o.destination),
          'whyItMatters',ai.solmind_exclusion_normalize_v3(o.why_it_matters),
          'arrivalSignal',ai.solmind_exclusion_normalize_v3(o.arrival_signal)) end),'[]'::jsonb),
    coalesce(pg_catalog.array_agg(o.waypoint_offer_id),array[]::uuid[]) into compass_offers,offer_ids
    from content.waypoint_offer o where o.source_ai_interaction_session_id=p_conversation_id
      and o.offer_status='proposed';
  select coalesce(jsonb_agg(w.id order by w.ord),'[]'::jsonb) into reached_offered_waypoint_ids
    from unnest(waypoint_ids) with ordinality w(id,ord) where exists(select 1 from content.waypoint_offer o
      where o.source_ai_interaction_session_id=p_conversation_id and o.offer_kind='reached'
        and o.lineage_root_waypoint_id=ai.solmind_waypoint_lineage_root_v1(w.id));
  select coalesce(jsonb_agg(jsonb_build_object('ref','h'||(m->>'order'),'order',(m->>'order')::integer)
    order by (m->>'order')::integer),'[]'::jsonb) into compass_refs
    from jsonb_array_elements(history) m where m->>'role'='explorer';
  select coalesce(jsonb_agg(jsonb_build_object('id',t.topic_id,'label',t.label,
    'pointId',(select c.item_id from ai.explorer_conversation_compass_item c where c.automatic_topic_id=t.topic_id),
    'supportCount',(select count(*) from ai.explorer_compass_topic_support e where e.topic_id=t.topic_id),
    'countedRefs',(select coalesce(jsonb_agg('h'||(m->>'order') order by (m->>'order')::integer),'[]'::jsonb)
      from jsonb_array_elements(history) m where m->>'role'='explorer' and exists(select 1
        from ai.explorer_compass_topic_support e where e.topic_id=t.topic_id and e.support_message_id::text=m->>'messageId')))
      order by t.topic_slot),'[]'::jsonb),coalesce(array_agg(t.topic_id order by t.topic_slot),array[]::uuid[])
    into compass_topics,topic_ids from ai.explorer_compass_topic t
    where t.conversation_id=p_conversation_id and compass_mode='automatic';
  select coalesce(array_agg(distinct e.support_message_id),array[]::uuid[]) into support_ids
    from ai.explorer_compass_topic_support e where e.conversation_id=p_conversation_id and compass_mode='automatic';
  compass_capacity:=case when compass_mode='automatic' then jsonb_build_object(
    'originalsRemaining',greatest(0,24-(select count(*) from ai.explorer_conversation_compass_item c
      where c.conversation_id=p_conversation_id and c.formation_status is distinct from 'rejected')),
    'topicSlotsRemaining',greatest(0,24-cardinality(topic_ids)),
    'visibleSlotsRemaining',greatest(0,8-cardinality(point_ids)))
    else jsonb_build_object('originalsRemaining',0,'topicSlotsRemaining',0,'visibleSlotsRemaining',0) end;
  if envelope->'compassContext' is null or (envelope->'compassContext')::jsonb is distinct from pg_catalog.jsonb_build_object(
      'version','explorer-compass-context.v9','mode',case when compass_mode='automatic' then 'automatic' else 'legacy_read_only' end,
      'topics',compass_topics,'messageRefs',jsonb_build_object('history',compass_refs,'immediate','now'),
      'capacity',compass_capacity,'points',compass_points,'priorityId',compass_priority,
      'attentionId',compass_attention,'recentRoute',compass_route,'waypoints',compass_waypoints,'drafts',compass_drafts,
      'offers',compass_offers,'reachedOfferedWaypointIds',reached_offered_waypoint_ids,
      'immediateMessageIsReplyChoice',ai.solmind_immediate_reply_choice_v1(
        p_conversation_id,immediate->>'content',p_reply_choice))
    then return next; return; end if;
  if cardinality(expected_ids)<>(select count(distinct id) from unnest(expected_ids) id) then
    return next; return;
  end if;
  -- Deduplicate only within the message kind before rejecting cross-kind collisions.
  if exists(select 1 from unnest(support_ids) id where id=intake.intake_response_set_id or id=methodology_id) then
    return next; return;
  end if;
  select array_agg(distinct id order by id) into expected_ids from unnest(expected_ids||support_ids) id;
  expected_ids:=expected_ids||point_ids||waypoint_ids||draft_ids||topic_ids||offer_ids;
  end if;
  -- Distinct cross-kind identities are an independent source obligation; a
  -- duplicate must not disappear merely because the transport list is a set.
  if pg_catalog.cardinality(expected_ids) is distinct from
    (select count(distinct x)::integer from pg_catalog.unnest(expected_ids) x)
    then return next; return; end if;
  select pg_catalog.array_agg(distinct x order by x) into expected_ids from pg_catalog.unnest(expected_ids) x;
  if expected_ids is distinct from p_context_source_ids then return next; return; end if;

  -- Closed deployed family capability: any new private-note owner or changed
  -- covered column inventory is unsupported until explicitly reviewed. The new
  -- private evidence owner is physically created by Root's following migration.
  -- Lock BEFORE inspecting the covered catalog; otherwise a DDL change between
  -- the check and acquisition could invalidate that check without detection.
  lock table content.summary in share mode nowait;
  lock table content.summary_revision in share mode nowait;
  lock table content.summary_section in share mode nowait;
  lock table content.summary_publication in share mode nowait;
  lock table content.trigger_observation in share mode nowait;
  if pg_catalog.to_regclass('content.private_note') is not null then return next; return; end if;
  private_owner:=pg_catalog.to_regclass('ai.explorer_safety_evidence');
  if private_owner is null or not exists(select 1 from pg_catalog.pg_class c where c.oid=private_owner
      and c.relkind='r' and c.relrowsecurity and not c.relforcerowsecurity)
    or (select count(*) from pg_catalog.pg_attribute a where a.attrelid=private_owner and a.attnum>0 and not a.attisdropped
      and a.attname in ('explorer_safety_evidence_id','conversation_id') and a.atttypid='uuid'::regtype)<>2
    or exists(select 1 from pg_catalog.pg_policy p where p.polrelid=private_owner)
    or exists(select 1 from pg_catalog.unnest(array['anon','authenticated','service_role']) r(name)
      where pg_catalog.has_table_privilege(r.name,private_owner,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,TRIGGER')
        or pg_catalog.has_any_column_privilege(r.name,private_owner,'SELECT,INSERT,UPDATE,REFERENCES'))
  then return next; return; end if;
  for capability_row in select * from (values
    ('content.summary',array['summary_id','guide_explorer_relationship_id','summary_type','summary_status','current_revision_id',
      'created_from_ai_interaction_session_id','created_by_actor_type','created_by_user_account_id','created_at','updated_at',
      'metadata','retention_class','created_from_appointment_id','version','last_operation_id']),
    ('content.summary_revision',array['summary_revision_id','summary_id','revision_number','content_markdown','revision_status',
      'created_by_actor_type','created_by_user_account_id','source_ai_model_invocation_id','source_ai_interaction_session_id',
      'source_ai_interaction_message_id','created_at','metadata','retention_class','created_by_role_context','previous_revision_id','ai_change_summary']),
    ('content.summary_section',array['summary_section_id','summary_revision_id','section_type','section_title','content_markdown',
      'visibility','display_order','created_at','retention_class']),
    ('content.summary_publication',array['summary_publication_id','summary_id','summary_revision_id','published_to_explorer_profile_id',
      'published_by_user_account_id','published_by_role_context','published_at','publication_status','unpublished_at',
      'unpublished_by_user_account_id','superseded_by_summary_publication_id','publication_operation_id','last_operation_id','created_at','retention_class']),
    ('content.trigger_observation',array['trigger_observation_id','guide_explorer_relationship_id','source_ai_interaction_session_id',
      'source_ai_interaction_message_id','source_summary_revision_id','trigger_label','observation_text','observation_window_start',
      'observation_window_end','occurrence_count','confidence_level','review_status','created_by_actor_type','created_at','metadata','retention_class'])
  ) v(relation,expected)
  loop
    if not exists(select 1 from pg_catalog.pg_class c where c.oid=pg_catalog.to_regclass(capability_row.relation)
        and c.relkind='r' and c.relrowsecurity and not c.relforcerowsecurity)
      or (select pg_catalog.array_agg(a.attname::text order by a.attname) from pg_catalog.pg_attribute a
        where a.attrelid=pg_catalog.to_regclass(capability_row.relation) and a.attnum>0 and not a.attisdropped)
      is distinct from (select pg_catalog.array_agg(x order by x) from pg_catalog.unnest(capability_row.expected) x)
      or exists(select 1 from pg_catalog.pg_attribute a
        where a.attrelid=pg_catalog.to_regclass(capability_row.relation) and a.attnum>0 and not a.attisdropped
          and a.atttypid is distinct from (case
            when a.attname like '%\_id' escape '\' then 'uuid'
            when a.attname='metadata' then 'jsonb'
            when a.attname='version' then 'bigint'
            when a.attname in ('revision_number','display_order','occurrence_count') then 'integer'
            when a.attname in ('created_at','updated_at','published_at','unpublished_at',
              'observation_window_start','observation_window_end') then 'timestamp with time zone'
            else 'text' end)::regtype)
    then return next; return; end if;
  end loop;

  -- A UUID FK alone does not establish actual Summary containment. Never
  -- attribute metadata to another Summary/relationship through a bad pointer.
  if exists(select 1 from content.summary s
    where s.guide_explorer_relationship_id=p_relationship_id and s.current_revision_id is not null
      and not exists(select 1 from content.summary_revision r
        where r.summary_revision_id=s.current_revision_id and r.summary_id=s.summary_id))
    then return next; return; end if;
  -- Charge raw metadata (including keys/non-string leaves) before expanding any
  -- root. Key/value cells are also charged below; this is deliberately conservative.
  for metadata_root in
    select t.metadata from content.trigger_observation t where t.guide_explorer_relationship_id=p_relationship_id
    union all select s.metadata from content.summary s where s.guide_explorer_relationship_id=p_relationship_id
    union all select r.metadata from content.summary_revision r join content.summary s on s.summary_id=r.summary_id
      where s.guide_explorer_relationship_id=p_relationship_id
  loop
    metadata_roots:=metadata_roots+1;
    max_bytes:=coalesce(pg_catalog.octet_length(metadata_root.metadata::text),0);
    total_bytes:=total_bytes+max_bytes;
    if metadata_roots>4096 or max_bytes>262144 or total_bytes>4194304 then return next; return; end if;
  end loop;

  select pg_catalog.array_agg(ai.solmind_exclusion_fingerprint_v3(x)),
    pg_catalog.array_agg(pg_catalog.lower(x)) into source_hashes,source_lower
    from pg_catalog.unnest(context_strings) x;
  -- Every field/identity is evaluated before a winner can authorize a denial.
  -- Section identity is independent internally; only its real containing
  -- revision is emitted under the existing summary_revision audit vocabulary.
  for cell in
    with scoped_summary as (
      select s.*,coalesce(s.current_revision_id,(select r.summary_revision_id from content.summary_revision r
        where r.summary_id=s.summary_id order by r.revision_number desc,r.summary_revision_id limit 1)) as audit_revision
      from content.summary s where s.guide_explorer_relationship_id=p_relationship_id
    ), scoped_revision as (
      select r.*,s.summary_status,s.current_revision_id from content.summary_revision r
      join scoped_summary s on s.summary_id=r.summary_id
    ), eligible_section as (
      select sec.summary_section_id from content.summary_section sec
      join scoped_revision r on r.summary_revision_id=sec.summary_revision_id
      where r.summary_status='published' and r.current_revision_id=r.summary_revision_id
        and r.revision_status='published_to_explorer' and sec.section_type='explorer_facing'
        and sec.visibility='published_to_explorer' and exists(select 1 from content.summary_publication pub
          where pub.summary_id=r.summary_id and pub.summary_revision_id=r.summary_revision_id
            and pub.published_to_explorer_profile_id=p_explorer_profile_id and pub.publication_status='published')
    )
    select 'trigger_observation'::text as audit_type,t.trigger_observation_id as audit_id,
      t.trigger_observation_id as source_id,'trigger_observation'::text as source_type,f.field,f.value,false as eligible
    from content.trigger_observation t cross join lateral (values
      ('identity',null::text),('trigger_label',t.trigger_label),('observation_text',t.observation_text)) f(field,value)
      where t.guide_explorer_relationship_id=p_relationship_id
    union all
    select 'trigger_observation',t.trigger_observation_id,t.trigger_observation_id,'trigger_observation',
      'metadata/'||pg_catalog.array_to_string(j.field_path,'/'),j.field_text,false
    from content.trigger_observation t cross join lateral ai.solmind_exclusion_strings_v3(t.metadata::json,true) j
      where t.guide_explorer_relationship_id=p_relationship_id
    union all
    select 'summary_revision',r.summary_revision_id,r.summary_revision_id,'summary_revision',f.field,f.value,
      f.field='identity' and exists(select 1 from content.summary_section sec join eligible_section e
        on e.summary_section_id=sec.summary_section_id where sec.summary_revision_id=r.summary_revision_id)
      from scoped_revision r cross join lateral (values
        ('identity',null::text),('content_markdown',r.content_markdown),('ai_change_summary',r.ai_change_summary)) f(field,value)
    union all
    select 'summary_revision',r.summary_revision_id,r.summary_revision_id,'summary_revision',
      'metadata/'||pg_catalog.array_to_string(j.field_path,'/'),j.field_text,false
      from scoped_revision r cross join lateral ai.solmind_exclusion_strings_v3(r.metadata::json,true) j
    union all
    select 'summary_revision',r.summary_revision_id,sec.summary_section_id,'summary_section',f.field,f.value,
      exists(select 1 from eligible_section e where e.summary_section_id=sec.summary_section_id)
      from content.summary_section sec join scoped_revision r on r.summary_revision_id=sec.summary_revision_id
      cross join lateral (values ('identity',null::text),('section_title',sec.section_title),('content_markdown',sec.content_markdown)) f(field,value)
    union all
    select 'summary_revision',s.audit_revision,s.summary_id,'summary','identity',null::text,false from scoped_summary s
    union all
    select 'summary_revision',s.audit_revision,s.summary_id,'summary','metadata/'||pg_catalog.array_to_string(j.field_path,'/'),j.field_text,false
      from scoped_summary s cross join lateral ai.solmind_exclusion_strings_v3(s.metadata::json,true) j
  loop
    seen:=seen+1;
    max_bytes:=coalesce(pg_catalog.octet_length(cell.value),0);
    total_bytes:=total_bytes+max_bytes;
    if seen>4096 or max_bytes>262144 or total_bytes>4194304 then return next; return; end if;
    matched:=cell.field='identity' and (cell.source_id=any(p_context_source_ids) or exists(
      select 1 from pg_catalog.unnest(source_lower) x where pg_catalog.strpos(x,cell.source_id::text)>0));
    if cell.value is not null then
      matched:=matched or ai.solmind_exclusion_fingerprint_v3(cell.value)=any(source_hashes);
    end if;
    if matched and not cell.eligible then
      if cell.audit_id is null then unknown_match:=true;
      else
        candidate_key:=cell.source_type||'|'||cell.source_id::text||'|'||cell.field;
        if winner_key is null or candidate_key<winner_key then
          winner_key:=candidate_key; winner_type:=cell.audit_type; winner_id:=cell.audit_id;
        end if;
      end if;
    end if;
  end loop;
  -- Private evidence is structurally excluded. The following exact ID check
  -- refuses without inventing a compatible exclusion-audit category. Root's
  -- common actor-owner lock serializes its private evidence writers.
  for private_id in execute 'select e.explorer_safety_evidence_id from ai.explorer_safety_evidence e '
    ||'join ai.ai_interaction_session s on s.ai_interaction_session_id=e.conversation_id '
    ||'where s.guide_explorer_relationship_id=$1' using p_relationship_id
  loop
    seen:=seen+1;
    if seen>4096 then return next; return; end if;
    if private_id=any(p_context_source_ids) or exists(select 1 from pg_catalog.unnest(source_lower) x
      where pg_catalog.strpos(x,private_id::text)>0) then unknown_match:=true; end if;
  end loop;
  if unknown_match then return next; return; end if;
  if winner_key is not null then
    outcome:='blocked'; excluded_entity_type:=winner_type; excluded_entity_id:=winner_id;
  else outcome:='clear'; end if;
  return next;
exception when others then
  -- No details/content from parse, shape, lock, schema or privilege failures.
  -- Cancellation propagates naturally and never becomes permission.
  return query select 'unavailable'::text,null::text,null::uuid;
end $$;

-- Restated from 20261111000000_explorer_automatic_compass_v1.sql (latest definition).
create or replace function methodology.serialized_methodology_valid(p_serialized text,p_version uuid,p_content text)
returns boolean language plpgsql immutable set search_path='' as $$
declare envelope json; subject json; keys text[];
begin
  if p_serialized is null or octet_length(p_serialized) not between 2 and 524288 or p_version is null or p_content is null
    then return false; end if;
  envelope:=p_serialized::json;
  if json_typeof(envelope) is distinct from 'object' then return false; end if;
  -- json preserves duplicate keys; jsonb would erase this evidence first.
  select array_agg(key order by key) into keys from json_each(envelope);
  -- Exactly two key sets, each tied to its own version: the existing envelope, or the
  -- same envelope plus the saved Compass and Waypoint section (chat step slice S3).
  if not coalesce((keys=array['actorRoleContext','aiRole','approvedContinuity','contractVersion','crisisBehavior',
        'currentSessionMessages','globalPolicy','immediateExplorerMessage','methodologyContext','outputRequirements',
        'roleBehavior','sessionContext']::text[]
      and envelope->>'contractVersion'='wi007-v0.1+onboarding-fields-v2')
    or (keys=array['actorRoleContext','aiRole','approvedContinuity','compassContext','contractVersion','crisisBehavior',
        'currentSessionMessages','globalPolicy','immediateExplorerMessage','methodologyContext','outputRequirements',
        'roleBehavior','sessionContext']::text[]
      and envelope->>'contractVersion'='wi007-v0.1+onboarding-fields-v2+compass-v9'),false)
    or json_typeof(envelope->'contractVersion') is distinct from 'string'
    or json_typeof(envelope->'aiRole') is distinct from 'string' or envelope->>'aiRole' is distinct from 'solmind_virtual_guide'
    or json_typeof(envelope->'actorRoleContext') is distinct from 'string' or envelope->>'actorRoleContext' is distinct from 'explorer'
    then return false; end if;
  subject:=envelope->'methodologyContext';
  if json_typeof(subject) is distinct from 'object' then return false; end if;
  select array_agg(key order by key) into keys from json_each(subject);
  return coalesce(keys=array['text','version']::text[] and json_typeof(subject->'text')='string'
    and json_typeof(subject->'version')='string' and subject->>'version'='methodology:'||p_version::text
    and subject->>'text'=p_content,false);
exception when others then return false;
end $$;

-- Restated from 20261111000000_explorer_automatic_compass_v1.sql (latest definition).
create or replace function public.solmind_prepare_explorer_conversation_turn_v3(
  p_actor_user_account_id uuid,p_user_session_id uuid,p_conversation_id uuid,
  p_operation_id uuid,p_expected_revision integer,p_message_id uuid,p_snapshot_id uuid,p_invocation_id uuid,
  p_body text,p_context_serialization text,p_context_fingerprint_sha256 text,p_context_source_ids uuid[],
  p_authorization_version text,p_intake_response_set_id uuid,p_methodology_context_pack_version_id uuid,
  p_prompt_version text,p_policy_version text,p_behavior_version text,p_crisis_version text,
  p_role_version text,p_instruction_version text,p_command_fingerprint text,p_logical_operation_id uuid,
  p_methodology_context_pack_id uuid,p_methodology_content_sha256 text,p_methodology_authorization_version text,
  p_protocol_version text,p_request_mode text,p_configuration_fingerprint text,p_fallback_policy_version text,
  p_model_policy_version text,p_trusted_response_version text,p_resource_policy_version text,
  p_expected_safety_version bigint,p_fallback_level smallint,p_fallback_minor_indicated boolean,p_model_name text,
  p_reply_choice boolean default false
) returns table(outcome text,conversation_state jsonb,dispatch_permitted boolean,policy_state jsonb)
language plpgsql volatile security definer set search_path='' set lock_timeout='2000ms' set statement_timeout='5000ms' as $$
declare a jsonb; e jsonb; st ai.explorer_conversation_state%rowtype; old_op ai.explorer_conversation_operation%rowtype;
  h text; h_legacy text; ids uuid[]; mode text; ctx json; inspected record; n integer; ts timestamptz; g jsonb;
  v_contract constant text:='virtual-guide-predispatch-evidence.v3';
begin
  perform ai.solmind_private_owner_lock_v3(p_actor_user_account_id);
  if p_reply_choice is null or p_user_session_id is null or p_conversation_id is null or p_operation_id is null or p_message_id is null
    or p_snapshot_id is null or p_invocation_id is null or p_logical_operation_id is null
    or p_expected_revision is null or p_expected_revision<0 or p_expected_safety_version is null or p_expected_safety_version<0
    or p_protocol_version is distinct from 'explorer-safety-reply.v2'
    or p_request_mode is null or p_request_mode not in ('classification_and_reply','classification_only')
    or p_fallback_level is null or p_fallback_level not between 0 and 4 or p_fallback_minor_indicated is null
    or p_model_name is null or not ai.solmind_openai_model_name_valid(p_model_name)
    or not ai.solmind_conversation_text_valid(p_body,8192,false)
    or p_configuration_fingerprint is null or p_configuration_fingerprint !~ '^[0-9A-F]{64}$'
    or p_command_fingerprint is null or p_command_fingerprint !~ '^[0-9A-F]{64}$'
    or p_context_serialization is null or octet_length(p_context_serialization) not between 2 and 524288
    or p_context_fingerprint_sha256 is null or p_context_fingerprint_sha256 !~ '^[0-9A-F]{64}$'
    or p_authorization_version is null or p_authorization_version !~ '^AV3:[0-9A-F]{64}$'
    or p_context_fingerprint_sha256 is distinct from upper(encode(extensions.digest(convert_to(p_context_serialization,'UTF8'),'sha256'),'hex'))
    or p_intake_response_set_id is null or p_methodology_context_pack_id is null or p_methodology_context_pack_version_id is null
    or p_methodology_content_sha256 is null or p_methodology_content_sha256 !~ '^[0-9A-F]{64}$'
    or p_methodology_authorization_version is null or p_methodology_authorization_version !~ '^MV1:[0-9A-F]{64}$'
    or p_context_source_ids is null or cardinality(p_context_source_ids) not between 3 and 169
    or array_position(p_context_source_ids,null) is not null
    or exists(select 1 from unnest(array[p_prompt_version,p_policy_version,p_behavior_version,p_crisis_version,
      p_role_version,p_instruction_version,p_fallback_policy_version,p_model_policy_version,
      p_trusted_response_version,p_resource_policy_version]) as versions(version)
      where version is null or version !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$')
    then raise exception 'solmind_explorer_private_invalid_input'; end if;
  select array_agg(distinct x order by x) into ids from unnest(p_context_source_ids) as sources(x);
  if ids is distinct from p_context_source_ids or not(p_message_id=any(ids))
    or not(p_intake_response_set_id=any(ids)) or not(p_methodology_context_pack_version_id=any(ids))
    then raise exception 'solmind_explorer_private_invalid_input'; end if;
  h_legacy:=methodology.hash_json(jsonb_build_array(p_actor_user_account_id,p_user_session_id,p_conversation_id,
    p_operation_id,p_expected_revision,p_message_id,p_snapshot_id,p_invocation_id,p_body,p_context_fingerprint_sha256,ids,
    p_authorization_version,p_intake_response_set_id,p_methodology_context_pack_version_id,p_prompt_version,p_policy_version,
    p_behavior_version,p_crisis_version,p_role_version,p_instruction_version,p_command_fingerprint,p_logical_operation_id,
    p_methodology_context_pack_id,p_methodology_content_sha256,p_methodology_authorization_version,p_protocol_version,
    p_request_mode,p_configuration_fingerprint,p_fallback_policy_version,p_model_policy_version,p_trusted_response_version,
    p_resource_policy_version,p_expected_safety_version,p_fallback_level,p_fallback_minor_indicated));
  h:=methodology.hash_json(jsonb_build_array('explorer-model-binding.v1',h_legacy,p_model_name));
  -- Preserve false/absent replay identities; a claimed tap is part of exact intent,
  -- even if its label is stale or this turn is classification_only.
  if p_reply_choice then h:=methodology.hash_json(jsonb_build_array('explorer-reply-choice.v1',h,true)); end if;
  a:=ai.solmind_private_owned_authority_v3(p_actor_user_account_id,p_user_session_id,p_conversation_id);
  select x.* into st from ai.explorer_conversation_state x where x.conversation_id=p_conversation_id for update;
  if not found or st.actor_user_account_id is distinct from p_actor_user_account_id
    then raise exception 'solmind_explorer_private_denied'; end if;
  select x.* into old_op from ai.explorer_conversation_operation x
    where x.actor_user_account_id=p_actor_user_account_id and x.operation_id=p_operation_id for update;
  if found then
    if old_op.kind is distinct from 'send' or old_op.conversation_id is distinct from p_conversation_id
      or old_op.application_session_id is distinct from p_user_session_id
      or (old_op.model_name is not null and old_op.model_name is distinct from p_model_name)
      or (old_op.model_name is null and (p_model_name is distinct from 'gpt-5.6-luna' or p_reply_choice))
      or old_op.request_fingerprint is distinct from (case when old_op.model_name is null then h_legacy else h end)
      or old_op.command_fingerprint is distinct from p_command_fingerprint
      or old_op.safety_protocol_version is distinct from p_protocol_version
      then raise exception 'solmind_explorer_private_operation_conflict'; end if;
    -- Exact persisted request first: no current methodology/source collection or
    -- changed version enrichment, and never another dispatch permission.
    if (a->>'applicationSessionExpiresAt')::timestamptz<=clock_timestamp()
      then raise exception 'solmind_explorer_private_denied'; end if;
    return query select 'exact_replay'::text,ai.solmind_conversation_state_json(p_conversation_id),false,
      ai.solmind_private_policy_v3(p_conversation_id); return;
  end if;
  if st.revision is distinct from p_expected_revision or st.pending_operation_id is not null then
    return query select 'stale_revision'::text,null::jsonb,false,ai.solmind_private_policy_v3(p_conversation_id); return;
  end if;
  if ai.solmind_private_policy_v3(p_conversation_id)->'known' is distinct from 'true'::jsonb
    then raise exception 'solmind_explorer_private_legacy_unknown'; end if;
  -- Product hard stops, early: a paused Send is refused before any observation or message is stored. The
  -- four hard-stop settings are taken first, in key order, before the clock is read for the check.
  perform s.setting_key from core.application_setting s
    where s.setting_key in ('explorer_ai_use_automatic_lifts_per_month','explorer_ai_use_automatic_lifts_per_week',
      'explorer_ai_use_individual_daily_call_limit','explorer_ai_use_shared_daily_calls_per_active_explorer')
    order by s.setting_key for share;
  g:=ai.solmind_explorer_ai_use_gate_v1(p_actor_user_account_id,p_conversation_id,clock_timestamp(),'check');
  if (g->>'allowed')::boolean is not true then
    return query select 'paused'::text,null::jsonb,false,ai.solmind_private_policy_v3(p_conversation_id); return;
  end if;
  perform ai.solmind_store_private_observation_v3(p_conversation_id,p_user_session_id,p_logical_operation_id,
    p_command_fingerprint,p_fallback_policy_version,p_model_policy_version,p_fallback_level,p_fallback_minor_indicated,
    null,null,null);
  select x.* into st from ai.explorer_conversation_state x where x.conversation_id=p_conversation_id;
  mode:=case when st.restricted_level is not null or st.adult_reflection_stopped or p_fallback_level>=3
    or p_fallback_minor_indicated then 'classification_only' else 'classification_and_reply' end;
  if st.safety_version is distinct from p_expected_safety_version or p_request_mode is distinct from mode then
    return query select 'stale_policy'::text,null::jsonb,false,ai.solmind_private_policy_v3(p_conversation_id); return;
  end if;
  if a->>'authorizationVersion' is distinct from p_authorization_version
    or (a->'onboarding'->>'responseId')::uuid is distinct from p_intake_response_set_id
    then raise exception 'solmind_explorer_private_denied'; end if;
  e:=methodology.resolve_effective(p_methodology_context_pack_id,(a->>'guideId')::uuid);
  if (e->>'versionId')::uuid is distinct from p_methodology_context_pack_version_id
    or e->>'contentSha256' is distinct from p_methodology_content_sha256
    or e->>'methodologyAuthorizationVersion' is distinct from p_methodology_authorization_version
    or not methodology.serialized_methodology_valid(p_context_serialization,p_methodology_context_pack_version_id,e->>'contentMarkdown')
    then raise exception 'solmind_explorer_private_denied'; end if;
  ctx:=p_context_serialization::json;
  if ctx->'immediateExplorerMessage'->>'messageId' is distinct from p_message_id::text
    or ctx->'immediateExplorerMessage'->>'content' is distinct from p_body
    or ctx->'globalPolicy'->>'version' is distinct from p_policy_version
    or ctx->'roleBehavior'->>'version' is distinct from p_behavior_version
    or ctx->'crisisBehavior'->>'version' is distinct from p_crisis_version
    then raise exception 'solmind_explorer_private_denied'; end if;
  -- The source owner locks all covered tables NOWAIT before its fresh scan.
  -- Its blocked audit MUST survive: return rather than throw after that row.
  select x.* into inspected from ai.solmind_record_explorer_context_exclusion_v3(
    p_actor_user_account_id,p_user_session_id,(a->>'explorerId')::uuid,(a->>'relationshipId')::uuid,
    p_conversation_id,p_context_serialization,ids,p_reply_choice) x;
  if not found or inspected.outcome is null or inspected.outcome not in ('clear','blocked','unavailable')
    then raise exception 'solmind_explorer_private_unavailable'; end if;
  if inspected.outcome<>'clear' then
    return query select inspected.outcome::text,null::jsonb,false,null::jsonb; return;
  end if;
  select count(*)::integer into n from ai.ai_interaction_message m where m.ai_interaction_session_id=p_conversation_id;
  if n>98 then return query select 'unavailable'::text,null::jsonb,false,null::jsonb; return; end if;
  -- Product hard stops, final: the four hard-stop settings (already held since the early check), then the
  -- one shared lock, and only then read the clock, so after any wait the day, the count and this Send's
  -- saved times all come from one moment. Each Send prepared here counts once; a stop reached by this
  -- Send is recorded with it.
  perform s.setting_key from core.application_setting s
    where s.setting_key in ('explorer_ai_use_automatic_lifts_per_month','explorer_ai_use_automatic_lifts_per_week',
      'explorer_ai_use_individual_daily_call_limit','explorer_ai_use_shared_daily_calls_per_active_explorer')
    order by s.setting_key for share;
  perform pg_advisory_xact_lock(hashtextextended('solmind:explorer-ai-use-shared:v1',0));
  ts:=clock_timestamp();
  g:=ai.solmind_explorer_ai_use_gate_v1(p_actor_user_account_id,p_conversation_id,ts,'final');
  if (g->>'allowed')::boolean is not true then
    return query select 'paused'::text,null::jsonb,false,ai.solmind_private_policy_v3(p_conversation_id); return;
  end if;
  insert into ai.ai_interaction_message(ai_interaction_message_id,ai_interaction_session_id,sequence_number,
    sender_type,sender_user_account_id,sender_role_context,content_text,created_at)
    values(p_message_id,p_conversation_id,n+1,'user',p_actor_user_account_id,'explorer',p_body,ts);
  insert into ai.ai_context_snapshot(ai_context_snapshot_id,ai_interaction_session_id,ai_interaction_message_id,
    prompt_version,methodology_context_pack_version_id,actor_user_account_id,explorer_profile_id,
    guide_explorer_relationship_id,authorization_version,active_required_consent_document_ids,context_source_ids,
    context_fingerprint_sha256,evidence_contract_version,application_session_id,immediate_message_id,
    organization_id,practice_id,solmind_policy_version,ai_behavior_version,crisis_policy_version,
    role_policy_version,instruction_version,intake_response_set_id,related_prior_session_ids,created_at,
    explorer_safety_protocol_version,explorer_safety_request_mode,explorer_configuration_fingerprint,
    fallback_policy_version,model_policy_version,trusted_response_version,resource_policy_version)
    values(p_snapshot_id,p_conversation_id,p_message_id,p_prompt_version,p_methodology_context_pack_version_id,
      p_actor_user_account_id,(a->>'explorerId')::uuid,(a->>'relationshipId')::uuid,p_authorization_version,
      array(select jsonb_array_elements_text(a->'requiredConsentDocumentIds')::uuid),ids,
      p_context_fingerprint_sha256,v_contract,p_user_session_id,p_message_id,(a->>'organizationId')::uuid,
      (a->>'practiceId')::uuid,p_policy_version,p_behavior_version,p_crisis_version,p_role_version,p_instruction_version,
      p_intake_response_set_id,array[]::uuid[],ts,p_protocol_version,p_request_mode,p_configuration_fingerprint,
      p_fallback_policy_version,p_model_policy_version,p_trusted_response_version,p_resource_policy_version);
  insert into ai.ai_model_invocation(ai_model_invocation_id,ai_interaction_session_id,provider_name,model_name,
    prompt_version,logical_operation_id,ai_context_snapshot_id,dispatch_contract_version,started_at)
    values(p_invocation_id,p_conversation_id,'openai',p_model_name,p_prompt_version,p_logical_operation_id,p_snapshot_id,v_contract,ts);
  insert into ai.explorer_conversation_operation(actor_user_account_id,operation_id,application_session_id,
    conversation_id,kind,request_fingerprint,command_fingerprint,initial_revision,status,message_id,snapshot_id,invocation_id,
    logical_operation_id,safety_protocol_version,safety_request_mode,configuration_fingerprint,fallback_observation_fingerprint,
    fallback_policy_version,model_policy_version,trusted_response_version,resource_policy_version,model_name,created_at)
    values(p_actor_user_account_id,p_operation_id,p_user_session_id,p_conversation_id,'send',h,p_command_fingerprint,
      p_expected_revision,'started',p_message_id,p_snapshot_id,p_invocation_id,p_logical_operation_id,
      p_protocol_version,p_request_mode,p_configuration_fingerprint,
      methodology.hash_json(jsonb_build_array('explorer-fallback-observation.v1',p_user_session_id,p_conversation_id,
        p_logical_operation_id,p_command_fingerprint,p_configuration_fingerprint,p_fallback_policy_version,
        p_model_policy_version,p_fallback_level,p_fallback_minor_indicated)),p_fallback_policy_version,
      p_model_policy_version,p_trusted_response_version,p_resource_policy_version,p_model_name,ts);
  insert into methodology.explorer_methodology_binding(ai_context_snapshot_id,methodology_context_pack_id,
    methodology_context_pack_version_id,content_sha256,methodology_authorization_version,created_at)
    values(p_snapshot_id,p_methodology_context_pack_id,p_methodology_context_pack_version_id,p_methodology_content_sha256,
      p_methodology_authorization_version,ts);
  perform ai.solmind_store_private_observation_v3(p_conversation_id,p_user_session_id,p_logical_operation_id,
    p_command_fingerprint,p_fallback_policy_version,p_model_policy_version,p_fallback_level,p_fallback_minor_indicated,
    p_invocation_id,null,null);
  insert into audit.audit_event(event_type,actor_user_account_id,actor_role_context,target_entity_type,
    target_entity_id,action,reason_code,event_summary,metadata)
    values('ai_context_snapshot_created',p_actor_user_account_id,'explorer','ai_context_snapshot',p_snapshot_id,
      'create','pre_dispatch_snapshot_created','Virtual Guide context snapshot created before provider dispatch.',
      jsonb_build_object('contract_version',v_contract,'operation_id',p_logical_operation_id::text,
        'role_context','explorer','session_id',p_conversation_id::text)),
    ('ai_model_invocation_started',p_actor_user_account_id,'explorer','ai_model_invocation',p_invocation_id,
      'start','pre_dispatch_invocation_started','Virtual Guide model invocation started before provider dispatch.',
      jsonb_build_object('context_snapshot_id',p_snapshot_id::text,'contract_version',v_contract,
        'model_name',p_model_name,'operation_id',p_logical_operation_id::text,'provider_name','openai',
        'request_status','started','role_context','explorer','session_id',p_conversation_id::text));
  update ai.explorer_conversation_state set revision=revision+1,pending_operation_id=p_operation_id
    where conversation_id=p_conversation_id;
  update ai.ai_interaction_session set last_activity_at=ts where ai_interaction_session_id=p_conversation_id;
  if (a->>'applicationSessionExpiresAt')::timestamptz<=clock_timestamp()
    then raise exception 'solmind_explorer_private_denied'; end if;
  return query select 'ok'::text,ai.solmind_conversation_state_json(p_conversation_id),true,
    ai.solmind_private_policy_v3(p_conversation_id);
end $$;

-- Keep one settlement identity and all private offer owners inaccessible to API roles.
do $$
declare r record; role_name text;
begin
  if (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname='solmind_settle_explorer_conversation_turn_v4')<>1
    or not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname='solmind_settle_explorer_conversation_turn_v4' and p.pronargs=31)
    then raise exception 'solmind_explorer_private_migration_identity'; end if;
  for r in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname in ('ai','content') and (p.proname like '%waypoint_offer%'
      or p.proname in ('solmind_waypoint_lineage_root_v1','solmind_waypoint_draft_typed_answer_eligible')) loop
    foreach role_name in array array['anon','authenticated','service_role'] loop
      if has_function_privilege(role_name,r.oid,'EXECUTE') then
        raise exception 'solmind_explorer_private_migration_acl'; end if;
    end loop;
  end loop;
  for r in select c.oid,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where (n.nspname='content' and c.relname='waypoint_offer')
      or (n.nspname='ai' and c.relname='explorer_waypoint_offer_event') loop
    if not r.relrowsecurity or exists(select 1 from pg_policy p where p.polrelid=r.oid) then
      raise exception 'solmind_explorer_private_migration_acl'; end if;
    foreach role_name in array array['anon','authenticated','service_role'] loop
      if has_table_privilege(role_name,r.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,TRIGGER')
        or has_any_column_privilege(role_name,r.oid,'SELECT,INSERT,UPDATE,REFERENCES') then
        raise exception 'solmind_explorer_private_migration_acl'; end if;
    end loop;
  end loop;
end $$;
commit;

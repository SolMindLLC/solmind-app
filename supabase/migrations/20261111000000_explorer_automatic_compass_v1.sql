-- REV391: isolated automatic Compass server build. Draft wording awaits Paul's approval.
-- Forward only. No legacy rows are converted or assigned invented evidence.
begin;

alter table ai.explorer_conversation_state
  add column compass_mode text not null default 'legacy',
  add constraint explorer_compass_mode_check
    check (compass_mode in ('legacy','automatic'));

alter table ai.explorer_conversation_state
  alter column compass_mode set default 'automatic';


create table ai.explorer_compass_topic (
  topic_id uuid primary key,
  conversation_id uuid not null
    references ai.explorer_conversation_state(conversation_id),
  actor_user_account_id uuid not null
    references identity.user_account(user_account_id),
  topic_slot smallint not null check (topic_slot between 1 and 24),
  label text collate "C" not null
    check (ai.solmind_compass_suggestion_label_valid(label) is true),
  created_operation_id uuid not null,
  created_reply_message_id uuid not null
    references ai.ai_interaction_message(ai_interaction_message_id),
  created_at timestamptz not null default clock_timestamp(),
  retention_class text not null default 'sensitive_content'
    check (retention_class = 'sensitive_content'),

  unique (conversation_id, topic_id),
  unique (conversation_id, topic_slot),
  unique (conversation_id, label),

  foreign key (actor_user_account_id, created_operation_id)
    references ai.explorer_conversation_operation
      (actor_user_account_id, operation_id)
);


create table ai.explorer_compass_topic_support (
  conversation_id uuid not null,
  topic_id uuid not null,
  support_message_id uuid not null
    references ai.ai_interaction_message(ai_interaction_message_id),
  support_slot smallint not null check (support_slot between 1 and 3),
  actor_user_account_id uuid not null
    references identity.user_account(user_account_id),
  observed_operation_id uuid not null,
  observed_reply_message_id uuid not null
    references ai.ai_interaction_message(ai_interaction_message_id),
  snapshot_id uuid not null
    references ai.ai_context_snapshot(ai_context_snapshot_id),
  created_at timestamptz not null default clock_timestamp(),
  retention_class text not null default 'sensitive_content'
    check (retention_class = 'sensitive_content'),

  primary key (conversation_id, topic_id, support_message_id),
  unique (conversation_id, topic_id, support_slot),

  foreign key (conversation_id, topic_id)
    references ai.explorer_compass_topic(conversation_id, topic_id),

  foreign key (actor_user_account_id, observed_operation_id)
    references ai.explorer_conversation_operation
      (actor_user_account_id, operation_id)
);


alter table ai.explorer_conversation_compass_item
  drop constraint
    explorer_conversation_compass_item_formation_status_check,
  add constraint
    explorer_conversation_compass_item_formation_status_check
    check (formation_status in
      ('proposed','confirmed','rejected','automatic')),
  add column automatic_topic_id uuid null,
  add constraint explorer_compass_automatic_topic_fk
    foreign key (conversation_id, automatic_topic_id)
    references ai.explorer_compass_topic(conversation_id, topic_id),
  add constraint explorer_compass_automatic_identity_check
    check (
      (formation_status is not distinct from 'automatic')
      = (automatic_topic_id is not null)
    ),
  add constraint explorer_compass_automatic_layout_check
    check (
      formation_status is distinct from 'automatic'
      or (
        compass_anchor is not null
        and relative_emphasis is not null
        and relative_emphasis = 1
      )
    ),
  add constraint explorer_compass_automatic_topic_unique
    unique (automatic_topic_id);


-- Closed, immutable addition receipt. Invalid optional values return false.
create function ai.solmind_compass_additions_valid_v1(p_changes jsonb)
returns boolean language plpgsql immutable set search_path='' as $$
declare c jsonb; x jsonb; topics text[]:=array[]::text[]; points text[]:=array[]::text[];
  anchors text[]:=array[]::text[]; ids text[]; uuid_pattern text:='^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
begin
  if jsonb_typeof(p_changes) is distinct from 'array' then return false; end if;
  if jsonb_array_length(p_changes) not between 1 and 3 then return false; end if;
  for c in select value from jsonb_array_elements(p_changes) loop
    if jsonb_typeof(c) is distinct from 'object' then return false; end if;
    if not c ?& array['kind','topicId','pointId','label','sourceMessageId','supportingMessageIds','anchor','emphasis','noticeKind']
      or (select count(*) from jsonb_object_keys(c))<>9 then return false; end if;
    -- Which notice a position gets is the settlement's choice (ai.solmind_plan_automatic_compass_v1),
    -- not a storage rule: a stored receipt may carry either kind at any position.
    if c->>'kind' is distinct from 'added' or ai.solmind_compass_suggestion_label_valid(c->>'label') is not true
      or jsonb_typeof(c->'label') is distinct from 'string' or c->'emphasis' is distinct from '1'::jsonb
      or c->>'anchor' is null or c->>'anchor' not in
        ('apex','upper_left','upper_right','side_left','side_right','lower_left','lower_center','lower_right')
      or c->>'noticeKind' is null or c->>'noticeKind' not in ('early_topic','not_yet_clear')
      then return false; end if;
    for x in select c->'topicId' union all select c->'pointId' union all select c->'sourceMessageId' loop
      if jsonb_typeof(x) is distinct from 'string' or (x#>>'{}') collate "C" !~ uuid_pattern then return false; end if;
    end loop;
    if jsonb_typeof(c->'supportingMessageIds') is distinct from 'array' then return false; end if;
    if jsonb_array_length(c->'supportingMessageIds')<>3 then return false; end if;
    ids:=array[]::text[];
    for x in select value from jsonb_array_elements(c->'supportingMessageIds') loop
      if jsonb_typeof(x) is distinct from 'string' or (x#>>'{}') collate "C" !~ uuid_pattern
        or (x#>>'{}')=any(ids) then return false; end if;
      ids:=array_append(ids,x#>>'{}');
    end loop;
    if c->>'topicId'=any(topics) or c->>'pointId'=any(points) or c->>'anchor'=any(anchors) then return false; end if;
    topics:=array_append(topics,c->>'topicId'); points:=array_append(points,c->>'pointId');
    anchors:=array_append(anchors,c->>'anchor');
  end loop;
  return true;
end $$;
alter function ai.solmind_compass_additions_valid_v1(jsonb) owner to postgres;
revoke all on function ai.solmind_compass_additions_valid_v1(jsonb) from public,anon,authenticated,service_role;

create table ai.explorer_compass_change_bundle (
  actor_user_account_id uuid not null
    references identity.user_account(user_account_id),
  operation_id uuid not null,
  conversation_id uuid not null
    references ai.explorer_conversation_state(conversation_id),
  reply_message_id uuid not null
    references ai.ai_interaction_message(ai_interaction_message_id),
  revision integer not null check (revision >= 2),
  version text not null
    check (version = 'explorer-compass-changes.v1'),
  changes jsonb not null
    check (ai.solmind_compass_additions_valid_v1(changes) is true),
  created_at timestamptz not null default clock_timestamp(),
  retention_class text not null default 'sensitive_content'
    check (retention_class = 'sensitive_content'),

  primary key (actor_user_account_id, operation_id),
  unique (conversation_id, reply_message_id),

  foreign key (actor_user_account_id, operation_id)
    references ai.explorer_conversation_operation
      (actor_user_account_id, operation_id)
);


alter table ai.explorer_compass_topic owner to postgres;
alter table ai.explorer_compass_topic_support owner to postgres;
alter table ai.explorer_compass_change_bundle owner to postgres;

alter table ai.explorer_compass_topic enable row level security;
alter table ai.explorer_compass_topic_support enable row level security;
alter table ai.explorer_compass_change_bundle enable row level security;

revoke all on
  ai.explorer_compass_topic,
  ai.explorer_compass_topic_support,
  ai.explorer_compass_change_bundle
from public, anon, authenticated, service_role;



-- Server-only evidence contains identities, never copied message bodies.
create function ai.solmind_compass_evidence_v1(p_conversation uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',t.topic_id,'label',t.label,
    'pointId',(select c.item_id from ai.explorer_conversation_compass_item c
      where c.conversation_id=t.conversation_id and c.automatic_topic_id=t.topic_id),
    'supportingMessageIds',(select jsonb_agg(e.support_message_id order by m.sequence_number)
      from ai.explorer_compass_topic_support e join ai.ai_interaction_message m
        on m.ai_interaction_message_id=e.support_message_id
      where e.conversation_id=t.conversation_id and e.topic_id=t.topic_id)) order by t.topic_slot),'[]'::jsonb)
  from ai.explorer_compass_topic t join ai.explorer_conversation_state st
    on st.conversation_id=t.conversation_id and st.actor_user_account_id=t.actor_user_account_id
  where t.conversation_id=p_conversation and st.compass_mode='automatic'
$$;

-- A plan is local to one locked settlement. All submitted references are checked,
-- including those that would not fit the remaining proof slots. No writes occur here.
create function ai.solmind_plan_automatic_compass_v1(
  p_actor uuid,p_conversation uuid,p_operation uuid,p_reply uuid,p_topics jsonb
) returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare st ai.explorer_conversation_state%rowtype; op ai.explorer_conversation_operation%rowtype;
  current_message ai.ai_interaction_message%rowtype; snap ai.ai_context_snapshot%rowtype;
  t jsonb; support jsonb; mapped uuid; topic uuid; point uuid; label_text text; ref_text text;
  refs text[]; support_ids uuid[]; retained uuid[]; new_ids uuid[]; all_ids uuid[];
  topic_rows jsonb:='[]'; support_rows jsonb:='[]'; changes jsonb:='[]'; entry_index integer:=0;
  identity_key text; seen text[]:=array[]::text[]; invalid_entry boolean; is_new boolean;
  topic_count integer; original_count integer; visible_count integer; next_slot integer;
  used_anchors text[]; anchor_name text; bytes bytea; msg uuid; proof_slot integer;
  uuid_pattern text:='^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  empty_plan jsonb:='{"topics":[],"supports":[],"changes":[]}';
begin
  select s.* into st from ai.explorer_conversation_state s where s.conversation_id=p_conversation for update;
  if not found or st.actor_user_account_id is distinct from p_actor or st.compass_mode<>'automatic'
    or st.pending_operation_id is distinct from p_operation or st.restricted_level is not null
    or st.adult_reflection_stopped then return empty_plan; end if;
  select o.* into op from ai.explorer_conversation_operation o
    where o.actor_user_account_id=p_actor and o.operation_id=p_operation and o.conversation_id=p_conversation
      and o.kind='send' and o.status in ('started','completed')
      and o.safety_request_mode='classification_and_reply' and o.safety_protocol_version='explorer-safety-reply.v2';
  if not found then return empty_plan; end if;
  select m.* into current_message from ai.ai_interaction_message m where m.ai_interaction_message_id=op.message_id
    and m.ai_interaction_session_id=p_conversation and m.sender_type='user'
    and m.sender_role_context='explorer' and m.sender_user_account_id=p_actor;
  if not found then return empty_plan; end if;
  select s.* into snap from ai.ai_context_snapshot s where s.ai_context_snapshot_id=op.snapshot_id
    and s.actor_user_account_id=p_actor and s.ai_interaction_session_id=p_conversation
    and s.immediate_message_id=op.message_id and s.ai_interaction_message_id=op.message_id;
  if not found or not exists(select 1 from ai.ai_interaction_message r where r.ai_interaction_message_id=p_reply
    and r.ai_interaction_session_id=p_conversation and r.sender_type='ai' and r.ai_role='solmind_virtual_guide'
    and r.sender_user_account_id is null and r.sequence_number>current_message.sequence_number)
    then return empty_plan; end if;
  if jsonb_typeof(p_topics) is distinct from 'array' then return empty_plan; end if;
  if jsonb_array_length(p_topics)>3 then return empty_plan; end if;
  -- Duplicate targets invalidate the complete batch before any optional write.
  for t in select value from jsonb_array_elements(p_topics) loop
    if jsonb_typeof(t) is distinct from 'object' then continue; end if;
    identity_key:=case when jsonb_typeof(t->'topicId')='string' and (t->>'topicId') collate "C" ~ uuid_pattern
      then t->>'topicId' when t->'topicId'='null'::jsonb and jsonb_typeof(t->'label')='string' then 'new:'||(t->>'label') end;
    if identity_key=any(seen) then return empty_plan; end if;
    if identity_key is not null then seen:=array_append(seen,identity_key); end if;
  end loop;
  select count(*),coalesce(max(topic_slot),0) into topic_count,next_slot
    from ai.explorer_compass_topic where conversation_id=p_conversation;
  select count(*) into original_count from ai.explorer_conversation_compass_item
    where conversation_id=p_conversation and formation_status is distinct from 'rejected';
  select count(*),coalesce(array_agg(compass_anchor),array[]::text[]) into visible_count,used_anchors
    from ai.explorer_conversation_compass_item where conversation_id=p_conversation
      and merged_into_item_id is null and formation_status is distinct from 'rejected';
  for t in select value from jsonb_array_elements(p_topics) loop
    entry_index:=entry_index+1;
    if jsonb_typeof(t) is distinct from 'object' then continue; end if;
    if not t ?& array['topicId','label','supports','ready'] or (select count(*) from jsonb_object_keys(t))<>4
      or jsonb_typeof(t->'label') is distinct from 'string' or ai.solmind_compass_suggestion_label_valid(t->>'label') is not true
      or jsonb_typeof(t->'ready') is distinct from 'boolean' or jsonb_typeof(t->'supports') is distinct from 'array'
      then continue; end if;
    if jsonb_array_length(t->'supports')>3 then continue; end if;
    is_new:=t->'topicId'='null'::jsonb; label_text:=t->>'label'; point:=null; retained:=array[]::uuid[];
    if is_new then
      if jsonb_array_length(t->'supports')=0 or topic_count>=24 or next_slot>=24
        or exists(select 1 from ai.explorer_compass_topic x where x.conversation_id=p_conversation and x.label=label_text collate "C")
        then continue; end if;
      bytes:=substring(extensions.digest(convert_to('explorer-compass-topic.v1|'||p_actor::text||'|'||p_operation::text||'|'||entry_index::text,'UTF8'),'sha256') from 1 for 16);
      bytes:=set_byte(set_byte(bytes,6,(get_byte(bytes,6)&15)|80),8,(get_byte(bytes,8)&63)|128);
      topic:=encode(bytes,'hex')::uuid;
      if exists(select 1 from ai.explorer_compass_topic x where x.topic_id=topic)
        or exists(select 1 from ai.explorer_conversation_compass_item x where x.item_id=topic) then continue; end if;
    else
      if jsonb_typeof(t->'topicId') is distinct from 'string' or (t->>'topicId') collate "C" !~ uuid_pattern then continue; end if;
      topic:=(t->>'topicId')::uuid;
      if not topic=any(snap.context_source_ids) or not exists(select 1 from ai.explorer_compass_topic x
        where x.conversation_id=p_conversation and x.actor_user_account_id=p_actor and x.topic_id=topic
          and x.label=label_text collate "C") then continue; end if;
      select c.item_id into point from ai.explorer_conversation_compass_item c where c.automatic_topic_id=topic;
      select coalesce(array_agg(e.support_message_id order by m.sequence_number),array[]::uuid[]) into retained
        from ai.explorer_compass_topic_support e join ai.ai_interaction_message m on m.ai_interaction_message_id=e.support_message_id
        where e.conversation_id=p_conversation and e.topic_id=topic;
    end if;
    refs:=array[]::text[]; support_ids:=array[]::uuid[]; invalid_entry:=false;
    for support in select value from jsonb_array_elements(t->'supports') loop
      if jsonb_typeof(support) is distinct from 'object' then invalid_entry:=true; exit; end if;
      if not support ?& array['ref','messageId'] or (select count(*) from jsonb_object_keys(support))<>2
        or jsonb_typeof(support->'ref') is distinct from 'string' or jsonb_typeof(support->'messageId') is distinct from 'string'
        or (support->>'messageId') collate "C" !~ uuid_pattern then invalid_entry:=true; exit; end if;
      ref_text:=support->>'ref';
      if ref_text !~ '^(now|h([0-9]|1[0-9]|2[0-3]))$' or ref_text=any(refs) then invalid_entry:=true; exit; end if;
      mapped:=null;
      if ref_text='now' then mapped:=op.message_id;
      else
        select h.ai_interaction_message_id into mapped from (
          select recent.*,row_number() over(order by recent.sequence_number)-1 as position
          from (select m.ai_interaction_message_id,m.sequence_number from ai.ai_interaction_message m
            where m.ai_interaction_session_id=p_conversation and m.sequence_number<current_message.sequence_number
            order by m.sequence_number desc limit 24) recent
        ) h where h.position=substring(ref_text from 2)::integer;
      end if;
      if mapped is null or mapped::text is distinct from support->>'messageId' or mapped=any(support_ids)
        or not mapped=any(snap.context_source_ids) or not exists(select 1 from ai.ai_interaction_message m
          where m.ai_interaction_message_id=mapped and m.ai_interaction_session_id=p_conversation
            and m.sender_type='user' and m.sender_role_context='explorer' and m.sender_user_account_id=p_actor
            and m.sequence_number<=current_message.sequence_number) then invalid_entry:=true; exit; end if;
      refs:=array_append(refs,ref_text); support_ids:=array_append(support_ids,mapped);
    end loop;
    if invalid_entry then continue; end if;
    select coalesce(array_agg(m.ai_interaction_message_id order by m.sequence_number),array[]::uuid[]) into new_ids
      from (select x.ai_interaction_message_id,x.sequence_number from ai.ai_interaction_message x
        where x.ai_interaction_message_id=any(support_ids) and not x.ai_interaction_message_id=any(retained)
        order by x.sequence_number limit greatest(0,3-cardinality(retained))) m;
    if is_new then
      topic_count:=topic_count+1; next_slot:=next_slot+1;
      topic_rows:=topic_rows||jsonb_build_array(jsonb_build_object('id',topic,'label',label_text,'slot',next_slot));
    end if;
    proof_slot:=cardinality(retained);
    foreach msg in array new_ids loop
      proof_slot:=proof_slot+1;
      support_rows:=support_rows||jsonb_build_array(jsonb_build_object('topicId',topic,'messageId',msg,'slot',proof_slot));
    end loop;
    select array_agg(m.ai_interaction_message_id order by m.sequence_number) into all_ids
      from ai.ai_interaction_message m where m.ai_interaction_message_id=any(retained||new_ids);
    if t->'ready'='true'::jsonb and cardinality(all_ids)=3 and point is null and original_count<24 and visible_count<8 then
      select a into anchor_name from unnest(array['apex','upper_left','upper_right','side_left','side_right','lower_left','lower_center','lower_right'])
        with ordinality ordered(a,n) where not a=any(used_anchors) order by n limit 1;
      if anchor_name is null then continue; end if;
      bytes:=substring(extensions.digest(convert_to('explorer-compass-point.v1|'||topic::text,'UTF8'),'sha256') from 1 for 16);
      bytes:=set_byte(set_byte(bytes,6,(get_byte(bytes,6)&15)|80),8,(get_byte(bytes,8)&63)|128);
      point:=encode(bytes,'hex')::uuid;
      if point=topic or exists(select 1 from ai.explorer_conversation_compass_item x where x.item_id=point)
        or exists(select 1 from ai.explorer_compass_topic x where x.topic_id=point) then continue; end if;
      changes:=changes||jsonb_build_array(jsonb_build_object('kind','added','topicId',topic,'pointId',point,
        'label',label_text,'sourceMessageId',p_reply,'supportingMessageIds',to_jsonb(all_ids),'anchor',anchor_name,
        'emphasis',1,'noticeKind',case when anchor_name='apex' then 'early_topic' else 'not_yet_clear' end));
      used_anchors:=array_append(used_anchors,anchor_name); original_count:=original_count+1; visible_count:=visible_count+1;
    end if;
  end loop;
  return jsonb_build_object('topics',topic_rows,'supports',support_rows,'changes',changes);
end $$;

create function ai.solmind_apply_automatic_compass_v1(
  p_actor uuid,p_conversation uuid,p_operation uuid,p_reply uuid,p_plan jsonb
) returns void language plpgsql volatile security invoker set search_path='' as $$
declare st ai.explorer_conversation_state%rowtype; op ai.explorer_conversation_operation%rowtype; x jsonb;
begin
  select s.* into st from ai.explorer_conversation_state s where s.conversation_id=p_conversation for update;
  select o.* into op from ai.explorer_conversation_operation o where o.actor_user_account_id=p_actor and o.operation_id=p_operation;
  if st.actor_user_account_id is distinct from p_actor or st.compass_mode is distinct from 'automatic'
    or st.pending_operation_id is distinct from p_operation or op.conversation_id is distinct from p_conversation
    or op.kind is distinct from 'send' or op.status is distinct from 'completed' or op.reply_message_id is distinct from p_reply
    or st.restricted_level is not null or st.adult_reflection_stopped
    then raise exception 'solmind_explorer_private_operation_conflict'; end if;
  if jsonb_typeof(p_plan) is distinct from 'object' or not p_plan ?& array['topics','supports','changes']
    or (select count(*) from jsonb_object_keys(p_plan))<>3
    or jsonb_typeof(p_plan->'topics') is distinct from 'array' or jsonb_typeof(p_plan->'supports') is distinct from 'array'
    or jsonb_typeof(p_plan->'changes') is distinct from 'array'
    then raise exception 'solmind_explorer_private_invalid_input'; end if;
  for x in select value from jsonb_array_elements(p_plan->'topics') loop
    insert into ai.explorer_compass_topic(topic_id,conversation_id,actor_user_account_id,topic_slot,label,
      created_operation_id,created_reply_message_id)
      values((x->>'id')::uuid,p_conversation,p_actor,(x->>'slot')::smallint,x->>'label',p_operation,p_reply);
  end loop;
  for x in select value from jsonb_array_elements(p_plan->'supports') loop
    insert into ai.explorer_compass_topic_support(conversation_id,topic_id,support_message_id,support_slot,
      actor_user_account_id,observed_operation_id,observed_reply_message_id,snapshot_id)
      values(p_conversation,(x->>'topicId')::uuid,(x->>'messageId')::uuid,(x->>'slot')::smallint,p_actor,p_operation,p_reply,op.snapshot_id);
  end loop;
  for x in select value from jsonb_array_elements(p_plan->'changes') loop
    insert into ai.explorer_conversation_compass_item(item_id,conversation_id,source_message_id,label,display_order,
      formation_status,wording_message_id,automatic_topic_id,compass_anchor,relative_emphasis)
      values((x->>'pointId')::uuid,p_conversation,p_reply,x->>'label',
        (select coalesce(max(c.display_order),0)+1 from ai.explorer_conversation_compass_item c where c.conversation_id=p_conversation),
        'automatic',p_reply,(x->>'topicId')::uuid,x->>'anchor',1);
  end loop;
  if jsonb_array_length(p_plan->'changes')>0 then
    insert into ai.explorer_compass_change_bundle(actor_user_account_id,operation_id,conversation_id,reply_message_id,revision,version,changes)
      values(p_actor,p_operation,p_conversation,p_reply,op.initial_revision+2,'explorer-compass-changes.v1',p_plan->'changes');
  end if;
end $$;

create function ai.solmind_compass_mode_guard_v1() returns trigger
language plpgsql set search_path='' as $$
begin
  if new.compass_mode is distinct from old.compass_mode then raise exception 'solmind_explorer_private_immutable'; end if;
  return new;
end $$;

create function ai.solmind_automatic_compass_rows_guard_v1() returns trigger
language plpgsql set search_path='' as $$
declare st ai.explorer_conversation_state%rowtype; op ai.explorer_conversation_operation%rowtype;
  guarded_operation_id uuid; reply_id uuid; c jsonb; proof jsonb; immediate_sequence integer;
begin
  if tg_op<>'INSERT' then raise exception 'solmind_explorer_private_immutable'; end if;
  select s.* into st from ai.explorer_conversation_state s where s.conversation_id=new.conversation_id for update;
  if not found or st.compass_mode<>'automatic' or st.actor_user_account_id is distinct from new.actor_user_account_id
    or st.pending_operation_id is null or st.restricted_level is not null or st.adult_reflection_stopped
    then raise exception 'solmind_explorer_private_formation_conflict'; end if;
  if tg_table_name='explorer_compass_topic' then
    guarded_operation_id:=new.created_operation_id; reply_id:=new.created_reply_message_id;
  elsif tg_table_name='explorer_compass_topic_support' then
    guarded_operation_id:=new.observed_operation_id; reply_id:=new.observed_reply_message_id;
  else
    guarded_operation_id:=new.operation_id; reply_id:=new.reply_message_id;
  end if;
  select o.* into op from ai.explorer_conversation_operation o
    where o.actor_user_account_id=new.actor_user_account_id and o.operation_id=guarded_operation_id;
  if not found or op.operation_id is distinct from st.pending_operation_id or op.conversation_id is distinct from new.conversation_id
    or op.kind<>'send' or op.status<>'completed' or op.safety_request_mode<>'classification_and_reply'
    or op.safety_protocol_version<>'explorer-safety-reply.v2' or op.reply_message_id is distinct from reply_id
    or not exists(select 1 from ai.ai_interaction_message m where m.ai_interaction_message_id=reply_id
      and m.ai_interaction_session_id=new.conversation_id and m.sender_type='ai'
      and m.ai_role='solmind_virtual_guide' and m.sender_user_account_id is null)
    then raise exception 'solmind_explorer_private_formation_conflict'; end if;
  select m.sequence_number into immediate_sequence from ai.ai_interaction_message m
    where m.ai_interaction_message_id=op.message_id and m.ai_interaction_session_id=new.conversation_id
      and m.sender_type='user' and m.sender_role_context='explorer' and m.sender_user_account_id=new.actor_user_account_id;
  if not found then raise exception 'solmind_explorer_private_formation_conflict'; end if;
  if tg_table_name='explorer_compass_topic' then
    if ai.solmind_compass_suggestion_label_valid(new.label) is not true then raise exception 'solmind_explorer_private_formation_conflict'; end if;
  elsif tg_table_name='explorer_compass_topic_support' then
    if new.snapshot_id is distinct from op.snapshot_id or not exists(select 1 from ai.explorer_compass_topic t
      where t.conversation_id=new.conversation_id and t.topic_id=new.topic_id and t.actor_user_account_id=new.actor_user_account_id)
      or not exists(select 1 from ai.ai_context_snapshot sn join ai.ai_interaction_message m
        on m.ai_interaction_message_id=new.support_message_id
        where sn.ai_context_snapshot_id=op.snapshot_id and sn.actor_user_account_id=new.actor_user_account_id
          and sn.ai_interaction_session_id=new.conversation_id and sn.immediate_message_id=op.message_id
          and sn.ai_interaction_message_id=op.message_id and new.support_message_id=any(sn.context_source_ids)
          and m.ai_interaction_session_id=new.conversation_id and m.sender_type='user'
          and m.sender_role_context='explorer' and m.sender_user_account_id=new.actor_user_account_id
          and m.sequence_number<=immediate_sequence)
      or (new.support_message_id<>op.message_id and not exists(select 1 from (
        select m.ai_interaction_message_id from ai.ai_interaction_message m
          where m.ai_interaction_session_id=new.conversation_id and m.sequence_number<immediate_sequence
          order by m.sequence_number desc limit 24) window_messages where window_messages.ai_interaction_message_id=new.support_message_id))
      then raise exception 'solmind_explorer_private_formation_conflict'; end if;
  else
    if new.revision<>op.initial_revision+2 or ai.solmind_compass_additions_valid_v1(new.changes) is not true
      then raise exception 'solmind_explorer_private_formation_conflict'; end if;
    for c in select value from jsonb_array_elements(new.changes) loop
      select jsonb_agg(e.support_message_id order by m.sequence_number) into proof
        from ai.explorer_compass_topic_support e join ai.ai_interaction_message m on m.ai_interaction_message_id=e.support_message_id
        where e.conversation_id=new.conversation_id and e.topic_id=(c->>'topicId')::uuid;
      if proof is distinct from c->'supportingMessageIds' or c->>'sourceMessageId' is distinct from reply_id::text
        or not exists(select 1 from ai.explorer_conversation_compass_item item
          join ai.explorer_compass_topic t on t.topic_id=item.automatic_topic_id and t.conversation_id=item.conversation_id
          where item.conversation_id=new.conversation_id and item.item_id=(c->>'pointId')::uuid
            and item.automatic_topic_id=(c->>'topicId')::uuid and item.formation_status='automatic'
            and item.source_message_id=reply_id and item.wording_message_id=reply_id
            and item.label=c->>'label' and item.label=t.label and t.actor_user_account_id=new.actor_user_account_id
            and item.compass_anchor=c->>'anchor' and item.relative_emphasis=1)
        then raise exception 'solmind_explorer_private_formation_conflict'; end if;
    end loop;
  end if;
  return new;
end $$;

create function ai.solmind_automatic_compass_proof_guard_v1() returns trigger
language plpgsql set search_path='' as $$
declare proof jsonb; matches integer;
begin
  select jsonb_agg(e.support_message_id order by m.sequence_number) into proof
    from ai.explorer_compass_topic_support e join ai.ai_interaction_message m on m.ai_interaction_message_id=e.support_message_id
    where e.conversation_id=new.conversation_id and e.topic_id=new.automatic_topic_id;
  if jsonb_array_length(proof) is distinct from 3 then raise exception 'solmind_explorer_private_formation_conflict'; end if;
  select count(*) into matches from ai.explorer_compass_change_bundle b
    join ai.explorer_conversation_operation op on op.actor_user_account_id=b.actor_user_account_id and op.operation_id=b.operation_id
    join ai.explorer_compass_topic t on t.topic_id=new.automatic_topic_id and t.conversation_id=new.conversation_id
    join ai.explorer_conversation_state st on st.conversation_id=new.conversation_id
    cross join lateral jsonb_array_elements(b.changes) c
    where b.conversation_id=new.conversation_id and b.reply_message_id=new.source_message_id
      and op.kind='send' and op.status='completed' and op.reply_message_id=new.source_message_id
      and new.wording_message_id=new.source_message_id and b.revision=op.initial_revision+2
      and b.actor_user_account_id=t.actor_user_account_id and t.actor_user_account_id=st.actor_user_account_id
      and c->>'topicId'=new.automatic_topic_id::text and c->>'pointId'=new.item_id::text
      and c->>'label'=new.label and t.label=new.label and c->>'sourceMessageId'=new.source_message_id::text
      and c->'supportingMessageIds'=proof and c->>'anchor'=new.compass_anchor and c->'emphasis'='1'::jsonb;
  if matches<>1 then raise exception 'solmind_explorer_private_formation_conflict'; end if;
  return new;
end $$;

alter function ai.solmind_compass_evidence_v1(uuid) owner to postgres;
revoke all on function ai.solmind_compass_evidence_v1(uuid) from public,anon,authenticated,service_role;

alter function ai.solmind_plan_automatic_compass_v1(uuid,uuid,uuid,uuid,jsonb) owner to postgres;
revoke all on function ai.solmind_plan_automatic_compass_v1(uuid,uuid,uuid,uuid,jsonb) from public,anon,authenticated,service_role;

alter function ai.solmind_apply_automatic_compass_v1(uuid,uuid,uuid,uuid,jsonb) owner to postgres;
revoke all on function ai.solmind_apply_automatic_compass_v1(uuid,uuid,uuid,uuid,jsonb) from public,anon,authenticated,service_role;

alter function ai.solmind_compass_mode_guard_v1() owner to postgres;
revoke all on function ai.solmind_compass_mode_guard_v1() from public,anon,authenticated,service_role;

alter function ai.solmind_automatic_compass_rows_guard_v1() owner to postgres;
revoke all on function ai.solmind_automatic_compass_rows_guard_v1() from public,anon,authenticated,service_role;

alter function ai.solmind_automatic_compass_proof_guard_v1() owner to postgres;
-- The deferred proof fires after the security-definer RPC has returned (at the API role's commit); run it as
-- its postgres owner, as 20261028000000_explorer_private_deferred_guard_privilege.sql does for the policy guard.
alter function ai.solmind_automatic_compass_proof_guard_v1() security definer;
revoke all on function ai.solmind_automatic_compass_proof_guard_v1() from public,anon,authenticated,service_role;

-- Latest owner: 20261105010000_explorer_forming_compass_points.sql.
create or replace function ai.solmind_compass_formation_guard() returns trigger
language plpgsql set search_path='' as $$
declare st ai.explorer_conversation_state%rowtype;
begin
  if tg_op='DELETE' then
    if old.formation_status is not null then raise exception 'solmind_explorer_private_immutable'; end if;
    return old;
  end if;
  select s.* into st from ai.explorer_conversation_state s where s.conversation_id=new.conversation_id for update;
  if tg_op='UPDATE' then
    if old.formation_status is not null and (new.item_id,new.conversation_id,new.source_message_id,new.display_order,new.created_at,new.retention_class)
      is distinct from (old.item_id,old.conversation_id,old.source_message_id,old.display_order,old.created_at,old.retention_class)
      then raise exception 'solmind_explorer_private_immutable'; end if;
    if old.formation_status='rejected' and new is distinct from old
      then raise exception 'solmind_explorer_private_immutable'; end if;
    if old.formation_status is distinct from 'proposed' and
      (new.formation_status,new.wording_message_id) is distinct from (old.formation_status,old.wording_message_id)
      then raise exception 'solmind_explorer_private_immutable'; end if;
    if old.formation_status='proposed' and new.formation_status is distinct from 'proposed' then
      if new.formation_status is null or new.formation_status not in ('confirmed','rejected')
        or new.label is distinct from old.label or new.wording_message_id is distinct from old.wording_message_id
        or st.pending_operation_id is not null
        then raise exception 'solmind_explorer_private_immutable'; end if;
    end if;
  end if;
  -- Retired formation transitions cannot be reached by a fresh operation.
  if tg_op='UPDATE' and ((new.formation_status,new.label,new.wording_message_id,new.automatic_topic_id)
    is distinct from (old.formation_status,old.label,old.wording_message_id,old.automatic_topic_id)
    or (old.formation_status='automatic' and new is distinct from old)) then
    raise exception 'solmind_explorer_private_immutable';
  end if;
  if tg_op='INSERT' and new.formation_status is distinct from 'automatic' then
    raise exception 'solmind_explorer_private_formation_conflict';
  end if;
  if new.formation_status='automatic' then
    if tg_op='INSERT' and (st.compass_mode<>'automatic' or new.source_message_id is distinct from new.wording_message_id
      or new.compass_anchor is null or new.relative_emphasis is distinct from 1 or new.merged_into_item_id is not null
      or not exists(select 1 from ai.explorer_compass_topic t where t.topic_id=new.automatic_topic_id
        and t.conversation_id=new.conversation_id and t.actor_user_account_id=st.actor_user_account_id and t.label=new.label)
      or not exists(select 1 from ai.explorer_conversation_operation op
        join ai.ai_interaction_message m on m.ai_interaction_message_id=op.reply_message_id
        where op.actor_user_account_id=st.actor_user_account_id and op.operation_id=st.pending_operation_id
          and op.conversation_id=new.conversation_id and op.kind='send' and op.status='completed'
          and op.safety_protocol_version='explorer-safety-reply.v2' and op.safety_request_mode='classification_and_reply'
          and op.reply_message_id=new.wording_message_id and m.ai_interaction_session_id=new.conversation_id
          and m.sender_type='ai' and m.ai_role='solmind_virtual_guide' and m.sender_user_account_id is null)
      or st.restricted_level is not null or st.adult_reflection_stopped) then
      raise exception 'solmind_explorer_private_formation_conflict';
    end if;
  elsif new.formation_status='proposed' then
    if new.compass_anchor is not null or new.relative_emphasis is not null or new.merged_into_item_id is not null
      then raise exception 'solmind_explorer_private_formation_conflict'; end if;
    if tg_op='INSERT' or new.label is distinct from old.label or new.wording_message_id is distinct from old.wording_message_id then
      -- The reply exists and the Send is terminal, but pending has not yet been
      -- cleared. Only the settlement transaction can reach this interval through
      -- an API capability; other commands refuse pending turns and tables are private.
      if not exists(select 1 from ai.explorer_conversation_operation op
        join ai.ai_interaction_message m on m.ai_interaction_message_id=op.reply_message_id
        where op.actor_user_account_id=st.actor_user_account_id and op.operation_id=st.pending_operation_id
          and op.conversation_id=new.conversation_id and op.kind='send' and op.status='completed'
          and op.safety_protocol_version='explorer-safety-reply.v2' and op.safety_request_mode='classification_and_reply'
          and op.reply_message_id=new.wording_message_id and m.ai_interaction_session_id=new.conversation_id
          and m.sender_type='ai' and m.ai_role='solmind_virtual_guide' and m.sender_user_account_id is null)
        or st.restricted_level is not null or st.adult_reflection_stopped
        or not ai.solmind_compass_suggestion_label_valid(new.label)
        then raise exception 'solmind_explorer_private_formation_conflict'; end if;
    end if;
  elsif tg_op='INSERT' and new.formation_status is not null then
    raise exception 'solmind_explorer_private_formation_conflict';
  end if;
  if (tg_op='INSERT' or new.formation_status is distinct from old.formation_status) and
    (select count(*) from ai.explorer_conversation_compass_item c where c.conversation_id=new.conversation_id
      and c.item_id<>new.item_id and (c.formation_status is not distinct from 'rejected')=(new.formation_status is not distinct from 'rejected'))>=24
    then raise exception 'solmind_explorer_private_formation_limit'; end if;
  return new;
end $$;
alter function ai.solmind_compass_formation_guard() owner to postgres;
revoke all on function ai.solmind_compass_formation_guard() from public,anon,authenticated,service_role;

create trigger explorer_compass_mode_immutable
before update of compass_mode on ai.explorer_conversation_state
for each row execute function ai.solmind_compass_mode_guard_v1();

create trigger explorer_compass_topic_guard
before insert or update or delete on ai.explorer_compass_topic
for each row execute function ai.solmind_automatic_compass_rows_guard_v1();

create trigger explorer_compass_topic_support_guard
before insert or update or delete on ai.explorer_compass_topic_support
for each row execute function ai.solmind_automatic_compass_rows_guard_v1();

create trigger explorer_compass_change_bundle_guard
before insert or update or delete on ai.explorer_compass_change_bundle
for each row execute function ai.solmind_automatic_compass_rows_guard_v1();

create constraint trigger explorer_compass_automatic_proof
after insert on ai.explorer_conversation_compass_item
deferrable initially deferred
for each row
when (new.formation_status = 'automatic')
execute function ai.solmind_automatic_compass_proof_guard_v1();

-- Latest state projection: 20261106000000_explorer_waypoint_active_limits.sql.
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
      'suggestionMessageId',d.suggestion_message_id) from content.waypoint_draft d
      where d.source_ai_interaction_session_id=p_id and d.draft_status='proposed'),
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

-- Latest read: 20261106030000_explorer_failed_reply_reason.sql.
create or replace function public.solmind_read_explorer_conversation_v3(
  p_actor_user_account_id uuid,p_user_session_id uuid,p_conversation_id uuid default null,
  p_operation_id uuid default null,p_command_fingerprint text default null
) returns table(outcome text,conversation_state jsonb,authority_context jsonb,policy_state jsonb)
language plpgsql volatile security definer set search_path='' set lock_timeout='2000ms' set statement_timeout='5000ms' as $$
declare v_id uuid; a jsonb; op ai.explorer_conversation_operation%rowtype; ids uuid[]; replay boolean:=false; forming_move jsonb;
begin
  perform ai.solmind_private_owner_lock_v3(p_actor_user_account_id);
  if (p_operation_id is null) is distinct from (p_command_fingerprint is null)
    or (p_command_fingerprint is not null and p_command_fingerprint !~ '^[0-9A-F]{64}$')
    then raise exception 'solmind_explorer_private_invalid_input'; end if;
  v_id:=p_conversation_id;
  if p_operation_id is not null then
    select x.* into op from ai.explorer_conversation_operation x
      where x.actor_user_account_id=p_actor_user_account_id and x.operation_id=p_operation_id;
    replay:=found;
    if replay then
      if (v_id is not null and v_id is distinct from op.conversation_id)
        or op.application_session_id is distinct from p_user_session_id
        or op.command_fingerprint is distinct from p_command_fingerprint
        then raise exception 'solmind_explorer_private_operation_conflict'; end if;
      v_id:=op.conversation_id;
    end if;
  end if;
  if v_id is null then
    select array_agg(s.ai_interaction_session_id order by s.ai_interaction_session_id) into ids
      from ai.ai_interaction_session s where s.actor_user_account_id=p_actor_user_account_id
        and s.actor_role_context='explorer' and s.session_type='explorer_reflection' and s.session_status='active';
    if coalesce(cardinality(ids),0)>1 then raise exception 'solmind_explorer_private_unavailable'; end if;
    v_id:=ids[1];
  end if;
  if v_id is not null and not exists(select 1 from ai.explorer_conversation_state st
    where st.conversation_id=v_id and st.actor_user_account_id=p_actor_user_account_id)
    then raise exception 'solmind_explorer_private_unavailable'; end if;
  a:=ai.solmind_private_owned_authority_v3(p_actor_user_account_id,p_user_session_id,v_id);
  a:=a||jsonb_build_object('compassEvidence',ai.solmind_compass_evidence_v1(v_id));
  forming_move:=ai.solmind_forming_attention_move_v1(v_id);
  if forming_move is not null then a:=a||jsonb_build_object('formingAttentionMove',forming_move); end if;
  if replay and op.kind='send' and op.status in ('completed','failed','canceled') and op.reply_message_id is null
    and exists(select 1 from ai.ai_model_invocation inv where inv.ai_model_invocation_id=op.invocation_id
      and inv.request_status in ('completed','failed','canceled') and inv.ai_interaction_message_id is null
      and (inv.error_summary in ('deadline','transport_failed','invalid_response',
        'delivery_canceled_before_dispatch','dispatch_not_admitted','trusted_render_unavailable')
        or (op.status='failed' and inv.request_status='failed' and inv.error_summary='provider_unavailable'))) then
    a:=a||jsonb_build_object('replayFailedReply',true);
  end if;
  if (a->>'applicationSessionExpiresAt')::timestamptz<=clock_timestamp()
    then raise exception 'solmind_explorer_private_denied'; end if;
  return query select case when replay then 'exact_replay' else 'ok' end,
    ai.solmind_conversation_state_json(v_id)||jsonb_build_object('waypointCapacity',
      ai.solmind_waypoint_capacity_v1(p_actor_user_account_id,v_id)),a,ai.solmind_private_policy_v3(v_id);
end $$;

-- Latest inspector, methodology validator and 38-argument prepare: 20261106010000_explorer_reply_choice_voice.sql.
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
begin
  outcome:='unavailable'; excluded_entity_type:=null; excluded_entity_id:=null;
  if p_reply_choice is null or pg_catalog.current_setting('transaction_isolation') is distinct from 'read committed'
    or p_actor_user_account_id is null or p_user_session_id is null or p_explorer_profile_id is null
    or p_relationship_id is null or p_conversation_id is null or p_context_serialization is null
    or pg_catalog.octet_length(p_context_serialization) not between 2 and 524288
    or p_context_source_ids is null or pg_catalog.cardinality(p_context_source_ids) not between 3 and 168
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
      then 'wi007-v0.1+onboarding-fields-v2' else 'wi007-v0.1+onboarding-fields-v2+compass-v8' end)
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
      or pg_catalog.char_length(part->>'text') not between 1 and (case when winner_type='methodologyContext' then 24000 else 20000 end)
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
  -- excluding forming points and their transient moves from v8.
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
      'version','explorer-compass-context.v8','mode',case when compass_mode='automatic' then 'automatic' else 'legacy_read_only' end,
      'topics',compass_topics,'messageRefs',jsonb_build_object('history',compass_refs,'immediate','now'),
      'capacity',compass_capacity,'points',compass_points,'priorityId',compass_priority,
      'attentionId',compass_attention,'recentRoute',compass_route,'waypoints',compass_waypoints,'drafts',compass_drafts,
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
  expected_ids:=expected_ids||point_ids||waypoint_ids||draft_ids||topic_ids;
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
      and envelope->>'contractVersion'='wi007-v0.1+onboarding-fields-v2+compass-v8'),false)
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
    or p_context_source_ids is null or cardinality(p_context_source_ids) not between 3 and 168
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

-- Latest settlement: 20261106030000_explorer_failed_reply_reason.sql; keep one identity.
drop function public.solmind_settle_explorer_conversation_turn_v4(uuid,uuid,uuid,uuid,text,uuid,text,text,smallint,boolean,text,text,text,text,text,text,text,smallint,boolean,boolean,uuid,jsonb,jsonb,jsonb,jsonb,jsonb,text);
create function public.solmind_settle_explorer_conversation_turn_v4(
  p_actor_user_account_id uuid,p_user_session_id uuid,p_conversation_id uuid,p_operation_id uuid,
  p_status text,p_reply_message_id uuid,p_reply_kind text,p_reply_body text,
  p_model_level smallint,p_model_minor_indicated boolean,p_protocol_version text,p_request_mode text,
  p_configuration_fingerprint text,p_fallback_policy_version text,p_model_policy_version text,
  p_trusted_response_version text,p_resource_policy_version text,p_fallback_level smallint,
  p_fallback_minor_indicated boolean,p_delivery_interested boolean,p_attention_item_id uuid,p_choices jsonb,p_compass_suggestions jsonb default null,p_compass_responses jsonb default null,p_waypoint_suggestion jsonb default null,p_waypoint_response jsonb default null,
  p_failure_reason text default null,p_compass_topics jsonb default null
) returns table(outcome text,conversation_state jsonb,policy_state jsonb,saved_reply boolean)
language plpgsql volatile security definer set search_path='' set lock_timeout='2000ms' set statement_timeout='5000ms' as $$
declare st ai.explorer_conversation_state%rowtype; op ai.explorer_conversation_operation%rowtype;
  a jsonb; intent text; h text; observed_fallback text; ts timestamptz; n integer;
  may_return boolean:=false; may_save boolean:=false; saved_id uuid; saved_body text; saved_kind text:='none';
  saved_choices jsonb; followed_id uuid; followed_operation_id uuid; followed_label text; follow_hash text; follow_bytes bytea; followed_formation text; suggestion jsonb; suggestion_label text; suggestion_id uuid; suggestion_index integer:=0; item_count integer;
  response jsonb; response_id uuid; response_name text; response_hash text; response_operation_id uuid;
  new_draft_id uuid; automatic_plan jsonb; followed_is_planned boolean:=false;
  previous_reply_id uuid; response_ids uuid[]:=array[]::uuid[]; refined_ids uuid[]:=array[]::uuid[];
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
      else jsonb_build_array('explorer-automatic-compass.v1',p_compass_topics) end);
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
      select previous.ai_interaction_message_id into previous_reply_id
        from ai.ai_interaction_message previous
        join ai.ai_interaction_message current_message on current_message.ai_interaction_message_id=op.message_id
          and current_message.ai_interaction_session_id=p_conversation_id
        where previous.ai_interaction_session_id=p_conversation_id and previous.sender_type='ai'
          and previous.ai_role='solmind_virtual_guide' and previous.sequence_number<current_message.sequence_number
        order by previous.sequence_number desc limit 1;
      if response_id is distinct from new_draft_id and exists(select 1 from content.waypoint_draft d
        where d.source_ai_interaction_session_id=p_conversation_id and d.waypoint_draft_id=response_id
          and d.draft_status='proposed' and d.suggestion_message_id=previous_reply_id)
        and not exists(select 1 from ai.explorer_conversation_operation r
          where r.actor_user_account_id=p_actor_user_account_id and r.conversation_id=p_conversation_id
            and r.kind='respond_waypoint_draft' and r.waypoint_suggestion_draft_id=response_id
            and r.completed_at>=(select m.created_at from ai.ai_interaction_message m
              where m.ai_interaction_message_id=previous_reply_id)) then
        response_hash:=methodology.hash_json(jsonb_build_array('explorer-typed-waypoint-response.v1',p_actor_user_account_id,
          p_user_session_id,p_conversation_id,p_operation_id,response_id,response_name));
        follow_bytes:=substring(extensions.digest(convert_to('explorer-typed-waypoint-response.v1|'||p_actor_user_account_id::text
          ||'|'||p_operation_id::text||'|'||response_id::text,'UTF8'),'sha256') from 1 for 16);
        follow_bytes:=set_byte(set_byte(follow_bytes,6,(get_byte(follow_bytes,6)&15)|80),8,(get_byte(follow_bytes,8)&63)|128);
        response_operation_id:=encode(follow_bytes,'hex')::uuid;
        -- This helper reads the post-Send revision for the receipt and guard.
        -- At either bound it returns false without inserting a receipt.
        perform ai.solmind_apply_waypoint_draft_response(p_actor_user_account_id,p_user_session_id,p_conversation_id,
          response_operation_id,response_hash,response_hash,response_id,response_name,ts,true);
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
alter function public.solmind_settle_explorer_conversation_turn_v4(uuid,uuid,uuid,uuid,text,uuid,text,text,smallint,boolean,text,text,text,text,text,text,text,smallint,boolean,boolean,uuid,jsonb,jsonb,jsonb,jsonb,jsonb,text,jsonb) owner to postgres;
revoke all on function public.solmind_settle_explorer_conversation_turn_v4(uuid,uuid,uuid,uuid,text,uuid,text,text,smallint,boolean,text,text,text,text,text,text,text,smallint,boolean,boolean,uuid,jsonb,jsonb,jsonb,jsonb,jsonb,text,jsonb) from public,anon,authenticated;
grant execute on function public.solmind_settle_explorer_conversation_turn_v4(uuid,uuid,uuid,uuid,text,uuid,text,text,smallint,boolean,text,text,text,text,text,text,text,smallint,boolean,boolean,uuid,jsonb,jsonb,jsonb,jsonb,jsonb,text,jsonb) to service_role;

-- Latest owner: 20261105030000_explorer_typed_suggestion_replies.sql.
create or replace function public.solmind_respond_explorer_compass_suggestion_v1(
  p_actor_user_account_id uuid,p_user_session_id uuid,p_conversation_id uuid,p_operation_id uuid,
  p_expected_revision integer,p_command_fingerprint text,p_item_id uuid,p_response text
) returns table(outcome text,conversation_state jsonb)
language plpgsql volatile security definer set search_path='' set lock_timeout='2000ms' set statement_timeout='5000ms' as $$
declare a jsonb; st ai.explorer_conversation_state%rowtype; point ai.explorer_conversation_compass_item%rowtype;
  op ai.explorer_conversation_operation%rowtype;
  h text; ts timestamptz;
begin
  perform ai.solmind_private_owner_lock_v3(p_actor_user_account_id);
  if p_conversation_id is null or p_operation_id is null or p_expected_revision is null or p_expected_revision<0
    or p_item_id is null or p_response is null or p_response not in ('right','close','not_it')
    or p_command_fingerprint is null or p_command_fingerprint !~ '^[0-9A-F]{64}$'
    then raise exception 'solmind_explorer_private_invalid_input'; end if;
  h:=methodology.hash_json(jsonb_build_array('explorer-compass-suggestion-response.v1',p_user_session_id,p_conversation_id,
    p_expected_revision,p_item_id,p_response,p_command_fingerprint));
  a:=ai.solmind_private_owned_authority_v3(p_actor_user_account_id,p_user_session_id,p_conversation_id);
  select s.* into st from ai.explorer_conversation_state s where s.conversation_id=p_conversation_id for update;
  if not found or st.actor_user_account_id is distinct from p_actor_user_account_id
    then raise exception 'solmind_explorer_private_denied'; end if;
  select o.* into op from ai.explorer_conversation_operation o
    where o.actor_user_account_id=p_actor_user_account_id and o.operation_id=p_operation_id for update;
  if found then
    if op.request_fingerprint is distinct from h or op.command_fingerprint is distinct from p_command_fingerprint
      or op.kind is distinct from 'respond_compass_suggestion' or op.conversation_id is distinct from p_conversation_id
      or op.application_session_id is distinct from p_user_session_id or op.status is distinct from 'completed'
      or op.compass_suggestion_item_id is distinct from p_item_id or op.compass_suggestion_response is distinct from p_response
      then raise exception 'solmind_explorer_private_operation_conflict'; end if;
    if (a->>'applicationSessionExpiresAt')::timestamptz<=clock_timestamp() then raise exception 'solmind_explorer_private_denied'; end if;
    return query select 'exact_replay'::text,ai.solmind_conversation_state_json(p_conversation_id); return;
  end if;
  -- Authenticated exact replay above remains readable; new Compass formation is retired.
  -- The refusal is an answer too: it is given only to a login that has not expired.
  if (a->>'applicationSessionExpiresAt')::timestamptz<=clock_timestamp() then raise exception 'solmind_explorer_private_denied'; end if;
  return query select 'operation_conflict'::text,null::jsonb; return;

  if ai.solmind_private_policy_v3(p_conversation_id)->'known' is distinct from 'true'::jsonb
    or st.restricted_level is not null or st.adult_reflection_stopped then raise exception 'solmind_explorer_private_denied'; end if;
  if st.revision<>p_expected_revision then return query select 'stale_revision'::text,null::jsonb; return; end if;
  -- These pre-write refusals are definite conflicts, never an uncertain reply.
  if st.pending_operation_id is not null then return query select 'operation_conflict'::text,null::jsonb; return; end if;
  select c.* into point from ai.explorer_conversation_compass_item c
    where c.conversation_id=p_conversation_id and c.item_id=p_item_id for update;
  if not found or point.formation_status is distinct from 'proposed' or point.merged_into_item_id is not null
    or point.wording_message_id is null or point.compass_anchor is not null or point.relative_emphasis is not null
    or st.priority_id=p_item_id then raise exception 'solmind_explorer_private_operation_conflict'; end if;
  if p_response='not_it' and (select count(*) from ai.explorer_conversation_compass_item c
    where c.conversation_id=p_conversation_id and c.formation_status='rejected')>=24
    then return query select 'operation_conflict'::text,null::jsonb; return; end if;
  ts:=clock_timestamp();
  -- The locked revision pins the exact stored wording for the shared transition.
  if not ai.solmind_apply_compass_suggestion_response(p_actor_user_account_id,p_conversation_id,p_item_id,p_response)
    then raise exception 'solmind_explorer_private_operation_conflict'; end if;
  insert into ai.explorer_conversation_operation(actor_user_account_id,operation_id,application_session_id,conversation_id,
    kind,request_fingerprint,command_fingerprint,initial_revision,status,completed_at,compass_suggestion_item_id,compass_suggestion_response)
    values(p_actor_user_account_id,p_operation_id,p_user_session_id,p_conversation_id,'respond_compass_suggestion',h,
      p_command_fingerprint,p_expected_revision,'completed',ts,p_item_id,p_response);
  update ai.explorer_conversation_state set revision=revision+1 where conversation_id=p_conversation_id;
  update ai.ai_interaction_session set last_activity_at=ts where ai_interaction_session_id=p_conversation_id;
  if (a->>'applicationSessionExpiresAt')::timestamptz<=clock_timestamp() then raise exception 'solmind_explorer_private_denied'; end if;
  return query select 'ok'::text,ai.solmind_conversation_state_json(p_conversation_id);
end $$;

-- Latest owner: 20261105010000_explorer_forming_compass_points.sql.
create or replace function public.solmind_confirm_explorer_compass_arrangement_v1(
  p_actor_user_account_id uuid,p_user_session_id uuid,p_conversation_id uuid,p_operation_id uuid,
  p_expected_revision integer,p_command_fingerprint text,p_priority_id uuid,p_items jsonb
) returns table(outcome text,conversation_state jsonb)
language plpgsql volatile security definer set search_path='' set lock_timeout='2000ms' set statement_timeout='5000ms' as $$
declare a jsonb; policy jsonb; st ai.explorer_conversation_state%rowtype;
  op ai.explorer_conversation_operation%rowtype; x jsonb; canonical_items jsonb; snapshot jsonb;
  ids uuid[]:=array[]::uuid[]; anchors text[]:=array[]::text[]; point uuid; anchor_name text;
  h text; ts timestamptz; meaningful boolean; n integer;
begin
  perform ai.solmind_private_owner_lock_v3(p_actor_user_account_id);
  if p_conversation_id is null or p_operation_id is null or p_expected_revision is null or p_expected_revision<0
    or p_command_fingerprint is null or p_command_fingerprint !~ '^[0-9A-F]{64}$'
    or p_items is null or jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'solmind_explorer_private_invalid_input'; end if;
  if jsonb_array_length(p_items)>24 then raise exception 'solmind_explorer_private_invalid_input'; end if;
  for x in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(x) is distinct from 'object' then raise exception 'solmind_explorer_private_invalid_input'; end if;
    if (select count(*) from jsonb_object_keys(x))<>3 or not x ?& array['compassItemId','anchor','emphasis']
      or jsonb_typeof(x->'compassItemId') is distinct from 'string'
      or jsonb_typeof(x->'emphasis') is distinct from 'number' then raise exception 'solmind_explorer_private_invalid_input'; end if;
    if length(x->>'compassItemId')<>36 or (x->>'compassItemId') collate "C" !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or x->>'emphasis' not in ('1','2','3') then raise exception 'solmind_explorer_private_invalid_input'; end if;
    point:=(x->>'compassItemId')::uuid;
    if point=any(ids) then raise exception 'solmind_explorer_private_invalid_input'; end if;
    ids:=array_append(ids,point);
    if jsonb_typeof(x->'anchor') is distinct from 'null' then
      if jsonb_typeof(x->'anchor') is distinct from 'string' then raise exception 'solmind_explorer_private_invalid_input'; end if;
      anchor_name:=x->>'anchor';
      if anchor_name not in ('apex','upper_left','upper_right','side_left','side_right','lower_left','lower_center','lower_right')
        or anchor_name=any(anchors) then raise exception 'solmind_explorer_private_invalid_input'; end if;
      anchors:=array_append(anchors,anchor_name);
    end if;
  end loop;
  select coalesce(jsonb_agg(value order by value->>'compassItemId'),'[]'::jsonb) into canonical_items from jsonb_array_elements(p_items);
  h:=methodology.hash_json(jsonb_build_array('compass-arrangement.v1',p_user_session_id,p_conversation_id,
    p_expected_revision,p_priority_id,canonical_items,p_command_fingerprint));
  a:=ai.solmind_private_owned_authority_v3(p_actor_user_account_id,p_user_session_id,p_conversation_id);
  select z.* into st from ai.explorer_conversation_state z where z.conversation_id=p_conversation_id for update;
  if not found or st.actor_user_account_id is distinct from p_actor_user_account_id then raise exception 'solmind_explorer_private_denied'; end if;
  select z.* into op from ai.explorer_conversation_operation z
    where z.actor_user_account_id=p_actor_user_account_id and z.operation_id=p_operation_id for update;
  if found then
    if op.request_fingerprint is distinct from h or op.command_fingerprint is distinct from p_command_fingerprint
      or op.conversation_id is distinct from p_conversation_id or op.kind is distinct from 'confirm_compass_arrangement'
      or op.application_session_id is distinct from p_user_session_id or op.status is distinct from 'completed'
      then raise exception 'solmind_explorer_private_operation_conflict'; end if;
    if (a->>'applicationSessionExpiresAt')::timestamptz<=clock_timestamp() then raise exception 'solmind_explorer_private_denied'; end if;
    return query select 'exact_replay'::text,ai.solmind_conversation_state_json(p_conversation_id); return;
  end if;
  -- Authenticated exact replay above remains readable; new Compass formation is retired.
  -- The refusal is an answer too: it is given only to a login that has not expired.
  if (a->>'applicationSessionExpiresAt')::timestamptz<=clock_timestamp() then raise exception 'solmind_explorer_private_denied'; end if;
  return query select 'operation_conflict'::text,null::jsonb; return;

  policy:=ai.solmind_private_policy_v3(p_conversation_id);
  if policy->'known' is distinct from 'true'::jsonb or st.restricted_level is not null or st.adult_reflection_stopped
    then raise exception 'solmind_explorer_private_denied'; end if;
  if st.revision<>p_expected_revision then return query select 'stale_revision'::text,null::jsonb; return; end if;
  if st.pending_operation_id is not null then return query select 'unavailable'::text,null::jsonb; return; end if;
  perform c.item_id from ai.explorer_conversation_compass_item c where c.conversation_id=p_conversation_id order by c.item_id for update;
  select count(*)::integer into n from ai.explorer_conversation_compass_item c where c.conversation_id=p_conversation_id and c.merged_into_item_id is null and c.formation_status is distinct from 'rejected' and c.formation_status is distinct from 'proposed';
  if n<>cardinality(ids) or exists(select 1 from unnest(ids) id where not exists(
    select 1 from ai.explorer_conversation_compass_item c where c.conversation_id=p_conversation_id and c.item_id=id and c.merged_into_item_id is null and c.formation_status is distinct from 'rejected' and c.formation_status is distinct from 'proposed'))
    or (st.priority_id is not null and p_priority_id is null)
    or (p_priority_id is not null and not exists(select 1 from jsonb_array_elements(canonical_items) i
      where (i->>'compassItemId')::uuid=p_priority_id and i->>'anchor'='apex'))
    or (st.attention_id is not null and exists(select 1 from ai.explorer_conversation_compass_item forming where forming.item_id=st.attention_id and forming.formation_status is distinct from 'proposed') and not exists(select 1 from jsonb_array_elements(canonical_items) i
      where (i->>'compassItemId')::uuid=st.attention_id and i->>'anchor' is not null))
    then raise exception 'solmind_explorer_private_invalid_input'; end if;
  select exists(select 1 from ai.explorer_conversation_compass_item c join jsonb_array_elements(canonical_items) i
      on c.item_id=(i->>'compassItemId')::uuid where c.conversation_id=p_conversation_id and c.merged_into_item_id is null and c.formation_status is distinct from 'rejected' and c.formation_status is distinct from 'proposed'
      and (c.compass_anchor is distinct from i->>'anchor' or c.relative_emphasis is distinct from (i->>'emphasis')::smallint))
    or st.priority_id is distinct from p_priority_id into meaningful;
  select jsonb_build_object('previousPriorityId',st.priority_id,'priorityId',p_priority_id,'items',
    coalesce(jsonb_agg(jsonb_build_object('compassItemId',c.item_id,'label',c.label,'anchor',i->'anchor','emphasis',i->'emphasis')
      order by c.item_id),'[]'::jsonb)) into snapshot
    from ai.explorer_conversation_compass_item c join jsonb_array_elements(canonical_items) i
      on c.item_id=(i->>'compassItemId')::uuid where c.conversation_id=p_conversation_id and c.merged_into_item_id is null and c.formation_status is distinct from 'rejected' and c.formation_status is distinct from 'proposed';
  ts:=clock_timestamp();
  if meaningful then
    -- Both statements remain in this locked transaction; no intermediate layout commits.
    update ai.explorer_conversation_compass_item set compass_anchor=null where conversation_id=p_conversation_id and merged_into_item_id is null and formation_status is distinct from 'rejected' and formation_status is distinct from 'proposed';
    update ai.explorer_conversation_compass_item c set compass_anchor=i->>'anchor',relative_emphasis=(i->>'emphasis')::smallint
      from jsonb_array_elements(canonical_items) i where c.conversation_id=p_conversation_id and c.merged_into_item_id is null and c.formation_status is distinct from 'rejected' and c.formation_status is distinct from 'proposed' and c.item_id=(i->>'compassItemId')::uuid;
    update ai.explorer_conversation_state set priority_id=p_priority_id where conversation_id=p_conversation_id;
  end if;
  insert into ai.explorer_conversation_operation(actor_user_account_id,operation_id,application_session_id,conversation_id,kind,
    request_fingerprint,command_fingerprint,initial_revision,status,completed_at,compass_route_kind,compass_arrangement)
    values(p_actor_user_account_id,p_operation_id,p_user_session_id,p_conversation_id,'confirm_compass_arrangement',h,p_command_fingerprint,
      p_expected_revision,'completed',ts,case when meaningful then 'arrangement_confirmed' else null end,
      case when meaningful then snapshot else null end);
  update ai.explorer_conversation_state set revision=revision+1 where conversation_id=p_conversation_id;
  update ai.ai_interaction_session set last_activity_at=ts where ai_interaction_session_id=p_conversation_id;
  if (a->>'applicationSessionExpiresAt')::timestamptz<=clock_timestamp() then raise exception 'solmind_explorer_private_denied'; end if;
  return query select 'ok'::text,ai.solmind_conversation_state_json(p_conversation_id);
end $$;

-- Latest owner: 20261105010000_explorer_forming_compass_points.sql.
create or replace function public.solmind_confirm_explorer_compass_category_v1(
  p_actor_user_account_id uuid,p_user_session_id uuid,p_conversation_id uuid,p_operation_id uuid,
  p_expected_revision integer,p_command_fingerprint text,p_target_item_id uuid,p_member_item_ids uuid[],p_label text
) returns table(outcome text,conversation_state jsonb)
language plpgsql volatile security definer set search_path='' set lock_timeout='2000ms' as $$
declare a jsonb; policy jsonb; st ai.explorer_conversation_state%rowtype;
  op ai.explorer_conversation_operation%rowtype; ids uuid[]; contributing uuid[];
  snapshot jsonb; old_label text; h text; ts timestamptz; meaningful boolean;
begin
  perform ai.solmind_private_owner_lock_v3(p_actor_user_account_id);
  if p_conversation_id is null or p_operation_id is null or p_expected_revision is null or p_expected_revision<0
    or p_command_fingerprint is null or p_command_fingerprint !~ '^[0-9A-F]{64}$'
    or p_target_item_id is null or p_member_item_ids is null or array_ndims(p_member_item_ids) is distinct from 1
    or array_lower(p_member_item_ids,1) is distinct from 1 or cardinality(p_member_item_ids) not between 1 and 24
    or array_position(p_member_item_ids,null) is not null or not ai.solmind_conversation_text_valid(p_label,160,true)
    then raise exception 'solmind_explorer_private_invalid_input'; end if;
  select array_agg(distinct id order by id) into ids from unnest(p_member_item_ids) id;
  if cardinality(ids)<>cardinality(p_member_item_ids) or not p_target_item_id=any(ids)
    then raise exception 'solmind_explorer_private_invalid_input'; end if;
  h:=methodology.hash_json(jsonb_build_array('compass-category.v1',p_user_session_id,p_conversation_id,
    p_expected_revision,p_target_item_id,to_jsonb(ids),p_label,p_command_fingerprint));
  a:=ai.solmind_private_owned_authority_v3(p_actor_user_account_id,p_user_session_id,p_conversation_id);
  select x.* into st from ai.explorer_conversation_state x where x.conversation_id=p_conversation_id for update;
  if not found or st.actor_user_account_id is distinct from p_actor_user_account_id then raise exception 'solmind_explorer_private_denied'; end if;
  select x.* into op from ai.explorer_conversation_operation x
    where x.actor_user_account_id=p_actor_user_account_id and x.operation_id=p_operation_id for update;
  if found then
    if op.request_fingerprint is distinct from h or op.command_fingerprint is distinct from p_command_fingerprint
      or op.conversation_id is distinct from p_conversation_id or op.kind is distinct from 'confirm_compass_category'
      or op.application_session_id is distinct from p_user_session_id or op.status is distinct from 'completed'
      then raise exception 'solmind_explorer_private_operation_conflict'; end if;
    if (a->>'applicationSessionExpiresAt')::timestamptz<=clock_timestamp() then raise exception 'solmind_explorer_private_denied'; end if;
    return query select 'exact_replay'::text,ai.solmind_conversation_state_json(p_conversation_id); return;
  end if;
  -- Authenticated exact replay above remains readable; new Compass formation is retired.
  -- The refusal is an answer too: it is given only to a login that has not expired.
  if (a->>'applicationSessionExpiresAt')::timestamptz<=clock_timestamp() then raise exception 'solmind_explorer_private_denied'; end if;
  return query select 'operation_conflict'::text,null::jsonb; return;

  policy:=ai.solmind_private_policy_v3(p_conversation_id);
  if policy->'known' is distinct from 'true'::jsonb or st.restricted_level is not null or st.adult_reflection_stopped
    then raise exception 'solmind_explorer_private_denied'; end if;
  if st.revision<>p_expected_revision then return query select 'stale_revision'::text,null::jsonb; return; end if;
  if st.pending_operation_id is not null then return query select 'unavailable'::text,null::jsonb; return; end if;
  perform c.item_id from ai.explorer_conversation_compass_item c where c.conversation_id=p_conversation_id order by c.item_id for update;
  if (select count(*) from ai.explorer_conversation_compass_item c
      where c.conversation_id=p_conversation_id and c.item_id=any(ids) and c.merged_into_item_id is null and c.formation_status is distinct from 'rejected' and c.formation_status is distinct from 'proposed')<>cardinality(ids)
    or (st.priority_id is not null and st.priority_id=any(ids) and st.priority_id<>p_target_item_id)
    or (st.attention_id is not null and st.attention_id=any(ids) and st.attention_id<>p_target_item_id)
    then raise exception 'solmind_explorer_private_invalid_input'; end if;
  with recursive originals(item_id) as (
    select c.item_id from ai.explorer_conversation_compass_item c where c.conversation_id=p_conversation_id and c.item_id=any(ids)
    union
    select c.item_id from ai.explorer_conversation_compass_item c join originals o on c.merged_into_item_id=o.item_id
      where c.conversation_id=p_conversation_id
  ) select array_agg(item_id order by item_id) into contributing from originals;
  if exists(select 1 from ai.explorer_conversation_compass_item c where c.conversation_id=p_conversation_id
    and c.item_id=any(contributing) and not exists(select 1 from ai.ai_interaction_message m
      where m.ai_interaction_message_id=c.source_message_id and m.ai_interaction_session_id=p_conversation_id
        and ((m.sender_type='user' and m.sender_user_account_id=p_actor_user_account_id and m.sender_role_context='explorer')
          or (m.sender_type='ai' and m.ai_role='solmind_virtual_guide' and m.sender_user_account_id is null))))
    then raise exception 'solmind_explorer_private_denied'; end if;
  select c.label into old_label from ai.explorer_conversation_compass_item c where c.conversation_id=p_conversation_id and c.item_id=p_target_item_id;
  meaningful:=cardinality(ids)>1 or old_label is distinct from p_label;
  if meaningful then
    select jsonb_build_object('targetItemId',p_target_item_id,'memberItemIds',to_jsonb(ids),'beforeItems',
      jsonb_agg(jsonb_build_object('compassItemId',c.item_id,'sourceMessageId',c.source_message_id,'label',c.label,
        'mergedIntoItemId',c.merged_into_item_id,'anchor',c.compass_anchor,'emphasis',c.relative_emphasis) order by c.item_id),
      'label',p_label) into snapshot
      from ai.explorer_conversation_compass_item c where c.conversation_id=p_conversation_id and c.item_id=any(contributing);
    update ai.explorer_conversation_compass_item set label=p_label where conversation_id=p_conversation_id and item_id=p_target_item_id;
    update ai.explorer_conversation_compass_item set merged_into_item_id=p_target_item_id
      where conversation_id=p_conversation_id and item_id=any(ids) and item_id<>p_target_item_id;
  end if;
  ts:=clock_timestamp();
  insert into ai.explorer_conversation_operation(actor_user_account_id,operation_id,application_session_id,conversation_id,kind,
    request_fingerprint,command_fingerprint,initial_revision,status,completed_at,compass_route_kind,compass_category_change)
    values(p_actor_user_account_id,p_operation_id,p_user_session_id,p_conversation_id,'confirm_compass_category',h,p_command_fingerprint,
      p_expected_revision,'completed',ts,case when meaningful then 'category_confirmed' else null end,snapshot);
  update ai.explorer_conversation_state set revision=revision+1 where conversation_id=p_conversation_id;
  update ai.ai_interaction_session set last_activity_at=ts where ai_interaction_session_id=p_conversation_id;
  if (a->>'applicationSessionExpiresAt')::timestamptz<=clock_timestamp() then raise exception 'solmind_explorer_private_denied'; end if;
  return query select 'ok'::text,ai.solmind_conversation_state_json(p_conversation_id);
end $$;

-- Latest owner: 20261105010000_explorer_forming_compass_points.sql.
create or replace function ai.solmind_resolve_forming_compass_point(
  p_actor_user_account_id uuid,p_user_session_id uuid,p_conversation_id uuid,p_operation_id uuid,
  p_expected_revision integer,p_item_id uuid,p_expected_label text,p_wording_message_id uuid,
  p_resolution text,p_command_fingerprint text
) returns table(outcome text,conversation_state jsonb)
language plpgsql volatile security definer set search_path='' set lock_timeout='2000ms' set statement_timeout='5000ms' as $$
declare a jsonb; st ai.explorer_conversation_state%rowtype; point ai.explorer_conversation_compass_item%rowtype;
  op ai.explorer_conversation_operation%rowtype; origin ai.explorer_conversation_operation%rowtype;
  h text; kind_name text; ts timestamptz; follow_hash text; follow_bytes bytea; follow_id uuid;
begin
  perform ai.solmind_private_owner_lock_v3(p_actor_user_account_id);
  if p_conversation_id is null or p_operation_id is null or p_expected_revision is null or p_expected_revision<0
    or p_item_id is null or p_wording_message_id is null or not ai.solmind_compass_suggestion_label_valid(p_expected_label)
    or p_resolution is null or p_resolution not in ('confirmed','rejected')
    or p_command_fingerprint is null or p_command_fingerprint !~ '^[0-9A-F]{64}$'
    then raise exception 'solmind_explorer_private_invalid_input'; end if;
  kind_name:=case when p_resolution='confirmed' then 'confirm_compass_point' else 'reject_compass_point' end;
  h:=methodology.hash_json(jsonb_build_array('explorer-compass-resolution.v1',p_user_session_id,p_conversation_id,
    p_expected_revision,p_item_id,p_expected_label,p_wording_message_id,p_resolution,p_command_fingerprint));
  a:=ai.solmind_private_owned_authority_v3(p_actor_user_account_id,p_user_session_id,p_conversation_id);
  select s.* into st from ai.explorer_conversation_state s where s.conversation_id=p_conversation_id for update;
  if not found or st.actor_user_account_id is distinct from p_actor_user_account_id
    then raise exception 'solmind_explorer_private_denied'; end if;
  select o.* into op from ai.explorer_conversation_operation o
    where o.actor_user_account_id=p_actor_user_account_id and o.operation_id=p_operation_id for update;
  if found then
    if op.request_fingerprint is distinct from h or op.command_fingerprint is distinct from p_command_fingerprint
      or op.kind is distinct from kind_name or op.conversation_id is distinct from p_conversation_id
      or op.application_session_id is distinct from p_user_session_id or op.status is distinct from 'completed'
      then raise exception 'solmind_explorer_private_operation_conflict'; end if;
    if (a->>'applicationSessionExpiresAt')::timestamptz<=clock_timestamp() then raise exception 'solmind_explorer_private_denied'; end if;
    return query select 'exact_replay'::text,ai.solmind_conversation_state_json(p_conversation_id); return;
  end if;
  -- Authenticated exact replay above remains readable; new Compass formation is retired.
  -- The refusal is an answer too: it is given only to a login that has not expired.
  if (a->>'applicationSessionExpiresAt')::timestamptz<=clock_timestamp() then raise exception 'solmind_explorer_private_denied'; end if;
  return query select 'operation_conflict'::text,null::jsonb; return;

  if ai.solmind_private_policy_v3(p_conversation_id)->'known' is distinct from 'true'::jsonb
    or st.restricted_level is not null or st.adult_reflection_stopped then raise exception 'solmind_explorer_private_denied'; end if;
  if st.revision<>p_expected_revision then return query select 'stale_revision'::text,null::jsonb; return; end if;
  if st.pending_operation_id is not null then return query select 'unavailable'::text,null::jsonb; return; end if;
  select c.* into point from ai.explorer_conversation_compass_item c
    where c.conversation_id=p_conversation_id and c.item_id=p_item_id for update;
  if not found or point.formation_status is distinct from 'proposed' or point.merged_into_item_id is not null
    or point.label is distinct from p_expected_label or point.wording_message_id is distinct from p_wording_message_id
    or point.compass_anchor is not null or point.relative_emphasis is not null or st.priority_id=p_item_id
    then raise exception 'solmind_explorer_private_formation_conflict'; end if;
  if p_resolution='rejected' and (select count(*) from ai.explorer_conversation_compass_item c
    where c.conversation_id=p_conversation_id and c.formation_status='rejected')>=24
    then return query select 'unavailable'::text,null::jsonb; return; end if;
  ts:=clock_timestamp();
  update ai.explorer_conversation_compass_item set formation_status=p_resolution
    where conversation_id=p_conversation_id and item_id=p_item_id;
  if p_resolution='confirmed' then
    for origin in select o.* from ai.explorer_conversation_operation o
      where o.actor_user_account_id=p_actor_user_account_id
        and o.conversation_id=p_conversation_id and o.status='completed'
        and o.followed_attention_item_id=p_item_id
        and ((o.kind='send' and o.reply_message_id is not null and o.safety_protocol_version='explorer-safety-reply.v2')
          or (o.kind='set_attention' and o.compass_route_kind is null and o.origin_operation_id is null))
        and not exists(select 1 from ai.explorer_conversation_operation followed where followed.actor_user_account_id=p_actor_user_account_id and followed.origin_operation_id=o.operation_id)
      order by o.initial_revision,o.operation_id loop
    follow_hash:=methodology.hash_json(jsonb_build_array('explorer-follow-attention.v1',p_actor_user_account_id,
      origin.application_session_id,p_conversation_id,origin.operation_id,p_item_id));
    follow_bytes:=substring(extensions.digest(convert_to('explorer-follow-attention-operation.v1|'||p_actor_user_account_id::text||'|'||origin.operation_id::text,'UTF8'),'sha256') from 1 for 16);
    follow_bytes:=set_byte(set_byte(follow_bytes,6,(get_byte(follow_bytes,6)&15)|80),8,(get_byte(follow_bytes,8)&63)|128);
    follow_id:=encode(follow_bytes,'hex')::uuid;
    insert into ai.explorer_conversation_operation(actor_user_account_id,operation_id,application_session_id,
      conversation_id,kind,request_fingerprint,command_fingerprint,initial_revision,status,completed_at,
      compass_route_kind,compass_route_item_id,compass_route_label,origin_operation_id)
      values(p_actor_user_account_id,follow_id,origin.application_session_id,p_conversation_id,
        case when origin.kind='send' then 'follow_attention' else 'set_attention' end,
        follow_hash,follow_hash,origin.initial_revision+case when origin.kind='send' then 1 else 0 end,
        'completed',origin.completed_at,'attention_changed',p_item_id,point.label,origin.operation_id);
    end loop;
  end if;
  if st.attention_id=p_item_id and p_resolution='rejected' then
    update ai.explorer_conversation_state set attention_id=null where conversation_id=p_conversation_id;
  end if;
  insert into ai.explorer_conversation_operation(actor_user_account_id,operation_id,application_session_id,conversation_id,
    kind,request_fingerprint,command_fingerprint,initial_revision,status,completed_at)
    values(p_actor_user_account_id,p_operation_id,p_user_session_id,p_conversation_id,kind_name,h,p_command_fingerprint,
      p_expected_revision,'completed',ts);
  update ai.explorer_conversation_state set revision=revision+1 where conversation_id=p_conversation_id;
  update ai.ai_interaction_session set last_activity_at=ts where ai_interaction_session_id=p_conversation_id;
  if (a->>'applicationSessionExpiresAt')::timestamptz<=clock_timestamp() then raise exception 'solmind_explorer_private_denied'; end if;
  return query select 'ok'::text,ai.solmind_conversation_state_json(p_conversation_id);
end $$;

-- Latest owner: 20261106000000_explorer_waypoint_active_limits.sql.
create or replace function public.solmind_mutate_explorer_conversation(
  p_actor_user_account_id uuid,p_user_session_id uuid,p_conversation_id uuid,p_operation_id uuid,
  p_expected_revision integer,p_kind text,p_command_fingerprint text,p_source_message_id uuid default null,p_item_id uuid default null,
  p_waypoint_id uuid default null,p_label text default null,p_destination text default null,
  p_meaning text default null,p_arrival_signal text default null,p_evidence text default null
) returns table(outcome text,conversation_state jsonb)
language plpgsql volatile security definer set search_path = '' set lock_timeout = '2000ms' as $$
declare a jsonb; h text; op ai.explorer_conversation_operation%rowtype;
  st ai.explorer_conversation_state%rowtype; n integer; ts timestamptz;
  route_kind text; selected_label text; route_item uuid; selected_anchor text; selected_formation text; deferred_item uuid;
begin
  perform ai.solmind_private_owner_lock_v3(p_actor_user_account_id);
  if p_conversation_id is null or p_operation_id is null or p_expected_revision is null or p_expected_revision<0
    or p_kind is null or p_kind not in ('add_compass','confirm_priority','set_attention','confirm_waypoint','confirm_reached')
    or p_command_fingerprint is null or p_command_fingerprint !~ '^[0-9A-F]{64}$'
    or not (
      (p_kind='add_compass' and p_source_message_id is not null and p_item_id is null and p_waypoint_id is null
        and ai.solmind_conversation_text_valid(p_label,160,true) and p_destination is null
        and p_meaning is null and p_arrival_signal is null and p_evidence is null)
      or (p_kind in ('confirm_priority','set_attention') and p_source_message_id is null and p_item_id is not null
        and p_waypoint_id is null and p_label is null and p_destination is null
        and p_meaning is null and p_arrival_signal is null and p_evidence is null)
      or (p_kind='confirm_waypoint' and p_source_message_id is not null and p_item_id is null and p_waypoint_id is null
        and p_label is null and ai.solmind_conversation_text_valid(p_destination,1000,false)
        and ai.solmind_conversation_text_valid(p_meaning,1000,false)
        and ai.solmind_conversation_text_valid(p_arrival_signal,1000,false) and p_evidence is null)
      or (p_kind='confirm_reached' and p_source_message_id is null and p_item_id is null and p_waypoint_id is not null
        and p_label is null and p_destination is null and p_meaning is null and p_arrival_signal is null
        and ai.solmind_conversation_text_valid(p_evidence,1000,false)))
  then raise exception 'solmind_explorer_conversation_invalid_input'; end if;
  perform pg_advisory_xact_lock(hashtextextended('solmind:explorer-conversation:v2|'||p_actor_user_account_id::text||'|'||p_operation_id::text,0));
  a:=ai.solmind_conversation_authority(p_actor_user_account_id,p_user_session_id,p_conversation_id);
  select x.* into st from ai.explorer_conversation_state x where x.conversation_id=p_conversation_id for update;
  if not found or st.actor_user_account_id is distinct from p_actor_user_account_id then
    raise exception 'solmind_explorer_conversation_denied'; end if;
  h:=upper(encode(extensions.digest(convert_to(jsonb_build_array(p_user_session_id,p_conversation_id,p_expected_revision,
    p_kind,p_source_message_id,p_item_id,p_waypoint_id,p_label,p_destination,p_meaning,p_arrival_signal,p_evidence,p_command_fingerprint)::text,'UTF8'),'sha256'),'hex'));
  select x.* into op from ai.explorer_conversation_operation x
    where x.actor_user_account_id=p_actor_user_account_id and x.operation_id=p_operation_id for update;
  if found then
    if op.request_fingerprint is distinct from h or op.command_fingerprint is distinct from p_command_fingerprint
      or op.conversation_id is distinct from p_conversation_id
      or op.kind is distinct from p_kind then
      raise exception 'solmind_explorer_conversation_operation_conflict'; end if;
    return query select 'exact_replay'::text,ai.solmind_conversation_state_json(p_conversation_id); return;
  end if;
  -- Authenticated exact replay above remains readable; new Compass formation is retired.
  if p_kind in ('add_compass','confirm_priority') then
    return query select 'operation_conflict'::text,null::jsonb; return;
  end if;

  if st.revision<>p_expected_revision then return query select 'stale_revision'::text,null::jsonb; return; end if;
  if st.pending_operation_id is not null then return query select 'unavailable'::text,null::jsonb; return; end if;
  if p_source_message_id is not null and not exists(select 1 from ai.ai_interaction_message m
    where m.ai_interaction_message_id=p_source_message_id and m.ai_interaction_session_id=p_conversation_id
      and ((m.sender_type='user' and m.sender_user_account_id=p_actor_user_account_id and m.sender_role_context='explorer')
        or (m.sender_type='ai' and m.ai_role='solmind_virtual_guide' and m.sender_user_account_id is null)))
  then raise exception 'solmind_explorer_conversation_denied'; end if;
  ts:=clock_timestamp();
  if p_kind='add_compass' then
    select count(*)::integer into n from ai.explorer_conversation_compass_item c where c.conversation_id=p_conversation_id and c.formation_status is distinct from 'rejected';
    if n>=24 then return query select 'unavailable'::text,null::jsonb; return; end if;
    insert into ai.explorer_conversation_compass_item(item_id,conversation_id,source_message_id,label,display_order)
      values(p_operation_id,p_conversation_id,p_source_message_id,p_label,(select coalesce(max(c.display_order),0)+1 from ai.explorer_conversation_compass_item c where c.conversation_id=p_conversation_id));
  elsif p_kind in ('confirm_priority','set_attention') then
    select c.label,c.compass_anchor,c.formation_status into selected_label,selected_anchor,selected_formation from ai.explorer_conversation_compass_item c
      where c.item_id=p_item_id and c.conversation_id=p_conversation_id and c.merged_into_item_id is null and c.formation_status is distinct from 'rejected' for share;
    if not found then raise exception 'solmind_explorer_conversation_denied'; end if;
    -- The needle may point at any current point, placed or not (Paul's
    -- decision, 2026-11-03 18:05:33 CST). Once a Compass is arranged, only a
    -- new Priority must sit at the apex.
    if p_kind='confirm_priority' and selected_formation='proposed' then raise exception 'solmind_explorer_conversation_denied'; end if;
    if p_kind='confirm_priority' and exists(select 1 from ai.explorer_conversation_compass_item c
      where c.conversation_id=p_conversation_id and c.merged_into_item_id is null and c.formation_status is distinct from 'rejected' and c.relative_emphasis is not null)
      and selected_anchor is distinct from 'apex' then
      raise exception 'solmind_explorer_conversation_denied';
    end if;
    if p_kind='confirm_priority' then
      if st.priority_id is distinct from p_item_id then
        route_kind:=case when st.priority_id is null then 'priority_confirmed' else 'priority_reoriented' end;
        route_item:=p_item_id;
      end if;
      update ai.explorer_conversation_state set priority_id=p_item_id where conversation_id=p_conversation_id;
    else
      if st.attention_id is distinct from p_item_id then
        if selected_formation='proposed' then deferred_item:=p_item_id;
        else route_kind:='attention_changed'; route_item:=p_item_id; end if;
      end if;
      update ai.explorer_conversation_state set attention_id=p_item_id where conversation_id=p_conversation_id;
    end if;
  elsif p_kind='confirm_waypoint' then
    if not ai.solmind_waypoint_insert_allowed_v1(p_actor_user_account_id,p_conversation_id,true) then
      return query select 'unavailable'::text,null::jsonb; return; end if;
    insert into content.waypoint(waypoint_id,guide_explorer_relationship_id,source_ai_interaction_session_id,
      source_message_id,title,destination,why_it_matters,arrival_signal,lifecycle_status,
      chosen_by_explorer_user_account_id,chosen_at)
      values(p_operation_id,(a->>'relationshipId')::uuid,p_conversation_id,p_source_message_id,
        p_destination,p_destination,p_meaning,p_arrival_signal,'chosen',p_actor_user_account_id,ts);
  else
    update content.waypoint set lifecycle_status='reached',reached_at=ts,
      reached_by_explorer_user_account_id=p_actor_user_account_id,reached_evidence=p_evidence
      where waypoint_id=p_waypoint_id and source_ai_interaction_session_id=p_conversation_id
        and chosen_by_explorer_user_account_id=p_actor_user_account_id and lifecycle_status='chosen';
    if not found then raise exception 'solmind_explorer_conversation_denied'; end if;
  end if;
  insert into ai.explorer_conversation_operation(actor_user_account_id,operation_id,application_session_id,
    conversation_id,kind,request_fingerprint,command_fingerprint,initial_revision,status,completed_at,
    compass_route_kind,compass_route_item_id,compass_route_label,followed_attention_item_id)
    values(p_actor_user_account_id,p_operation_id,p_user_session_id,p_conversation_id,p_kind,h,p_command_fingerprint,p_expected_revision,'completed',ts,
      route_kind,route_item,case when route_kind is not null then selected_label else null end,deferred_item);
  update ai.explorer_conversation_state set revision=revision+1 where conversation_id=p_conversation_id;
  update ai.ai_interaction_session set last_activity_at=ts where ai_interaction_session_id=p_conversation_id;
  if (a->>'applicationSessionExpiresAt')::timestamptz<=clock_timestamp() then
    raise exception 'solmind_explorer_conversation_denied'; end if;
  return query select 'ok'::text,ai.solmind_conversation_state_json(p_conversation_id);
end $$;

-- Retired transition helper. Historical exact replay never calls it.
create or replace function ai.solmind_apply_compass_suggestion_response(
  p_actor_user_account_id uuid,p_conversation_id uuid,p_item_id uuid,p_response text
) returns boolean language plpgsql volatile security invoker set search_path='' as $$
begin
  return false;
end $$;

-- Latest ending: 20261105010000_explorer_forming_compass_points.sql.
-- DRAFT automatic_ending_draft requires Paul's approval; historical text is unchanged.
create or replace function public.solmind_end_explorer_conversation_v1(
  p_actor_user_account_id uuid,p_user_session_id uuid,p_conversation_id uuid,p_operation_id uuid,
  p_expected_revision integer,p_command_fingerprint text
) returns table(outcome text,conversation_state jsonb)
language plpgsql volatile security definer set search_path='' set lock_timeout='2000ms' set statement_timeout='5000ms' as $$
declare a jsonb; s ai.ai_interaction_session%rowtype; st ai.explorer_conversation_state%rowtype;
  op ai.explorer_conversation_operation%rowtype; h text; ts timestamptz; priority_label text; attention_label text;
  directions text; route_count bigint;
  automatic_ending_draft constant text := 'This conversation ended.';
begin
  perform ai.solmind_private_owner_lock_v3(p_actor_user_account_id);
  if p_conversation_id is null or p_operation_id is null or p_expected_revision is null or p_expected_revision<0
    or p_command_fingerprint is null or p_command_fingerprint !~ '^[0-9A-F]{64}$' then raise exception 'solmind_explorer_private_invalid_input'; end if;
  select x.* into s from ai.ai_interaction_session x where x.ai_interaction_session_id=p_conversation_id for update;
  if not found or s.actor_user_account_id is distinct from p_actor_user_account_id or s.actor_role_context is distinct from 'explorer'
    or s.session_type is distinct from 'explorer_reflection' or s.session_status not in ('active','ended')
    then raise exception 'solmind_explorer_conversation_denied'; end if;
  if s.session_status='ended' then
    a:=ai.solmind_ended_conversation_authority_v1(p_actor_user_account_id,p_user_session_id,p_conversation_id);
  else
    a:=ai.solmind_private_owned_authority_v3(p_actor_user_account_id,p_user_session_id,p_conversation_id);
  end if;
  select x.* into st from ai.explorer_conversation_state x where x.conversation_id=p_conversation_id for update;
  if not found or st.actor_user_account_id is distinct from p_actor_user_account_id then raise exception 'solmind_explorer_conversation_denied'; end if;
  h:=methodology.hash_json(jsonb_build_array('explorer-conversation-end.v1',p_user_session_id,p_conversation_id,
    p_expected_revision,p_command_fingerprint));
  select x.* into op from ai.explorer_conversation_operation x
    where x.actor_user_account_id=p_actor_user_account_id and x.operation_id=p_operation_id for update;
  if found then
    if op.kind is distinct from 'end_conversation' or op.request_fingerprint is distinct from h
      or op.command_fingerprint is distinct from p_command_fingerprint or op.application_session_id is distinct from p_user_session_id
      or op.conversation_id is distinct from p_conversation_id or op.status is distinct from 'completed'
      or s.session_status is distinct from 'ended' then raise exception 'solmind_explorer_private_operation_conflict'; end if;
    if (a->>'applicationSessionExpiresAt')::timestamptz<=clock_timestamp() then raise exception 'solmind_explorer_conversation_denied'; end if;
    return query select 'exact_replay'::text,ai.solmind_conversation_state_json(p_conversation_id); return;
  end if;
  if s.session_status='ended' then
    if (a->>'applicationSessionExpiresAt')::timestamptz<=clock_timestamp() then raise exception 'solmind_explorer_conversation_denied'; end if;
    return query select 'already_ended'::text,ai.solmind_conversation_state_json(p_conversation_id); return;
  end if;
  if st.revision<>p_expected_revision then return query select 'stale_revision'::text,null::jsonb; return; end if;
  if st.pending_operation_id is not null or exists(select 1 from ai.explorer_conversation_operation o
    where o.conversation_id=p_conversation_id and o.status='started') then
    return query select 'unavailable'::text,null::jsonb; return; end if;
  -- Ending is closure, not reflection. Preserve known/unknown/restricted/adult
  -- policy exactly; no ensure, classification, model, message or reactivation.
  perform c.item_id from ai.explorer_conversation_compass_item c where c.conversation_id=p_conversation_id order by c.item_id for share;
  select c.label into priority_label from ai.explorer_conversation_compass_item c where c.conversation_id=p_conversation_id and c.item_id=st.priority_id;
  select c.label into attention_label from ai.explorer_conversation_compass_item c where c.conversation_id=p_conversation_id and c.item_id=st.attention_id and c.formation_status is distinct from 'proposed' and c.formation_status is distinct from 'rejected';
  select count(*) into route_count from ai.explorer_conversation_operation o where o.conversation_id=p_conversation_id
    and o.compass_route_kind is not null and o.initial_revision<st.revision;
  if st.compass_mode='automatic' then
    directions:=automatic_ending_draft||case when attention_label is null then ' No current-attention point was chosen.'
      else ' Current attention was "'||attention_label||'".' end;
  else
  directions:=case when st.priority_id is null then 'No Priority was confirmed when this conversation ended.'
    else 'The confirmed Priority at the end was "'||priority_label||'".' end;
  directions:=directions||case when st.attention_id is null then ' No current-attention point was chosen.'
    when attention_label is null then ' Current attention was still forming.'
    else ' Current attention was "'||attention_label||'".' end;
  end if;
  directions:=directions||case when route_count=0 then ' There are no recorded Route changes for this conversation.'
    else ' The saved Route records '||route_count::text||' Compass changes. Review that Route for the directions taken.' end;
  ts:=clock_timestamp();
  insert into ai.explorer_conversation_operation(actor_user_account_id,operation_id,application_session_id,conversation_id,kind,
    request_fingerprint,command_fingerprint,initial_revision,status,completed_at,ending_directions_text,ending_route_revision)
    values(p_actor_user_account_id,p_operation_id,p_user_session_id,p_conversation_id,'end_conversation',h,p_command_fingerprint,
      p_expected_revision,'completed',ts,directions,st.revision);
  update ai.explorer_conversation_state set revision=revision+1 where conversation_id=p_conversation_id;
  update ai.ai_interaction_session set session_status='ended',ended_at=ts,last_activity_at=ts where ai_interaction_session_id=p_conversation_id;
  insert into audit.audit_event(event_type,actor_user_account_id,actor_role_context,target_entity_type,target_entity_id,
    action,reason_code,event_summary,metadata,ip_address,user_agent,created_at)
    values('ai_session_ended',p_actor_user_account_id,'explorer','ai_interaction_session',p_conversation_id,
      'end','explorer_ended_session','Explorer ended an AI interaction session.','{}',null,null,ts);
  if (a->>'applicationSessionExpiresAt')::timestamptz<=clock_timestamp() then raise exception 'solmind_explorer_conversation_denied'; end if;
  return query select 'ok'::text,ai.solmind_conversation_state_json(p_conversation_id);
end $$;

comment on column ai.explorer_conversation_operation.followed_attention_item_id is
  'Immutable terminal Send outcome or insert-time Explorer move onto a forming target whose Route event is deferred. NULL on a Send that creates the first automatic Compass point: that needle target is recorded only on its follow_attention child row (origin_operation_id). No wording.';

-- Fail migration on an unexpected overload or widened helper/table privilege.
do $$
declare r record; role_name text;
begin
  if (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='solmind_settle_explorer_conversation_turn_v4')<>1
    or not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname='solmind_settle_explorer_conversation_turn_v4' and p.pronargs=28)
    then raise exception 'solmind_explorer_private_migration_identity'; end if;
  for r in select p.oid,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='ai' and p.proname in ('solmind_compass_evidence_v1','solmind_plan_automatic_compass_v1',
      'solmind_apply_automatic_compass_v1','solmind_compass_additions_valid_v1','solmind_compass_mode_guard_v1',
      'solmind_automatic_compass_rows_guard_v1','solmind_automatic_compass_proof_guard_v1') loop
    foreach role_name in array array['anon','authenticated','service_role'] loop
      if has_function_privilege(role_name,r.oid,'EXECUTE') then raise exception 'solmind_explorer_private_migration_acl'; end if;
    end loop;
  end loop;
  for r in select c.oid,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='ai' and c.relname in ('explorer_compass_topic','explorer_compass_topic_support','explorer_compass_change_bundle') loop
    if not r.relrowsecurity or exists(select 1 from pg_policy p where p.polrelid=r.oid) then
      raise exception 'solmind_explorer_private_migration_acl'; end if;
    foreach role_name in array array['anon','authenticated','service_role'] loop
      if has_table_privilege(role_name,r.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,TRIGGER')
        or has_any_column_privilege(role_name,r.oid,'SELECT,INSERT,UPDATE,REFERENCES') then
        raise exception 'solmind_explorer_private_migration_acl';
      end if;
    end loop;
  end loop;
end $$;
commit;

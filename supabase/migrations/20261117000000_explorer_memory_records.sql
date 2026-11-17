-- Memory, step 1: the Explorer's private memory records only.
-- Nothing here saves during a reply, calls an AI, counts tokens or shows on a
-- screen. Forward only: no existing table, function, trigger or row is changed.
-- Every table is private (row security on, no policy, no API-role grant) and
-- every function is internal (no API role may execute it). Step 2 calls the
-- write functions from the ordinary reply's settlement, after its own login
-- and ownership checks; step 3 adds the bounded read for a later reply.
begin;

-- ---------------------------------------------------------------------------
-- Text and conversation rules shared by every memory record.
-- ---------------------------------------------------------------------------

-- A memory line: at most p_limit characters, counted as the screen counts them.
create function ai.solmind_memory_text_valid_v1(p_text text,p_limit integer)
returns boolean language sql immutable set search_path='' as $$
  select ai.solmind_conversation_text_valid(p_text,p_limit,false) is true
    and (select coalesce(sum(case when ascii(substr(p_text,n,1))>65535 then 2 else 1 end),0)
      from generate_series(1,char_length(p_text)) n)<=p_limit
$$;

-- Memory starts with new conversations only: a conversation takes part in
-- memory only when it was enrolled while it still had no message.
create table ai.explorer_memory_conversation (
  conversation_id uuid primary key
    references ai.explorer_conversation_state(conversation_id),
  actor_user_account_id uuid not null
    references identity.user_account(user_account_id),
  enrolled_at timestamptz not null default clock_timestamp(),
  retention_class text not null default 'sensitive_content'
    check (retention_class = 'sensitive_content'),

  unique (conversation_id, actor_user_account_id)
);

-- May memory drawn from this conversation be used? Not when the conversation
-- is restricted, now or later: the answer is read each time, never copied, so
-- a later restriction excludes everything derived from it at once.
create function ai.solmind_memory_conversation_usable_v1(p_conversation uuid)
returns boolean language sql stable set search_path='' as $$
  select exists(select 1 from ai.explorer_memory_conversation mc
    join ai.explorer_conversation_state st on st.conversation_id=mc.conversation_id
      and st.actor_user_account_id=mc.actor_user_account_id
    where mc.conversation_id=p_conversation and st.restricted_level is null)
$$;

-- May a memory record be written from this conversation now? Only the owner's
-- own active, enrolled, unrestricted conversation with no adults-only stop.
create function ai.solmind_memory_conversation_writable_v1(p_actor uuid,p_conversation uuid)
returns boolean language sql stable set search_path='' as $$
  select exists(select 1 from ai.explorer_memory_conversation mc
    join ai.explorer_conversation_state st on st.conversation_id=mc.conversation_id
    join ai.ai_interaction_session s on s.ai_interaction_session_id=mc.conversation_id
    where mc.conversation_id=p_conversation and mc.actor_user_account_id=p_actor
      and st.actor_user_account_id=p_actor and s.actor_user_account_id=p_actor
      and s.actor_role_context='explorer' and s.session_type='explorer_reflection'
      and s.session_status='active' and st.safety_contract_version is not null
      and st.restricted_level is null and st.adult_reflection_stopped is false)
$$;

-- The one place that decides whether a source message may still support
-- memory. Today: its conversation is usable. A later hidden-or-deleted message
-- mark belongs here, so every derived memory line follows it at once.
create function ai.solmind_memory_message_usable_v1(p_message uuid)
returns boolean language sql stable set search_path='' as $$
  select exists(select 1 from ai.ai_interaction_message m
    where m.ai_interaction_message_id=p_message
      and ai.solmind_memory_conversation_usable_v1(m.ai_interaction_session_id))
$$;

-- May a message be newly cited as a source? It must be usable, and its
-- conversation must have no adults-only stop: a blocked outcome supports no
-- new memory, from that conversation or from any other. (Whether that stop
-- also hides memory saved earlier awaits Paul's answer; today it does not.)
create function ai.solmind_memory_message_citable_v1(p_message uuid)
returns boolean language sql stable set search_path='' as $$
  select ai.solmind_memory_message_usable_v1(p_message)
    and exists(select 1 from ai.ai_interaction_message m join ai.explorer_conversation_state st
        on st.conversation_id=m.ai_interaction_session_id
      where m.ai_interaction_message_id=p_message and st.adult_reflection_stopped is false)
$$;

-- When a record names the Send that produced it, that Send must be a completed
-- Send of the same owner in the same conversation.
create function ai.solmind_memory_operation_valid_v1(p_actor uuid,p_conversation uuid,p_operation uuid)
returns boolean language sql stable set search_path='' as $$
  select p_operation is null or exists(select 1 from ai.explorer_conversation_operation op
    where op.actor_user_account_id=p_actor and op.operation_id=p_operation
      and op.conversation_id=p_conversation and op.kind='send' and op.status='completed')
$$;

-- Whose message is it, for this owner? 'explorer' for the owner's own message
-- that received a reply, 'virtual_guide' for that reply, null for anything
-- else (another person's message, an unanswered or crisis-check-only message).
create function ai.solmind_memory_source_speaker_v1(p_actor uuid,p_message uuid)
returns text language sql stable set search_path='' as $$
  select case
    when m.sender_type='user' and m.sender_role_context='explorer' and m.sender_user_account_id=p_actor
      and exists(select 1 from ai.explorer_conversation_operation op
        where op.actor_user_account_id=p_actor and op.conversation_id=m.ai_interaction_session_id
          and op.kind='send' and op.status='completed' and op.safety_request_mode='classification_and_reply'
          and op.message_id=m.ai_interaction_message_id and op.reply_message_id is not null)
      then 'explorer'
    when m.sender_type='ai' and m.ai_role='solmind_virtual_guide' and m.sender_user_account_id is null
      and exists(select 1 from ai.explorer_conversation_operation op
        where op.actor_user_account_id=p_actor and op.conversation_id=m.ai_interaction_session_id
          and op.kind='send' and op.status='completed' and op.safety_request_mode='classification_and_reply'
          and op.reply_message_id=m.ai_interaction_message_id)
      then 'virtual_guide'
    end
  from ai.ai_interaction_message m join ai.explorer_conversation_state st
    on st.conversation_id=m.ai_interaction_session_id and st.actor_user_account_id=p_actor
  where m.ai_interaction_message_id=p_message
$$;

-- A record that says who named something always points at the message that
-- supports it, from the same conversation. "Named by the Explorer" needs the
-- Explorer's own answered message; the Virtual Guide's reading needs an
-- answered message or its reply. The whole message is the source (place not
-- pinned); nothing is saved before a conversation has an answered message.
create function ai.solmind_memory_named_source_valid_v1(p_actor uuid,p_conversation uuid,p_named_by text,p_message uuid)
returns boolean language sql stable set search_path='' as $$
  select case
    when p_named_by is null or p_named_by not in ('explorer','virtual_guide') then false
    when p_message is null then false
    when not ai.solmind_memory_message_citable_v1(p_message) then false
    else exists(select 1 from ai.ai_interaction_message m where m.ai_interaction_message_id=p_message
        and m.ai_interaction_session_id=p_conversation)
      and case when p_named_by='explorer'
        then ai.solmind_memory_source_speaker_v1(p_actor,p_message) is not distinct from 'explorer'
        else ai.solmind_memory_source_speaker_v1(p_actor,p_message) is not null end
    end
$$;

-- ---------------------------------------------------------------------------
-- Topics: one lasting identity per topic for one Explorer, across
-- conversations, with every wording it has had and its broad-narrow links.
-- ---------------------------------------------------------------------------

create table ai.explorer_memory_topic (
  topic_id uuid primary key,
  actor_user_account_id uuid not null
    references identity.user_account(user_account_id),
  created_conversation_id uuid not null,
  created_at timestamptz not null default clock_timestamp(),
  retention_class text not null default 'sensitive_content'
    check (retention_class = 'sensitive_content'),

  unique (topic_id, actor_user_account_id),

  foreign key (created_conversation_id, actor_user_account_id)
    references ai.explorer_memory_conversation(conversation_id, actor_user_account_id)
);

-- Each wording is kept; the highest number is the current label. A wording is
-- the Virtual Guide's reading unless the Explorer named it in a message. Every
-- wording has a supporting message, so it follows that message's fate.
create table ai.explorer_memory_topic_wording (
  topic_id uuid not null,
  wording_number integer not null check (wording_number >= 1),
  actor_user_account_id uuid not null,
  label text collate "C" not null
    check (ai.solmind_compass_suggestion_label_valid(label) is true),
  named_by text not null check (named_by in ('explorer','virtual_guide')),
  source_message_id uuid not null
    references ai.ai_interaction_message(ai_interaction_message_id),
  recorded_conversation_id uuid not null,
  recorded_operation_id uuid null,
  recorded_at timestamptz not null default clock_timestamp(),
  retention_class text not null default 'sensitive_content'
    check (retention_class = 'sensitive_content'),

  primary key (topic_id, wording_number),

  foreign key (topic_id, actor_user_account_id)
    references ai.explorer_memory_topic(topic_id, actor_user_account_id),
  foreign key (recorded_conversation_id, actor_user_account_id)
    references ai.explorer_memory_conversation(conversation_id, actor_user_account_id),
  foreign key (actor_user_account_id, recorded_operation_id)
    references ai.explorer_conversation_operation(actor_user_account_id, operation_id)
);

-- A link from a broad topic to a narrower one. Both topics belong to the same
-- Explorer (the two foreign keys carry the owner). It is read in both
-- directions. Removing a link stamps it; the row stays as history.
create table ai.explorer_memory_topic_link (
  link_id uuid primary key,
  actor_user_account_id uuid not null,
  broad_topic_id uuid not null,
  narrow_topic_id uuid not null,
  named_by text not null check (named_by in ('explorer','virtual_guide')),
  source_message_id uuid not null
    references ai.ai_interaction_message(ai_interaction_message_id),
  recorded_conversation_id uuid not null,
  recorded_operation_id uuid null,
  recorded_at timestamptz not null default clock_timestamp(),
  retired_at timestamptz null,
  retired_conversation_id uuid null,
  retention_class text not null default 'sensitive_content'
    check (retention_class = 'sensitive_content'),

  check (broad_topic_id <> narrow_topic_id),
  check ((retired_at is null) = (retired_conversation_id is null)),

  foreign key (broad_topic_id, actor_user_account_id)
    references ai.explorer_memory_topic(topic_id, actor_user_account_id),
  foreign key (narrow_topic_id, actor_user_account_id)
    references ai.explorer_memory_topic(topic_id, actor_user_account_id),
  foreign key (recorded_conversation_id, actor_user_account_id)
    references ai.explorer_memory_conversation(conversation_id, actor_user_account_id),
  foreign key (retired_conversation_id, actor_user_account_id)
    references ai.explorer_memory_conversation(conversation_id, actor_user_account_id),
  foreign key (actor_user_account_id, recorded_operation_id)
    references ai.explorer_conversation_operation(actor_user_account_id, operation_id)
);
create unique index explorer_memory_topic_link_current_idx
  on ai.explorer_memory_topic_link (broad_topic_id, narrow_topic_id) where retired_at is null;
create index explorer_memory_topic_link_narrow_idx
  on ai.explorer_memory_topic_link (narrow_topic_id) where retired_at is null;

-- Which lasting topic a Compass topic of one conversation is. A new
-- conversation's Compass starts empty; when an earlier topic returns there,
-- its new Compass topic is bound to the same lasting topic.
create table ai.explorer_memory_topic_compass (
  conversation_id uuid not null,
  compass_topic_id uuid not null,
  memory_topic_id uuid not null,
  actor_user_account_id uuid not null,
  recorded_at timestamptz not null default clock_timestamp(),
  retention_class text not null default 'sensitive_content'
    check (retention_class = 'sensitive_content'),

  primary key (conversation_id, compass_topic_id),

  foreign key (conversation_id, compass_topic_id)
    references ai.explorer_compass_topic(conversation_id, topic_id),
  foreign key (memory_topic_id, actor_user_account_id)
    references ai.explorer_memory_topic(topic_id, actor_user_account_id),
  foreign key (conversation_id, actor_user_account_id)
    references ai.explorer_memory_conversation(conversation_id, actor_user_account_id)
);
create index explorer_memory_topic_compass_topic_idx
  on ai.explorer_memory_topic_compass (memory_topic_id);

-- ---------------------------------------------------------------------------
-- Memory points: a short saved summary, every version of its wording, the
-- messages that support each version, and its dated history.
-- ---------------------------------------------------------------------------

-- entry_kind leaves room for the other kinds of entry the memory map names;
-- only the memory point exists today.
create table ai.explorer_memory_point (
  point_id uuid primary key,
  actor_user_account_id uuid not null
    references identity.user_account(user_account_id),
  entry_kind text not null default 'memory_point'
    check (entry_kind in ('memory_point')),
  created_conversation_id uuid not null,
  created_at timestamptz not null default clock_timestamp(),
  retention_class text not null default 'sensitive_content'
    check (retention_class = 'sensitive_content'),

  unique (point_id, actor_user_account_id),

  foreign key (created_conversation_id, actor_user_account_id)
    references ai.explorer_memory_conversation(conversation_id, actor_user_account_id)
);
create index explorer_memory_point_actor_idx
  on ai.explorer_memory_point (actor_user_account_id);

-- A correction adds the next version; earlier versions are never changed.
-- whose_words says whether the line rests on the Explorer's own words or is
-- the Virtual Guide's reading. Saving a reading never makes it a fact or an
-- Explorer-confirmed Reflection.
create table ai.explorer_memory_point_version (
  point_id uuid not null,
  version_number integer not null check (version_number >= 1),
  actor_user_account_id uuid not null,
  summary_text text not null
    check (ai.solmind_memory_text_valid_v1(summary_text, 400) is true),
  whose_words text not null
    check (whose_words in ('explorer_words','virtual_guide_reading')),
  is_highlight boolean not null default false,
  recorded_conversation_id uuid not null,
  recorded_operation_id uuid null,
  recorded_at timestamptz not null default clock_timestamp(),
  retention_class text not null default 'sensitive_content'
    check (retention_class = 'sensitive_content'),

  primary key (point_id, version_number),
  unique (point_id, version_number, actor_user_account_id),

  foreign key (point_id, actor_user_account_id)
    references ai.explorer_memory_point(point_id, actor_user_account_id),
  foreign key (recorded_conversation_id, actor_user_account_id)
    references ai.explorer_memory_conversation(conversation_id, actor_user_account_id),
  foreign key (actor_user_account_id, recorded_operation_id)
    references ai.explorer_conversation_operation(actor_user_account_id, operation_id)
);

-- Where a version came from: the supporting message and, when the place is
-- pinned, the exact stretch of it (a zero-based offset and a length in the
-- saved message text, both counted in Unicode code points, not UTF-16 units). No offsets means the whole message, place not
-- pinned. The words themselves are never copied here.
create table ai.explorer_memory_point_source (
  point_id uuid not null,
  version_number integer not null,
  source_slot smallint not null check (source_slot between 1 and 16),
  actor_user_account_id uuid not null,
  source_message_id uuid not null
    references ai.ai_interaction_message(ai_interaction_message_id),
  source_conversation_id uuid not null,
  speaker text not null check (speaker in ('explorer','virtual_guide')),
  span_start integer null,
  span_length integer null,
  created_at timestamptz not null default clock_timestamp(),
  retention_class text not null default 'sensitive_content'
    check (retention_class = 'sensitive_content'),

  primary key (point_id, version_number, source_slot),
  check ((span_start is null) = (span_length is null)),
  check (span_start is null or (span_start >= 0 and span_length >= 1)),

  foreign key (point_id, version_number, actor_user_account_id)
    references ai.explorer_memory_point_version(point_id, version_number, actor_user_account_id),
  foreign key (source_conversation_id, actor_user_account_id)
    references ai.explorer_memory_conversation(conversation_id, actor_user_account_id)
);
create unique index explorer_memory_point_source_place_idx
  on ai.explorer_memory_point_source (point_id, version_number, source_message_id, (coalesce(span_start, -1)));
create index explorer_memory_point_source_message_idx
  on ai.explorer_memory_point_source (source_message_id);

-- "Built from": one version of a point rests on one version of another point,
-- and on whether that point was retired at the time. The caller says which
-- version and which state it composed from; the save is refused if either has
-- changed. The row stops being usable when that point's sources do, and it
-- goes stale (is not given out until corrected again) when that point is
-- corrected or retired afterwards. This is separate from the broad-narrow topic links, which only
-- say how topics relate.
create table ai.explorer_memory_point_dependency (
  point_id uuid not null,
  version_number integer not null,
  depends_on_point_id uuid not null,
  depends_on_version_number integer not null,
  depends_on_retired boolean not null,
  actor_user_account_id uuid not null,
  created_at timestamptz not null default clock_timestamp(),
  retention_class text not null default 'sensitive_content'
    check (retention_class = 'sensitive_content'),

  primary key (point_id, version_number, depends_on_point_id),
  check (point_id <> depends_on_point_id),

  foreign key (point_id, version_number, actor_user_account_id)
    references ai.explorer_memory_point_version(point_id, version_number, actor_user_account_id),
  foreign key (depends_on_point_id, depends_on_version_number, actor_user_account_id)
    references ai.explorer_memory_point_version(point_id, version_number, actor_user_account_id)
);
create index explorer_memory_point_dependency_reverse_idx
  on ai.explorer_memory_point_dependency (depends_on_point_id);

-- Dated history beside the versions. 'retired' is "that doesn't apply any
-- more": the point stops being the current picture and everything stays as
-- history. 'dated_note' is a dated update. Step 2 adds its own kinds.
create table ai.explorer_memory_point_event (
  event_id uuid primary key,
  point_id uuid not null,
  actor_user_account_id uuid not null,
  event_kind text not null check (event_kind in ('retired','dated_note')),
  note_text text null
    check (note_text is null or ai.solmind_memory_text_valid_v1(note_text, 400) is true),
  source_message_id uuid not null
    references ai.ai_interaction_message(ai_interaction_message_id),
  recorded_conversation_id uuid not null,
  recorded_operation_id uuid null,
  recorded_at timestamptz not null default clock_timestamp(),
  retention_class text not null default 'sensitive_content'
    check (retention_class = 'sensitive_content'),

  check (event_kind <> 'dated_note' or note_text is not null),

  foreign key (point_id, actor_user_account_id)
    references ai.explorer_memory_point(point_id, actor_user_account_id),
  foreign key (recorded_conversation_id, actor_user_account_id)
    references ai.explorer_memory_conversation(conversation_id, actor_user_account_id),
  foreign key (actor_user_account_id, recorded_operation_id)
    references ai.explorer_conversation_operation(actor_user_account_id, operation_id)
);
create unique index explorer_memory_point_one_retirement_idx
  on ai.explorer_memory_point_event (point_id) where event_kind = 'retired';
create index explorer_memory_point_event_point_idx
  on ai.explorer_memory_point_event (point_id, recorded_at);

-- Which topics a point belongs to. Detaching stamps the row; it stays.
create table ai.explorer_memory_point_topic (
  attachment_id uuid primary key,
  point_id uuid not null,
  topic_id uuid not null,
  actor_user_account_id uuid not null,
  recorded_conversation_id uuid not null,
  recorded_at timestamptz not null default clock_timestamp(),
  retired_at timestamptz null,
  retired_conversation_id uuid null,
  retention_class text not null default 'sensitive_content'
    check (retention_class = 'sensitive_content'),

  check ((retired_at is null) = (retired_conversation_id is null)),

  foreign key (point_id, actor_user_account_id)
    references ai.explorer_memory_point(point_id, actor_user_account_id),
  foreign key (topic_id, actor_user_account_id)
    references ai.explorer_memory_topic(topic_id, actor_user_account_id),
  foreign key (recorded_conversation_id, actor_user_account_id)
    references ai.explorer_memory_conversation(conversation_id, actor_user_account_id),
  foreign key (retired_conversation_id, actor_user_account_id)
    references ai.explorer_memory_conversation(conversation_id, actor_user_account_id)
);
create unique index explorer_memory_point_topic_current_idx
  on ai.explorer_memory_point_topic (point_id, topic_id) where retired_at is null;
create index explorer_memory_point_topic_topic_idx
  on ai.explorer_memory_point_topic (topic_id) where retired_at is null;

alter table ai.explorer_memory_conversation owner to postgres;
alter table ai.explorer_memory_topic owner to postgres;
alter table ai.explorer_memory_topic_wording owner to postgres;
alter table ai.explorer_memory_topic_link owner to postgres;
alter table ai.explorer_memory_topic_compass owner to postgres;
alter table ai.explorer_memory_point owner to postgres;
alter table ai.explorer_memory_point_version owner to postgres;
alter table ai.explorer_memory_point_source owner to postgres;
alter table ai.explorer_memory_point_dependency owner to postgres;
alter table ai.explorer_memory_point_event owner to postgres;
alter table ai.explorer_memory_point_topic owner to postgres;

alter table ai.explorer_memory_conversation enable row level security;
alter table ai.explorer_memory_topic enable row level security;
alter table ai.explorer_memory_topic_wording enable row level security;
alter table ai.explorer_memory_topic_link enable row level security;
alter table ai.explorer_memory_topic_compass enable row level security;
alter table ai.explorer_memory_point enable row level security;
alter table ai.explorer_memory_point_version enable row level security;
alter table ai.explorer_memory_point_source enable row level security;
alter table ai.explorer_memory_point_dependency enable row level security;
alter table ai.explorer_memory_point_event enable row level security;
alter table ai.explorer_memory_point_topic enable row level security;

revoke all on
  ai.explorer_memory_conversation,
  ai.explorer_memory_topic,
  ai.explorer_memory_topic_wording,
  ai.explorer_memory_topic_link,
  ai.explorer_memory_topic_compass,
  ai.explorer_memory_point,
  ai.explorer_memory_point_version,
  ai.explorer_memory_point_source,
  ai.explorer_memory_point_dependency,
  ai.explorer_memory_point_event,
  ai.explorer_memory_point_topic
from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- What stays usable. Nothing is deleted when a conversation becomes
-- restricted: every record it wrote, or that rests on one of its messages,
-- simply stops being returned. One rule for every record: it is usable only
-- while every conversation that wrote any part of it is usable. So a wording
-- that was corrected, or a point that was retired, in a conversation that
-- later became restricted is never shown again in its earlier form. The one
-- exception is a dated note: a note from a restricted conversation is left
-- out by itself and the point it was added to stays.
-- ---------------------------------------------------------------------------

create function ai.solmind_memory_topic_usable_v1(p_topic uuid)
returns boolean language sql stable set search_path='' as $$
  select exists(select 1 from ai.explorer_memory_topic t where t.topic_id=p_topic
      and ai.solmind_memory_conversation_usable_v1(t.created_conversation_id))
    and not exists(select 1 from ai.explorer_memory_topic_wording w where w.topic_id=p_topic
      and (not ai.solmind_memory_conversation_usable_v1(w.recorded_conversation_id)
        or (w.source_message_id is not null
          and not ai.solmind_memory_message_usable_v1(w.source_message_id))))
$$;

-- Everything a point was ever built from counts, through every version. For
-- the points it was built from, a dated note that is no longer usable counts
-- too, because the built point may carry what that note said.
create function ai.solmind_memory_point_usable_v1(p_point uuid)
returns boolean language sql stable set search_path='' as $$
  with recursive built_from(point_id) as (
    select p_point
    union
    select d.depends_on_point_id from ai.explorer_memory_point_dependency d
      join built_from b on d.point_id=b.point_id
  )
  select exists(select 1 from ai.explorer_memory_point p where p.point_id=p_point)
    and not exists(select 1 from built_from b where
      exists(select 1 from ai.explorer_memory_point p where p.point_id=b.point_id
        and not ai.solmind_memory_conversation_usable_v1(p.created_conversation_id))
      or exists(select 1 from ai.explorer_memory_point_version v where v.point_id=b.point_id
        and not ai.solmind_memory_conversation_usable_v1(v.recorded_conversation_id))
      or exists(select 1 from ai.explorer_memory_point_source s where s.point_id=b.point_id
        and (not ai.solmind_memory_conversation_usable_v1(s.source_conversation_id)
          or not ai.solmind_memory_message_usable_v1(s.source_message_id)))
      or exists(select 1 from ai.explorer_memory_point_event e where e.point_id=b.point_id
        and (e.event_kind<>'dated_note' or b.point_id<>p_point)
        and (not ai.solmind_memory_conversation_usable_v1(e.recorded_conversation_id)
          or not ai.solmind_memory_message_usable_v1(e.source_message_id))))
$$;

-- Is a point's current wording out of date? Yes when a point its current
-- version was built from has since been corrected or retired, at any depth.
-- A stale point is not given out until it is corrected again, with the full
-- list of what the new wording is built from.
create function ai.solmind_memory_point_stale_v1(p_point uuid)
returns boolean language sql stable set search_path='' as $$
  with recursive chain(point_id) as (
    select p_point
    union
    select d.depends_on_point_id from ai.explorer_memory_point_dependency d
      join chain c on d.point_id=c.point_id
    where d.version_number=(select max(v.version_number) from ai.explorer_memory_point_version v
      where v.point_id=d.point_id)
  )
  select exists(select 1 from chain c
    join ai.explorer_memory_point_dependency d on d.point_id=c.point_id
    where d.version_number=(select max(v.version_number) from ai.explorer_memory_point_version v
        where v.point_id=d.point_id)
      and (d.depends_on_version_number<>(select max(v.version_number)
          from ai.explorer_memory_point_version v where v.point_id=d.depends_on_point_id)
        or (d.depends_on_retired is false and exists(select 1 from ai.explorer_memory_point_event e
          where e.point_id=d.depends_on_point_id and e.event_kind='retired'))))
$$;

-- Would a new broad-to-narrow link close a circle? Yes when the narrow topic
-- already leads down to the broad one through current links.
create function ai.solmind_memory_link_would_cycle_v1(p_broad uuid,p_narrow uuid)
returns boolean language sql stable set search_path='' as $$
  with recursive below(topic_id) as (
    select p_narrow
    union
    select l.narrow_topic_id from ai.explorer_memory_topic_link l
      join below b on l.broad_topic_id=b.topic_id where l.retired_at is null
  )
  select p_broad is not distinct from p_narrow or exists(select 1 from below where topic_id=p_broad)
$$;

create function ai.solmind_memory_dependency_would_cycle_v1(p_point uuid,p_depends_on uuid)
returns boolean language sql stable set search_path='' as $$
  with recursive built_from(point_id) as (
    select p_depends_on
    union
    select d.depends_on_point_id from ai.explorer_memory_point_dependency d
      join built_from b on d.point_id=b.point_id
  )
  select p_point is not distinct from p_depends_on or exists(select 1 from built_from where point_id=p_point)
$$;

-- ---------------------------------------------------------------------------
-- Guards on the tables themselves, whoever writes: rows are kept (no delete,
-- no rewrite), each belongs to one Explorer, and each rule above holds.
-- ---------------------------------------------------------------------------

create function ai.solmind_memory_rows_guard_v1() returns trigger
language plpgsql set search_path='' as $$
declare speaker text; expected integer; body_length integer;
begin
  if tg_op='DELETE' then raise exception 'solmind_explorer_memory_immutable'; end if;
  if tg_op='UPDATE' then
    -- The only change ever allowed: stamping a current link or attachment as removed.
    if tg_table_name not in ('explorer_memory_topic_link','explorer_memory_point_topic') then
      raise exception 'solmind_explorer_memory_immutable'; end if;
    if old.retired_at is not null or new.retired_at is null or new.retired_conversation_id is null
      or (to_jsonb(new)-array['retired_at','retired_conversation_id'])
        is distinct from (to_jsonb(old)-array['retired_at','retired_conversation_id'])
      or not ai.solmind_memory_conversation_writable_v1(new.actor_user_account_id,new.retired_conversation_id)
      then raise exception 'solmind_explorer_memory_immutable'; end if;
    return new;
  end if;

  perform ai.solmind_private_owner_lock_v3(new.actor_user_account_id);

  if tg_table_name='explorer_memory_conversation' then
    if not exists(select 1 from ai.explorer_conversation_state st join ai.ai_interaction_session s
          on s.ai_interaction_session_id=st.conversation_id
        where st.conversation_id=new.conversation_id and st.actor_user_account_id=new.actor_user_account_id
          and s.actor_user_account_id=new.actor_user_account_id and s.actor_role_context='explorer'
          and s.session_type='explorer_reflection' and s.session_status='active'
          and st.safety_contract_version is not null)
      or exists(select 1 from ai.ai_interaction_message m where m.ai_interaction_session_id=new.conversation_id)
      then raise exception 'solmind_explorer_memory_conflict'; end if;

  elsif tg_table_name='explorer_memory_topic' then
    if not ai.solmind_memory_conversation_writable_v1(new.actor_user_account_id,new.created_conversation_id)
      then raise exception 'solmind_explorer_memory_conflict'; end if;

  elsif tg_table_name='explorer_memory_topic_wording' then
    select coalesce(max(w.wording_number),0)+1 into expected
      from ai.explorer_memory_topic_wording w where w.topic_id=new.topic_id;
    if new.wording_number<>expected
      or not ai.solmind_memory_operation_valid_v1(new.actor_user_account_id,new.recorded_conversation_id,
        new.recorded_operation_id)
      or not ai.solmind_memory_conversation_writable_v1(new.actor_user_account_id,new.recorded_conversation_id)
      or not ai.solmind_memory_named_source_valid_v1(new.actor_user_account_id,new.recorded_conversation_id,
        new.named_by,new.source_message_id)
      then raise exception 'solmind_explorer_memory_conflict'; end if;

  elsif tg_table_name='explorer_memory_topic_link' then
    if new.retired_at is not null or new.retired_conversation_id is not null
      or not ai.solmind_memory_operation_valid_v1(new.actor_user_account_id,new.recorded_conversation_id,
        new.recorded_operation_id)
      or not ai.solmind_memory_conversation_writable_v1(new.actor_user_account_id,new.recorded_conversation_id)
      or not ai.solmind_memory_named_source_valid_v1(new.actor_user_account_id,new.recorded_conversation_id,
        new.named_by,new.source_message_id)
      then raise exception 'solmind_explorer_memory_conflict'; end if;
    if ai.solmind_memory_link_would_cycle_v1(new.broad_topic_id,new.narrow_topic_id)
      then raise exception 'solmind_explorer_memory_cycle'; end if;

  elsif tg_table_name='explorer_memory_topic_compass' then
    if not ai.solmind_memory_conversation_writable_v1(new.actor_user_account_id,new.conversation_id)
      or not exists(select 1 from ai.explorer_compass_topic t where t.conversation_id=new.conversation_id
        and t.topic_id=new.compass_topic_id and t.actor_user_account_id=new.actor_user_account_id)
      then raise exception 'solmind_explorer_memory_conflict'; end if;

  elsif tg_table_name='explorer_memory_point' then
    if not ai.solmind_memory_conversation_writable_v1(new.actor_user_account_id,new.created_conversation_id)
      then raise exception 'solmind_explorer_memory_conflict'; end if;

  elsif tg_table_name='explorer_memory_point_version' then
    select coalesce(max(v.version_number),0)+1 into expected
      from ai.explorer_memory_point_version v where v.point_id=new.point_id;
    if new.version_number<>expected
      or not ai.solmind_memory_operation_valid_v1(new.actor_user_account_id,new.recorded_conversation_id,
        new.recorded_operation_id)
      or not ai.solmind_memory_conversation_writable_v1(new.actor_user_account_id,new.recorded_conversation_id)
      then raise exception 'solmind_explorer_memory_conflict'; end if;

  elsif tg_table_name='explorer_memory_point_source' then
    speaker:=ai.solmind_memory_source_speaker_v1(new.actor_user_account_id,new.source_message_id);
    select char_length(m.content_text) into body_length from ai.ai_interaction_message m
      where m.ai_interaction_message_id=new.source_message_id
        and m.ai_interaction_session_id=new.source_conversation_id;
    -- A version's sources are written with it and then sealed: only the save
    -- step that has just written the version may add them.
    if current_setting('solmind_memory.open_version',true) is distinct from
        new.point_id::text||':'||new.version_number::text
      or body_length is null or speaker is null or speaker<>new.speaker
      or not ai.solmind_memory_message_citable_v1(new.source_message_id)
      or (new.span_start is not null and new.span_start+new.span_length>body_length)
      or not exists(select 1 from ai.explorer_memory_point_version v
        where v.point_id=new.point_id and v.version_number=new.version_number
          and ai.solmind_memory_conversation_writable_v1(new.actor_user_account_id,v.recorded_conversation_id))
      then raise exception 'solmind_explorer_memory_conflict'; end if;

  elsif tg_table_name='explorer_memory_point_dependency' then
    if ai.solmind_memory_dependency_would_cycle_v1(new.point_id,new.depends_on_point_id)
      then raise exception 'solmind_explorer_memory_cycle'; end if;
    -- Sealed like the sources, and always built from the other point as it stands now.
    if current_setting('solmind_memory.open_version',true) is distinct from
        new.point_id::text||':'||new.version_number::text
      or new.depends_on_version_number is distinct from (select max(v.version_number)
        from ai.explorer_memory_point_version v where v.point_id=new.depends_on_point_id)
      or new.depends_on_retired is distinct from exists(select 1 from ai.explorer_memory_point_event e
        where e.point_id=new.depends_on_point_id and e.event_kind='retired')
      or not exists(select 1 from ai.explorer_memory_point_version v
        where v.point_id=new.point_id and v.version_number=new.version_number
          and ai.solmind_memory_conversation_writable_v1(new.actor_user_account_id,v.recorded_conversation_id))
      then raise exception 'solmind_explorer_memory_conflict'; end if;

  elsif tg_table_name='explorer_memory_point_event' then
    if not ai.solmind_memory_conversation_writable_v1(new.actor_user_account_id,new.recorded_conversation_id)
      or not ai.solmind_memory_operation_valid_v1(new.actor_user_account_id,new.recorded_conversation_id,
        new.recorded_operation_id)
      or not ai.solmind_memory_named_source_valid_v1(
        new.actor_user_account_id,new.recorded_conversation_id,
        case when new.event_kind='retired' then 'explorer' else 'virtual_guide' end,new.source_message_id)
      then raise exception 'solmind_explorer_memory_conflict'; end if;

  elsif tg_table_name='explorer_memory_point_topic' then
    if new.retired_at is not null or new.retired_conversation_id is not null
      or not ai.solmind_memory_conversation_writable_v1(new.actor_user_account_id,new.recorded_conversation_id)
      then raise exception 'solmind_explorer_memory_conflict'; end if;

  else
    raise exception 'solmind_explorer_memory_conflict';
  end if;
  return new;
end $$;

create trigger explorer_memory_conversation_guard before insert or update or delete
  on ai.explorer_memory_conversation for each row execute function ai.solmind_memory_rows_guard_v1();
create trigger explorer_memory_topic_guard before insert or update or delete
  on ai.explorer_memory_topic for each row execute function ai.solmind_memory_rows_guard_v1();
create trigger explorer_memory_topic_wording_guard before insert or update or delete
  on ai.explorer_memory_topic_wording for each row execute function ai.solmind_memory_rows_guard_v1();
create trigger explorer_memory_topic_link_guard before insert or update or delete
  on ai.explorer_memory_topic_link for each row execute function ai.solmind_memory_rows_guard_v1();
create trigger explorer_memory_topic_compass_guard before insert or update or delete
  on ai.explorer_memory_topic_compass for each row execute function ai.solmind_memory_rows_guard_v1();
create trigger explorer_memory_point_guard before insert or update or delete
  on ai.explorer_memory_point for each row execute function ai.solmind_memory_rows_guard_v1();
create trigger explorer_memory_point_version_guard before insert or update or delete
  on ai.explorer_memory_point_version for each row execute function ai.solmind_memory_rows_guard_v1();
create trigger explorer_memory_point_source_guard before insert or update or delete
  on ai.explorer_memory_point_source for each row execute function ai.solmind_memory_rows_guard_v1();
create trigger explorer_memory_point_dependency_guard before insert or update or delete
  on ai.explorer_memory_point_dependency for each row execute function ai.solmind_memory_rows_guard_v1();
create trigger explorer_memory_point_event_guard before insert or update or delete
  on ai.explorer_memory_point_event for each row execute function ai.solmind_memory_rows_guard_v1();
create trigger explorer_memory_point_topic_guard before insert or update or delete
  on ai.explorer_memory_point_topic for each row execute function ai.solmind_memory_rows_guard_v1();

-- TRUNCATE skips row triggers, so it is refused by its own trigger.
create function ai.solmind_memory_truncate_guard_v1() returns trigger
language plpgsql set search_path='' as $$
begin
  raise exception 'solmind_explorer_memory_immutable';
end $$;
do $$
declare t text;
begin
  for t in select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='ai' and c.relkind='r' and c.relname like 'explorer\_memory\_%' order by c.relname loop
    execute format('create trigger %I before truncate on ai.%I for each statement '
      'execute function ai.solmind_memory_truncate_guard_v1()',t||'_no_truncate',t);
  end loop;
end $$;

-- Checked when the transaction ends: no topic without a wording, no point
-- without a first version, no version without a supporting message, and no
-- line called the Explorer's words without one of the Explorer's messages.
create function ai.solmind_memory_complete_guard_v1() returns trigger
language plpgsql set search_path='' as $$
begin
  if tg_table_name='explorer_memory_topic' then
    if not exists(select 1 from ai.explorer_memory_topic_wording w
        where w.topic_id=new.topic_id and w.wording_number=1)
      then raise exception 'solmind_explorer_memory_unsupported'; end if;
  elsif tg_table_name='explorer_memory_point' then
    if not exists(select 1 from ai.explorer_memory_point_version v
        where v.point_id=new.point_id and v.version_number=1)
      then raise exception 'solmind_explorer_memory_unsupported'; end if;
  else
    if not exists(select 1 from ai.explorer_memory_point_source s
        where s.point_id=new.point_id and s.version_number=new.version_number
          and (new.whose_words<>'explorer_words' or s.speaker='explorer'))
      then raise exception 'solmind_explorer_memory_unsupported'; end if;
  end if;
  return null;
end $$;

create constraint trigger explorer_memory_topic_complete after insert on ai.explorer_memory_topic
  deferrable initially deferred for each row execute function ai.solmind_memory_complete_guard_v1();
create constraint trigger explorer_memory_point_complete after insert on ai.explorer_memory_point
  deferrable initially deferred for each row execute function ai.solmind_memory_complete_guard_v1();
create constraint trigger explorer_memory_point_version_complete after insert on ai.explorer_memory_point_version
  deferrable initially deferred for each row execute function ai.solmind_memory_complete_guard_v1();

-- ---------------------------------------------------------------------------
-- The write functions step 2 will call. Each takes the owner's account and
-- the conversation it is recording from, takes the owner's lock, and refuses
-- anything that is not the owner's own. Each new row's identity is supplied by
-- the caller, so the same call made twice saves once ('exact_replay').
-- ---------------------------------------------------------------------------

-- Only an active Explorer account has memory. A Guide's or an Admin's account
-- is refused here, before anything is read or written.
create function ai.solmind_memory_actor_check_v1(p_actor uuid) returns void
language plpgsql stable set search_path='' as $$
begin
  if p_actor is null or not exists(select 1 from identity.user_account a
      join identity.user_role_assignment ra on ra.user_account_id=a.user_account_id
        and ra.role_code='explorer' and ra.role_status='active'
        and ra.revoked_at is null and ra.granted_at<=clock_timestamp()
      join core.explorer_profile e on e.user_account_id=a.user_account_id and e.status='active'
      where a.user_account_id=p_actor and a.account_status='active')
    then raise exception 'solmind_explorer_memory_denied'; end if;
end $$;

create function ai.solmind_memory_enroll_conversation_v1(p_actor uuid,p_conversation uuid)
returns text language plpgsql volatile set search_path='' as $$
declare owner_id uuid;
begin
  perform ai.solmind_memory_actor_check_v1(p_actor);
  perform ai.solmind_private_owner_lock_v3(p_actor);
  if p_conversation is null then raise exception 'solmind_explorer_memory_invalid_input'; end if;
  if not exists(select 1 from ai.explorer_conversation_state st
      where st.conversation_id=p_conversation and st.actor_user_account_id=p_actor)
    then raise exception 'solmind_explorer_memory_denied'; end if;
  select mc.actor_user_account_id into owner_id from ai.explorer_memory_conversation mc
    where mc.conversation_id=p_conversation;
  if found then
    if owner_id is distinct from p_actor then raise exception 'solmind_explorer_memory_denied'; end if;
    return 'exact_replay';
  end if;
  if exists(select 1 from ai.ai_interaction_message m where m.ai_interaction_session_id=p_conversation)
    then return 'not_new'; end if;
  insert into ai.explorer_memory_conversation(conversation_id,actor_user_account_id)
    values(p_conversation,p_actor);
  return 'enrolled';
end $$;

-- The sources of one version: 1 to 16 entries, each a message and either no
-- place (the whole message, place not pinned) or a start and a length.
create function ai.solmind_memory_sources_valid_v1(p_sources jsonb)
returns boolean language plpgsql immutable set search_path='' as $$
declare x jsonb; seen text[]:=array[]::text[]; k text;
  uuid_pattern text:='^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
begin
  if jsonb_typeof(p_sources) is distinct from 'array' then return false; end if;
  if jsonb_array_length(p_sources) not between 1 and 16 then return false; end if;
  for x in select value from jsonb_array_elements(p_sources) loop
    if jsonb_typeof(x) is distinct from 'object' then return false; end if;
    if not x ?& array['messageId','spanStart','spanLength']
      or (select count(*) from jsonb_object_keys(x))<>3 then return false; end if;
    if jsonb_typeof(x->'messageId') is distinct from 'string' then return false; end if;
    if (x->>'messageId') collate "C" !~ uuid_pattern then return false; end if;
    if jsonb_typeof(x->'spanStart')='null' and jsonb_typeof(x->'spanLength')='null' then
      null;
    elsif jsonb_typeof(x->'spanStart')='number' and jsonb_typeof(x->'spanLength')='number' then
      if (x->>'spanStart') !~ '^(0|[1-9][0-9]{0,5})$' or (x->>'spanLength') !~ '^[1-9][0-9]{0,5}$'
        then return false; end if;
    else
      return false;
    end if;
    k:=(x->>'messageId')||'|'||coalesce(x->>'spanStart','-');
    if k=any(seen) then return false; end if;
    seen:=array_append(seen,k);
  end loop;
  return true;
end $$;

create function ai.solmind_memory_version_matches_v1(p_point uuid,p_version integer,p_conversation uuid,
  p_summary text,p_whose_words text,p_is_highlight boolean,p_sources jsonb,p_depends_on jsonb,p_operation_id uuid)
returns boolean language sql stable set search_path='' as $$
  select exists(select 1 from ai.explorer_memory_point_version v
      where v.point_id=p_point and v.version_number=p_version
        and v.recorded_conversation_id=p_conversation and v.summary_text=p_summary
        and v.whose_words=p_whose_words and v.is_highlight=p_is_highlight
        and v.recorded_operation_id is not distinct from p_operation_id)
    and (select coalesce(jsonb_agg(jsonb_build_object('messageId',s.source_message_id,
        'spanStart',s.span_start,'spanLength',s.span_length) order by s.source_slot),'[]'::jsonb)
      from ai.explorer_memory_point_source s
      where s.point_id=p_point and s.version_number=p_version)=p_sources
    and (select coalesce(jsonb_agg(jsonb_build_object('pointId',d.depends_on_point_id,
        'version',d.depends_on_version_number,'retired',d.depends_on_retired)
        order by d.depends_on_point_id::text),'[]'::jsonb)
      from ai.explorer_memory_point_dependency d
      where d.point_id=p_point and d.version_number=p_version)
      =(select coalesce(jsonb_agg(x order by x->>'pointId'),'[]'::jsonb) from jsonb_array_elements(p_depends_on) x)
$$;

-- The list of points a version is built from: at most 16 entries, each a
-- point, the version of it the wording was composed from, and whether it was
-- retired then; each point once, never the point itself.
create function ai.solmind_memory_depends_on_valid_v1(p_point uuid,p_depends_on jsonb)
returns boolean language plpgsql immutable set search_path='' as $$
declare x jsonb; seen text[]:=array[]::text[];
  uuid_pattern text:='^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
begin
  if jsonb_typeof(p_depends_on) is distinct from 'array' then return false; end if;
  if jsonb_array_length(p_depends_on)>16 then return false; end if;
  for x in select value from jsonb_array_elements(p_depends_on) loop
    if jsonb_typeof(x) is distinct from 'object' then return false; end if;
    if not x ?& array['pointId','version','retired']
      or (select count(*) from jsonb_object_keys(x))<>3 then return false; end if;
    if jsonb_typeof(x->'pointId') is distinct from 'string'
      or jsonb_typeof(x->'version') is distinct from 'number'
      or jsonb_typeof(x->'retired') is distinct from 'boolean' then return false; end if;
    if (x->>'pointId') collate "C" !~ uuid_pattern or (x->>'version') !~ '^[1-9][0-9]{0,8}$'
      then return false; end if;
    if x->>'pointId'=p_point::text or x->>'pointId'=any(seen) then return false; end if;
    seen:=array_append(seen,x->>'pointId');
  end loop;
  return true;
end $$;

-- Does every point in the list still stand as the caller saw it: the same
-- latest version, the same retired-or-not? Asked under the owner's lock.
create function ai.solmind_memory_depends_on_current_v1(p_depends_on jsonb)
returns boolean language sql stable set search_path='' as $$
  select not exists(select 1 from jsonb_array_elements(p_depends_on) x where
    (x->>'version')::integer is distinct from (select max(v.version_number)
      from ai.explorer_memory_point_version v where v.point_id=(x->>'pointId')::uuid)
    or (x->>'retired')::boolean is distinct from exists(select 1 from ai.explorer_memory_point_event e
      where e.point_id=(x->>'pointId')::uuid and e.event_kind='retired'))
$$;

create function ai.solmind_memory_insert_version_v1(p_actor uuid,p_conversation uuid,p_point uuid,
  p_version integer,p_summary text,p_whose_words text,p_is_highlight boolean,p_sources jsonb,
  p_depends_on jsonb,p_operation_id uuid)
returns void language plpgsql volatile set search_path='' as $$
begin
  -- Every source is the owner's own answered message, or its reply, and may still be cited.
  if exists(select 1 from jsonb_array_elements(p_sources) x
      where ai.solmind_memory_source_speaker_v1(p_actor,(x->>'messageId')::uuid) is null
        or not ai.solmind_memory_message_citable_v1((x->>'messageId')::uuid))
    or not ai.solmind_memory_operation_valid_v1(p_actor,p_conversation,p_operation_id)
    then raise exception 'solmind_explorer_memory_denied'; end if;
  if p_whose_words='explorer_words' and not exists(select 1 from jsonb_array_elements(p_sources) x
      where ai.solmind_memory_source_speaker_v1(p_actor,(x->>'messageId')::uuid)='explorer')
    then raise exception 'solmind_explorer_memory_invalid_input'; end if;
  if exists(select 1 from jsonb_array_elements(p_sources) x join ai.ai_interaction_message m
        on m.ai_interaction_message_id=(x->>'messageId')::uuid
      where jsonb_typeof(x->'spanStart')='number'
        and (x->>'spanStart')::integer+(x->>'spanLength')::integer>char_length(m.content_text))
    then raise exception 'solmind_explorer_memory_invalid_input'; end if;
  insert into ai.explorer_memory_point_version(point_id,version_number,actor_user_account_id,summary_text,
      whose_words,is_highlight,recorded_conversation_id,recorded_operation_id)
    values(p_point,p_version,p_actor,p_summary,p_whose_words,p_is_highlight,p_conversation,p_operation_id);
  -- Open this one version for its sources and "built from" rows, then seal it.
  perform set_config('solmind_memory.open_version',p_point::text||':'||p_version::text,true);
  insert into ai.explorer_memory_point_source(point_id,version_number,source_slot,actor_user_account_id,
      source_message_id,source_conversation_id,speaker,span_start,span_length)
    select p_point,p_version,x.ord::smallint,p_actor,m.ai_interaction_message_id,m.ai_interaction_session_id,
      ai.solmind_memory_source_speaker_v1(p_actor,m.ai_interaction_message_id),
      (x.value->>'spanStart')::integer,(x.value->>'spanLength')::integer
    from jsonb_array_elements(p_sources) with ordinality x(value,ord)
      join ai.ai_interaction_message m on m.ai_interaction_message_id=(x.value->>'messageId')::uuid
    order by x.ord;
  insert into ai.explorer_memory_point_dependency(point_id,version_number,depends_on_point_id,
      depends_on_version_number,depends_on_retired,actor_user_account_id)
    select p_point,p_version,(x->>'pointId')::uuid,(x->>'version')::integer,(x->>'retired')::boolean,p_actor
    from jsonb_array_elements(p_depends_on) x order by x->>'pointId';
  perform set_config('solmind_memory.open_version','',true);
end $$;

create function ai.solmind_memory_save_point_v1(p_actor uuid,p_conversation uuid,p_point_id uuid,
  p_summary text,p_whose_words text,p_is_highlight boolean,p_sources jsonb,
  p_depends_on jsonb default null,p_operation_id uuid default null)
returns text language plpgsql volatile set search_path='' as $$
declare owner_id uuid; first_conversation uuid; wanted jsonb:=coalesce(p_depends_on,'[]'::jsonb);
begin
  perform ai.solmind_memory_actor_check_v1(p_actor);
  perform ai.solmind_private_owner_lock_v3(p_actor);
  if p_conversation is null or p_point_id is null or p_is_highlight is null
    or p_whose_words is null or p_whose_words not in ('explorer_words','virtual_guide_reading')
    or ai.solmind_memory_text_valid_v1(p_summary,400) is not true
    or ai.solmind_memory_sources_valid_v1(p_sources) is not true
    or ai.solmind_memory_depends_on_valid_v1(p_point_id,wanted) is not true
    then raise exception 'solmind_explorer_memory_invalid_input'; end if;
  select p.actor_user_account_id,p.created_conversation_id into owner_id,first_conversation
    from ai.explorer_memory_point p where p.point_id=p_point_id;
  if found then
    if owner_id is distinct from p_actor then raise exception 'solmind_explorer_memory_denied'; end if;
    if first_conversation=p_conversation
      and ai.solmind_memory_version_matches_v1(p_point_id,1,p_conversation,p_summary,p_whose_words,
        p_is_highlight,p_sources,wanted,p_operation_id)
      then return 'exact_replay'; end if;
    raise exception 'solmind_explorer_memory_conflict';
  end if;
  if not ai.solmind_memory_conversation_writable_v1(p_actor,p_conversation)
    or exists(select 1 from jsonb_array_elements(wanted) d where not exists(select 1
      from ai.explorer_memory_point p
      where p.point_id=(d->>'pointId')::uuid and p.actor_user_account_id=p_actor))
    then raise exception 'solmind_explorer_memory_denied'; end if;
  -- A point the wording was composed from has been corrected or retired since: refuse.
  if not ai.solmind_memory_depends_on_current_v1(wanted) then return 'changed_dependency'; end if;
  if exists(select 1 from jsonb_array_elements(wanted) d
      where not ai.solmind_memory_point_usable_v1((d->>'pointId')::uuid)
        or ai.solmind_memory_point_stale_v1((d->>'pointId')::uuid)) then return 'unusable'; end if;
  insert into ai.explorer_memory_point(point_id,actor_user_account_id,created_conversation_id)
    values(p_point_id,p_actor,p_conversation);
  perform ai.solmind_memory_insert_version_v1(p_actor,p_conversation,p_point_id,1,p_summary,p_whose_words,
    p_is_highlight,p_sources,wanted,p_operation_id);
  return 'saved';
end $$;

-- A correction: the next version, with its own sources, its own full "built
-- from" list and its date. The list is required (an empty list says the new
-- wording is built from no other point), so a correction never drops it by
-- oversight. The earlier wording stays. A point that is no longer the current
-- picture can still have its history corrected; it stays retired. Correcting
-- a stale point is how it is rebuilt.
create function ai.solmind_memory_correct_point_v1(p_actor uuid,p_conversation uuid,p_point_id uuid,
  p_expected_version integer,p_summary text,p_whose_words text,p_is_highlight boolean,p_sources jsonb,
  p_depends_on jsonb,p_operation_id uuid default null)
returns text language plpgsql volatile set search_path='' as $$
declare owner_id uuid; latest integer;
begin
  perform ai.solmind_memory_actor_check_v1(p_actor);
  perform ai.solmind_private_owner_lock_v3(p_actor);
  if p_conversation is null or p_point_id is null or p_is_highlight is null
    or p_expected_version is null or p_expected_version<1
    or p_whose_words is null or p_whose_words not in ('explorer_words','virtual_guide_reading')
    or ai.solmind_memory_text_valid_v1(p_summary,400) is not true
    or ai.solmind_memory_sources_valid_v1(p_sources) is not true
    or p_depends_on is null or ai.solmind_memory_depends_on_valid_v1(p_point_id,p_depends_on) is not true
    then raise exception 'solmind_explorer_memory_invalid_input'; end if;
  select p.actor_user_account_id into owner_id from ai.explorer_memory_point p where p.point_id=p_point_id;
  if not found or owner_id is distinct from p_actor then raise exception 'solmind_explorer_memory_denied'; end if;
  select max(v.version_number) into latest from ai.explorer_memory_point_version v where v.point_id=p_point_id;
  if latest=p_expected_version+1 and ai.solmind_memory_version_matches_v1(p_point_id,latest,p_conversation,
      p_summary,p_whose_words,p_is_highlight,p_sources,p_depends_on,p_operation_id) then return 'exact_replay'; end if;
  if latest is distinct from p_expected_version then return 'stale_version'; end if;
  if not ai.solmind_memory_conversation_writable_v1(p_actor,p_conversation)
    or exists(select 1 from jsonb_array_elements(p_depends_on) d where not exists(select 1
      from ai.explorer_memory_point p
      where p.point_id=(d->>'pointId')::uuid and p.actor_user_account_id=p_actor))
    then raise exception 'solmind_explorer_memory_denied'; end if;
  if not ai.solmind_memory_depends_on_current_v1(p_depends_on) then return 'changed_dependency'; end if;
  if not ai.solmind_memory_point_usable_v1(p_point_id)
    or exists(select 1 from jsonb_array_elements(p_depends_on) d
      where not ai.solmind_memory_point_usable_v1((d->>'pointId')::uuid)
        or ai.solmind_memory_point_stale_v1((d->>'pointId')::uuid)) then return 'unusable'; end if;
  if exists(select 1 from jsonb_array_elements(p_depends_on) d
      where ai.solmind_memory_dependency_would_cycle_v1(p_point_id,(d->>'pointId')::uuid))
    then return 'cycle'; end if;
  perform ai.solmind_memory_insert_version_v1(p_actor,p_conversation,p_point_id,latest+1,p_summary,
    p_whose_words,p_is_highlight,p_sources,p_depends_on,p_operation_id);
  return 'corrected';
end $$;

-- Dated history. Every event names its supporting message from this
-- conversation; 'retired' needs the Explorer's own. A point is retired at most once.
create function ai.solmind_memory_record_point_event_v1(p_actor uuid,p_conversation uuid,p_event_id uuid,
  p_point_id uuid,p_event_kind text,p_note text,p_source_message_id uuid,p_operation_id uuid default null)
returns text language plpgsql volatile set search_path='' as $$
declare owner_id uuid; e ai.explorer_memory_point_event%rowtype;
begin
  perform ai.solmind_memory_actor_check_v1(p_actor);
  perform ai.solmind_private_owner_lock_v3(p_actor);
  if p_conversation is null or p_event_id is null or p_point_id is null
    or p_event_kind is null or p_event_kind not in ('retired','dated_note')
    or (p_note is not null and ai.solmind_memory_text_valid_v1(p_note,400) is not true)
    or (p_event_kind='dated_note' and p_note is null)
    or p_source_message_id is null
    then raise exception 'solmind_explorer_memory_invalid_input'; end if;
  select x.* into e from ai.explorer_memory_point_event x where x.event_id=p_event_id;
  if found then
    if e.actor_user_account_id is distinct from p_actor then raise exception 'solmind_explorer_memory_denied'; end if;
    if e.point_id=p_point_id and e.event_kind=p_event_kind and e.note_text is not distinct from p_note
      and e.source_message_id is not distinct from p_source_message_id
      and e.recorded_conversation_id=p_conversation
      and e.recorded_operation_id is not distinct from p_operation_id then return 'exact_replay'; end if;
    raise exception 'solmind_explorer_memory_conflict';
  end if;
  select p.actor_user_account_id into owner_id from ai.explorer_memory_point p where p.point_id=p_point_id;
  if not found or owner_id is distinct from p_actor
    or not ai.solmind_memory_conversation_writable_v1(p_actor,p_conversation)
    or not ai.solmind_memory_operation_valid_v1(p_actor,p_conversation,p_operation_id)
    or not ai.solmind_memory_named_source_valid_v1(p_actor,p_conversation,
      case when p_event_kind='retired' then 'explorer' else 'virtual_guide' end,p_source_message_id)
    then raise exception 'solmind_explorer_memory_denied'; end if;
  if not ai.solmind_memory_point_usable_v1(p_point_id) then return 'unusable'; end if;
  if p_event_kind='retired' and exists(select 1 from ai.explorer_memory_point_event x
      where x.point_id=p_point_id and x.event_kind='retired') then return 'already_retired'; end if;
  insert into ai.explorer_memory_point_event(event_id,point_id,actor_user_account_id,event_kind,note_text,
      source_message_id,recorded_conversation_id,recorded_operation_id)
    values(p_event_id,p_point_id,p_actor,p_event_kind,p_note,p_source_message_id,p_conversation,p_operation_id);
  return 'recorded';
end $$;

create function ai.solmind_memory_save_topic_v1(p_actor uuid,p_conversation uuid,p_topic_id uuid,p_label text,
  p_named_by text,p_source_message_id uuid,p_operation_id uuid default null)
returns text language plpgsql volatile set search_path='' as $$
declare owner_id uuid; first_conversation uuid;
begin
  perform ai.solmind_memory_actor_check_v1(p_actor);
  perform ai.solmind_private_owner_lock_v3(p_actor);
  if p_conversation is null or p_topic_id is null
    or ai.solmind_compass_suggestion_label_valid(p_label) is not true
    or p_named_by is null or p_named_by not in ('explorer','virtual_guide')
    or p_source_message_id is null
    then raise exception 'solmind_explorer_memory_invalid_input'; end if;
  select t.actor_user_account_id,t.created_conversation_id into owner_id,first_conversation
    from ai.explorer_memory_topic t where t.topic_id=p_topic_id;
  if found then
    if owner_id is distinct from p_actor then raise exception 'solmind_explorer_memory_denied'; end if;
    if first_conversation=p_conversation and exists(select 1 from ai.explorer_memory_topic_wording w
        where w.topic_id=p_topic_id and w.wording_number=1 and w.label=p_label and w.named_by=p_named_by
          and w.source_message_id is not distinct from p_source_message_id
          and w.recorded_operation_id is not distinct from p_operation_id) then return 'exact_replay'; end if;
    raise exception 'solmind_explorer_memory_conflict';
  end if;
  if not ai.solmind_memory_conversation_writable_v1(p_actor,p_conversation)
    or not ai.solmind_memory_operation_valid_v1(p_actor,p_conversation,p_operation_id)
    or not ai.solmind_memory_named_source_valid_v1(p_actor,p_conversation,p_named_by,p_source_message_id)
    then raise exception 'solmind_explorer_memory_denied'; end if;
  insert into ai.explorer_memory_topic(topic_id,actor_user_account_id,created_conversation_id)
    values(p_topic_id,p_actor,p_conversation);
  insert into ai.explorer_memory_topic_wording(topic_id,wording_number,actor_user_account_id,label,named_by,
      source_message_id,recorded_conversation_id,recorded_operation_id)
    values(p_topic_id,1,p_actor,p_label,p_named_by,p_source_message_id,p_conversation,p_operation_id);
  return 'saved';
end $$;

-- A new wording for a topic (a rename, or a broadening). Earlier wording stays.
create function ai.solmind_memory_reword_topic_v1(p_actor uuid,p_conversation uuid,p_topic_id uuid,
  p_expected_wording integer,p_label text,p_named_by text,p_source_message_id uuid,p_operation_id uuid default null)
returns text language plpgsql volatile set search_path='' as $$
declare owner_id uuid; latest integer;
begin
  perform ai.solmind_memory_actor_check_v1(p_actor);
  perform ai.solmind_private_owner_lock_v3(p_actor);
  if p_conversation is null or p_topic_id is null or p_expected_wording is null or p_expected_wording<1
    or ai.solmind_compass_suggestion_label_valid(p_label) is not true
    or p_named_by is null or p_named_by not in ('explorer','virtual_guide')
    or p_source_message_id is null
    then raise exception 'solmind_explorer_memory_invalid_input'; end if;
  select t.actor_user_account_id into owner_id from ai.explorer_memory_topic t where t.topic_id=p_topic_id;
  if not found or owner_id is distinct from p_actor then raise exception 'solmind_explorer_memory_denied'; end if;
  select max(w.wording_number) into latest from ai.explorer_memory_topic_wording w where w.topic_id=p_topic_id;
  if latest=p_expected_wording+1 and exists(select 1 from ai.explorer_memory_topic_wording w
      where w.topic_id=p_topic_id and w.wording_number=latest and w.label=p_label and w.named_by=p_named_by
        and w.source_message_id is not distinct from p_source_message_id
        and w.recorded_conversation_id=p_conversation
        and w.recorded_operation_id is not distinct from p_operation_id) then return 'exact_replay'; end if;
  if latest is distinct from p_expected_wording then return 'stale_wording'; end if;
  if not ai.solmind_memory_conversation_writable_v1(p_actor,p_conversation)
    or not ai.solmind_memory_operation_valid_v1(p_actor,p_conversation,p_operation_id)
    or not ai.solmind_memory_named_source_valid_v1(p_actor,p_conversation,p_named_by,p_source_message_id)
    then raise exception 'solmind_explorer_memory_denied'; end if;
  if not ai.solmind_memory_topic_usable_v1(p_topic_id) then return 'unusable'; end if;
  insert into ai.explorer_memory_topic_wording(topic_id,wording_number,actor_user_account_id,label,named_by,
      source_message_id,recorded_conversation_id,recorded_operation_id)
    values(p_topic_id,latest+1,p_actor,p_label,p_named_by,p_source_message_id,p_conversation,p_operation_id);
  return 'reworded';
end $$;

create function ai.solmind_memory_link_topics_v1(p_actor uuid,p_conversation uuid,p_link_id uuid,
  p_broad_topic_id uuid,p_narrow_topic_id uuid,p_named_by text,p_source_message_id uuid,
  p_operation_id uuid default null)
returns text language plpgsql volatile set search_path='' as $$
declare l ai.explorer_memory_topic_link%rowtype;
begin
  perform ai.solmind_memory_actor_check_v1(p_actor);
  perform ai.solmind_private_owner_lock_v3(p_actor);
  if p_conversation is null or p_link_id is null or p_broad_topic_id is null or p_narrow_topic_id is null
    or p_broad_topic_id=p_narrow_topic_id
    or p_named_by is null or p_named_by not in ('explorer','virtual_guide')
    or p_source_message_id is null
    then raise exception 'solmind_explorer_memory_invalid_input'; end if;
  select x.* into l from ai.explorer_memory_topic_link x where x.link_id=p_link_id;
  if found then
    if l.actor_user_account_id is distinct from p_actor then raise exception 'solmind_explorer_memory_denied'; end if;
    if l.broad_topic_id=p_broad_topic_id and l.narrow_topic_id=p_narrow_topic_id and l.named_by=p_named_by
      and l.source_message_id is not distinct from p_source_message_id
      and l.recorded_conversation_id=p_conversation
      and l.recorded_operation_id is not distinct from p_operation_id then return 'exact_replay'; end if;
    raise exception 'solmind_explorer_memory_conflict';
  end if;
  -- Both topics must be this Explorer's own: no link reaches another Explorer.
  if (select count(*) from ai.explorer_memory_topic t where t.actor_user_account_id=p_actor
      and t.topic_id in (p_broad_topic_id,p_narrow_topic_id))<>2
    or not ai.solmind_memory_conversation_writable_v1(p_actor,p_conversation)
    or not ai.solmind_memory_operation_valid_v1(p_actor,p_conversation,p_operation_id)
    or not ai.solmind_memory_named_source_valid_v1(p_actor,p_conversation,p_named_by,p_source_message_id)
    then raise exception 'solmind_explorer_memory_denied'; end if;
  if not ai.solmind_memory_topic_usable_v1(p_broad_topic_id)
    or not ai.solmind_memory_topic_usable_v1(p_narrow_topic_id) then return 'unusable'; end if;
  if exists(select 1 from ai.explorer_memory_topic_link x where x.broad_topic_id=p_broad_topic_id
      and x.narrow_topic_id=p_narrow_topic_id and x.retired_at is null) then return 'already_linked'; end if;
  if ai.solmind_memory_link_would_cycle_v1(p_broad_topic_id,p_narrow_topic_id) then return 'cycle'; end if;
  insert into ai.explorer_memory_topic_link(link_id,actor_user_account_id,broad_topic_id,narrow_topic_id,
      named_by,source_message_id,recorded_conversation_id,recorded_operation_id)
    values(p_link_id,p_actor,p_broad_topic_id,p_narrow_topic_id,p_named_by,p_source_message_id,
      p_conversation,p_operation_id);
  return 'linked';
end $$;

create function ai.solmind_memory_unlink_topics_v1(p_actor uuid,p_conversation uuid,p_link_id uuid)
returns text language plpgsql volatile set search_path='' as $$
declare l ai.explorer_memory_topic_link%rowtype;
begin
  perform ai.solmind_memory_actor_check_v1(p_actor);
  perform ai.solmind_private_owner_lock_v3(p_actor);
  if p_conversation is null or p_link_id is null then raise exception 'solmind_explorer_memory_invalid_input'; end if;
  select x.* into l from ai.explorer_memory_topic_link x where x.link_id=p_link_id for update;
  if not found or l.actor_user_account_id is distinct from p_actor
    then raise exception 'solmind_explorer_memory_denied'; end if;
  if l.retired_at is not null then
    return case when l.retired_conversation_id=p_conversation then 'exact_replay' else 'already_unlinked' end;
  end if;
  if not ai.solmind_memory_conversation_writable_v1(p_actor,p_conversation)
    then raise exception 'solmind_explorer_memory_denied'; end if;
  update ai.explorer_memory_topic_link set retired_at=clock_timestamp(),retired_conversation_id=p_conversation
    where link_id=p_link_id;
  return 'unlinked';
end $$;

-- Bind one conversation's Compass topic to its lasting topic. Never changed.
create function ai.solmind_memory_bind_compass_topic_v1(p_actor uuid,p_conversation uuid,
  p_compass_topic_id uuid,p_memory_topic_id uuid)
returns text language plpgsql volatile set search_path='' as $$
declare bound uuid;
begin
  perform ai.solmind_memory_actor_check_v1(p_actor);
  perform ai.solmind_private_owner_lock_v3(p_actor);
  if p_conversation is null or p_compass_topic_id is null or p_memory_topic_id is null
    then raise exception 'solmind_explorer_memory_invalid_input'; end if;
  if not exists(select 1 from ai.explorer_memory_topic t
      where t.topic_id=p_memory_topic_id and t.actor_user_account_id=p_actor)
    or not exists(select 1 from ai.explorer_compass_topic c where c.conversation_id=p_conversation
      and c.topic_id=p_compass_topic_id and c.actor_user_account_id=p_actor)
    then raise exception 'solmind_explorer_memory_denied'; end if;
  select b.memory_topic_id into bound from ai.explorer_memory_topic_compass b
    where b.conversation_id=p_conversation and b.compass_topic_id=p_compass_topic_id;
  if found then
    if bound=p_memory_topic_id then return 'exact_replay'; end if;
    raise exception 'solmind_explorer_memory_conflict';
  end if;
  if not ai.solmind_memory_conversation_writable_v1(p_actor,p_conversation)
    then raise exception 'solmind_explorer_memory_denied'; end if;
  if not ai.solmind_memory_topic_usable_v1(p_memory_topic_id) then return 'unusable'; end if;
  insert into ai.explorer_memory_topic_compass(conversation_id,compass_topic_id,memory_topic_id,actor_user_account_id)
    values(p_conversation,p_compass_topic_id,p_memory_topic_id,p_actor);
  return 'bound';
end $$;

create function ai.solmind_memory_attach_point_topic_v1(p_actor uuid,p_conversation uuid,p_attachment_id uuid,
  p_point_id uuid,p_topic_id uuid)
returns text language plpgsql volatile set search_path='' as $$
declare a ai.explorer_memory_point_topic%rowtype;
begin
  perform ai.solmind_memory_actor_check_v1(p_actor);
  perform ai.solmind_private_owner_lock_v3(p_actor);
  if p_conversation is null or p_attachment_id is null or p_point_id is null or p_topic_id is null
    then raise exception 'solmind_explorer_memory_invalid_input'; end if;
  select x.* into a from ai.explorer_memory_point_topic x where x.attachment_id=p_attachment_id;
  if found then
    if a.actor_user_account_id is distinct from p_actor then raise exception 'solmind_explorer_memory_denied'; end if;
    if a.point_id=p_point_id and a.topic_id=p_topic_id and a.recorded_conversation_id=p_conversation
      then return 'exact_replay'; end if;
    raise exception 'solmind_explorer_memory_conflict';
  end if;
  if not exists(select 1 from ai.explorer_memory_point p
      where p.point_id=p_point_id and p.actor_user_account_id=p_actor)
    or not exists(select 1 from ai.explorer_memory_topic t
      where t.topic_id=p_topic_id and t.actor_user_account_id=p_actor)
    or not ai.solmind_memory_conversation_writable_v1(p_actor,p_conversation)
    then raise exception 'solmind_explorer_memory_denied'; end if;
  if not ai.solmind_memory_point_usable_v1(p_point_id) or not ai.solmind_memory_topic_usable_v1(p_topic_id)
    then return 'unusable'; end if;
  if exists(select 1 from ai.explorer_memory_point_topic x where x.point_id=p_point_id
      and x.topic_id=p_topic_id and x.retired_at is null) then return 'already_attached'; end if;
  insert into ai.explorer_memory_point_topic(attachment_id,point_id,topic_id,actor_user_account_id,
      recorded_conversation_id)
    values(p_attachment_id,p_point_id,p_topic_id,p_actor,p_conversation);
  return 'attached';
end $$;

create function ai.solmind_memory_detach_point_topic_v1(p_actor uuid,p_conversation uuid,p_attachment_id uuid)
returns text language plpgsql volatile set search_path='' as $$
declare a ai.explorer_memory_point_topic%rowtype;
begin
  perform ai.solmind_memory_actor_check_v1(p_actor);
  perform ai.solmind_private_owner_lock_v3(p_actor);
  if p_conversation is null or p_attachment_id is null
    then raise exception 'solmind_explorer_memory_invalid_input'; end if;
  select x.* into a from ai.explorer_memory_point_topic x where x.attachment_id=p_attachment_id for update;
  if not found or a.actor_user_account_id is distinct from p_actor
    then raise exception 'solmind_explorer_memory_denied'; end if;
  if a.retired_at is not null then
    return case when a.retired_conversation_id=p_conversation then 'exact_replay' else 'already_detached' end;
  end if;
  if not ai.solmind_memory_conversation_writable_v1(p_actor,p_conversation)
    then raise exception 'solmind_explorer_memory_denied'; end if;
  update ai.explorer_memory_point_topic set retired_at=clock_timestamp(),retired_conversation_id=p_conversation
    where attachment_id=p_attachment_id;
  return 'detached';
end $$;

-- ---------------------------------------------------------------------------
-- Reads. Each returns only the named owner's own records, and only what is
-- still usable. Asking for a record that is not the owner's is refused, so a
-- refusal is never mistaken for "nothing found".
-- ---------------------------------------------------------------------------

create function ai.solmind_memory_points_v1(p_actor uuid,p_limit integer default 200)
returns table(point_id uuid,version_number integer,summary_text text,whose_words text,is_highlight boolean,
  is_current boolean,created_at timestamptz,last_recorded_at timestamptz)
language plpgsql stable set search_path='' as $$
#variable_conflict use_column
begin
  perform ai.solmind_memory_actor_check_v1(p_actor);
  if p_limit is null or p_limit not between 1 and 500
    then raise exception 'solmind_explorer_memory_invalid_input'; end if;
  return query
    select p.point_id,v.version_number,v.summary_text,v.whose_words,v.is_highlight,
      not exists(select 1 from ai.explorer_memory_point_event e
        where e.point_id=p.point_id and e.event_kind='retired'),
      p.created_at,v.recorded_at
    from ai.explorer_memory_point p join ai.explorer_memory_point_version v on v.point_id=p.point_id
      and v.version_number=(select max(x.version_number) from ai.explorer_memory_point_version x
        where x.point_id=p.point_id)
    where p.actor_user_account_id=p_actor and ai.solmind_memory_point_usable_v1(p.point_id)
      and not ai.solmind_memory_point_stale_v1(p.point_id)
    order by v.recorded_at desc,p.point_id limit p_limit;
end $$;

-- The whole dated history of one point: every wording, where each came from,
-- and every dated event. Null when the point is no longer usable. Null also
-- when its current wording is out of date (see point_stale), unless the caller
-- asks for it with p_include_stale, as the rebuild of that wording must; the
-- answer then says 'stale': true.
create function ai.solmind_memory_point_history_v1(p_actor uuid,p_point_id uuid,p_include_stale boolean default false)
returns jsonb language plpgsql stable set search_path='' as $$
declare owner_id uuid;
begin
  perform ai.solmind_memory_actor_check_v1(p_actor);
  select p.actor_user_account_id into owner_id from ai.explorer_memory_point p where p.point_id=p_point_id;
  if not found or owner_id is distinct from p_actor then raise exception 'solmind_explorer_memory_denied'; end if;
  if not ai.solmind_memory_point_usable_v1(p_point_id) then return null; end if;
  if p_include_stale is not true and ai.solmind_memory_point_stale_v1(p_point_id) then return null; end if;
  return jsonb_build_object('pointId',p_point_id,'stale',ai.solmind_memory_point_stale_v1(p_point_id),
    'versions',(select jsonb_agg(jsonb_build_object('version',v.version_number,'summary',v.summary_text,
        'whoseWords',v.whose_words,'highlight',v.is_highlight,'recordedAt',v.recorded_at,
        'conversationId',v.recorded_conversation_id,
        'sources',(select jsonb_agg(jsonb_build_object('messageId',s.source_message_id,
            'conversationId',s.source_conversation_id,'speaker',s.speaker,'spanStart',s.span_start,
            'spanLength',s.span_length,'placePinned',s.span_start is not null,'messageAt',m.created_at)
            order by s.source_slot)
          from ai.explorer_memory_point_source s join ai.ai_interaction_message m
            on m.ai_interaction_message_id=s.source_message_id
          where s.point_id=v.point_id and s.version_number=v.version_number)) order by v.version_number)
      from ai.explorer_memory_point_version v where v.point_id=p_point_id),
    'events',(select coalesce(jsonb_agg(jsonb_build_object('eventId',e.event_id,'kind',e.event_kind,
        'note',e.note_text,'messageId',e.source_message_id,'recordedAt',e.recorded_at,
        'conversationId',e.recorded_conversation_id) order by e.recorded_at,e.event_id),'[]'::jsonb)
      from ai.explorer_memory_point_event e where e.point_id=p_point_id
        and ai.solmind_memory_conversation_usable_v1(e.recorded_conversation_id)
        and ai.solmind_memory_message_usable_v1(e.source_message_id)),
    'builtFrom',(select coalesce(jsonb_agg(jsonb_build_object('version',d.version_number,
        'pointId',d.depends_on_point_id,'pointVersion',d.depends_on_version_number,
        'pointRetired',d.depends_on_retired)
        order by d.version_number,d.depends_on_point_id),'[]'::jsonb)
      from ai.explorer_memory_point_dependency d where d.point_id=p_point_id));
end $$;

create function ai.solmind_memory_topics_v1(p_actor uuid,p_limit integer default 200)
returns table(topic_id uuid,label text,named_by text,wording_number integer,created_at timestamptz)
language plpgsql stable set search_path='' as $$
#variable_conflict use_column
begin
  perform ai.solmind_memory_actor_check_v1(p_actor);
  if p_limit is null or p_limit not between 1 and 500
    then raise exception 'solmind_explorer_memory_invalid_input'; end if;
  return query
    select t.topic_id,w.label::text,w.named_by,w.wording_number,t.created_at
    from ai.explorer_memory_topic t join ai.explorer_memory_topic_wording w on w.topic_id=t.topic_id
      and w.wording_number=(select max(x.wording_number) from ai.explorer_memory_topic_wording x
        where x.topic_id=t.topic_id)
    where t.actor_user_account_id=p_actor and ai.solmind_memory_topic_usable_v1(t.topic_id)
    order by t.created_at desc,t.topic_id limit p_limit;
end $$;

-- Every wording a topic has had, oldest first. Null when no longer usable.
create function ai.solmind_memory_topic_wordings_v1(p_actor uuid,p_topic_id uuid)
returns jsonb language plpgsql stable set search_path='' as $$
declare owner_id uuid;
begin
  perform ai.solmind_memory_actor_check_v1(p_actor);
  select t.actor_user_account_id into owner_id from ai.explorer_memory_topic t where t.topic_id=p_topic_id;
  if not found or owner_id is distinct from p_actor then raise exception 'solmind_explorer_memory_denied'; end if;
  if not ai.solmind_memory_topic_usable_v1(p_topic_id) then return null; end if;
  return (select jsonb_agg(jsonb_build_object('wording',w.wording_number,'label',w.label,'namedBy',w.named_by,
      'messageId',w.source_message_id,'recordedAt',w.recorded_at,'conversationId',w.recorded_conversation_id)
      order by w.wording_number)
    from ai.explorer_memory_topic_wording w where w.topic_id=p_topic_id);
end $$;

-- The topics below ('narrower') or above ('broader') one topic, nearest
-- first, each once, through current usable links. The walk goes level by
-- level and link by link. Each link looked at counts against p_max_links; a
-- target already visited is skipped before anything is asked about it; each
-- new target looked at counts against p_max_topics. The moment either budget
-- is used up the walk stops at the very next link, whatever that link leads
-- to, and it does not start another level once a level
-- has filled a budget exactly. The answer is one object, so the signal is
-- never lost: 'topics' (what was found, at its nearest depth), 'moreExist'
-- (the walk was cut short and more may exist, true even when no topic was
-- found), and the work done ('topicsExamined', 'linksExamined').
create function ai.solmind_memory_related_topics_v1(p_actor uuid,p_topic_id uuid,p_direction text,
  p_max_depth integer default 8,p_max_topics integer default 500,p_max_links integer default 2000)
returns jsonb language plpgsql stable set search_path='' as $$
declare owner_id uuid; frontier uuid[]; next_frontier uuid[]; visited uuid[]; hits jsonb:='[]'::jsonb;
  lvl integer:=0; links_examined integer:=0; topics_examined integer:=0; cut_short boolean:=false; hop record;
begin
  perform ai.solmind_memory_actor_check_v1(p_actor);
  if p_direction is null or p_direction not in ('narrower','broader')
    or p_max_depth is null or p_max_depth not between 1 and 16
    or p_max_topics is null or p_max_topics not between 1 and 500
    or p_max_links is null or p_max_links not between 1 and 5000
    then raise exception 'solmind_explorer_memory_invalid_input'; end if;
  select t.actor_user_account_id into owner_id from ai.explorer_memory_topic t where t.topic_id=p_topic_id;
  if not found or owner_id is distinct from p_actor then raise exception 'solmind_explorer_memory_denied'; end if;
  if ai.solmind_memory_topic_usable_v1(p_topic_id) then
    frontier:=array[p_topic_id]; visited:=frontier;
    while lvl<p_max_depth and cardinality(frontier)>0 and not cut_short loop
      lvl:=lvl+1; next_frontier:=array[]::uuid[];
      for hop in select case when p_direction='narrower' then l.narrow_topic_id else l.broad_topic_id end as next_id,
          l.recorded_conversation_id,l.source_message_id
        from ai.explorer_memory_topic_link l
        where (case when p_direction='narrower' then l.broad_topic_id else l.narrow_topic_id end)=any(frontier)
          and l.retired_at is null and l.actor_user_account_id=p_actor loop
        if links_examined>=p_max_links then cut_short:=true; exit; end if;
        links_examined:=links_examined+1;
        if topics_examined>=p_max_topics then cut_short:=true; exit; end if;
        if hop.next_id=any(visited) then continue; end if;
        if not ai.solmind_memory_conversation_usable_v1(hop.recorded_conversation_id)
          or not ai.solmind_memory_message_usable_v1(hop.source_message_id) then continue; end if;
        topics_examined:=topics_examined+1;
        visited:=visited||hop.next_id;
        if ai.solmind_memory_topic_usable_v1(hop.next_id) then
          next_frontier:=next_frontier||hop.next_id;
          hits:=hits||jsonb_build_object('topicId',hop.next_id,'depth',lvl);
        end if;
      end loop;
      frontier:=next_frontier;
      -- A level that used a budget up exactly: do not start the next one. Say more may
      -- exist only if some current link does leave the topics just found.
      if not cut_short and lvl<p_max_depth and cardinality(frontier)>0
        and (topics_examined>=p_max_topics or links_examined>=p_max_links) then
        cut_short:=exists(select 1 from ai.explorer_memory_topic_link l
          where (case when p_direction='narrower' then l.broad_topic_id else l.narrow_topic_id end)=any(frontier)
            and l.retired_at is null and l.actor_user_account_id=p_actor);
        exit;
      end if;
    end loop;
  end if;
  return jsonb_build_object(
    'topics',(select coalesce(jsonb_agg(jsonb_build_object('topicId',f->>'topicId',
        'label',(select x.label::text from ai.explorer_memory_topic_wording x
          where x.topic_id=(f->>'topicId')::uuid order by x.wording_number desc limit 1),
        'depth',(f->>'depth')::integer) order by (f->>'depth')::integer,f->>'topicId'),'[]'::jsonb)
      from jsonb_array_elements(hits) f),
    'moreExist',cut_short,'topicsExamined',topics_examined,'linksExamined',links_examined);
end $$;

-- The usable points currently attached to one topic.
create function ai.solmind_memory_topic_points_v1(p_actor uuid,p_topic_id uuid)
returns table(point_id uuid)
language plpgsql stable set search_path='' as $$
#variable_conflict use_column
declare owner_id uuid;
begin
  perform ai.solmind_memory_actor_check_v1(p_actor);
  select t.actor_user_account_id into owner_id from ai.explorer_memory_topic t where t.topic_id=p_topic_id;
  if not found or owner_id is distinct from p_actor then raise exception 'solmind_explorer_memory_denied'; end if;
  if not ai.solmind_memory_topic_usable_v1(p_topic_id) then return; end if;
  return query
    select a.point_id from ai.explorer_memory_point_topic a
    where a.topic_id=p_topic_id and a.actor_user_account_id=p_actor and a.retired_at is null
      and ai.solmind_memory_conversation_usable_v1(a.recorded_conversation_id)
      and ai.solmind_memory_point_usable_v1(a.point_id)
      and not ai.solmind_memory_point_stale_v1(a.point_id)
    order by a.recorded_at,a.point_id;
end $$;

-- The lasting topic behind one conversation's Compass topic. Null when it is
-- not bound or no longer usable; refused when the binding is someone else's.
create function ai.solmind_memory_compass_topic_v1(p_actor uuid,p_conversation uuid,p_compass_topic_id uuid)
returns uuid language plpgsql stable set search_path='' as $$
declare bound uuid; owner_id uuid;
begin
  perform ai.solmind_memory_actor_check_v1(p_actor);
  select b.memory_topic_id,b.actor_user_account_id into bound,owner_id
    from ai.explorer_memory_topic_compass b
    where b.conversation_id=p_conversation and b.compass_topic_id=p_compass_topic_id;
  if not found then return null; end if;
  if owner_id is distinct from p_actor then raise exception 'solmind_explorer_memory_denied'; end if;
  if not ai.solmind_memory_conversation_usable_v1(p_conversation)
    or not ai.solmind_memory_topic_usable_v1(bound) then return null; end if;
  return bound;
end $$;

-- Every memory function is internal: owned by postgres, callable by no API role.
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='ai' and p.proname like 'solmind\_memory\_%' loop
    execute format('alter function %s owner to postgres',f.signature);
    execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
  end loop;
end $$;

comment on table ai.explorer_memory_conversation is
  'Memory step 1: the conversations that take part in memory (new conversations only).';
comment on table ai.explorer_memory_topic is
  'Memory step 1: one lasting topic identity per Explorer, across conversations.';
comment on table ai.explorer_memory_topic_wording is
  'Memory step 1: every wording a topic has had; the highest number is current.';
comment on table ai.explorer_memory_topic_link is
  'Memory step 1: broad-to-narrow topic links, read in both directions; removed links stay as history.';
comment on table ai.explorer_memory_topic_compass is
  'Memory step 1: which lasting topic a conversation''s Compass topic is.';
comment on table ai.explorer_memory_point is
  'Memory step 1: one memory point, a short saved summary of one important thing.';
comment on table ai.explorer_memory_point_version is
  'Memory step 1: every wording of a point; a correction adds a version and erases nothing.';
comment on table ai.explorer_memory_point_source is
  'Memory step 1: the messages, and the exact place where pinned, that support one version.';
comment on table ai.explorer_memory_point_dependency is
  'Memory step 1: one version of a point built from one version of another; separate from topic links.';
comment on column ai.explorer_memory_point_source.span_start is
  'Zero-based offset into the saved message text, counted in Unicode code points (not UTF-16 units).';
comment on column ai.explorer_memory_point_source.span_length is
  'Length of the pinned stretch, counted in Unicode code points (not UTF-16 units).';
comment on table ai.explorer_memory_point_event is
  'Memory step 1: dated history (no longer applies; dated notes).';
comment on table ai.explorer_memory_point_topic is
  'Memory step 1: which topics a point belongs to.';

commit;

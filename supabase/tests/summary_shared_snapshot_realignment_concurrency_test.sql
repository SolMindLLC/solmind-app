-- Local ephemeral database only. This suite commits reserved synthetic rows
-- across dblink sessions and then removes only those exact rows. If execution
-- aborts after a remote commit, reset the idle local database under the
-- separately applicable database gate before any further validation.

begin;
create extension if not exists dblink;
select plan(36);

create function pg_temp.s02_wait_for_lock(
  p_connection text,
  p_pid integer
)
returns boolean
language plpgsql
as $$
begin
  for attempt in 1..40 loop
    if dblink_is_busy(p_connection) = 1
       and exists (
         select 1
           from pg_catalog.pg_stat_activity
          where pid = p_pid
            and wait_event_type = 'Lock'
       )
    then
      return true;
    end if;
    perform pg_catalog.pg_sleep(0.10);
  end loop;
  return false;
end;
$$;

select is(
  (
    select pg_catalog.count(*)::integer
      from content.summary
     where summary_id = 'a3110210-2000-4000-8000-000000000001'
  ),
  0,
  'preflight finds no reserved Summary residue'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from content.private_summary_draft
     where private_summary_draft_id =
           'a3110210-4000-4000-8000-000000000001'
  ),
  0,
  'preflight finds no reserved private-draft residue'
);

insert into identity.user_account (
  user_account_id,
  display_name,
  username,
  account_status
) values
  ('a3110210-1000-4000-8000-000000000001', 'S02 Concurrent Guide', 's02_concurrent_guide', 'active'),
  ('a3110210-1000-4000-8000-000000000002', 'S02 Concurrent Explorer', 's02_concurrent_explorer', 'active');

insert into identity.user_role_assignment (
  user_role_assignment_id,
  user_account_id,
  role_code,
  role_status
) values
  ('a3110210-1050-4000-8000-000000000001', 'a3110210-1000-4000-8000-000000000001', 'guide', 'active'),
  ('a3110210-1050-4000-8000-000000000002', 'a3110210-1000-4000-8000-000000000002', 'explorer', 'active');

insert into core.organization (organization_id, organization_name)
values ('a3110210-1100-4000-8000-000000000001', 'S02 Concurrent Organization');

insert into core.practice (practice_id, organization_id, practice_name)
values (
  'a3110210-1200-4000-8000-000000000001',
  'a3110210-1100-4000-8000-000000000001',
  'S02 Concurrent Practice'
);

insert into core.guide_profile (
  guide_profile_id,
  user_account_id,
  guide_display_name
) values (
  'a3110210-1300-4000-8000-000000000001',
  'a3110210-1000-4000-8000-000000000001',
  'Morgan Concurrent'
);

insert into core.explorer_profile (
  explorer_profile_id,
  user_account_id,
  explorer_display_name,
  onboarding_status
) values (
  'a3110210-1400-4000-8000-000000000001',
  'a3110210-1000-4000-8000-000000000002',
  'Avery Concurrent',
  'active'
);

insert into core.guide_explorer_relationship (
  guide_explorer_relationship_id,
  guide_profile_id,
  explorer_profile_id,
  practice_id,
  relationship_status,
  started_at
) values (
  'a3110210-1500-4000-8000-000000000001',
  'a3110210-1300-4000-8000-000000000001',
  'a3110210-1400-4000-8000-000000000001',
  'a3110210-1200-4000-8000-000000000001',
  'active',
  now() - interval '1 day'
);

insert into content.summary (
  summary_id,
  guide_explorer_relationship_id,
  summary_type,
  summary_status,
  created_by_actor_type,
  created_by_user_account_id
) values (
  'a3110210-2000-4000-8000-000000000001',
  'a3110210-1500-4000-8000-000000000001',
  'explorer_facing_summary',
  'approved',
  'guide',
  'a3110210-1000-4000-8000-000000000001'
);

insert into content.summary_revision (
  summary_revision_id,
  summary_id,
  revision_number,
  content_markdown,
  revision_status,
  created_by_actor_type,
  created_by_user_account_id,
  created_by_role_context
) values (
  'a3110210-2100-4000-8000-000000000001',
  'a3110210-2000-4000-8000-000000000001',
  1,
  'Concurrent publication content.',
  'guide_approved',
  'guide',
  'a3110210-1000-4000-8000-000000000001',
  'guide'
);

update content.summary
   set current_revision_id =
       'a3110210-2100-4000-8000-000000000001'
 where summary_id = 'a3110210-2000-4000-8000-000000000001';

insert into content.summary_section (
  summary_section_id,
  summary_revision_id,
  section_type,
  section_title,
  content_markdown,
  visibility,
  display_order
) values (
  'a3110210-2200-4000-8000-000000000001',
  'a3110210-2100-4000-8000-000000000001',
  'explorer_facing',
  'Concurrent section',
  'One atomic result is expected.',
  'explorer_publishable',
  1
);

insert into content.private_summary_draft (
  private_summary_draft_id,
  guide_explorer_relationship_id,
  explorer_profile_id,
  waypoint_reached_at,
  sendability_days_applied,
  sendable_until
) values (
  'a3110210-4000-4000-8000-000000000001',
  'a3110210-1500-4000-8000-000000000001',
  'a3110210-1400-4000-8000-000000000001',
  date_trunc('second', now()),
  7,
  date_trunc('second', now()) + interval '7 days'
);

insert into content.private_summary_draft_item (
  private_summary_draft_item_id,
  private_summary_draft_id,
  item_type,
  source_type,
  content_markdown,
  selection_state,
  display_order
) values (
  'a3110210-4200-4000-8000-000000000001',
  'a3110210-4000-4000-8000-000000000001',
  'main_point',
  'explorer_authored',
  'One immutable concurrent result is expected.',
  'included',
  1
);

commit;

select lives_ok(
  pg_catalog.format(
    $q$select dblink_connect('s02_summary_a', 'host=host.docker.internal port=54322 dbname=%s user=postgres password=postgres connect_timeout=5')$q$,
    pg_catalog.current_database()
  ),
  'connection A opens'
);
select lives_ok(
  pg_catalog.format(
    $q$select dblink_connect('s02_summary_b', 'host=host.docker.internal port=54322 dbname=%s user=postgres password=postgres connect_timeout=5')$q$,
    pg_catalog.current_database()
  ),
  'connection B opens'
);
select is(dblink_exec('s02_summary_a', 'set statement_timeout=''8s'''), 'SET', 'connection A timeout is bounded');
select is(dblink_exec('s02_summary_b', 'set statement_timeout=''8s'''), 'SET', 'connection B timeout is bounded');

create temp table s02_worker_pids as
select 'a'::text as worker, pid
  from dblink('s02_summary_a', 'select pg_backend_pid()') result(pid integer)
union all
select 'b'::text as worker, pid
  from dblink('s02_summary_b', 'select pg_backend_pid()') result(pid integer);

select is((select pg_catalog.count(distinct pid)::integer from s02_worker_pids), 2, 'workers use distinct sessions');

select is(dblink_exec('s02_summary_a', 'begin'), 'BEGIN', 'A begins publication transaction');
select is(dblink_exec('s02_summary_b', 'begin'), 'BEGIN', 'B begins publication transaction');

select dblink_exec(
  's02_summary_b',
  $remote$
    create function pg_temp.capture_publish_error()
    returns table(error_sqlstate text, error_message text)
    language plpgsql
    as $function$
    begin
      perform *
        from public.solmind_publish_summary_to_explorer(
          'a3110210-2000-4000-8000-000000000001',
          'a3110210-2100-4000-8000-000000000001',
          'a3110210-1400-4000-8000-000000000001',
          'a3110210-1000-4000-8000-000000000001',
          1,
          'a3110210-3000-4000-8000-000000000002'
        );
      return query select null::text, null::text;
    exception when others then
      return query select sqlstate::text, sqlerrm::text;
    end;
    $function$
  $remote$
);

create temp table s02_publish_a as
select *
  from dblink(
    's02_summary_a',
    $call$
      select *
        from public.solmind_publish_summary_to_explorer(
          'a3110210-2000-4000-8000-000000000001',
          'a3110210-2100-4000-8000-000000000001',
          'a3110210-1400-4000-8000-000000000001',
          'a3110210-1000-4000-8000-000000000001',
          1,
          'a3110210-3000-4000-8000-000000000001'
        )
    $call$
  ) result(outcome text, publication_id uuid, summary_version bigint);

select is((select outcome from s02_publish_a), 'published', 'A publishes inside its open transaction');

select is(
  dblink_send_query('s02_summary_b', 'select * from pg_temp.capture_publish_error()'),
  1,
  'B launches a stale competing publication'
);
select ok(
  pg_temp.s02_wait_for_lock(
    's02_summary_b',
    (select pid from s02_worker_pids where worker = 'b')
  ),
  'B waits on the protected Summary row'
);
select is(dblink_exec('s02_summary_a', 'commit'), 'COMMIT', 'A commits first');

create temp table s02_publish_b as
select *
  from dblink_get_result('s02_summary_b')
       result(error_sqlstate text, error_message text);

-- libpq requires asynchronous results to be drained through the terminal
-- null result before the connection can accept another command.
do $$
begin
  perform *
    from dblink_get_result('s02_summary_b')
         result(error_sqlstate text, error_message text);
end;
$$;

select is((select error_sqlstate from s02_publish_b), 'P0001', 'B receives a controlled failure');
select is((select error_message from s02_publish_b), 'solmind_summary_publish_stale_version', 'B fails closed on stale version');
select is(dblink_exec('s02_summary_b', 'commit'), 'COMMIT', 'B commits no publication writes');

select is((select pg_catalog.count(*)::integer from content.summary_publication where summary_id = 'a3110210-2000-4000-8000-000000000001'), 1, 'concurrent publication creates one record');
select is((select pg_catalog.count(*)::integer from audit.audit_event where event_type = 'summary_publication_changed' and target_entity_id in (select summary_publication_id from content.summary_publication where summary_id = 'a3110210-2000-4000-8000-000000000001')), 1, 'concurrent publication creates one audit event');
select is((select version from content.summary where summary_id = 'a3110210-2000-4000-8000-000000000001'), 2::bigint, 'concurrent publication advances version once');

select is(dblink_exec('s02_summary_a', 'begin'), 'BEGIN', 'A begins Snapshot transaction');
select is(dblink_exec('s02_summary_b', 'begin'), 'BEGIN', 'B begins Snapshot transaction');

select dblink_exec(
  's02_summary_b',
  $remote$
    create function pg_temp.capture_snapshot_error()
    returns table(error_sqlstate text, error_message text)
    language plpgsql
    as $function$
    begin
      perform *
        from public.solmind_confirm_shared_snapshot(
          'a3110210-4000-4000-8000-000000000001',
          'a3110210-1000-4000-8000-000000000002',
          1,
          'original',
          null,
          'a3110210-4300-4000-8000-000000000002'
        );
      return query select null::text, null::text;
    exception when others then
      return query select sqlstate::text, sqlerrm::text;
    end;
    $function$
  $remote$
);

create temp table s02_snapshot_a as
select *
  from dblink(
    's02_summary_a',
    $call$
      select *
        from public.solmind_confirm_shared_snapshot(
          'a3110210-4000-4000-8000-000000000001',
          'a3110210-1000-4000-8000-000000000002',
          1,
          'original',
          null,
          'a3110210-4300-4000-8000-000000000001'
        )
    $call$
  ) result(outcome text, snapshot_id uuid, draft_version bigint);

select is((select outcome from s02_snapshot_a), 'confirmed', 'A confirms inside its open transaction');

select is(
  dblink_send_query('s02_summary_b', 'select * from pg_temp.capture_snapshot_error()'),
  1,
  'B launches a stale competing confirmation'
);
select ok(
  pg_temp.s02_wait_for_lock(
    's02_summary_b',
    (select pid from s02_worker_pids where worker = 'b')
  ),
  'B waits on the protected private-draft row'
);
select is(dblink_exec('s02_summary_a', 'commit'), 'COMMIT', 'A commits the exact Snapshot');

create temp table s02_snapshot_b as
select *
  from dblink_get_result('s02_summary_b')
       result(error_sqlstate text, error_message text);

-- Drain the terminal asynchronous result before reusing connection B.
do $$
begin
  perform *
    from dblink_get_result('s02_summary_b')
         result(error_sqlstate text, error_message text);
end;
$$;

select is((select error_sqlstate from s02_snapshot_b), 'P0001', 'competing confirmation gets controlled failure');
select is((select error_message from s02_snapshot_b), 'solmind_shared_snapshot_stale_version', 'competing confirmation fails on stale version');
select is(dblink_exec('s02_summary_b', 'commit'), 'COMMIT', 'B commits no Snapshot writes');

select is((select pg_catalog.count(*)::integer from content.shared_snapshot where source_private_summary_draft_id = 'a3110210-4000-4000-8000-000000000001'), 1, 'concurrent confirmation creates one Snapshot');
select is((select pg_catalog.count(*)::integer from content.shared_snapshot_item where source_private_summary_draft_item_id = 'a3110210-4200-4000-8000-000000000001'), 1, 'concurrent confirmation copies one exact item');
select is((select pg_catalog.count(*)::integer from audit.audit_event where event_type = 'shared_snapshot_confirmed' and metadata ->> 'private_summary_draft_id' = 'a3110210-4000-4000-8000-000000000001'), 1, 'concurrent confirmation creates one audit event');
select is((select version from content.private_summary_draft where private_summary_draft_id = 'a3110210-4000-4000-8000-000000000001'), 2::bigint, 'concurrent confirmation advances version once');

select is(dblink_disconnect('s02_summary_a'), 'OK', 'connection A closes');
select is(dblink_disconnect('s02_summary_b'), 'OK', 'connection B closes');

-- Exact cleanup of committed reserved synthetic rows.
begin;
alter table content.shared_snapshot_item disable trigger shared_snapshot_item_immutable_trigger;
alter table content.shared_snapshot disable trigger shared_snapshot_immutable_trigger;
alter table content.summary_publication disable trigger summary_publication_identity_immutable_trigger;
alter table content.summary_section disable trigger summary_section_content_immutable_trigger;
alter table content.summary_revision disable trigger summary_revision_content_immutable_trigger;

delete from audit.audit_event
 where event_type in ('summary_publication_changed', 'shared_snapshot_confirmed')
   and (
     metadata ->> 'operation_id' like 'a3110210-%'
     or metadata ->> 'private_summary_draft_id' =
        'a3110210-4000-4000-8000-000000000001'
   );
delete from content.shared_snapshot_item
 where source_private_summary_draft_item_id =
       'a3110210-4200-4000-8000-000000000001';
delete from content.shared_snapshot
 where source_private_summary_draft_id =
       'a3110210-4000-4000-8000-000000000001';
delete from content.private_summary_draft_item
 where private_summary_draft_id =
       'a3110210-4000-4000-8000-000000000001';
delete from content.private_summary_draft
 where private_summary_draft_id =
       'a3110210-4000-4000-8000-000000000001';
delete from content.summary_publication
 where summary_id = 'a3110210-2000-4000-8000-000000000001';
delete from content.summary_section
 where summary_revision_id = 'a3110210-2100-4000-8000-000000000001';
update content.summary
   set current_revision_id = null
 where summary_id = 'a3110210-2000-4000-8000-000000000001';
delete from content.summary_revision
 where summary_id = 'a3110210-2000-4000-8000-000000000001';
delete from content.summary
 where summary_id = 'a3110210-2000-4000-8000-000000000001';

alter table content.shared_snapshot_item enable trigger shared_snapshot_item_immutable_trigger;
alter table content.shared_snapshot enable trigger shared_snapshot_immutable_trigger;
alter table content.summary_publication enable trigger summary_publication_identity_immutable_trigger;
alter table content.summary_section enable trigger summary_section_content_immutable_trigger;
alter table content.summary_revision enable trigger summary_revision_content_immutable_trigger;

delete from core.guide_explorer_relationship
 where guide_explorer_relationship_id =
       'a3110210-1500-4000-8000-000000000001';
delete from core.explorer_profile
 where explorer_profile_id = 'a3110210-1400-4000-8000-000000000001';
delete from core.guide_profile
 where guide_profile_id = 'a3110210-1300-4000-8000-000000000001';
delete from core.practice
 where practice_id = 'a3110210-1200-4000-8000-000000000001';
delete from core.organization
 where organization_id = 'a3110210-1100-4000-8000-000000000001';
delete from identity.user_role_assignment
 where user_role_assignment_id in (
   'a3110210-1050-4000-8000-000000000001',
   'a3110210-1050-4000-8000-000000000002'
 );
delete from identity.user_account
 where user_account_id in (
   'a3110210-1000-4000-8000-000000000001',
   'a3110210-1000-4000-8000-000000000002'
 );

select is((select pg_catalog.count(*)::integer from content.summary where summary_id = 'a3110210-2000-4000-8000-000000000001'), 0, 'cleanup removes reserved Summary rows');
select is((select pg_catalog.count(*)::integer from content.shared_snapshot where source_private_summary_draft_id = 'a3110210-4000-4000-8000-000000000001'), 0, 'cleanup removes reserved Snapshot rows');

select * from finish();
commit;

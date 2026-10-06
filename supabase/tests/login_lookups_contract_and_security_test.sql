-- Login step 6 sub-slice S6-5 contract and security proofs for the dormant sign-in lookups
-- public.solmind_resolve_login_account and public.solmind_confirm_redeemed_login_challenge.
-- Source: solmind-sprints/PRJ01-SPR001/Validation_Workspaces/Login_Step6_Main_Slice_Plan_2026-10-05_0112_R03.md
-- (G2 and G7, accepted as Paul's 2026-10-05 decision 2) under AUTH-RLS-DEC-043.
-- Local ephemeral database only. Seeds no data; everything rolls back.
begin;
select plan(97);

-- The account lookup's exact contract.
select has_function('public','solmind_resolve_login_account',array['text','text','text'],'account lookup exists with the exact argument types');
select function_lang_is('public','solmind_resolve_login_account',array['text','text','text'],'plpgsql','account lookup is plpgsql');
select volatility_is('public','solmind_resolve_login_account',array['text','text','text'],'stable','account lookup is stable, so it cannot write');
select is(
  (select count(*)::int from pg_proc p where p.proname='solmind_resolve_login_account'),
  1,
  'exactly one account lookup exists in any schema (no overload)'
);
select is(
  pg_get_function_result('public.solmind_resolve_login_account(text,text,text)'::regprocedure),
  'TABLE(user_account_id uuid, user_contact_method_id uuid, normalized_contact_value text, provider_user_id text)',
  'account lookup returns only the account, its sign-in email contact, that canonical email, and the bound provider user id'
);
select is(
  pg_get_function_arguments('public.solmind_resolve_login_account(text,text,text)'::regprocedure),
  'p_normalized_login_identifier text, p_login_identifier_type text, p_requested_role_context text',
  'account lookup takes only the canonical identifier, its type, and the role the route fixes'
);
select ok((select prosecdef from pg_proc where oid='public.solmind_resolve_login_account(text,text,text)'::regprocedure),'account lookup is security definer');
select is((select pg_get_userbyid(proowner) from pg_proc where oid='public.solmind_resolve_login_account(text,text,text)'::regprocedure),'postgres','account lookup owner is postgres');
select is(
  (select proconfig from pg_proc where oid='public.solmind_resolve_login_account(text,text,text)'::regprocedure),
  array['search_path=""']::text[],
  'account lookup has an empty search_path and no other setting'
);
select ok(
  (select obj_description('public.solmind_resolve_login_account(text,text,text)'::regprocedure,'pg_proc') like '%service_role-only%'),
  'account lookup carries its dormant service-role-only comment'
);

-- The redeemed-challenge confirmation's exact contract.
select has_function('public','solmind_confirm_redeemed_login_challenge',array['uuid','uuid','text'],'confirmation exists with the exact argument types');
select function_lang_is('public','solmind_confirm_redeemed_login_challenge',array['uuid','uuid','text'],'plpgsql','confirmation is plpgsql');
select volatility_is('public','solmind_confirm_redeemed_login_challenge',array['uuid','uuid','text'],'stable','confirmation is stable, so it cannot write');
select is(
  (select count(*)::int from pg_proc p where p.proname='solmind_confirm_redeemed_login_challenge'),
  1,
  'exactly one confirmation exists in any schema (no overload)'
);
select is(
  pg_get_function_result('public.solmind_confirm_redeemed_login_challenge(uuid,uuid,text)'::regprocedure),
  'TABLE(confirmed boolean)',
  'confirmation returns only one boolean column'
);
select is(
  pg_get_function_arguments('public.solmind_confirm_redeemed_login_challenge(uuid,uuid,text)'::regprocedure),
  'p_user_account_id uuid, p_verification_challenge_id uuid, p_expected_purpose text',
  'confirmation takes only the server-derived account, the exact selector, and the expected purpose'
);
select ok((select prosecdef from pg_proc where oid='public.solmind_confirm_redeemed_login_challenge(uuid,uuid,text)'::regprocedure),'confirmation is security definer');
select is((select pg_get_userbyid(proowner) from pg_proc where oid='public.solmind_confirm_redeemed_login_challenge(uuid,uuid,text)'::regprocedure),'postgres','confirmation owner is postgres');
select is(
  (select proconfig from pg_proc where oid='public.solmind_confirm_redeemed_login_challenge(uuid,uuid,text)'::regprocedure),
  array['search_path=""']::text[],
  'confirmation has an empty search_path and no other setting'
);
select ok(
  (select obj_description('public.solmind_confirm_redeemed_login_challenge(uuid,uuid,text)'::regprocedure,'pg_proc') like '%service_role-only%'),
  'confirmation carries its dormant service-role-only comment'
);

-- Grants: service_role only.
select ok(has_function_privilege('service_role','public.solmind_resolve_login_account(text,text,text)','EXECUTE'),'service_role can execute the account lookup');
select ok(not has_function_privilege('anon','public.solmind_resolve_login_account(text,text,text)','EXECUTE'),'anon cannot execute the account lookup');
select ok(not has_function_privilege('authenticated','public.solmind_resolve_login_account(text,text,text)','EXECUTE'),'authenticated cannot execute the account lookup');
select ok(not has_function_privilege('public','public.solmind_resolve_login_account(text,text,text)','EXECUTE'),'PUBLIC cannot execute the account lookup');
select ok(has_function_privilege('service_role','public.solmind_confirm_redeemed_login_challenge(uuid,uuid,text)','EXECUTE'),'service_role can execute the confirmation');
select ok(not has_function_privilege('anon','public.solmind_confirm_redeemed_login_challenge(uuid,uuid,text)','EXECUTE'),'anon cannot execute the confirmation');
select ok(not has_function_privilege('authenticated','public.solmind_confirm_redeemed_login_challenge(uuid,uuid,text)','EXECUTE'),'authenticated cannot execute the confirmation');
select ok(not has_function_privilege('public','public.solmind_confirm_redeemed_login_challenge(uuid,uuid,text)','EXECUTE'),'PUBLIC cannot execute the confirmation');
select is(
  (select count(*)::int
     from pg_proc p
     cross join lateral aclexplode(p.proacl) acl
    where p.oid in ('public.solmind_resolve_login_account(text,text,text)'::regprocedure,
                    'public.solmind_confirm_redeemed_login_challenge(uuid,uuid,text)'::regprocedure)
      and (acl.grantee=0::oid or acl.grantee in ('anon'::regrole::oid,'authenticated'::regrole::oid))),
  0,
  'neither function ACL holds a PUBLIC, anon, or authenticated entry'
);
select is(
  (select count(*)::int
     from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where p.proname in ('solmind_resolve_login_account','solmind_confirm_redeemed_login_challenge')
      and n.nspname='public'),
  2,
  'both functions are in the public schema, which the Data API serves, so service-role RPC execution stays available'
);

-- Source: read-only, no exception handler, the fixed identifiers, and what each reads.
select is(
  (select count(*)::int
     from pg_proc p
     cross join lateral regexp_matches(p.prosrc,'(insert\s+into|update|delete\s+from|truncate|merge\s+into)\s+[a-z_]+\.[a-z_]+','gi') m
    where p.oid in ('public.solmind_resolve_login_account(text,text,text)'::regprocedure,
                    'public.solmind_confirm_redeemed_login_challenge(uuid,uuid,text)'::regprocedure)),
  0,
  'neither function has a write statement'
);
select ok(
  (select bool_and(p.prosrc !~* 'exception\s+when'
                   and p.prosrc not ilike '%when others%'
                   and p.prosrc not ilike '%sqlerrm%'
                   and p.prosrc not ilike '%sqlstate%'
                   and p.prosrc not ilike '%stacked diagnostics%'
                   and p.prosrc not ilike '% using %'
                   and p.prosrc not ilike '%for update%'
                   and p.prosrc not ilike '%for share%'
                   and p.prosrc not ilike '%advisory%')
     from pg_proc p
    where p.oid in ('public.solmind_resolve_login_account(text,text,text)'::regprocedure,
                    'public.solmind_confirm_redeemed_login_challenge(uuid,uuid,text)'::regprocedure)),
  'neither function has an exception handler, passes on error text, or takes a lock'
);
select ok(
  (select prosrc like '%solmind_login_lookup_invalid_identifier''%'
      and prosrc like '%solmind_login_lookup_invalid_identifier_type''%'
      and prosrc like '%solmind_login_lookup_invalid_role''%'
     from pg_proc where oid='public.solmind_resolve_login_account(text,text,text)'::regprocedure),
  'account lookup carries its three fixed value-free failure identifiers'
);
select ok(
  (select prosrc like '%solmind_login_confirm_invalid_account''%'
      and prosrc like '%solmind_login_confirm_invalid_challenge''%'
      and prosrc like '%solmind_login_confirm_invalid_purpose''%'
     from pg_proc where oid='public.solmind_confirm_redeemed_login_challenge(uuid,uuid,text)'::regprocedure),
  'confirmation carries its three fixed value-free failure identifiers'
);
select ok(
  (select prosrc not like '%verification_challenge%'
      and prosrc not like '%user_session%'
      and prosrc not like '%authorizing_evidence%'
      and prosrc not like '%audit%'
      and prosrc not like '%invite%'
     from pg_proc where oid='public.solmind_resolve_login_account(text,text,text)'::regprocedure),
  'account lookup reads no challenge, session, evidence-consumption, audit, or invitation state'
);
select ok(
  (select prosrc like '%from identity.user_account account%'
      and prosrc like '%join identity.user_contact_method contact%'
      and prosrc like '%join identity.auth_provider_identity provider_identity%'
      and prosrc like '%from identity.user_role_assignment assignment%'
     from pg_proc where oid='public.solmind_resolve_login_account(text,text,text)'::regprocedure),
  'account lookup reads only the account, contact, provider identity, and role assignment tables'
);
select ok(
  (select prosrc like '%account.account_status = ''active''%'
      and prosrc like '%contact.contact_method_type = ''email''%'
      and prosrc like '%contact.status = ''active''%'
      and prosrc like '%contact.is_verified%'
      and prosrc like '%contact.login_enabled%'
      and prosrc like '%provider_identity.provider_name = ''supabase''%'
      and prosrc like '%provider_identity.status = ''active''%'
      and prosrc like '%assignment.role_code = p_requested_role_context%'
      and prosrc like '%assignment.role_status = ''active''%'
      and prosrc like '%assignment.revoked_at is null%'
     from pg_proc where oid='public.solmind_resolve_login_account(text,text,text)'::regprocedure),
  'account lookup applies the banked eligibility predicates of issuance and session creation'
);
select ok(
  (select prosrc like '%where (select pg_catalog.count(*) from candidate) = 1;%'
     from pg_proc where oid='public.solmind_resolve_login_account(text,text,text)'::regprocedure),
  'account lookup returns its candidate only when there is exactly one'
);
select ok(
  (select prosrc like '%pg_catalog.lower(account.username) = p_normalized_login_identifier%'
      and prosrc like '%p_login_identifier_type = ''username'' and p_requested_role_context <> ''admin''%'
      and prosrc like '%pg_catalog.length(pg_catalog.btrim(p_normalized_login_identifier)) > 0%'
      and prosrc not like '%[[:cntrl:]%'
      and prosrc not like '%[[:space:]%'
      and prosrc not like '%octet_length(p_normalized_login_identifier)%= pg_catalog.char_length(p_normalized_login_identifier)%'
      and prosrc not like '%between 1 and 254%'
     from pg_proc where oid='public.solmind_resolve_login_account(text,text,text)'::regprocedure),
  'the username path is the Admin''s only, checks only the schema''s nonblank rule and lowercase form, imposes no other username form, and compares lower(username), the unique index expression'
);
select ok(
  (select strpos(prosrc, $pat$and contact.normalized_contact_value ~ '^[a-z0-9.!#$%&''*+/=?^_`{|}~-]+@[a-z0-9.-]+$'$pat$) > 0
      and strpos(prosrc, $pat$and contact.normalized_contact_value !~ '\.\.'$pat$) > 0
      and strpos(prosrc, 'and pg_catalog.octet_length(contact.normalized_contact_value) <= 254') > 0
      and strpos(prosrc, 'and pg_catalog.char_length(contact.normalized_contact_value) between 3 and 254') > 0
      and strpos(prosrc, 'and contact.normalized_contact_value = pg_catalog.lower(contact.normalized_contact_value)') > 0
     from pg_proc where oid='public.solmind_resolve_login_account(text,text,text)'::regprocedure),
  'the candidate query applies the issuance function''s canonical email check to the stored email, so either path returns only an email issuance accepts'
);
select ok(
  (select strpos(g2.prosrc, $pat$~ '^[a-z0-9.!#$%&''*+/=?^_`{|}~-]+@[a-z0-9.-]+$'$pat$) > 0
      and strpos(issue.prosrc, $pat$~ '^[a-z0-9.!#$%&''*+/=?^_`{|}~-]+@[a-z0-9.-]+$'$pat$) > 0
      and strpos(g2.prosrc, $pat$!~ '\.\.'$pat$) > 0
      and strpos(issue.prosrc, $pat$!~ '\.\.'$pat$) > 0
      and strpos(g2.prosrc, 'char_length(p_normalized_login_identifier) between 3 and 254') > 0
      and strpos(issue.prosrc, 'char_length(p_normalized_contact_value) between 3 and 254') > 0
     from pg_proc g2, pg_proc issue
    where g2.oid='public.solmind_resolve_login_account(text,text,text)'::regprocedure
      and issue.oid='public.solmind_issue_verification_challenge(uuid,text,text,text,text,text,uuid,uuid)'::regprocedure),
  'the canonical email check is the issuance function''s own: the same pattern, the same no-double-dot rule, and the same 3 to 254 bounds'
);
select ok(
  (select prosrc not ilike '%now()%'
      and prosrc not ilike '%timestamp%'
      and prosrc not ilike '%timeofday%'
     from pg_proc where oid='public.solmind_resolve_login_account(text,text,text)'::regprocedure),
  'account lookup uses no clock'
);
select is(
  (select (length(prosrc) - length(replace(prosrc,'identity.verification_challenge','')))/length('identity.verification_challenge')
     from pg_proc where oid='public.solmind_confirm_redeemed_login_challenge(uuid,uuid,text)'::regprocedure),
  1,
  'confirmation reads the challenge table in exactly one place'
);
select ok(
  (select prosrc like '%where challenge.verification_challenge_id = p_verification_challenge_id%'
      and prosrc not ilike '%order by%'
      and prosrc not ilike '%limit%'
      and prosrc not ilike '%max(%'
      and prosrc not like '%normalized_contact_value%'
      and prosrc not like '%user_session%'
      and prosrc not like '%authorizing_evidence%'
      and prosrc not like '%audit%'
     from pg_proc where oid='public.solmind_confirm_redeemed_login_challenge(uuid,uuid,text)'::regprocedure),
  'confirmation reads one challenge by its exact selector only: no newest-open lookup, contact search, session, evidence-consumption, or audit read'
);
select ok(
  (select prosrc like '%challenge.user_account_id = p_user_account_id%'
      and prosrc like '%challenge.user_contact_method_id is not null%'
      and prosrc like '%challenge.purpose = p_expected_purpose%'
      and prosrc like '%challenge.used_at is not null%'
      and prosrc like '%challenge.invalidated_at is null%'
      and prosrc like '%challenge.used_at <= v_now%'
      and prosrc like '%challenge.used_at >= v_now - pg_catalog.make_interval(secs => policy.active_seconds)%'
     from pg_proc where oid='public.solmind_confirm_redeemed_login_challenge(uuid,uuid,text)'::regprocedure),
  'confirmation applies the session function''s evidence predicates and freshness comparison'
);
select ok(
  (select prosrc like '%identity.session_creation_freshness_policy policy%'
      and prosrc like '%policy.policy_name = ''redeemed_evidence_freshness''%'
      and prosrc like '%policy.minimum_seconds > 0%'
      and prosrc like '%policy.minimum_seconds <= policy.active_seconds%'
      and prosrc like '%policy.active_seconds <= policy.maximum_seconds%'
     from pg_proc where oid='public.solmind_confirm_redeemed_login_challenge(uuid,uuid,text)'::regprocedure),
  'confirmation reads the protected freshness policy by its fixed name and requires it to be valid'
);
select is(
  (select (length(prosrc) - length(replace(prosrc,'statement_timestamp(','')))/length('statement_timestamp(')
     from pg_proc where oid='public.solmind_confirm_redeemed_login_challenge(uuid,uuid,text)'::regprocedure),
  1,
  'confirmation reads the statement clock exactly once'
);
select ok(
  (select prosrc not ilike '%now()%'
      and prosrc not ilike '%clock_timestamp%'
      and prosrc not ilike '%transaction_timestamp%'
      and prosrc not ilike '%current_timestamp%'
      and prosrc not ilike '%localtimestamp%'
      and prosrc not ilike '%timeofday%'
     from pg_proc where oid='public.solmind_confirm_redeemed_login_challenge(uuid,uuid,text)'::regprocedure),
  'confirmation uses no other time source'
);
select ok(
  (select prosrc like '%return query%select exists (%'
     from pg_proc where oid='public.solmind_confirm_redeemed_login_challenge(uuid,uuid,text)'::regprocedure),
  'confirmation returns one exists() result, so every call that passes its argument checks gives exactly one row'
);

-- Malformed arguments raise one fixed identifier each, which carries no part of the input.
set local role service_role;
select throws_ok(
  $$select * from public.solmind_resolve_login_account(null,'email','explorer')$$,
  'P0001','solmind_login_lookup_invalid_identifier','a null identifier fails closed'
);
select throws_ok(
  $$select * from public.solmind_resolve_login_account(repeat('a',243)||'@example.com','email','explorer')$$,
  'P0001','solmind_login_lookup_invalid_identifier','an email over 254 bytes fails closed before any pattern work'
);
select throws_ok(
  $$select * from public.solmind_resolve_login_account(null,null,null)$$,
  'P0001','solmind_login_lookup_invalid_identifier','the identifier is checked first'
);
select throws_ok(
  $$select * from public.solmind_resolve_login_account('l65-x@synthetic.invalid',null,'explorer')$$,
  'P0001','solmind_login_lookup_invalid_identifier_type','a null identifier type fails closed'
);
select throws_ok(
  $$select * from public.solmind_resolve_login_account('+15555550100','phone','explorer')$$,
  'P0001','solmind_login_lookup_invalid_identifier_type','a phone identifier is outside step 6 and fails closed'
);
select throws_ok(
  $$select * from public.solmind_resolve_login_account('l65-x@synthetic.invalid','usernames','admin')$$,
  'P0001','solmind_login_lookup_invalid_identifier_type','an identifier type over 8 bytes fails closed'
);
select throws_ok(
  $$select * from public.solmind_resolve_login_account('l65-x@synthetic.invalid','email',null)$$,
  'P0001','solmind_login_lookup_invalid_role','a null role fails closed'
);
select throws_ok(
  $$select * from public.solmind_resolve_login_account('l65-x@synthetic.invalid','email','system')$$,
  'P0001','solmind_login_lookup_invalid_role','an unknown role fails closed'
);
select throws_ok(
  $$select * from public.solmind_resolve_login_account('l65-x@synthetic.invalid','email','explorers')$$,
  'P0001','solmind_login_lookup_invalid_role','a role over 8 bytes fails closed'
);
select throws_ok(
  $$select * from public.solmind_resolve_login_account('l65-guide-user','username','guide')$$,
  'P0001','solmind_login_lookup_invalid_identifier_type','a username for the guide role fails closed: the username is the Admin''s only'
);
select throws_ok(
  $$select * from public.solmind_resolve_login_account('l65-explorer-user','username','explorer')$$,
  'P0001','solmind_login_lookup_invalid_identifier_type','a username for the explorer role fails closed'
);
select throws_ok(
  $$select * from public.solmind_resolve_login_account('L65-X@synthetic.invalid','email','explorer')$$,
  'P0001','solmind_login_lookup_invalid_identifier','a non-canonical (uppercase) email fails closed'
);
select throws_ok(
  $$select * from public.solmind_resolve_login_account('l65..x@synthetic.invalid','email','explorer')$$,
  'P0001','solmind_login_lookup_invalid_identifier','an email with a double dot fails closed'
);
select throws_ok(
  $$select * from public.solmind_resolve_login_account('l65-x synthetic.invalid','email','explorer')$$,
  'P0001','solmind_login_lookup_invalid_identifier','an email outside the issuance pattern fails closed'
);
select throws_ok(
  $$select * from public.solmind_resolve_login_account('a@','email','explorer')$$,
  'P0001','solmind_login_lookup_invalid_identifier','an email under 3 characters fails closed'
);
select throws_ok(
  $$select * from public.solmind_resolve_login_account('L65-Admin','username','admin')$$,
  'P0001','solmind_login_lookup_invalid_identifier','a non-canonical (uppercase) username fails closed'
);
select throws_ok(
  $$select * from public.solmind_resolve_login_account('','username','admin')$$,
  'P0001','solmind_login_lookup_invalid_identifier','an empty username fails closed'
);
select throws_ok(
  $$select * from public.solmind_resolve_login_account('   ','username','admin')$$,
  'P0001','solmind_login_lookup_invalid_identifier','a blank username fails closed, as the schema''s nonblank rule has it'
);
-- No other username form is imposed: these usernames, which the schema allows, are looked up, not refused.
select is(
  (select count(*)::int from public.solmind_resolve_login_account('l65 admin','username','admin')),
  0,
  'a username with an internal space is looked up, not refused'
);
select is(
  (select count(*)::int from public.solmind_resolve_login_account('l65-admin@synthetic.invalid','username','admin')),
  0,
  'a username with an at sign is looked up, not refused'
);
select is(
  (select count(*)::int from public.solmind_resolve_login_account('l65-'||chr(233)||'dmin','username','admin')),
  0,
  'a lowercase username outside ASCII is looked up, not refused'
);
select is(
  (select count(*)::int from public.solmind_resolve_login_account('l65-admin'||chr(9),'username','admin')),
  0,
  'a nonblank username with a tab is looked up, not refused'
);
select is(
  (select count(*)::int from public.solmind_resolve_login_account(repeat('a',300),'username','admin')),
  0,
  'a username over 254 bytes is looked up, not refused: the byte bound is the email path''s only'
);
select is(
  (select count(*)::int from public.solmind_resolve_login_account('l65-nobody@synthetic.invalid','email','explorer')),
  0,
  'a well-formed email that no account uses returns zero rows, not an error'
);
select is(
  (select count(*)::int from public.solmind_resolve_login_account('l65-nobody','username','admin')),
  0,
  'a well-formed username that no account uses returns zero rows, not an error'
);
select throws_ok(
  $$select * from public.solmind_confirm_redeemed_login_challenge(null,'10650000-2000-4000-8000-000000000001','login')$$,
  'P0001','solmind_login_confirm_invalid_account','a null account fails closed'
);
select throws_ok(
  $$select * from public.solmind_confirm_redeemed_login_challenge('10650000-1000-4000-8000-000000000001',null,'login')$$,
  'P0001','solmind_login_confirm_invalid_challenge','a null selector fails closed'
);
select throws_ok(
  $$select * from public.solmind_confirm_redeemed_login_challenge(null,null,null)$$,
  'P0001','solmind_login_confirm_invalid_account','the account is checked first'
);
select throws_ok(
  $$select * from public.solmind_confirm_redeemed_login_challenge('10650000-1000-4000-8000-000000000001','10650000-2000-4000-8000-000000000001',null)$$,
  'P0001','solmind_login_confirm_invalid_purpose','a null purpose fails closed'
);
select throws_ok(
  $$select * from public.solmind_confirm_redeemed_login_challenge('10650000-1000-4000-8000-000000000001','10650000-2000-4000-8000-000000000001','contact_verify')$$,
  'P0001','solmind_login_confirm_invalid_purpose','a purpose the session function never accepts fails closed'
);
select throws_ok(
  $$select * from public.solmind_confirm_redeemed_login_challenge('10650000-1000-4000-8000-000000000001','10650000-2000-4000-8000-000000000001','role_reentry_')$$,
  'P0001','solmind_login_confirm_invalid_purpose','a purpose over 12 bytes fails closed'
);
select results_eq(
  $$select confirmed from public.solmind_confirm_redeemed_login_challenge('10650000-1000-4000-8000-000000000001','10650000-2000-4000-8000-000000000001','login')$$,
  $$values (false)$$,
  'an unknown selector returns exactly one row: false'
);
reset role;

set local role anon;
select throws_ok(
  $$select * from public.solmind_resolve_login_account('l65-x@synthetic.invalid','email','explorer')$$,
  '42501','permission denied for function solmind_resolve_login_account','anon direct invocation of the account lookup is denied'
);
select throws_ok(
  $$select * from public.solmind_confirm_redeemed_login_challenge('10650000-1000-4000-8000-000000000001','10650000-2000-4000-8000-000000000001','login')$$,
  '42501','permission denied for function solmind_confirm_redeemed_login_challenge','anon direct invocation of the confirmation is denied'
);
reset role;
set local role authenticated;
select throws_ok(
  $$select * from public.solmind_resolve_login_account('l65-x@synthetic.invalid','email','explorer')$$,
  '42501','permission denied for function solmind_resolve_login_account','authenticated direct invocation of the account lookup is denied'
);
select throws_ok(
  $$select * from public.solmind_confirm_redeemed_login_challenge('10650000-1000-4000-8000-000000000001','10650000-2000-4000-8000-000000000001','login')$$,
  '42501','permission denied for function solmind_confirm_redeemed_login_challenge','authenticated direct invocation of the confirmation is denied'
);
reset role;

-- The posture the two functions rely on stays as it is.
select ok(
  (select bool_and(c.relrowsecurity and not c.relforcerowsecurity)
     from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='identity'
      and c.relname in ('user_account','user_contact_method','auth_provider_identity','user_role_assignment','verification_challenge','session_creation_freshness_policy')),
  'every table the functions read keeps RLS enabled and not forced'
);
select is(
  (select count(*)::int
     from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='identity'
      and c.relname in ('user_account','user_contact_method','auth_provider_identity','user_role_assignment','verification_challenge','session_creation_freshness_policy')),
  6,
  'all six tables the functions read exist'
);
select ok(
  (select bool_or(has_table_privilege(r.rolname, format('identity.%I', c.relname), 'SELECT'))
     from pg_class c join pg_namespace n on n.oid=c.relnamespace
     cross join (values ('service_role'),('anon'),('authenticated')) as r(rolname)
    where n.nspname='identity'
      and c.relname in ('user_account','user_contact_method','auth_provider_identity','user_role_assignment','verification_challenge','session_creation_freshness_policy')) is not true,
  'service_role, anon, and authenticated have no select on any table the functions read'
);
select is((select count(*)::int from pg_policies where schemaname in ('identity','core','audit','content','ai','methodology','notification','scheduling')),0,'no policies exist in any SolMind application schema');
select is((select count(*)::int from pg_policies where schemaname='public'),0,'public schema has no policies');
select ok(
  (select i.indisunique
      and pg_get_indexdef(i.indexrelid) like '%ON identity.user_contact_method USING btree (contact_method_type, normalized_contact_value)%'
      and pg_get_expr(i.indpred,i.indrelid) like '%is_verified%'
      and pg_get_expr(i.indpred,i.indrelid) like '%login_enabled%'
      and pg_get_expr(i.indpred,i.indrelid) like '%status = ''active''%'
     from pg_index i
    where i.indexrelid='identity.user_contact_method_unique_login_contact_idx'::regclass),
  'one sign-in contact per type and value: the email path finds at most one contact'
);
select ok(
  (select i.indisunique
      and pg_get_indexdef(i.indexrelid) like '%ON identity.user_account USING btree (lower(username))%'
      and pg_get_expr(i.indpred,i.indrelid) like '%username IS NOT NULL%'
      and pg_get_expr(i.indpred,i.indrelid) like '%account_status <> ''deleted''%'
     from pg_index i
    where i.indexrelid='identity.user_account_username_unique_idx'::regclass),
  'one non-deleted account per lowercased username: the username path finds at most one active account'
);
select ok(
  (select (pg_get_constraintdef(c.oid) like '%login_enabled = false%' or pg_get_constraintdef(c.oid) like '%NOT login_enabled%')
      and pg_get_constraintdef(c.oid) like '%is_verified%'
      and pg_get_constraintdef(c.oid) like '%status = ''active''%'
      and pg_get_constraintdef(c.oid) like '% OR %'
     from pg_constraint c
    where c.conrelid='identity.user_contact_method'::regclass
      and c.conname='user_contact_method_login_requires_verified_active_check'
      and c.contype='c'),
  'the schema still requires a sign-in-enabled contact to be verified and active, so an unverified or inactive contact is never sign-in enabled'
);
select is(
  (select pg_get_indexdef(indexrelid) from pg_index where indexrelid='identity.auth_provider_identity_one_active_account_provider_idx'::regclass),
  'CREATE UNIQUE INDEX auth_provider_identity_one_active_account_provider_idx ON identity.auth_provider_identity USING btree (user_account_id, provider_name) WHERE (status = ''active''::text)',
  'one active provider identity per account and provider: the lookup finds at most one bound provider user id'
);
select is(
  (select pg_get_constraintdef(oid) from pg_constraint where conrelid='identity.session_creation_freshness_policy'::regclass and contype='p'),
  'PRIMARY KEY (policy_name)',
  'the freshness policy is a structural singleton by name, which the confirmation reads'
);
select is(
  pg_get_function_result('public.solmind_redeem_verification_challenge(uuid,text,text)'::regprocedure),
  'TABLE(outcome text)',
  'redemption still returns only its outcome (AUTH-RLS-DEC-038 boundary unchanged)'
);
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='graphql_public' and p.proname like 'solmind\_%'),
  0,
  'no SolMind function is placed in the GraphQL-exposed schema'
);

select * from finish();
rollback;

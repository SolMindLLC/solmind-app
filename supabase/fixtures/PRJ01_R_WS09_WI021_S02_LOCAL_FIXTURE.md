# PRJ01_R-WS09-WI021-S02 Local Development/Test Fixture

## Boundary

This fixture exists only for a local SolMind development/test database. It is
not a migration, is not referenced by `supabase/seed.sql`, and must never be run
against a cloud, preview, staging, pilot, or production database.

It uses only the already-banked schema and creates:

- exactly one obviously synthetic Guide account and profile;
- exactly one obviously synthetic Explorer account and profile;
- exactly one synthetic organization and practice needed by the banked
  relationship schema;
- exactly one active Practice-Guide row;
- exactly one active Guide-Explorer relationship; and
- one bounded, Explorer-safe Virtual Guide behavior instruction string stored
  in the banked relationship guardrail field.

It creates no authentication-provider identity, contact method, real user,
production migration, RLS policy, grant, schema object, or universal seed data.

## Deterministic identity

Every fixture row carries:

```text
fixture_id = PRJ01_R-WS09-WI021-S02
fixture_scope = local_development_test_only
synthetic = true
```

Names begin with `SYNTHETIC`, usernames use the reserved
`synthetic.invalid` domain, and every primary key is a fixed UUID in the
`02102000-*` fixture range. The setup refuses any pre-existing deterministic
ID, username, or fixture tag instead of silently replacing data.

## Files

- `prj01_r_ws09_wi021_s02_local_fixture_setup.sql` performs collision checks,
  creates the exact fixture in one transaction, and validates its contract
  before commit.
- `prj01_r_ws09_wi021_s02_local_fixture_validate.sql` performs a read-only,
  exact-cardinality and exact-content check.
- `prj01_r_ws09_wi021_s02_local_fixture_cleanup.sql` owns only the exact
  deterministic fixture identifiers, refuses mismatched or expanded fixture
  data, deletes in foreign-key order in one transaction, and proves zero
  residue before commit.

## Local lifecycle

Use the local database owner and the actual local Supabase database container
name. Do not substitute a remote connection.

Setup:

```powershell
$fixture = Get-Content -LiteralPath '.\supabase\fixtures\prj01_r_ws09_wi021_s02_local_fixture_setup.sql' -Raw
$fixture | docker exec -i supabase_db_solmind-app psql -v ON_ERROR_STOP=1 -U postgres -d postgres
```

Read-only validation:

```powershell
$fixture = Get-Content -LiteralPath '.\supabase\fixtures\prj01_r_ws09_wi021_s02_local_fixture_validate.sql' -Raw
$fixture | docker exec -i supabase_db_solmind-app psql -v ON_ERROR_STOP=1 -U postgres -d postgres
```

Cleanup and in-transaction zero-residue proof:

```powershell
$fixture = Get-Content -LiteralPath '.\supabase\fixtures\prj01_r_ws09_wi021_s02_local_fixture_cleanup.sql' -Raw
$fixture | docker exec -i supabase_db_solmind-app psql -v ON_ERROR_STOP=1 -U postgres -d postgres
```

The setup and cleanup scripts set `ON_ERROR_STOP` themselves. A SQL error stops
the session; PostgreSQL then rolls back the open transaction. The cleanup also
fails if later test activity creates unknown dependencies on the fixture,
rather than cascading into data outside this exact contract.

Run the pgTAP suites only against a clean reset, not while this fixture is
applied.

## Runtime gate

Static review cannot prove PostgreSQL execution, exact committed cardinality,
or cleanup zero residue. Before the proposal can be applied or treated as
ready, run the complete setup, validation, cleanup sequence against a known
idle local development/test database after a clean migration reset. Record:

1. all three native process exit codes;
2. the setup contract-validation success;
3. the standalone read-only validation success;
4. the cleanup zero-residue success; and
5. a final clean local database reset.

No runtime database or Docker action is authorized by this proposal packet
itself.

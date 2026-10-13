<#
.SYNOPSIS
    Login step 7: set up the local demo accounts (Admin, Guide, Explorer) on the real login path. Paul runs it.

.DESCRIPTION
    A Paul-approved maintenance script (AUTH-RLS-DEC-027 named exception; Paul's night decision 4, 2026-09-28). It is
    never part of the app, and it serves the local demo only, never real users.

    - Report: shows whether the demo set is absent, complete or partial. It writes nothing.
    - Create: runs only when the demo set is absent. It creates three Supabase Auth users through the local Auth admin
      interface, then the SolMind records in one transaction (New-SolmindLocalDemoSetup.sql). That includes five demo
      placeholder consent documents and the Explorer's acceptance of each. It never overwrites: a partial or different
      state is reported and refused.
    - If Create fails, it asks the database first. Only when the database finds no matching row does it delete this
      attempt's sign-in users, found by the identifier it put in their metadata, then lists the demo emails again and
      names any user that remains. If the database finds matches, or cannot answer, it deletes nothing and reports.

    Passwords are generated to the local policy: at least 9 characters, with a lowercase letter, an uppercase letter,
    a digit and a symbol, and no < or >. They appear once in this script's output, and the script does not save them.
    Run it in your own terminal, without a transcript or output redirection, so they are not recorded.

    Target (Paul's night decision 4): -Workdir names the Supabase project folder, and -ExpectedProjectId must match its
    config.toml. The defaults are the existing local stack. A later UAT stack is another folder and project id. Before
    any write it requires: a local Docker transport (npipe or unix, never TCP); an API URL on 127.0.0.1; and database
    and API containers labelled with this project id and this folder, with the API container publishing the API port on
    all interfaces or on 127.0.0.1. It does not prove that the listener on 127.0.0.1 is that container.

    The three demo emails are fixed reserved .invalid addresses; they are not parameters.

.EXAMPLE
    .\New-SolmindLocalDemoSetup.ps1                 # Report only
    .\New-SolmindLocalDemoSetup.ps1 -Mode Create    # Create the demo set, when it is absent
#>
[CmdletBinding()]
param(
    [ValidateSet('Report', 'Create')][string]$Mode = 'Report',
    [string]$Workdir = 'C:\_Apollo\Projects\Solmind\solmind-app',
    [string]$ExpectedProjectId = 'solmind-app',
    # Page size for listing sign-in users; the default suits any local stack, and tests use a small one.
    [ValidateRange(1, 1000)][int]$AuthPageSize = 1000
)
$ErrorActionPreference = 'Stop'
$Tag = 'prj01-demo-v1'
$AdminEmail = 'demo-admin@solmind-demo.invalid'
$GuideEmail = 'demo-guide@solmind-demo.invalid'
$ExplorerEmail = 'demo-explorer@solmind-demo.invalid'
# Marks the sign-in users this run creates, so a failed Create deletes only its own.
$Attempt = [guid]::NewGuid().ToString()
$DbContainer = "supabase_db_$ExpectedProjectId"
$ApiContainer = "supabase_kong_$ExpectedProjectId"
$Emails = @($AdminEmail, $GuideEmail, $ExplorerEmail)

# Windows PowerShell 5.1 turns any stderr line from a native command into a terminating error under 'Stop', even with
# 2>$null (the Supabase tool prints notices there). Native commands run under 'Continue' and are judged by exit code.
function Invoke-Native([scriptblock]$Block) {
    $saved = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try { & $Block } finally { $ErrorActionPreference = $saved }
}

function Get-NormalPath([string]$Path) { return [IO.Path]::GetFullPath($Path).TrimEnd('\') }

function Get-Container([string]$Name) {
    $json = Invoke-Native { & docker inspect --type container --format '{{json .}}' $Name 2>$null }
    if ($LASTEXITCODE -ne 0 -or -not $json) { throw "Refusing: the local container $Name was not found." }
    return (($json | ForEach-Object { "$_" }) -join "`n") | ConvertFrom-Json
}

function Get-LocalTarget {
    $cfg = Get-Content -LiteralPath (Join-Path $Workdir 'supabase\config.toml') -Raw
    if ($cfg -notmatch "(?m)^project_id = `"$([regex]::Escape($ExpectedProjectId))`"") { throw "Refusing: $Workdir is not project '$ExpectedProjectId'." }
    # The Docker transport comes first: every later check is a daemon-facing Docker operation.
    if ($env:DOCKER_HOST -and $env:DOCKER_HOST -notmatch '^(npipe|unix)://') { throw "Refusing: DOCKER_HOST is not a local endpoint: '$env:DOCKER_HOST'." }
    $endpoint = "$(Invoke-Native { & docker context inspect --format '{{.Endpoints.docker.Host}}' 2>$null })"
    if ($LASTEXITCODE -ne 0 -or $endpoint -notmatch '^(npipe|unix)://') { throw "Refusing: the Docker context is not a local endpoint: '$endpoint'." }
    Push-Location -LiteralPath $Workdir
    try { $envLines = Invoke-Native { & npx.cmd --offline --no --package supabase@2.115.0 -- supabase status -o env 2>$null } } finally { Pop-Location }
    $kv = @{}
    foreach ($l in $envLines) { if ($l -match '^([A-Z_]+)="?([^"]*)"?$') { $kv[$Matches[1]] = $Matches[2] } }
    if ($kv['API_URL'] -notmatch '^http://127\.0\.0\.1:(\d+)$') { throw "Refusing: the API URL is not local: '$($kv['API_URL'])'" }
    $apiPort = $Matches[1]
    if (-not $kv['SERVICE_ROLE_KEY']) { throw 'Refusing: no local service key.' }
    # The containers must belong to this project and this folder, and the API container must publish the API port.
    foreach ($name in $DbContainer, $ApiContainer) {
        $c = Get-Container $name
        if (-not $c.State.Running) { throw "Refusing: the local container $name is not running." }
        $project = $c.Config.Labels.'com.supabase.cli.project'
        $folder = $c.Config.Labels.'com.supabase.cli.workdir'
        if ($project -ne $ExpectedProjectId) { throw "Refusing: $name belongs to project '$project', not '$ExpectedProjectId'." }
        if (-not $folder -or (Get-NormalPath $folder) -ne (Get-NormalPath $Workdir)) { throw "Refusing: $name was started from '$folder', not '$Workdir'." }
        if ($name -eq $ApiContainer) {
            $published = @($c.HostConfig.PortBindings.'8000/tcp' | Where-Object { @('', '0.0.0.0', '127.0.0.1') -contains "$($_.HostIp)" } | ForEach-Object { "$($_.HostPort)" })
            if ($published -notcontains $apiPort) { throw "Refusing: $name does not publish the API port $apiPort on all interfaces or 127.0.0.1." }
        }
    }
    return @{ Api = $kv['API_URL']; Key = $kv['SERVICE_ROLE_KEY'] }
}

function Invoke-Admin($T, [string]$Method, [string]$Path, $Body) {
    $h = @{ apikey = $T.Key; Authorization = "Bearer $($T.Key)" }
    $req = @{ UseBasicParsing = $true; Method = $Method; Uri = "$($T.Api)$Path"; Headers = $h; ContentType = 'application/json' }
    if ($null -ne $Body) { $req.Body = ($Body | ConvertTo-Json -Compress -Depth 5) }
    return Invoke-RestMethod @req
}

# The demo sign-in users: every Auth user, page by page, whose email is one of the three demo emails.
function Get-DemoAuthUsers($T) {
    $found = @()
    for ($page = 1; ; $page++) {
        if ($page -gt 100000) { throw 'Refusing: the sign-in user list did not end.' }
        $batch = @((Invoke-Admin $T 'GET' "/auth/v1/admin/users?page=$page&per_page=$AuthPageSize" $null).users)
        $found += @($batch | Where-Object { $Emails -contains $_.email })
        if ($batch.Count -lt $AuthPageSize) { return $found }
    }
}

# Runs New-SolmindLocalDemoSetup.sql: Report mode prints one STATE line; Create mode writes the demo set.
function Invoke-DemoSql([bool]$ReportOnly, [string[]]$AuthIds) {
    $vars = @{ report_only = $(if ($ReportOnly) { 'true' } else { 'false' }); admin_email = $AdminEmail; guide_email = $GuideEmail
        explorer_email = $ExplorerEmail; admin_auth_id = $AuthIds[0]; guide_auth_id = $AuthIds[1]; explorer_auth_id = $AuthIds[2] }
    $vargs = @(); foreach ($k in $vars.Keys) { $vargs += @('-v', "$k=$($vars[$k])") }
    $sql = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'New-SolmindLocalDemoSetup.sql') -Raw
    $out = Invoke-Native { $sql | & docker exec -i $DbContainer psql -X -q -t -A -v ON_ERROR_STOP=1 -U postgres -d postgres @vargs 2>&1 }
    if ($LASTEXITCODE -ne 0) { throw "psql failed: $(($out | ForEach-Object { "$_" }) -join ' ')" }
    return @($out | Where-Object { $_ -isnot [System.Management.Automation.ErrorRecord] } | ForEach-Object { "$_" })
}

# The database's view: demo rows found, and whether they form the complete set bound to the given Auth ids.
function Get-DbState([string[]]$AuthIds) {
    $line = @(Invoke-DemoSql $true $AuthIds | Where-Object { $_ -like 'STATE|*' })
    if ($line.Count -ne 1) { throw 'Refusing: the database gave no demo state.' }
    $f = $line[0].Split('|')
    return @{ Rows = [int64]$f[1]; Complete = ($f[2] -eq 'true'); Detail = $f[3] }
}

function Get-DemoState($T) {
    $auth = @(Get-DemoAuthUsers $T)
    $ids = @(foreach ($e in $Emails) { $u = @($auth | Where-Object { $_.email -eq $e }); if ($u.Count -eq 1) { "$($u[0].id)" } else { '' } })
    $db = Get-DbState $ids
    if ($auth.Count -eq 0 -and $db.Rows -eq 0) { return 'ABSENT' }
    if ($auth.Count -eq 3 -and $db.Complete) { return 'COMPLETE' }
    return "PARTIAL (demo sign-in users $($auth.Count) of 3; demo matches found/expected: $($db.Detail))"
}

function New-PolicyPassword {
    $bytes = New-Object byte[] 18
    [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $core = [Convert]::ToBase64String($bytes).Replace('+', '-').Replace('/', '_').TrimEnd('=')
    return $core + 'aA1!'   # the suffix guarantees every required kind; base64url has no < or >
}

$target = Get-LocalTarget
$state = Get-DemoState $target
"Demo set state: $state"
if ($Mode -eq 'Report') { return }
if ($state -ne 'ABSENT') { throw "Refusing to create: the demo set is $state. Nothing was changed." }

$created = [ordered]@{}
$secrets = @{}
try {
    foreach ($r in @(@('admin', $AdminEmail), @('guide', $GuideEmail), @('explorer', $ExplorerEmail))) {
        # DEMO-WORKAROUND(prj01-login-explorer-password): the Explorer gets an interim password until the email-code
        # flow (login steps 2-6) exists; remove it then (Paul's night decision 4).
        $pw = New-PolicyPassword
        $secrets[$r[0]] = $pw
        $u = Invoke-Admin $target 'POST' '/auth/v1/admin/users' @{ email = $r[1]; password = $pw; email_confirm = $true; user_metadata = @{ demo_setup = $Tag; demo_attempt = $Attempt } }
        $created[$r[0]] = "$($u.id)"
    }
    $null = Invoke-DemoSql $false @($created.admin, $created.guide, $created.explorer)
} catch {
    $why = $_.Exception.Message
    $matched = $null
    try { $matched = (Get-DbState @('', '', '')).Rows } catch { }
    $held = { try { (@(Get-DemoAuthUsers $target) | ForEach-Object { "$($_.email) $($_.id)" }) -join '; ' } catch { 'unknown (the list failed)' } }
    if ($null -eq $matched) {
        throw "Create failed, and the database could not be checked, so no sign-in user was deleted. Demo sign-in users: $(& $held). Error: $why"
    }
    if ($matched -ne 0) {
        throw "Create failed. The database check found $matched demo match(es), so no sign-in user was deleted. Demo sign-in users: $(& $held). Error: $why"
    }
    try {
        foreach ($u in @(Get-DemoAuthUsers $target | Where-Object { "$($_.user_metadata.demo_attempt)" -eq $Attempt })) {
            try { $null = Invoke-Admin $target 'DELETE' "/auth/v1/admin/users/$($u.id)" $null } catch { }
        }
        $left = @(Get-DemoAuthUsers $target)
    } catch {
        throw "Create failed. No matching row was found at the cleanup check, but the demo sign-in users could not be listed, so whether any remain is unknown. Error: $why"
    }
    if ($left.Count) { throw "Create failed. No matching row was found at the cleanup check, but these demo sign-in users remain: $(($left | ForEach-Object { "$($_.email) $($_.id)" }) -join '; '). Error: $why" }
    throw "Create failed. No matching row was found at the cleanup check, and no demo sign-in user remains (this attempt's users were deleted and the list checked again). Error: $why"
}
"Demo set created. Sign-in details, shown once here; the script does not save them:"
foreach ($role in 'admin', 'guide', 'explorer') {
    $email = @{ admin = $AdminEmail; guide = $GuideEmail; explorer = $ExplorerEmail }[$role]
    "  ${role}: $email / $($secrets[$role])"
}
"Demo set state now: $(Get-DemoState $target)"

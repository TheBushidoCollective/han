# Run only on an ephemeral, elevated Windows CI runner after building han-coordinator.
# No credentials or capability values are written to the log or command line.
param([Parameter(Mandatory = $true)][string]$Coordinator)
$ErrorActionPreference = 'Stop'
if ($env:GITHUB_ACTIONS -ne 'true' -or $env:RUNNER_ENVIRONMENT -ne 'github-hosted') {
    throw 'This account-creating acceptance test requires a GitHub-hosted runner'
}
$Coordinator = (Resolve-Path -LiteralPath $Coordinator).Path
$name = 'han' + [Guid]::NewGuid().ToString('N').Substring(0, 12)
$root = Join-Path $env:SystemDrive ('han-security-' + [Guid]::NewGuid().ToString('N'))
$accountCreated = $false
$daemon = $null

function Invoke-Helper([string]$Data, [string]$Op, [hashtable]$Extra = @{}) {
    $request = @{ version = 1; dataDir = $Data; op = $Op }
    foreach ($key in $Extra.Keys) { $request[$key] = $Extra[$key] }
    $output = ($request | ConvertTo-Json -Compress -Depth 20) | & $Coordinator --local-runtime 2>$null
    if ($LASTEXITCODE -ne 0) { throw "Helper rejected $Op" }
    $response = $output | ConvertFrom-Json
    if (-not $response.ok -or $response.version -ne 1) { throw "Invalid helper response for $Op" }
    return $response.result
}
function Assert-Rejected([string]$Data, [string]$Op, [hashtable]$Extra = @{}) {
    $request = @{ version = 1; dataDir = $Data; op = $Op }
    foreach ($key in $Extra.Keys) { $request[$key] = $Extra[$key] }
    $null = ($request | ConvertTo-Json -Compress -Depth 20) | & $Coordinator --local-runtime 2>$null
    if ($LASTEXITCODE -eq 0) { throw "Unsafe path accepted by $Op" }
}
function Assert-Icacls([string[]]$Arguments) {
    $null = & icacls.exe @Arguments
    if ($LASTEXITCODE -ne 0) { throw 'Unable to set test ACL' }
}

try {
    $bytes = New-Object byte[] 32
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
    $password = ConvertTo-SecureString ('aA1!' + [Convert]::ToBase64String($bytes)) -AsPlainText -Force
    $null = New-LocalUser -Name $name -Password $password -AccountNeverExpires -PasswordNeverExpires
    $accountCreated = $true
    $user = Get-LocalUser -Name $name
    $sid = $user.SID.Value
    $credential = [PSCredential]::new("$env:COMPUTERNAME\$name", $password)

    $null = New-Item -ItemType Directory -Path $root
    # Only the separately scoped exchange directory is writable by the second identity.
    Assert-Icacls -Arguments @($root, '/inheritance:r', '/grant:r', "*S-1-5-18:(OI)(CI)F", "*S-1-5-32-544:(OI)(CI)F", "*$([System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value):(OI)(CI)F", '*S-1-1-0:(RX)')
    $exchange = Join-Path $root 'exchange'
    $null = New-Item -ItemType Directory -Path $exchange
    Assert-Icacls -Arguments @($exchange, '/inheritance:r', '/grant:r', "*S-1-5-18:(OI)(CI)F", "*S-1-5-32-544:(OI)(CI)F", "*$([System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value):(OI)(CI)F", "*${sid}:(OI)(CI)M")
    $exe = Join-Path $root 'han-coordinator.exe'
    Copy-Item -LiteralPath $Coordinator -Destination $exe
    Assert-Icacls -Arguments @($exe, '/grant:r', '*S-1-1-0:(RX)')
    $data = Join-Path $root 'data'
    $claim = (Invoke-Helper $data 'supervisor.acquire').claim
    $generation = [Guid]::NewGuid().ToString()
    $daemon = Start-Process -FilePath $Coordinator -PassThru -ArgumentList @('--foreground', '--port', '0', '--grpc-port', '0', '--no-watcher', '--data-dir', ('"' + $data + '"'), '--supervisor-pid', "$PID", '--supervisor-nonce', $claim.nonce, '--supervisor-generation', $generation) -WindowStyle Hidden
    $descriptor = $null
    for ($i = 0; $i -lt 200; $i++) {
        if ($daemon.HasExited) { throw 'Coordinator exited before publishing' }
        $read = Invoke-Helper $data 'descriptor.read' @{ target = @{ kind = 'active' } }
        if ($null -ne $read) { $descriptor = $read.descriptor; break }
        Start-Sleep -Milliseconds 100
    }
    if ($null -eq $descriptor -or $descriptor.pid -ne $daemon.Id -or -not $descriptor.bearerToken) { throw 'Owner could not read a published capability' }
    $before = Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $data 'runtime\coordinator.json')
    $ownerBefore = Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $data 'runtime\supervisor.owner.json')

    $attacker = Join-Path $root 'attacker.ps1'
    @'
param($Exe, $Data, $Result)
$ErrorActionPreference = 'Stop'
$runtime = Join-Path $Data 'runtime'
$results = @{ sid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value }
foreach ($item in @('coordinator.json', 'supervisor.owner.json')) {
    $path = Join-Path $runtime $item
    try { $null = [System.IO.File]::ReadAllBytes($path); $results["read-$item"] = $true } catch { $results["read-$item"] = $false }
    try { [System.IO.File]::WriteAllText($path, 'attacker'); $results["replace-$item"] = $true } catch { $results["replace-$item"] = $false }
    try { [System.IO.File]::Delete($path); $results["delete-$item"] = $true } catch { $results["delete-$item"] = $false }
}
try { [System.IO.File]::WriteAllText((Join-Path $runtime 'attacker.json'), 'attacker'); $results.publish = $true } catch { $results.publish = $false }
foreach ($op in @('descriptor.read', 'supervisor.acquire')) {
    $req = @{ version = 1; dataDir = $Data; op = $op }
    if ($op -eq 'descriptor.read') { $req.target = @{ kind = 'active' } }
    $null = ($req | ConvertTo-Json -Compress) | & $Exe --local-runtime 2>$null
    $results[$op] = ($LASTEXITCODE -eq 0)
}
$results | ConvertTo-Json -Compress | Set-Content -LiteralPath $Result -Encoding UTF8
'@ | Set-Content -LiteralPath $attacker -Encoding UTF8
    Assert-Icacls -Arguments @($attacker, '/grant:r', '*S-1-1-0:(RX)')
    $resultFile = Join-Path $exchange 'result.json'
    $ps = (Get-Process -Id $PID).Path
    $child = Start-Process -FilePath $ps -Credential $credential -PassThru -Wait -WindowStyle Hidden -ArgumentList @('-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', ('"' + $attacker + '"'), '-Exe', ('"' + $exe + '"'), '-Data', ('"' + $data + '"'), '-Result', ('"' + $resultFile + '"'))
    if ($child.ExitCode -ne 0 -or -not (Test-Path -LiteralPath $resultFile)) { throw 'Second-user probe did not complete' }
    $result = Get-Content -Raw -LiteralPath $resultFile | ConvertFrom-Json
    if ($result.sid -ne $sid -or $result.sid -eq [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value) { throw 'Probe did not run as the distinct user' }
    foreach ($key in @('read-coordinator.json','replace-coordinator.json','delete-coordinator.json','read-supervisor.owner.json','replace-supervisor.owner.json','delete-supervisor.owner.json','publish','descriptor.read','supervisor.acquire')) {
        if ($result.$key -ne $false) { throw "Distinct-user operation was not denied: $key" }
    }
    if ((Get-FileHash -Algorithm SHA256 -LiteralPath $before.Path).Hash -ne $before.Hash -or (Get-FileHash -Algorithm SHA256 -LiteralPath $ownerBefore.Path).Hash -ne $ownerBefore.Hash) { throw 'Distinct user changed a protected record' }
    if ((Invoke-Helper $data 'supervisor.check' @{claim = $claim}).status -ne 'owned') { throw 'Owner claim changed' }

    # A writable runtime or record, or an NTFS reparse point, must fail closed.
    $unsafe = Join-Path $root 'unsafe'
    $null = Invoke-Helper $unsafe 'supervisor.acquire'
    $unsafeRuntime = Join-Path $unsafe 'runtime'
    Assert-Icacls -Arguments @($unsafeRuntime, '/grant', "*${sid}:(OI)(CI)M")
    Assert-Rejected $unsafe 'supervisor.read'
    $recordData = Join-Path $root 'unsafe-record'
    $null = Invoke-Helper $recordData 'supervisor.acquire'
    Assert-Icacls -Arguments @((Join-Path $recordData 'runtime\supervisor.owner.json'), '/grant', "*${sid}:M")
    Assert-Rejected $recordData 'supervisor.read'
    $malformedData = Join-Path $root 'malformed-record'
    $null = Invoke-Helper $malformedData 'supervisor.acquire'
    [System.IO.File]::WriteAllText((Join-Path $malformedData 'runtime\supervisor.owner.json'), '{')
    Assert-Rejected $malformedData 'supervisor.read'
    $linkData = Join-Path $root 'link-record'
    $null = Invoke-Helper $linkData 'supervisor.acquire'
    $link = Join-Path $linkData 'runtime\supervisor.owner.json'
    $linkTarget = Join-Path $root 'link-target.json'
    [System.IO.File]::WriteAllText($linkTarget, '{}')
    Remove-Item -LiteralPath $link
    $null = New-Item -ItemType SymbolicLink -Path $link -Target $linkTarget
    Assert-Rejected $linkData 'supervisor.read'
    $junctionData = Join-Path $root 'junction'
    $null = New-Item -ItemType Directory -Path $junctionData
    $target = Join-Path $root 'target'
    $null = New-Item -ItemType Directory -Path $target
    $null = New-Item -ItemType Junction -Path (Join-Path $junctionData 'runtime') -Target $target
    Assert-Rejected $junctionData 'supervisor.acquire'
    $null = 'not-json' | & $Coordinator --local-runtime 2>$null
    if ($LASTEXITCODE -eq 0) { throw 'Malformed request was accepted' }
    Write-Host 'Windows distinct-user transport security acceptance passed'
} finally {
    if ($null -ne $daemon -and -not $daemon.HasExited) { Stop-Process -Id $daemon.Id -Force -ErrorAction SilentlyContinue; $daemon.WaitForExit() }
    if ($accountCreated) { Remove-LocalUser -Name $name -ErrorAction Stop }
    if (Test-Path -LiteralPath $root) { Remove-Item -LiteralPath $root -Recurse -Force -ErrorAction Stop }
}

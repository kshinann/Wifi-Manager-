<#
.SYNOPSIS
  Installs the AI Guard agent on Windows as a SYSTEM startup task and enrolls the PC.

.EXAMPLE
  # Run in an elevated PowerShell (or deploy via Intune/GPO/SCCM):
  .\install.ps1 -Server https://aiguard.example.com -Token enr_xxx `
      -ExtensionId abcdefghijklmnopabcdefghijklmnop `
      -ExtensionUpdateUrl https://clients2.google.com/service/update2/crx
#>
param(
    [Parameter(Mandatory = $true)][string]$Server,
    [Parameter(Mandatory = $true)][string]$Token,
    [string]$Binary = "$PSScriptRoot\aiguard-agent.exe",
    [string]$ExtensionId = "",
    [string]$ExtensionUpdateUrl = "https://clients2.google.com/service/update2/crx"
)

$ErrorActionPreference = "Stop"
$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw "Run this script as Administrator."
}

$installDir = "$env:ProgramFiles\AIGuard"
$exe = Join-Path $installDir "aiguard-agent.exe"
$taskName = "AIGuardAgent"

New-Item -ItemType Directory -Force -Path $installDir | Out-Null
if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
    Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
}
Copy-Item -Force $Binary $exe

# Only SYSTEM and Administrators may read the device token.
$dataDir = "$env:ProgramData\AIGuard"
New-Item -ItemType Directory -Force -Path $dataDir | Out-Null
icacls $dataDir /inheritance:r /grant:r "SYSTEM:(OI)(CI)F" "Administrators:(OI)(CI)F" | Out-Null

$enrollArgs = @("enroll", "--server", $Server, "--token", $Token, "--force")
if ($ExtensionId) { $enrollArgs += @("--extension-id", $ExtensionId) }
& $exe @enrollArgs
if ($LASTEXITCODE -ne 0) { throw "Enrollment failed" }

$action = New-ScheduledTaskAction -Execute $exe -Argument "run"
$trigger = New-ScheduledTaskTrigger -AtStartup
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
    -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero)
$taskPrincipal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings `
    -Principal $taskPrincipal -Force | Out-Null
Start-ScheduledTask -TaskName $taskName

# Force-install the browser extension in Chrome and Edge so users cannot remove it.
if ($ExtensionId) {
    foreach ($key in @("HKLM:\SOFTWARE\Policies\Google\Chrome\ExtensionInstallForcelist",
                       "HKLM:\SOFTWARE\Policies\Microsoft\Edge\ExtensionInstallForcelist")) {
        New-Item -Force -Path $key | Out-Null
        $existing = (Get-Item $key).Property | ForEach-Object { (Get-ItemProperty $key).$_ }
        $entry = "$ExtensionId;$ExtensionUpdateUrl"
        if ($existing -notcontains $entry) {
            $next = 1 + (@((Get-Item $key).Property | ForEach-Object { [int]$_ }) + 0 | Measure-Object -Maximum).Maximum
            New-ItemProperty -Path $key -Name "$next" -Value $entry -PropertyType String -Force | Out-Null
        }
    }
}

Write-Host "AI Guard agent installed and running."

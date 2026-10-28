$ErrorActionPreference = "Continue"
$taskName = "AIGuardAgent"
Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
Get-Process aiguard-agent -ErrorAction SilentlyContinue | Stop-Process -Force

# Remove the managed block from the hosts file.
$hosts = "$env:SystemRoot\System32\drivers\etc\hosts"
$lines = Get-Content $hosts
$out = @(); $inside = $false
foreach ($line in $lines) {
    if ($line -like "# BEGIN AIGUARD*") { $inside = $true; continue }
    if ($line -like "# END AIGUARD*") { $inside = $false; continue }
    if (-not $inside) { $out += $line }
}
Set-Content -Path $hosts -Value $out
ipconfig /flushdns | Out-Null

Remove-Item -Recurse -Force "$env:ProgramFiles\AIGuard" -ErrorAction SilentlyContinue
Write-Host "AI Guard agent removed. Data in $env:ProgramData\AIGuard was kept; delete it manually if needed."

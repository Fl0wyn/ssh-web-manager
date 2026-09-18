# Compile le lanceur SSH Web Manager en .exe (utilise csc.exe du .NET Framework, deja present sur Windows)
$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptDir
$csc = "$env:WINDIR\Microsoft.NET\Framework64\v4.0.30319\csc.exe"

if (-not (Test-Path $csc)) {
    $csc = "$env:WINDIR\Microsoft.NET\Framework\v4.0.30319\csc.exe"
}

if (-not (Test-Path $csc)) {
    Write-Error "csc.exe introuvable. .NET Framework 4 est requis pour compiler le lanceur."
    exit 1
}

$source = Join-Path $scriptDir "Launcher.cs"
$output = Join-Path $projectRoot "SSH-Web-Manager.exe"

& $csc /nologo /target:winexe /out:$output $source

if ($LASTEXITCODE -eq 0) {
    Write-Host "OK : $output" -ForegroundColor Green
} else {
    Write-Error "Echec de la compilation du lanceur."
    exit 1
}

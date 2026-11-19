# DevStudio 7/24 & Tatil Modu Başlatıcı (Windows PowerShell)
# Windows'un uykuya geçmesini engeller ve olası ağ kesintilerinde Runner'ı otomatik yeniden başlatır.
# Kullanım: .\start-runner-windows.ps1 -Token "dev_sec_xxxx"

param(
    [Parameter(Mandatory = $true)]
    [string]$Token,
    [string]$ServerUrl = "https://devstudio-51645421078.europe-west1.run.app"
)

$RunnerFile = Join-Path $PSScriptRoot "devstudio-runner.mjs"

if (-not (Test-Path $RunnerFile)) {
    Write-Host "devstudio-runner.mjs indiriliyor..." -ForegroundColor Cyan
    Invoke-RestMethod -Uri "$ServerUrl/api/runner/download" -OutFile $RunnerFile
}

# Windows uyku engelleyici (SetThreadExecutionState)
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class SleepPreventer {
    [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    public static extern uint SetThreadExecutionState(uint esFlags);
    public const uint ES_CONTINUOUS = 0x80000000;
    public const uint ES_SYSTEM_REQUIRED = 0x00000001;
}
"@

[SleepPreventer]::SetThreadExecutionState([SleepPreventer]::ES_CONTINUOUS -bor [SleepPreventer]::ES_SYSTEM_REQUIRED) | Out-Null
Write-Host "Windows Uyku Korumasi ve Otomatik Yeniden Baslatma aktif!" -ForegroundColor Green

try {
    while ($true) {
        & node $RunnerFile "--token=$Token" "--server=$ServerUrl"
        if ($LASTEXITCODE -eq 0) {
            Write-Host "Runner normal sekilde kapatildi." -ForegroundColor Yellow
            break
        }
        Write-Host "Runner durdu (kod: $LASTEXITCODE). 3 saniye icinde yeniden baslatiliyor..." -ForegroundColor Yellow
        Start-Sleep -Seconds 3
    }
}
finally {
    [SleepPreventer]::SetThreadExecutionState([SleepPreventer]::ES_CONTINUOUS) | Out-Null
}


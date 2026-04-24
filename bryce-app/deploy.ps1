# Load variables from .env and deploy Supabase Edge Functions
# Usage: powershell -ExecutionPolicy Bypass -File deploy.ps1

$envFile = Join-Path $PSScriptRoot ".env"

if (-Not (Test-Path $envFile)) {
    Write-Error ".env file not found at $envFile"
    exit 1
}

Get-Content $envFile | ForEach-Object {
    if ($_ -match '^([^#\s][^=]*)=(.*)$') {
        [System.Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), "Process")
    }
}

Write-Host "Deploying generate-questions..." -ForegroundColor Cyan
npx supabase functions deploy generate-questions --project-ref vwyhxnaunkbrxuzjxpzt

if ($LASTEXITCODE -eq 0) {
    Write-Host "Deploy successful!" -ForegroundColor Green
} else {
    Write-Host "Deploy failed (exit code $LASTEXITCODE)" -ForegroundColor Red
    exit $LASTEXITCODE
}

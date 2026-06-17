# start.ps1 — porneste tot proiectul Fluier Final dintr-o singura comanda.
#
# Rulare (din folderul proiectului):
#     .\start.ps1
# Daca PowerShell blocheaza scriptul:
#     powershell -ExecutionPolicy Bypass -File .\start.ps1
#
# Porneste: PostgreSQL (Docker) -> backend (FastAPI :8001) -> frontend (Vite :5173)
# Backend-ul si frontend-ul pornesc in ferestre separate (le inchizi cu Ctrl+C).

$root = $PSScriptRoot
if (-not $root) { $root = (Get-Location).Path }

Write-Host "== Fluier Final - pornire ==" -ForegroundColor Green

# ── 1) Baza de date (Docker) ──────────────────────────────────────────────
Write-Host "`n[1/3] Pornesc PostgreSQL (Docker)..." -ForegroundColor Cyan
docker compose -f "$root\docker-compose.yml" up -d

Write-Host "      Astept ca baza sa fie gata..."
$ready = $false
for ($i = 0; $i -lt 40; $i++) {
    $h = (docker inspect -f '{{.State.Health.Status}}' rezervari_postgres 2>$null)
    if ($h -eq 'healthy') { $ready = $true; break }
    Start-Sleep -Seconds 1
}
if ($ready) { Write-Host "      PostgreSQL: gata." -ForegroundColor Green }
else { Write-Host "      Atentie: baza nu pare 'healthy' inca; backend-ul ar putea da eroare la pornire." -ForegroundColor Yellow }

# ── 2) Backend (FastAPI pe 8001) ──────────────────────────────────────────
Write-Host "`n[2/3] Pornesc backend-ul (port 8001)..." -ForegroundColor Cyan
if (-not (Test-Path "$root\backend\venv\Scripts\python.exe")) {
    Write-Host "      ! venv lipseste in backend\. Ruleaza intai setup-ul (creeaza venv + pip install -r requirements.txt)." -ForegroundColor Yellow
} else {
    Start-Process powershell -ArgumentList "-NoExit", "-Command",
        "cd '$root\backend'; .\venv\Scripts\python -m uvicorn app.main:app --port 8001"
}

# ── 3) Frontend (Vite pe 5173) ────────────────────────────────────────────
Write-Host "`n[3/3] Pornesc frontend-ul (port 5173)..." -ForegroundColor Cyan
if (-not (Test-Path "$root\frontend\node_modules")) {
    Write-Host "      node_modules lipseste - rulez 'npm install' (o singura data)..." -ForegroundColor Yellow
    Push-Location "$root\frontend"; npm install; Pop-Location
}
Start-Process powershell -ArgumentList "-NoExit", "-Command",
    "cd '$root\frontend'; npm run dev"

# ── Deschide browserul ────────────────────────────────────────────────────
Start-Sleep -Seconds 4
Start-Process "http://localhost:5173"

Write-Host "`nGata!" -ForegroundColor Green
Write-Host "  Frontend : http://localhost:5173"
Write-Host "  API docs : http://localhost:8001/docs"
Write-Host "  Conturi demo: super@exemplu.ro / admin@exemplu.ro / test@exemplu.ro (parola: Demo1234!)"
Write-Host "`n(Backend si frontend ruleaza in ferestre separate. Inchide-le cu Ctrl+C in fiecare fereastra.)"

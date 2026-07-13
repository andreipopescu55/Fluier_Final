# Fluier Final — Context & Handoff (sesiunea 2)

Document de transfer pentru o conversație nouă. Conține: ce este proiectul, unde e fiecare lucru, ce s-a făcut în această sesiune (lucrare + diagrame + PowerPoint + modificări de cod), regulile de stil, și **direcțiile viitoare**.

---

## 1. Ce este proiectul

**Fluier Final** — aplicație web (lucrare de licență) pentru rezervarea terenurilor de fotbal. Trei roluri: **client**, **administrator de bază** (`venue_admin`), **super-administrator** (`super_admin`). Interfață integral în limba română, temă **dark + accent lime (#c8fa3c)**.

**Stack:** Backend Python/FastAPI + SQLAlchemy 2.0 + Alembic + Pydantic v2, PostgreSQL (Docker, extensii `unaccent`, `EXCLUDE/GiST`), JWT + bcrypt, Stripe **mock**. Frontend React 19 + Vite + Tailwind v4 + FullCalendar + Axios. Backend pe **8001**, frontend pe **5173**, Postgres în Docker pe host **5433** (+ Redis provizionat, neutilizat).

**Contribuții „wow" (de păstrat în față):** integritate la concurență prin `EXCLUDE` (anti dublă-rezervare, fără TOCTOU), confirmare prin avans (50% mock), Find Party cu `SELECT … FOR UPDATE`, model de roluri „secure by default" + rating condiționat de joc.

---

## 2. Unde e fiecare lucru

- **Cod aplicație:** `D:\Proiect_Licenta\backend\` și `D:\Proiect_Licenta\frontend\`.
- **Lucrarea (text):** Google Doc al autorului → https://docs.google.com/document/d/1P4cZcbiBTAgx4btc-5HpEbpg7MVRTgcjoO518_BgQdk/ (accesibil via export public; ~18–20k cuvinte). **Claude NU poate scrie în Google Docs → livrează textul ca markdown de copiat.**
- **Diagrame (SVG):** `D:\Proiect_Licenta\docs\diagrame\` — vezi secțiunea 4.
- **Imagini cod & tabele roluri (SVG+PNG):** `docs\diagrame\code\` și `docs\diagrame\roluri\`.
- **PowerPoint:** `D:\Proiect_Licenta\Prezentare_FluierFinal.pptx` (generator: `scratchpad/ppt/build.js`, pptxgenjs).
- **Zip cod sursă:** `D:\Proiect_Licenta\FluierFinal_cod_sursa.zip` (fără node_modules/venv/.env).
- ⚠️ **`D:\Proiect_Licenta\ERD\*.png` este VECHI/greșit** — nu corespunde bazei reale. Folosește ERD-urile noi din `docs\diagrame\erd_*.svg`.

---

## 3. Starea documentației (lucrarea)

Capitole scrise (în această sesiune, în română umanizată):
- **Cap. 1–2** — scrise anterior (Introducere, Soluții existente).
- **Cap. 3** — Tehnologii. Citările `[1]–[12]` inserate în text. ⚠️ **De verificat/adăugat: `[13]` Stripe (la 3.5) și `[15]` bcrypt (la 3.4)** — păreau necitate.
- **Cap. 4** — Analiză (actori, cerințe funcționale, non-funcționale, use-case 4.4, scenarii 4.5).
- **Cap. 5** — Arhitectură (three-tier, ERD 5.2.a–f, API `/api/v1`, flux auth 5.5).
- **Cap. 6** — Implementare (6.1–6.12).
- **Cap. 7** — Testare (teste reale: `test_double_booking.py`, `test_expired_booking.py`).
- **Cap. 8** — Deployment (Docker, `.env`, `start.ps1`, producție).
- **Cap. 9** — Concluzii + **Bibliografie `[1]–[24]`**.

**Lipsuri confirmate în Google Doc (de făcut):**
- **Paginile preliminare** — lipsesc: copertă/pagină de titlu, **declarație de originalitate**, **rezumat (RO) + abstract (EN)**, listă de figuri, listă de tabele, listă de abrevieri.
- **Figura 5.1 (diagrama de arhitectură)** — referită în 5.2 dar **nu a fost creată**.
- **Declarație privind utilizarea AI** — de adăugat (autorul a cerut).

**Referințe suplimentare propuse (opțional, doar dacă se citează în text):** OWASP, RFC 6749 (OAuth2), Codd 1970, Bernstein (concurrency control), Fowler, Nielsen, WCAG.

---

## 4. Diagrame / imagini generate (`docs\diagrame\`)

Toate în stil printabil (fond alb) sau, pentru cod/roluri, dark+lime. **SVG-urile trebuie convertite în PNG pentru Google Docs** (Docs nu inserează SVG). `code_*` și `rol_*` au deja PNG (generate cu `sharp` în `scratchpad/ppt`).

- **Use-case (fond alb):** `fig_4_1_usecase_client.svg`, `fig_4_2_usecase_admin.svg`, `fig_4_3_usecase_superadmin.svg` (o coloană, simple). ⚠️ În text trebuie etichetate **„Figura 4.1/4.2/4.3"**, nu „Tabelul".
- **Activitate / scenarii:** `fig_4_4_scenariu_rezervare.svg`, `fig_4_5_scenariu_anulare.svg`, `fig_4_6_scenariu_findparty.svg`, `fig_4_7_scenariu_autentificare.svg`.
- **ERD (schema REALĂ, stil dbdiagram):** `erd_1_utilizatori.svg` … `erd_6_abonamente.svg` = **Figura 5.2.a–f**.
- **Secvență auth:** `fig_5_3_secventa_auth.svg`.
- **Flux de utilizare client:** `flux_utilizare_client.svg` (potrivit la 4.5).
- **Screenshot-uri cod real (dark):** `code\code_1_create_booking`, `code_2_approve`, `code_3_price` (SVG+PNG).
- **Tabele funcționalități pe rol (dark+lime):** `roluri\rol_client`, `rol_admin`, `rol_superadmin` (SVG+PNG).

**Model de date = 15 entități** (16 tabele − `alembic_version` tehnic).

---

## 5. PowerPoint (`Prezentare_FluierFinal.pptx`)

- **14 slide-uri**, temă dark + lime, cu note de prezentator. Generator: `scratchpad/ppt/build.js` (rulează `node build.js`, apoi `python scripts/rezip.py`).
- Slide 6 = **15 entități**. Slide-urile **8–10 au cod real Python** (nu pseudocod).
- Autorul a mai adăugat un **slide cu tabelele de roluri** — ⚠️ eticheta de sus scrie „FLUXUL DE LUCRU UZUAL", ar trebui **„ROLURI ȘI FUNCȚIONALITĂȚI"**.
- **De completat (slide 1):** nume coordonator + universitate/facultate.
- ⚠️ **Nu există PowerPoint/LibreOffice pe mașină** → nu s-a putut face render vizual al pptx (QA doar pe conținut). `sharp` e disponibil pentru SVG→PNG.
- Discurs complet slide-cu-slide + variante scurte au fost livrate în chat (nu într-un fișier).

---

## 6. Modificări de cod făcute în ACEASTĂ sesiune

Toate pe frontend (backend neatins), aplicabile prin HMR:
1. **`BookingPage.jsx`** — validare de suprapunere la alegerea **duratei** (opțiunile care s-ar ciocni cu o rezervare sunt dezactivate) + plasă de siguranță la „Rezervă".
2. **`MatchDetailPage.jsx`** — buton **„Scoate"** jucător din echipă (organizator) + **fereastră de confirmare** (`removeTarget`, `confirmRemove`; `run` întoarce bool).
3. **Restricție rol `venue_admin`** (doar el, super-admin neatins): `Navbar.jsx` (ascunde „Meciuri"), `BookingPage.jsx` (blochează rezervarea), `MatchDetailPage.jsx` (blochează alăturarea). Adminul = strict gestiune.
4. **`MyBookingsPage.jsx`** — cardul arată **numele bazei** în loc de format (fetch `listVenues` → map după id).
5. **`lib/labels.js`** — „Fotbal 11+1" → **„Fotbal 10+1"** (etichetă; valoarea `football_11` neschimbată).

**Discutat, NEimplementat:** schimbarea parolei (self-service) — recomandare dată: endpoint `POST /auth/change-password` cu verificarea parolei curente + bcrypt.

---

## 7. Rulare / DB / conturi demo

- Pornire: `docker compose up -d` (DB) → backend `.\venv\Scripts\python -m uvicorn app.main:app --port 8001` → frontend `npm run dev`. Sau `.\start.ps1`. Containerele Docker se opresc între sesiuni → repornește.
- Consolă DB: `docker exec -it rezervari_postgres psql -U rezervari_user -d rezervari_db`.
- **Conturi demo (parola `Demo1234!`):** `super@exemplu.ro`, `admin@exemplu.ro`, `test@exemplu.ro`, `ana.client@aurora.ro`, `mihai.demo@exemplu.ro`, `ioana.demo@exemplu.ro`. Plus `andrei@test.com` = **Andrei** (client, organizatorul party-urilor deschise; parola setată de autor).
- **Onest de reținut:** tabelele `notifications` și `audit_log` sunt **goale** (modelate, dar neutilizate în cod). Un meci **dispare** din „Meciuri deschise" după ora de start (`start_time > now`) și nu mai acceptă cereri; **nu se șterge** după terminare (necesar pentru rating-ul condiționat de joc).

---

## 8. Reguli de stil & onestitate (IMPORTANT pentru continuare)

- Scris în **română, umanizat/natural** (proză, nu liste-spam, fără clișee AI).
- **Nu menționa commit-uri/GitHub** în răspunsuri.
- **NU** prezenta „tarifele/rezervările peste miezul nopții" ca punct forte/contribuție (există în cod, dar rămân detaliu de implementare — 6.7).
- Onestitate obligatorie: **plăți mock** (fără Stripe real), **expirarea pending există dar nu e programată automat**, **notificări + audit_log goale**, **fără deploy producție**, **fără PowerPoint pe mașină**.
- Claude nu scrie în Google Docs → livrează markdown de copiat.

---

## 9. DIRECȚII VIITOARE

### 9.1 Proiect (aplicația)
- **Integrare reală cu Stripe** (sesiune Checkout + webhook) în locul plății mock.
- **Programarea automată a expirării** rezervărilor `pending` (cron / APScheduler) — funcția `expire_stale_pending_bookings` există și e testată, dar nu rulează singură.
- **Notificări prin email** (confirmări, memento-uri, anulări) — peste tabela `notifications` (momentan goală).
- **Jurnal de audit activ** — popularea `audit_log` la acțiunile importante.
- **Marcare automată „completed"** a rezervărilor/meciurilor trecute (scheduler).
- **Cronologie de disponibilitate** a bazelor (timeline vizual).
- **Schimbare parolă** (self-service) + eventual **rate limiting** la login + politică de parolă.
- **Aplicație mobilă**.
- **Deploy în producție**: domeniu + HTTPS (reverse proxy Nginx/Caddy), `DEBUG=False`, secrete dintr-un secrets manager, CORS restrâns.
- **README** pentru rulare/colaboratori.

### 9.2 Lucrare & livrabile (ce a mai rămas de făcut)
- [ ] **Pagini preliminare**: copertă, **declarație de originalitate**, **rezumat (RO) + abstract (EN)**, liste de figuri/tabele/abrevieri.
- [ ] **Figura 5.1** (diagrama de arhitectură) — de creat (browser → API FastAPI → PostgreSQL + Redis + Stripe).
- [ ] **Citări `[13]` Stripe (3.5) + `[15]` bcrypt (3.4)** — de verificat/adăugat în text.
- [ ] **Conversia SVG → PNG** a diagramelor rămase (use-case, activitate, ERD, secvență) pentru Google Docs (`code_*` și `rol_*` au deja PNG). Se poate cu `sharp` din `scratchpad/ppt`.
- [ ] **Declarație privind utilizarea AI**.
- [ ] **PowerPoint**: completează coordonator + universitate (slide 1); corectează eticheta slide-ului cu roluri.
- [ ] Opțional: **capturi de ecran** ale aplicației ca figuri în Cap. 6 (recomandat pentru o lucrare practică). S-a decis că se poate merge **fără anexe** formale.
- [ ] Verificare finală de consecvență text ↔ figuri ↔ cod (nume `fields`/`matches`/`ratings`, `uuid`, etc.).

---

## 10. Note tehnice utile pentru continuare
- SVG→PNG: `cd scratchpad/ppt && node convert.js` (are `sharp` instalat; densitate 220–240 pentru crispness).
- Regenerare ERD: `scratchpad/gen_erd.py`. Use-case: `scratchpad/ppt/gen_usecase.py`. Cod: `gen_code_shots.py`. Roluri: `gen_role_tables.py`.
- Schema reală se obține din `pg_dump --schema-only` sau `information_schema.columns`; enum-urile din `pg_enum`.

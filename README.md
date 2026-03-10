# Grottechug 🌀🍺

Et lite, men seriøst useriøst system for å styre **Grottechug** på Geogrotta:

- chug-hjul (ekte random)
- chuggeliste (historikk per dato/semester)
- person-sider med grafer og statistikk
- topplister (beste “clean” tider)
- regler og kryss

Dette repoet inneholder både **frontend (React/Vite)** og **backend (Node/Express/Prisma/SQLite)**.

---

## Innhold

- [Hva er dette?](#hva-er-dette)
- [Funksjoner](#funksjoner)
- [Regler (utdrag)](#regler-utdrag)
- [Tech stack](#tech-stack)
- [Prosjektstruktur](#prosjektstruktur)
- [Kom i gang](#kom-i-gang)
- [Deployment](#deployment)
- [Import av historikk (Excel)](#import-av-historikk-excel)
- [Bruk](#bruk)
- [API-oversikt](#api-oversikt)
- [Vanlige problemer](#vanlige-problemer)
- [Bidra](#bidra)

---

## Hva er dette?

**Grottechug** er et internt webverktøy for lesesalen/Geogrotta som gjør det enkelt å:

- registrere chuggetider per fredag
- vise historikk på tvers av semester (2025H / 2026V / total)
- velge rekkefølge med et hjul (helst på Tobias A. sin PC)
- holde orden på regler, fravær og kryss

---

## Funksjoner

### 🌀 Hjulet

- **Faste deltakere** vises i lista (default huket av).
- **Gjester legges til via søkefelt** (autocomplete fra DB).
  - Hvis navnet finnes → legges til i dagens liste.
  - Hvis navnet ikke finnes → opprettes automatisk som ny gjest i databasen.
- **Ekte random** via kvante-random (ANU QRNG) med kryptografisk fallback.
- Når vinner trekkes, **fjernes vinner fra neste runde** automatisk.
- Du kan krysse ut noen med:
  - **Fravær (gir kryss)** (logger i krysslista)
  - **Ekskluder i dag (ingen kryss)**

### 📊 Chuggelista

- Tabell med **historikk per dato**.
- **Tabs**: `2025 Høst` / `2026 Vår` / `Total historikk`.
- Klikk på:
  - **Beste** eller **Snitt** for sortering
  - **dato-kolonner** for sortering per dag
  - **navn** for egen person-side
- Prikk i cellen = **anmerkning** (hover viser tooltip).

### 👤 Person-side

- Graf over alle tider per dato (med trendlinje)
- Statistikk som best, snitt, stabilitet osv.

### 🏆 Toppliste

- Podium (Top 3)
- Rangerer på **beste “clean” tid** (beste tid uten anmerkning).

### 📜 Regler og kryss

- Regler ligger i databasen og kan oppdateres.
- Krysslista viser oversikt og totaler.

---

### Tid og sted

- Grottechug skjer på **Geogrotta fredager kl. 15:15**, med mindre annet avtales.
- **⅔ flertall** kreves for å flytte chug fra fredag.
- Flytting av tidspunkt på fredag er tillatt.
- Rekkefølgen avgjøres av hjulet (helst Tobias A. sin PC).
- Ved spesielt ønske/behov kan modifikasjon av rekkefølge tillates.

### Enhet

- Anbefalt enhet: **øl**.
- **Cider/seltzer** er tillatt som alternativ.
- Alkoholfri: **kun alkoholfri øl** er tillatt.
- Unntak: **Peder** er fritatt fra regelen om enhet (men oppfordres til kullsyreholdig enhet).

### Fravær / video / remote

- Ved fravær kan man sende inn video der bord er synlig for tidtaking.
  - Må skje **samme dag** som grottechug
  - Kun **ett (1)** forsøk
  - Video deles i grottas snapgruppe
- Remotechug er tillatt, men deltaker må fikse Zoom/Teams-link og varsle på forhånd.
  - Samme regler som video
- Alkoholfri: kun alkoholfri øl (Peder-unntaket gjelder)

### Forsøk

- På Grotta kan man gjøre så mange forsøk man vil. **Beste forsøk gjelder.**

### Gjester

- Gjester er lov og velkomne, så lenge de følger reglene.

### Tilleggsregler

- Alle deltakere må bruke **samme type glass** (f.eks. like plastglass 0,5L).
- Det føres kryss. Kryss kan brukes til kryssfest/vors/sponsing (avgjøres senere).
- “Priviligerte innvandrere” (petroleum/maskin/data/indøk):
  - Udokumentert fravær gir **tidsstraff 10 sek** per fravær etter bank på døren (kumulativt)
  - Trer i kraft etter **26.09.2025**

### Kryssoversikt

| Regel                  | Kryss |
| ---------------------- | ----: |
| DNS-chug               |     3 |
| Tobias-chug / DNF-chug |     2 |
| mm-chug                |   0.5 |
| w-chug                 |     1 |
| vw-chug                |     2 |
| p-chug                 |     1 |
| Fravær                 |     2 |
| Oppkast                |     4 |
| KPR                    |     1 |

Forklaringer:

- **DNS-chug**: være på Geogrotta uten å delta
- **Tobias-chug/DNF-chug**: ikke fullføre innen 25 sek  
  _Tobias-chug gjelder 25/26. Hvis Tobias A. fullfører under 10 sek, går regelen tilbake til DNF-chug._
- **mm-chug**: “mildly moist” – gult kort; 2 mm på rad → kryss
- **w-chug**: søle øl under chugging
- **vw-chug**: søle mye eller ha litt igjen i glasset
- **p-chug**: pause under chugging
- **Fravær**: ikke til stede på Geogrotta under chugging
- **Oppkast**: ikke fullføre etter å ha kasta opp
  - ved oppkast stoppes klokka til chugging gjenopptas
- **KPR**: klage på regler under chug

---

## Tech stack

- **Frontend**: React + Vite + TypeScript + CSS
- **Backend**: Node + Express + TypeScript
- **DB**: SQLite lokalt, Turso/libSQL i produksjon (via Prisma)
- **Charts**: Recharts (person-side, stats, topplister)
- **Randomness**: ANU QRNG (kvante-random) + crypto fallback

---

## Prosjektstruktur

```
grottechugg/
  apps/
    api/        # Express + Prisma API
    web/        # React/Vite frontend
  README.md
```

---

## Kom i gang

### Krav

- Node.js `20.19+`
- npm

### Installer

Kjør fra repo-root:

```bash
npm install
```

### Start backend

```bash
cd apps/api
npm run dev
```

Backend kjører vanligvis på `http://localhost:4000`.

### Start frontend

```bash
cd apps/web
npm run dev
```

Frontend kjører vanligvis på `http://localhost:5173`.

### Miljøvariabler lokalt

API (`apps/api/.env`):

```env
DATABASE_URL="file:./dev.db"
BETTER_AUTH_SECRET="replace-with-a-random-32-plus-character-secret"
BETTER_AUTH_URL="http://localhost:4000"
FRONTEND_ORIGIN="http://localhost:5173"
AUTH_ALLOW_SIGNUP="false"
BETTER_AUTH_TRUSTED_ORIGINS="http://localhost:5173,http://localhost:4000"
TURSO_DATABASE_URL=""
TURSO_AUTH_TOKEN=""
ADMIN_1_EMAIL=""
ADMIN_1_PASSWORD=""
ADMIN_1_NAME=""
ADMIN_2_EMAIL=""
ADMIN_2_PASSWORD=""
ADMIN_2_NAME=""
```

Web (`apps/web/.env`):

```env
# La denne stå tom lokalt for å bruke Vite-proxyen.
VITE_API_URL=""
```

---

## Deployment

### Arkitektur

- `apps/api` deployes til Render
- `apps/web` deployes til Vercel
- lokal utvikling bruker fortsatt `file:./dev.db`
- produksjon bruker Turso/libSQL, ikke en lokal SQLite-fil
- Prisma er fortsatt source of truth for schema og migrasjoner
- Better Auth bruker API-domenet som auth-base, med cookie-sessioner på API-origin

### Render API

Opprett en Render Web Service for `apps/api` og sett:

- Root Directory: `apps/api`
- Build Command: `npm run build`
- Start Command: `npm run start`

Anbefalte produksjonsvariabler i Render:

```env
NODE_ENV=production
PORT=4000
BETTER_AUTH_SECRET=<random 32+ char secret>
BETTER_AUTH_URL=https://<your-render-service>.onrender.com
FRONTEND_ORIGIN=https://<your-web-domain>
AUTH_ALLOW_SIGNUP=false
BETTER_AUTH_TRUSTED_ORIGINS=https://<your-web-domain>
TURSO_DATABASE_URL=libsql://<your-db>.turso.io
TURSO_AUTH_TOKEN=<turso-token>
ADMIN_1_EMAIL=<admin1 email>
ADMIN_1_PASSWORD=<admin1 password>
ADMIN_1_NAME=<admin1 name>
ADMIN_2_EMAIL=<admin2 email>
ADMIN_2_PASSWORD=<admin2 password>
ADMIN_2_NAME=<admin2 name>
```

Notater:

- `DATABASE_URL` trengs fortsatt lokalt for Prisma CLI og lokal SQLite, men Render-runtime bruker Turso gjennom Prisma sin libSQL-adapter.
- `npm run build` trenger ikke Turso-tilkobling; Prisma generate faller tilbake til `file:./dev.db`.
- Render free vil cold-starte. Det påvirker responstid, men ikke oppsettet.
- Hvis du vil støtte Vercel preview-logins, legg til en ekstra trusted origin, for eksempel `https://*.vercel.app`, i `BETTER_AUTH_TRUSTED_ORIGINS`.

### Vercel web

Opprett et Vercel-prosjekt for `apps/web` og sett:

- Root Directory: `apps/web`
- Framework Preset: `Vite`
- Install Command: `npm install`
- Build Command: `npm run build`
- Output Directory: `dist`

Sett minst disse miljøvariablene i Vercel:

```env
VITE_API_URL=https://<your-render-service>.onrender.com
```

`VITE_API_URL` må peke til Render-API-et. Frontenden kaller da API-et eksplisitt i produksjon, mens lokal utvikling fortsatt bruker Vite-proxy når variabelen står tom.

### Turso database

Opprett databasen og hent URL/token med Turso CLI:

```bash
turso db create <db-name>
turso db show <db-name> --url
turso db tokens create <db-name>
```

Bruk verdiene som:

- `TURSO_DATABASE_URL=libsql://...`
- `TURSO_AUTH_TOKEN=...`

For en ny produksjonsdatabase må du bruke de eksisterende Prisma-migrasjonene i repoet mot Turso i rekkefølge:

```bash
cd apps/api
for migration in prisma/migrations/*/migration.sql; do
  turso db shell <db-name> < "$migration"
done
```

Når du senere lager nye schema-endringer, gjør du fortsatt dette lokalt først:

```bash
cd apps/api
npx prisma migrate dev
```

Deretter committer du den nye `prisma/migrations/.../migration.sql`-fila og kjører den samme SQL-fila mot Turso.

### Første produksjonsdeploy

1. Opprett Turso-databasen og hent `TURSO_DATABASE_URL` og `TURSO_AUTH_TOKEN`.
2. Kjør alle eksisterende `prisma/migrations/*/migration.sql` mot Turso.
3. Deploy API-servicen til Render med alle env-vars satt.
4. Kjør admin-seed én gang i Render-shell eller som midlertidig kommando:

```bash
npm run seed
```

5. Deploy frontend til Vercel med `VITE_API_URL` satt til Render-domenet.
6. Verifiser login på Vercel-domenet og at admin-skriving fungerer mot Render + Turso.

### Prisma i produksjon

Lokalt:

```bash
cd apps/api
npx prisma migrate dev
```

Produksjon:

```bash
cd apps/api
for migration in prisma/migrations/*/migration.sql; do
  turso db shell <db-name> < "$migration"
done
```

Bruk `migrate dev` bare lokalt. Prisma Migrate deploy-kjøring brukes ikke direkte mot Turso i dette oppsettet.

---

## Import av historikk (Excel)

Historikk importeres fra Excel-arket (typisk `Grottechug_25_26.xlsx`) og legger inn:

- deltakere (faste/ gjester)
- datoer (sessions)
- tider (attempts)
- anmerkninger (notes)

Eksempel:

```bash
curl -F "file=@C:\path\to\Grottechug_25_26.xlsx" http://localhost:4000/api/import/excel
```

> Importen er laget for ark som `2026V` og `2025H`.

---

## Bruk

- **Hjulet**: velg hvem som er med, legg til gjester via søk, spin.
- **Chuggelista**: se historikk pr semester, sorter, klikk på navn for personside.
- **Toppliste**: se beste clean tider.
- **Regler**: oppdater regler/kryss/detaljer i DB.

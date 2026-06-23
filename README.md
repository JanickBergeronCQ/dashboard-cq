# CQ Employee Dashboard

Static React dashboard for collecting employee-facing, read-only Airtable views in one place.

## Local Setup

```powershell
npm.cmd install
npm.cmd run dev
```

Open the local URL printed by Vite.

## Configure Airtable Views

Edit `src/resources.ts` to add, remove, rename, or update Airtable views:

- `embedUrl`: Airtable shared embed URL, usually starting with `https://airtable.com/embed/...`
- `directUrl`: normal Airtable shared view URL, used when embedding is blocked or users need a full-page view

Do not commit private API keys. This app does not need Airtable API credentials.

## Available Scripts

```powershell
npm.cmd run dev
npm.cmd run build
npm.cmd test
```

`npm.cmd run build` creates the static production site in `dist`.

## Production Model

The app is deployed as static files. The Linux server only needs a web server such as Nginx to serve `dist`; it does not need a Node service running in production.

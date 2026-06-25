# Dashboard CQ

Authenticated internal dashboard for employee-facing Airtable views.

The app now runs as a small Node service behind Nginx. The service serves the React UI, stores users/roles/resources in SQLite, and exposes authenticated `/api/*` endpoints.

## Local Setup

```powershell
npm.cmd install
npm.cmd run dev
```

Local development runs:

- Vite client on `127.0.0.1:5173`
- Node API service on `127.0.0.1:3000`
- Vite proxies `/api` to the API service

Default local admin account after the first database seed:

- Email: `admin@example.com`
- Password: `ChangeMeNow!2026`

Set `DASHBOARD_ADMIN_EMAIL`, `DASHBOARD_ADMIN_PASSWORD`, and `DASHBOARD_ADMIN_NAME` before the first server start to choose different initial admin credentials.

## Security Model

- No public account creation.
- Admin users create employee access.
- Temporary passwords must be changed on first login.
- Sessions use `HttpOnly`, `SameSite=Lax` cookies.
- Production cookies are `Secure` by default.
- Roles control which dashboard resources are returned to each user.

Important: v1 still uses Airtable shared/embed URLs. The dashboard controls who can see links inside this app, but copied Airtable shared links may still work outside the dashboard depending on Airtable sharing settings.

## Scripts

```powershell
npm.cmd run dev
npm.cmd test
npm.cmd run build
npm.cmd start
```

`npm.cmd run build` creates:

- `dist/` for React static assets
- `server-dist/` for the Node service

# Linux Deployment

The dashboard is now a Node app service behind Nginx. Nginx should proxy `/dashboard/` to the local Node service. The Node service serves the React build and the authenticated `/api/*` endpoints.

## Server Requirements

```bash
sudo apt update
sudo apt install -y nginx
```

Install Node 20+ using your preferred method. If the distro package is still Node 16, use NodeSource or another supported Node 20+ install path.

## App Directory

```bash
cd /opt
sudo git clone https://github.com/JanickBergeronCQ/dashboard-cq.git dashboard-cq
sudo chown -R "$USER":"$USER" /opt/dashboard-cq
cd /opt/dashboard-cq
npm install
npm run build
```

For updates after the first install:

```bash
cd /opt/dashboard-cq
git pull
npm install
npm run build
sudo systemctl restart dashboard-cq
```

## Data Directory

```bash
sudo mkdir -p /var/lib/dashboard-cq
sudo chown -R www-data:www-data /var/lib/dashboard-cq
sudo chmod 750 /var/lib/dashboard-cq
```

SQLite will live at:

```text
/var/lib/dashboard-cq/dashboard.db
```

## Environment File

Create `/etc/dashboard-cq.env`:

```bash
sudo nano /etc/dashboard-cq.env
```

Example:

```env
NODE_ENV=production
PORT=3000
DASHBOARD_DB_PATH=/var/lib/dashboard-cq/dashboard.db
DASHBOARD_STATIC_DIR=/opt/dashboard-cq/dist
DASHBOARD_SECURE_COOKIES=true
DASHBOARD_ADMIN_EMAIL=admin@your-company.ca
DASHBOARD_ADMIN_PASSWORD=CHANGE_THIS_LONG_TEMP_PASSWORD
DASHBOARD_ADMIN_NAME=Dashboard Admin
```

Protect it:

```bash
sudo chown root:www-data /etc/dashboard-cq.env
sudo chmod 640 /etc/dashboard-cq.env
```

The initial admin is created only when the database has no admin user. After the first login, change the temporary password.

## systemd Service

Create `/etc/systemd/system/dashboard-cq.service`:

```ini
[Unit]
Description=Dashboard CQ
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/dashboard-cq
EnvironmentFile=/etc/dashboard-cq.env
ExecStart=/usr/bin/node /opt/dashboard-cq/server-dist/index.js
Restart=always
RestartSec=5
User=www-data
Group=www-data

[Install]
WantedBy=multi-user.target
```

Enable it:

```bash
sudo systemctl daemon-reload
sudo systemctl enable dashboard-cq
sudo systemctl start dashboard-cq
sudo systemctl status dashboard-cq
```

## Nginx Reverse Proxy

In the existing `l.cq2.ca` server block, replace the static `/dashboard/` alias with:

```nginx
location = /dashboard {
    return 301 /dashboard/;
}

location ^~ /dashboard/ {
    proxy_pass http://127.0.0.1:3000/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

Validate and reload:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## Verification

```bash
curl -I http://127.0.0.1:3000/
curl -k -I https://l.cq2.ca/dashboard/
sudo journalctl -u dashboard-cq -n 80 --no-pager
```

Then open:

```text
https://l.cq2.ca/dashboard/
```

Login with the initial admin account from `/etc/dashboard-cq.env`, change the temporary password, then create employee users and roles from the admin panel.

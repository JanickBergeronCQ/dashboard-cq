# Linux Deployment

This app builds to static files in `dist`. In production, Nginx can serve those files directly.

## Option 1: Build Locally, Upload `dist`

On Windows:

```powershell
npm.cmd install
npm.cmd run build
scp -r dist/* user@your-server:/tmp/dashboard-cq/
```

On the Linux server:

```bash
sudo mkdir -p /var/www/dashboard-cq
sudo rsync -a --delete /tmp/dashboard-cq/ /var/www/dashboard-cq/
sudo chown -R www-data:www-data /var/www/dashboard-cq
```

## Option 2: Build on the Server

```bash
sudo apt update
sudo apt install -y nodejs npm nginx
git clone <your-repository-url> dashboard-cq
cd dashboard-cq
npm install
npm run build
sudo mkdir -p /var/www/dashboard-cq
sudo rsync -a --delete dist/ /var/www/dashboard-cq/
sudo chown -R www-data:www-data /var/www/dashboard-cq
```

## Nginx Site

Create `/etc/nginx/sites-available/dashboard-cq`:

```nginx
server {
    listen 80;
    server_name dashboard.example.com;

    root /var/www/dashboard-cq;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";
    add_header Referrer-Policy "strict-origin-when-cross-origin";
}
```

Enable it:

```bash
sudo ln -s /etc/nginx/sites-available/dashboard-cq /etc/nginx/sites-enabled/dashboard-cq
sudo nginx -t
sudo systemctl reload nginx
```

## Optional HTTPS

If the server has a real domain:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d dashboard.example.com
```

## Optional Basic Authentication

Install tools:

```bash
sudo apt install -y apache2-utils
sudo htpasswd -c /etc/nginx/.dashboard-cq.htpasswd employee-admin
```

Add inside the Nginx `server` block:

```nginx
auth_basic "CQ Employee Dashboard";
auth_basic_user_file /etc/nginx/.dashboard-cq.htpasswd;
```

Then validate and reload:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## Updating Airtable Links

Replace placeholder URLs in `src/resources.ts`, rebuild, and redeploy `dist`.

If an Airtable embed does not appear, check that the Airtable view is shared correctly and use the visible `Open in Airtable` link as the fallback path.

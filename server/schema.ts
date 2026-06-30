import bcrypt from "bcryptjs";
import Database from "better-sqlite3";

export type DashboardIcon =
  | "tasks"
  | "projects"
  | "personal"
  | "clients"
  | "inventory"
  | "forms"
  | "procedures"
  | "reports";

export type ResourceKind = "standard" | "personal";

export type UserRecord = {
  id: number;
  email: string;
  display_name: string;
  password_hash: string;
  active: 0 | 1;
  must_change_password: 0 | 1;
  is_admin: 0 | 1;
  created_at: string;
  updated_at: string;
};

export type AuthenticatedUser = {
  id: number;
  email: string;
  displayName: string;
  isAdmin: boolean;
  mustChangePassword: boolean;
};

export type ResourceRecord = {
  id: string;
  label: string;
  description: string | null;
  embed_url: string;
  direct_url: string;
  secondary_embed_url: string;
  secondary_direct_url: string;
  icon: DashboardIcon;
  enabled: 0 | 1;
  kind: ResourceKind;
  order_index: number;
};

const nowSql = "datetime('now')";

export function initializeDatabase(db: Database.Database, options: { seedAdmin?: boolean } = {}) {
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      display_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      must_change_password INTEGER NOT NULL DEFAULT 1,
      is_admin INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (${nowSql}),
      updated_at TEXT NOT NULL DEFAULT (${nowSql})
    );

    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE COLLATE NOCASE,
      description TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (${nowSql}),
      updated_at TEXT NOT NULL DEFAULT (${nowSql})
    );

    CREATE TABLE IF NOT EXISTS user_roles (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      PRIMARY KEY (user_id, role_id)
    );

    CREATE TABLE IF NOT EXISTS resources (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      description TEXT,
      embed_url TEXT NOT NULL,
      direct_url TEXT NOT NULL,
      secondary_embed_url TEXT NOT NULL DEFAULT '',
      secondary_direct_url TEXT NOT NULL DEFAULT '',
      icon TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      kind TEXT NOT NULL CHECK (kind IN ('standard', 'personal')),
      order_index INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (${nowSql}),
      updated_at TEXT NOT NULL DEFAULT (${nowSql})
    );

    CREATE TABLE IF NOT EXISTS role_resource_permissions (
      role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      resource_id TEXT NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
      PRIMARY KEY (role_id, resource_id)
    );

    CREATE TABLE IF NOT EXISTS user_resource_permissions (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      resource_id TEXT NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
      PRIMARY KEY (user_id, resource_id)
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token_hash TEXT NOT NULL UNIQUE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL,
      user_agent TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (${nowSql}),
      last_used_at TEXT NOT NULL DEFAULT (${nowSql})
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      action TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (${nowSql})
    );
  `);

  ensureResourceSecondaryColumns(db);
  seedResources(db);

  if (options.seedAdmin ?? true) {
    seedAdminUser(db);
  }
}

function ensureResourceSecondaryColumns(db: Database.Database) {
  const columns = db.prepare("PRAGMA table_info(resources)").all() as { name: string }[];
  const columnNames = new Set(columns.map((column) => column.name));

  if (!columnNames.has("secondary_embed_url")) {
    db.prepare("ALTER TABLE resources ADD COLUMN secondary_embed_url TEXT NOT NULL DEFAULT ''").run();
  }

  if (!columnNames.has("secondary_direct_url")) {
    db.prepare("ALTER TABLE resources ADD COLUMN secondary_direct_url TEXT NOT NULL DEFAULT ''").run();
  }
}

function seedResources(db: Database.Database) {
  const insertResource = db.prepare(`
    INSERT INTO resources (
      id, label, description, embed_url, direct_url, secondary_embed_url, secondary_direct_url, icon, enabled, kind, order_index
    )
    VALUES (
      @id, @label, @description, @embed_url, @direct_url, @secondary_embed_url, @secondary_direct_url, @icon, @enabled, @kind, @order_index
    )
    ON CONFLICT(id) DO NOTHING
  `);

  const resources: ResourceRecord[] = [
    {
      id: "operational-tasks",
      label: "Tâches Opérationnels",
      description: "Suivi des tâches opérationnelles",
      embed_url:
        "https://airtable.com/embed/appYZtMb3u96lIGpk/shrcaORyqFY29lGl7/tblWOL7fHiQhNtN2U",
      direct_url:
        "https://airtable.com/appYZtMb3u96lIGpk/shrcaORyqFY29lGl7/tblWOL7fHiQhNtN2U",
      secondary_embed_url: "",
      secondary_direct_url: "",
      icon: "tasks",
      enabled: 1,
      kind: "standard",
      order_index: 10
    },
    {
      id: "project-progress",
      label: "Avancement de Projets",
      description: "Consultation de l'avancement des projets",
      embed_url:
        "https://airtable.com/embed/appYZtMb3u96lIGpk/shra9klsZPwrQUA47/tbl6j0WsBvlJSXZEb",
      direct_url:
        "https://airtable.com/appYZtMb3u96lIGpk/shra9klsZPwrQUA47/tbl6j0WsBvlJSXZEb",
      secondary_embed_url: "",
      secondary_direct_url: "",
      icon: "projects",
      enabled: 1,
      kind: "standard",
      order_index: 20
    },
    ...Array.from({ length: 5 }, (_, index) => ({
      id: `employee-personal-${index + 1}`,
      label: `Employé ${index + 1}`,
      description: "Vue personnelle à configurer",
      embed_url: "",
      direct_url: "",
      secondary_embed_url: "",
      secondary_direct_url: "",
      icon: "personal" as DashboardIcon,
      enabled: 1 as const,
      kind: "personal" as const,
      order_index: (index + 1) * 10
    }))
  ];

  const createDefaultRole = db.prepare(`
    INSERT INTO roles (name, description)
    VALUES ('Dashboard Admin', 'Full access to dashboard resources')
    ON CONFLICT(name) DO NOTHING
  `);
  const grantRole = db.prepare(`
    INSERT OR IGNORE INTO role_resource_permissions (role_id, resource_id)
    VALUES (@roleId, @resourceId)
  `);
  const adminRole = db.prepare("SELECT id FROM roles WHERE name = ?").get("Dashboard Admin") as
    | { id: number }
    | undefined;

  db.transaction(() => {
    for (const resource of resources) {
      insertResource.run(resource);
    }

    syncPersonalViewSeeds(db);

    createDefaultRole.run();
    const role =
      adminRole ?? (db.prepare("SELECT id FROM roles WHERE name = ?").get("Dashboard Admin") as { id: number });

    for (const resource of resources) {
      grantRole.run({ roleId: role.id, resourceId: resource.id });
    }
  })();
}

function syncPersonalViewSeeds(db: Database.Database) {
  const updateResource = db.prepare(`
    UPDATE resources
    SET label = @label,
        description = @description,
        embed_url = @embed_url,
        direct_url = @direct_url,
        secondary_embed_url = @secondary_embed_url,
        secondary_direct_url = @secondary_direct_url,
        updated_at = datetime('now')
    WHERE id = @id
      AND (
        embed_url = ''
        OR direct_url = @legacy_direct_url
        OR (@sync_secondary = 1 AND secondary_direct_url = '')
        OR label LIKE 'Employé %'
        OR label LIKE 'EmployÃ© %'
      )
  `);

  const personalViews = [
    {
      id: "employee-personal-1",
      label: "Jean-François",
      description: "Vue personnelle",
      direct_url:
        "https://airtable.com/appYZtMb3u96lIGpk/shrkqSENufcIBpl16",
      secondary_direct_url: "",
      sync_secondary: 0,
      legacy_direct_url:
        "https://airtable.com/appYZtMb3u96lIGpk/tbl6j0WsBvlJSXZEb/viwbVf7pn6mSb13pI?blocks=hide"
    },
    {
      id: "employee-personal-2",
      label: "Simon",
      description: "Vue personnelle",
      direct_url:
        "https://airtable.com/appYZtMb3u96lIGpk/shr0h3jidVa7k9xTi",
      secondary_direct_url:
        "https://airtable.com/appYZtMb3u96lIGpk/shr2z8VpQMOjXf3TQ",
      sync_secondary: 1,
      legacy_direct_url:
        "https://airtable.com/appYZtMb3u96lIGpk/tbl6j0WsBvlJSXZEb/viwbz6tBrFiDAVTUI?blocks=hide"
    },
    {
      id: "employee-personal-3",
      label: "Pierre-Émile",
      description: "Vue personnelle",
      direct_url:
        "https://airtable.com/appYZtMb3u96lIGpk/shrtIR5kWN8iv7XL3",
      secondary_direct_url: "",
      sync_secondary: 0,
      legacy_direct_url:
        "https://airtable.com/appYZtMb3u96lIGpk/tbl6j0WsBvlJSXZEb/viwXHv7UmBCRDWSZM?blocks=hide"
    },
    {
      id: "employee-personal-4",
      label: "Pier-Alexandre",
      description: "Vue personnelle",
      direct_url:
        "https://airtable.com/appYZtMb3u96lIGpk/shrsJJk5uNp2eNMpB",
      secondary_direct_url: "",
      sync_secondary: 0,
      legacy_direct_url:
        "https://airtable.com/appYZtMb3u96lIGpk/tbl6j0WsBvlJSXZEb/viwbD9Q3oQ0uZHNSe?blocks=hide"
    }
  ];

  for (const view of personalViews) {
    updateResource.run({
      ...view,
      embed_url: toAirtableEmbedUrl(view.direct_url),
      secondary_embed_url: view.secondary_direct_url
        ? toAirtableEmbedUrl(view.secondary_direct_url)
        : ""
    });
  }
}

function toAirtableEmbedUrl(url: string) {
  return url.replace("https://airtable.com/", "https://airtable.com/embed/");
}

function seedAdminUser(db: Database.Database) {
  const adminCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE is_admin = 1").get() as {
    count: number;
  };

  if (adminCount.count > 0) {
    return;
  }

  const email = process.env.DASHBOARD_ADMIN_EMAIL ?? "admin@example.com";
  const password = process.env.DASHBOARD_ADMIN_PASSWORD ?? "ChangeMeNow!2026";
  const displayName = process.env.DASHBOARD_ADMIN_NAME ?? "Dashboard Admin";
  const hash = bcrypt.hashSync(password, 12);

  const result = db
    .prepare(
      `INSERT INTO users (
        email, display_name, password_hash, active, must_change_password, is_admin
      ) VALUES (?, ?, ?, 1, 1, 1)`
    )
    .run(email, displayName, hash);

  const role = db.prepare("SELECT id FROM roles WHERE name = ?").get("Dashboard Admin") as
    | { id: number }
    | undefined;

  if (role) {
    db.prepare("INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)").run(
      result.lastInsertRowid,
      role.id
    );
  }
}

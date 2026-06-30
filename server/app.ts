import crypto from "node:crypto";
import path from "node:path";
import bcrypt from "bcryptjs";
import cookieParser from "cookie-parser";
import express from "express";
import Database from "better-sqlite3";
import { z } from "zod";
import {
  AuthenticatedUser,
  initializeDatabase,
  ResourceRecord,
  UserRecord
} from "./schema.js";

const SESSION_COOKIE = "dashboard_session";
const SESSION_DAYS = 30;

type AppOptions = {
  dbPath: string;
  staticDir?: string;
  secureCookies?: boolean;
  seedAdmin?: boolean;
};

type RequestWithUser = express.Request & {
  user?: AuthenticatedUser;
  dbUser?: UserRecord;
};

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(10)
});

const createUserSchema = z.object({
  email: z.string().email(),
  displayName: z.string().min(1),
  temporaryPassword: z.string().min(10),
  isAdmin: z.boolean().default(false),
  roleIds: z.array(z.number().int().positive()).default([])
});

const updateUserSchema = z.object({
  displayName: z.string().min(1).optional(),
  active: z.boolean().optional(),
  mustChangePassword: z.boolean().optional(),
  isAdmin: z.boolean().optional(),
  roleIds: z.array(z.number().int().positive()).optional()
});

const roleSchema = z.object({
  name: z.string().min(1),
  description: z.string().default("")
});

const resourceUpdateSchema = z.object({
  label: z.string().min(1).optional(),
  description: z.string().optional(),
  embedUrl: z.string().optional(),
  directUrl: z.string().optional(),
  icon: z.string().min(1).optional(),
  enabled: z.boolean().optional(),
  order: z.number().int().optional(),
  roleIds: z.array(z.number().int().positive()).optional(),
  userIds: z.array(z.number().int().positive()).optional()
});

const permissionsSchema = z.object({
  resourceId: z.string().min(1),
  roleIds: z.array(z.number().int().positive()).default([]),
  userIds: z.array(z.number().int().positive()).default([])
});

export function createApp(options: AppOptions) {
  const db = new Database(options.dbPath);
  initializeDatabase(db, { seedAdmin: options.seedAdmin });

  const app = express();
  app.locals.db = db;
  app.use(express.json({ limit: "256kb" }));
  app.use(cookieParser());

  app.post("/api/auth/login", (req, res) => {
    const parsed = loginSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid login payload." });
    }

    const user = db
      .prepare("SELECT * FROM users WHERE email = ?")
      .get(parsed.data.email) as UserRecord | undefined;

    if (!user || user.active !== 1 || !bcrypt.compareSync(parsed.data.password, user.password_hash)) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const token = createSession(db, user.id, req.get("user-agent") ?? "");
    setSessionCookie(res, token, options.secureCookies ?? process.env.NODE_ENV === "production");

    return res.json({ user: toPublicUser(user) });
  });

  app.post("/api/auth/logout", authenticate(db), (req: RequestWithUser, res) => {
    const token = readSessionToken(req);

    if (token) {
      db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashToken(token));
    }

    clearSessionCookie(res, options.secureCookies ?? process.env.NODE_ENV === "production");
    return res.status(204).send();
  });

  app.get("/api/auth/me", authenticate(db), (req: RequestWithUser, res) => {
    return res.json({ user: req.user });
  });

  app.post("/api/auth/change-password", authenticate(db), (req: RequestWithUser, res) => {
    const parsed = changePasswordSchema.safeParse(req.body);

    if (!parsed.success || !req.dbUser) {
      return res.status(400).json({ error: "Invalid password change payload." });
    }

    if (!bcrypt.compareSync(parsed.data.currentPassword, req.dbUser.password_hash)) {
      return res.status(401).json({ error: "Current password is incorrect." });
    }

    const passwordHash = bcrypt.hashSync(parsed.data.newPassword, 12);
    db.prepare(
      `UPDATE users
       SET password_hash = ?, must_change_password = 0, updated_at = datetime('now')
       WHERE id = ?`
    ).run(passwordHash, req.dbUser.id);

    const updated = db.prepare("SELECT * FROM users WHERE id = ?").get(req.dbUser.id) as UserRecord;
    return res.json({ user: toPublicUser(updated) });
  });

  app.get("/api/dashboard/resources", authenticate(db), requirePasswordReady, (req: RequestWithUser, res) => {
    const resources = getAccessibleResources(db, req.user!.id, req.user!.isAdmin);
    return res.json({
      resources: resources.filter((resource) => resource.kind === "standard").map(toPublicResource),
      personalViews: resources.filter((resource) => resource.kind === "personal").map(toPublicResource)
    });
  });

  app.get("/api/admin/users", authenticate(db), requirePasswordReady, requireAdmin, (_req, res) => {
    return res.json({ users: listUsers(db) });
  });

  app.post("/api/admin/users", authenticate(db), requirePasswordReady, requireAdmin, (req: RequestWithUser, res) => {
    const parsed = createUserSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        error: "Vérifiez le courriel, le nom et le mot de passe temporaire de 10 caractères minimum."
      });
    }

    try {
      const result = db
        .prepare(
          `INSERT INTO users (
            email, display_name, password_hash, active, must_change_password, is_admin
          ) VALUES (?, ?, ?, 1, 1, ?)`
        )
        .run(
          parsed.data.email,
          parsed.data.displayName,
          bcrypt.hashSync(parsed.data.temporaryPassword, 12),
          parsed.data.isAdmin ? 1 : 0
        );

      replaceUserRoles(db, Number(result.lastInsertRowid), parsed.data.roleIds);
      audit(db, req.user!.id, "create_user", "user", String(result.lastInsertRowid), {
        email: parsed.data.email
      });

      return res.status(201).json({ users: listUsers(db) });
    } catch (err) {
      if (err instanceof Error && err.message.includes("UNIQUE")) {
        return res.status(409).json({ error: "Un accès existe déjà pour ce courriel." });
      }

      throw err;
    }
  });

  app.patch("/api/admin/users/:id", authenticate(db), requirePasswordReady, requireAdmin, (req: RequestWithUser, res) => {
    const parsed = updateUserSchema.safeParse(req.body);
    const userId = Number(req.params.id);

    if (!parsed.success || !Number.isInteger(userId)) {
      return res.status(400).json({ error: "Invalid user update payload." });
    }

    const current = db.prepare("SELECT * FROM users WHERE id = ?").get(userId) as
      | UserRecord
      | undefined;

    if (!current) {
      return res.status(404).json({ error: "User not found." });
    }

    db.prepare(
      `UPDATE users
       SET display_name = ?,
           active = ?,
           must_change_password = ?,
           is_admin = ?,
           updated_at = datetime('now')
       WHERE id = ?`
    ).run(
      parsed.data.displayName ?? current.display_name,
      parsed.data.active === undefined ? current.active : parsed.data.active ? 1 : 0,
      parsed.data.mustChangePassword === undefined
        ? current.must_change_password
        : parsed.data.mustChangePassword
          ? 1
          : 0,
      parsed.data.isAdmin === undefined ? current.is_admin : parsed.data.isAdmin ? 1 : 0,
      userId
    );

    if (parsed.data.roleIds) {
      replaceUserRoles(db, userId, parsed.data.roleIds);
    }

    audit(db, req.user!.id, "update_user", "user", String(userId), parsed.data);
    return res.json({ users: listUsers(db) });
  });

  app.delete("/api/admin/users/:id", authenticate(db), requirePasswordReady, requireAdmin, (req: RequestWithUser, res) => {
    const userId = Number(req.params.id);

    if (!Number.isInteger(userId)) {
      return res.status(400).json({ error: "Invalid user id." });
    }

    if (userId === req.user!.id) {
      return res.status(400).json({ error: "Vous ne pouvez pas supprimer votre propre accÃ¨s." });
    }

    const current = db.prepare("SELECT * FROM users WHERE id = ?").get(userId) as
      | UserRecord
      | undefined;

    if (!current) {
      return res.status(404).json({ error: "User not found." });
    }

    if (current.is_admin === 1) {
      const remainingAdmins = db
        .prepare("SELECT COUNT(*) as count FROM users WHERE is_admin = 1 AND active = 1 AND id <> ?")
        .get(userId) as { count: number };

      if (remainingAdmins.count === 0) {
        return res.status(400).json({ error: "Vous devez conserver au moins un administrateur actif." });
      }
    }

    db.prepare("DELETE FROM users WHERE id = ?").run(userId);
    audit(db, req.user!.id, "delete_user", "user", String(userId), {
      email: current.email
    });

    return res.json({ users: listUsers(db) });
  });

  app.get("/api/admin/roles", authenticate(db), requirePasswordReady, requireAdmin, (_req, res) => {
    return res.json({ roles: listRoles(db) });
  });

  app.post("/api/admin/roles", authenticate(db), requirePasswordReady, requireAdmin, (req: RequestWithUser, res) => {
    const parsed = roleSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid role payload." });
    }

    const result = db
      .prepare("INSERT INTO roles (name, description) VALUES (?, ?)")
      .run(parsed.data.name, parsed.data.description);
    audit(db, req.user!.id, "create_role", "role", String(result.lastInsertRowid), parsed.data);
    return res.status(201).json({ roles: listRoles(db) });
  });

  app.patch("/api/admin/roles/:id", authenticate(db), requirePasswordReady, requireAdmin, (req: RequestWithUser, res) => {
    const parsed = roleSchema.safeParse(req.body);
    const roleId = Number(req.params.id);

    if (!parsed.success || !Number.isInteger(roleId)) {
      return res.status(400).json({ error: "Invalid role update payload." });
    }

    db.prepare(
      "UPDATE roles SET name = ?, description = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(parsed.data.name, parsed.data.description, roleId);
    audit(db, req.user!.id, "update_role", "role", String(roleId), parsed.data);
    return res.json({ roles: listRoles(db) });
  });

  app.get("/api/admin/resources", authenticate(db), requirePasswordReady, requireAdmin, (_req, res) => {
    return res.json({ resources: listAdminResources(db), roles: listRoles(db) });
  });

  app.patch(
    "/api/admin/resources/:id",
    authenticate(db),
    requirePasswordReady,
    requireAdmin,
    (req: RequestWithUser, res) => {
      const parsed = resourceUpdateSchema.safeParse(req.body);
      const resourceId = String(req.params.id);

      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid resource update payload." });
      }

      const current = db.prepare("SELECT * FROM resources WHERE id = ?").get(resourceId) as
        | ResourceRecord
        | undefined;

      if (!current) {
        return res.status(404).json({ error: "Resource not found." });
      }

      db.prepare(
        `UPDATE resources
         SET label = ?,
             description = ?,
             embed_url = ?,
             direct_url = ?,
             icon = ?,
             enabled = ?,
             order_index = ?,
             updated_at = datetime('now')
         WHERE id = ?`
      ).run(
        parsed.data.label ?? current.label,
        parsed.data.description ?? current.description,
        parsed.data.embedUrl ?? current.embed_url,
        parsed.data.directUrl ?? current.direct_url,
        parsed.data.icon ?? current.icon,
        parsed.data.enabled === undefined ? current.enabled : parsed.data.enabled ? 1 : 0,
        parsed.data.order ?? current.order_index,
        resourceId
      );

      if (parsed.data.roleIds) {
        replaceResourceRoles(db, resourceId, parsed.data.roleIds);
      }

      if (parsed.data.userIds) {
        replaceResourceUsers(db, resourceId, parsed.data.userIds);
      }

      audit(db, req.user!.id, "update_resource", "resource", resourceId, parsed.data);
      return res.json({ resources: listAdminResources(db), roles: listRoles(db) });
    }
  );

  app.post("/api/admin/permissions", authenticate(db), requirePasswordReady, requireAdmin, (req: RequestWithUser, res) => {
    const parsed = permissionsSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid permission payload." });
    }

    replaceResourceRoles(db, parsed.data.resourceId, parsed.data.roleIds);
    replaceResourceUsers(db, parsed.data.resourceId, parsed.data.userIds);
    audit(db, req.user!.id, "update_permissions", "resource", parsed.data.resourceId, parsed.data);
    return res.json({ resources: listAdminResources(db), roles: listRoles(db) });
  });

  if (options.staticDir) {
    app.use(express.static(options.staticDir));
    app.get(/.*/, (_req, res) => {
      res.sendFile(path.join(options.staticDir!, "index.html"));
    });
  }

  return app;
}

function authenticate(db: Database.Database): express.RequestHandler {
  return (req: RequestWithUser, res, next) => {
    const token = readSessionToken(req);

    if (!token) {
      return res.status(401).json({ error: "Authentication required." });
    }

    const session = db
      .prepare(
        `SELECT users.*, sessions.expires_at
         FROM sessions
         JOIN users ON users.id = sessions.user_id
         WHERE sessions.token_hash = ?
           AND sessions.expires_at > datetime('now')`
      )
      .get(hashToken(token)) as (UserRecord & { expires_at: string }) | undefined;

    if (!session || session.active !== 1) {
      return res.status(401).json({ error: "Authentication required." });
    }

    db.prepare(
      "UPDATE sessions SET last_used_at = datetime('now') WHERE token_hash = ?"
    ).run(hashToken(token));
    req.dbUser = session;
    req.user = toPublicUser(session);
    return next();
  };
}

function readSessionToken(req: express.Request) {
  const token = req.cookies?.[SESSION_COOKIE] as string | string[] | undefined;

  return Array.isArray(token) ? token[0] : token;
}

function requireAdmin(req: RequestWithUser, res: express.Response, next: express.NextFunction) {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ error: "Admin access required." });
  }

  return next();
}

function requirePasswordReady(
  req: RequestWithUser,
  res: express.Response,
  next: express.NextFunction
) {
  if (req.user?.mustChangePassword) {
    return res.status(403).json({ error: "Password change required." });
  }

  return next();
}

function createSession(db: Database.Database, userId: number, userAgent: string) {
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  db.prepare(
    `INSERT INTO sessions (token_hash, user_id, expires_at, user_agent)
     VALUES (?, ?, ?, ?)`
  ).run(hashToken(token), userId, expiresAt, userAgent);

  return token;
}

function setSessionCookie(res: express.Response, token: string, secure: boolean) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
    path: "/"
  });
}

function clearSessionCookie(res: express.Response, secure: boolean) {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/"
  });
}

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function toPublicUser(user: UserRecord): AuthenticatedUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    isAdmin: user.is_admin === 1,
    mustChangePassword: user.must_change_password === 1
  };
}

function toPublicResource(resource: ResourceRecord) {
  return {
    id: resource.id,
    label: resource.label,
    description: resource.description ?? undefined,
    embedUrl: resource.embed_url,
    directUrl: resource.direct_url,
    secondaryEmbedUrl: resource.secondary_embed_url || undefined,
    secondaryDirectUrl: resource.secondary_direct_url || undefined,
    icon: resource.icon,
    enabled: resource.enabled === 1,
    kind: resource.kind,
    order: resource.order_index
  };
}

function getAccessibleResources(db: Database.Database, userId: number, isAdmin: boolean) {
  if (isAdmin) {
    return db
      .prepare("SELECT * FROM resources WHERE enabled = 1 ORDER BY kind, order_index, label")
      .all() as ResourceRecord[];
  }

  return db
    .prepare(
      `SELECT DISTINCT resources.*
       FROM resources
       LEFT JOIN role_resource_permissions ON role_resource_permissions.resource_id = resources.id
       LEFT JOIN user_roles ON user_roles.role_id = role_resource_permissions.role_id
       LEFT JOIN user_resource_permissions ON user_resource_permissions.resource_id = resources.id
       WHERE (user_roles.user_id = ? OR user_resource_permissions.user_id = ?)
         AND resources.enabled = 1
       ORDER BY resources.kind, resources.order_index, resources.label`
    )
    .all(userId, userId) as ResourceRecord[];
}

function listUsers(db: Database.Database) {
  const users = db.prepare("SELECT * FROM users ORDER BY display_name, email").all() as UserRecord[];

  return users.map((user) => ({
    ...toPublicUser(user),
    active: user.active === 1,
    roleIds: (
      db.prepare("SELECT role_id FROM user_roles WHERE user_id = ? ORDER BY role_id").all(user.id) as {
        role_id: number;
      }[]
    ).map((role) => role.role_id)
  }));
}

function listRoles(db: Database.Database) {
  return db
    .prepare("SELECT id, name, description FROM roles ORDER BY name")
    .all() as { id: number; name: string; description: string }[];
}

function listAdminResources(db: Database.Database) {
  const resources = db
    .prepare("SELECT * FROM resources ORDER BY kind, order_index, label")
    .all() as ResourceRecord[];

  return resources.map((resource) => ({
    ...toPublicResource(resource),
    roleIds: (
      db
        .prepare(
          "SELECT role_id FROM role_resource_permissions WHERE resource_id = ? ORDER BY role_id"
        )
        .all(resource.id) as { role_id: number }[]
    ).map((role) => role.role_id),
    userIds: (
      db
        .prepare(
          "SELECT user_id FROM user_resource_permissions WHERE resource_id = ? ORDER BY user_id"
        )
        .all(resource.id) as { user_id: number }[]
    ).map((user) => user.user_id)
  }));
}

function replaceUserRoles(db: Database.Database, userId: number, roleIds: number[]) {
  db.transaction(() => {
    db.prepare("DELETE FROM user_roles WHERE user_id = ?").run(userId);
    const insert = db.prepare("INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)");

    for (const roleId of roleIds) {
      insert.run(userId, roleId);
    }
  })();
}

function replaceResourceRoles(db: Database.Database, resourceId: string, roleIds: number[]) {
  db.transaction(() => {
    db.prepare("DELETE FROM role_resource_permissions WHERE resource_id = ?").run(resourceId);
    const insert = db.prepare(
      "INSERT OR IGNORE INTO role_resource_permissions (role_id, resource_id) VALUES (?, ?)"
    );

    for (const roleId of roleIds) {
      insert.run(roleId, resourceId);
    }
  })();
}

function replaceResourceUsers(db: Database.Database, resourceId: string, userIds: number[]) {
  db.transaction(() => {
    db.prepare("DELETE FROM user_resource_permissions WHERE resource_id = ?").run(resourceId);
    const insert = db.prepare(
      "INSERT OR IGNORE INTO user_resource_permissions (user_id, resource_id) VALUES (?, ?)"
    );

    for (const userId of userIds) {
      insert.run(userId, resourceId);
    }
  })();
}

function audit(
  db: Database.Database,
  actorUserId: number,
  action: string,
  targetType: string,
  targetId: string,
  metadata: unknown
) {
  db.prepare(
    `INSERT INTO audit_log (actor_user_id, action, target_type, target_id, metadata_json)
     VALUES (?, ?, ?, ?, ?)`
  ).run(actorUserId, action, targetType, targetId, JSON.stringify(metadata));
}

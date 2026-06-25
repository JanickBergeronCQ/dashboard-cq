// @vitest-environment node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import bcrypt from "bcryptjs";
import Database from "better-sqlite3";
import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "./app.js";

let tempDir = "";
let dbPath = "";
let currentApp: express.Express;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dashboard-cq-"));
  dbPath = path.join(tempDir, "test.db");
  currentApp = createApp({ dbPath, secureCookies: false });
});

afterEach(() => {
  (currentApp.locals.db as Database.Database).close();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

function db() {
  return currentApp.locals.db as Database.Database;
}

async function loginAsAdmin() {
  db().prepare("UPDATE users SET must_change_password = 0 WHERE email = ?").run("admin@example.com");
  const agent = request.agent(currentApp);
  const response = await agent
    .post("/api/auth/login")
    .send({ email: "admin@example.com", password: "ChangeMeNow!2026" });

  expect(response.status).toBe(200);
  return agent;
}

describe("auth API", () => {
  it("logs in with the seeded admin and issues a secure session cookie", async () => {
    (currentApp.locals.db as Database.Database).close();
    currentApp = createApp({ dbPath, secureCookies: true });
    const response = await request(currentApp)
      .post("/api/auth/login")
      .send({ email: "admin@example.com", password: "ChangeMeNow!2026" });

    expect(response.status).toBe(200);
    expect(response.body.user.email).toBe("admin@example.com");
    expect(response.body.user.password_hash).toBeUndefined();
    expect(response.headers["set-cookie"][0]).toContain("HttpOnly");
    expect(response.headers["set-cookie"][0]).toContain("Secure");
    expect(response.headers["set-cookie"][0]).toContain("SameSite=Lax");
  });

  it("rejects invalid credentials and disabled users", async () => {
    expect(
      (
        await request(currentApp)
          .post("/api/auth/login")
          .send({ email: "admin@example.com", password: "wrong-password" })
      ).status
    ).toBe(401);

    const database = db();
    database.prepare("UPDATE users SET active = 0 WHERE email = ?").run("admin@example.com");

    expect(
      (
        await request(currentApp)
          .post("/api/auth/login")
          .send({ email: "admin@example.com", password: "ChangeMeNow!2026" })
      ).status
    ).toBe(401);
  });

  it("rejects expired sessions", async () => {
    const agent = await loginAsAdmin();
    const database = db();
    database.prepare("UPDATE sessions SET expires_at = datetime('now', '-1 day')").run();

    expect((await agent.get("/api/auth/me")).status).toBe(401);
  });

  it("blocks dashboard resources until required password changes are completed", async () => {
    const agent = request.agent(currentApp);
    await agent
      .post("/api/auth/login")
      .send({ email: "admin@example.com", password: "ChangeMeNow!2026" });

    expect((await agent.get("/api/dashboard/resources")).status).toBe(403);
  });
});

describe("resource permissions", () => {
  it("returns only resources allowed by the user's roles", async () => {
    const admin = await loginAsAdmin();
    const roleResponse = await admin
      .post("/api/admin/roles")
      .send({ name: "Operations", description: "Operations role" });
    const role = roleResponse.body.roles.find((item: { name: string }) => item.name === "Operations");

    await admin
      .post("/api/admin/users")
      .send({
        email: "employee@example.com",
        displayName: "Employee",
        temporaryPassword: "Temporary123!",
        isAdmin: false,
        roleIds: [role.id]
      });
    db().prepare("UPDATE users SET must_change_password = 0 WHERE email = ?").run(
      "employee@example.com"
    );
    await admin
      .post("/api/admin/permissions")
      .send({ resourceId: "operational-tasks", roleIds: [role.id] });

    const employee = request.agent(currentApp);
    expect(
      (
        await employee
          .post("/api/auth/login")
          .send({ email: "employee@example.com", password: "Temporary123!" })
      ).status
    ).toBe(200);

    const response = await employee.get("/api/dashboard/resources");

    expect(response.status).toBe(200);
    expect(response.body.resources.map((resource: { id: string }) => resource.id)).toEqual([
      "operational-tasks"
    ]);
  });

  it("blocks admin APIs for non-admin users", async () => {
    const database = db();
    const passwordHash = bcrypt.hashSync("Temporary123!", 12);
    database
      .prepare(
        `INSERT INTO users (
          email, display_name, password_hash, active, must_change_password, is_admin
        ) VALUES (?, ?, ?, 1, 0, 0)`
      )
      .run("employee@example.com", "Employee", passwordHash);

    const employee = request.agent(currentApp);
    await employee
      .post("/api/auth/login")
      .send({ email: "employee@example.com", password: "Temporary123!" });

    expect((await employee.get("/api/admin/users")).status).toBe(403);
  });
});

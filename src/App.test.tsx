import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { DashboardResourcesResponse } from "./resources";

const user = {
  id: 1,
  email: "employee@example.com",
  displayName: "Employee",
  isAdmin: false,
  mustChangePassword: false
};

const admin = {
  ...user,
  isAdmin: true
};

const resources: DashboardResourcesResponse = {
  resources: [
    {
      id: "operational-tasks",
      label: "Tâches Opérationnels",
      description: "Suivi des tâches opérationnelles",
      embedUrl: "https://airtable.com/embed/tasks",
      directUrl: "https://airtable.com/tasks",
      icon: "tasks",
      enabled: true,
      kind: "standard",
      order: 10
    },
    {
      id: "project-progress",
      label: "Avancement de Projets",
      description: "Consultation de l'avancement des projets",
      embedUrl: "https://airtable.com/embed/projects",
      directUrl: "https://airtable.com/projects",
      icon: "projects",
      enabled: true,
      kind: "standard",
      order: 20
    }
  ],
  personalViews: [
    {
      id: "employee-personal-1",
      label: "Employé 1",
      description: "Vue personnelle",
      embedUrl: "",
      directUrl: "",
      icon: "personal",
      enabled: true,
      kind: "personal",
      order: 10
    }
  ]
};

const adminSnapshot = {
  users: [
    {
      ...admin,
      active: true,
      roleIds: [1]
    }
  ],
  roles: [{ id: 1, name: "Dashboard Admin", description: "Full access" }],
  resources: resources.resources.map((resource) => ({ ...resource, roleIds: [1] }))
};

afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status: init.status ?? 200,
      headers: { "Content-Type": "application/json" }
    })
  );
}

function mockApi({
  currentUser = user,
  dashboardResources = resources
}: {
  currentUser?: typeof user | null;
  dashboardResources?: DashboardResourcesResponse;
} = {}) {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL, options?: RequestInit) => {
      const url = String(input);

      if (url === "api/auth/me") {
        return currentUser
          ? jsonResponse({ user: currentUser })
          : jsonResponse({ error: "Authentication required." }, { status: 401 });
      }

      if (url === "api/dashboard/resources") {
        return jsonResponse(dashboardResources);
      }

      if (url === "api/auth/login" && options?.method === "POST") {
        return jsonResponse({ user });
      }

      if (url === "api/admin/users" && !options?.method) {
        return jsonResponse({ users: adminSnapshot.users });
      }

      if (url === "api/admin/users" && options?.method === "POST") {
        return jsonResponse({
          users: [
            ...adminSnapshot.users,
            {
              id: 2,
              email: "new.employee@example.com",
              displayName: "New Employee",
              isAdmin: false,
              mustChangePassword: true,
              active: true,
              roleIds: []
            }
          ]
        });
      }

      if (url === "api/admin/roles") {
        return jsonResponse({ roles: adminSnapshot.roles });
      }

      if (url === "api/admin/resources") {
        return jsonResponse({ resources: adminSnapshot.resources, roles: adminSnapshot.roles });
      }

      return jsonResponse({ error: "Unexpected request: " + url }, { status: 500 });
    })
  );
}

describe("Employee dashboard", () => {
  it("shows the login screen when unauthenticated", async () => {
    mockApi({ currentUser: null });

    render(<App />);

    expect(await screen.findByRole("button", { name: "Se connecter" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Opérations interne" })).toBeInTheDocument();
  });

  it("renders only resources returned by the API", async () => {
    mockApi({
      dashboardResources: {
        resources: [resources.resources[0]],
        personalViews: []
      }
    });

    render(<App />);

    expect(await screen.findByRole("button", { name: "Tâches Opérationnels" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.queryByRole("button", { name: "Avancement de Projets" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Vue personnelle" })).not.toBeInTheDocument();
  });

  it("hides the admin button for regular employees", async () => {
    mockApi();

    render(<App />);

    await screen.findByRole("button", { name: "Tâches Opérationnels" });

    expect(screen.queryByRole("button", { name: "Admin" })).not.toBeInTheDocument();
  });

  it("blocks the dashboard until a required password change is completed", async () => {
    mockApi({
      currentUser: {
        ...user,
        mustChangePassword: true
      }
    });

    render(<App />);

    expect(await screen.findByRole("heading", { name: "Nouveau mot de passe" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tâches Opérationnels" })).not.toBeInTheDocument();
  });

  it("keeps visited Airtable views mounted while switching the active one", async () => {
    const testUser = userEvent.setup();
    mockApi({ currentUser: admin });

    render(<App />);

    await testUser.click(await screen.findByRole("button", { name: "Avancement de Projets" }));

    const firstFrame = screen.getByTitle("Tâches Opérationnels Airtable read-only view");
    const secondFrame = screen.getByTitle("Avancement de Projets Airtable read-only view");

    expect(firstFrame).toHaveAttribute("src", resources.resources[0].embedUrl);
    expect(secondFrame).toHaveAttribute("src", resources.resources[1].embedUrl);
    expect(firstFrame.closest(".cached-view")).toHaveAttribute("data-active", "false");
    expect(secondFrame.closest(".cached-view")).toHaveAttribute("data-active", "true");

    await testUser.click(screen.getByRole("button", { name: "Tâches Opérationnels" }));

    await waitFor(() => {
      expect(firstFrame.closest(".cached-view")).toHaveAttribute("data-active", "true");
      expect(secondFrame.closest(".cached-view")).toHaveAttribute("data-active", "false");
    });
  });

  it("creates user access with visible success feedback", async () => {
    const testUser = userEvent.setup();
    mockApi({ currentUser: admin });

    render(<App />);

    await testUser.click(await screen.findByRole("button", { name: "Admin" }));
    await screen.findByRole("heading", { name: "Créer un accès" });

    await testUser.type(screen.getByPlaceholderText("Courriel"), "new.employee@example.com");
    await testUser.type(screen.getByPlaceholderText("Nom affiché"), "New Employee");
    await testUser.type(screen.getByPlaceholderText("Mot de passe temporaire"), "Temporary123!");
    await testUser.click(screen.getByRole("button", { name: "Créer" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Accès créé pour New Employee.");
  });
});

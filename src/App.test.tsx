import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
    },
    {
      id: 2,
      email: "old.employee@example.com",
      displayName: "Old Employee",
      isAdmin: false,
      mustChangePassword: false,
      active: true,
      roleIds: []
    }
  ],
  roles: [{ id: 1, name: "Dashboard Admin", description: "Full access" }],
  resources: resources.resources.map((resource) => ({ ...resource, roleIds: [1], userIds: [1] }))
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
  let adminUsers = [...adminSnapshot.users];

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
        return jsonResponse({ users: adminUsers });
      }

      if (url === "api/admin/users" && options?.method === "POST") {
        adminUsers = [
          ...adminUsers,
          {
            id: 3,
            email: "new.employee@example.com",
            displayName: "New Employee",
            isAdmin: false,
            mustChangePassword: true,
            active: true,
            roleIds: []
          }
        ];

        return jsonResponse({
          users: adminUsers
        });
      }

      if (url.startsWith("api/admin/users/") && options?.method === "DELETE") {
        const userId = Number(url.split("/").at(-1));
        adminUsers = adminUsers.filter((adminUser) => adminUser.id !== userId);
        return jsonResponse({
          users: adminUsers
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

  it("renders the dashboard shell while resources load in the background", async () => {
    let resolveResources: (response: Response) => void = () => undefined;
    const resourcesRequest = new Promise<Response>((resolve) => {
      resolveResources = resolve;
    });

    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);

        if (url === "api/auth/me") {
          return jsonResponse({ user });
        }

        if (url === "api/dashboard/resources") {
          return resourcesRequest;
        }

        return jsonResponse({ error: "Unexpected request: " + url }, { status: 500 });
      })
    );

    render(<App />);

    expect(await screen.findByText("Chargement des vues...")).toBeInTheDocument();
    expect(document.querySelector(".loading-spinner")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Employee" })).toBeInTheDocument();

    resolveResources(
      new Response(JSON.stringify(resources), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );

    expect(await screen.findByRole("button", { name: "Avancement de Projets" })).toBeInTheDocument();
  });

  it("prioritizes the landing view before preloading background Airtable views", async () => {
    const testUser = userEvent.setup();
    mockApi({ currentUser: admin });

    render(<App />);

    await screen.findByRole("button", { name: "Avancement de Projets" });

    const firstFrame = screen.getByTitle("Tâches Opérationnels Airtable read-only view");

    expect(firstFrame).toHaveAttribute("src", resources.resources[0].embedUrl);
    expect(firstFrame).not.toHaveAttribute("loading", "lazy");
    expect(screen.getByText("Chargement Airtable...")).toBeInTheDocument();
    fireEvent.load(firstFrame);
    await waitFor(
      () => {
        expect(screen.queryByText("Chargement Airtable...")).not.toBeInTheDocument();
      },
      { timeout: 500 }
    );
    expect(screen.queryByTitle("Avancement de Projets Airtable read-only view")).not.toBeInTheDocument();

    const secondFrame = await screen.findByTitle("Avancement de Projets Airtable read-only view", {}, {
      timeout: 2000
    });

    expect(secondFrame).toHaveAttribute("src", resources.resources[1].embedUrl);
    expect(secondFrame).not.toHaveAttribute("loading", "lazy");
    expect(firstFrame.closest(".cached-view")).toHaveAttribute("data-active", "true");
    expect(secondFrame.closest(".cached-view")).toHaveAttribute("data-active", "false");

    await testUser.click(screen.getByRole("button", { name: "Avancement de Projets" }));

    await waitFor(() => {
      expect(firstFrame.closest(".cached-view")).toHaveAttribute("data-active", "false");
      expect(secondFrame.closest(".cached-view")).toHaveAttribute("data-active", "true");
    });
  });

  it("renders Simon's personal view as a preloaded split frame", async () => {
    const testUser = userEvent.setup();
    mockApi({
      dashboardResources: {
        ...resources,
        personalViews: [
          {
            id: "employee-personal-2",
            label: "Simon",
            description: "Vue personnelle",
            embedUrl: "https://airtable.com/embed/simon-right",
            directUrl: "https://airtable.com/simon-right",
            secondaryEmbedUrl: "https://airtable.com/embed/simon-left",
            secondaryDirectUrl: "https://airtable.com/simon-left",
            icon: "personal",
            enabled: true,
            kind: "personal",
            order: 20
          }
        ]
      }
    });

    render(<App />);

    await testUser.click(await screen.findByRole("button", { name: "Vue personnelle" }));

    const leftFrame = screen.getByTitle("Simon Airtable kanban view");
    const rightFrame = screen.getByTitle("Simon Airtable personal view");

    expect(leftFrame).toHaveAttribute("src", "https://airtable.com/embed/simon-left");
    expect(rightFrame).toHaveAttribute("src", "https://airtable.com/embed/simon-right");
    expect(leftFrame.closest(".cached-view")).toHaveClass("cached-view--split");
    expect(leftFrame.closest(".cached-view")?.querySelector(".split-divider")).toBeInTheDocument();
    expect(rightFrame.closest(".cached-view")).toHaveAttribute("data-active", "true");
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

  it("deletes user access with confirmation and visible feedback", async () => {
    const testUser = userEvent.setup();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    mockApi({ currentUser: admin });

    render(<App />);

    await testUser.click(await screen.findByRole("button", { name: "Admin" }));
    await screen.findByRole("heading", { name: "Old Employee" });
    await testUser.click(screen.getAllByRole("button", { name: "Supprimer" })[1]);

    expect(confirmSpy).toHaveBeenCalledWith("Supprimer l'accès de Old Employee?");
    expect(await screen.findByRole("status")).toHaveTextContent("Accès supprimé pour Old Employee.");
  });
});

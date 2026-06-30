import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Box,
  FileText,
  Folder,
  LogOut,
  Settings,
  ShieldCheck,
  UserRound,
  UsersRound
} from "lucide-react";
import {
  DashboardIcon,
  DashboardResource,
  DashboardResourcesResponse,
  isPlaceholderUrl
} from "./resources";

type CurrentUser = {
  id: number;
  email: string;
  displayName: string;
  isAdmin: boolean;
  mustChangePassword: boolean;
};

type AuthState =
  | { status: "loading" }
  | { status: "anonymous" }
  | { status: "authenticated"; user: CurrentUser };

type AdminRole = {
  id: number;
  name: string;
  description: string;
};

type AdminUser = CurrentUser & {
  active: boolean;
  roleIds: number[];
};

type AdminResource = DashboardResource & {
  roleIds: number[];
  userIds: number[];
};

type AdminSnapshot = {
  users: AdminUser[];
  roles: AdminRole[];
  resources: AdminResource[];
};

const personalGroupId = "personal-views";
const icons: Record<DashboardIcon, typeof Folder> = {
  tasks: FileText,
  projects: Folder,
  personal: UserRound,
  clients: UsersRound,
  inventory: Box,
  forms: FileText,
  procedures: ShieldCheck,
  reports: BarChart3
};

async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`api/${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers
    }
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "Request failed.");
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

function ResourceTab({
  resource,
  selected,
  onSelect,
  variant = "primary"
}: {
  resource: DashboardResource;
  selected: boolean;
  onSelect: (resource: DashboardResource) => void;
  variant?: "primary" | "sub";
}) {
  const Icon = icons[resource.icon];

  return (
    <button
      type="button"
      className={`resource-tab resource-tab--${variant}`}
      data-selected={selected}
      disabled={!resource.enabled}
      aria-pressed={selected}
      onClick={() => onSelect(resource)}
    >
      <Icon aria-hidden="true" size={20} strokeWidth={1.8} />
      <span>{resource.label}</span>
    </button>
  );
}

function ConsultationPanel({
  activeResource,
  cachedResources
}: {
  activeResource?: DashboardResource;
  cachedResources: DashboardResource[];
}) {
  if (!activeResource) {
    return (
      <main className="content-panel">
        <section className="empty-embed" aria-live="polite">
          <div>
            <p className="empty-kicker">Accès</p>
            <h2>Aucune ressource disponible</h2>
            <p>Aucune vue Airtable n'est assignée à votre compte pour le moment.</p>
          </div>
        </section>
      </main>
    );
  }

  const activeResourceNeedsConfiguration = isPlaceholderUrl(activeResource.embedUrl);

  return (
    <main className="content-panel">
      <div className="embed-shell">
        {cachedResources.map((resource) => {
          const isActive = resource.id === activeResource.id;
          const iframeTitle = `${resource.label} Airtable read-only view`;

          return (
            <div
              key={resource.id}
              className="cached-view"
              data-active={isActive}
              aria-hidden={!isActive}
            >
              <iframe
                src={resource.embedUrl}
                title={iframeTitle}
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          );
        })}

        {activeResourceNeedsConfiguration ? (
          <section className="empty-embed" aria-live="polite">
            <div>
              <p className="empty-kicker">Vue personnelle</p>
              <h2>{activeResource.label}</h2>
              <p>
                Cette vue est prête à recevoir un lien Airtable. Ajoutez son URL dans la
                configuration quand elle sera disponible.
              </p>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}

function LoginScreen({ onLogin }: { onLogin: (user: CurrentUser) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const result = await api<{ user: CurrentUser }>("auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
      onLogin(result.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-screen">
      <form className="auth-card" onSubmit={handleSubmit}>
        <img className="auth-logo" src="./logo-cq-horizontal.jpg" alt="Carbone Québec" />
        <h1>Opérations interne</h1>
        <p>Connectez-vous pour accéder aux vues internes.</p>
        <label>
          Courriel
          <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" />
        </label>
        <label>
          Mot de passe
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
          />
        </label>
        {error ? <p className="form-error">{error}</p> : null}
        <button type="submit" disabled={submitting}>
          {submitting ? "Connexion..." : "Se connecter"}
        </button>
      </form>
    </main>
  );
}

function ChangePasswordScreen({
  onChanged
}: {
  onChanged: (user: CurrentUser) => void;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");

    try {
      const result = await api<{ user: CurrentUser }>("auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword })
      });
      onChanged(result.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Password change failed.");
    }
  }

  return (
    <main className="auth-screen">
      <form className="auth-card" onSubmit={handleSubmit}>
        <img className="auth-logo" src="./logo-cq-horizontal.jpg" alt="Carbone Québec" />
        <h1>Nouveau mot de passe</h1>
        <p>Votre mot de passe temporaire doit être remplacé avant d'ouvrir le dashboard.</p>
        <label>
          Mot de passe actuel
          <input
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            type="password"
          />
        </label>
        <label>
          Nouveau mot de passe
          <input
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            type="password"
          />
        </label>
        {error ? <p className="form-error">{error}</p> : null}
        <button type="submit">Enregistrer</button>
      </form>
    </main>
  );
}

function Dashboard({
  user,
  onUserChange,
  onLogout
}: {
  user: CurrentUser;
  onUserChange: (user: CurrentUser) => void;
  onLogout: () => void;
}) {
  const [resources, setResources] = useState<DashboardResourcesResponse | null>(null);
  const [loadingResources, setLoadingResources] = useState(true);
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null);
  const [selectedPersonalViewId, setSelectedPersonalViewId] = useState<string | null>(null);
  const [showAdmin, setShowAdmin] = useState(false);

  useEffect(() => {
    let ignore = false;
    setLoadingResources(true);
    api<DashboardResourcesResponse>("dashboard/resources")
      .then((result) => {
        if (ignore) return;
        setResources(result);
        const firstResource = result.resources[0] ?? null;
        const firstPersonalView = result.personalViews[0] ?? null;
        setSelectedResourceId((current) => current ?? firstResource?.id ?? null);
        setSelectedPersonalViewId((current) => current ?? firstPersonalView?.id ?? null);
      })
      .finally(() => {
        if (!ignore) setLoadingResources(false);
      });

    return () => {
      ignore = true;
    };
  }, []);

  const topResources = resources?.resources ?? [];
  const personalViews = resources?.personalViews ?? [];
  const selectedTopResource =
    topResources.find((resource) => resource.id === selectedResourceId) ?? topResources[0];
  const selectedPersonalView =
    personalViews.find((resource) => resource.id === selectedPersonalViewId) ?? personalViews[0];
  const isPersonalSection = selectedResourceId === personalGroupId;
  const activeResource = isPersonalSection ? selectedPersonalView : selectedTopResource;
  const topTabs = useMemo(() => {
    const personalGroup: DashboardResource | null =
      personalViews.length > 0
        ? {
            id: personalGroupId,
            label: "Vue personnelle",
            description: "Vues personnelles des employés",
            embedUrl: "",
            directUrl: "",
            icon: "personal",
            enabled: true,
            kind: "standard",
            order: 999
          }
        : null;

    return personalGroup ? [...topResources, personalGroup] : topResources;
  }, [personalViews.length, topResources]);
  const cachedResources = [
    ...topResources.filter((resource) => !isPlaceholderUrl(resource.embedUrl)),
    ...personalViews.filter((resource) => !isPlaceholderUrl(resource.embedUrl))
  ];

  function handleResourceSelect(resource: DashboardResource) {
    setSelectedResourceId(resource.id);
  }

  function handlePersonalViewSelect(resource: DashboardResource) {
    setSelectedPersonalViewId(resource.id);
  }

  async function handleLogout() {
    await api<void>("auth/logout", { method: "POST" }).catch(() => undefined);
    onLogout();
  }

  if (loadingResources) {
    return <main className="loading-screen">Chargement...</main>;
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <img className="brand-logo" src="./logo-cq-horizontal.jpg" alt="Carbone Québec" />
          <h1>Opérations interne</h1>
        </div>

        {!showAdmin ? (
          <nav className="resource-nav" aria-label="Airtable resources">
            {topTabs.map((resource) => (
              <ResourceTab
                key={resource.id}
                resource={resource}
                selected={resource.id === selectedResourceId}
                onSelect={handleResourceSelect}
              />
            ))}
          </nav>
        ) : (
          <div className="resource-nav admin-title">Administration</div>
        )}

        <nav className="utility-nav" aria-label="Dashboard utilities">
          {user.isAdmin ? (
            <button type="button" onClick={() => setShowAdmin((current) => !current)}>
              <Settings aria-hidden="true" size={19} />
              {showAdmin ? "Dashboard" : "Admin"}
            </button>
          ) : null}
          <button type="button">
            <UserRound aria-hidden="true" size={19} />
            {user.displayName}
          </button>
          <button type="button" onClick={handleLogout}>
            <LogOut aria-hidden="true" size={19} />
            Sortir
          </button>
        </nav>
      </header>

      {showAdmin ? (
        <AdminPanel onUserChange={onUserChange} />
      ) : (
        <>
          {isPersonalSection ? (
            <nav className="employee-nav" aria-label="Employee personal views">
              {personalViews.map((resource) => (
                <ResourceTab
                  key={resource.id}
                  resource={resource}
                  selected={resource.id === selectedPersonalView?.id}
                  onSelect={handlePersonalViewSelect}
                  variant="sub"
                />
              ))}
            </nav>
          ) : null}

          <ConsultationPanel activeResource={activeResource} cachedResources={cachedResources} />
        </>
      )}
    </div>
  );
}

function AdminPanel({ onUserChange }: { onUserChange: (user: CurrentUser) => void }) {
  const [snapshot, setSnapshot] = useState<AdminSnapshot | null>(null);
  const [userForm, setUserForm] = useState({
    email: "",
    displayName: "",
    temporaryPassword: "",
    isAdmin: false
  });
  const [roleForm, setRoleForm] = useState({ name: "", description: "" });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [creatingUser, setCreatingUser] = useState(false);
  const [creatingRole, setCreatingRole] = useState(false);

  async function refresh() {
    const [usersResult, rolesResult, resourcesResult] = await Promise.all([
      api<{ users: AdminUser[] }>("admin/users"),
      api<{ roles: AdminRole[] }>("admin/roles"),
      api<{ resources: AdminResource[]; roles: AdminRole[] }>("admin/resources")
    ]);
    setSnapshot({
      users: usersResult.users,
      roles: rolesResult.roles,
      resources: resourcesResult.resources
    });
  }

  useEffect(() => {
    refresh().catch((err) => setError(err instanceof Error ? err.message : "Admin load failed."));
  }, []);

  async function createUser(event: FormEvent) {
    event.preventDefault();
    setError("");
    setNotice("");

    if (userForm.temporaryPassword.length < 10) {
      setError("Le mot de passe temporaire doit contenir au moins 10 caractères.");
      return;
    }

    setCreatingUser(true);

    try {
      await api("admin/users", {
        method: "POST",
        body: JSON.stringify({ ...userForm, roleIds: [] })
      });
      setUserForm({ email: "", displayName: "", temporaryPassword: "", isAdmin: false });
      await refresh();
      setNotice(`Accès créé pour ${userForm.displayName || userForm.email}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "La création de l'accès a échoué.");
    } finally {
      setCreatingUser(false);
    }
  }

  async function createRole(event: FormEvent) {
    event.preventDefault();
    setError("");
    setNotice("");
    setCreatingRole(true);

    try {
      await api("admin/roles", {
        method: "POST",
        body: JSON.stringify(roleForm)
      });
      setRoleForm({ name: "", description: "" });
      await refresh();
      setNotice(`Rôle ${roleForm.name} ajouté.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "La création du rôle a échoué.");
    } finally {
      setCreatingRole(false);
    }
  }

  async function updateUser(user: AdminUser, patch: Partial<AdminUser>) {
    setError("");
    setNotice("");

    try {
      await api("admin/users/" + user.id, {
        method: "PATCH",
        body: JSON.stringify({
          displayName: patch.displayName,
          active: patch.active,
          mustChangePassword: patch.mustChangePassword,
          isAdmin: patch.isAdmin,
          roleIds: patch.roleIds
        })
      });
      await refresh();
      const me = await api<{ user: CurrentUser }>("auth/me");
      onUserChange(me.user);
      setNotice(`Utilisateur ${user.displayName} mis à jour.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "La mise à jour de l'utilisateur a échoué.");
    }
  }

  async function updateResourceAccess(
    resource: AdminResource,
    patch: { roleIds?: number[]; userIds?: number[] }
  ) {
    setError("");
    setNotice("");

    try {
      await api("admin/permissions", {
        method: "POST",
        body: JSON.stringify({
          resourceId: resource.id,
          roleIds: patch.roleIds ?? resource.roleIds,
          userIds: patch.userIds ?? resource.userIds
        })
      });
      await refresh();
      setNotice(`Accès mis à jour pour ${resource.label}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "La mise à jour des accès a échoué.");
    }
  }

  if (!snapshot) {
    return <main className="admin-panel">Chargement de l'administration...</main>;
  }

  return (
    <main className="admin-panel">
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="form-success" role="status">
          {notice}
        </p>
      ) : null}

      <section>
        <h2>Créer un accès</h2>
        <form className="admin-form" onSubmit={createUser}>
          <input
            placeholder="Courriel"
            type="email"
            required
            value={userForm.email}
            onChange={(event) => setUserForm({ ...userForm, email: event.target.value })}
          />
          <input
            placeholder="Nom affiché"
            required
            value={userForm.displayName}
            onChange={(event) => setUserForm({ ...userForm, displayName: event.target.value })}
          />
          <input
            placeholder="Mot de passe temporaire"
            type="password"
            required
            minLength={10}
            value={userForm.temporaryPassword}
            onChange={(event) =>
              setUserForm({ ...userForm, temporaryPassword: event.target.value })
            }
          />
          <label className="check-label">
            <input
              type="checkbox"
              checked={userForm.isAdmin}
              onChange={(event) => setUserForm({ ...userForm, isAdmin: event.target.checked })}
            />
            Admin
          </label>
          <button type="submit" disabled={creatingUser}>
            {creatingUser ? "Création..." : "Créer"}
          </button>
        </form>
      </section>

      <section>
        <h2>Rôles</h2>
        <form className="admin-form" onSubmit={createRole}>
          <input
            placeholder="Nom du rôle"
            required
            value={roleForm.name}
            onChange={(event) => setRoleForm({ ...roleForm, name: event.target.value })}
          />
          <input
            placeholder="Description"
            value={roleForm.description}
            onChange={(event) => setRoleForm({ ...roleForm, description: event.target.value })}
          />
          <button type="submit" disabled={creatingRole}>
            {creatingRole ? "Ajout..." : "Ajouter"}
          </button>
        </form>
        <div className="admin-grid">
          {snapshot.roles.map((role) => (
            <article key={role.id} className="admin-card">
              <h3>{role.name}</h3>
              <p>{role.description || "Aucune description"}</p>
            </article>
          ))}
        </div>
      </section>

      <section>
        <h2>Utilisateurs</h2>
        <div className="admin-list">
          {snapshot.users.map((adminUser) => (
            <article key={adminUser.id} className="admin-card">
              <div>
                <h3>{adminUser.displayName}</h3>
                <p>{adminUser.email}</p>
              </div>
              <div className="admin-card-actions">
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={adminUser.active}
                    onChange={(event) => updateUser(adminUser, { active: event.target.checked })}
                  />
                  Actif
                </label>
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={adminUser.isAdmin}
                    onChange={(event) => updateUser(adminUser, { isAdmin: event.target.checked })}
                  />
                  Admin
                </label>
                <button
                  type="button"
                  onClick={() => updateUser(adminUser, { mustChangePassword: true })}
                >
                  Forcer reset
                </button>
              </div>
              <div className="checkbox-row">
                {snapshot.roles.map((role) => {
                  const checked = adminUser.roleIds.includes(role.id);
                  const nextRoleIds = checked
                    ? adminUser.roleIds.filter((roleId) => roleId !== role.id)
                    : [...adminUser.roleIds, role.id];

                  return (
                    <label key={role.id} className="check-label">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => updateUser(adminUser, { roleIds: nextRoleIds })}
                      />
                      {role.name}
                    </label>
                  );
                })}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section>
        <h2>Accès aux ressources</h2>
        <div className="admin-list">
          {snapshot.resources.map((resource) => (
            <article key={resource.id} className="admin-card">
              <div>
                <h3>{resource.label}</h3>
                <p>{resource.kind === "personal" ? "Vue personnelle" : "Vue principale"}</p>
              </div>
              <p className="access-group-title">Rôles autorisés</p>
              <div className="checkbox-row">
                {snapshot.roles.map((role) => {
                  const checked = resource.roleIds.includes(role.id);
                  const nextRoleIds = checked
                    ? resource.roleIds.filter((roleId) => roleId !== role.id)
                    : [...resource.roleIds, role.id];

                  return (
                    <label key={role.id} className="check-label">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => updateResourceAccess(resource, { roleIds: nextRoleIds })}
                      />
                      {role.name}
                    </label>
                  );
                })}
              </div>
              <p className="access-group-title">Utilisateurs autorisés</p>
              <div className="checkbox-row">
                {snapshot.users.map((userAccess) => {
                  const checked = resource.userIds.includes(userAccess.id);
                  const nextUserIds = checked
                    ? resource.userIds.filter((userId) => userId !== userAccess.id)
                    : [...resource.userIds, userAccess.id];

                  return (
                    <label key={userAccess.id} className="check-label">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => updateResourceAccess(resource, { userIds: nextUserIds })}
                      />
                      {userAccess.displayName}
                    </label>
                  );
                })}
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

export default function App() {
  const [authState, setAuthState] = useState<AuthState>({ status: "loading" });

  useEffect(() => {
    api<{ user: CurrentUser }>("auth/me")
      .then((result) => setAuthState({ status: "authenticated", user: result.user }))
      .catch(() => setAuthState({ status: "anonymous" }));
  }, []);

  if (authState.status === "loading") {
    return <main className="loading-screen">Chargement...</main>;
  }

  if (authState.status === "anonymous") {
    return <LoginScreen onLogin={(user) => setAuthState({ status: "authenticated", user })} />;
  }

  if (authState.user.mustChangePassword) {
    return (
      <ChangePasswordScreen
        onChanged={(user) => setAuthState({ status: "authenticated", user })}
      />
    );
  }

  return (
    <Dashboard
      user={authState.user}
      onUserChange={(user) => setAuthState({ status: "authenticated", user })}
      onLogout={() => setAuthState({ status: "anonymous" })}
    />
  );
}

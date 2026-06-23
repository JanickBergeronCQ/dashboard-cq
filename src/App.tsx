import { useMemo, useState } from "react";
import {
  BarChart3,
  Box,
  FileText,
  Folder,
  ShieldCheck,
  UserRound,
  UsersRound
} from "lucide-react";
import {
  DashboardIcon,
  DashboardResource,
  dashboardResources,
  employeePersonalViews,
  isPlaceholderUrl
} from "./resources";

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

function addUniqueId(ids: string[], id: string) {
  return ids.includes(id) ? ids : [...ids, id];
}

function ConsultationPanel({
  activeResource,
  cachedResources
}: {
  activeResource: DashboardResource;
  cachedResources: DashboardResource[];
}) {
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
                loading="lazy"
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

export default function App() {
  const firstEnabledResource = useMemo(
    () => dashboardResources.find((resource) => resource.enabled) ?? dashboardResources[0],
    []
  );
  const [selectedResource, setSelectedResource] = useState(firstEnabledResource);
  const firstEnabledPersonalView =
    employeePersonalViews.find((resource) => resource.enabled) ?? employeePersonalViews[0];
  const [selectedPersonalView, setSelectedPersonalView] = useState(firstEnabledPersonalView);
  const [visitedResourceIds, setVisitedResourceIds] = useState([firstEnabledResource.id]);
  const [visitedPersonalViewIds, setVisitedPersonalViewIds] = useState([
    firstEnabledPersonalView.id
  ]);
  const isPersonalSection = selectedResource.id === "personal-views";
  const activeResource = isPersonalSection ? selectedPersonalView : selectedResource;
  const cachedResources = [
    ...dashboardResources.filter(
      (resource) =>
        resource.id !== "personal-views" &&
        visitedResourceIds.includes(resource.id) &&
        !isPlaceholderUrl(resource.embedUrl)
    ),
    ...employeePersonalViews.filter(
      (resource) =>
        visitedPersonalViewIds.includes(resource.id) && !isPlaceholderUrl(resource.embedUrl)
    )
  ];

  function handleResourceSelect(resource: DashboardResource) {
    setSelectedResource(resource);
    setVisitedResourceIds((currentIds) => addUniqueId(currentIds, resource.id));

    if (resource.id === "personal-views") {
      setVisitedPersonalViewIds((currentIds) => addUniqueId(currentIds, selectedPersonalView.id));
    }
  }

  function handlePersonalViewSelect(resource: DashboardResource) {
    setSelectedPersonalView(resource);
    setVisitedPersonalViewIds((currentIds) => addUniqueId(currentIds, resource.id));
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <img className="brand-logo" src="./logo-cq-horizontal.jpg" alt="Carbone Québec" />
          <h1>Opérations interne</h1>
        </div>
        <nav className="resource-nav" aria-label="Airtable resources">
          {dashboardResources.map((resource) => (
            <ResourceTab
              key={resource.id}
              resource={resource}
              selected={resource.id === selectedResource.id}
              onSelect={handleResourceSelect}
            />
          ))}
        </nav>
        <nav className="utility-nav" aria-label="Dashboard utilities">
          <button type="button">
            <UserRound aria-hidden="true" size={19} />
            Employee
          </button>
        </nav>
      </header>

      {isPersonalSection ? (
        <nav className="employee-nav" aria-label="Employee personal views">
          {employeePersonalViews.map((resource) => (
            <ResourceTab
              key={resource.id}
              resource={resource}
              selected={resource.id === selectedPersonalView.id}
              onSelect={handlePersonalViewSelect}
              variant="sub"
            />
          ))}
        </nav>
      ) : null}

      <ConsultationPanel activeResource={activeResource} cachedResources={cachedResources} />
    </div>
  );
}

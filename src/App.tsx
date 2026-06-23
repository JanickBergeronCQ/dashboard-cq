import { useMemo, useState } from "react";
import {
  BarChart3,
  Box,
  FileText,
  Folder,
  HelpCircle,
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

function ConsultationPanel({ resource }: { resource: DashboardResource }) {
  const iframeTitle = `${resource.label} Airtable read-only view`;

  return (
    <main className="content-panel">
      <div className="embed-shell">
        {isPlaceholderUrl(resource.embedUrl) ? (
          <section className="empty-embed" aria-live="polite">
            <div>
              <p className="empty-kicker">Vue personnelle</p>
              <h2>{resource.label}</h2>
              <p>
                Cette vue est prête à recevoir un lien Airtable. Ajoutez son URL dans la
                configuration quand elle sera disponible.
              </p>
            </div>
          </section>
        ) : (
          <iframe
            src={resource.embedUrl}
            title={iframeTitle}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        )}
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
  const [selectedPersonalView, setSelectedPersonalView] = useState(
    employeePersonalViews.find((resource) => resource.enabled) ?? employeePersonalViews[0]
  );
  const isPersonalSection = selectedResource.id === "personal-views";
  const activeResource = isPersonalSection ? selectedPersonalView : selectedResource;

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <img className="brand-logo" src="./logo-cqf.png" alt="Carbone Québec" />
          <h1>CQ Employee Dashboard</h1>
        </div>
        <nav className="resource-nav" aria-label="Airtable resources">
          {dashboardResources.map((resource) => (
            <ResourceTab
              key={resource.id}
              resource={resource}
              selected={resource.id === selectedResource.id}
              onSelect={setSelectedResource}
            />
          ))}
        </nav>
        <nav className="utility-nav" aria-label="Dashboard utilities">
          <a href="mailto:it-support@example.com">
            <HelpCircle aria-hidden="true" size={19} />
            Help
          </a>
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
              onSelect={setSelectedPersonalView}
              variant="sub"
            />
          ))}
        </nav>
      ) : null}

      <ConsultationPanel resource={activeResource} />
    </div>
  );
}

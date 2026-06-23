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
import { DashboardIcon, DashboardResource, dashboardResources } from "./resources";

const icons: Record<DashboardIcon, typeof Folder> = {
  tasks: FileText,
  projects: Folder,
  clients: UsersRound,
  inventory: Box,
  forms: FileText,
  procedures: ShieldCheck,
  reports: BarChart3
};

function ResourceTab({
  resource,
  selected,
  onSelect
}: {
  resource: DashboardResource;
  selected: boolean;
  onSelect: (resource: DashboardResource) => void;
}) {
  const Icon = icons[resource.icon];

  return (
    <button
      type="button"
      className="resource-tab"
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
        <iframe
          src={resource.embedUrl}
          title={iframeTitle}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
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

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            CQ
          </span>
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

      <ConsultationPanel resource={selectedResource} />
    </div>
  );
}

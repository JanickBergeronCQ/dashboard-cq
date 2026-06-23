import { useMemo, useState } from "react";
import {
  BarChart3,
  Box,
  ExternalLink,
  FileText,
  Folder,
  HelpCircle,
  Maximize2,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
  UsersRound
} from "lucide-react";
import {
  DashboardIcon,
  DashboardResource,
  dashboardResources,
  isPlaceholderUrl
} from "./resources";

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
      <Icon aria-hidden="true" size={24} strokeWidth={1.8} />
      <span>{resource.label}</span>
    </button>
  );
}

function EmbedFallback({ resource }: { resource: DashboardResource }) {
  const configured = !isPlaceholderUrl(resource.embedUrl);

  return (
    <section className="embed-fallback" aria-label="Embedded content fallback">
      <div className="fallback-icon" aria-hidden="true">
        <FileText size={34} strokeWidth={1.6} />
      </div>
      <div>
        <h3>
          {configured
            ? "Unable to display embedded content?"
            : "Airtable URL not configured yet"}
        </h3>
        <p>
          {configured
            ? "If the embedded view is blocked by browser, network, or Airtable settings, open the read-only view directly."
            : "Replace the placeholder URLs in src/resources.ts with your Airtable shared view URLs."}
        </p>
        <div className="fallback-actions">
          <button type="button">
            <RefreshCw aria-hidden="true" size={16} />
            Try Again
          </button>
          <a href={resource.directUrl} target="_blank" rel="noreferrer">
            Open in Airtable
            <ExternalLink aria-hidden="true" size={15} />
          </a>
        </div>
      </div>
    </section>
  );
}

function ConsultationPanel({ resource }: { resource: DashboardResource }) {
  const iframeTitle = `${resource.label} Airtable read-only view`;
  const configured = !isPlaceholderUrl(resource.embedUrl);

  return (
    <main className="content-panel">
      <header className="panel-header">
        <div>
          <h2>{resource.label} Airtable View</h2>
          <p>Read-only consultation</p>
        </div>
        <div className="panel-actions">
          <a href={resource.directUrl} target="_blank" rel="noreferrer">
            <ExternalLink aria-hidden="true" size={18} />
            Open in Airtable
          </a>
          <button type="button" aria-label="Expand embedded view">
            <Maximize2 aria-hidden="true" size={18} />
          </button>
        </div>
      </header>

      <div className="embed-toolbar" aria-label="View controls">
        <div className="toolbar-group">
          <span>View</span>
          <button type="button">All records</button>
        </div>
        <div className="toolbar-group">
          <SlidersHorizontal aria-hidden="true" size={17} />
          <button type="button">Filters</button>
        </div>
        <label className="search-box">
          <Search aria-hidden="true" size={18} />
          <span className="sr-only">Search current view</span>
          <input type="search" placeholder={`Search ${resource.label.toLowerCase()}...`} />
        </label>
      </div>

      <div className="embed-shell">
        {configured ? (
          <iframe
            src={resource.embedUrl}
            title={iframeTitle}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        ) : (
          <div className="placeholder-preview" role="img" aria-label="Airtable table preview">
            <div className="preview-row preview-heading">
              <span>Record Name</span>
              <span>Owner</span>
              <span>Status</span>
              <span>Last Updated</span>
            </div>
            {["Active consultation view", "Shared internal reference", "Published read-only table"].map(
              (item, index) => (
                <div className="preview-row" key={item}>
                  <span>{item}</span>
                  <span>{["Operations", "Admin", "Management"][index]}</span>
                  <span>
                    <mark>{["Ready", "Review", "Published"][index]}</mark>
                  </span>
                  <span>Replace URL</span>
                </div>
              )
            )}
          </div>
        )}
      </div>

      <EmbedFallback resource={resource} />
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

      <section className="resource-nav" aria-label="Airtable resources">
        {dashboardResources.map((resource) => (
          <ResourceTab
            key={resource.id}
            resource={resource}
            selected={resource.id === selectedResource.id}
            onSelect={setSelectedResource}
          />
        ))}
      </section>

      <ConsultationPanel resource={selectedResource} />
    </div>
  );
}

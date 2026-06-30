export type DashboardIcon =
  | "tasks"
  | "projects"
  | "personal"
  | "clients"
  | "inventory"
  | "forms"
  | "procedures"
  | "reports";

export type DashboardResourceKind = "standard" | "personal";

export type DashboardResource = {
  id: string;
  label: string;
  description?: string;
  embedUrl: string;
  directUrl: string;
  secondaryEmbedUrl?: string;
  secondaryDirectUrl?: string;
  icon: DashboardIcon;
  enabled: boolean;
  kind: DashboardResourceKind;
  order: number;
};

export type DashboardResourcesResponse = {
  resources: DashboardResource[];
  personalViews: DashboardResource[];
};

export function isPlaceholderUrl(url: string) {
  return !url || url.includes("REPLACE_WITH_SHARED_VIEW_ID");
}

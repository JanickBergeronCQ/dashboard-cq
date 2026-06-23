export type DashboardIcon =
  | "tasks"
  | "projects"
  | "clients"
  | "inventory"
  | "forms"
  | "procedures"
  | "reports";

export type DashboardResource = {
  id: string;
  label: string;
  description?: string;
  embedUrl: string;
  directUrl: string;
  icon: DashboardIcon;
  enabled: boolean;
};

export const dashboardResources: DashboardResource[] = [
  {
    id: "operational-tasks",
    label: "Tâches Opérationnels",
    description: "Suivi des tâches opérationnelles",
    embedUrl:
      "https://airtable.com/embed/appYZtMb3u96lIGpk/shrcaORyqFY29lGl7/tblWOL7fHiQhNtN2U",
    directUrl: "https://airtable.com/appYZtMb3u96lIGpk/shrcaORyqFY29lGl7/tblWOL7fHiQhNtN2U",
    icon: "tasks",
    enabled: true
  },
  {
    id: "project-progress",
    label: "Avancement de Projets",
    description: "Consultation de l'avancement des projets",
    embedUrl:
      "https://airtable.com/embed/appYZtMb3u96lIGpk/shra9klsZPwrQUA47/tbl6j0WsBvlJSXZEb",
    directUrl: "https://airtable.com/appYZtMb3u96lIGpk/shra9klsZPwrQUA47/tbl6j0WsBvlJSXZEb",
    icon: "projects",
    enabled: true
  }
];

export function isPlaceholderUrl(url: string) {
  return url.includes("REPLACE_WITH_SHARED_VIEW_ID");
}

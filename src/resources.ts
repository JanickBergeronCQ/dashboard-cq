export type DashboardIcon =
  | "tasks"
  | "projects"
  | "personal"
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

const pendingPersonalViewUrl = "";

export const employeePersonalViews: DashboardResource[] = [
  {
    id: "employee-personal-1",
    label: "Employé 1",
    description: "Vue personnelle à configurer",
    embedUrl: pendingPersonalViewUrl,
    directUrl: pendingPersonalViewUrl,
    icon: "personal",
    enabled: true
  },
  {
    id: "employee-personal-2",
    label: "Employé 2",
    description: "Vue personnelle à configurer",
    embedUrl: pendingPersonalViewUrl,
    directUrl: pendingPersonalViewUrl,
    icon: "personal",
    enabled: true
  },
  {
    id: "employee-personal-3",
    label: "Employé 3",
    description: "Vue personnelle à configurer",
    embedUrl: pendingPersonalViewUrl,
    directUrl: pendingPersonalViewUrl,
    icon: "personal",
    enabled: true
  },
  {
    id: "employee-personal-4",
    label: "Employé 4",
    description: "Vue personnelle à configurer",
    embedUrl: pendingPersonalViewUrl,
    directUrl: pendingPersonalViewUrl,
    icon: "personal",
    enabled: true
  },
  {
    id: "employee-personal-5",
    label: "Employé 5",
    description: "Vue personnelle à configurer",
    embedUrl: pendingPersonalViewUrl,
    directUrl: pendingPersonalViewUrl,
    icon: "personal",
    enabled: true
  }
];

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
  },
  {
    id: "personal-views",
    label: "Vue personnelle",
    description: "Vues personnelles des employés",
    embedUrl: employeePersonalViews[0]?.embedUrl ?? "",
    directUrl: employeePersonalViews[0]?.directUrl ?? "",
    icon: "personal",
    enabled: true
  }
];

export function isPlaceholderUrl(url: string) {
  return !url || url.includes("REPLACE_WITH_SHARED_VIEW_ID");
}

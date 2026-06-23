import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import App from "./App";
import { dashboardResources, employeePersonalViews } from "./resources";

const standardResources = dashboardResources.filter((resource) => resource.id !== "personal-views");

describe("Employee dashboard", () => {
  it("selects the first Airtable resource by default", () => {
    const firstResource = dashboardResources[0];

    render(<App />);

    expect(screen.getByAltText("Carbone Québec")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Opérations interne" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Help" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: firstResource.label })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByTitle(`${firstResource.label} Airtable read-only view`)).toHaveAttribute(
      "src",
      firstResource.embedUrl
    );
  });

  it("switches resources when header buttons are selected", async () => {
    const user = userEvent.setup();
    render(<App />);

    for (const resource of standardResources.filter((item) => item.enabled)) {
      await user.click(screen.getByRole("button", { name: resource.label }));

      expect(screen.getByRole("button", { name: resource.label })).toHaveAttribute(
        "aria-pressed",
        "true"
      );
      expect(screen.getByTitle(`${resource.label} Airtable read-only view`)).toHaveAttribute(
        "src",
        resource.embedUrl
      );
    }
  });

  it("keeps visited Airtable views mounted while switching the active one", async () => {
    const user = userEvent.setup();
    const [firstResource, secondResource] = dashboardResources;

    render(<App />);

    await user.click(screen.getByRole("button", { name: secondResource.label }));

    const firstFrame = screen.getByTitle(`${firstResource.label} Airtable read-only view`);
    const secondFrame = screen.getByTitle(`${secondResource.label} Airtable read-only view`);

    expect(firstFrame).toHaveAttribute("src", firstResource.embedUrl);
    expect(secondFrame).toHaveAttribute("src", secondResource.embedUrl);
    expect(firstFrame.closest(".cached-view")).toHaveAttribute("data-active", "false");
    expect(secondFrame.closest(".cached-view")).toHaveAttribute("data-active", "true");

    await user.click(screen.getByRole("button", { name: firstResource.label }));

    expect(firstFrame.closest(".cached-view")).toHaveAttribute("data-active", "true");
    expect(secondFrame.closest(".cached-view")).toHaveAttribute("data-active", "false");
  });

  it("shows employee subnavigation when personal views are selected", async () => {
    const user = userEvent.setup();
    const personalTab = dashboardResources.find((resource) => resource.id === "personal-views");
    const thirdEmployee = employeePersonalViews[2];

    render(<App />);

    expect(personalTab).toBeDefined();
    await user.click(screen.getByRole("button", { name: personalTab!.label }));

    for (const resource of employeePersonalViews) {
      expect(screen.getByRole("button", { name: resource.label })).toBeInTheDocument();
    }

    await user.click(screen.getByRole("button", { name: thirdEmployee.label }));

    expect(screen.getByRole("button", { name: thirdEmployee.label })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("heading", { name: thirdEmployee.label })).toBeInTheDocument();
    expect(
      screen.queryByTitle(`${thirdEmployee.label} Airtable read-only view`)
    ).not.toBeInTheDocument();
  });

  it("removes the extra dashboard title, filter, and fallback chrome", () => {
    render(<App />);

    expect(screen.queryByText(/read-only consultation/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/airtable url not configured yet/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
  });
});

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import App from "./App";
import { dashboardResources } from "./resources";

describe("Employee dashboard", () => {
  it("selects the first Airtable resource by default", () => {
    const firstResource = dashboardResources[0];

    render(<App />);

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

    for (const resource of dashboardResources.filter((item) => item.enabled)) {
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

  it("renders only the selected Airtable view iframe", async () => {
    const user = userEvent.setup();
    const [firstResource, secondResource] = dashboardResources;

    render(<App />);

    await user.click(screen.getByRole("button", { name: secondResource.label }));

    expect(
      screen.queryByTitle(`${firstResource.label} Airtable read-only view`)
    ).not.toBeInTheDocument();
    expect(screen.getByTitle(`${secondResource.label} Airtable read-only view`)).toHaveAttribute(
      "src",
      secondResource.embedUrl
    );
  });

  it("removes the extra dashboard title, filter, and fallback chrome", () => {
    render(<App />);

    expect(screen.queryByText(/read-only consultation/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/airtable url not configured yet/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
  });
});

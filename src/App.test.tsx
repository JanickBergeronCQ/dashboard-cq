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
    expect(
      screen.getByRole("heading", { name: `${firstResource.label} Airtable View` })
    ).toBeInTheDocument();
  });

  it("switches resources when tabs are selected", async () => {
    const user = userEvent.setup();
    render(<App />);

    for (const resource of dashboardResources.filter((item) => item.enabled)) {
      await user.click(screen.getByRole("button", { name: resource.label }));

      expect(screen.getByRole("button", { name: resource.label })).toHaveAttribute(
        "aria-pressed",
        "true"
      );
      expect(
        screen.getByRole("heading", { name: `${resource.label} Airtable View` })
      ).toBeInTheDocument();
    }
  });

  it("always renders the configured Airtable direct-open fallback", () => {
    render(<App />);

    const fallbackLinks = screen.getAllByRole("link", { name: /open in airtable/i });
    expect(fallbackLinks.length).toBeGreaterThanOrEqual(1);
    expect(fallbackLinks[0]).toHaveAttribute(
      "href",
      "https://airtable.com/appYZtMb3u96lIGpk/shrcaORyqFY29lGl7/tblWOL7fHiQhNtN2U"
    );
  });

  it("renders configured Airtable embed URLs instead of placeholder guidance", () => {
    render(<App />);

    expect(screen.queryByText(/airtable url not configured yet/i)).not.toBeInTheDocument();
    expect(screen.getByTitle(/tâches opérationnels airtable read-only view/i)).toHaveAttribute(
      "src",
      "https://airtable.com/embed/appYZtMb3u96lIGpk/shrcaORyqFY29lGl7/tblWOL7fHiQhNtN2U"
    );
  });
});

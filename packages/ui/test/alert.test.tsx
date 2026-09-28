import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CircleCheck } from "lucide-react";
import { Alert } from "../src/components/ui/alert";

describe("Alert", () => {
  it("uses role=status for non-danger variants", () => {
    render(<Alert variant="info" title="Heads up" />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("uses role=alert for the danger variant, since status is never color alone", () => {
    render(<Alert variant="danger" title="Something failed" />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("renders the title and children content", () => {
    render(
      <Alert variant="success" title="Saved">
        Your changes were saved.
      </Alert>
    );
    expect(screen.getByText("Saved")).toBeInTheDocument();
    expect(screen.getByText("Your changes were saved.")).toBeInTheDocument();
  });

  it("renders the given icon", () => {
    render(<Alert variant="success" title="Saved" icon={<CircleCheck data-testid="alert-icon" />} />);
    expect(screen.getByTestId("alert-icon")).toBeInTheDocument();
  });
});

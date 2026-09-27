import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../src/components/ui/card";

describe("Card", () => {
  it("renders its composed parts with the right roles/tags", () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Order #42</CardTitle>
          <CardDescription>Placed yesterday</CardDescription>
        </CardHeader>
        <CardContent>Two items</CardContent>
        <CardFooter>Total: $12</CardFooter>
      </Card>
    );
    expect(screen.getByRole("heading", { name: "Order #42" }).tagName).toBe("H3");
    expect(screen.getByText("Placed yesterday").tagName).toBe("P");
    expect(screen.getByText("Two items")).toBeInTheDocument();
    expect(screen.getByText("Total: $12")).toBeInTheDocument();
  });

  it("passes through a custom className without dropping the base styling hook", () => {
    render(<Card className="custom-card">content</Card>);
    const card = screen.getByText("content");
    expect(card).toHaveClass("custom-card");
    expect(card).toHaveClass("rounded-lg");
  });
});

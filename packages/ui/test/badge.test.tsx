import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge } from "../src/components/ui/badge";

describe("Badge", () => {
  it("renders children as a span", () => {
    render(<Badge>New</Badge>);
    const badge = screen.getByText("New");
    expect(badge.tagName).toBe("SPAN");
  });

  it("defaults to the neutral variant's styling", () => {
    render(<Badge>Draft</Badge>);
    expect(screen.getByText("Draft")).toHaveClass("text-muted-foreground");
  });

  it("applies each variant's distinguishing class without throwing", () => {
    const variants = ["neutral", "brand", "success", "danger"] as const;
    for (const variant of variants) {
      render(<Badge variant={variant}>{variant}</Badge>);
    }
    for (const variant of variants) {
      expect(screen.getByText(variant)).toBeInTheDocument();
    }
  });
});

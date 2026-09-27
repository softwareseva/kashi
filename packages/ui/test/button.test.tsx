import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "../src/components/ui/button";

describe("Button", () => {
  it("renders each variant without throwing", () => {
    const variants = ["primary", "secondary", "outline", "ghost", "destructive", "link"] as const;
    for (const variant of variants) {
      render(<Button variant={variant}>Click me</Button>);
    }
    expect(screen.getAllByRole("button", { name: "Click me" })).toHaveLength(variants.length);
  });

  it("renders each size without throwing", () => {
    const sizes = ["sm", "md", "lg", "icon", "icon-sm"] as const;
    for (const size of sizes) {
      render(<Button size={size}>Go</Button>);
    }
    expect(screen.getAllByRole("button", { name: "Go" })).toHaveLength(sizes.length);
  });

  it("renders a native button by default", () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole("button", { name: "Save" }).tagName).toBe("BUTTON");
  });

  it("renders the child element's tag when asChild is set", () => {
    render(
      <Button asChild>
        <a href="/somewhere">Go there</a>
      </Button>
    );
    const link = screen.getByRole("link", { name: "Go there" });
    expect(link.tagName).toBe("A");
    expect(link).toHaveAttribute("href", "/somewhere");
  });

  it("fires onClick once per click", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Submit</Button>);
    await user.click(screen.getByRole("button", { name: "Submit" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("blocks clicks when disabled", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Submit
      </Button>
    );
    const button = screen.getByRole("button", { name: "Submit" });
    expect(button).toBeDisabled();
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});

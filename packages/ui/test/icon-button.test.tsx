import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Search } from "lucide-react";
import { IconButton } from "../src/components/ui/icon-button";

describe("IconButton", () => {
  it("requires and exposes an accessible name via aria-label", () => {
    render(<IconButton label="Search" icon={<Search />} />);
    expect(screen.getByRole("button", { name: "Search" })).toBeInTheDocument();
  });

  it("falls back to the label as the title tooltip", () => {
    render(<IconButton label="Close" icon={<Search />} />);
    expect(screen.getByRole("button", { name: "Close" })).toHaveAttribute("title", "Close");
  });

  it("lets an explicit title override the label tooltip", () => {
    render(<IconButton label="Close" icon={<Search />} title="Dismiss dialog" />);
    expect(screen.getByRole("button", { name: "Close" })).toHaveAttribute("title", "Dismiss dialog");
  });

  it("fires onClick when clicked", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<IconButton label="Search" icon={<Search />} onClick={onClick} />);
    await user.click(screen.getByRole("button", { name: "Search" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("renders each variant and size without throwing", () => {
    const variants = ["ghost", "outline", "secondary", "primary"] as const;
    for (const variant of variants) {
      render(<IconButton label={`Action ${variant}`} icon={<Search />} variant={variant} size="sm" />);
    }
    expect(screen.getAllByRole("button")).toHaveLength(variants.length);
  });
});

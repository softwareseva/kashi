import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RadioGroup, RadioOption } from "../src/components/ui/radio-group";

function Fixture({ onValueChange }: { onValueChange?: (value: string) => void }) {
  return (
    <RadioGroup onValueChange={onValueChange} defaultValue="veg">
      <RadioOption value="veg" label="Vegetarian" description="No meat or fish" />
      <RadioOption value="vegan" label="Vegan" />
    </RadioGroup>
  );
}

describe("RadioGroup / RadioOption", () => {
  it("checks exactly one item at a time", () => {
    render(<Fixture />);
    expect(screen.getByRole("radio", { name: /Vegetarian/ })).toHaveAttribute("data-state", "checked");
    expect(screen.getByRole("radio", { name: "Vegan" })).toHaveAttribute("data-state", "unchecked");
  });

  it("associates the description with the item via aria-describedby", () => {
    render(<Fixture />);
    const item = screen.getByRole("radio", { name: /Vegetarian/ });
    const describedBy = item.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)).toHaveTextContent("No meat or fish");
  });

  it("fires onValueChange and moves the checked state when another item is picked", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Fixture onValueChange={onValueChange} />);
    await user.click(screen.getByRole("radio", { name: "Vegan" }));
    expect(onValueChange).toHaveBeenCalledWith("vegan");
    expect(screen.getByRole("radio", { name: "Vegan" })).toHaveAttribute("data-state", "checked");
    expect(screen.getByRole("radio", { name: /Vegetarian/ })).toHaveAttribute("data-state", "unchecked");
  });

  it("moves the checked item with arrow-key navigation", async () => {
    const user = userEvent.setup();
    render(<Fixture />);
    screen.getByRole("radio", { name: /Vegetarian/ }).focus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("radio", { name: "Vegan" })).toHaveFocus();
  });
});

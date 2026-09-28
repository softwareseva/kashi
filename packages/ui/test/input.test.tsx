import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Field, Input } from "../src/components/ui/input";

describe("Input", () => {
  it("updates its value as the user types", async () => {
    const user = userEvent.setup();
    render(<Input aria-label="Name" />);
    const input = screen.getByRole("textbox", { name: "Name" });
    await user.type(input, "Kashi");
    expect(input).toHaveValue("Kashi");
  });

  it("sets aria-invalid only when invalid is true", () => {
    render(<Input aria-label="Name" invalid />);
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveAttribute("aria-invalid", "true");
  });

  it("omits aria-invalid when not invalid", () => {
    render(<Input aria-label="Name" />);
    expect(screen.getByRole("textbox", { name: "Name" })).not.toHaveAttribute("aria-invalid");
  });
});

describe("Field", () => {
  it("wires the label to the input via htmlFor/id", () => {
    render(
      <Field id="email" label="Email">
        <Input />
      </Field>
    );
    expect(screen.getByLabelText("Email")).toBe(screen.getByRole("textbox"));
  });

  it("shows the hint and associates it via aria-describedby when there is no error", () => {
    render(
      <Field id="email" label="Email" hint="We'll never share this">
        <Input />
      </Field>
    );
    const input = screen.getByRole("textbox");
    expect(input).toHaveAttribute("aria-describedby", "email-hint");
    expect(screen.getByText("We'll never share this")).toHaveAttribute("id", "email-hint");
  });

  it("prefers the error over the hint, marks the input invalid, and associates the error text", () => {
    render(
      <Field id="email" label="Email" hint="We'll never share this" error="Email is required">
        <Input />
      </Field>
    );
    const input = screen.getByRole("textbox");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", "email-error");
    expect(screen.getByText("Email is required")).toHaveAttribute("id", "email-error");
    expect(screen.queryByText("We'll never share this")).not.toBeInTheDocument();
  });
});

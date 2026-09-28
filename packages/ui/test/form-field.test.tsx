import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useAppForm } from "../src/components/ui/form-field";

const fruitOptions = [
  { value: "apple", label: "Apple" },
  { value: "banana", label: "Banana" },
];

function TextFieldFixture({ onSubmit }: { onSubmit: (name: string) => void }) {
  const form = useAppForm({
    defaultValues: { name: "" },
    onSubmit: async ({ value }) => onSubmit(value.name),
  });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.AppField
        name="name"
        validators={{ onChange: ({ value }: { value: string }) => (value ? undefined : "Name is required") }}
      >
        {(field: any) => <field.TextField label="Name" />}
      </form.AppField>
      <button type="submit">Submit</button>
    </form>
  );
}

function CheckboxFieldFixture() {
  const form = useAppForm({ defaultValues: { agree: false } });
  return (
    <form.AppField name="agree">{(field: any) => <field.CheckboxField label="I agree" />}</form.AppField>
  );
}

function SelectFieldFixture({ onValueChange }: { onValueChange?: (value: string) => void }) {
  const form = useAppForm({ defaultValues: { fruit: "" } });
  return (
    <form.AppField name="fruit" listeners={{ onChange: ({ value }: { value: string }) => onValueChange?.(value) }}>
      {(field: any) => <field.SelectField label="Fruit" options={fruitOptions} placeholder="Pick a fruit" />}
    </form.AppField>
  );
}

function RadioGroupFieldFixture() {
  const form = useAppForm({ defaultValues: { fruit: "apple" } });
  return (
    <form.AppField name="fruit">
      {(field: any) => <field.RadioGroupField label="Fruit" options={fruitOptions} />}
    </form.AppField>
  );
}

describe("TextField", () => {
  it("renders the label wired to the input", () => {
    render(<TextFieldFixture onSubmit={vi.fn()} />);
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
  });

  it("updates the underlying form value as the user types", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<TextFieldFixture onSubmit={onSubmit} />);
    await user.type(screen.getByLabelText("Name"), "Kashi");
    await user.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith("Kashi"));
  });

  it("shows the validator's error message and marks the field invalid", async () => {
    const user = userEvent.setup();
    render(<TextFieldFixture onSubmit={vi.fn()} />);
    const input = screen.getByLabelText("Name");
    await user.type(input, "x");
    await user.clear(input);
    expect(await screen.findByText("Name is required")).toBeInTheDocument();
    expect(input).toHaveAttribute("aria-invalid", "true");
  });
});

describe("CheckboxField", () => {
  it("toggles the underlying form value when clicked", async () => {
    const user = userEvent.setup();
    render(<CheckboxFieldFixture />);
    const checkbox = screen.getByRole("checkbox", { name: "I agree" });
    expect(checkbox).not.toBeChecked();
    await user.click(checkbox);
    expect(checkbox).toBeChecked();
  });
});

describe("SelectField", () => {
  it("updates the form value when an option is picked", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<SelectFieldFixture onValueChange={onValueChange} />);
    await user.click(screen.getByRole("combobox", { name: "Fruit" }));
    await user.click(await screen.findByRole("option", { name: "Banana" }));
    expect(onValueChange).toHaveBeenCalledWith("banana");
  });
});

describe("RadioGroupField", () => {
  it("renders the options with the default value checked", () => {
    render(<RadioGroupFieldFixture />);
    expect(screen.getByRole("radio", { name: "Apple" })).toHaveAttribute("data-state", "checked");
    expect(screen.getByRole("radio", { name: "Banana" })).toHaveAttribute("data-state", "unchecked");
  });

  it("moves the checked state when another option is picked", async () => {
    const user = userEvent.setup();
    render(<RadioGroupFieldFixture />);
    await user.click(screen.getByRole("radio", { name: "Banana" }));
    expect(screen.getByRole("radio", { name: "Banana" })).toHaveAttribute("data-state", "checked");
  });
});

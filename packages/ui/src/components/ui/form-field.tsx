/** TanStack Form field bindings on top of the existing primitives. `useAppForm()` gives every consumer TextField/CheckboxField/SelectField/RadioGroupField wired to field state, validation and error rendering for free. */
import * as React from "react";
import { createFormHookContexts, createFormHook } from "@tanstack/react-form";
import { Input, type InputProps } from "./input";
import { Checkbox } from "./checkbox";
import { RadioGroup, RadioOption } from "./radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";

export const { fieldContext, formContext, useFieldContext, useFormContext } = createFormHookContexts();

function fieldError(errors: unknown[]): string | undefined {
  const first = errors[0];
  if (first == null) return undefined;
  if (typeof first === "object" && "message" in (first as Record<string, unknown>)) return String((first as { message: unknown }).message);
  return String(first);
}

/** Label + control + hint/error, wired for screen readers. Distinct from `Field` in `input.tsx` (which clones an uncontrolled child) since these controls read their value from TanStack Form's field state instead. */
function FieldShell({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string; children: React.ReactNode }) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="text-label text-foreground">{label}</label>
      {children}
      {error ? <p id={`${id}-error`} className="text-body-sm text-destructive">{error}</p> : hint ? <p id={`${id}-hint`} className="text-body-sm text-muted-foreground">{hint}</p> : null}
      <span id={describedBy} className="sr-only" />
    </div>
  );
}

export function TextField({ label, hint, ...inputProps }: { label: string; hint?: string } & Omit<InputProps, "value" | "onChange" | "onBlur" | "name" | "id">) {
  const field = useFieldContext<string>();
  const error = fieldError(field.state.meta.errors);
  return (
    <FieldShell id={field.name} label={label} hint={hint} error={error}>
      <Input
        id={field.name}
        name={field.name}
        invalid={!!error}
        aria-describedby={error ? `${field.name}-error` : hint ? `${field.name}-hint` : undefined}
        value={field.state.value}
        onChange={(e) => field.handleChange(e.target.value)}
        onBlur={field.handleBlur}
        {...inputProps}
      />
    </FieldShell>
  );
}

export function CheckboxField({ label }: { label: string }) {
  const field = useFieldContext<boolean>();
  return (
    <label className="flex items-center gap-2 text-body-sm text-foreground">
      <Checkbox id={field.name} checked={field.state.value} onCheckedChange={(checked) => field.handleChange(checked === true)} onBlur={field.handleBlur} />
      {label}
    </label>
  );
}

export function SelectField({ label, hint, options, placeholder }: { label: string; hint?: string; options: { value: string; label: string }[]; placeholder?: string }) {
  const field = useFieldContext<string>();
  const error = fieldError(field.state.meta.errors);
  return (
    <FieldShell id={field.name} label={label} hint={hint} error={error}>
      <Select value={field.state.value} onValueChange={field.handleChange}>
        <SelectTrigger id={field.name} aria-invalid={!!error || undefined} onBlur={field.handleBlur}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </FieldShell>
  );
}

export function RadioGroupField({ label, hint, options }: { label: string; hint?: string; options: { value: string; label: string; description?: string }[] }) {
  const field = useFieldContext<string>();
  const error = fieldError(field.state.meta.errors);
  return (
    <FieldShell id={field.name} label={label} hint={hint} error={error}>
      <RadioGroup value={field.state.value} onValueChange={field.handleChange} onBlur={field.handleBlur}>
        {options.map((option) => <RadioOption key={option.value} value={option.value} label={option.label} description={option.description} />)}
      </RadioGroup>
    </FieldShell>
  );
}

export const { useAppForm } = createFormHook({
  fieldComponents: { TextField, CheckboxField, SelectField, RadioGroupField },
  formComponents: {},
  fieldContext,
  formContext,
});

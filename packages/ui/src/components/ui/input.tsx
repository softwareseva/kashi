import * as React from "react";
import { cn } from "../../lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid, type = "text", ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      aria-invalid={invalid || undefined}
      className={cn(
        "flex h-10 w-full rounded-md border border-input bg-surface-raised px-3 text-body-sm text-foreground",
        "placeholder:text-muted-foreground",
        "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-destructive aria-invalid:focus-visible:outline-destructive",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";

/** Label + control + hint/error, wired for screen readers. */
export function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactElement<InputProps & { "aria-describedby"?: string }>;
}) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="text-label text-foreground">
        {label}
      </label>
      {React.cloneElement(children, { id, invalid: !!error, "aria-describedby": describedBy })}
      {error ? (
        <p id={`${id}-error`} className="text-body-sm text-destructive">{error}</p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-body-sm text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

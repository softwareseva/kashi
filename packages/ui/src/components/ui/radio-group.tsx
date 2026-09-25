import * as React from "react";
import * as RadioPrimitive from "@radix-ui/react-radio-group";
import { cn } from "../../lib/utils";

export const RadioGroup = React.forwardRef<
  React.ElementRef<typeof RadioPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof RadioPrimitive.Root>
>(({ className, ...props }, ref) => <RadioPrimitive.Root ref={ref} className={cn("grid gap-3", className)} {...props} />);
RadioGroup.displayName = "RadioGroup";

export const RadioGroupItem = React.forwardRef<
  React.ElementRef<typeof RadioPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof RadioPrimitive.Item>
>(({ className, ...props }, ref) => (
  <RadioPrimitive.Item
    ref={ref}
    className={cn(
      "flex size-5 shrink-0 items-center justify-center rounded-full border border-input bg-surface-raised",
      "data-[state=checked]:border-saffron-strong",
      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50",
      className
    )}
    {...props}
  >
    <RadioPrimitive.Indicator className="size-2.5 rounded-full bg-saffron-strong" />
  </RadioPrimitive.Item>
));
RadioGroupItem.displayName = "RadioGroupItem";

/** Radio + label + optional description, the usual row. */
export function RadioOption({ value, label, description, disabled }: { value: string; label: string; description?: string; disabled?: boolean }) {
  const id = React.useId();
  return (
    <div className="flex items-start gap-3">
      <RadioGroupItem value={value} id={id} disabled={disabled} className="mt-0.5" aria-describedby={description ? `${id}-d` : undefined} />
      <label htmlFor={id} className="grid gap-0.5">
        <span className="text-body-sm text-foreground">{label}</span>
        {description ? <span id={`${id}-d`} className="text-body-sm text-muted-foreground">{description}</span> : null}
      </label>
    </div>
  );
}

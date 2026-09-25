import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

export const alertVariants = cva(
  "grid grid-cols-[auto_1fr] items-start gap-x-3 gap-y-1 rounded-lg border p-4 text-body-sm [&>svg]:size-5 [&>svg]:mt-0.5",
  {
    variants: {
      variant: {
        info: "border-border bg-saffron-soft text-ink [&>svg]:text-ink",
        success: "border-border bg-surface-raised text-ink [&>svg]:text-sage",
        danger: "border-danger bg-surface-raised text-ink [&>svg]:text-danger",
      },
    },
    defaultVariants: { variant: "info" },
  }
);

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof alertVariants> {
  /** Lucide icon element, e.g. <CircleCheck />. Status is never color alone. */
  icon?: React.ReactNode;
  title?: string;
}

export function Alert({ className, variant, icon, title, children, ...props }: AlertProps) {
  return (
    <div role={variant === "danger" ? "alert" : "status"} className={cn(alertVariants({ variant }), className)} {...props}>
      {icon ?? <span />}
      <div className="grid gap-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className="text-muted-foreground">{children}</div> : null}
      </div>
    </div>
  );
}

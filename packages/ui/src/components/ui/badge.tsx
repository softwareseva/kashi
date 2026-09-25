import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

export const badgeVariants = cva("inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-label", {
  variants: {
    variant: {
      neutral: "border border-border bg-surface text-muted-foreground",
      brand: "bg-saffron-soft text-ink",
      success: "border border-border bg-surface text-sage",
      danger: "border border-border bg-surface text-danger",
    },
  },
  defaultVariants: { variant: "neutral" },
});

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

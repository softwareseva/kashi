import * as React from "react";
import { cn } from "../../lib/utils";
import { buttonVariants } from "./button";

export interface IconButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  /** Accessible name, also shown as the tooltip: "Search", "Close". Required. */
  label: string;
  /** A Lucide icon element, e.g. <Search />. */
  icon: React.ReactNode;
  variant?: "ghost" | "outline" | "secondary" | "primary";
  size?: "sm" | "md";
}

/** Square button with only an icon. Always has a label for screen readers. */
export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ label, icon, variant = "ghost", size = "md", className, title, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={title ?? label}
      className={cn(
        buttonVariants({ variant, size: size === "sm" ? "icon-sm" : "icon" }),
        variant === "ghost" && "text-ink-muted hover:text-ink",
        "[&_svg]:size-5",
        className
      )}
      {...props}
    >
      {icon}
    </button>
  )
);
IconButton.displayName = "IconButton";

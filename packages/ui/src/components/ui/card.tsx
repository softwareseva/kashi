import * as React from "react";
import { cn } from "../../lib/utils";

type DivProps = React.HTMLAttributes<HTMLDivElement>;

export function Card({ className, ...props }: DivProps) {
  return <div className={cn("rounded-lg border border-border bg-card text-card-foreground", className)} {...props} />;
}
export function CardHeader({ className, ...props }: DivProps) {
  return <div className={cn("grid gap-1 p-4 pb-2", className)} {...props} />;
}
export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-heading", className)} {...props} />;
}
export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-body-sm text-muted-foreground", className)} {...props} />;
}
export function CardContent({ className, ...props }: DivProps) {
  return <div className={cn("px-4 pb-4", className)} {...props} />;
}
export function CardFooter({ className, ...props }: DivProps) {
  return <div className={cn("flex items-center gap-2 border-t border-border p-4", className)} {...props} />;
}

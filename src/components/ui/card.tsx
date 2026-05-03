import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Card — Adslift dark glass aesthetic.
 * Default variant uses a subtle glass panel. Pass `variant="plain"` for the
 * legacy flat look (solid card bg, no backdrop blur).
 */
type CardVariant = "glass" | "glass-blue" | "glass-amber" | "plain";

const variantClass: Record<CardVariant, string> = {
  glass:
    "relative border border-white/[0.08] bg-glass-card backdrop-blur-glass shadow-glass before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-1/2 before:bg-gradient-to-b before:from-white/[0.04] before:to-transparent before:rounded-t-xl",
  "glass-blue":
    "relative border border-primary/25 bg-glass-card-blue backdrop-blur-glass shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_14px_34px_-10px_rgba(13,114,255,0.35)] before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-1/2 before:bg-gradient-to-b before:from-white/[0.06] before:to-transparent before:rounded-t-xl",
  "glass-amber":
    "relative border border-adslift-amber/25 bg-glass-card-amber backdrop-blur-glass shadow-glass before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-1/2 before:bg-gradient-to-b before:from-white/[0.04] before:to-transparent before:rounded-t-xl",
  plain: "border bg-card text-card-foreground shadow-sm",
};

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = "glass", ...props }, ref) => (
    <div
      ref={ref}
      className={cn("rounded-xl text-card-foreground", variantClass[variant], className)}
      {...props}
    />
  ),
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("relative flex flex-col space-y-1.5 p-5", className)} {...props} />
  ),
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn("text-lg font-semibold leading-tight tracking-tight", className)}
      {...props}
    />
  ),
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-[13px] text-muted-foreground", className)} {...props} />
  ),
);
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("relative p-5 pt-0", className)} {...props} />
  ),
);
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("relative flex items-center p-5 pt-0", className)} {...props} />
  ),
);
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };

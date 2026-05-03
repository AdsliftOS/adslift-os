import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold tracking-tight ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 overflow-hidden",
  {
    variants: {
      variant: {
        default:
          "text-white bg-brand-gradient shadow-glow-blue-sm hover:bg-brand-gradient-hover hover:shadow-glow-blue active:bg-brand-gradient-pressed active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)] before:absolute before:top-0 before:left-0 before:right-0 before:h-1/2 before:bg-gradient-to-b before:from-white/20 before:to-transparent before:pointer-events-none before:rounded-t-lg",
        destructive:
          "text-white bg-gradient-to-b from-[#F87171] to-[#B91C1C] shadow-glow-danger hover:brightness-110 active:brightness-95 before:absolute before:top-0 before:left-0 before:right-0 before:h-1/2 before:bg-gradient-to-b before:from-white/20 before:to-transparent before:pointer-events-none before:rounded-t-lg",
        outline:
          "border border-white/[0.14] bg-white/[0.04] text-foreground backdrop-blur-sm hover:bg-white/[0.08] hover:border-primary/30",
        secondary:
          "bg-white/[0.06] text-foreground border border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] hover:bg-white/[0.1]",
        ghost:
          "text-muted-foreground hover:bg-white/[0.06] hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        success:
          "text-white bg-gradient-to-b from-[#34D399] to-[#15803D] shadow-glow-success hover:brightness-110 before:absolute before:top-0 before:left-0 before:right-0 before:h-1/2 before:bg-gradient-to-b before:from-white/20 before:to-transparent before:pointer-events-none before:rounded-t-lg",
        amber:
          "text-adslift-navy bg-gradient-to-b from-[#F5A623] to-[#C8821E] shadow-glow-amber hover:brightness-110 font-bold before:absolute before:top-0 before:left-0 before:right-0 before:h-1/2 before:bg-gradient-to-b before:from-white/30 before:to-transparent before:pointer-events-none before:rounded-t-lg",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-[12.5px]",
        lg: "h-11 rounded-lg px-6 text-[14px]",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };

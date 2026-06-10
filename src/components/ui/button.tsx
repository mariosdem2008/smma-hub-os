import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-ui text-sm font-semibold transition-all duration-200 ease-productive ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-55 active:translate-y-px [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 touch-manipulation",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-btn-primary hover:bg-primary-hover hover:shadow-btn-primary-hover",
        destructive: "bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive/90",
        outline: "border border-border bg-surface/70 text-foreground shadow-xs hover:border-primary/50 hover:bg-surface-raised hover:text-foreground",
        secondary: "bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80",
        ghost: "text-muted-foreground hover:bg-muted hover:text-foreground",
        link: "h-auto min-h-0 px-0 py-0 text-primary underline-offset-4 hover:text-primary-hover hover:underline active:translate-y-0",
      },
      size: {
        default: "h-10 min-h-[44px] px-4 py-2 md:min-h-[40px]",
        sm: "h-9 min-h-[40px] px-3 text-xs md:min-h-[36px]",
        lg: "h-12 min-h-[48px] px-6 text-base md:min-h-[44px]",
        icon: "h-10 w-10 min-h-[44px] min-w-[44px] p-0 md:min-h-[40px] md:min-w-[40px]",
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
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, disabled, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    const isDisabled = disabled || loading;

    if (asChild) {
      // Radix Slot requires exactly one child element, so we must not inject a
      // sibling loader here. Clone the single child and prepend the spinner
      // inside it instead.
      const child = React.Children.only(children) as React.ReactElement;
      return (
        <Comp
          className={cn(buttonVariants({ variant, size, className }), isDisabled && "pointer-events-none opacity-55")}
          ref={ref}
          aria-disabled={isDisabled}
          {...props}
        >
          {React.cloneElement(
            child,
            child.props,
            <>
              {loading ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
              {child.props.children}
            </>,
          )}
        </Comp>
      );
    }

    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} disabled={isDisabled} {...props}>
        {loading ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
        {children}
      </Comp>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };

import { ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost" | "outline";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, children, variant = "primary", size = "md", loading, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center rounded-xl font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-zinc-950 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]",
          // Variants
          variant === "primary" && "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20",
          variant === "secondary" && "bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700/60",
          variant === "outline" && "bg-transparent border border-zinc-800 text-zinc-300 hover:bg-zinc-900 hover:text-white",
          variant === "danger" && "bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/20",
          variant === "ghost" && "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900",
          // Sizes
          size === "sm" && "px-3 py-1.5 text-xs gap-1.5",
          size === "md" && "px-4 py-2 text-sm gap-2",
          size === "lg" && "px-6 py-3 text-base gap-2.5",
          className
        )}
        {...props}
      >
        {loading && <Loader2 size={16} className="animate-spin text-current" />}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";

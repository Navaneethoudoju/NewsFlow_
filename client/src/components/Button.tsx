import { ButtonHTMLAttributes, forwardRef } from "react";
import { Loader2 } from "lucide-react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
  size?: "sm" | "md";
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "bg-masthead text-white hover:bg-masthead-dark disabled:bg-masthead/50",
  secondary: "bg-white text-ink border border-rule hover:bg-paper-dim disabled:opacity-50",
  ghost: "text-ink hover:bg-paper-dim disabled:opacity-50",
  danger: "bg-status-overdue text-white hover:bg-red-800 disabled:bg-red-300",
};

const Button = forwardRef<HTMLButtonElement, Props>(
  ({ variant = "primary", size = "md", loading, disabled, className = "", children, ...rest }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors ${
          size === "sm" ? "px-2.5 py-1.5 text-sm" : "px-4 py-2 text-sm"
        } ${VARIANT_CLASSES[variant]} ${className}`}
        {...rest}
      >
        {loading && <Loader2 size={14} className="animate-spin" />}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";

export default Button;

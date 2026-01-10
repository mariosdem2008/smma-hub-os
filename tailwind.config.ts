import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        /* Core semantic tokens */
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",

        /* Surface tokens */
        surface: "hsl(var(--surface))",

        /* Text tokens */
        "text-primary": "hsl(var(--text-primary))",
        "text-secondary": "hsl(var(--text-secondary))",

        /* Premium accent colors */
        "premium-blue": "#4C7DFF",
        "premium-blue-light": "#22D3EE",
        "premium-dark": "#050505",
        "premium-surface": "#0B1220",
        "premium-surface-secondary": "#0E1830",

        /* Vibrant accent colors */
        "accent-orange": "hsl(var(--accent-orange))",
        "accent-teal": "hsl(var(--accent-teal))",
        "accent-purple": "hsl(var(--accent-purple))",
        "accent-pink": "hsl(var(--accent-pink))",
        "accent-green": "hsl(var(--accent-green))",

        /* Primary brand color */
        primary: {
          DEFAULT: "hsl(var(--primary))",
          hover: "hsl(var(--primary-hover))",
          foreground: "hsl(var(--primary-foreground))",
        },

        /* Accent color */
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },

        /* Secondary */
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },

        /* Destructive/Error */
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        error: {
          DEFAULT: "hsl(var(--error))",
          foreground: "hsl(var(--error-foreground))",
        },

        /* Muted */
        muted: {
          DEFAULT: "hsl(var(--muted-bg))",
          foreground: "hsl(var(--muted))",
        },

        /* Card */
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },

        /* Popover */
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },

        /* Sidebar */
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
          bg: "hsl(var(--sidebar-bg))",
        },

        /* Header */
        header: {
          bg: "hsl(var(--header-bg))",
        },

        /* State colors */
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
        },

        /* Status colors */
        status: {
          active: "hsl(var(--status-active))",
          inactive: "hsl(var(--status-inactive))",
          paused: "hsl(var(--status-paused))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        'card': '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
        'card-hover': '0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.1)',
        'sidebar': '2px 0 12px 0 rgba(0, 0, 0, 0.1)',
        'premium': '0 10px 40px -10px rgba(78, 93, 255, 0.3)',
        'glow-sm': '0 0 15px rgba(76, 125, 255, 0.3)',
        'glow-md': '0 0 30px rgba(76, 125, 255, 0.4)',
        'glow-lg': '0 0 50px rgba(76, 125, 255, 0.5)',
      },
      backgroundImage: {
        'gradient-premium': 'linear-gradient(135deg, #4C7DFF 0%, #22D3EE 100%)',
        'gradient-orange': 'var(--gradient-orange)',
        'gradient-teal': 'var(--gradient-teal)',
        'gradient-purple': 'var(--gradient-purple)',
        'gradient-green': 'var(--gradient-green)',
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
            opacity: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
            opacity: "1",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
            opacity: "1",
          },
          to: {
            height: "0",
            opacity: "0",
          },
        },
        "fade-in": {
          "0%": {
            opacity: "0",
            transform: "translateY(8px)",
          },
          "100%": {
            opacity: "1",
            transform: "translateY(0)",
          },
        },
        "fade-out": {
          "0%": {
            opacity: "1",
            transform: "translateY(0)",
          },
          "100%": {
            opacity: "0",
            transform: "translateY(8px)",
          },
        },
        "scale-in": {
          "0%": {
            transform: "scale(0.95)",
            opacity: "0",
          },
          "100%": {
            transform: "scale(1)",
            opacity: "1",
          },
        },
        "slide-in-right": {
          "0%": { transform: "translateX(100%)" },
          "100%": { transform: "translateX(0)" },
        },
        "slide-out-right": {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(100%)" },
        },
        "shimmer": {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "gradient-border": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        "float": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        "glow-pulse": {
          "0%, 100%": { opacity: "0.4" },
          "50%": { opacity: "0.8" },
        },
        "border-spin": {
          "100%": { transform: "rotate(360deg)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.3s ease-out",
        "fade-out": "fade-out 0.3s ease-out",
        "scale-in": "scale-in 0.2s ease-out",
        "slide-in-right": "slide-in-right 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        "slide-out-right": "slide-out-right 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        "shimmer": "shimmer 2s linear infinite",
        "gradient-border": "gradient-border 3s ease infinite",
        "float": "float 6s ease-in-out infinite",
        "glow-pulse": "glow-pulse 3s ease-in-out infinite",
        "border-spin": "border-spin 3s linear infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;

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
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
        display: ['Inter', 'system-ui', 'sans-serif'],
      },
      letterSpacing: {
        'ui': '0.14em',
        'eye': '0.18em',
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        adslift: {
          navy: "#0B1628",
          "navy-2": "#1A1A2E",
          "navy-3": "#1A2B45",
          blue: "#0D72FF",
          "blue-light": "#4D96FF",
          "blue-hover": "#1A85FF",
          "blue-pressed": "#0650C7",
          "blue-deep": "#03358A",
          amber: "#F5A623",
          "amber-dark": "#C8821E",
          success: "#22C55E",
          danger: "#EF4444",
          ice: "#F4F7FB",
          "ice-2": "#D8E2F0",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      backdropBlur: {
        glass: "18px",
      },
      boxShadow: {
        "glow-blue": "0 10px 30px -8px rgba(13,114,255,0.5), inset 0 1px 0 rgba(255,255,255,0.12)",
        "glow-blue-sm": "0 6px 16px -4px rgba(13,114,255,0.45), inset 0 1px 0 rgba(255,255,255,0.12)",
        "glow-amber": "0 10px 28px -10px rgba(245,166,35,0.45), inset 0 1px 0 rgba(255,255,255,0.08)",
        "glow-success": "0 10px 28px -10px rgba(34,197,94,0.4), inset 0 1px 0 rgba(255,255,255,0.08)",
        "glow-danger": "0 10px 28px -10px rgba(239,68,68,0.4), inset 0 1px 0 rgba(255,255,255,0.08)",
        "glass": "inset 0 1px 0 rgba(255,255,255,0.08), 0 14px 34px -14px rgba(0,0,0,0.6)",
        "glass-lg": "inset 0 1px 0 rgba(255,255,255,0.1), 0 20px 48px -12px rgba(0,0,0,0.6)",
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(180deg, #1A85FF 0%, #0650C7 100%)",
        "brand-gradient-hover": "linear-gradient(180deg, #2E95FF 0%, #0D72FF 100%)",
        "brand-gradient-pressed": "linear-gradient(180deg, #0650C7 0%, #03358A 100%)",
        "glass-card": "linear-gradient(160deg, rgba(45,50,80,0.55), rgba(18,22,40,0.75))",
        "glass-card-blue": "linear-gradient(160deg, rgba(13,114,255,0.22), rgba(13,114,255,0.04) 60%, rgba(18,22,40,0.8))",
        "glass-card-amber": "linear-gradient(160deg, rgba(245,166,35,0.15), rgba(18,22,40,0.8))",
        "number-gradient": "linear-gradient(180deg, #FFFFFF 0%, #4D96FF 100%)",
        "number-gradient-amber": "linear-gradient(180deg, #FFFFFF 0%, #F5A623 100%)",
        "grid-fade": "radial-gradient(ellipse 80% 70% at 50% 50%, rgba(255,255,255,0.04), transparent 90%)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "glow-pulse": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(13,114,255,0.4)" },
          "50%": { boxShadow: "0 0 0 6px rgba(13,114,255,0)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "glow-pulse": "glow-pulse 2s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;

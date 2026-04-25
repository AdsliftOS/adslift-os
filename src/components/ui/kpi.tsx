import * as React from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Adslift dark design system — KPI primitives.
 *
 * <Eyebrow> ............. uppercase mono label with tracked letter-spacing
 * <KpiNumber> ........... gradient-clipped hero number (white → blue)
 * <DeltaChip> ........... ▲/▼ delta with semantic color
 * <Sparkline> ........... minimal SVG trendline with gradient fill
 * <ProgressRing> ........ conic-style ring with centered label
 */

export function Eyebrow({
  children,
  className,
  tone = "muted",
}: {
  children: React.ReactNode;
  className?: string;
  tone?: "muted" | "primary" | "amber" | "success";
}) {
  return (
    <div
      className={cn(
        "font-mono text-[10px] font-bold uppercase tracking-[0.18em] leading-none",
        tone === "muted" && "text-muted-foreground/70",
        tone === "primary" && "text-primary/80",
        tone === "amber" && "text-adslift-amber",
        tone === "success" && "text-adslift-success",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function KpiNumber({
  children,
  unit,
  size = "md",
  tone = "blue",
  className,
}: {
  children: React.ReactNode;
  unit?: string;
  size?: "sm" | "md" | "lg" | "xl";
  tone?: "blue" | "amber" | "plain";
  className?: string;
}) {
  const sizes = {
    sm: "text-[22px]",
    md: "text-[28px]",
    lg: "text-[36px]",
    xl: "text-[48px]",
  };
  const unitSizes = {
    sm: "text-[14px]",
    md: "text-[18px]",
    lg: "text-[22px]",
    xl: "text-[28px]",
  };
  const gradient =
    tone === "blue"
      ? "kpi-number"
      : tone === "amber"
        ? "kpi-number-amber"
        : "";
  return (
    <div
      className={cn(
        "font-semibold leading-none tracking-tight tabular-nums",
        sizes[size],
        gradient,
        tone === "plain" && "text-foreground",
        className,
      )}
    >
      {children}
      {unit && (
        <span
          className={cn(
            "ml-1 font-medium text-muted-foreground/60",
            unitSizes[size],
          )}
          style={{
            WebkitTextFillColor: "currentcolor",
            background: "none",
          }}
        >
          {unit}
        </span>
      )}
    </div>
  );
}

export function DeltaChip({
  value,
  format = "pct",
  inverse,
  className,
}: {
  /** Numeric delta (positive = up, negative = down). */
  value: number;
  format?: "pct" | "pp" | "num";
  /** If true, "up" is bad (e.g. CPL). Flips coloring. */
  inverse?: boolean;
  className?: string;
}) {
  const up = value >= 0;
  const positive = inverse ? !up : up;
  const suffix = format === "pct" ? "%" : format === "pp" ? " pp" : "";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.08em] tabular-nums",
        positive
          ? "border-adslift-success/30 bg-adslift-success/15 text-adslift-success"
          : "border-adslift-danger/30 bg-adslift-danger/15 text-adslift-danger",
        className,
      )}
    >
      {up ? <ArrowUp className="h-2.5 w-2.5" /> : <ArrowDown className="h-2.5 w-2.5" />}
      {Math.abs(value).toLocaleString("de-DE", { maximumFractionDigits: 1 })}
      {suffix}
    </span>
  );
}

/**
 * Minimal inline sparkline.
 * Pass values 0..n; component normalizes them into a trend line with
 * a soft gradient fill. Use for hero metrics only.
 */
export function Sparkline({
  values,
  className,
  width = 120,
  height = 40,
  color = "#4D96FF",
}: {
  values: number[];
  className?: string;
  width?: number;
  height?: number;
  color?: string;
}) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pad = 2;
  const step = (width - pad * 2) / (values.length - 1);

  const points = values.map((v, i) => {
    const x = pad + i * step;
    const y = height - pad - ((v - min) / range) * (height - pad * 2);
    return `${x},${y}`;
  });

  const linePath = `M${points.join(" L")}`;
  const areaPath = `${linePath} L${pad + (values.length - 1) * step},${height} L${pad},${height} Z`;
  const last = points[points.length - 1].split(",").map(Number);
  const id = React.useId();

  return (
    <svg
      className={className}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      width={width}
      height={height}
    >
      <defs>
        <linearGradient id={`sg-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.5" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#sg-${id})`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r="2.5" fill={color} />
      <circle cx={last[0]} cy={last[1]} r="5" fill={color} opacity="0.25" />
    </svg>
  );
}

export function ProgressRing({
  value,
  size = 68,
  stroke = 6,
  label,
  gradientFrom = "#4D96FF",
  gradientTo = "#0650C7",
  className,
}: {
  /** 0..100 */
  value: number;
  size?: number;
  stroke?: number;
  label?: React.ReactNode;
  gradientFrom?: string;
  gradientTo?: string;
  className?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  const offset = c - (pct / 100) * c;
  const id = React.useId();
  return (
    <div className={cn("relative inline-flex", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <defs>
          <linearGradient id={`ring-${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={gradientFrom} />
            <stop offset="1" stopColor={gradientTo} />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#ring-${id})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      {label && (
        <div className="absolute inset-0 flex items-center justify-center text-[13px] font-semibold tabular-nums text-foreground">
          {label}
        </div>
      )}
    </div>
  );
}

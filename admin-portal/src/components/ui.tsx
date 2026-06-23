import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  // Tailwind v4 doesn't honor class order, so only apply the default
  // background when the caller hasn't supplied their own bg-* utility.
  const hasBg = /(?:^|\s)bg-/.test(className);
  return (
    <div
      className={`rounded-2xl border border-sand p-5 shadow-[0_1px_2px_rgba(61,43,31,0.04)] ${
        hasBg ? "" : "bg-cream/80"
      } ${className}`}
    >
      {children}
    </div>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-clay">
      {children}
    </p>
  );
}

export function SectionTitle({
  title,
  sub,
  right,
}: {
  title: string;
  sub?: string;
  right?: ReactNode;
}) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-3xl font-bold leading-tight text-brown">
          {title}
        </h1>
        {sub && <p className="mt-1 max-w-2xl text-sm text-brown-mid">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

const toneMap: Record<string, string> = {
  neutral: "bg-sand/60 text-brown-mid",
  clay: "bg-clay-light text-copper",
  positive: "bg-[#e3ede3] text-positive",
  warning: "bg-[#f3e9cf] text-warning",
  danger: "bg-[#f1ddd2] text-danger",
};

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: keyof typeof toneMap;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${toneMap[tone]}`}
    >
      {children}
    </span>
  );
}

export function Stat({
  label,
  value,
  delta,
  tone = "positive",
}: {
  label: string;
  value: string;
  delta?: string;
  tone?: "positive" | "danger" | "neutral";
}) {
  const deltaColor =
    tone === "positive"
      ? "text-positive"
      : tone === "danger"
      ? "text-danger"
      : "text-brown-mid";
  return (
    <Card className="!p-4">
      <p className="text-[11px] font-bold uppercase tracking-wider text-brown-mid/80">
        {label}
      </p>
      <p className="mt-1 font-display text-3xl font-bold text-brown">{value}</p>
      {delta && <p className={`mt-0.5 text-xs font-semibold ${deltaColor}`}>{delta}</p>}
    </Card>
  );
}

export function Button({
  children,
  variant = "primary",
  onClick,
  className = "",
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "accent" | "ghost";
  onClick?: () => void;
  className?: string;
}) {
  const styles: Record<string, string> = {
    primary: "bg-brown text-cream hover:bg-brown-mid",
    secondary: "border border-clay text-brown hover:bg-clay-light",
    accent: "bg-clay text-white hover:brightness-95",
    ghost: "text-copper hover:bg-clay-light",
  };
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

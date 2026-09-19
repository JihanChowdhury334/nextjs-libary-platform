export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | string;
  hint?: string;
}) {
  return (
    <div className="card card-tight">
      <p className="eyebrow">{label}</p>
      <p className="mt-1 text-[length:var(--text-h2)] font-semibold tabular-nums">{value}</p>
      {hint && <p className="text-subtle mt-0.5 text-[length:var(--text-micro)]">{hint}</p>}
    </div>
  );
}

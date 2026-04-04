interface FlakyBadgeProps {
  score: number;
}

/** Renders a "Flaky" badge when flakinessScore > 3. Hidden otherwise. */
export function FlakyBadge({ score }: FlakyBadgeProps) {
  if (score <= 3) return null;
  return (
    <span
      className="ml-1.5 inline-flex items-center rounded border border-warning/30 bg-warning/15 px-1.5 py-0.5 text-xs font-medium text-warning"
      title={`Flakiness score: ${score}/10`}
    >
      Flaky
    </span>
  );
}

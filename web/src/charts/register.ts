import { Chart, registerables } from "chart.js";

Chart.register(...registerables);

function getCssVar(name: string): string {
  if (typeof document === "undefined") return "";
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "";
}

/**
 * Returns Chart.js options that use the app's CSS theme variables (--muted-foreground, --border, --card, --card-foreground)
 * so bar and pie charts respect light/dark/slate themes.
 */
export function getChartThemeOptions(): {
  scales?: {
    x?: { ticks?: { color?: string }; grid?: { color?: string } };
    y?: { ticks?: { color?: string }; grid?: { color?: string } };
  };
  plugins?: {
    tooltip?: {
      backgroundColor?: string;
      borderColor?: string;
      borderWidth?: number;
      titleColor?: string;
      bodyColor?: string;
    };
    legend?: {
      labels?: { color?: string };
    };
  };
} {
  const mutedFg = getCssVar("--muted-foreground");
  const border = getCssVar("--border");
  const card = getCssVar("--card");
  const cardFg = getCssVar("--card-foreground");
  return {
    scales: {
      x: {
        ticks: { color: mutedFg || undefined },
        grid: { color: border || undefined },
      },
      y: {
        ticks: { color: mutedFg || undefined },
        grid: { color: border || undefined },
      },
    },
    plugins: {
      tooltip: {
        backgroundColor: card || undefined,
        borderColor: border || undefined,
        borderWidth: 1,
        titleColor: cardFg || undefined,
        bodyColor: cardFg || undefined,
      },
      legend: {
        labels: { color: cardFg || mutedFg || undefined },
      },
    },
  };
}

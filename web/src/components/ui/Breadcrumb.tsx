import { Link } from "react-router-dom";

type Item = { label: string; to?: string };

export function Breadcrumb({ items }: { items: Item[] }) {
  return (
    <nav className="mb-4 text-sm text-muted" aria-label="Breadcrumb">
      {items.map((item, i) => (
        <span key={i}>
          {i > 0 && <span className="mx-1">→</span>}
          {item.to ? <Link to={item.to} className="text-primary hover:underline">{item.label}</Link> : <span className="font-medium text-text">{item.label}</span>}
        </span>
      ))}
    </nav>
  );
}

import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type Item = { label: string; to?: string };

function Breadcrumb({ items, className }: { items: Item[]; className?: string }) {
  return (
    <nav className={cn("mb-4 flex items-center space-x-1 text-sm text-muted-foreground", className)} aria-label="Breadcrumb">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="size-4" aria-hidden />}
          {item.to ? (
            <Link
              to={item.to}
              className="font-medium text-foreground transition-colors hover:text-primary hover:underline"
            >
              {item.label}
            </Link>
          ) : (
            <span className="font-medium text-foreground">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

export { Breadcrumb };

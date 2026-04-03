// Re-export from cn.ts so shadcn/ui components (which import from @/lib/utils) work
// without duplicating the implementation. The canonical implementation is in cn.ts.
export { cn } from "./cn";

import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { LoadingSpinner } from "./components/ui/LoadingSpinner";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <LoadingSpinner />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return <>{children}</>;
}

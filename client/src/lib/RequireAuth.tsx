import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { Role } from "../types";
import { LoadingState } from "../components/States";

export default function RequireAuth({ children, role }: { children: ReactNode; role?: Role }) {
  const { user, loading } = useAuth();

  if (loading) return <LoadingState label="Checking your session…" />;
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
}

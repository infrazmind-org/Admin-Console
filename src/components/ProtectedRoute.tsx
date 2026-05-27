import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoadingOverlay from './LoadingOverlay';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token, user, authReady } = useAuth();
  const location = useLocation();

  if (!authReady) {
    return (
      <div className="min-h-screen bg-[var(--app-bg)]">
        <LoadingOverlay visible label="Loading session" />
      </div>
    );
  }

  if (!token || !user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (user.role !== 'admin') {
    return <Navigate to="/login" state={{ from: location.pathname, adminRequired: true }} replace />;
  }

  return <>{children}</>;
}

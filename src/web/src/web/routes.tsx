import React, { Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';
import styled from 'styled-components';

// Lazy loaded page components
const DashboardPage = React.lazy(() => import('./pages/dashboard/DashboardPage'));
const ReservationsPage = React.lazy(() => import('./pages/reservations/ReservationsPage'));
const GuestsPage = React.lazy(() => import('./pages/guests/GuestsPage'));
const BillingPage = React.lazy(() => import('./pages/billing/BillingPage'));
const HousekeepingPage = React.lazy(() => import('./pages/housekeeping/HousekeepingPage'));
const MaintenancePage = React.lazy(() => import('./pages/maintenance/MaintenancePage'));
const ReportsPage = React.lazy(() => import('./pages/reports/ReportsPage'));

// Styled Components
const LoadingContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  background-color: rgba(255, 255, 255, 0.9);
`;

const ErrorContainer = styled.div`
  padding: 24px;
  margin: 24px;
  border-radius: 8px;
  background-color: #FADBD8;
  border-left: 4px solid #E74C3C;
`;

// Role definitions
export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  HOTEL_MANAGER = 'HOTEL_MANAGER',
  FRONT_DESK = 'FRONT_DESK',
  HOUSEKEEPING = 'HOUSEKEEPING',
  MAINTENANCE = 'MAINTENANCE'
}

// Route access configuration
const routeAccess = {
  dashboard: [UserRole.SUPER_ADMIN, UserRole.HOTEL_MANAGER, UserRole.FRONT_DESK],
  reservations: [UserRole.SUPER_ADMIN, UserRole.HOTEL_MANAGER, UserRole.FRONT_DESK],
  guests: [UserRole.SUPER_ADMIN, UserRole.HOTEL_MANAGER, UserRole.FRONT_DESK],
  billing: [UserRole.SUPER_ADMIN, UserRole.HOTEL_MANAGER],
  housekeeping: [UserRole.SUPER_ADMIN, UserRole.HOTEL_MANAGER, UserRole.HOUSEKEEPING],
  maintenance: [UserRole.SUPER_ADMIN, UserRole.HOTEL_MANAGER, UserRole.MAINTENANCE],
  reports: [UserRole.SUPER_ADMIN, UserRole.HOTEL_MANAGER]
};

// Error Fallback Component
const ErrorFallback: React.FC<{ error: Error }> = ({ error }) => (
  <ErrorContainer role="alert">
    <h2>Something went wrong</h2>
    <p>{error.message}</p>
    <button onClick={() => window.location.reload()}>Retry</button>
  </ErrorContainer>
);

// Loading Component
const LoadingFallback: React.FC = () => (
  <LoadingContainer role="status" aria-live="polite">
    <div>Loading...</div>
  </LoadingContainer>
);

// Protected Route Component
interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: UserRole[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const location = useLocation();
  // TODO: Replace with actual auth logic
  const userRole = UserRole.HOTEL_MANAGER; // Simulated user role
  const isAuthenticated = true; // Simulated auth state

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!allowedRoles.includes(userRole)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <Suspense fallback={<LoadingFallback />}>
        {children}
      </Suspense>
    </ErrorBoundary>
  );
};

// Main Routes Component
const WebRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={
        <ProtectedRoute allowedRoles={routeAccess.dashboard}>
          <DashboardPage />
        </ProtectedRoute>
      } />

      <Route path="/reservations" element={
        <ProtectedRoute allowedRoles={routeAccess.reservations}>
          <ReservationsPage />
        </ProtectedRoute>
      } />

      <Route path="/guests" element={
        <ProtectedRoute allowedRoles={routeAccess.guests}>
          <GuestsPage />
        </ProtectedRoute>
      } />

      <Route path="/billing" element={
        <ProtectedRoute allowedRoles={routeAccess.billing}>
          <BillingPage />
        </ProtectedRoute>
      } />

      <Route path="/housekeeping" element={
        <ProtectedRoute allowedRoles={routeAccess.housekeeping}>
          <HousekeepingPage />
        </ProtectedRoute>
      } />

      <Route path="/maintenance" element={
        <ProtectedRoute allowedRoles={routeAccess.maintenance}>
          <MaintenancePage />
        </ProtectedRoute>
      } />

      <Route path="/reports" element={
        <ProtectedRoute allowedRoles={routeAccess.reports}>
          <ReportsPage />
        </ProtectedRoute>
      } />

      {/* Fallback route for unauthorized access */}
      <Route path="/unauthorized" element={
        <ErrorContainer role="alert">
          <h2>Unauthorized Access</h2>
          <p>You don't have permission to access this resource.</p>
        </ErrorContainer>
      } />

      {/* Catch-all route for 404 */}
      <Route path="*" element={
        <ErrorContainer role="alert">
          <h2>Page Not Found</h2>
          <p>The requested page does not exist.</p>
        </ErrorContainer>
      } />
    </Routes>
  );
};

export default WebRoutes;
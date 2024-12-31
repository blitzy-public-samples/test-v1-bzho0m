import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'; // v6.0.0
import { ErrorBoundary } from 'react-error-boundary'; // v3.1.4
import useAuth from '../../shared/hooks/useAuth';

// Lazy loaded components for code splitting and performance optimization
const LoginScreen = React.lazy(() => import('./pages/auth/LoginScreen'));
const RegisterScreen = React.lazy(() => import('./pages/auth/RegisterScreen'));
const RoomListScreen = React.lazy(() => import('./pages/booking/RoomListScreen'));

// Constants for route configuration
const PUBLIC_ROUTES = ['/login', '/register', '/forgot-password'];
const ROUTE_TRANSITIONS = { enter: 'slide-in', exit: 'slide-out' };
const OFFLINE_FALLBACK_ROUTE = '/offline';

// Loading fallback component with mobile optimization
const LoadingFallback: React.FC = () => (
  <div 
    style={{ 
      height: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center' 
    }}
    role="progressbar"
    aria-label="Loading content"
  >
    Loading...
  </div>
);

// Error fallback component for error boundary
const ErrorFallback: React.FC<{ error: Error }> = ({ error }) => (
  <div 
    role="alert" 
    style={{ 
      padding: '20px',
      textAlign: 'center' 
    }}
  >
    <h2>Something went wrong</h2>
    <pre style={{ color: 'red' }}>{error.message}</pre>
    <button onClick={() => window.location.reload()}>Retry</button>
  </div>
);

// Protected route wrapper with enhanced security checks
interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const location = useLocation();
  const { isAuthenticated, isLoading, tokenExpiry } = useAuth();

  // Check if token is expired or will expire in next 5 minutes
  const isTokenValid = tokenExpiry && tokenExpiry > Date.now() + 300000;

  if (isLoading) {
    return <LoadingFallback />;
  }

  if (!isAuthenticated || !isTokenValid) {
    // Preserve the attempted URL for redirect after login
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      {children}
    </ErrorBoundary>
  );
};

/**
 * Main routing component implementing mobile-optimized navigation
 * with comprehensive security measures and performance optimizations.
 */
const AppRoutes: React.FC = () => {
  return (
    <BrowserRouter>
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          {/* Public Routes */}
          <Route 
            path="/login" 
            element={
              <ErrorBoundary FallbackComponent={ErrorFallback}>
                <LoginScreen />
              </ErrorBoundary>
            } 
          />
          
          <Route 
            path="/register" 
            element={
              <ErrorBoundary FallbackComponent={ErrorFallback}>
                <RegisterScreen />
              </ErrorBoundary>
            } 
          />

          {/* Protected Routes */}
          <Route
            path="/rooms"
            element={
              <ProtectedRoute>
                <RoomListScreen />
              </ProtectedRoute>
            }
          />

          {/* Offline Fallback */}
          <Route 
            path={OFFLINE_FALLBACK_ROUTE} 
            element={
              <div role="alert">
                <h2>You are offline</h2>
                <p>Please check your internet connection and try again.</p>
              </div>
            } 
          />

          {/* Default Redirect */}
          <Route 
            path="/" 
            element={<Navigate to="/rooms" replace />} 
          />

          {/* 404 Fallback */}
          <Route 
            path="*" 
            element={
              <div role="alert">
                <h2>Page Not Found</h2>
                <p>The requested page does not exist.</p>
              </div>
            } 
          />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
};

export default AppRoutes;
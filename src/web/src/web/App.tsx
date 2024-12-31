import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { ThemeProvider } from '@emotion/react';
import styled from '@emotion/styled';
import { ErrorBoundary } from 'react-error-boundary';

import WebRoutes from './routes';
import Header from './components/layout/Header';
import Sidebar from './components/layout/Sidebar';
import { PRIMARY_COLORS, NEUTRAL_COLORS } from '../shared/styles/colors';
import { FONT_FAMILY } from '../shared/styles/typography';

// Styled Components
const AppContainer = styled.div`
  display: flex;
  min-height: 100vh;
  background-color: ${NEUTRAL_COLORS.gray100};
  font-family: ${FONT_FAMILY.primary};
`;

const MainContent = styled.main<{ sidebarCollapsed: boolean }>`
  flex: 1;
  margin-left: ${props => props.sidebarCollapsed ? '64px' : '240px'};
  margin-top: 64px;
  padding: 24px;
  transition: margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  @media (max-width: 768px) {
    margin-left: 0;
    padding: 16px;
  }
`;

const ErrorFallback = styled.div`
  padding: 24px;
  margin: 24px;
  background-color: #FADBD8;
  border-radius: 8px;
  border-left: 4px solid #E74C3C;
`;

// Theme configuration
const theme = {
  colors: {
    primary: PRIMARY_COLORS,
    neutral: NEUTRAL_COLORS,
  },
  typography: {
    fontFamily: FONT_FAMILY.primary,
    fontSize: '16px',
    lineHeight: 1.5,
  },
  spacing: (multiplier: number) => `${multiplier * 8}px`,
};

// Error Boundary component
const ErrorFallbackComponent: React.FC<{ error: Error }> = ({ error }) => (
  <ErrorFallback role="alert">
    <h2>Something went wrong</h2>
    <p>{error.message}</p>
    <button onClick={() => window.location.reload()}>Refresh Page</button>
  </ErrorFallback>
);

/**
 * Root application component that provides the main layout structure,
 * routing configuration, and global state management.
 */
const App: React.FC = () => {
  // State for sidebar collapse
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const stored = localStorage.getItem('sidebarCollapsed');
    return stored ? stored === 'true' : window.innerWidth <= 768;
  });

  // Handle window resize
  const handleWindowResize = useCallback(() => {
    if (window.innerWidth <= 768) {
      setSidebarCollapsed(true);
    }
  }, []);

  // Initialize resize listener
  useEffect(() => {
    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, [handleWindowResize]);

  // Handle sidebar toggle
  const handleSidebarToggle = useCallback(() => {
    setSidebarCollapsed(prev => {
      const newState = !prev;
      localStorage.setItem('sidebarCollapsed', String(newState));
      return newState;
    });
  }, []);

  // Handle errors
  const handleError = useCallback((error: Error) => {
    console.error('Application Error:', error);
    // Additional error logging or analytics could be added here
  }, []);

  return (
    <ErrorBoundary FallbackComponent={ErrorFallbackComponent} onError={handleError}>
      <Provider store={store}>
        <ThemeProvider theme={theme}>
          <BrowserRouter>
            <AppContainer>
              <Header
                title="Hotel Management System"
                onError={handleError}
              />
              <Sidebar
                isCollapsed={sidebarCollapsed}
                onToggle={handleSidebarToggle}
                ariaLabel="Main navigation"
              />
              <MainContent
                sidebarCollapsed={sidebarCollapsed}
                role="main"
                aria-label="Main content"
              >
                <WebRoutes />
              </MainContent>

              {/* Hidden live region for accessibility announcements */}
              <div
                role="status"
                aria-live="polite"
                className="sr-only"
              />
            </AppContainer>
          </BrowserRouter>
        </ThemeProvider>
      </Provider>
    </ErrorBoundary>
  );
};

export default App;
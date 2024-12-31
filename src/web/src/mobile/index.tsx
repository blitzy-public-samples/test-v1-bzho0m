/**
 * @fileoverview Mobile application entry point implementing React initialization,
 * offline capabilities, and mobile-specific optimizations.
 * @version 1.0.0
 */

import React from 'react'; // ^18.0.0
import ReactDOM from 'react-dom/client'; // ^18.0.0
import { Provider } from 'react-redux'; // ^8.1.0
import { initializeAnalytics } from '@analytics/react-native'; // ^1.0.0
import { initializePerformanceMonitoring } from '@performance/react-native'; // ^2.0.0
import { ErrorBoundary } from 'react-error-boundary'; // ^4.0.0

// Internal imports
import App from './App';
import { store } from '../../shared/store/store';

/**
 * Configures mobile viewport settings and meta tags
 */
const setupViewport = (): void => {
  // Create viewport meta if it doesn't exist
  let viewport = document.querySelector('meta[name="viewport"]');
  if (!viewport) {
    viewport = document.createElement('meta');
    viewport.setAttribute('name', 'viewport');
    document.head.appendChild(viewport);
  }

  // Set mobile-optimized viewport settings
  viewport.setAttribute('content', [
    'width=device-width',
    'initial-scale=1.0',
    'maximum-scale=1.0',
    'user-scalable=no',
    'viewport-fit=cover'
  ].join(', '));

  // Add mobile web app capable meta tags
  const metas = [
    { name: 'apple-mobile-web-app-capable', content: 'yes' },
    { name: 'mobile-web-app-capable', content: 'yes' },
    { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
    { name: 'theme-color', content: '#2C3E50' }
  ];

  metas.forEach(({ name, content }) => {
    let meta = document.querySelector(`meta[name="${name}"]`);
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', name);
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', content);
  });
};

/**
 * Initializes mobile application with required configurations
 */
const initializeApp = (): void => {
  // Set up performance monitoring
  initializePerformanceMonitoring({
    sampleRate: IS_DEVELOPMENT ? 1.0 : 0.1,
    tracingOrigins: ['localhost', '*.hotel-domain.com'],
    maxTransactionDuration: 60000
  });

  // Initialize analytics
  initializeAnalytics({
    appId: process.env.REACT_APP_ANALYTICS_ID,
    debug: IS_DEVELOPMENT,
    platform: 'mobile-web'
  });

  // Configure error reporting
  window.onerror = (message, source, lineno, colno, error) => {
    console.error('Global error:', { message, source, lineno, colno, error });
    // In production, send to error tracking service
    if (!IS_DEVELOPMENT) {
      // Implement error tracking service integration
    }
  };

  // Set up offline detection
  window.addEventListener('online', () => {
    store.dispatch({ type: 'reservation/setIsOnline', payload: true });
  });
  
  window.addEventListener('offline', () => {
    store.dispatch({ type: 'reservation/setIsOnline', payload: false });
  });
};

// Error Fallback component
const ErrorFallback: React.FC<{ error: Error; resetErrorBoundary: () => void }> = ({
  error,
  resetErrorBoundary
}) => (
  <div role="alert" style={{ padding: '20px', textAlign: 'center' }}>
    <h2>Something went wrong</h2>
    <pre style={{ color: 'red', margin: '10px 0' }}>{error.message}</pre>
    <button
      onClick={resetErrorBoundary}
      style={{
        padding: '8px 16px',
        backgroundColor: '#2C3E50',
        color: 'white',
        border: 'none',
        borderRadius: '4px'
      }}
    >
      Try again
    </button>
  </div>
);

// Development mode flag
const IS_DEVELOPMENT = process.env.NODE_ENV === 'development';

// Initialize application
setupViewport();
initializeApp();

// Get or create root element
const rootElement = document.getElementById('root') || document.createElement('div');
if (!rootElement.id) {
  rootElement.id = 'root';
  document.body.appendChild(rootElement);
}

// Create React root and render application
const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onReset={() => {
        // Reset app state on error recovery
        window.location.reload();
      }}
      onError={(error) => {
        console.error('Error Boundary caught error:', error);
        // In production, send to error tracking service
        if (!IS_DEVELOPMENT) {
          // Implement error tracking service integration
        }
      }}
    >
      <Provider store={store}>
        <App />
      </Provider>
    </ErrorBoundary>
  </React.StrictMode>
);

// Enable hot module replacement in development
if (IS_DEVELOPMENT && module.hot) {
  module.hot.accept('./App', () => {
    const NextApp = require('./App').default;
    root.render(
      <React.StrictMode>
        <ErrorBoundary FallbackComponent={ErrorFallback}>
          <Provider store={store}>
            <NextApp />
          </Provider>
        </ErrorBoundary>
      </React.StrictMode>
    );
  });
}
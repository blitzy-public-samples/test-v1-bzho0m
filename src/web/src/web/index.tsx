import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { Global, css } from '@emotion/react';
import { ErrorBoundary } from 'react-error-boundary';
import * as Sentry from '@sentry/react';

import App from './App';
import store from '../shared/store/store';
import { PRIMARY_COLORS, NEUTRAL_COLORS } from '../shared/styles/colors';
import { FONT_FAMILY, FONT_SIZE, LINE_HEIGHT } from '../shared/styles/typography';

// Initialize Sentry for error tracking
Sentry.init({
  dsn: process.env.REACT_APP_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,
  integrations: [
    new Sentry.BrowserTracing(),
    new Sentry.Replay({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
});

// Global styles definition
const globalStyles = css`
  :root {
    --primary-color: ${PRIMARY_COLORS.main};
    --secondary-color: ${PRIMARY_COLORS.light};
    --accent-color: ${PRIMARY_COLORS.dark};
    --background-color: ${NEUTRAL_COLORS.gray100};
    --text-color: ${NEUTRAL_COLORS.gray900};
    --spacing-unit: 8px;
  }

  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  html, body {
    height: 100%;
    width: 100%;
    font-family: ${FONT_FAMILY.primary};
    font-size: ${FONT_SIZE.body};
    line-height: ${LINE_HEIGHT.normal};
    background-color: var(--background-color);
    color: var(--text-color);
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  #root {
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  /* Accessibility styles */
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  /* Focus styles for keyboard navigation */
  :focus-visible {
    outline: 2px solid ${PRIMARY_COLORS.main};
    outline-offset: 2px;
  }

  /* Scrollbar styles */
  ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  ::-webkit-scrollbar-track {
    background: ${NEUTRAL_COLORS.gray200};
  }

  ::-webkit-scrollbar-thumb {
    background: ${NEUTRAL_COLORS.gray400};
    border-radius: 4px;
  }

  ::-webkit-scrollbar-thumb:hover {
    background: ${NEUTRAL_COLORS.gray500};
  }
`;

// Error Fallback component
const ErrorFallback: React.FC<{ error: Error }> = ({ error }) => (
  <div role="alert" style={{ padding: '20px', textAlign: 'center' }}>
    <h2>Something went wrong</h2>
    <pre style={{ color: 'red' }}>{error.message}</pre>
    <button
      onClick={() => window.location.reload()}
      style={{
        marginTop: '10px',
        padding: '8px 16px',
        background: PRIMARY_COLORS.main,
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
      }}
    >
      Reload Application
    </button>
  </div>
);

// Initialize application services
const initializeApp = async (): Promise<void> => {
  // Load any required configuration or services
  if (process.env.NODE_ENV === 'development') {
    console.log('Application initializing in development mode');
  }
};

// Render application
const renderApp = (): void => {
  const rootElement = document.getElementById('root');
  if (!rootElement) throw new Error('Root element not found');

  const root = ReactDOM.createRoot(rootElement);

  root.render(
    <React.StrictMode>
      <ErrorBoundary
        FallbackComponent={ErrorFallback}
        onError={(error) => {
          console.error('Application Error:', error);
          Sentry.captureException(error);
        }}
      >
        <Provider store={store}>
          <Global styles={globalStyles} />
          <App />
        </Provider>
      </ErrorBoundary>
    </React.StrictMode>
  );
};

// Initialize and render application
initializeApp()
  .then(renderApp)
  .catch((error) => {
    console.error('Failed to initialize application:', error);
    Sentry.captureException(error);
  });

// Enable hot module replacement in development
if (process.env.NODE_ENV === 'development' && module.hot) {
  module.hot.accept('./App', renderApp);
}

// Handle unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  Sentry.captureException(event.reason);
});
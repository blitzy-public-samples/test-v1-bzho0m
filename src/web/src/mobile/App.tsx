import React, { useEffect, useState } from 'react';
import { Provider } from 'react-redux'; // v8.1.0
import { ThemeProvider, CssBaseline, createTheme } from '@mui/material'; // v5.0.0
import { ErrorBoundary } from 'react-error-boundary'; // v4.0.0
import NetInfo, { NetInfoState } from '@react-native-community/netinfo'; // v9.0.0
import { io, Socket } from 'socket.io-client'; // v4.0.0
import { BiometryType, ReactNativeBiometrics } from '@react-native-community/biometrics'; // v3.0.0

// Internal imports
import AppRoutes from './routes';
import { store } from '../../shared/store/store';
import { setIsOnline } from '../../shared/store/reservation.slice';
import { PRIMARY_COLORS, NEUTRAL_COLORS } from '../../shared/styles/colors';
import { TYPOGRAPHY, SPACING } from '../../shared/constants/theme.constants';

// Create theme instance
const theme = createTheme({
  palette: {
    primary: {
      main: PRIMARY_COLORS.main,
      light: PRIMARY_COLORS.light,
      dark: PRIMARY_COLORS.dark,
    },
    background: {
      default: NEUTRAL_COLORS.gray100,
      paper: NEUTRAL_COLORS.white,
    },
  },
  typography: {
    fontFamily: TYPOGRAPHY.fontFamily.primary,
    fontSize: parseInt(TYPOGRAPHY.fontSize.body),
    h1: { fontSize: TYPOGRAPHY.fontSize.h1 },
    h2: { fontSize: TYPOGRAPHY.fontSize.h2 },
    h3: { fontSize: TYPOGRAPHY.fontSize.h3 },
    body1: { fontSize: TYPOGRAPHY.fontSize.body },
  },
  spacing: SPACING.base,
});

// WebSocket instance for real-time updates
let socket: Socket | null = null;

// Error Fallback component
const ErrorFallback: React.FC<{ error: Error; resetErrorBoundary: () => void }> = ({
  error,
  resetErrorBoundary,
}) => (
  <div
    style={{
      padding: SPACING.lg,
      backgroundColor: NEUTRAL_COLORS.white,
      borderRadius: '8px',
      textAlign: 'center',
    }}
    role="alert"
  >
    <h2 style={{ color: PRIMARY_COLORS.error }}>Something went wrong</h2>
    <pre style={{ color: PRIMARY_COLORS.error, margin: SPACING.md }}>
      {error.message}
    </pre>
    <button
      onClick={resetErrorBoundary}
      style={{
        padding: `${SPACING.sm}px ${SPACING.md}px`,
        backgroundColor: PRIMARY_COLORS.main,
        color: NEUTRAL_COLORS.white,
        border: 'none',
        borderRadius: '4px',
      }}
    >
      Try again
    </button>
  </div>
);

/**
 * Root application component that sets up providers and core functionality
 * including offline support, real-time updates, and biometric authentication
 */
const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [biometryType, setBiometryType] = useState<BiometryType | null>(null);

  // Initialize biometric authentication
  useEffect(() => {
    const initBiometrics = async () => {
      const rnBiometrics = new ReactNativeBiometrics();
      const { available, biometryType } = await rnBiometrics.isSensorAvailable();
      if (available) {
        setBiometryType(biometryType);
      }
    };

    initBiometrics().catch(console.error);
  }, []);

  // Initialize network status monitoring
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      store.dispatch(setIsOnline(state.isConnected ?? false));
      
      // Handle WebSocket connection based on network status
      if (state.isConnected && !socket?.connected) {
        socket = io(process.env.REACT_APP_WEBSOCKET_URL || '', {
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
        });
      } else if (!state.isConnected && socket?.connected) {
        socket.disconnect();
      }
    });

    return () => {
      unsubscribe();
      socket?.disconnect();
      socket = null;
    };
  }, []);

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onReset={() => {
        // Reset app state on error recovery
        window.location.reload();
      }}
    >
      <Provider store={store}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <AppRoutes />
        </ThemeProvider>
      </Provider>
    </ErrorBoundary>
  );
};

export default App;
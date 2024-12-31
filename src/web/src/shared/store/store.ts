/**
 * @fileoverview Root Redux store configuration with real-time synchronization,
 * performance optimizations, and comprehensive error handling
 * @version 1.0.0
 */

// External imports - versions specified in package.json
import { configureStore, Middleware } from '@reduxjs/toolkit'; // ^1.9.5
import { createListenerMiddleware, addListener } from '@reduxjs/toolkit'; // ^1.9.5
import logger from 'redux-logger'; // ^3.0.6

// Internal imports
import authReducer from './auth.slice';
import billingReducer from './billing.slice';
import guestReducer from './guest.slice';
import roomReducer from './room.slice';
import reservationReducer from './reservation.slice';

// Create listener middleware for real-time synchronization
const listenerMiddleware = createListenerMiddleware();

/**
 * Custom error handling middleware
 */
const errorMiddleware: Middleware = () => (next) => (action) => {
  try {
    return next(action);
  } catch (error) {
    console.error('Store Error:', error);
    // Log to monitoring service in production
    if (process.env.NODE_ENV === 'production') {
      // Implement error reporting service integration
    }
    throw error;
  }
};

/**
 * Performance monitoring middleware
 */
const performanceMiddleware: Middleware = () => (next) => (action) => {
  const start = performance.now();
  const result = next(action);
  const duration = performance.now() - start;

  // Log slow actions in development
  if (duration > 100) {
    console.warn(`Slow action: ${action.type} took ${duration.toFixed(2)}ms`);
  }

  return result;
};

/**
 * Configure and create the Redux store with all middleware and enhancers
 */
const configureAppStore = () => {
  // Middleware array with conditional development tools
  const middleware = [
    listenerMiddleware.middleware,
    errorMiddleware,
    performanceMiddleware,
  ];

  // Add logger in development only
  if (process.env.NODE_ENV === 'development') {
    middleware.push(logger);
  }

  // Configure store with all reducers and middleware
  const store = configureStore({
    reducer: {
      auth: authReducer,
      billing: billingReducer,
      guest: guestReducer,
      room: roomReducer,
      reservation: reservationReducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        // Enable serialization and immutability checks in development
        serializableCheck: process.env.NODE_ENV === 'development',
        immutableCheck: process.env.NODE_ENV === 'development',
        // Increase thunk timeout for complex operations
        thunk: {
          extraArgument: undefined,
          timeout: 10000,
        },
      }).concat(middleware),
    devTools: process.env.NODE_ENV !== 'production',
  });

  // Enable hot module replacement for reducers in development
  if (process.env.NODE_ENV === 'development' && module.hot) {
    module.hot.accept(
      [
        './auth.slice',
        './billing.slice',
        './guest.slice',
        './room.slice',
        './reservation.slice',
      ],
      () => {
        store.replaceReducer({
          auth: require('./auth.slice').default,
          billing: require('./billing.slice').default,
          guest: require('./guest.slice').default,
          room: require('./room.slice').default,
          reservation: require('./reservation.slice').default,
        });
      }
    );
  }

  return store;
};

// Create store instance
export const store = configureAppStore();

// Export store state type for type-safe usage
export type RootState = ReturnType<typeof store.getState>;

// Export dispatch type for type-safe dispatching
export type AppDispatch = typeof store.dispatch;

// Export store instance and types
export default store;
// @ts-check
import { createSlice, createAsyncThunk, createSelector, PayloadAction } from '@reduxjs/toolkit';
import { validateEmail } from '../utils/validation.util';

// v1.9.0 - Redux Toolkit for state management
// Constants for auth configuration
const TOKEN_REFRESH_INTERVAL = 5400000; // 90 minutes in milliseconds
const MAX_RETRY_ATTEMPTS = 3;
const TOKEN_EXPIRY_BUFFER = 300000; // 5 minutes buffer for token refresh

// Interfaces
interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  lastLogin: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: AuthError | null;
  tokenExpiry: number | null;
  lastRefreshAttempt: number | null;
  retryCount: number;
  roles: string[];
}

interface AuthError {
  code: string;
  message: string;
  details: Record<string, unknown>;
  timestamp: number;
}

interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

interface TokenResponse {
  token: string;
  refreshToken: string;
  expiresIn: number;
  user: User;
}

// Initial state
const initialState: AuthState = {
  user: null,
  token: null,
  refreshToken: null,
  isAuthenticated: false,
  loading: false,
  error: null,
  tokenExpiry: null,
  lastRefreshAttempt: null,
  retryCount: 0,
  roles: [],
};

// Async thunks
export const loginAsync = createAsyncThunk(
  'auth/login',
  async (credentials: LoginCredentials, { rejectWithValue }) => {
    try {
      // Validate email format
      const emailValidation = validateEmail(credentials.email);
      if (!emailValidation.isValid) {
        return rejectWithValue({
          code: 'INVALID_EMAIL',
          message: emailValidation.error,
          details: {},
          timestamp: Date.now(),
        });
      }

      // API call to authentication endpoint
      const response = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });

      if (!response.ok) {
        const error = await response.json();
        return rejectWithValue({
          code: error.code || 'AUTH_ERROR',
          message: error.message || 'Authentication failed',
          details: error.details || {},
          timestamp: Date.now(),
        });
      }

      const data: TokenResponse = await response.json();
      
      // Calculate token expiry
      const expiryTime = Date.now() + data.expiresIn * 1000;

      // Store tokens if rememberMe is true
      if (credentials.rememberMe) {
        localStorage.setItem('refreshToken', data.refreshToken);
      } else {
        sessionStorage.setItem('refreshToken', data.refreshToken);
      }

      return {
        user: data.user,
        token: data.token,
        refreshToken: data.refreshToken,
        tokenExpiry: expiryTime,
        roles: data.user.roles,
      };
    } catch (error) {
      return rejectWithValue({
        code: 'NETWORK_ERROR',
        message: 'Network error occurred',
        details: { error },
        timestamp: Date.now(),
      });
    }
  }
);

export const refreshTokenAsync = createAsyncThunk(
  'auth/refresh',
  async (_, { getState, rejectWithValue }) => {
    const state = getState() as { auth: AuthState };
    const { refreshToken, retryCount } = state.auth;

    if (retryCount >= MAX_RETRY_ATTEMPTS) {
      return rejectWithValue({
        code: 'MAX_RETRY_EXCEEDED',
        message: 'Maximum token refresh attempts exceeded',
        details: {},
        timestamp: Date.now(),
      });
    }

    try {
      const response = await fetch('/api/v1/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${refreshToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const data: TokenResponse = await response.json();
      const expiryTime = Date.now() + data.expiresIn * 1000;

      return {
        token: data.token,
        refreshToken: data.refreshToken,
        tokenExpiry: expiryTime,
        lastRefreshAttempt: Date.now(),
      };
    } catch (error) {
      return rejectWithValue({
        code: 'REFRESH_ERROR',
        message: 'Failed to refresh token',
        details: { error },
        timestamp: Date.now(),
      });
    }
  }
);

// Create the auth slice
const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout: (state) => {
      localStorage.removeItem('refreshToken');
      sessionStorage.removeItem('refreshToken');
      return { ...initialState };
    },
    clearError: (state) => {
      state.error = null;
    },
    updateTokenExpiry: (state, action: PayloadAction<number>) => {
      state.tokenExpiry = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      // Login cases
      .addCase(loginAsync.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginAsync.fulfilled, (state, action) => {
        state.loading = false;
        state.isAuthenticated = true;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.refreshToken = action.payload.refreshToken;
        state.tokenExpiry = action.payload.tokenExpiry;
        state.roles = action.payload.roles;
        state.retryCount = 0;
      })
      .addCase(loginAsync.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as AuthError;
      })
      // Token refresh cases
      .addCase(refreshTokenAsync.pending, (state) => {
        state.loading = true;
      })
      .addCase(refreshTokenAsync.fulfilled, (state, action) => {
        state.loading = false;
        state.token = action.payload.token;
        state.refreshToken = action.payload.refreshToken;
        state.tokenExpiry = action.payload.tokenExpiry;
        state.lastRefreshAttempt = action.payload.lastRefreshAttempt;
        state.retryCount = 0;
      })
      .addCase(refreshTokenAsync.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as AuthError;
        state.retryCount += 1;
        if (state.retryCount >= MAX_RETRY_ATTEMPTS) {
          state.isAuthenticated = false;
          state.user = null;
          state.token = null;
          state.refreshToken = null;
        }
      });
  },
});

// Selectors
export const selectAuth = (state: { auth: AuthState }) => state.auth;

export const selectUserRoles = createSelector(
  [selectAuth],
  (auth) => auth.roles
);

export const selectTokenStatus = createSelector(
  [selectAuth],
  (auth) => ({
    isValid: auth.token !== null && 
             auth.tokenExpiry !== null && 
             auth.tokenExpiry > Date.now() + TOKEN_EXPIRY_BUFFER,
    expiresIn: auth.tokenExpiry ? auth.tokenExpiry - Date.now() : 0,
  })
);

// Export actions and reducer
export const { logout, clearError, updateTokenExpiry } = authSlice.actions;
export default authSlice.reducer;
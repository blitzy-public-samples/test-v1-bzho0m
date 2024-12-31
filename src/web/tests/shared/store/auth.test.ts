import { configureStore } from '@reduxjs/toolkit';
import { describe, beforeEach, test, expect, jest } from '@jest/globals';
import reducer, {
  loginAsync,
  logoutAsync,
  refreshTokenAsync,
  selectAuth,
  actions
} from '../../src/shared/store/auth.slice';

// Test store configuration
const createTestStore = () => {
  return configureStore({
    reducer: { auth: reducer }
  });
};

// Mock data
const mockUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  roles: ['staff'],
  lastLogin: new Date().toISOString()
};

const mockTokenResponse = {
  token: 'mock-jwt-token',
  refreshToken: 'mock-refresh-token',
  expiresIn: 7200, // 2 hours
  user: mockUser
};

// Mock fetch globally
global.fetch = jest.fn();
// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
};
global.localStorage = localStorageMock;
global.sessionStorage = { ...localStorageMock };

describe('Auth Slice', () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
    jest.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    (global.fetch as jest.Mock).mockReset();
  });

  test('initial state', () => {
    const state = selectAuth(store.getState());
    expect(state).toEqual({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      loading: false,
      error: null,
      tokenExpiry: null,
      lastRefreshAttempt: null,
      retryCount: 0,
      roles: []
    });
  });

  test('loginAsync success with remember me', async () => {
    // Mock successful login response
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockTokenResponse)
    });

    const credentials = {
      email: 'test@example.com',
      password: 'Test123!',
      rememberMe: true
    };

    // Dispatch login action
    await store.dispatch(loginAsync(credentials));
    const state = selectAuth(store.getState());

    // Verify state updates
    expect(state.isAuthenticated).toBe(true);
    expect(state.user).toEqual(mockUser);
    expect(state.token).toBe(mockTokenResponse.token);
    expect(state.refreshToken).toBe(mockTokenResponse.refreshToken);
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
    expect(state.roles).toEqual(mockUser.roles);

    // Verify localStorage
    expect(localStorage.setItem).toHaveBeenCalledWith(
      'refreshToken',
      mockTokenResponse.refreshToken
    );
  });

  test('loginAsync success with session storage', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockTokenResponse)
    });

    const credentials = {
      email: 'test@example.com',
      password: 'Test123!',
      rememberMe: false
    };

    await store.dispatch(loginAsync(credentials));

    expect(sessionStorage.setItem).toHaveBeenCalledWith(
      'refreshToken',
      mockTokenResponse.refreshToken
    );
    expect(localStorage.setItem).not.toHaveBeenCalled();
  });

  test('loginAsync failure with invalid email', async () => {
    const credentials = {
      email: 'invalid-email',
      password: 'Test123!'
    };

    await store.dispatch(loginAsync(credentials));
    const state = selectAuth(store.getState());

    expect(state.isAuthenticated).toBe(false);
    expect(state.error).toEqual(expect.objectContaining({
      code: 'INVALID_EMAIL'
    }));
  });

  test('loginAsync failure with API error', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password'
      })
    });

    const credentials = {
      email: 'test@example.com',
      password: 'wrong-password'
    };

    await store.dispatch(loginAsync(credentials));
    const state = selectAuth(store.getState());

    expect(state.isAuthenticated).toBe(false);
    expect(state.error).toEqual(expect.objectContaining({
      code: 'INVALID_CREDENTIALS'
    }));
  });

  test('refreshTokenAsync success', async () => {
    const newTokenResponse = {
      token: 'new-jwt-token',
      refreshToken: 'new-refresh-token',
      expiresIn: 7200
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(newTokenResponse)
    });

    // Setup initial state with existing token
    store.dispatch(actions.updateTokenExpiry(Date.now() - 1000)); // Expired token

    await store.dispatch(refreshTokenAsync());
    const state = selectAuth(store.getState());

    expect(state.token).toBe(newTokenResponse.token);
    expect(state.refreshToken).toBe(newTokenResponse.refreshToken);
    expect(state.tokenExpiry).toBeGreaterThan(Date.now());
    expect(state.retryCount).toBe(0);
  });

  test('refreshTokenAsync failure with max retries', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({
        code: 'REFRESH_ERROR',
        message: 'Token refresh failed'
      })
    });

    // Setup initial state with max retries
    store.dispatch(actions.updateTokenExpiry(Date.now() - 1000));
    
    // Attempt refresh multiple times
    for (let i = 0; i < 4; i++) {
      await store.dispatch(refreshTokenAsync());
    }

    const state = selectAuth(store.getState());
    expect(state.isAuthenticated).toBe(false);
    expect(state.token).toBeNull();
    expect(state.refreshToken).toBeNull();
    expect(state.retryCount).toBeGreaterThanOrEqual(3);
  });

  test('logout action', () => {
    // Setup authenticated state
    store.dispatch(actions.loginAsync.fulfilled(mockTokenResponse, 'requestId', {
      email: 'test@example.com',
      password: 'Test123!'
    }));

    // Dispatch logout
    store.dispatch(actions.logout());
    const state = selectAuth(store.getState());

    // Verify state reset
    expect(state).toEqual({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      loading: false,
      error: null,
      tokenExpiry: null,
      lastRefreshAttempt: null,
      retryCount: 0,
      roles: []
    });

    // Verify storage cleanup
    expect(localStorage.removeItem).toHaveBeenCalledWith('refreshToken');
    expect(sessionStorage.removeItem).toHaveBeenCalledWith('refreshToken');
  });

  test('clearError action', () => {
    // Setup state with error
    store.dispatch(actions.loginAsync.rejected(null, 'requestId', {
      email: 'test@example.com',
      password: 'wrong-password'
    }, {
      code: 'TEST_ERROR',
      message: 'Test error message',
      details: {},
      timestamp: Date.now()
    }));

    // Clear error
    store.dispatch(actions.clearError());
    const state = selectAuth(store.getState());

    expect(state.error).toBeNull();
  });
});
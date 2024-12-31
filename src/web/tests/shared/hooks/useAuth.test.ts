import { renderHook, act } from '@testing-library/react-hooks'; // v8.0.1
import { Provider } from 'react-redux'; // v8.1.0
import { configureStore } from '@reduxjs/toolkit'; // v1.9.0
import { describe, beforeEach, it, expect, jest } from '@jest/globals'; // v29.0.0

import { useAuth } from '../../src/shared/hooks/useAuth';
import { loginAsync, logoutAsync, refreshTokenAsync } from '../../src/shared/store/auth.slice';
import { validateEmail } from '../../src/shared/utils/validation.util';

// Mock Redux store setup
const mockStore = configureStore({
  reducer: {
    auth: (state = {
      user: null,
      isAuthenticated: false,
      loading: false,
      error: null,
      tokenExpiry: null,
      roles: [],
    }, action) => state
  }
});

// Mock test data
const TEST_USER = {
  id: '123',
  email: 'test@hotel.com',
  firstName: 'Test',
  lastName: 'User',
  roles: ['FRONT_DESK'],
  lastLogin: new Date().toISOString()
};

const TEST_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';

// Mock Redux actions
jest.mock('../../src/shared/store/auth.slice', () => ({
  loginAsync: jest.fn(),
  logoutAsync: jest.fn(),
  refreshTokenAsync: jest.fn()
}));

describe('useAuth hook', () => {
  // Mock implementations
  const mockLoginAsync = loginAsync as jest.MockedFunction<typeof loginAsync>;
  const mockLogoutAsync = logoutAsync as jest.MockedFunction<typeof logoutAsync>;
  const mockRefreshTokenAsync = refreshTokenAsync as jest.MockedFunction<typeof refreshTokenAsync>;

  // Test wrapper component
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <Provider store={mockStore}>{children}</Provider>
  );

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  it('should initialize with default unauthenticated state', () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should handle successful login', async () => {
    const credentials = {
      email: 'test@hotel.com',
      password: 'Test123!',
      rememberMe: true
    };

    mockLoginAsync.mockResolvedValueOnce({
      user: TEST_USER,
      token: TEST_TOKEN,
      tokenExpiry: Date.now() + 7200000 // 2 hours
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.login(credentials);
    });

    expect(mockLoginAsync).toHaveBeenCalledWith(credentials);
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toEqual(TEST_USER);
    expect(result.current.error).toBeNull();
  });

  it('should handle login validation errors', async () => {
    const invalidCredentials = {
      email: 'invalid-email',
      password: 'test'
    };

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      try {
        await result.current.login(invalidCredentials);
      } catch (error) {
        expect(error.message).toBe('Invalid email format');
      }
    });

    expect(mockLoginAsync).not.toHaveBeenCalled();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('should handle successful logout', async () => {
    mockLogoutAsync.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.logout();
    });

    expect(mockLogoutAsync).toHaveBeenCalled();
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it('should handle token refresh', async () => {
    // Setup initial authenticated state
    mockLoginAsync.mockResolvedValueOnce({
      user: TEST_USER,
      token: TEST_TOKEN,
      tokenExpiry: Date.now() + 7200000
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    // Perform initial login
    await act(async () => {
      await result.current.login({
        email: 'test@hotel.com',
        password: 'Test123!'
      });
    });

    // Mock refresh token response
    mockRefreshTokenAsync.mockResolvedValueOnce({
      token: 'new-token',
      tokenExpiry: Date.now() + 7200000
    });

    // Advance timers to trigger refresh
    await act(async () => {
      jest.advanceTimersByTime(5400000); // 90 minutes
    });

    expect(mockRefreshTokenAsync).toHaveBeenCalled();
    expect(result.current.isAuthenticated).toBe(true);
  });

  it('should handle failed token refresh', async () => {
    mockRefreshTokenAsync.mockRejectedValueOnce(new Error('Refresh failed'));

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      jest.advanceTimersByTime(5400000);
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.error).not.toBeNull();
  });

  it('should cleanup refresh timer on unmount', () => {
    const { unmount } = renderHook(() => useAuth(), { wrapper });

    const clearIntervalSpy = jest.spyOn(window, 'clearInterval');
    
    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();
  });

  it('should handle network errors during login', async () => {
    mockLoginAsync.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      try {
        await result.current.login({
          email: 'test@hotel.com',
          password: 'Test123!'
        });
      } catch (error) {
        expect(error.message).toBe('Network error');
      }
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.error).not.toBeNull();
  });

  it('should validate user roles after login', async () => {
    mockLoginAsync.mockResolvedValueOnce({
      user: TEST_USER,
      token: TEST_TOKEN,
      tokenExpiry: Date.now() + 7200000
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.login({
        email: 'test@hotel.com',
        password: 'Test123!'
      });
    });

    expect(result.current.user?.roles).toContain('FRONT_DESK');
  });
});
import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { axe, toHaveNoViolations } from 'axe-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

import ProfileScreen from '../../src/mobile/pages/profile/ProfileScreen';
import PreferencesScreen from '../../src/mobile/pages/profile/PreferencesScreen';
import { useAuth } from '../../../src/shared/hooks/useAuth';

// Mock dependencies
jest.mock('@react-native-async-storage/async-storage');
jest.mock('expo-haptics');
jest.mock('@react-native-community/netinfo', () => ({
  useNetworkStatus: () => ({ isConnected: true })
}));
jest.mock('../../../src/shared/hooks/useAuth');

// Mock secure storage for sensitive data
const mockSecureStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn()
};

// Mock navigation
const mockNavigation = {
  navigate: jest.fn(),
  reset: jest.fn()
};

// Test data
const mockUser = {
  id: '123',
  firstName: 'John',
  lastName: 'Doe',
  email: 'john.doe@example.com',
  preferences: {
    roomType: 'Deluxe',
    floorLevel: 5,
    smokingRoom: false,
    bedType: ['King'],
    temperature: '22'
  }
};

describe('ProfileScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({
      isAuthenticated: true,
      user: mockUser,
      logout: jest.fn(),
      validateSession: jest.fn()
    });
  });

  // Security Tests
  describe('Security Features', () => {
    it('should securely handle sensitive user data', async () => {
      const { getByText, queryByText } = render(<ProfileScreen />);
      
      // Verify PII data is properly masked
      expect(getByText('john.d•••@example.com')).toBeTruthy();
      expect(queryByText(mockUser.email)).toBeFalsy();
      
      // Verify secure storage usage
      expect(mockSecureStorage.getItem).toHaveBeenCalledWith('user_profile');
    });

    it('should handle session expiry correctly', async () => {
      const { getByText } = render(<ProfileScreen />);
      
      // Simulate session expiry
      (useAuth as jest.Mock).mockReturnValueOnce({
        isAuthenticated: false,
        user: null
      });

      await waitFor(() => {
        expect(mockNavigation.reset).toHaveBeenCalledWith({
          index: 0,
          routes: [{ name: 'Login' }]
        });
      });
    });
  });

  // Accessibility Tests
  describe('Accessibility Compliance', () => {
    it('should meet WCAG 2.1 AA standards', async () => {
      const { container } = render(<ProfileScreen />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should support screen reader navigation', () => {
      const { getByLabelText } = render(<ProfileScreen />);
      
      expect(getByLabelText('Profile Screen')).toBeTruthy();
      expect(getByLabelText('Edit Profile Button')).toBeTruthy();
      expect(getByLabelText('Logout Button')).toBeTruthy();
    });
  });

  // Offline Capability Tests
  describe('Offline Support', () => {
    it('should handle offline data persistence', async () => {
      const { getByText, rerender } = render(<ProfileScreen />);
      
      // Simulate going offline
      jest.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
      
      // Update profile data
      await act(async () => {
        fireEvent.press(getByText('Save'));
      });

      // Verify data was cached
      expect(AsyncStorage.setItem).toHaveBeenCalled();
      
      // Verify offline indicator
      expect(getByText('Offline Mode')).toBeTruthy();
    });

    it('should sync data when connection is restored', async () => {
      const { rerender } = render(<ProfileScreen />);
      
      // Simulate coming back online
      jest.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
      rerender(<ProfileScreen />);
      
      await waitFor(() => {
        expect(AsyncStorage.getItem).toHaveBeenCalled();
        // Verify sync occurred
        expect(mockSecureStorage.setItem).toHaveBeenCalled();
      });
    });
  });
});

describe('PreferencesScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Preference Management Tests
  describe('Preference Updates', () => {
    it('should handle preference changes with haptic feedback', async () => {
      const { getByLabelText } = render(<PreferencesScreen />);
      
      await act(async () => {
        fireEvent(getByLabelText('Temperature Slider'), 'valueChange', '23');
      });

      expect(Haptics.selectionAsync).toHaveBeenCalled();
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'guest_preferences',
        expect.stringContaining('"temperature":"23"')
      );
    });

    it('should validate preference constraints', async () => {
      const { getByLabelText, getByText } = render(<PreferencesScreen />);
      
      // Test invalid temperature
      await act(async () => {
        fireEvent(getByLabelText('Temperature Slider'), 'valueChange', '35');
      });

      expect(getByText('Temperature must be between 18°C and 30°C')).toBeTruthy();
    });
  });

  // Performance Tests
  describe('Performance Metrics', () => {
    it('should render within performance budget', async () => {
      const startTime = performance.now();
      
      render(<PreferencesScreen />);
      
      const endTime = performance.now();
      const renderTime = endTime - startTime;
      
      expect(renderTime).toBeLessThan(100); // 100ms budget
    });

    it('should handle rapid preference updates efficiently', async () => {
      const { getByLabelText } = render(<PreferencesScreen />);
      
      const updateCount = 10;
      const startTime = performance.now();
      
      for (let i = 0; i < updateCount; i++) {
        await act(async () => {
          fireEvent(getByLabelText('Temperature Slider'), 'valueChange', String(20 + i));
        });
      }
      
      const endTime = performance.now();
      const averageUpdateTime = (endTime - startTime) / updateCount;
      
      expect(averageUpdateTime).toBeLessThan(16); // 16ms per frame budget
    });
  });

  // Error Handling Tests
  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      const mockError = new Error('API Error');
      jest.spyOn(global, 'fetch').mockRejectedValueOnce(mockError);
      
      const { getByText } = render(<PreferencesScreen />);
      
      await act(async () => {
        fireEvent.press(getByText('Save Preferences'));
      });
      
      expect(getByText('Failed to save preferences. Please try again.')).toBeTruthy();
    });

    it('should retry failed operations with exponential backoff', async () => {
      const mockFetch = jest.spyOn(global, 'fetch').mockRejectedValue(new Error());
      
      render(<PreferencesScreen />);
      
      await act(async () => {
        // Wait for retry attempts
        await new Promise(resolve => setTimeout(resolve, 3000));
      });
      
      // Verify exponential backoff pattern
      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(mockFetch.mock.calls[1][1].headers.retry).toBe('1');
      expect(mockFetch.mock.calls[2][1].headers.retry).toBe('2');
    });
  });
});
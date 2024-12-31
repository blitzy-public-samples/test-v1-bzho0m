import React from 'react';
import { render, fireEvent, waitFor, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { axe, toHaveNoViolations } from 'jest-axe';
import { BrowserRouter } from 'react-router-dom';
import LoginScreen from '../../../src/mobile/pages/auth/LoginScreen';
import RegisterScreen from '../../../src/mobile/pages/auth/RegisterScreen';
import authReducer from '../../../src/shared/store/auth.slice';

// Add jest-axe matchers
expect.extend(toHaveNoViolations);

// Test store setup
const createTestStore = (initialState = {}) => {
  return configureStore({
    reducer: {
      auth: authReducer
    },
    preloadedState: initialState
  });
};

// Helper to render with providers
const renderWithProviders = (
  ui: React.ReactElement,
  {
    initialState = {},
    store = createTestStore(initialState),
    ...renderOptions
  } = {}
) => {
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <Provider store={store}>
      <BrowserRouter>
        {children}
      </BrowserRouter>
    </Provider>
  );
  return render(ui, { wrapper: Wrapper, ...renderOptions });
};

// Mock viewport for mobile testing
const setupMobileViewport = () => {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: 375 // iPhone SE width
  });
  
  window.matchMedia = jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn()
  }));
};

describe('LoginScreen', () => {
  beforeEach(() => {
    setupMobileViewport();
    jest.clearAllMocks();
  });

  describe('Rendering and Accessibility', () => {
    it('should render without accessibility violations', async () => {
      const { container } = renderWithProviders(<LoginScreen />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have proper ARIA labels and roles', () => {
      renderWithProviders(<LoginScreen />);
      expect(screen.getByRole('main')).toBeInTheDocument();
      expect(screen.getByRole('form')).toBeInTheDocument();
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('should show email validation errors', async () => {
      renderWithProviders(<LoginScreen />);
      const emailInput = screen.getByLabelText(/email/i);
      
      await userEvent.type(emailInput, 'invalid-email');
      await userEvent.tab(); // Trigger blur event
      
      expect(await screen.findByText(/invalid email format/i)).toBeInTheDocument();
    });

    it('should show password validation errors', async () => {
      renderWithProviders(<LoginScreen />);
      const passwordInput = screen.getByLabelText(/password/i);
      
      await userEvent.type(passwordInput, '123');
      await userEvent.tab();
      
      expect(await screen.findByText(/password must be at least 8 characters/i)).toBeInTheDocument();
    });
  });

  describe('Authentication Flow', () => {
    it('should handle successful login', async () => {
      const mockLogin = jest.fn().mockResolvedValue({});
      const store = createTestStore({
        auth: { loading: false, error: null }
      });
      
      renderWithProviders(<LoginScreen />, { store });
      
      await userEvent.type(screen.getByLabelText(/email/i), 'test@example.com');
      await userEvent.type(screen.getByLabelText(/password/i), 'Password123!');
      await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
      
      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'Password123!'
        });
      });
    });

    it('should display error messages from failed login', async () => {
      const store = createTestStore({
        auth: { loading: false, error: 'Invalid credentials' }
      });
      
      renderWithProviders(<LoginScreen />, { store });
      expect(screen.getByRole('alert')).toHaveTextContent('Invalid credentials');
    });
  });

  describe('Mobile Responsiveness', () => {
    it('should adjust layout for mobile viewport', () => {
      renderWithProviders(<LoginScreen />);
      const loginCard = screen.getByRole('main');
      
      expect(window.getComputedStyle(loginCard).padding).toBe('16px');
      expect(window.getComputedStyle(loginCard).maxWidth).toBe('100%');
    });
  });
});

describe('RegisterScreen', () => {
  beforeEach(() => {
    setupMobileViewport();
    jest.clearAllMocks();
  });

  describe('Rendering and Accessibility', () => {
    it('should render without accessibility violations', async () => {
      const { container } = renderWithProviders(<RegisterScreen />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have proper form field labels and descriptions', () => {
      renderWithProviders(<RegisterScreen />);
      expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/phone/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^password/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('should validate all required fields', async () => {
      renderWithProviders(<RegisterScreen />);
      
      await userEvent.click(screen.getByRole('button', { name: /create account/i }));
      
      expect(await screen.findByText(/first name is required/i)).toBeInTheDocument();
      expect(await screen.findByText(/last name is required/i)).toBeInTheDocument();
      expect(await screen.findByText(/email is required/i)).toBeInTheDocument();
      expect(await screen.findByText(/phone.*required/i)).toBeInTheDocument();
      expect(await screen.findByText(/password must be at least 8 characters/i)).toBeInTheDocument();
    });

    it('should validate password requirements', async () => {
      renderWithProviders(<RegisterScreen />);
      const passwordInput = screen.getByLabelText(/^password/i);
      
      await userEvent.type(passwordInput, 'weak');
      await userEvent.tab();
      
      expect(await screen.findByText(/password must contain uppercase, lowercase, and numbers/i)).toBeInTheDocument();
    });

    it('should validate password confirmation match', async () => {
      renderWithProviders(<RegisterScreen />);
      
      await userEvent.type(screen.getByLabelText(/^password/i), 'Password123!');
      await userEvent.type(screen.getByLabelText(/confirm password/i), 'Password123');
      await userEvent.tab();
      
      expect(await screen.findByText(/passwords do not match/i)).toBeInTheDocument();
    });
  });

  describe('Registration Flow', () => {
    it('should handle successful registration', async () => {
      const mockRegister = jest.fn().mockResolvedValue({});
      const store = createTestStore({
        auth: { loading: false, error: null }
      });
      
      renderWithProviders(<RegisterScreen />, { store });
      
      await userEvent.type(screen.getByLabelText(/first name/i), 'John');
      await userEvent.type(screen.getByLabelText(/last name/i), 'Doe');
      await userEvent.type(screen.getByLabelText(/email/i), 'john.doe@example.com');
      await userEvent.type(screen.getByLabelText(/phone/i), '+1234567890');
      await userEvent.type(screen.getByLabelText(/^password/i), 'Password123!');
      await userEvent.type(screen.getByLabelText(/confirm password/i), 'Password123!');
      
      await userEvent.click(screen.getByRole('button', { name: /create account/i }));
      
      await waitFor(() => {
        expect(mockRegister).toHaveBeenCalledWith({
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@example.com',
          phone: '+1234567890',
          password: 'Password123!'
        });
      });
    });
  });

  describe('Security Features', () => {
    it('should not submit form with invalid CSRF token', async () => {
      const mockSubmit = jest.fn();
      renderWithProviders(<RegisterScreen />);
      
      const form = screen.getByRole('form');
      form.onsubmit = mockSubmit;
      
      await userEvent.click(screen.getByRole('button', { name: /create account/i }));
      
      expect(mockSubmit).not.toHaveBeenCalled();
    });
  });
});
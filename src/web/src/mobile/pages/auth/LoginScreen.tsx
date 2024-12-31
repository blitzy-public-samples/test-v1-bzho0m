import React, { useState, useCallback, useEffect } from 'react';
import styled from '@emotion/styled';
import { useNavigate } from 'react-router-dom';
import { debounce } from 'lodash';
import useAuth from '../../../shared/hooks/useAuth';
import Input from '../../../shared/components/forms/Input';
import ActionButton from '../../../shared/components/buttons/ActionButton';
import { validateEmail } from '../../../shared/utils/validation.util';
import { TYPOGRAPHY, SPACING, SHADOWS, BREAKPOINTS } from '../../../shared/constants/theme.constants';
import { PRIMARY_COLORS, NEUTRAL_COLORS, SEMANTIC_COLORS } from '../../../shared/styles/colors';

// Interfaces
interface LoginFormState {
  email: string;
  password: string;
  errors: Record<string, string>;
  touched: Record<string, boolean>;
}

// Styled Components
const LoginContainer = styled.main`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: ${SPACING.lg}px;
  background-color: ${NEUTRAL_COLORS.gray100};
  
  @media (max-width: ${BREAKPOINTS.mobile}px) {
    padding: ${SPACING.md}px;
  }
`;

const LoginCard = styled.div`
  width: 100%;
  max-width: 400px;
  padding: ${SPACING.xl}px;
  background-color: ${NEUTRAL_COLORS.white};
  border-radius: 8px;
  box-shadow: ${SHADOWS.medium};

  @media (max-width: ${BREAKPOINTS.mobile}px) {
    padding: ${SPACING.lg}px;
    box-shadow: none;
  }
`;

const LoginHeader = styled.h1`
  font-family: ${TYPOGRAPHY.fontFamily.primary};
  font-size: ${TYPOGRAPHY.fontSize.h2};
  color: ${PRIMARY_COLORS.main};
  margin-bottom: ${SPACING.lg}px;
  text-align: center;
`;

const LoginForm = styled.form`
  display: flex;
  flex-direction: column;
  gap: ${SPACING.md}px;
`;

const ErrorMessage = styled.div`
  color: ${SEMANTIC_COLORS.error};
  font-size: ${TYPOGRAPHY.fontSize.small};
  margin-top: ${SPACING.xs}px;
  text-align: center;
`;

const ForgotPassword = styled.a`
  color: ${PRIMARY_COLORS.main};
  font-size: ${TYPOGRAPHY.fontSize.small};
  text-align: right;
  margin-top: ${SPACING.xs}px;
  text-decoration: none;
  
  &:hover {
    text-decoration: underline;
  }
`;

/**
 * Mobile-optimized login screen component implementing OAuth 2.0 + JWT authentication
 * with comprehensive validation and accessibility features.
 */
const LoginScreen: React.FC = () => {
  const navigate = useNavigate();
  const { login, loading, error: authError } = useAuth();
  
  const [formState, setFormState] = useState<LoginFormState>({
    email: '',
    password: '',
    errors: {},
    touched: {},
  });

  // Debounced validation function
  const validateField = useCallback(
    debounce((name: string, value: string) => {
      const errors: Record<string, string> = {};

      switch (name) {
        case 'email': {
          const emailValidation = validateEmail(value);
          if (!emailValidation.isValid) {
            errors.email = emailValidation.error || 'Invalid email format';
          }
          break;
        }
        case 'password': {
          if (!value) {
            errors.password = 'Password is required';
          } else if (value.length < 8) {
            errors.password = 'Password must be at least 8 characters';
          }
          break;
        }
      }

      setFormState(prev => ({
        ...prev,
        errors: { ...prev.errors, ...errors },
      }));
    }, 300),
    []
  );

  // Handle input changes
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormState(prev => ({
      ...prev,
      [name]: value,
      touched: { ...prev.touched, [name]: true },
    }));
    validateField(name, value);
  }, [validateField]);

  // Handle form submission
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    const { email, password, errors } = formState;
    if (Object.keys(errors).length > 0) return;

    try {
      await login({ email, password });
      navigate('/dashboard');
    } catch (error) {
      // Error handling is managed by useAuth hook
    }
  }, [formState, login, navigate]);

  // Clear validation errors when component unmounts
  useEffect(() => {
    return () => {
      validateField.cancel();
    };
  }, [validateField]);

  return (
    <LoginContainer>
      <LoginCard>
        <LoginHeader>Hotel Management System</LoginHeader>
        <LoginForm onSubmit={handleSubmit} noValidate>
          <Input
            name="email"
            type="email"
            value={formState.email}
            onChange={handleChange}
            label="Email"
            error={formState.touched.email ? formState.errors.email : ''}
            required
            autoComplete="email"
            inputMode="email"
            aria-label="Email address"
          />
          
          <Input
            name="password"
            type="password"
            value={formState.password}
            onChange={handleChange}
            label="Password"
            error={formState.touched.password ? formState.errors.password : ''}
            required
            autoComplete="current-password"
            aria-label="Password"
          />

          <ForgotPassword 
            href="/forgot-password"
            onClick={(e) => {
              e.preventDefault();
              navigate('/forgot-password');
            }}
          >
            Forgot password?
          </ForgotPassword>

          <ActionButton
            type="submit"
            variant="primary"
            size="large"
            fullWidth
            loading={loading}
            disabled={loading || Object.keys(formState.errors).length > 0}
            aria-label="Sign in to your account"
          >
            Sign In
          </ActionButton>

          {authError && (
            <ErrorMessage role="alert">
              {authError}
            </ErrorMessage>
          )}
        </LoginForm>
      </LoginCard>
    </LoginContainer>
  );
};

export default LoginScreen;
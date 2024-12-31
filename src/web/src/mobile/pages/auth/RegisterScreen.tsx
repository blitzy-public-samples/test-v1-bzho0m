import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';
import { validateEmail, validatePhone } from '../../../shared/utils/validation.util';
import { useAuth } from '../../../shared/hooks/useAuth';
import Input from '../../../shared/components/forms/Input';
import ActionButton from '../../../shared/components/buttons/ActionButton';
import { TYPOGRAPHY, SPACING, SHADOWS, BREAKPOINTS } from '../../../shared/constants/theme.constants';
import { PRIMARY_COLORS, NEUTRAL_COLORS } from '../../../shared/styles/colors';

// Styled components
const RegisterContainer = styled.div`
  display: flex;
  flex-direction: column;
  padding: ${SPACING.md}px;
  min-height: 100vh;
  background-color: ${NEUTRAL_COLORS.white};
  
  @media (max-width: ${BREAKPOINTS.mobile}px) {
    padding: ${SPACING.sm}px;
  }
`;

const FormTitle = styled.h1`
  font-family: ${TYPOGRAPHY.fontFamily.primary};
  font-size: ${TYPOGRAPHY.fontSize.h2};
  font-weight: ${TYPOGRAPHY.fontWeight.medium};
  color: ${PRIMARY_COLORS.main};
  margin-bottom: ${SPACING.md}px;
  text-align: center;
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: ${SPACING.md}px;
  width: 100%;
  max-width: 400px;
  margin: 0 auto;
  padding: ${SPACING.md}px;
  background-color: ${NEUTRAL_COLORS.white};
  border-radius: 8px;
  box-shadow: ${SHADOWS.medium};
`;

const ErrorMessage = styled.div`
  color: ${PRIMARY_COLORS.error};
  font-size: ${TYPOGRAPHY.fontSize.small};
  margin-top: ${SPACING.xs}px;
  text-align: center;
`;

const PrivacyText = styled.p`
  font-size: ${TYPOGRAPHY.fontSize.small};
  color: ${NEUTRAL_COLORS.gray500};
  text-align: center;
  margin-top: ${SPACING.sm}px;
`;

// Interfaces
interface RegisterFormData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  phone: string;
}

interface ValidationErrors {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  password: string | null;
  confirmPassword: string | null;
  phone: string | null;
}

const RegisterScreen: React.FC = () => {
  const navigate = useNavigate();
  const { register, loading, error: authError } = useAuth();

  const [formData, setFormData] = useState<RegisterFormData>({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
  });

  const [errors, setErrors] = useState<ValidationErrors>({
    firstName: null,
    lastName: null,
    email: null,
    password: null,
    confirmPassword: null,
    phone: null,
  });

  // Validation function
  const validateForm = useCallback((data: RegisterFormData): ValidationErrors => {
    const newErrors: ValidationErrors = {
      firstName: null,
      lastName: null,
      email: null,
      password: null,
      confirmPassword: null,
      phone: null,
    };

    if (!data.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    }

    if (!data.lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    }

    const emailValidation = validateEmail(data.email);
    if (!emailValidation.isValid) {
      newErrors.email = emailValidation.error || 'Invalid email format';
    }

    if (data.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters long';
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(data.password)) {
      newErrors.password = 'Password must contain uppercase, lowercase, and numbers';
    }

    if (data.password !== data.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    const phoneValidation = validatePhone(data.phone);
    if (!phoneValidation.isValid) {
      newErrors.phone = phoneValidation.error || 'Invalid phone format';
    }

    return newErrors;
  }, []);

  // Debounced validation handler
  const debouncedValidation = debounce((field: keyof RegisterFormData, value: string) => {
    const newErrors = validateForm({ ...formData, [field]: value });
    setErrors(prev => ({ ...prev, [field]: newErrors[field] }));
  }, 300);

  // Input change handler
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    debouncedValidation(name as keyof RegisterFormData, value);
  }, [formData]);

  // Form submission handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validationErrors = validateForm(formData);
    const hasErrors = Object.values(validationErrors).some(error => error !== null);
    
    if (hasErrors) {
      setErrors(validationErrors);
      return;
    }

    try {
      await register({
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        password: formData.password,
        phone: formData.phone,
      });
      navigate('/login');
    } catch (error) {
      console.error('Registration error:', error);
    }
  };

  return (
    <RegisterContainer>
      <FormTitle>Create Account</FormTitle>
      <Form onSubmit={handleSubmit} noValidate>
        <Input
          name="firstName"
          type="text"
          label="First Name"
          value={formData.firstName}
          onChange={handleInputChange}
          error={errors.firstName}
          required
          autoComplete="given-name"
        />
        <Input
          name="lastName"
          type="text"
          label="Last Name"
          value={formData.lastName}
          onChange={handleInputChange}
          error={errors.lastName}
          required
          autoComplete="family-name"
        />
        <Input
          name="email"
          type="email"
          label="Email"
          value={formData.email}
          onChange={handleInputChange}
          error={errors.email}
          required
          autoComplete="email"
        />
        <Input
          name="phone"
          type="tel"
          label="Phone Number"
          value={formData.phone}
          onChange={handleInputChange}
          error={errors.phone}
          required
          autoComplete="tel"
          inputMode="tel"
        />
        <Input
          name="password"
          type="password"
          label="Password"
          value={formData.password}
          onChange={handleInputChange}
          error={errors.password}
          required
          autoComplete="new-password"
        />
        <Input
          name="confirmPassword"
          type="password"
          label="Confirm Password"
          value={formData.confirmPassword}
          onChange={handleInputChange}
          error={errors.confirmPassword}
          required
          autoComplete="new-password"
        />
        
        {authError && <ErrorMessage role="alert">{authError}</ErrorMessage>}
        
        <ActionButton
          type="submit"
          variant="primary"
          size="large"
          fullWidth
          loading={loading}
          disabled={loading}
          aria-label="Create account"
        >
          Create Account
        </ActionButton>
        
        <PrivacyText>
          By creating an account, you agree to our Terms of Service and Privacy Policy
        </PrivacyText>
      </Form>
    </RegisterContainer>
  );
};

export default RegisterScreen;
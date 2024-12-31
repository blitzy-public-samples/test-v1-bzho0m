import React, { useCallback } from 'react';
import styled from '@emotion/styled';
import { Guest } from '../../../shared/interfaces/guest.interface';
import useForm from '../../../shared/hooks/useForm';
import Input from '../../../shared/components/forms/Input';
import { TYPOGRAPHY, SPACING, SHADOWS, PRIMARY_COLORS, NEUTRAL_COLORS } from '../../../shared/constants/theme.constants';

// Styled components for form layout and styling
const FormContainer = styled.form`
  display: flex;
  flex-direction: column;
  gap: ${SPACING.md}px;
  width: 100%;
  max-width: 800px;
  padding: ${SPACING.lg}px;
  background-color: ${NEUTRAL_COLORS.white};
  border-radius: 8px;
  box-shadow: ${SHADOWS.medium};

  @media (max-width: 768px) {
    padding: ${SPACING.md}px;
  }
`;

const FormSection = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: ${SPACING.md}px;
  margin-bottom: ${SPACING.lg}px;

  @media (max-width: 576px) {
    grid-template-columns: 1fr;
  }
`;

const FormTitle = styled.h2`
  font-family: ${TYPOGRAPHY.fontFamily.primary};
  font-size: ${TYPOGRAPHY.fontSize.h2};
  color: ${PRIMARY_COLORS.main};
  margin-bottom: ${SPACING.md}px;
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: ${SPACING.md}px;
  justify-content: flex-end;
  margin-top: ${SPACING.lg}px;
`;

const Button = styled.button<{ variant?: 'primary' | 'secondary' }>`
  padding: ${SPACING.sm}px ${SPACING.md}px;
  font-family: ${TYPOGRAPHY.fontFamily.primary};
  font-size: ${TYPOGRAPHY.fontSize.body};
  font-weight: ${TYPOGRAPHY.fontWeight.medium};
  border-radius: 4px;
  min-height: 44px;
  cursor: pointer;
  transition: all 0.2s ease-in-out;

  ${({ variant }) => variant === 'primary' ? `
    background-color: ${PRIMARY_COLORS.main};
    color: ${NEUTRAL_COLORS.white};
    border: none;

    &:hover:not(:disabled) {
      background-color: ${PRIMARY_COLORS.dark};
    }
  ` : `
    background-color: ${NEUTRAL_COLORS.white};
    color: ${PRIMARY_COLORS.main};
    border: 1px solid ${PRIMARY_COLORS.main};

    &:hover:not(:disabled) {
      background-color: ${NEUTRAL_COLORS.gray100};
    }
  `}

  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
`;

// Props interface
interface GuestFormProps {
  initialValues: Guest;
  onSubmit: (guest: Guest) => Promise<void>;
  isEdit?: boolean;
  isLoading?: boolean;
}

export const GuestForm: React.FC<GuestFormProps> = ({
  initialValues,
  onSubmit,
  isEdit = false,
  isLoading = false,
}) => {
  // Form validation schema
  const validationSchema = {
    fields: {
      firstName: [
        { type: 'required', message: 'First name is required' },
        { type: 'custom', validate: (value: string) => value.length >= 2, message: 'First name must be at least 2 characters' },
      ],
      lastName: [
        { type: 'required', message: 'Last name is required' },
        { type: 'custom', validate: (value: string) => value.length >= 2, message: 'Last name must be at least 2 characters' },
      ],
      email: [
        { type: 'required', message: 'Email is required' },
        { type: 'email', message: 'Invalid email format' },
      ],
      phone: [
        { type: 'required', message: 'Phone number is required' },
        { type: 'phone', message: 'Invalid phone number format' },
      ],
      idType: [
        { type: 'required', message: 'ID type is required' },
      ],
      idNumber: [
        { type: 'required', message: 'ID number is required' },
        { type: 'custom', validate: (value: string) => /^[A-Za-z0-9-]+$/.test(value), message: 'ID number can only contain letters, numbers, and hyphens' },
      ],
    },
  };

  // Initialize form with useForm hook
  const {
    values,
    errors,
    touched,
    handleChange,
    handleBlur,
    handleSubmit,
    isSubmitting,
  } = useForm({
    initialValues,
    validationSchema,
    onSubmit,
    validateOnChange: true,
    validateOnBlur: true,
  });

  // Handle form submission
  const onFormSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    await handleSubmit(e);
  }, [handleSubmit]);

  return (
    <FormContainer onSubmit={onFormSubmit} noValidate>
      <FormTitle>{isEdit ? 'Edit Guest' : 'New Guest'}</FormTitle>

      <FormSection aria-label="Personal Information">
        <Input
          name="firstName"
          type="text"
          label="First Name"
          value={values.firstName}
          onChange={handleChange}
          onBlur={handleBlur}
          error={touched.firstName ? errors.firstName : ''}
          required
          disabled={isLoading}
          autoComplete="given-name"
          maxLength={50}
        />
        <Input
          name="lastName"
          type="text"
          label="Last Name"
          value={values.lastName}
          onChange={handleChange}
          onBlur={handleBlur}
          error={touched.lastName ? errors.lastName : ''}
          required
          disabled={isLoading}
          autoComplete="family-name"
          maxLength={50}
        />
      </FormSection>

      <FormSection aria-label="Contact Information">
        <Input
          name="email"
          type="email"
          label="Email"
          value={values.email}
          onChange={handleChange}
          onBlur={handleBlur}
          error={touched.email ? errors.email : ''}
          required
          disabled={isLoading}
          autoComplete="email"
          inputMode="email"
        />
        <Input
          name="phone"
          type="tel"
          label="Phone Number"
          value={values.phone}
          onChange={handleChange}
          onBlur={handleBlur}
          error={touched.phone ? errors.phone : ''}
          required
          disabled={isLoading}
          autoComplete="tel"
          inputMode="tel"
          pattern="^\+[1-9]\d{1,14}$"
        />
      </FormSection>

      <FormSection aria-label="Identification">
        <Input
          name="idType"
          type="text"
          label="ID Type"
          value={values.idType}
          onChange={handleChange}
          onBlur={handleBlur}
          error={touched.idType ? errors.idType : ''}
          required
          disabled={isLoading}
        />
        <Input
          name="idNumber"
          type="text"
          label="ID Number"
          value={values.idNumber}
          onChange={handleChange}
          onBlur={handleBlur}
          error={touched.idNumber ? errors.idNumber : ''}
          required
          disabled={isLoading}
          pattern="^[A-Za-z0-9-]+$"
        />
      </FormSection>

      <ButtonGroup>
        <Button
          type="button"
          disabled={isLoading || isSubmitting}
          onClick={() => window.history.back()}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          disabled={isLoading || isSubmitting}
          aria-busy={isSubmitting}
        >
          {isSubmitting ? 'Saving...' : isEdit ? 'Update Guest' : 'Create Guest'}
        </Button>
      </ButtonGroup>
    </FormContainer>
  );
};

export default GuestForm;
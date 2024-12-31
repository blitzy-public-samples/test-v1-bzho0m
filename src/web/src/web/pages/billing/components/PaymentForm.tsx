/**
 * @fileoverview PCI DSS compliant payment form component with comprehensive validation,
 * accessibility features, and error handling for the hotel management system.
 * @version 1.0.0
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';
import Input from '../../../../shared/components/forms/Input';
import Select from '../../../../shared/components/forms/Select';
import { 
  IPayment, 
  PaymentMethod, 
  PaymentStatus,
} from '../../../../shared/interfaces/billing.interface';
import { processPayment } from '../../../../shared/api/billing.api';
import { validateCreditCard, validateAmount } from '../../../../shared/utils/validation.util';
import { TYPOGRAPHY, SPACING, SHADOWS, PRIMARY_COLORS, NEUTRAL_COLORS } from '../../../../shared/constants/theme.constants';

// Styled components with WCAG 2.1 AA compliance
const FormContainer = styled.form`
  display: flex;
  flex-direction: column;
  gap: ${SPACING.md}px;
  max-width: 600px;
  padding: ${SPACING.lg}px;
  background-color: ${NEUTRAL_COLORS.white};
  border-radius: 8px;
  box-shadow: ${SHADOWS.medium};
`;

const FormSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${SPACING.sm}px;
`;

const FormRow = styled.div`
  display: flex;
  gap: ${SPACING.md}px;
  
  @media (max-width: 576px) {
    flex-direction: column;
  }
`;

const SubmitButton = styled.button`
  padding: ${SPACING.sm}px ${SPACING.md}px;
  background-color: ${PRIMARY_COLORS.main};
  color: ${NEUTRAL_COLORS.white};
  border: none;
  border-radius: 4px;
  font-size: ${TYPOGRAPHY.fontSize.body};
  font-weight: ${TYPOGRAPHY.fontWeight.medium};
  min-height: 44px;
  cursor: pointer;
  transition: background-color 0.2s ease;

  &:disabled {
    background-color: ${NEUTRAL_COLORS.gray400};
    cursor: not-allowed;
  }

  &:hover:not(:disabled) {
    background-color: ${PRIMARY_COLORS.dark};
  }

  &:focus {
    outline: none;
    box-shadow: 0 0 0 2px ${PRIMARY_COLORS.main}40;
  }
`;

const ErrorMessage = styled.div`
  color: ${PRIMARY_COLORS.error};
  font-size: ${TYPOGRAPHY.fontSize.small};
  margin-top: ${SPACING.xs}px;
  padding: ${SPACING.xs}px;
  border-radius: 4px;
  background-color: ${PRIMARY_COLORS.error}10;
`;

// Payment form props interface
interface PaymentFormProps {
  folioId: string;
  amount: number;
  currency: string;
  onSuccess: (payment: IPayment) => void;
  onError: (error: Error) => void;
  onValidationError: (errors: string[]) => void;
}

// Form state interface
interface FormState {
  paymentMethod: PaymentMethod;
  cardNumber: string;
  cardHolder: string;
  expiryMonth: string;
  expiryYear: string;
  cvv: string;
}

// Initial form state
const initialFormState: FormState = {
  paymentMethod: PaymentMethod.CREDIT_CARD,
  cardNumber: '',
  cardHolder: '',
  expiryMonth: '',
  expiryYear: '',
  cvv: '',
};

export const PaymentForm: React.FC<PaymentFormProps> = ({
  folioId,
  amount,
  currency,
  onSuccess,
  onError,
  onValidationError,
}) => {
  const [formData, setFormData] = useState<FormState>(initialFormState);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // Validate amount on component mount
  useEffect(() => {
    const amountValidation = validateAmount(amount, currency);
    if (!amountValidation.isValid) {
      onValidationError([amountValidation.error || 'Invalid amount']);
    }
  }, [amount, currency, onValidationError]);

  // Debounced card validation
  const validateCardDebounced = useCallback(
    debounce(async (cardNumber: string) => {
      const validation = validateCreditCard(cardNumber);
      if (!validation.isValid) {
        setErrors(prev => ({
          ...prev,
          cardNumber: validation.error
        }));
      } else {
        setErrors(prev => {
          const { cardNumber, ...rest } = prev;
          return rest;
        });
      }
    }, 500),
    []
  );

  // Handle form field changes
  const handleChange = useCallback((
    field: keyof FormState,
    value: string
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));

    // Validate card number on change
    if (field === 'cardNumber') {
      validateCardDebounced(value);
    }
  }, [validateCardDebounced]);

  // Validate entire form
  const validateForm = useCallback((): boolean => {
    const newErrors: Partial<Record<keyof FormState, string>> = {};
    const validationErrors: string[] = [];

    // Required field validation
    if (!formData.cardHolder.trim()) {
      newErrors.cardHolder = 'Cardholder name is required';
      validationErrors.push('Cardholder name is required');
    }

    // Card validation
    const cardValidation = validateCreditCard(formData.cardNumber);
    if (!cardValidation.isValid) {
      newErrors.cardNumber = cardValidation.error;
      validationErrors.push(cardValidation.error || 'Invalid card number');
    }

    // Expiry validation
    const now = new Date();
    const expYear = parseInt(formData.expiryYear);
    const expMonth = parseInt(formData.expiryMonth);
    
    if (expYear < now.getFullYear() || 
        (expYear === now.getFullYear() && expMonth < (now.getMonth() + 1))) {
      newErrors.expiryYear = 'Card has expired';
      validationErrors.push('Card has expired');
    }

    // CVV validation
    if (!/^\d{3,4}$/.test(formData.cvv)) {
      newErrors.cvv = 'Invalid CVV';
      validationErrors.push('Invalid CVV');
    }

    setErrors(newErrors);
    if (validationErrors.length > 0) {
      onValidationError(validationErrors);
      return false;
    }

    return true;
  }, [formData, onValidationError]);

  // Handle form submission
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    if (!validateForm() || isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    try {
      const paymentData = {
        folioId,
        amount,
        currency,
        method: formData.paymentMethod,
        cardNumber: formData.cardNumber,
        cardHolder: formData.cardHolder,
        expiryMonth: formData.expiryMonth,
        expiryYear: formData.expiryYear,
        cvv: formData.cvv
      };

      const response = await processPayment(paymentData);
      
      if (response.status === PaymentStatus.CAPTURED) {
        onSuccess(response);
        setFormData(initialFormState);
      } else {
        onError(new Error('Payment was not captured'));
      }
    } catch (error) {
      onError(error instanceof Error ? error : new Error('Payment processing failed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <FormContainer
      ref={formRef}
      onSubmit={handleSubmit}
      aria-label="Payment form"
      noValidate
    >
      <FormSection>
        <Select
          name="paymentMethod"
          value={formData.paymentMethod}
          onChange={(value) => handleChange('paymentMethod', value as string)}
          options={[
            { value: PaymentMethod.CREDIT_CARD, label: 'Credit Card' },
            { value: PaymentMethod.DEBIT_CARD, label: 'Debit Card' }
          ]}
          aria-label="Payment method"
          required
        />
      </FormSection>

      <FormSection>
        <Input
          name="cardNumber"
          type="text"
          value={formData.cardNumber}
          onChange={(e) => handleChange('cardNumber', e.target.value)}
          label="Card Number"
          error={errors.cardNumber}
          required
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="cc-number"
          maxLength={19}
        />
      </FormSection>

      <FormSection>
        <Input
          name="cardHolder"
          type="text"
          value={formData.cardHolder}
          onChange={(e) => handleChange('cardHolder', e.target.value)}
          label="Cardholder Name"
          error={errors.cardHolder}
          required
          autoComplete="cc-name"
        />
      </FormSection>

      <FormRow>
        <FormSection>
          <Select
            name="expiryMonth"
            value={formData.expiryMonth}
            onChange={(value) => handleChange('expiryMonth', value as string)}
            options={Array.from({ length: 12 }, (_, i) => ({
              value: String(i + 1).padStart(2, '0'),
              label: String(i + 1).padStart(2, '0')
            }))}
            aria-label="Expiry month"
            required
          />
        </FormSection>

        <FormSection>
          <Select
            name="expiryYear"
            value={formData.expiryYear}
            onChange={(value) => handleChange('expiryYear', value as string)}
            options={Array.from({ length: 10 }, (_, i) => {
              const year = new Date().getFullYear() + i;
              return { value: String(year), label: String(year) };
            })}
            aria-label="Expiry year"
            required
          />
        </FormSection>

        <FormSection>
          <Input
            name="cvv"
            type="text"
            value={formData.cvv}
            onChange={(e) => handleChange('cvv', e.target.value)}
            label="CVV"
            error={errors.cvv}
            required
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="cc-csc"
            maxLength={4}
          />
        </FormSection>
      </FormRow>

      <SubmitButton
        type="submit"
        disabled={isSubmitting}
        aria-busy={isSubmitting}
      >
        {isSubmitting ? 'Processing...' : `Pay ${amount} ${currency}`}
      </SubmitButton>

      {Object.keys(errors).length > 0 && (
        <ErrorMessage role="alert">
          Please correct the errors before proceeding
        </ErrorMessage>
      )}
    </FormContainer>
  );
};

export default PaymentForm;
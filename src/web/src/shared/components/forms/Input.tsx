import React, { useCallback, useState } from 'react';
import styled from '@emotion/styled';
import { TYPOGRAPHY, SPACING, SHADOWS, PRIMARY_COLORS, NEUTRAL_COLORS } from '../../constants/theme.constants';
import { validateRequired, validateEmail, validatePhone } from '../../utils/validation.util';

// Styled components with design system specifications
const InputContainer = styled.div`
  display: flex;
  flex-direction: column;
  margin-bottom: ${SPACING.md}px;
  width: 100%;
  position: relative;
`;

const Label = styled.label<{ error?: string }>`
  font-family: ${TYPOGRAPHY.fontFamily.primary};
  font-size: ${TYPOGRAPHY.fontSize.small};
  color: ${props => props.error ? PRIMARY_COLORS.error : NEUTRAL_COLORS.gray500};
  margin-bottom: ${SPACING.xs}px;
  font-weight: 500;
`;

const StyledInput = styled.input<{ error?: string }>`
  font-family: ${TYPOGRAPHY.fontFamily.primary};
  font-size: ${TYPOGRAPHY.fontSize.body};
  color: ${NEUTRAL_COLORS.black};
  padding: ${SPACING.sm}px;
  border: 1px solid ${props => props.error ? PRIMARY_COLORS.error : NEUTRAL_COLORS.gray300};
  border-radius: 4px;
  width: 100%;
  min-height: 44px; // WCAG 2.1 AA touch target size
  box-shadow: ${SHADOWS.light};
  transition: all 0.2s ease-in-out;
  background-color: ${props => props.disabled ? NEUTRAL_COLORS.gray100 : NEUTRAL_COLORS.white};

  &:focus {
    outline: none;
    border-color: ${PRIMARY_COLORS.main};
    box-shadow: 0 0 0 2px ${getColorWithOpacity(PRIMARY_COLORS.main, 0.2)};
  }

  &:hover:not(:disabled) {
    border-color: ${PRIMARY_COLORS.light};
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.7;
  }

  &::placeholder {
    color: ${NEUTRAL_COLORS.gray400};
  }
`;

const ErrorText = styled.span`
  font-family: ${TYPOGRAPHY.fontFamily.primary};
  font-size: ${TYPOGRAPHY.fontSize.small};
  color: ${PRIMARY_COLORS.error};
  margin-top: ${SPACING.xs}px;
  position: absolute;
  bottom: -20px;
`;

// Helper function to get color with opacity
function getColorWithOpacity(color: string, opacity: number): string {
  return `${color}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`;
}

// Input component props interface
export interface InputProps {
  name: string;
  type: 'text' | 'email' | 'password' | 'tel' | 'number';
  value: string;
  placeholder?: string;
  label?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  autoComplete?: string;
  pattern?: string;
  maxLength?: number;
  inputMode?: 'none' | 'text' | 'tel' | 'url' | 'email' | 'numeric' | 'decimal' | 'search';
  'aria-label'?: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (event: React.FocusEvent<HTMLInputElement>) => void;
}

export const Input: React.FC<InputProps> = ({
  name,
  type,
  value,
  placeholder,
  label,
  error,
  required = false,
  disabled = false,
  autoComplete,
  pattern,
  maxLength,
  inputMode,
  'aria-label': ariaLabel,
  onChange,
  onBlur,
}) => {
  const [touched, setTouched] = useState(false);
  const [internalError, setInternalError] = useState<string>('');

  // Validation based on input type
  const validateInput = useCallback((value: string): string => {
    if (required) {
      const requiredValidation = validateRequired(value, label || name);
      if (!requiredValidation.isValid) {
        return requiredValidation.error || 'This field is required';
      }
    }

    if (value) {
      switch (type) {
        case 'email': {
          const emailValidation = validateEmail(value);
          if (!emailValidation.isValid) {
            return emailValidation.error || 'Invalid email format';
          }
          break;
        }
        case 'tel': {
          const phoneValidation = validatePhone(value);
          if (!phoneValidation.isValid) {
            return phoneValidation.error || 'Invalid phone format';
          }
          break;
        }
      }
    }

    return '';
  }, [type, required, label, name]);

  // Handle input change with debounced validation
  const handleChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.value;
    onChange(event);

    if (touched) {
      const validationError = validateInput(newValue);
      setInternalError(validationError);
    }
  }, [onChange, validateInput, touched]);

  // Handle input blur
  const handleBlur = useCallback((event: React.FocusEvent<HTMLInputElement>) => {
    setTouched(true);
    const validationError = validateInput(event.target.value);
    setInternalError(validationError);
    onBlur?.(event);
  }, [onBlur, validateInput]);

  const displayError = error || internalError;
  const inputId = `input-${name}`;
  const errorId = displayError ? `error-${name}` : undefined;

  return (
    <InputContainer>
      {label && (
        <Label 
          htmlFor={inputId}
          error={displayError}
        >
          {label}
          {required && <span aria-hidden="true"> *</span>}
        </Label>
      )}
      <StyledInput
        id={inputId}
        name={name}
        type={type}
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        aria-required={required}
        aria-invalid={!!displayError}
        aria-label={ariaLabel || label}
        aria-describedby={errorId}
        autoComplete={autoComplete}
        pattern={pattern}
        maxLength={maxLength}
        inputMode={inputMode}
        error={displayError}
      />
      {displayError && (
        <ErrorText id={errorId} role="alert">
          {displayError}
        </ErrorText>
      )}
    </InputContainer>
  );
};

export default Input;
/**
 * @fileoverview WCAG 2.1 AA compliant select dropdown component implementing the design system specifications.
 * Supports single and multi-select with enhanced keyboard navigation and screen reader support.
 * @version 1.0.0
 */

import React, { useCallback, useRef, useState } from 'react';
import styled from '@emotion/styled';
import { FONT_FAMILY, FONT_SIZE } from '../styles/typography';
import { NEUTRAL_COLORS, PRIMARY_COLORS } from '../styles/colors';

// Type definitions for component props
interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  value: string | string[];
  options: SelectOption[];
  onChange: (value: string | string[]) => void;
  multiple?: boolean;
  disabled?: boolean;
  required?: boolean;
  'aria-label'?: string;
  'aria-invalid'?: boolean;
  error?: boolean;
  className?: string;
  id?: string;
  name?: string;
}

// Styled select component with WCAG compliant styling
const StyledSelect = styled.select<SelectProps>`
  font-family: ${FONT_FAMILY.primary};
  font-size: ${FONT_SIZE.body};
  width: 100%;
  padding: 8px 32px 8px 12px;
  border: 2px solid ${props => props.error ? NEUTRAL_COLORS.error : NEUTRAL_COLORS.gray400};
  border-radius: 4px;
  background-color: ${props => props.disabled ? NEUTRAL_COLORS.gray200 : NEUTRAL_COLORS.white};
  color: ${props => props.disabled ? NEUTRAL_COLORS.gray500 : PRIMARY_COLORS.main};
  appearance: none;
  cursor: ${props => props.disabled ? 'not-allowed' : 'pointer'};
  transition: all 0.2s ease;

  /* Custom dropdown arrow */
  background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 8px center;
  background-size: 16px;

  /* Focus state styling */
  &:focus {
    outline: none;
    border-color: ${PRIMARY_COLORS.main};
    box-shadow: 0 0 0 3px ${props => 
      props.error ? 
      `${NEUTRAL_COLORS.error}40` : 
      `${PRIMARY_COLORS.main}40`
    };
  }

  /* High contrast mode support */
  @media (forced-colors: active) {
    border: 2px solid ButtonText;
    &:focus {
      outline: 2px solid ButtonText;
      outline-offset: 2px;
    }
  }

  /* Option styling */
  option {
    padding: 8px;
    background-color: ${NEUTRAL_COLORS.white};
    color: ${PRIMARY_COLORS.main};

    &:checked {
      background-color: ${PRIMARY_COLORS.main};
      color: ${NEUTRAL_COLORS.white};
    }

    &:disabled {
      color: ${NEUTRAL_COLORS.gray400};
    }
  }
`;

// Wrapper for select component with error message support
const SelectWrapper = styled.div`
  position: relative;
  width: 100%;
`;

// Error message styling
const ErrorMessage = styled.span`
  color: ${NEUTRAL_COLORS.error};
  font-size: ${FONT_SIZE.small};
  margin-top: 4px;
  display: block;
`;

/**
 * Select component with WCAG 2.1 AA compliance
 */
export const Select: React.FC<SelectProps> = ({
  value,
  options,
  onChange,
  multiple = false,
  disabled = false,
  required = false,
  'aria-label': ariaLabel,
  'aria-invalid': ariaInvalid,
  error = false,
  className,
  id,
  name,
}) => {
  const selectRef = useRef<HTMLSelectElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  // Handle value changes with enhanced type safety
  const handleChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    event.preventDefault();
    
    if (multiple) {
      const selectedOptions = Array.from(event.target.selectedOptions)
        .map(option => option.value);
      onChange(selectedOptions);
    } else {
      onChange(event.target.value);
    }
  }, [multiple, onChange]);

  // Handle keyboard navigation for accessibility
  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLSelectElement>) => {
    switch (event.key) {
      case ' ':
      case 'Enter':
        // Prevent form submission on space/enter
        event.preventDefault();
        break;
      case 'Escape':
        // Close dropdown and blur on escape
        selectRef.current?.blur();
        break;
      case 'Tab':
        // Handle tab navigation
        setIsFocused(false);
        break;
    }
  }, []);

  return (
    <SelectWrapper className={className}>
      <StyledSelect
        ref={selectRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        multiple={multiple}
        disabled={disabled}
        required={required}
        aria-label={ariaLabel}
        aria-invalid={ariaInvalid || error}
        aria-required={required}
        error={error}
        id={id}
        name={name}
      >
        {options.map(option => (
          <option 
            key={option.value} 
            value={option.value}
            aria-selected={
              Array.isArray(value) 
                ? value.includes(option.value)
                : value === option.value
            }
          >
            {option.label}
          </option>
        ))}
      </StyledSelect>
      {error && (
        <ErrorMessage role="alert" aria-live="polite">
          Please select a valid option
        </ErrorMessage>
      )}
    </SelectWrapper>
  );
};

export default Select;
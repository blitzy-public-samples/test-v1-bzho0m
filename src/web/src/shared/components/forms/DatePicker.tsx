import React, { useState, useEffect, useCallback, useMemo } from 'react';
import ReactDatePicker from 'react-datepicker'; // v4.8.0
import styled from '@emotion/styled'; // v11.0.0
import { useForm } from '../../hooks/useForm';
import { formatDisplayDate, DateFormat, validateBookingDates } from '../../utils/date.util';
import { FONT_SIZE, FONT_WEIGHT } from '../../styles/typography';

// Import required react-datepicker styles
import 'react-datepicker/dist/react-datepicker.css';

interface DatePickerProps {
  name: string;
  value: Date | null;
  onChange: (date: Date | null) => void;
  onBlur?: () => void;
  error?: string;
  label: string;
  minDate?: Date;
  maxDate?: Date;
  disabled?: boolean;
  format?: DateFormat;
  locale?: string;
  excludeDates?: Date[];
  highlightDates?: Date[];
  placeholder?: string;
  required?: boolean;
  'aria-label'?: string;
  'aria-describedby'?: string;
}

const StyledDatePicker = styled.div<{ hasError?: boolean; isDisabled?: boolean }>`
  .react-datepicker-wrapper {
    width: 100%;
  }

  .react-datepicker__input-container input {
    font-family: ${props => props.theme.fonts.primary};
    font-size: ${FONT_SIZE.body};
    font-weight: ${FONT_WEIGHT.regular};
    width: 100%;
    padding: 8px 12px;
    border-radius: 4px;
    border: 1px solid ${props => props.hasError ? '#E74C3C' : '#E0E0E0'};
    transition: all 0.2s ease-in-out;
    outline: none;
    background-color: ${props => props.isDisabled ? '#F5F5F5' : '#FFFFFF'};
    cursor: ${props => props.isDisabled ? 'not-allowed' : 'pointer'};
    opacity: ${props => props.isDisabled ? 0.7 : 1};

    &:focus {
      border-color: ${props => props.hasError ? '#E74C3C' : '#3498DB'};
      box-shadow: 0 0 0 2px ${props => 
        props.hasError ? 'rgba(231, 76, 60, 0.2)' : 'rgba(52, 152, 219, 0.2)'};
    }
  }

  .react-datepicker {
    font-family: ${props => props.theme.fonts.primary};
    border-color: #E0E0E0;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }

  .react-datepicker__header {
    background-color: #F8F9FA;
    border-bottom: 1px solid #E0E0E0;
  }

  .react-datepicker__day--selected {
    background-color: #3498DB;
    color: white;
  }

  .react-datepicker__day--highlighted {
    background-color: #F1C40F;
    color: white;
  }

  .react-datepicker__day--disabled {
    color: #CED4DA;
  }
`;

const Label = styled.label`
  display: block;
  font-size: ${FONT_SIZE.body};
  font-weight: ${FONT_WEIGHT.medium};
  margin-bottom: 8px;
  color: #2C3E50;
`;

const ErrorMessage = styled.span`
  display: block;
  color: #E74C3C;
  font-size: ${FONT_SIZE.small};
  margin-top: 4px;
  font-weight: ${FONT_WEIGHT.medium};
`;

export const DatePicker: React.FC<DatePickerProps> = ({
  name,
  value,
  onChange,
  onBlur,
  error,
  label,
  minDate,
  maxDate,
  disabled = false,
  format = DateFormat.DISPLAY_FORMAT,
  locale = 'en-US',
  excludeDates = [],
  highlightDates = [],
  placeholder = 'Select date',
  required = false,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
}) => {
  const [selectedDate, setSelectedDate] = useState<Date | null>(value);
  const [isFocused, setIsFocused] = useState(false);
  const [announceMessage, setAnnounceMessage] = useState<string>('');

  // Memoize date validation options
  const validationOptions = useMemo(() => ({
    maxStayDuration: 90,
    minNoticeHours: 24,
    restrictedDates: excludeDates
  }), [excludeDates]);

  // Handle date selection
  const handleDateChange = useCallback((date: Date | null) => {
    setSelectedDate(date);
    
    if (date) {
      const validation = validateBookingDates(date, date, validationOptions);
      if (!validation.isValid) {
        setAnnounceMessage(validation.error || 'Invalid date selected');
      } else {
        const formattedDate = formatDisplayDate(date, format, 'UTC', locale);
        setAnnounceMessage(`Selected date: ${formattedDate}`);
      }
    }

    onChange(date);
  }, [onChange, format, locale, validationOptions]);

  // Handle focus events
  const handleFocus = useCallback(() => {
    setIsFocused(true);
    setAnnounceMessage('Date picker activated. Use arrow keys to navigate dates.');
  }, []);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    if (onBlur) {
      onBlur();
    }
  }, [onBlur]);

  // Accessibility announcement effect
  useEffect(() => {
    if (announceMessage) {
      const timeout = setTimeout(() => {
        setAnnounceMessage('');
      }, 3000);
      return () => clearTimeout(timeout);
    }
  }, [announceMessage]);

  const datePickerId = `datepicker-${name}`;
  const errorId = `${datePickerId}-error`;
  const labelId = `${datePickerId}-label`;

  return (
    <StyledDatePicker hasError={!!error} isDisabled={disabled}>
      <Label id={labelId} htmlFor={datePickerId}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </Label>
      
      <ReactDatePicker
        id={datePickerId}
        selected={selectedDate}
        onChange={handleDateChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        minDate={minDate}
        maxDate={maxDate}
        excludeDates={excludeDates}
        highlightDates={highlightDates}
        disabled={disabled}
        placeholderText={placeholder}
        dateFormat={format}
        locale={locale}
        showPopperArrow={true}
        aria-invalid={!!error}
        aria-required={required}
        aria-labelledby={labelId}
        aria-describedby={`${errorId} ${ariaDescribedBy || ''}`}
        aria-label={ariaLabel || label}
        focusable={!disabled}
        shouldCloseOnSelect={true}
        popperModifiers={[
          {
            name: 'offset',
            options: {
              offset: [0, 8],
            },
          },
        ]}
      />

      {error && (
        <ErrorMessage id={errorId} role="alert">
          {error}
        </ErrorMessage>
      )}

      {/* Screen reader announcements */}
      <div 
        role="status" 
        aria-live="polite" 
        className="sr-only"
      >
        {announceMessage}
      </div>
    </StyledDatePicker>
  );
};

export default DatePicker;
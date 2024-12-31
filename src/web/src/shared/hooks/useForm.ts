// @ts-check
import { useState, useCallback, useRef, useEffect } from 'react'; // v18.0.0
import {
  validateEmail,
  validatePhone,
  validateDateRange,
  validateRequired
} from '../utils/validation.util';

// Types for form management
interface FormState<T> {
  values: T;
  errors: Record<keyof T, string>;
  touched: Record<keyof T, boolean>;
  isSubmitting: boolean;
  isValid: boolean;
  isDirty: boolean;
  submitCount: number;
}

interface ValidationRule {
  type: 'required' | 'email' | 'phone' | 'dateRange' | 'custom';
  message?: string;
  validate?: (value: any) => boolean | Promise<boolean>;
  isAsync?: boolean;
  options?: Record<string, any>;
}

interface ValidationSchema<T> {
  fields: Record<keyof T, ValidationRule[]>;
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
  validateOnMount?: boolean;
}

interface UseFormOptions<T> {
  initialValues: T;
  validationSchema: ValidationSchema<T>;
  onSubmit: (values: T) => void | Promise<void>;
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
  validateOnMount?: boolean;
  debounceMs?: number;
}

interface UseFormReturn<T> {
  values: T;
  errors: Record<keyof T, string>;
  touched: Record<keyof T, boolean>;
  isValid: boolean;
  isSubmitting: boolean;
  isDirty: boolean;
  handleChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleBlur: (event: React.FocusEvent<HTMLInputElement>) => void;
  handleSubmit: (event: React.FormEvent) => Promise<void>;
  setFieldValue: (field: keyof T, value: any) => void;
  setFieldError: (field: keyof T, error: string) => void;
  validateField: (field: keyof T) => Promise<boolean>;
  validateForm: () => Promise<boolean>;
  resetForm: () => void;
}

/**
 * Custom hook for comprehensive form state management with validation
 * @template T - Type of form values
 * @param {UseFormOptions<T>} options - Form configuration options
 * @returns {UseFormReturn<T>} Form state and handlers
 */
export function useForm<T extends Record<string, any>>({
  initialValues,
  validationSchema,
  onSubmit,
  validateOnChange = true,
  validateOnBlur = true,
  validateOnMount = false,
  debounceMs = 300
}: UseFormOptions<T>): UseFormReturn<T> {
  // Form state initialization
  const [formState, setFormState] = useState<FormState<T>>({
    values: initialValues,
    errors: {} as Record<keyof T, string>,
    touched: {} as Record<keyof T, boolean>,
    isSubmitting: false,
    isValid: false,
    isDirty: false,
    submitCount: 0
  });

  // Debounce timer ref
  const debounceTimerRef = useRef<NodeJS.Timeout>();

  // Validation cache for performance optimization
  const validationCacheRef = useRef<Map<string, string>>(new Map());

  /**
   * Validates a single field based on validation rules
   * @param {keyof T} field - Field to validate
   * @param {any} value - Field value
   * @returns {Promise<string>} Validation error message or empty string
   */
  const validateField = useCallback(async (field: keyof T, value: any): Promise<string> => {
    const fieldRules = validationSchema.fields[field] || [];
    const cachedResult = validationCacheRef.current.get(`${field}-${value}`);

    if (cachedResult !== undefined) {
      return cachedResult;
    }

    for (const rule of fieldRules) {
      let isValid = true;
      const errorMessage = rule.message || `Invalid ${String(field)}`;

      switch (rule.type) {
        case 'required':
          const requiredResult = validateRequired(value, String(field));
          isValid = requiredResult.isValid;
          if (!isValid) return requiredResult.error!;
          break;

        case 'email':
          const emailResult = validateEmail(value);
          isValid = emailResult.isValid;
          if (!isValid) return emailResult.error!;
          break;

        case 'phone':
          const phoneResult = validatePhone(value);
          isValid = phoneResult.isValid;
          if (!isValid) return phoneResult.error!;
          break;

        case 'dateRange':
          if (field.toString().includes('checkIn') || field.toString().includes('checkOut')) {
            const checkIn = field.toString().includes('checkIn') ? value : formState.values.checkIn;
            const checkOut = field.toString().includes('checkOut') ? value : formState.values.checkOut;
            const dateResult = validateDateRange(checkIn, checkOut);
            isValid = dateResult.isValid;
            if (!isValid) return dateResult.error!;
          }
          break;

        case 'custom':
          if (rule.validate) {
            if (rule.isAsync) {
              isValid = await rule.validate(value);
            } else {
              isValid = rule.validate(value);
            }
          }
          break;
      }

      if (!isValid) {
        validationCacheRef.current.set(`${field}-${value}`, errorMessage);
        return errorMessage;
      }
    }

    validationCacheRef.current.set(`${field}-${value}`, '');
    return '';
  }, [validationSchema, formState.values]);

  /**
   * Validates entire form
   * @returns {Promise<boolean>} Form validity status
   */
  const validateForm = useCallback(async (): Promise<boolean> => {
    const errors: Record<keyof T, string> = {} as Record<keyof T, string>;
    const validationPromises: Promise<void>[] = [];

    Object.keys(formState.values).forEach((field) => {
      const promise = validateField(field as keyof T, formState.values[field]).then(error => {
        if (error) {
          errors[field as keyof T] = error;
        }
      });
      validationPromises.push(promise);
    });

    await Promise.all(validationPromises);

    setFormState(prev => ({
      ...prev,
      errors,
      isValid: Object.keys(errors).length === 0
    }));

    return Object.keys(errors).length === 0;
  }, [formState.values, validateField]);

  /**
   * Handles input change events with debounced validation
   */
  const handleChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = event.target;
    const fieldValue = type === 'checkbox' ? (event.target as HTMLInputElement).checked : value;

    setFormState(prev => ({
      ...prev,
      values: { ...prev.values, [name]: fieldValue },
      isDirty: true
    }));

    if (validateOnChange) {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        validateField(name as keyof T, fieldValue).then(error => {
          setFormState(prev => ({
            ...prev,
            errors: { ...prev.errors, [name]: error }
          }));
        });
      }, debounceMs);
    }
  }, [validateOnChange, debounceMs, validateField]);

  /**
   * Handles input blur events
   */
  const handleBlur = useCallback((event: React.FocusEvent<HTMLInputElement>) => {
    const { name } = event.target;

    setFormState(prev => ({
      ...prev,
      touched: { ...prev.touched, [name]: true }
    }));

    if (validateOnBlur) {
      validateField(name as keyof T, formState.values[name as keyof T]).then(error => {
        setFormState(prev => ({
          ...prev,
          errors: { ...prev.errors, [name]: error }
        }));
      });
    }
  }, [validateOnBlur, formState.values, validateField]);

  /**
   * Handles form submission
   */
  const handleSubmit = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();

    setFormState(prev => ({
      ...prev,
      isSubmitting: true,
      submitCount: prev.submitCount + 1
    }));

    const isValid = await validateForm();

    if (isValid) {
      try {
        await onSubmit(formState.values);
      } catch (error) {
        console.error('Form submission error:', error);
        setFormState(prev => ({
          ...prev,
          errors: {
            ...prev.errors,
            submit: 'Form submission failed. Please try again.'
          }
        }));
      }
    }

    setFormState(prev => ({
      ...prev,
      isSubmitting: false
    }));
  }, [formState.values, validateForm, onSubmit]);

  /**
   * Programmatically sets a field value
   */
  const setFieldValue = useCallback((field: keyof T, value: any) => {
    setFormState(prev => ({
      ...prev,
      values: { ...prev.values, [field]: value },
      isDirty: true
    }));

    if (validateOnChange) {
      validateField(field, value).then(error => {
        setFormState(prev => ({
          ...prev,
          errors: { ...prev.errors, [field]: error }
        }));
      });
    }
  }, [validateOnChange, validateField]);

  /**
   * Programmatically sets a field error
   */
  const setFieldError = useCallback((field: keyof T, error: string) => {
    setFormState(prev => ({
      ...prev,
      errors: { ...prev.errors, [field]: error }
    }));
  }, []);

  /**
   * Resets form to initial state
   */
  const resetForm = useCallback(() => {
    validationCacheRef.current.clear();
    setFormState({
      values: initialValues,
      errors: {} as Record<keyof T, string>,
      touched: {} as Record<keyof T, boolean>,
      isSubmitting: false,
      isValid: false,
      isDirty: false,
      submitCount: 0
    });
  }, [initialValues]);

  // Initial validation on mount
  useEffect(() => {
    if (validateOnMount) {
      validateForm();
    }
  }, [validateOnMount, validateForm]);

  // Cleanup debounce timer
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return {
    values: formState.values,
    errors: formState.errors,
    touched: formState.touched,
    isValid: formState.isValid,
    isSubmitting: formState.isSubmitting,
    isDirty: formState.isDirty,
    handleChange,
    handleBlur,
    handleSubmit,
    setFieldValue,
    setFieldError,
    validateField: async (field: keyof T) => {
      const error = await validateField(field, formState.values[field]);
      setFieldError(field, error);
      return !error;
    },
    validateForm,
    resetForm
  };
}

export default useForm;
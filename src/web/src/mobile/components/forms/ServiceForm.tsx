import React, { useCallback, useMemo } from 'react';
import styled from '@emotion/styled';
import { Input } from '../../../shared/components/forms/Input';
import { useForm } from '../../../shared/hooks/useForm';
import { validateRequired } from '../../../shared/utils/validation.util';
import { TYPOGRAPHY, SPACING, SHADOWS, BREAKPOINTS } from '../../../shared/constants/theme.constants';
import { PRIMARY_COLORS, SEMANTIC_COLORS, NEUTRAL_COLORS } from '../../../shared/styles/colors';

// Styled components for mobile-optimized layout
const FormContainer = styled.form`
  display: flex;
  flex-direction: column;
  padding: ${SPACING.md}px;
  background-color: ${NEUTRAL_COLORS.white};
  border-radius: 8px;
  width: 100%;
  touch-action: manipulation;
  min-height: 100vh;

  @media (min-width: ${BREAKPOINTS.mobile}px) {
    max-width: 600px;
    margin: 0 auto;
    min-height: auto;
  }
`;

const FormSection = styled.div`
  margin-bottom: ${SPACING.lg}px;
`;

const FormTitle = styled.h2`
  font-family: ${TYPOGRAPHY.fontFamily.primary};
  font-size: ${TYPOGRAPHY.fontSize.h3};
  color: ${PRIMARY_COLORS.main};
  margin-bottom: ${SPACING.md}px;
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: ${SPACING.md}px;
  margin-top: ${SPACING.lg}px;
  position: sticky;
  bottom: ${SPACING.md}px;
`;

const Button = styled.button<{ variant?: 'primary' | 'secondary' }>`
  font-family: ${TYPOGRAPHY.fontFamily.primary};
  font-size: ${TYPOGRAPHY.fontSize.body};
  padding: ${SPACING.sm}px ${SPACING.md}px;
  border-radius: 4px;
  border: none;
  min-height: 48px;
  flex: 1;
  box-shadow: ${SHADOWS.light};
  transition: all 0.2s ease-in-out;
  cursor: pointer;

  background-color: ${props => 
    props.variant === 'primary' ? PRIMARY_COLORS.main : NEUTRAL_COLORS.white};
  color: ${props => 
    props.variant === 'primary' ? NEUTRAL_COLORS.white : PRIMARY_COLORS.main};
  border: 1px solid ${props => 
    props.variant === 'primary' ? 'transparent' : PRIMARY_COLORS.main};

  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  &:active {
    transform: scale(0.98);
  }
`;

const ServiceTypeSelect = styled.select`
  font-family: ${TYPOGRAPHY.fontFamily.primary};
  font-size: ${TYPOGRAPHY.fontSize.body};
  padding: ${SPACING.sm}px;
  border: 1px solid ${NEUTRAL_COLORS.gray300};
  border-radius: 4px;
  width: 100%;
  min-height: 48px;
  background-color: ${NEUTRAL_COLORS.white};
  color: ${NEUTRAL_COLORS.black};
  margin-bottom: ${SPACING.md}px;
`;

// Interfaces
interface ServiceFormProps {
  roomId: string;
  onSubmit: (data: ServiceRequestData) => Promise<void>;
  onCancel: () => void;
  preferredTimeRange?: TimeRange;
  serviceNotes?: string;
  priorityLevel?: PriorityLevel;
}

interface ServiceRequestData {
  roomId: string;
  serviceType: ServiceType;
  description: string;
  preferredTime?: TimeRange;
  priorityLevel: PriorityLevel;
  notes?: string;
}

interface TimeRange {
  start: string;
  end: string;
}

enum ServiceType {
  HOUSEKEEPING = 'HOUSEKEEPING',
  MAINTENANCE = 'MAINTENANCE',
  ROOM_SERVICE = 'ROOM_SERVICE',
  CONCIERGE = 'CONCIERGE',
  OTHER = 'OTHER'
}

enum PriorityLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT'
}

export const ServiceForm: React.FC<ServiceFormProps> = ({
  roomId,
  onSubmit,
  onCancel,
  preferredTimeRange,
  serviceNotes = '',
  priorityLevel = PriorityLevel.MEDIUM
}) => {
  // Form validation schema
  const validationSchema = useMemo(() => ({
    fields: {
      serviceType: [{ type: 'required', message: 'Please select a service type' }],
      description: [{ type: 'required', message: 'Please describe your request' }],
      preferredTime: [{ type: 'custom', validate: (value: TimeRange) => 
        value?.start && value?.end && value.start < value.end
      }],
      priorityLevel: [{ type: 'required' }],
      notes: []
    },
    validateOnChange: true,
    validateOnBlur: true
  }), []);

  // Initialize form with useForm hook
  const {
    values,
    errors,
    touched,
    isValid,
    isSubmitting,
    handleChange,
    handleBlur,
    handleSubmit,
    setFieldValue
  } = useForm<ServiceRequestData>({
    initialValues: {
      roomId,
      serviceType: ServiceType.HOUSEKEEPING,
      description: '',
      preferredTime: preferredTimeRange,
      priorityLevel,
      notes: serviceNotes
    },
    validationSchema,
    onSubmit: async (values) => {
      try {
        await onSubmit(values);
      } catch (error) {
        console.error('Service request submission failed:', error);
        throw error;
      }
    }
  });

  // Handle form submission
  const onFormSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSubmitting) {
      await handleSubmit(e);
    }
  }, [handleSubmit, isSubmitting]);

  return (
    <FormContainer onSubmit={onFormSubmit}>
      <FormTitle>Service Request</FormTitle>

      <FormSection>
        <ServiceTypeSelect
          name="serviceType"
          value={values.serviceType}
          onChange={handleChange}
          onBlur={handleBlur}
          aria-label="Service Type"
          aria-invalid={touched.serviceType && !!errors.serviceType}
        >
          {Object.values(ServiceType).map(type => (
            <option key={type} value={type}>
              {type.replace('_', ' ')}
            </option>
          ))}
        </ServiceTypeSelect>

        <Input
          name="description"
          type="text"
          value={values.description}
          onChange={handleChange}
          onBlur={handleBlur}
          label="Request Description"
          error={touched.description ? errors.description : ''}
          placeholder="Please describe your request"
          required
        />

        <Input
          name="notes"
          type="text"
          value={values.notes || ''}
          onChange={handleChange}
          onBlur={handleBlur}
          label="Additional Notes"
          error={touched.notes ? errors.notes : ''}
          placeholder="Any additional details"
        />

        <ServiceTypeSelect
          name="priorityLevel"
          value={values.priorityLevel}
          onChange={handleChange}
          onBlur={handleBlur}
          aria-label="Priority Level"
          aria-invalid={touched.priorityLevel && !!errors.priorityLevel}
        >
          {Object.values(PriorityLevel).map(level => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </ServiceTypeSelect>
      </FormSection>

      <ButtonGroup>
        <Button
          type="button"
          onClick={onCancel}
          variant="secondary"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          disabled={!isValid || isSubmitting}
        >
          {isSubmitting ? 'Submitting...' : 'Submit Request'}
        </Button>
      </ButtonGroup>
    </FormContainer>
  );
};

export default ServiceForm;
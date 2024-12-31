import React, { memo, useCallback } from 'react';
import styled from '@emotion/styled';
import Input from '../../../../shared/components/forms/Input';
import Select from '../../../../shared/components/forms/Select';
import useForm from '../../../../shared/hooks/useForm';
import { Room, RoomStatus } from '../../../../shared/interfaces/room.interface';
import { TYPOGRAPHY, SPACING, SHADOWS, PRIMARY_COLORS, NEUTRAL_COLORS } from '../../../../shared/constants/theme.constants';

// Styled components with WCAG 2.1 AA compliance
const FormContainer = styled.form`
  display: flex;
  flex-direction: column;
  gap: ${SPACING.md}px;
  width: 100%;
  max-width: 600px;
  padding: ${SPACING.lg}px;
  background: ${NEUTRAL_COLORS.white};
  border-radius: 8px;
  box-shadow: ${SHADOWS.medium};
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
`;

const Button = styled.button<{ variant?: 'primary' | 'secondary' }>`
  padding: ${SPACING.sm}px ${SPACING.md}px;
  min-height: 44px;
  font-family: ${TYPOGRAPHY.fontFamily.primary};
  font-size: ${TYPOGRAPHY.fontSize.body};
  font-weight: ${TYPOGRAPHY.fontWeight.medium};
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;

  background: ${props => props.variant === 'primary' ? PRIMARY_COLORS.main : NEUTRAL_COLORS.white};
  color: ${props => props.variant === 'primary' ? NEUTRAL_COLORS.white : PRIMARY_COLORS.main};
  border: 2px solid ${props => props.variant === 'primary' ? PRIMARY_COLORS.main : NEUTRAL_COLORS.gray300};

  &:hover:not(:disabled) {
    background: ${props => props.variant === 'primary' ? PRIMARY_COLORS.dark : NEUTRAL_COLORS.gray100};
  }

  &:focus {
    outline: none;
    box-shadow: 0 0 0 3px ${props => props.variant === 'primary' ? 
      `${PRIMARY_COLORS.main}40` : 
      `${NEUTRAL_COLORS.gray300}40`
    };
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

// Constants for form options
const ISSUE_TYPES = [
  { value: 'plumbing', label: 'Plumbing' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'hvac', label: 'HVAC' },
  { value: 'furniture', label: 'Furniture' },
  { value: 'appliance', label: 'Appliance' },
  { value: 'structural', label: 'Structural' },
  { value: 'other', label: 'Other' }
];

const PRIORITY_LEVELS = [
  { value: 'low', label: 'Low Priority' },
  { value: 'medium', label: 'Medium Priority' },
  { value: 'high', label: 'High Priority' },
  { value: 'urgent', label: 'Urgent Priority' }
];

// Interface definitions
interface MaintenanceFormProps {
  room: Room;
  onSubmit: (values: MaintenanceRequest) => Promise<void>;
  onCancel: () => void;
}

interface MaintenanceRequest {
  roomId: string;
  issueType: string;
  description: string;
  priority: string;
  estimatedDuration: number;
  notes?: string;
}

// Validation schema
const VALIDATION_SCHEMA = {
  fields: {
    issueType: [{
      type: 'required',
      message: 'Issue type is required'
    }],
    description: [{
      type: 'required',
      message: 'Description is required'
    }, {
      type: 'custom',
      validate: (value: string) => value.length <= 500,
      message: 'Description must be 500 characters or less'
    }],
    priority: [{
      type: 'required',
      message: 'Priority level is required'
    }],
    estimatedDuration: [{
      type: 'required',
      message: 'Estimated duration is required'
    }, {
      type: 'custom',
      validate: (value: number) => value >= 0.5 && value <= 72,
      message: 'Duration must be between 0.5 and 72 hours'
    }]
  }
};

const MaintenanceForm: React.FC<MaintenanceFormProps> = memo(({ room, onSubmit, onCancel }) => {
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
  } = useForm<MaintenanceRequest>({
    initialValues: {
      roomId: room.id,
      issueType: '',
      description: '',
      priority: '',
      estimatedDuration: 1,
      notes: ''
    },
    validationSchema: VALIDATION_SCHEMA,
    onSubmit: async (formValues) => {
      await onSubmit(formValues);
    },
    validateOnChange: true,
    validateOnBlur: true
  });

  // Handle form submission
  const onFormSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    handleSubmit(e);
  }, [handleSubmit]);

  return (
    <FormContainer
      onSubmit={onFormSubmit}
      aria-labelledby="maintenance-form-title"
      noValidate
    >
      <FormTitle id="maintenance-form-title">
        Maintenance Request - Room {room.roomNumber}
      </FormTitle>

      <Select
        id="issueType"
        name="issueType"
        value={values.issueType}
        options={ISSUE_TYPES}
        onChange={(value) => setFieldValue('issueType', value)}
        error={touched.issueType && !!errors.issueType}
        aria-label="Issue Type"
        aria-invalid={touched.issueType && !!errors.issueType}
        required
      />

      <Input
        name="description"
        type="text"
        value={values.description}
        onChange={handleChange}
        onBlur={handleBlur}
        label="Description"
        error={touched.description ? errors.description : ''}
        required
        maxLength={500}
        aria-label="Maintenance Issue Description"
      />

      <Select
        id="priority"
        name="priority"
        value={values.priority}
        options={PRIORITY_LEVELS}
        onChange={(value) => setFieldValue('priority', value)}
        error={touched.priority && !!errors.priority}
        aria-label="Priority Level"
        aria-invalid={touched.priority && !!errors.priority}
        required
      />

      <Input
        name="estimatedDuration"
        type="number"
        value={values.estimatedDuration.toString()}
        onChange={handleChange}
        onBlur={handleBlur}
        label="Estimated Duration (hours)"
        error={touched.estimatedDuration ? errors.estimatedDuration : ''}
        required
        inputMode="decimal"
        min={0.5}
        max={72}
        aria-label="Estimated Duration in Hours"
      />

      <Input
        name="notes"
        type="text"
        value={values.notes || ''}
        onChange={handleChange}
        onBlur={handleBlur}
        label="Additional Notes"
        error={touched.notes ? errors.notes : ''}
        aria-label="Additional Notes"
      />

      <ButtonGroup>
        <Button
          type="submit"
          variant="primary"
          disabled={!isValid || isSubmitting}
          aria-busy={isSubmitting}
        >
          {isSubmitting ? 'Submitting...' : 'Submit Request'}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
      </ButtonGroup>
    </FormContainer>
  );
});

MaintenanceForm.displayName = 'MaintenanceForm';

export default MaintenanceForm;
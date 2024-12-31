/**
 * @fileoverview WCAG 2.1 AA compliant form component for managing guest preferences
 * and personalization settings in the hotel management system.
 * @version 1.0.0
 */

import React, { memo, useCallback } from 'react';
import styled from '@emotion/styled';
import { useForm } from '../../../../shared/hooks/useForm';
import Select from '../../../../shared/components/forms/Select';
import { GuestPreference } from '../../../../shared/interfaces/guest.interface';
import { FONT_SIZE, FONT_WEIGHT, LINE_HEIGHT } from '../../../../shared/styles/typography';
import { PRIMARY_COLORS, NEUTRAL_COLORS, SEMANTIC_COLORS } from '../../../../shared/styles/colors';

// Constants for form options
const ROOM_TYPE_OPTIONS = [
  { value: 'standard', label: 'Standard Room' },
  { value: 'deluxe', label: 'Deluxe Room' },
  { value: 'suite', label: 'Executive Suite' }
];

const FLOOR_LEVEL_OPTIONS = [
  { value: '1', label: 'Ground Floor' },
  { value: '2', label: 'Second Floor' },
  { value: '3', label: 'Third Floor' }
];

const AMENITY_OPTIONS = [
  { value: 'wifi', label: 'High-speed WiFi' },
  { value: 'minibar', label: 'Stocked Minibar' },
  { value: 'workspace', label: 'Dedicated Work Desk' },
  { value: 'bathtub', label: 'Luxury Bathtub' }
];

// Styled components with WCAG compliance
const FormContainer = styled.form`
  width: 100%;
  max-width: 600px;
  padding: 24px;
`;

const FormGroup = styled.div`
  margin-bottom: 24px;
`;

const Label = styled.label`
  display: block;
  margin-bottom: 8px;
  font-size: ${FONT_SIZE.body};
  font-weight: ${FONT_WEIGHT.medium};
  color: ${PRIMARY_COLORS.main};
`;

const TextArea = styled.textarea`
  width: 100%;
  padding: 12px;
  border: 2px solid ${NEUTRAL_COLORS.gray400};
  border-radius: 4px;
  font-size: ${FONT_SIZE.body};
  line-height: ${LINE_HEIGHT.normal};
  min-height: 100px;
  resize: vertical;

  &:focus {
    outline: none;
    border-color: ${PRIMARY_COLORS.main};
    box-shadow: 0 0 0 3px ${PRIMARY_COLORS.main}40;
  }

  &[aria-invalid="true"] {
    border-color: ${SEMANTIC_COLORS.error};
  }
`;

const Button = styled.button`
  padding: 12px 24px;
  font-size: ${FONT_SIZE.body};
  font-weight: ${FONT_WEIGHT.medium};
  color: ${NEUTRAL_COLORS.white};
  background-color: ${props => props.disabled ? NEUTRAL_COLORS.gray400 : PRIMARY_COLORS.main};
  border: none;
  border-radius: 4px;
  cursor: ${props => props.disabled ? 'not-allowed' : 'pointer'};
  transition: background-color 0.2s ease;

  &:hover:not(:disabled) {
    background-color: ${PRIMARY_COLORS.dark};
  }

  &:focus {
    outline: none;
    box-shadow: 0 0 0 3px ${PRIMARY_COLORS.main}40;
  }
`;

// Component props interface
interface PreferenceFormProps {
  guestId: string;
  initialPreferences: GuestPreference;
  onSubmit: (preferences: GuestPreference) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

/**
 * PreferenceForm component for managing guest preferences with accessibility support
 */
export const PreferenceForm: React.FC<PreferenceFormProps> = memo(({
  guestId,
  initialPreferences,
  onSubmit,
  onCancel,
  isLoading = false
}) => {
  // Form validation schema
  const validationSchema = {
    fields: {
      roomType: [{ type: 'required', message: 'Please select a room type' }],
      floorLevel: [{ type: 'required', message: 'Please select a floor level' }],
      amenities: [{ type: 'required', message: 'Please select at least one amenity' }],
      specialRequirements: []
    }
  };

  // Initialize form with useForm hook
  const {
    values,
    errors,
    touched,
    handleChange,
    handleBlur,
    handleSubmit,
    setFieldValue,
    isValid
  } = useForm({
    initialValues: initialPreferences,
    validationSchema,
    onSubmit: async (values) => {
      await onSubmit({
        ...values,
        guestId,
        id: initialPreferences.id
      });
    }
  });

  // Handle amenities selection
  const handleAmenitiesChange = useCallback((selectedAmenities: string | string[]) => {
    setFieldValue('amenities', Array.isArray(selectedAmenities) ? selectedAmenities : [selectedAmenities]);
  }, [setFieldValue]);

  return (
    <FormContainer
      onSubmit={handleSubmit}
      aria-label="Guest Preferences Form"
      noValidate
    >
      <FormGroup>
        <Label htmlFor="roomType">Room Type</Label>
        <Select
          id="roomType"
          name="roomType"
          value={values.roomType}
          options={ROOM_TYPE_OPTIONS}
          onChange={(value) => setFieldValue('roomType', value)}
          error={touched.roomType && !!errors.roomType}
          aria-invalid={touched.roomType && !!errors.roomType}
          aria-required="true"
          aria-describedby={errors.roomType ? 'roomType-error' : undefined}
        />
        {touched.roomType && errors.roomType && (
          <span id="roomType-error" role="alert" style={{ color: SEMANTIC_COLORS.error }}>
            {errors.roomType}
          </span>
        )}
      </FormGroup>

      <FormGroup>
        <Label htmlFor="floorLevel">Preferred Floor</Label>
        <Select
          id="floorLevel"
          name="floorLevel"
          value={String(values.floorLevel)}
          options={FLOOR_LEVEL_OPTIONS}
          onChange={(value) => setFieldValue('floorLevel', Number(value))}
          error={touched.floorLevel && !!errors.floorLevel}
          aria-invalid={touched.floorLevel && !!errors.floorLevel}
          aria-required="true"
          aria-describedby={errors.floorLevel ? 'floorLevel-error' : undefined}
        />
        {touched.floorLevel && errors.floorLevel && (
          <span id="floorLevel-error" role="alert" style={{ color: SEMANTIC_COLORS.error }}>
            {errors.floorLevel}
          </span>
        )}
      </FormGroup>

      <FormGroup>
        <Label htmlFor="amenities">Preferred Amenities</Label>
        <Select
          id="amenities"
          name="amenities"
          value={values.amenities}
          options={AMENITY_OPTIONS}
          onChange={handleAmenitiesChange}
          multiple
          error={touched.amenities && !!errors.amenities}
          aria-invalid={touched.amenities && !!errors.amenities}
          aria-required="true"
          aria-describedby={errors.amenities ? 'amenities-error' : undefined}
        />
        {touched.amenities && errors.amenities && (
          <span id="amenities-error" role="alert" style={{ color: SEMANTIC_COLORS.error }}>
            {errors.amenities}
          </span>
        )}
      </FormGroup>

      <FormGroup>
        <Label htmlFor="specialRequirements">Special Requirements</Label>
        <TextArea
          id="specialRequirements"
          name="specialRequirements"
          value={values.specialRequirements}
          onChange={handleChange}
          onBlur={handleBlur}
          aria-invalid={touched.specialRequirements && !!errors.specialRequirements}
          placeholder="Enter any special requirements or requests"
        />
      </FormGroup>

      <div style={{ display: 'flex', gap: '16px', justifyContent: 'flex-end' }}>
        <Button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          style={{ backgroundColor: NEUTRAL_COLORS.gray400 }}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={!isValid || isLoading}
          aria-busy={isLoading}
        >
          {isLoading ? 'Saving...' : 'Save Preferences'}
        </Button>
      </div>
    </FormContainer>
  );
});

PreferenceForm.displayName = 'PreferenceForm';

export default PreferenceForm;
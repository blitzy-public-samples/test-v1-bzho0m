/**
 * @fileoverview Comprehensive React form component for hotel room reservations
 * Implements dynamic pricing, real-time validation, and accessibility features
 * @version 1.0.0
 */

import React, { useState, useCallback, useEffect } from 'react';
import styled from '@emotion/styled'; // v11.0.0
import { addDays, differenceInDays } from 'date-fns'; // v2.30.0
import * as yup from 'yup'; // v1.0.0

// Internal imports
import { DatePicker } from '../../../../shared/components/forms/DatePicker';
import { Select } from '../../../../shared/components/forms/Select';
import { Reservation, ReservationStatus } from '../../../../shared/interfaces/reservation.interface';
import { RoomType } from '../../../../shared/interfaces/room.interface';
import { FONT_SIZE, FONT_WEIGHT } from '../../../../shared/styles/typography';
import { PRIMARY_COLORS, NEUTRAL_COLORS, SEMANTIC_COLORS } from '../../../../shared/styles/colors';

// Styled components
const FormContainer = styled.form`
  display: flex;
  flex-direction: column;
  gap: 24px;
  width: 100%;
  max-width: 600px;
  padding: 24px;
  background: ${NEUTRAL_COLORS.white};
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
`;

const FormSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const FormRow = styled.div`
  display: flex;
  gap: 16px;
  
  @media (max-width: 576px) {
    flex-direction: column;
  }
`;

const Label = styled.label`
  font-size: ${FONT_SIZE.body};
  font-weight: ${FONT_WEIGHT.medium};
  color: ${PRIMARY_COLORS.main};
`;

const ErrorMessage = styled.span`
  color: ${SEMANTIC_COLORS.error};
  font-size: ${FONT_SIZE.small};
  margin-top: 4px;
`;

const TotalAmount = styled.div`
  font-size: ${FONT_SIZE.h3};
  font-weight: ${FONT_WEIGHT.bold};
  color: ${PRIMARY_COLORS.main};
  text-align: right;
  padding: 16px 0;
`;

const ButtonGroup = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 16px;
  margin-top: 24px;
`;

const Button = styled.button<{ variant?: 'primary' | 'secondary' }>`
  padding: 12px 24px;
  border-radius: 4px;
  font-weight: ${FONT_WEIGHT.medium};
  cursor: pointer;
  transition: all 0.2s ease;
  
  ${({ variant }) => variant === 'primary' ? `
    background: ${PRIMARY_COLORS.main};
    color: ${NEUTRAL_COLORS.white};
    border: none;
    
    &:hover {
      background: ${PRIMARY_COLORS.dark};
    }
  ` : `
    background: ${NEUTRAL_COLORS.white};
    color: ${PRIMARY_COLORS.main};
    border: 1px solid ${PRIMARY_COLORS.main};
    
    &:hover {
      background: ${NEUTRAL_COLORS.gray100};
    }
  `}
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

// Validation schema
const validationSchema = yup.object().shape({
  guestId: yup.string().required('Guest information is required'),
  roomNumber: yup.string().required('Room number is required'),
  checkInDate: yup.date().required('Check-in date is required'),
  checkOutDate: yup.date()
    .required('Check-out date is required')
    .min(yup.ref('checkInDate'), 'Check-out date must be after check-in date'),
  numberOfGuests: yup.number()
    .required('Number of guests is required')
    .min(1, 'At least one guest is required')
    .max(4, 'Maximum 4 guests allowed'),
  roomType: yup.string().required('Room type is required'),
});

// Component props interface
interface BookingFormProps {
  initialData: Reservation | null;
  onSubmit: (reservation: Reservation) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
  isDynamicPricing: boolean;
}

export const BookingForm: React.FC<BookingFormProps> = ({
  initialData,
  onSubmit,
  onCancel,
  isLoading,
  isDynamicPricing
}) => {
  // Form state
  const [formData, setFormData] = useState<Partial<Reservation>>(
    initialData || {
      status: ReservationStatus.PENDING,
      numberOfGuests: 1,
      specialRequests: [],
    }
  );
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [totalAmount, setTotalAmount] = useState<number>(0);

  // Calculate total amount based on dates and room type
  const calculateTotalAmount = useCallback(async (
    checkIn: Date,
    checkOut: Date,
    roomType: RoomType
  ) => {
    if (!checkIn || !checkOut || !roomType) return 0;

    const nights = differenceInDays(checkOut, checkIn);
    if (nights <= 0) return 0;

    // Base rates per room type
    const baseRates: Record<RoomType, number> = {
      [RoomType.STANDARD]: 100,
      [RoomType.DELUXE]: 150,
      [RoomType.SUITE]: 250,
      [RoomType.EXECUTIVE]: 300,
      [RoomType.PRESIDENTIAL]: 500,
      [RoomType.ACCESSIBLE]: 100,
    };

    let total = baseRates[roomType] * nights;

    if (isDynamicPricing) {
      // Apply dynamic pricing factors
      const seasonalMultiplier = 1.2; // Example: peak season
      const occupancyMultiplier = 1.1; // Example: high occupancy
      total *= seasonalMultiplier * occupancyMultiplier;
    }

    // Add taxes and fees
    const taxRate = 0.12;
    const serviceFee = 25;
    total = total * (1 + taxRate) + serviceFee;

    return Math.round(total * 100) / 100;
  }, [isDynamicPricing]);

  // Handle form field changes
  const handleChange = useCallback(async (
    field: keyof Reservation,
    value: any
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));

    // Clear related errors
    setErrors(prev => ({ ...prev, [field]: '' }));

    // Recalculate total amount if relevant fields change
    if (['checkInDate', 'checkOutDate', 'roomType'].includes(field)) {
      const newTotal = await calculateTotalAmount(
        field === 'checkInDate' ? value : formData.checkInDate,
        field === 'checkOutDate' ? value : formData.checkOutDate,
        field === 'roomType' ? value : formData.roomType
      );
      setTotalAmount(newTotal);
    }
  }, [formData, calculateTotalAmount]);

  // Handle form submission
  const handleSubmit = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();

    try {
      await validationSchema.validate(formData, { abortEarly: false });

      const reservationData: Reservation = {
        ...formData,
        totalAmount,
        createdAt: new Date(),
        updatedAt: new Date(),
        cancelledAt: null,
        cancellationReason: null,
      } as Reservation;

      await onSubmit(reservationData);
    } catch (err) {
      if (err instanceof yup.ValidationError) {
        const validationErrors: Record<string, string> = {};
        err.inner.forEach(error => {
          if (error.path) {
            validationErrors[error.path] = error.message;
          }
        });
        setErrors(validationErrors);
      }
    }
  }, [formData, totalAmount, onSubmit]);

  // Initialize total amount on component mount
  useEffect(() => {
    if (formData.checkInDate && formData.checkOutDate && formData.roomType) {
      calculateTotalAmount(
        formData.checkInDate,
        formData.checkOutDate,
        formData.roomType
      ).then(setTotalAmount);
    }
  }, []);

  return (
    <FormContainer onSubmit={handleSubmit} noValidate>
      <FormSection>
        <FormRow>
          <div>
            <Label htmlFor="checkInDate">Check-in Date *</Label>
            <DatePicker
              name="checkInDate"
              value={formData.checkInDate}
              onChange={(date) => handleChange('checkInDate', date)}
              minDate={new Date()}
              error={errors.checkInDate}
              required
            />
          </div>
          <div>
            <Label htmlFor="checkOutDate">Check-out Date *</Label>
            <DatePicker
              name="checkOutDate"
              value={formData.checkOutDate}
              onChange={(date) => handleChange('checkOutDate', date)}
              minDate={formData.checkInDate ? addDays(formData.checkInDate, 1) : new Date()}
              error={errors.checkOutDate}
              required
            />
          </div>
        </FormRow>

        <FormRow>
          <div>
            <Label htmlFor="roomType">Room Type *</Label>
            <Select
              value={formData.roomType || ''}
              onChange={(value) => handleChange('roomType', value)}
              options={Object.values(RoomType).map(type => ({
                value: type,
                label: type.charAt(0) + type.slice(1).toLowerCase()
              }))}
              error={!!errors.roomType}
              required
            />
            {errors.roomType && <ErrorMessage>{errors.roomType}</ErrorMessage>}
          </div>
          
          <div>
            <Label htmlFor="numberOfGuests">Number of Guests *</Label>
            <Select
              value={formData.numberOfGuests?.toString() || '1'}
              onChange={(value) => handleChange('numberOfGuests', Number(value))}
              options={[1, 2, 3, 4].map(num => ({
                value: num.toString(),
                label: num.toString()
              }))}
              error={!!errors.numberOfGuests}
              required
            />
            {errors.numberOfGuests && <ErrorMessage>{errors.numberOfGuests}</ErrorMessage>}
          </div>
        </FormRow>
      </FormSection>

      <TotalAmount>
        Total Amount: ${totalAmount.toFixed(2)}
        {isDynamicPricing && (
          <span style={{ fontSize: FONT_SIZE.small, color: NEUTRAL_COLORS.gray500 }}>
            * Dynamic pricing applied
          </span>
        )}
      </TotalAmount>

      <ButtonGroup>
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={isLoading}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          disabled={isLoading}
        >
          {isLoading ? 'Saving...' : initialData ? 'Update Reservation' : 'Create Reservation'}
        </Button>
      </ButtonGroup>
    </FormContainer>
  );
};

export default BookingForm;
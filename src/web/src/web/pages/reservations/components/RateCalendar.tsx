import React, { useState, useCallback, useEffect, useMemo } from 'react';
import styled from '@emotion/styled';
import { format, addDays, isSameDay, startOfDay } from 'date-fns';

// Internal imports
import { DatePicker } from '../../../../shared/components/forms/DatePicker';
import { ReservationRate } from '../../../../shared/interfaces/reservation.interface';
import { reservationApi } from '../../../../shared/api/reservation.api';

// Styled components
const CalendarContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  max-width: 800px;
`;

const RateGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 8px;
  padding: 16px;
  background: #FFFFFF;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
`;

const RateCell = styled.div<{ isSelected?: boolean; isHighlighted?: boolean }>`
  display: flex;
  flex-direction: column;
  padding: 12px;
  border: 1px solid ${props => props.isSelected ? '#3498DB' : '#E0E0E0'};
  border-radius: 4px;
  background-color: ${props => props.isHighlighted ? '#F8F9FA' : '#FFFFFF'};
  cursor: pointer;
  transition: all 0.2s ease-in-out;

  &:hover {
    border-color: #3498DB;
    box-shadow: 0 2px 4px rgba(52, 152, 219, 0.2);
  }

  &:focus-visible {
    outline: 2px solid #3498DB;
    outline-offset: 2px;
  }
`;

const RateDate = styled.span`
  font-size: 14px;
  color: #2C3E50;
  margin-bottom: 4px;
`;

const RateAmount = styled.span`
  font-size: 16px;
  font-weight: 600;
  color: #2C3E50;
`;

const ComparisonLabel = styled.span`
  font-size: 12px;
  color: ${props => props.color || '#7F8C8D'};
  margin-top: 4px;
`;

// Types
interface RateDetails {
  date: Date;
  baseRate: number;
  dynamicRate: number;
  totalRate: number;
}

interface RateCalendarProps {
  selectedDate: Date | null;
  onDateSelect: (date: Date, rate: RateDetails) => void;
  minDate: Date;
  maxDate: Date;
  roomType: string;
  showComparison?: boolean;
  accessibilityLabels?: {
    calendarLabel?: string;
    dateFormat?: string;
    rateFormat?: string;
  };
}

export const RateCalendar: React.FC<RateCalendarProps> = ({
  selectedDate,
  onDateSelect,
  minDate,
  maxDate,
  roomType,
  showComparison = false,
  accessibilityLabels = {
    calendarLabel: 'Room rate calendar',
    dateFormat: 'MMMM d, yyyy',
    rateFormat: 'Rate: $%s per night'
  }
}) => {
  // State
  const [rates, setRates] = useState<Map<string, RateDetails>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Memoized date range
  const dateRange = useMemo(() => {
    const range: Date[] = [];
    let currentDate = startOfDay(minDate);
    const endDate = startOfDay(maxDate);

    while (currentDate <= endDate) {
      range.push(currentDate);
      currentDate = addDays(currentDate, 1);
    }
    return range;
  }, [minDate, maxDate]);

  // Fetch rates for the visible date range
  const fetchRates = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const rateData = await reservationApi.getRateHistory({
        startDate: minDate,
        endDate: maxDate,
        roomType
      });

      const rateMap = new Map<string, RateDetails>();
      rateData.forEach(rate => {
        const dateKey = format(new Date(rate.date), 'yyyy-MM-dd');
        rateMap.set(dateKey, {
          date: new Date(rate.date),
          baseRate: rate.baseRate,
          dynamicRate: rate.dynamicRate || rate.baseRate,
          totalRate: rate.totalRate
        });
      });

      setRates(rateMap);
    } catch (err) {
      setError('Failed to load rates. Please try again.');
      console.error('Error fetching rates:', err);
    } finally {
      setLoading(false);
    }
  }, [minDate, maxDate, roomType]);

  // Load rates on mount and when dependencies change
  useEffect(() => {
    fetchRates();
  }, [fetchRates]);

  // Handle date selection
  const handleDateSelect = useCallback((date: Date, rate: RateDetails) => {
    onDateSelect(date, rate);
  }, [onDateSelect]);

  // Render rate cell
  const renderRateCell = useCallback((date: Date) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    const rateInfo = rates.get(dateKey);
    const isSelected = selectedDate && isSameDay(date, selectedDate);
    const hasDiscount = rateInfo && rateInfo.dynamicRate < rateInfo.baseRate;

    if (!rateInfo) return null;

    return (
      <RateCell
        key={dateKey}
        isSelected={isSelected}
        isHighlighted={hasDiscount}
        onClick={() => handleDateSelect(date, rateInfo)}
        tabIndex={0}
        role="button"
        aria-label={`${format(date, accessibilityLabels.dateFormat || 'MMMM d, yyyy')} - ${format(rateInfo.totalRate, accessibilityLabels.rateFormat || 'Rate: $%s per night')}`}
        aria-pressed={isSelected}
      >
        <RateDate>{format(date, 'MMM d')}</RateDate>
        <RateAmount>${rateInfo.totalRate}</RateAmount>
        {showComparison && (
          <ComparisonLabel color={hasDiscount ? '#27AE60' : undefined}>
            {hasDiscount ? 'Special rate' : 'Standard rate'}
          </ComparisonLabel>
        )}
      </RateCell>
    );
  }, [rates, selectedDate, handleDateSelect, showComparison, accessibilityLabels]);

  return (
    <CalendarContainer role="region" aria-label={accessibilityLabels.calendarLabel}>
      <DatePicker
        name="rateDate"
        value={selectedDate}
        onChange={(date) => date && handleDateSelect(date, rates.get(format(date, 'yyyy-MM-dd')) as RateDetails)}
        minDate={minDate}
        maxDate={maxDate}
        label="Select date"
        aria-label="Select date for rate viewing"
      />
      
      {error && (
        <div role="alert" aria-live="polite">
          {error}
        </div>
      )}

      <RateGrid role="grid" aria-busy={loading}>
        {dateRange.map(date => renderRateCell(date))}
      </RateGrid>
    </CalendarContainer>
  );
};

export default RateCalendar;
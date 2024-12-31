import React, { useMemo, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import styled from 'styled-components';
import { ErrorBoundary } from 'react-error-boundary';
import { Container } from '../../../../shared/components/layout/Container';
import { Grid } from '../../../../shared/components/layout/Grid';
import { selectAllRooms } from '../../../../shared/store/room.slice';
import { Room, RoomStatus } from '../../../../shared/interfaces/room.interface';

// Progress bar colors based on occupancy levels with WCAG 2.1 AA compliance
const PROGRESS_COLORS = {
  low: '#2ECC71', // Green - Below 60%
  medium: '#F1C40F', // Yellow - 60-80%
  high: '#E74C3C', // Red - Above 80%
  disabled: '#95A5A6', // Gray - Error state
} as const;

// Update and performance constants
const UPDATE_INTERVAL = 30000; // 30 seconds
const RETRY_ATTEMPTS = 3;
const DEBOUNCE_DELAY = 250;

// Interface for occupancy statistics
interface OccupancyStats {
  totalRooms: number;
  occupiedRooms: number;
  occupancyRate: number;
}

// Styled components with accessibility support
const StyledWidget = styled(Container)`
  background: #FFFFFF;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  padding: 24px;
  min-height: 160px;
`;

const Title = styled.h2`
  font-size: 18px;
  color: #2C3E50;
  margin: 0 0 16px 0;
  font-weight: 500;
`;

const StyledProgressBar = styled.div<{ color: string }>`
  width: 100%;
  height: 8px;
  background-color: #ECF0F1;
  border-radius: 4px;
  overflow: hidden;
  margin: 8px 0;
  position: relative;
  role: progressbar;
`;

const StyledProgressFill = styled.div<{ width: number; color: string }>`
  width: ${props => `${props.width}%`};
  height: 100%;
  background-color: ${props => props.color};
  border-radius: 4px;
  transition: width 0.3s ease-in-out;
`;

const StatsText = styled.p`
  font-size: 14px;
  color: #7F8C8D;
  margin: 8px 0;
  display: flex;
  justify-content: space-between;
`;

const ErrorMessage = styled.div`
  color: ${PROGRESS_COLORS.high};
  padding: 16px;
  text-align: center;
  background: #FADBD8;
  border-radius: 4px;
  margin-top: 8px;
`;

// Calculate occupancy statistics with memoization
const calculateOccupancyStats = (rooms: Room[]): OccupancyStats => {
  return useMemo(() => {
    if (!Array.isArray(rooms) || rooms.length === 0) {
      return { totalRooms: 0, occupiedRooms: 0, occupancyRate: 0 };
    }

    const totalRooms = rooms.length;
    const occupiedRooms = rooms.filter(room => 
      room.status === RoomStatus.OCCUPIED || room.status === RoomStatus.RESERVED
    ).length;
    const occupancyRate = (occupiedRooms / totalRooms) * 100;

    return {
      totalRooms,
      occupiedRooms,
      occupancyRate: Math.round(occupancyRate * 10) / 10
    };
  }, [rooms]);
};

// Determine progress bar color based on occupancy rate
const getProgressColor = (occupancyRate: number): string => {
  if (occupancyRate >= 80) return PROGRESS_COLORS.high;
  if (occupancyRate >= 60) return PROGRESS_COLORS.medium;
  return PROGRESS_COLORS.low;
};

// Error Fallback component
const ErrorFallback: React.FC<{ error: Error }> = ({ error }) => (
  <ErrorMessage role="alert">
    <p>Error loading occupancy data: {error.message}</p>
  </ErrorMessage>
);

// Main OccupancyWidget component
const OccupancyWidget: React.FC = () => {
  const rooms = useSelector(selectAllRooms);
  const [error, setError] = useState<string | null>(null);

  // Calculate occupancy statistics
  const stats = calculateOccupancyStats(rooms);
  const progressColor = getProgressColor(stats.occupancyRate);

  // Set up real-time updates
  useEffect(() => {
    const updateInterval = setInterval(() => {
      // Update logic handled by Redux store
    }, UPDATE_INTERVAL);

    return () => clearInterval(updateInterval);
  }, []);

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <StyledWidget>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Title>Room Occupancy</Title>
          </Grid>
          <Grid item xs={12}>
            <StyledProgressBar
              role="progressbar"
              aria-valuenow={stats.occupancyRate}
              aria-valuemin={0}
              aria-valuemax={100}
              color={progressColor}
            >
              <StyledProgressFill
                width={stats.occupancyRate}
                color={progressColor}
              />
            </StyledProgressBar>
            <StatsText>
              <span>Occupancy Rate: {stats.occupancyRate}%</span>
              <span>
                {stats.occupiedRooms} / {stats.totalRooms} Rooms
              </span>
            </StatsText>
          </Grid>
          {error && (
            <Grid item xs={12}>
              <ErrorMessage role="alert">{error}</ErrorMessage>
            </Grid>
          )}
        </Grid>
      </StyledWidget>
    </ErrorBoundary>
  );
};

// Set display name for debugging
OccupancyWidget.displayName = 'OccupancyWidget';

export default OccupancyWidget;
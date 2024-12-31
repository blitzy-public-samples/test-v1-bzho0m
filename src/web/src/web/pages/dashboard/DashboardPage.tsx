import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import styled from 'styled-components';
import { ErrorBoundary } from 'react-error-boundary';

// Internal imports
import OccupancyWidget from './components/OccupancyWidget';
import RevenueWidget from './components/RevenueWidget';
import RoomGrid from './components/RoomGrid';
import { Container } from '../../../shared/components/layout/Container';
import { Grid } from '../../../shared/components/layout/Grid';
import { useWebSocket } from '../../../shared/hooks/useWebSocket';
import { Room, RoomStatus, WebSocketEvents, WebSocketNamespaces } from '../../../shared/interfaces/room.interface';
import { NEUTRAL_COLORS, PRIMARY_COLORS } from '../../../shared/styles/colors';

// Styled components
const DashboardContainer = styled(Container)`
  padding: 24px;
  min-height: 100vh;
  background-color: ${NEUTRAL_COLORS.gray100};
`;

const DashboardHeader = styled.header`
  margin-bottom: 24px;
`;

const Title = styled.h1`
  color: ${PRIMARY_COLORS.main};
  font-size: 24px;
  margin: 0 0 8px 0;
`;

const StatusBar = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  color: ${NEUTRAL_COLORS.gray500};
  font-size: 14px;
`;

const ConnectionStatus = styled.span<{ isConnected: boolean }>`
  display: flex;
  align-items: center;
  gap: 4px;
  color: ${props => props.isConnected ? '#27AE60' : '#E74C3C'};

  &::before {
    content: '';
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: currentColor;
  }
`;

const ErrorContainer = styled.div`
  padding: 16px;
  background-color: ${NEUTRAL_COLORS.white};
  border-radius: 8px;
  border-left: 4px solid #E74C3C;
  margin-bottom: 16px;
`;

// Error Fallback component
const ErrorFallback: React.FC<{ error: Error }> = ({ error }) => (
  <ErrorContainer role="alert">
    <h2>Dashboard Error</h2>
    <p>{error.message}</p>
    <button onClick={() => window.location.reload()}>Refresh Page</button>
  </ErrorContainer>
);

// Dashboard component
const DashboardPage: React.FC = () => {
  // State
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [floorFilter, setFloorFilter] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<RoomStatus | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // WebSocket connection
  const { isConnected, sendMessage, subscribe } = useWebSocket({
    url: process.env.REACT_APP_WS_URL || 'ws://localhost:3001/ws',
    namespace: WebSocketNamespaces.ROOM_MANAGEMENT,
    reconnectAttempts: 5,
    debug: process.env.NODE_ENV === 'development'
  });

  // Grid size configuration for responsive layout
  const gridSize = useMemo(() => ({
    xs: 12,
    sm: 6,
    md: 4,
    lg: 3
  }), []);

  // Room selection handler
  const handleRoomSelect = useCallback((room: Room) => {
    setSelectedRoom(room);
  }, []);

  // Subscribe to real-time updates
  useEffect(() => {
    const unsubscribe = subscribe(WebSocketEvents.ROOM_STATUS_UPDATE, (payload: any) => {
      setLastUpdate(new Date());
    });

    return () => {
      unsubscribe(WebSocketEvents.ROOM_STATUS_UPDATE);
    };
  }, [subscribe]);

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <DashboardContainer maxWidth="xl">
        <DashboardHeader>
          <Title>Hotel Dashboard</Title>
          <StatusBar>
            <ConnectionStatus isConnected={isConnected}>
              {isConnected ? 'Connected' : 'Disconnected'}
            </ConnectionStatus>
            <span>Last update: {lastUpdate.toLocaleTimeString()}</span>
          </StatusBar>
        </DashboardHeader>

        <Grid container spacing={3}>
          {/* Occupancy Widget */}
          <Grid item xs={12} md={6}>
            <OccupancyWidget />
          </Grid>

          {/* Revenue Widget */}
          <Grid item xs={12} md={6}>
            <RevenueWidget 
              period="daily"
              showChart={true}
              refreshInterval={300000}
            />
          </Grid>

          {/* Room Grid Section */}
          <Grid item xs={12}>
            <RoomGrid
              floorFilter={floorFilter}
              statusFilter={statusFilter}
              onRoomSelect={handleRoomSelect}
              gridSize={gridSize}
            />
          </Grid>
        </Grid>

        {/* Hidden live region for accessibility announcements */}
        <div
          role="status"
          aria-live="polite"
          className="sr-only"
        >
          {isConnected ? 'Dashboard connected' : 'Dashboard disconnected'}
        </div>
      </DashboardContainer>
    </ErrorBoundary>
  );
};

export default DashboardPage;
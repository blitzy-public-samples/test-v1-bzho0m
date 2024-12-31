import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import styled from '@emotion/styled';
import { ErrorBoundary } from 'react-error-boundary';

// Internal imports
import { Room, RoomStatus, RoomType } from '../../../shared/interfaces/room.interface';
import { getRoomById, updateRoomStatus } from '../../../shared/api/room.api';
import HousekeepingStatus from './components/HousekeepingStatus';
import MaintenanceForm from './components/MaintenanceForm';
import useWebSocket from '../../../shared/hooks/useWebSocket';
import { WebSocketEvents, WebSocketNamespaces } from '@/websocket-service/config';
import { TYPOGRAPHY, SPACING, SHADOWS, PRIMARY_COLORS, NEUTRAL_COLORS } from '../../../shared/constants/theme.constants';

// Styled components with WCAG 2.1 AA compliance
const PageContainer = styled.div`
  padding: ${SPACING.lg}px;
  max-width: 1200px;
  margin: 0 auto;
  display: grid;
  gap: ${SPACING.md}px;

  @media (max-width: 768px) {
    padding: ${SPACING.md}px;
  }
`;

const RoomHeader = styled.header`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${SPACING.lg}px;
  padding: ${SPACING.md}px;
  background: ${NEUTRAL_COLORS.white};
  border-radius: 8px;
  box-shadow: ${SHADOWS.medium};

  @media (max-width: 576px) {
    flex-direction: column;
    gap: ${SPACING.md}px;
  }
`;

const RoomTitle = styled.h1`
  font-family: ${TYPOGRAPHY.fontFamily.primary};
  font-size: ${TYPOGRAPHY.fontSize.h2};
  color: ${PRIMARY_COLORS.main};
  margin: 0;
`;

const StatusBadge = styled.span<{ status: RoomStatus }>`
  padding: ${SPACING.xs}px ${SPACING.sm}px;
  border-radius: 4px;
  font-weight: ${TYPOGRAPHY.fontWeight.medium};
  background-color: ${props => {
    switch (props.status) {
      case RoomStatus.AVAILABLE: return '#27AE60';
      case RoomStatus.OCCUPIED: return '#3498DB';
      case RoomStatus.CLEANING: return '#F1C40F';
      case RoomStatus.MAINTENANCE: return '#E74C3C';
      default: return NEUTRAL_COLORS.gray400;
    }
  }};
  color: ${NEUTRAL_COLORS.white};
`;

const DetailSection = styled.section`
  background: ${NEUTRAL_COLORS.white};
  padding: ${SPACING.md}px;
  border-radius: 8px;
  box-shadow: ${SHADOWS.medium};
`;

const ActionButton = styled.button<{ variant?: 'primary' | 'secondary' }>`
  padding: ${SPACING.sm}px ${SPACING.md}px;
  border-radius: 4px;
  font-weight: ${TYPOGRAPHY.fontWeight.medium};
  min-height: 44px;
  cursor: pointer;
  transition: all 0.2s ease;
  
  background: ${props => props.variant === 'primary' ? PRIMARY_COLORS.main : NEUTRAL_COLORS.white};
  color: ${props => props.variant === 'primary' ? NEUTRAL_COLORS.white : PRIMARY_COLORS.main};
  border: 2px solid ${props => props.variant === 'primary' ? PRIMARY_COLORS.main : NEUTRAL_COLORS.gray300};

  &:hover:not(:disabled) {
    background: ${props => props.variant === 'primary' ? PRIMARY_COLORS.dark : NEUTRAL_COLORS.gray100};
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const ErrorFallback = styled.div`
  padding: ${SPACING.lg}px;
  color: ${NEUTRAL_COLORS.error};
  text-align: center;
`;

// Component implementation
const RoomDetailPage: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showMaintenanceForm, setShowMaintenanceForm] = useState(false);

  // WebSocket connection for real-time updates
  const { isConnected, connectionState, subscribe } = useWebSocket({
    url: process.env.REACT_APP_WEBSOCKET_URL || 'ws://localhost:3001',
    namespace: WebSocketNamespaces.ROOM_MANAGEMENT
  });

  // Fetch room data
  const fetchRoomData = useCallback(async () => {
    try {
      if (!roomId) throw new Error('Room ID is required');
      const data = await getRoomById(roomId);
      setRoom(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch room data');
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  // Handle room status updates
  const handleStatusUpdate = useCallback(async (newStatus: RoomStatus) => {
    try {
      if (!room) return;
      const updatedRoom = await updateRoomStatus(room.id, newStatus);
      setRoom(updatedRoom);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update room status');
    }
  }, [room]);

  // Handle maintenance request submission
  const handleMaintenanceSubmit = useCallback(async (values: any) => {
    try {
      await handleStatusUpdate(RoomStatus.MAINTENANCE);
      setShowMaintenanceForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit maintenance request');
    }
  }, [handleStatusUpdate]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!roomId) return;

    const unsubscribe = subscribe(WebSocketEvents.ROOM_STATUS_UPDATE, (payload: any) => {
      if (payload.roomId === roomId) {
        setRoom(prevRoom => prevRoom ? { ...prevRoom, ...payload } : null);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [roomId, subscribe]);

  // Initial data fetch
  useEffect(() => {
    fetchRoomData();
  }, [fetchRoomData]);

  // Memoized room type display
  const roomTypeDisplay = useMemo(() => {
    if (!room) return '';
    return room.type.charAt(0) + room.type.slice(1).toLowerCase().replace('_', ' ');
  }, [room?.type]);

  if (loading) {
    return <PageContainer>Loading room details...</PageContainer>;
  }

  if (error) {
    return (
      <ErrorFallback>
        <h2>Error loading room details</h2>
        <p>{error}</p>
        <ActionButton onClick={() => navigate('/rooms')}>
          Return to Room List
        </ActionButton>
      </ErrorFallback>
    );
  }

  if (!room) {
    return <PageContainer>Room not found</PageContainer>;
  }

  return (
    <ErrorBoundary
      FallbackComponent={({ error }) => (
        <ErrorFallback>
          <h2>Something went wrong</h2>
          <p>{error.message}</p>
          <ActionButton onClick={() => navigate('/rooms')}>
            Return to Room List
          </ActionButton>
        </ErrorFallback>
      )}
    >
      <PageContainer>
        <RoomHeader>
          <div>
            <RoomTitle>Room {room.roomNumber}</RoomTitle>
            <p>{roomTypeDisplay}</p>
          </div>
          <StatusBadge status={room.status}>
            {room.status}
          </StatusBadge>
        </RoomHeader>

        <DetailSection>
          <HousekeepingStatus
            roomId={room.id}
            roomNumber={room.roomNumber}
            status={room.status}
            lastCleaned={new Date()} // Replace with actual last cleaned date
            onStatusChange={handleStatusUpdate}
          />
        </DetailSection>

        {showMaintenanceForm ? (
          <DetailSection>
            <MaintenanceForm
              room={room}
              onSubmit={handleMaintenanceSubmit}
              onCancel={() => setShowMaintenanceForm(false)}
            />
          </DetailSection>
        ) : (
          <ActionButton
            variant="primary"
            onClick={() => setShowMaintenanceForm(true)}
            disabled={room.status === RoomStatus.MAINTENANCE}
          >
            Request Maintenance
          </ActionButton>
        )}

        <div aria-live="polite" role="status">
          {!isConnected && (
            <p>Connection Status: {connectionState}</p>
          )}
        </div>
      </PageContainer>
    </ErrorBoundary>
  );
};

export default RoomDetailPage;
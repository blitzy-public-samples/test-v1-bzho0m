import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual'; // @tanstack/react-virtual@3.0.0
import styled from 'styled-components'; // styled-components@5.3.0

import Grid from '../../../../shared/components/layout/Grid';
import RoomCard from '../../../../shared/components/cards/RoomCard';
import { useWebSocket } from '../../../../shared/hooks/useWebSocket';
import { Room, RoomStatus, WebSocketEvents, WebSocketNamespaces } from '../../../../shared/interfaces/room.interface';
import { NEUTRAL_COLORS, getColorWithOpacity } from '../../../../shared/styles/colors';

// Interfaces
interface RoomGridProps {
  floorFilter: number | null;
  statusFilter: RoomStatus | null;
  onRoomSelect: (room: Room) => void;
  gridSize: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
  };
}

// Styled Components
const GridContainer = styled.div`
  width: 100%;
  height: 100%;
  overflow: auto;
  padding: 16px;
  background-color: ${NEUTRAL_COLORS.gray100};
`;

const VirtualContainer = styled.div`
  width: 100%;
  height: 100%;
  position: relative;
`;

const LoadingOverlay = styled.div<{ visible: boolean }>`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: ${props => getColorWithOpacity(NEUTRAL_COLORS.white, 0.8)};
  display: flex;
  justify-content: center;
  align-items: center;
  opacity: ${props => props.visible ? 1 : 0};
  pointer-events: ${props => props.visible ? 'auto' : 'none'};
  transition: opacity 0.3s ease-in-out;
  z-index: 10;
`;

const ErrorMessage = styled.div`
  color: ${NEUTRAL_COLORS.gray500};
  text-align: center;
  padding: 24px;
`;

const RoomGrid: React.FC<RoomGridProps> = ({
  floorFilter,
  statusFilter,
  onRoomSelect,
  gridSize
}) => {
  // State
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingRooms, setUpdatingRooms] = useState<Set<string>>(new Set());

  // WebSocket connection
  const { isConnected, sendMessage, subscribe } = useWebSocket({
    url: process.env.REACT_APP_WS_URL || 'ws://localhost:3001/ws',
    namespace: WebSocketNamespaces.ROOM_MANAGEMENT,
    reconnectAttempts: 5
  });

  // Filter rooms based on criteria
  const filteredRooms = useMemo(() => {
    return rooms.filter(room => {
      const floorMatch = floorFilter === null || room.floor === floorFilter;
      const statusMatch = statusFilter === null || room.status === statusFilter;
      return floorMatch && statusMatch;
    });
  }, [rooms, floorFilter, statusFilter]);

  // Virtual list configuration
  const parentRef = React.useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: filteredRooms.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 250, // Estimated height of room card
    overscan: 5
  });

  // Fetch initial room data
  useEffect(() => {
    const fetchRooms = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/rooms');
        if (!response.ok) throw new Error('Failed to fetch rooms');
        const data = await response.json();
        setRooms(data);
        setError(null);
      } catch (err) {
        setError('Failed to load rooms. Please try again.');
        console.error('Error fetching rooms:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchRooms();
  }, []);

  // Subscribe to room status updates
  useEffect(() => {
    const unsubscribe = subscribe(WebSocketEvents.ROOM_STATUS_UPDATE, (payload: any) => {
      setRooms(prevRooms => {
        return prevRooms.map(room => {
          if (room.id === payload.roomId) {
            return { ...room, ...payload.updates };
          }
          return room;
        });
      });
    });

    return () => {
      unsubscribe(WebSocketEvents.ROOM_STATUS_UPDATE);
    };
  }, [subscribe]);

  // Handle room status changes
  const handleStatusChange = useCallback(async (roomId: string, newStatus: RoomStatus) => {
    try {
      setUpdatingRooms(prev => new Set(prev).add(roomId));
      
      await sendMessage(WebSocketEvents.ROOM_STATUS_UPDATE, {
        roomId,
        status: newStatus,
        timestamp: new Date()
      });

      setRooms(prevRooms =>
        prevRooms.map(room =>
          room.id === roomId ? { ...room, status: newStatus } : room
        )
      );
    } catch (err) {
      setError(`Failed to update room ${roomId} status`);
      console.error('Error updating room status:', err);
    } finally {
      setUpdatingRooms(prev => {
        const next = new Set(prev);
        next.delete(roomId);
        return next;
      });
    }
  }, [sendMessage]);

  // Render grid items
  const renderVirtualItems = () => {
    return virtualizer.getVirtualItems().map(virtualRow => {
      const room = filteredRooms[virtualRow.index];
      return (
        <Grid
          key={room.id}
          item
          xs={12}
          sm={6}
          md={4}
          lg={3}
          style={{
            height: virtualRow.size,
            transform: `translateY(${virtualRow.start}px)`
          }}
        >
          <RoomCard
            room={room}
            onSelect={() => onRoomSelect(room)}
            onStatusChange={handleStatusChange}
            isUpdating={updatingRooms.has(room.id)}
          />
        </Grid>
      );
    });
  };

  if (error) {
    return <ErrorMessage>{error}</ErrorMessage>;
  }

  return (
    <GridContainer ref={parentRef}>
      <LoadingOverlay visible={loading}>
        Loading rooms...
      </LoadingOverlay>
      
      <VirtualContainer
        style={{ height: `${virtualizer.getTotalSize()}px` }}
        role="grid"
        aria-busy={loading}
        aria-live="polite"
      >
        <Grid container spacing={2}>
          {renderVirtualItems()}
        </Grid>
      </VirtualContainer>
      
      {!loading && filteredRooms.length === 0 && (
        <ErrorMessage>No rooms match the selected filters</ErrorMessage>
      )}
    </GridContainer>
  );
};

export default RoomGrid;
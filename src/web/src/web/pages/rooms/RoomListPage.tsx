import React, { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import styled from 'styled-components';
import { useDispatch, useSelector } from 'react-redux';
import DataTable, { Column } from '../../../../shared/components/tables/DataTable';
import RoomCard, { RoomStatusBadge } from '../../../../shared/components/cards/RoomCard';
import useWebSocket from '../../../../shared/hooks/useWebSocket';
import { 
  fetchRooms, 
  updateRoomWithRetry, 
  roomSelectors 
} from '../../../../shared/store/room.slice';
import { Room, RoomStatus, RoomType } from '../../../../shared/interfaces/room.interface';
import { WebSocketEvents, WebSocketNamespaces } from '@/websocket-service/config';
import { NEUTRAL_COLORS, PRIMARY_COLORS } from '../../../../shared/styles/colors';

// Constants
const MOBILE_BREAKPOINT = 576;
const TABLET_BREAKPOINT = 768;

// Styled Components
const PageContainer = styled.div`
  padding: 24px;
  background-color: ${NEUTRAL_COLORS.gray100};
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;

  @media (max-width: ${MOBILE_BREAKPOINT}px) {
    flex-direction: column;
    gap: 16px;
  }
`;

const Title = styled.h1`
  color: ${PRIMARY_COLORS.main};
  margin: 0;
`;

const Controls = styled.div`
  display: flex;
  gap: 16px;
  align-items: center;

  @media (max-width: ${MOBILE_BREAKPOINT}px) {
    width: 100%;
    justify-content: space-between;
  }
`;

const GridContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 24px;
  margin-top: 24px;
`;

// Filter state and reducer
interface FilterState {
  status: RoomStatus[] | 'all';
  type: RoomType[] | 'all';
  searchQuery: string;
  floor: number | 'all';
}

type FilterAction = 
  | { type: 'SET_STATUS'; payload: RoomStatus[] | 'all' }
  | { type: 'SET_TYPE'; payload: RoomType[] | 'all' }
  | { type: 'SET_SEARCH'; payload: string }
  | { type: 'SET_FLOOR'; payload: number | 'all' }
  | { type: 'RESET' };

const initialFilterState: FilterState = {
  status: 'all',
  type: 'all',
  searchQuery: '',
  floor: 'all'
};

const filterReducer = (state: FilterState, action: FilterAction): FilterState => {
  switch (action.type) {
    case 'SET_STATUS':
      return { ...state, status: action.payload };
    case 'SET_TYPE':
      return { ...state, type: action.payload };
    case 'SET_SEARCH':
      return { ...state, searchQuery: action.payload };
    case 'SET_FLOOR':
      return { ...state, floor: action.payload };
    case 'RESET':
      return initialFilterState;
    default:
      return state;
  }
};

const RoomListPage: React.FC = () => {
  const dispatch = useDispatch();
  const rooms = useSelector(roomSelectors.selectAllRooms);
  const loading = useSelector((state) => roomSelectors.selectLoadingState(state, 'fetchRooms'));
  
  // Local state
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [filters, dispatchFilter] = useReducer(filterReducer, initialFilterState);
  
  // WebSocket setup
  const { isConnected, subscribe } = useWebSocket({
    url: process.env.REACT_APP_WEBSOCKET_URL || 'ws://localhost:3001',
    namespace: WebSocketNamespaces.ROOM_MANAGEMENT
  });

  // Initial data fetch
  useEffect(() => {
    dispatch(fetchRooms({ forceRefresh: true }));
  }, [dispatch]);

  // WebSocket subscription
  useEffect(() => {
    if (isConnected) {
      const unsubscribe = subscribe(WebSocketEvents.ROOM_STATUS_UPDATE, (payload: Room) => {
        dispatch(updateRoomWithRetry({ roomId: payload.id, status: payload.status }));
      });
      return unsubscribe;
    }
  }, [isConnected, subscribe, dispatch]);

  // Filter rooms
  const filteredRooms = useMemo(() => {
    return rooms.filter(room => {
      const matchesStatus = filters.status === 'all' || 
        (Array.isArray(filters.status) && filters.status.includes(room.status));
      const matchesType = filters.type === 'all' || 
        (Array.isArray(filters.type) && filters.type.includes(room.type));
      const matchesFloor = filters.floor === 'all' || room.floor === filters.floor;
      const matchesSearch = room.roomNumber.toLowerCase().includes(filters.searchQuery.toLowerCase());

      return matchesStatus && matchesType && matchesFloor && matchesSearch;
    });
  }, [rooms, filters]);

  // Table columns configuration
  const columns: Column[] = useMemo(() => [
    {
      id: 'roomNumber',
      header: 'Room',
      accessor: 'roomNumber',
      width: '100px'
    },
    {
      id: 'status',
      header: 'Status',
      accessor: 'status',
      Cell: (value) => <RoomStatusBadge status={value as RoomStatus} />
    },
    {
      id: 'type',
      header: 'Type',
      accessor: 'type'
    },
    {
      id: 'floor',
      header: 'Floor',
      accessor: 'floor',
      width: '80px'
    },
    {
      id: 'baseRate',
      header: 'Rate',
      accessor: 'baseRate',
      Cell: (value) => `$${value}`
    }
  ], []);

  // Handlers
  const handleStatusChange = useCallback(async (roomId: string, status: RoomStatus) => {
    try {
      await dispatch(updateRoomWithRetry({ roomId, status })).unwrap();
    } catch (error) {
      console.error('Failed to update room status:', error);
    }
  }, [dispatch]);

  return (
    <PageContainer>
      <Header>
        <Title>Room Management</Title>
        <Controls>
          {/* Filter controls would go here */}
          <button
            onClick={() => setViewMode(prev => prev === 'grid' ? 'table' : 'grid')}
            aria-label={`Switch to ${viewMode === 'grid' ? 'table' : 'grid'} view`}
          >
            {viewMode === 'grid' ? 'Table View' : 'Grid View'}
          </button>
        </Controls>
      </Header>

      {viewMode === 'grid' ? (
        <GridContainer role="grid" aria-busy={loading}>
          {filteredRooms.map(room => (
            <RoomCard
              key={room.id}
              room={room}
              onStatusChange={handleStatusChange}
              isLoading={loading}
            />
          ))}
        </GridContainer>
      ) : (
        <DataTable
          columns={columns}
          data={filteredRooms}
          loading={loading}
          rowKey="id"
          stickyHeader
          responsive
          aria-label="Room list table"
        />
      )}
    </PageContainer>
  );
};

export default RoomListPage;
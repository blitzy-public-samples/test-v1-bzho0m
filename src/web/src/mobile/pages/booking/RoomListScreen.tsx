import React, { useEffect, useCallback, useState, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import RoomCard from '../../../shared/components/cards/RoomCard';
import { 
  Room, 
  RoomStatus, 
  RoomType, 
  RoomAmenities 
} from '../../../shared/interfaces/room.interface';
import { 
  PRIMARY_COLORS, 
  NEUTRAL_COLORS, 
  getColorWithOpacity 
} from '../../../shared/styles/colors';

// Styled Components
const StyledContainer = styled.div`
  padding: 16px;
  background-color: ${NEUTRAL_COLORS.gray100};
  min-height: 100vh;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
`;

const FilterSection = styled.div`
  margin-bottom: 16px;
  padding: 12px;
  background-color: ${NEUTRAL_COLORS.white};
  border-radius: 8px;
  box-shadow: 0 2px 4px ${getColorWithOpacity(NEUTRAL_COLORS.gray400, 0.1)};
  position: sticky;
  top: 0;
  z-index: 100;
`;

const FilterChipsContainer = styled.div`
  display: flex;
  flex-wrap: nowrap;
  overflow-x: auto;
  gap: 8px;
  padding: 8px 0;
  -webkit-overflow-scrolling: touch;

  &::-webkit-scrollbar {
    display: none;
  }
`;

const FilterChip = styled.button<{ isActive: boolean }>`
  padding: 8px 16px;
  border-radius: 20px;
  border: none;
  background-color: ${props => props.isActive ? PRIMARY_COLORS.main : NEUTRAL_COLORS.gray200};
  color: ${props => props.isActive ? NEUTRAL_COLORS.white : PRIMARY_COLORS.main};
  font-size: 14px;
  white-space: nowrap;
  touch-action: manipulation;
  transition: all 0.2s ease;

  &:active {
    transform: scale(0.95);
  }
`;

const RoomList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const LoadingIndicator = styled.div`
  text-align: center;
  padding: 16px;
  color: ${PRIMARY_COLORS.main};
`;

// Interfaces
interface RoomFilterOptions {
  type: RoomType | 'all';
  status: RoomStatus | 'all';
  priceRange: {
    min: number;
    max: number;
  };
  amenities: RoomAmenities[];
}

// Custom Hooks
const useRoomFilters = (rooms: Room[], initialFilters: RoomFilterOptions) => {
  const [filters, setFilters] = useState<RoomFilterOptions>(initialFilters);
  const [filteredRooms, setFilteredRooms] = useState<Room[]>(rooms);

  const applyFilters = useCallback(() => {
    let result = [...rooms];

    if (filters.type !== 'all') {
      result = result.filter(room => room.type === filters.type);
    }

    if (filters.status !== 'all') {
      result = result.filter(room => room.status === filters.status);
    }

    result = result.filter(room => 
      room.baseRate >= filters.priceRange.min &&
      room.baseRate <= filters.priceRange.max
    );

    if (filters.amenities.length > 0) {
      result = result.filter(room =>
        filters.amenities.every(amenity => room.amenities.includes(amenity))
      );
    }

    setFilteredRooms(result);
  }, [rooms, filters]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  return { filteredRooms, filters, setFilters };
};

// Main Component
const RoomListScreen: React.FC = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const listRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initial filter state
  const initialFilters: RoomFilterOptions = {
    type: 'all',
    status: 'all',
    priceRange: { min: 0, max: 10000 },
    amenities: []
  };

  // Mock rooms data - replace with Redux selector
  const rooms: Room[] = [];
  const { filteredRooms, filters, setFilters } = useRoomFilters(rooms, initialFilters);

  // Pull to refresh implementation
  const touchStart = useRef<number>(0);
  const pullThreshold = 100;

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStart.current = e.touches[0].clientY;
  };

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const touchY = e.touches[0].clientY;
    const pull = touchY - touchStart.current;
    
    if (pull > pullThreshold && listRef.current?.scrollTop === 0) {
      refreshRooms();
    }
  }, []);

  // Refresh rooms data
  const refreshRooms = async () => {
    try {
      setIsLoading(true);
      // Dispatch refresh action here
      setError(null);
    } catch (err) {
      setError('Failed to refresh rooms');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle room selection
  const handleRoomSelect = useCallback((room: Room) => {
    navigate(`/booking/room/${room.id}`);
  }, [navigate]);

  // WebSocket connection for real-time updates
  useEffect(() => {
    const ws = new WebSocket(process.env.REACT_APP_WS_URL || '');

    ws.onmessage = (event) => {
      const update = JSON.parse(event.data);
      // Handle room updates here
    };

    return () => {
      ws.close();
    };
  }, []);

  return (
    <StyledContainer
      ref={listRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      role="main"
      aria-label="Room list"
    >
      <FilterSection role="search" aria-label="Room filters">
        <FilterChipsContainer>
          {Object.values(RoomType).map(type => (
            <FilterChip
              key={type}
              isActive={filters.type === type}
              onClick={() => setFilters({ ...filters, type })}
              aria-pressed={filters.type === type}
            >
              {type}
            </FilterChip>
          ))}
        </FilterChipsContainer>
      </FilterSection>

      <RoomList
        role="list"
        aria-live="polite"
        aria-busy={isLoading}
      >
        {error && (
          <div role="alert" aria-live="assertive">
            {error}
          </div>
        )}
        
        {isLoading ? (
          <LoadingIndicator aria-label="Loading rooms">
            Loading...
          </LoadingIndicator>
        ) : (
          filteredRooms.map(room => (
            <RoomCard
              key={room.id}
              room={room}
              onSelect={handleRoomSelect}
              showDetails={true}
            />
          ))
        )}
      </RoomList>
    </StyledContainer>
  );
};

export default RoomListScreen;
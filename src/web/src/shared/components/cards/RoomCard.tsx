import React, { memo, useCallback, useEffect, useRef } from 'react';
import styled, { css, keyframes } from 'styled-components';
import {
  WifiIcon,
  TvIcon,
  AcUnitIcon,
  RoomServiceIcon,
  EditIcon,
  MoreVertIcon,
} from '@material-ui/icons';

import {
  Room,
  RoomStatus,
  RoomType,
  RoomAmenities,
} from '../../interfaces/room.interface';
import {
  PRIMARY_COLORS,
  SECONDARY_COLORS,
  ACCENT_COLORS,
  SEMANTIC_COLORS,
  NEUTRAL_COLORS,
  getColorWithOpacity,
  getContrastColor,
} from '../../styles/colors';

// Animation keyframes
const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const pulse = keyframes`
  0% { transform: scale(1); }
  50% { transform: scale(1.05); }
  100% { transform: scale(1); }
`;

// Constants
const STATUS_COLORS = {
  [RoomStatus.AVAILABLE]: SEMANTIC_COLORS.success,
  [RoomStatus.OCCUPIED]: PRIMARY_COLORS.main,
  [RoomStatus.CLEANING]: ACCENT_COLORS.main,
  [RoomStatus.MAINTENANCE]: SEMANTIC_COLORS.warning,
  [RoomStatus.OUT_OF_ORDER]: SEMANTIC_COLORS.error,
  [RoomStatus.RESERVED]: SECONDARY_COLORS.main,
  [RoomStatus.BLOCKED]: NEUTRAL_COLORS.gray500,
};

// Interfaces
interface RoomCardProps {
  room: Room;
  onSelect?: (room: Room) => void;
  onStatusChange?: (roomId: string, status: RoomStatus) => Promise<void>;
  onEdit?: (room: Room) => void;
  isSelected?: boolean;
  showDetails?: boolean;
  isLoading?: boolean;
  error?: string | null;
}

// Styled Components
const StyledCard = styled.div<{
  isSelected?: boolean;
  isLoading?: boolean;
  hasError?: boolean;
  statusColor: string;
}>`
  position: relative;
  width: 300px;
  min-height: 200px;
  padding: 16px;
  margin: 8px;
  border-radius: 8px;
  background-color: ${NEUTRAL_COLORS.white};
  border: 2px solid ${props => props.statusColor};
  box-shadow: 0 2px 4px ${props => getColorWithOpacity(NEUTRAL_COLORS.gray400, 0.2)};
  transition: all 0.25s ease-in-out;
  cursor: pointer;
  
  ${props => props.isSelected && css`
    transform: translateY(-2px);
    box-shadow: 0 4px 8px ${getColorWithOpacity(NEUTRAL_COLORS.gray400, 0.3)};
  `}

  ${props => props.isLoading && css`
    opacity: 0.7;
    pointer-events: none;
  `}

  ${props => props.hasError && css`
    border-color: ${SEMANTIC_COLORS.error};
    animation: ${pulse} 0.5s ease-in-out;
  `}

  &:focus-within {
    outline: 2px solid ${PRIMARY_COLORS.main};
    outline-offset: 2px;
  }

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 8px ${getColorWithOpacity(NEUTRAL_COLORS.gray400, 0.3)};
  }

  @media (max-width: 768px) {
    width: 100%;
    margin: 8px 0;
  }
`;

const RoomNumber = styled.h3`
  font-size: 1.25rem;
  color: ${PRIMARY_COLORS.main};
  margin: 0 0 8px 0;
`;

const StatusIndicator = styled.div<{ status: RoomStatus }>`
  display: inline-flex;
  align-items: center;
  padding: 4px 8px;
  border-radius: 4px;
  background-color: ${props => getColorWithOpacity(STATUS_COLORS[props.status], 0.1)};
  color: ${props => STATUS_COLORS[props.status]};
  font-size: 0.875rem;
  font-weight: 500;
  margin-bottom: 12px;
`;

const AmenitiesContainer = styled.div`
  display: flex;
  gap: 8px;
  margin-top: 12px;
`;

const AmenityIcon = styled.div`
  color: ${NEUTRAL_COLORS.gray500};
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;

  &:hover {
    color: ${PRIMARY_COLORS.main};
  }
`;

const ActionButtons = styled.div`
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  gap: 8px;
`;

const RoomCard: React.FC<RoomCardProps> = memo(({
  room,
  onSelect,
  onStatusChange,
  onEdit,
  isSelected = false,
  showDetails = false,
  isLoading = false,
  error = null,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);

  // Memoized handlers
  const handleSelect = useCallback(() => {
    onSelect?.(room);
  }, [room, onSelect]);

  const handleEdit = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit?.(room);
  }, [room, onEdit]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleSelect();
    }
  }, [handleSelect]);

  // Effect for announcing status changes
  useEffect(() => {
    if (error) {
      const announcement = `Error updating room ${room.roomNumber}: ${error}`;
      // Using ARIA live region for accessibility
      const liveRegion = document.getElementById('room-status-announcer');
      if (liveRegion) {
        liveRegion.textContent = announcement;
      }
    }
  }, [error, room.roomNumber]);

  // Render amenity icons with tooltips
  const renderAmenityIcon = (amenity: RoomAmenities) => {
    let Icon;
    switch (amenity) {
      case RoomAmenities.WIFI:
        Icon = WifiIcon;
        break;
      case RoomAmenities.TV:
        Icon = TvIcon;
        break;
      // Add more cases for other amenities
      default:
        return null;
    }

    return (
      <AmenityIcon
        key={amenity}
        role="img"
        aria-label={amenity.toLowerCase().replace('_', ' ')}
        title={amenity.toLowerCase().replace('_', ' ')}
      >
        <Icon />
      </AmenityIcon>
    );
  };

  return (
    <StyledCard
      ref={cardRef}
      role="button"
      tabIndex={0}
      onClick={handleSelect}
      onKeyPress={handleKeyPress}
      isSelected={isSelected}
      isLoading={isLoading}
      hasError={!!error}
      statusColor={STATUS_COLORS[room.status]}
      aria-selected={isSelected}
      aria-busy={isLoading}
      aria-invalid={!!error}
    >
      <RoomNumber>Room {room.roomNumber}</RoomNumber>
      
      <StatusIndicator 
        status={room.status}
        role="status"
        aria-label={`Room status: ${room.status.toLowerCase()}`}
      >
        {room.status}
      </StatusIndicator>

      <div>
        <strong>Type:</strong> {room.type}
        <br />
        <strong>Rate:</strong> ${room.baseRate}/night
      </div>

      <AmenitiesContainer aria-label="Room amenities">
        {room.amenities.map(renderAmenityIcon)}
      </AmenitiesContainer>

      <ActionButtons>
        {onEdit && (
          <button
            onClick={handleEdit}
            aria-label="Edit room"
            title="Edit room"
          >
            <EditIcon />
          </button>
        )}
        <button
          aria-label="More options"
          title="More options"
        >
          <MoreVertIcon />
        </button>
      </ActionButtons>

      {/* Hidden live region for status announcements */}
      <div
        id="room-status-announcer"
        role="alert"
        aria-live="polite"
        className="sr-only"
      />
    </StyledCard>
  );
});

RoomCard.displayName = 'RoomCard';

export default RoomCard;
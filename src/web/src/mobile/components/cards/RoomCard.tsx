/**
 * @file Mobile-optimized room card component
 * @version 1.0.0
 * @description A touch-friendly card component for displaying room information
 * in the hotel management mobile app with WCAG 2.1 AA compliance
 */

import React, { useCallback, useEffect, useMemo } from 'react';
import styled from 'styled-components';
import { 
  BedOutlined, 
  WifiOutlined, 
  CleaningServicesOutlined,
  ErrorOutline,
  CheckCircleOutline 
} from '@material-ui/icons';
import { useIntersectionObserver } from 'react-intersection-observer';
import { useHapticFeedback } from 'react-native-haptic-feedback';

import { 
  Room, 
  RoomStatus, 
  RoomType, 
  RoomAmenities 
} from '../../../shared/interfaces/room.interface';
import { 
  PRIMARY_COLORS, 
  SECONDARY_COLORS, 
  SEMANTIC_COLORS, 
  NEUTRAL_COLORS,
  getColorWithOpacity 
} from '../../../shared/styles/colors';

// Props interface for the mobile room card component
interface MobileRoomCardProps {
  room: Room;
  onPress?: (room: Room) => void;
  onLongPress?: (room: Room) => void;
  isSelected?: boolean;
  showPrice?: boolean;
  isOffline?: boolean;
  animationEnabled?: boolean;
}

// Styled container component with mobile-optimized touch interactions
const StyledMobileCard = styled.div<{
  isSelected?: boolean;
  isOffline?: boolean;
  animationEnabled?: boolean;
}>`
  position: relative;
  padding: 16px;
  margin: 8px;
  border-radius: 12px;
  background-color: ${({ isOffline }) => 
    isOffline ? getColorWithOpacity(NEUTRAL_COLORS.gray100, 0.9) : NEUTRAL_COLORS.white};
  box-shadow: 0 2px 4px ${({ isOffline }) => 
    getColorWithOpacity(NEUTRAL_COLORS.gray400, isOffline ? 0.1 : 0.2)};
  transform: scale(${({ isSelected }) => isSelected ? 0.98 : 1});
  transition: ${({ animationEnabled }) => 
    animationEnabled ? 'transform 0.2s ease-out, box-shadow 0.2s ease-out' : 'none'};
  touch-action: manipulation;
  user-select: none;
  -webkit-tap-highlight-color: transparent;

  &:active {
    transform: ${({ animationEnabled }) => 
      animationEnabled ? 'scale(0.97)' : 'none'};
  }
`;

const RoomNumber = styled.h2`
  font-size: 20px;
  font-weight: 600;
  color: ${PRIMARY_COLORS.main};
  margin: 0 0 8px 0;
`;

const RoomType = styled.span`
  font-size: 14px;
  color: ${SECONDARY_COLORS.main};
  margin-bottom: 8px;
  display: block;
`;

const StatusIndicator = styled.div<{ color: string }>`
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
  color: ${props => props.color};
  margin-bottom: 8px;
`;

const PriceContainer = styled.div<{ isAnimated: boolean }>`
  font-size: 16px;
  font-weight: 600;
  color: ${PRIMARY_COLORS.main};
  transition: ${props => props.isAnimated ? 'color 0.3s ease-out' : 'none'};
`;

const AmenitiesContainer = styled.div`
  display: flex;
  gap: 8px;
  margin-top: 8px;
`;

/**
 * Get appropriate color for room status with accessibility considerations
 */
const getStatusColor = (status: RoomStatus, isOffline: boolean = false): string => {
  if (isOffline) {
    return NEUTRAL_COLORS.gray500;
  }

  switch (status) {
    case RoomStatus.AVAILABLE:
      return SEMANTIC_COLORS.success;
    case RoomStatus.OCCUPIED:
      return SEMANTIC_COLORS.info;
    case RoomStatus.CLEANING:
      return SEMANTIC_COLORS.warning;
    case RoomStatus.MAINTENANCE:
    case RoomStatus.OUT_OF_ORDER:
      return SEMANTIC_COLORS.error;
    default:
      return NEUTRAL_COLORS.gray500;
  }
};

/**
 * Mobile-optimized room card component with enhanced touch interactions
 * and accessibility features
 */
export const MobileRoomCard: React.FC<MobileRoomCardProps> = ({
  room,
  onPress,
  onLongPress,
  isSelected = false,
  showPrice = true,
  isOffline = false,
  animationEnabled = true
}) => {
  // Intersection observer for optimized rendering
  const { ref, inView } = useIntersectionObserver({
    threshold: 0.1,
    triggerOnce: true
  });

  // Haptic feedback for touch interactions
  const { trigger } = useHapticFeedback();

  // Memoized status color
  const statusColor = useMemo(() => 
    getStatusColor(room.status, isOffline), 
    [room.status, isOffline]
  );

  // Handle touch interactions
  const handlePress = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    if (onPress && !isOffline) {
      trigger('impactLight');
      onPress(room);
    }
  }, [onPress, room, isOffline, trigger]);

  const handleLongPress = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    if (onLongPress && !isOffline) {
      trigger('impactMedium');
      onLongPress(room);
    }
  }, [onLongPress, room, isOffline, trigger]);

  // Status icon based on room status
  const StatusIcon = useMemo(() => {
    switch (room.status) {
      case RoomStatus.AVAILABLE:
        return CheckCircleOutline;
      case RoomStatus.CLEANING:
        return CleaningServicesOutlined;
      case RoomStatus.MAINTENANCE:
      case RoomStatus.OUT_OF_ORDER:
        return ErrorOutline;
      default:
        return BedOutlined;
    }
  }, [room.status]);

  return (
    <StyledMobileCard
      ref={ref}
      isSelected={isSelected}
      isOffline={isOffline}
      animationEnabled={animationEnabled}
      onTouchStart={handlePress}
      onTouchEnd={handleLongPress}
      role="button"
      aria-label={`Room ${room.roomNumber} - ${room.type} - ${room.status}`}
      aria-disabled={isOffline}
    >
      {inView && (
        <>
          <RoomNumber>{room.roomNumber}</RoomNumber>
          <RoomType>{room.type}</RoomType>
          
          <StatusIndicator color={statusColor}>
            <StatusIcon fontSize="small" />
            {room.status}
          </StatusIndicator>

          {showPrice && (
            <PriceContainer isAnimated={animationEnabled}>
              ${room.currentRate}/night
            </PriceContainer>
          )}

          <AmenitiesContainer>
            {room.amenities.includes(RoomAmenities.WIFI) && (
              <WifiOutlined 
                fontSize="small" 
                color={isOffline ? "disabled" : "action"}
              />
            )}
          </AmenitiesContainer>
        </>
      )}
    </StyledMobileCard>
  );
};

export default MobileRoomCard;
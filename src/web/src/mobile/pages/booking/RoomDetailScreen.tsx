/**
 * @file RoomDetailScreen.tsx
 * @description Mobile-optimized room detail screen with accessibility support
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { DatePicker } from '@material-ui/pickers'; // v4.0.0
import { useIntersectionObserver } from 'react-intersection-observer'; // v8.32.0
import { ErrorBoundary } from 'react-error-boundary'; // v3.1.4

import {
  Room,
  RoomStatus,
  RoomType,
  RoomAmenities
} from '../../../shared/interfaces/room.interface';
import {
  getRoomById,
  checkRoomAvailability,
  subscribeToRoomUpdates,
  unsubscribeFromRoomUpdates
} from '../../../shared/api/room.api';

// Styled Components
const StyledContainer = styled.div`
  padding: 16px;
  background-color: ${({ theme }) => theme.colors.background};
  min-height: 100vh;
  overflow-x: hidden;
  
  @media (max-width: 576px) {
    padding: 8px;
  }
`;

const ImageGallery = styled.div`
  display: flex;
  gap: 8px;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
  
  img {
    width: 100%;
    height: 250px;
    object-fit: cover;
    scroll-snap-align: start;
    border-radius: 8px;
  }
`;

const RoomInfo = styled.div`
  margin-top: 24px;
  
  h1 {
    font-size: 24px;
    margin-bottom: 16px;
  }
`;

const AmenitiesList = styled.ul`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px;
  margin: 16px 0;
  padding: 0;
  list-style: none;
`;

const BookingSection = styled.div`
  position: sticky;
  bottom: 0;
  background: ${({ theme }) => theme.colors.white};
  padding: 16px;
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.1);
  border-radius: 16px 16px 0 0;
`;

// Props Interface
interface RoomDetailScreenProps {
  onBookRoom: (roomId: string, startDate: Date, endDate: Date) => Promise<void>;
  onError: (error: Error) => void;
}

// Custom hook for room availability
const useRoomAvailability = (roomId: string, startDate: Date, endDate: Date) => {
  const [isAvailable, setIsAvailable] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    let mounted = true;
    const checkAvailability = async () => {
      try {
        setIsLoading(true);
        const availableRooms = await checkRoomAvailability(startDate, endDate);
        if (mounted) {
          setIsAvailable(availableRooms.some(room => room.id === roomId));
        }
      } catch (error) {
        console.error('Availability check failed:', error);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    if (roomId && startDate && endDate) {
      checkAvailability();
    }

    return () => {
      mounted = false;
    };
  }, [roomId, startDate, endDate]);

  return { isAvailable, isLoading };
};

// Error Fallback Component
const ErrorFallback: React.FC<{ error: Error; resetErrorBoundary: () => void }> = ({
  error,
  resetErrorBoundary
}) => (
  <div role="alert">
    <h2>Something went wrong:</h2>
    <pre>{error.message}</pre>
    <button onClick={resetErrorBoundary}>Try again</button>
  </div>
);

// Main Component
export const RoomDetailScreen: React.FC<RoomDetailScreenProps> = ({
  onBookRoom,
  onError
}) => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const [room, setRoom] = useState<Room | null>(null);
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(new Date(Date.now() + 86400000));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const { isAvailable, isLoading: availabilityLoading } = useRoomAvailability(
    roomId!,
    startDate,
    endDate
  );

  // Intersection Observer for lazy loading images
  const { ref, inView } = useIntersectionObserver({
    threshold: 0.1,
    triggerOnce: true
  });

  // Fetch room details
  useEffect(() => {
    let mounted = true;

    const fetchRoomDetails = async () => {
      try {
        setIsLoading(true);
        const roomData = await getRoomById(roomId!);
        if (mounted) {
          setRoom(roomData);
        }
      } catch (error) {
        onError(error as Error);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    if (roomId) {
      fetchRoomDetails();
    }

    return () => {
      mounted = false;
    };
  }, [roomId, onError]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (roomId) {
      subscribeToRoomUpdates(roomId, (updatedRoom) => {
        setRoom(updatedRoom);
      });
    }

    return () => {
      if (roomId) {
        unsubscribeFromRoomUpdates(roomId);
      }
    };
  }, [roomId]);

  // Handle booking
  const handleBookRoom = useCallback(async () => {
    if (!room || !isAvailable) return;

    try {
      await onBookRoom(room.id, startDate, endDate);
      navigate('/booking/confirmation');
    } catch (error) {
      onError(error as Error);
    }
  }, [room, isAvailable, startDate, endDate, onBookRoom, navigate, onError]);

  if (isLoading) {
    return (
      <StyledContainer>
        <div role="status" aria-live="polite">Loading room details...</div>
      </StyledContainer>
    );
  }

  if (!room) {
    return (
      <StyledContainer>
        <div role="alert">Room not found</div>
      </StyledContainer>
    );
  }

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback} onReset={() => navigate('/')}>
      <StyledContainer>
        <ImageGallery ref={ref} role="region" aria-label="Room images">
          {room.images.map((image, index) => (
            <img
              key={index}
              src={inView ? image : ''}
              alt={`Room ${room.roomNumber} view ${index + 1}`}
              loading="lazy"
            />
          ))}
        </ImageGallery>

        <RoomInfo>
          <h1>{`${RoomType[room.type]} Room ${room.roomNumber}`}</h1>
          <p>{room.description}</p>

          <AmenitiesList aria-label="Room amenities">
            {room.amenities.map((amenity) => (
              <li key={amenity} aria-label={RoomAmenities[amenity]}>
                {RoomAmenities[amenity]}
              </li>
            ))}
          </AmenitiesList>
        </RoomInfo>

        <BookingSection>
          <div aria-live="polite">
            <p>Rate: ${room.currentRate}/night</p>
            {availabilityLoading ? (
              <p>Checking availability...</p>
            ) : (
              <p>{isAvailable ? 'Available' : 'Not available for selected dates'}</p>
            )}
          </div>

          <DatePicker
            label="Check-in"
            value={startDate}
            onChange={(date) => setStartDate(date || new Date())}
            disablePast
            aria-label="Select check-in date"
          />

          <DatePicker
            label="Check-out"
            value={endDate}
            onChange={(date) => setEndDate(date || new Date())}
            minDate={startDate}
            aria-label="Select check-out date"
          />

          <button
            onClick={handleBookRoom}
            disabled={!isAvailable || availabilityLoading}
            aria-busy={availabilityLoading}
          >
            Book Now
          </button>
        </BookingSection>
      </StyledContainer>
    </ErrorBoundary>
  );
};

export default RoomDetailScreen;
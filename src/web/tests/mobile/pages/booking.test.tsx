/**
 * @fileoverview Comprehensive test suite for mobile booking screens
 * @description Tests room listing, detail viewing, and booking confirmation flows
 * with emphasis on real-time updates, offline capabilities, and accessibility
 * @version 1.0.0
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { jest, expect, beforeEach, afterEach } from '@jest/globals';

// Components under test
import RoomListScreen from '../../src/mobile/pages/booking/RoomListScreen';
import RoomDetailScreen from '../../src/mobile/pages/booking/RoomDetailScreen';
import BookingConfirmScreen from '../../src/mobile/pages/booking/BookingConfirmScreen';

// Types and interfaces
import { 
  Room, 
  RoomStatus, 
  RoomType, 
  RoomAmenities 
} from '../../src/shared/interfaces/room.interface';

// Mock data
const mockRoom: Room = {
  id: '123',
  roomNumber: '101',
  type: RoomType.DELUXE,
  status: RoomStatus.AVAILABLE,
  floor: 1,
  baseRate: 200,
  currentRate: 220,
  amenities: [RoomAmenities.WIFI, RoomAmenities.TV],
  maxOccupancy: 2,
  isAccessible: false,
  description: 'Luxurious deluxe room with city view',
  images: ['room1.jpg', 'room2.jpg'],
  lastModified: new Date(),
  channelRestrictions: [],
  pricingStrategy: {
    strategyType: 'dynamic',
    adjustmentFactors: [],
    minimumRate: 180,
    maximumRate: 300
  }
};

// Mock WebSocket
const mockWebSocket = {
  onmessage: jest.fn(),
  send: jest.fn(),
  close: jest.fn()
};

// Mock store
const mockStore = configureStore({
  reducer: {
    rooms: (state = { rooms: [mockRoom] }) => state,
    reservations: (state = {}) => state
  }
});

describe('RoomListScreen', () => {
  beforeEach(() => {
    // Mock WebSocket
    global.WebSocket = jest.fn().mockImplementation(() => mockWebSocket);
    
    // Mock IntersectionObserver
    global.IntersectionObserver = jest.fn().mockImplementation(() => ({
      observe: jest.fn(),
      unobserve: jest.fn(),
      disconnect: jest.fn()
    }));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders room list with correct accessibility attributes', () => {
    render(
      <Provider store={mockStore}>
        <MemoryRouter>
          <RoomListScreen />
        </MemoryRouter>
      </Provider>
    );

    expect(screen.getByRole('main')).toHaveAttribute('aria-label', 'Room list');
    expect(screen.getByRole('search')).toHaveAttribute('aria-label', 'Room filters');
  });

  it('handles real-time room updates via WebSocket', async () => {
    render(
      <Provider store={mockStore}>
        <MemoryRouter>
          <RoomListScreen />
        </MemoryRouter>
      </Provider>
    );

    const updatedRoom = { ...mockRoom, status: RoomStatus.OCCUPIED };
    mockWebSocket.onmessage({ data: JSON.stringify(updatedRoom) });

    await waitFor(() => {
      const roomElement = screen.getByText(updatedRoom.roomNumber);
      expect(roomElement).toBeInTheDocument();
      expect(screen.getByText('OCCUPIED')).toBeInTheDocument();
    });
  });

  it('supports offline mode with data persistence', async () => {
    // Mock offline status
    Object.defineProperty(navigator, 'onLine', { value: false });
    
    render(
      <Provider store={mockStore}>
        <MemoryRouter>
          <RoomListScreen />
        </MemoryRouter>
      </Provider>
    );

    // Verify offline indicator
    expect(screen.getByText(/offline mode/i)).toBeInTheDocument();
    
    // Verify cached data is displayed
    expect(screen.getByText(mockRoom.roomNumber)).toBeInTheDocument();
  });
});

describe('RoomDetailScreen', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('displays dynamic pricing updates in real-time', async () => {
    render(
      <Provider store={mockStore}>
        <MemoryRouter initialEntries={[`/booking/room/${mockRoom.id}`]}>
          <Routes>
            <Route path="/booking/room/:roomId" element={<RoomDetailScreen />} />
          </Routes>
        </MemoryRouter>
      </Provider>
    );

    // Initial price
    expect(screen.getByText(`$${mockRoom.currentRate}/night`)).toBeInTheDocument();

    // Simulate price update
    mockWebSocket.onmessage({
      data: JSON.stringify({ ...mockRoom, currentRate: 250 })
    });

    await waitFor(() => {
      expect(screen.getByText('$250/night')).toBeInTheDocument();
    });
  });

  it('validates date selection and availability', async () => {
    const user = userEvent.setup();
    
    render(
      <Provider store={mockStore}>
        <MemoryRouter initialEntries={[`/booking/room/${mockRoom.id}`]}>
          <Routes>
            <Route path="/booking/room/:roomId" element={<RoomDetailScreen />} />
          </Routes>
        </MemoryRouter>
      </Provider>
    );

    // Select dates
    const checkInPicker = screen.getByLabelText(/check-in/i);
    const checkOutPicker = screen.getByLabelText(/check-out/i);

    await user.click(checkInPicker);
    await user.click(screen.getByText('15')); // Select 15th of current month

    await user.click(checkOutPicker);
    await user.click(screen.getByText('20')); // Select 20th of current month

    // Verify availability check
    expect(screen.getByText(/checking availability/i)).toBeInTheDocument();
  });
});

describe('BookingConfirmScreen', () => {
  const mockBookingData = {
    guestId: '456',
    roomNumber: mockRoom.roomNumber,
    checkInDate: new Date(),
    checkOutDate: new Date(Date.now() + 86400000),
    numberOfGuests: 2,
    totalAmount: mockRoom.currentRate,
    status: 'PENDING',
    specialRequests: ['Late check-in']
  };

  it('handles offline booking queue', async () => {
    // Mock offline status
    Object.defineProperty(navigator, 'onLine', { value: false });
    
    render(
      <Provider store={mockStore}>
        <MemoryRouter>
          <BookingConfirmScreen bookingData={mockBookingData} />
        </MemoryRouter>
      </Provider>
    );

    const confirmButton = screen.getByText(/confirm booking/i);
    await userEvent.click(confirmButton);

    // Verify offline queue message
    expect(screen.getByText(/booking will be processed when online/i)).toBeInTheDocument();
  });

  it('implements retry mechanism for failed bookings', async () => {
    render(
      <Provider store={mockStore}>
        <MemoryRouter>
          <BookingConfirmScreen bookingData={mockBookingData} isRetry={true} />
        </MemoryRouter>
      </Provider>
    );

    // Simulate failed booking
    const error = new Error('Booking failed');
    mockWebSocket.onmessage({ data: JSON.stringify({ error }) });

    // Verify retry UI
    expect(screen.getByText(/retrying/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('validates all required booking fields', async () => {
    const invalidBookingData = {
      ...mockBookingData,
      guestId: '', // Invalid: missing guest ID
      numberOfGuests: 0 // Invalid: zero guests
    };

    render(
      <Provider store={mockStore}>
        <MemoryRouter>
          <BookingConfirmScreen bookingData={invalidBookingData} />
        </MemoryRouter>
      </Provider>
    );

    const confirmButton = screen.getByText(/confirm booking/i);
    await userEvent.click(confirmButton);

    // Verify validation errors
    expect(screen.getByText(/guest information is required/i)).toBeInTheDocument();
    expect(screen.getByText(/at least one guest is required/i)).toBeInTheDocument();
  });
});
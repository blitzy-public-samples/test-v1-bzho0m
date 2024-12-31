/**
 * @fileoverview Comprehensive test suite for reservation management pages
 * covering real-time updates, offline capabilities, accessibility compliance,
 * and complex user workflows.
 * @version 1.0.0
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { vi } from 'vitest';
import { QueryClient, QueryClientProvider } from 'react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { axe, toHaveNoViolations } from 'jest-axe';
import { setupServer } from 'msw/node';
import { rest } from 'msw';

// Internal imports
import ReservationListPage from '../../src/web/pages/reservations/ReservationListPage';
import ReservationDetailPage from '../../src/web/pages/reservations/ReservationDetailPage';
import { reservationApi } from '../../src/shared/api/reservation.api';
import { ReservationStatus, PaymentStatus } from '../../src/shared/interfaces/reservation.interface';
import { WebSocketEvents, WebSocketNamespaces } from '@/websocket-service/config';

// Mock data
const mockReservation = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  guestId: '123e4567-e89b-12d3-a456-426614174001',
  roomNumber: '101',
  checkInDate: new Date('2024-02-01'),
  checkOutDate: new Date('2024-02-05'),
  status: ReservationStatus.CONFIRMED,
  numberOfGuests: 2,
  totalAmount: 1000,
  paymentStatus: PaymentStatus.AUTHORIZED,
  specialRequests: ['Late check-in'],
  createdAt: new Date(),
  updatedAt: new Date(),
  cancelledAt: null,
  cancellationReason: null
};

// Mock WebSocket
class MockWebSocket {
  private listeners: Map<string, Function[]> = new Map();
  public readyState = WebSocket.OPEN;

  addEventListener(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)?.push(callback);
  }

  removeEventListener(event: string, callback: Function) {
    const listeners = this.listeners.get(event) || [];
    const index = listeners.indexOf(callback);
    if (index > -1) {
      listeners.splice(index, 1);
    }
  }

  emit(event: string, data: any) {
    const listeners = this.listeners.get(event) || [];
    listeners.forEach(callback => callback({ data: JSON.stringify(data) }));
  }

  close() {
    this.readyState = WebSocket.CLOSED;
  }
}

// Setup test environment
const setupTest = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        cacheTime: 0
      }
    }
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Routes>
          <Route path="/" element={component} />
          <Route path="/reservations/:id" element={<ReservationDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

// API mocks
vi.mock('../../src/shared/api/reservation.api', () => ({
  reservationApi: {
    getReservations: vi.fn(),
    getReservationById: vi.fn(),
    updateReservation: vi.fn(),
    cancelReservation: vi.fn(),
    checkInReservation: vi.fn(),
    checkOutReservation: vi.fn(),
    syncOfflineReservations: vi.fn()
  }
}));

describe('ReservationListPage', () => {
  let mockWs: MockWebSocket;

  beforeEach(() => {
    mockWs = new MockWebSocket();
    vi.spyOn(window, 'WebSocket').mockImplementation(() => mockWs as any);
    vi.spyOn(reservationApi, 'getReservations').mockResolvedValue([mockReservation]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders reservation list with real-time updates', async () => {
    setupTest(<ReservationListPage />);

    // Initial render
    await waitFor(() => {
      expect(screen.getByText(mockReservation.roomNumber)).toBeInTheDocument();
    });

    // Simulate real-time update
    const updatedReservation = { ...mockReservation, status: ReservationStatus.CHECKED_IN };
    mockWs.emit('message', {
      event: WebSocketEvents.RESERVATION_CREATED,
      namespace: WebSocketNamespaces.FRONT_DESK,
      payload: updatedReservation
    });

    await waitFor(() => {
      expect(screen.getByText('CHECKED_IN')).toBeInTheDocument();
    });
  });

  it('handles offline operations correctly', async () => {
    // Simulate offline mode
    const originalOnline = window.navigator.onLine;
    Object.defineProperty(window.navigator, 'onLine', { value: false, writable: true });

    setupTest(<ReservationListPage />);

    // Attempt to update reservation while offline
    fireEvent.click(screen.getByText('Update Status'));

    // Verify offline queue
    await waitFor(() => {
      expect(screen.getByText('Changes will sync when online')).toBeInTheDocument();
    });

    // Restore online status and verify sync
    Object.defineProperty(window.navigator, 'onLine', { value: true, writable: true });
    window.dispatchEvent(new Event('online'));

    await waitFor(() => {
      expect(reservationApi.syncOfflineReservations).toHaveBeenCalled();
    });

    // Cleanup
    Object.defineProperty(window.navigator, 'onLine', { value: originalOnline });
  });

  it('meets accessibility requirements', async () => {
    const { container } = setupTest(<ReservationListPage />);

    await waitFor(() => {
      expect(screen.getByText(mockReservation.roomNumber)).toBeInTheDocument();
    });

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe('ReservationDetailPage', () => {
  beforeEach(() => {
    vi.spyOn(reservationApi, 'getReservationById').mockResolvedValue(mockReservation);
  });

  it('validates form submissions correctly', async () => {
    setupTest(<ReservationDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Reservation Details')).toBeInTheDocument();
    });

    // Test invalid date range
    const checkInDate = screen.getByLabelText('Check-in Date');
    const checkOutDate = screen.getByLabelText('Check-out Date');

    fireEvent.change(checkInDate, { target: { value: '2024-02-05' } });
    fireEvent.change(checkOutDate, { target: { value: '2024-02-01' } });

    fireEvent.click(screen.getByText('Update Reservation'));

    await waitFor(() => {
      expect(screen.getByText('Check-out date must be after check-in date')).toBeInTheDocument();
    });
  });

  it('handles complex workflows correctly', async () => {
    setupTest(<ReservationDetailPage />);

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('Reservation Details')).toBeInTheDocument();
    });

    // Test check-in flow
    vi.spyOn(reservationApi, 'checkInReservation').mockResolvedValue({
      ...mockReservation,
      status: ReservationStatus.CHECKED_IN
    });

    fireEvent.click(screen.getByText('Check In'));

    await waitFor(() => {
      expect(screen.getByText('CHECKED_IN')).toBeInTheDocument();
    });

    // Test cancellation flow
    vi.spyOn(reservationApi, 'cancelReservation').mockResolvedValue({
      ...mockReservation,
      status: ReservationStatus.CANCELLED
    });

    fireEvent.click(screen.getByText('Cancel Reservation'));

    // Verify confirmation dialog
    await waitFor(() => {
      expect(screen.getByText('Are you sure you want to cancel this reservation?')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Confirm'));

    await waitFor(() => {
      expect(screen.getByText('CANCELLED')).toBeInTheDocument();
    });
  });

  it('handles real-time rate updates correctly', async () => {
    setupTest(<ReservationDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Reservation Details')).toBeInTheDocument();
    });

    // Simulate rate update via WebSocket
    mockWs.emit('message', {
      event: WebSocketEvents.BILLING_UPDATE,
      namespace: WebSocketNamespaces.BILLING,
      payload: {
        reservationId: mockReservation.id,
        newRate: 1200
      }
    });

    await waitFor(() => {
      expect(screen.getByText('$1,200.00')).toBeInTheDocument();
    });
  });
});
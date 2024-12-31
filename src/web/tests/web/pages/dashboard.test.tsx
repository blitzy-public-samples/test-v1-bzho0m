// @package-version react@18.0.0
// @package-version @testing-library/react@13.0.0
// @package-version @testing-library/user-event@14.0.0
// @package-version @jest/globals@29.0.0
// @package-version react-redux@8.1.0
// @package-version react-use-websocket@4.3.1

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { act } from 'react-dom/test-utils';
import { DashboardPage } from '../../pages/Dashboard';

// Mock WebSocket
jest.mock('react-use-websocket', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    sendMessage: jest.fn(),
    lastMessage: null,
    readyState: WebSocket.OPEN,
  })),
}));

// Mock ResizeObserver for responsive testing
const mockResizeObserver = jest.fn(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));
window.ResizeObserver = mockResizeObserver;

// Initial mock state
const initialState = {
  rooms: {
    occupancy: {
      total: 100,
      occupied: 75,
      percentage: 75,
    },
    list: [
      { id: '101', status: 'OCC', type: 'standard' },
      { id: '102', status: 'VAC', type: 'deluxe' },
      { id: '103', status: 'MAINT', type: 'suite' },
      { id: '104', status: 'VAC', type: 'standard' },
    ],
  },
  revenue: {
    daily: 12450,
    trend: 15,
    currency: 'USD',
  },
  arrivals: {
    today: 12,
    pending: 5,
  },
  loading: false,
  error: null,
};

// Test setup helper
const setupTest = (customState = {}) => {
  const store = configureStore({
    reducer: {
      dashboard: (state = { ...initialState, ...customState }) => state,
    },
  });

  const user = userEvent.setup();

  const renderComponent = () =>
    render(
      <Provider store={store}>
        <DashboardPage />
      </Provider>
    );

  return {
    store,
    user,
    renderComponent,
  };
};

describe('DashboardPage Component Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders dashboard layout with all widgets correctly', async () => {
    const { renderComponent } = setupTest();
    renderComponent();

    // Verify Occupancy Widget
    const occupancyWidget = screen.getByTestId('occupancy-widget');
    expect(occupancyWidget).toBeInTheDocument();
    expect(within(occupancyWidget).getByText('75%')).toBeInTheDocument();
    expect(within(occupancyWidget).getByText('75/100 Rooms')).toBeInTheDocument();

    // Verify Arrivals Widget
    const arrivalsWidget = screen.getByTestId('arrivals-widget');
    expect(arrivalsWidget).toBeInTheDocument();
    expect(within(arrivalsWidget).getByText('Today: 12')).toBeInTheDocument();
    expect(within(arrivalsWidget).getByText('Pending: 5')).toBeInTheDocument();

    // Verify Revenue Widget
    const revenueWidget = screen.getByTestId('revenue-widget');
    expect(revenueWidget).toBeInTheDocument();
    expect(within(revenueWidget).getByText('$12,450')).toBeInTheDocument();
    expect(within(revenueWidget).getByText('+15%')).toBeInTheDocument();

    // Verify Room Grid
    const roomGrid = screen.getByTestId('room-grid');
    expect(roomGrid).toBeInTheDocument();
    expect(screen.getAllByTestId('room-cell')).toHaveLength(4);
  });

  test('handles real-time WebSocket updates correctly', async () => {
    const { renderComponent } = setupTest();
    renderComponent();

    // Simulate WebSocket room status update
    const mockWebSocketMessage = {
      type: 'room.status.update',
      data: {
        roomId: '102',
        newStatus: 'OCC',
      },
    };

    act(() => {
      const useWebSocket = require('react-use-websocket').default;
      useWebSocket.mockImplementation(() => ({
        sendMessage: jest.fn(),
        lastMessage: {
          data: JSON.stringify(mockWebSocketMessage),
        },
        readyState: WebSocket.OPEN,
      }));
    });

    // Verify room status update reflection
    await waitFor(() => {
      const updatedRoom = screen.getByTestId('room-102');
      expect(within(updatedRoom).getByText('OCC')).toBeInTheDocument();
    });
  });

  test('adapts layout responsively based on screen size', async () => {
    const { renderComponent } = setupTest();
    renderComponent();

    // Test mobile layout
    act(() => {
      window.innerWidth = 375;
      window.dispatchEvent(new Event('resize'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-container')).toHaveClass('mobile-layout');
    });

    // Test tablet layout
    act(() => {
      window.innerWidth = 768;
      window.dispatchEvent(new Event('resize'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-container')).toHaveClass('tablet-layout');
    });

    // Test desktop layout
    act(() => {
      window.innerWidth = 1200;
      window.dispatchEvent(new Event('resize'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-container')).toHaveClass('desktop-layout');
    });
  });

  test('handles quick actions menu interactions', async () => {
    const { renderComponent, user } = setupTest();
    renderComponent();

    const quickActionsButton = screen.getByTestId('quick-actions-button');
    await user.click(quickActionsButton);

    // Verify quick actions menu items
    const quickActionsMenu = screen.getByTestId('quick-actions-menu');
    expect(quickActionsMenu).toBeInTheDocument();
    expect(screen.getByText('New Booking')).toBeInTheDocument();
    expect(screen.getByText('Payments')).toBeInTheDocument();
    expect(screen.getByText('Reports')).toBeInTheDocument();
  });

  test('handles error states appropriately', async () => {
    const { renderComponent } = setupTest({
      error: 'Failed to fetch dashboard data',
    });
    renderComponent();

    const errorAlert = screen.getByRole('alert');
    expect(errorAlert).toBeInTheDocument();
    expect(errorAlert).toHaveTextContent('Failed to fetch dashboard data');
  });

  test('maintains accessibility standards', async () => {
    const { renderComponent } = setupTest();
    renderComponent();

    // Check ARIA labels and roles
    expect(screen.getByRole('main')).toHaveAttribute('aria-label', 'Dashboard');
    expect(screen.getByRole('navigation')).toBeInTheDocument();
    
    // Verify keyboard navigation
    const quickActionsButton = screen.getByTestId('quick-actions-button');
    quickActionsButton.focus();
    fireEvent.keyDown(quickActionsButton, { key: 'Enter' });
    
    await waitFor(() => {
      const menu = screen.getByTestId('quick-actions-menu');
      expect(menu).toHaveAttribute('role', 'menu');
    });
  });

  test('handles loading states correctly', async () => {
    const { renderComponent } = setupTest({
      loading: true,
    });
    renderComponent();

    // Verify loading indicators
    expect(screen.getByTestId('occupancy-widget-skeleton')).toBeInTheDocument();
    expect(screen.getByTestId('revenue-widget-skeleton')).toBeInTheDocument();
    expect(screen.getByTestId('room-grid-skeleton')).toBeInTheDocument();

    // Verify loading state removal
    act(() => {
      setupTest({ loading: false }).renderComponent();
    });

    await waitFor(() => {
      expect(screen.queryByTestId('occupancy-widget-skeleton')).not.toBeInTheDocument();
    });
  });
});
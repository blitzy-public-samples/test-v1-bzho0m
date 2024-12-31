import React from 'react';
import { render, fireEvent, waitFor, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { axe, toHaveNoViolations } from 'jest-axe';
import { configureStore } from '@reduxjs/toolkit';
import { ServiceRequestScreen } from '../../src/mobile/pages/service/ServiceRequestScreen';
import { ServiceHistoryScreen } from '../../src/mobile/pages/service/ServiceHistoryScreen';
import { WebSocketEvents, WebSocketNamespaces } from '@/websocket-service/config';

// Add jest-axe matchers
expect.extend(toHaveNoViolations);

// Mock WebSocket functionality
jest.mock('../../../shared/hooks/useWebSocket', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    isConnected: true,
    sendMessage: jest.fn(),
    subscribe: jest.fn(),
  })),
}));

// Mock Redux store
const mockStore = configureStore({
  reducer: {
    room: (state = { selectedRoom: { id: 'room-123' } }) => state,
  },
});

// Test IDs for component selection
const testIds = {
  serviceForm: 'service-request-form',
  typeSelect: 'service-type-select',
  descriptionInput: 'description-input',
  prioritySelect: 'priority-select',
  submitButton: 'submit-button',
  cancelButton: 'cancel-button',
  historyList: 'service-history-list',
  statusBanner: 'status-banner',
};

// Mock service requests for history testing
const mockServiceRequests = [
  {
    id: 'service-1',
    type: 'HOUSEKEEPING',
    description: 'Room cleaning needed',
    status: 'pending',
    createdAt: new Date(),
    urgency: 'medium',
  },
  {
    id: 'service-2',
    type: 'MAINTENANCE',
    description: 'AC not working',
    status: 'inProgress',
    createdAt: new Date(),
    urgency: 'high',
  },
];

describe('ServiceRequestScreen', () => {
  const setupServiceRequest = (customProps = {}) => {
    return render(
      <Provider store={mockStore}>
        <MemoryRouter>
          <ServiceRequestScreen {...customProps} />
        </MemoryRouter>
      </Provider>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders service request form with all required fields', () => {
    setupServiceRequest();

    expect(screen.getByRole('form')).toBeInTheDocument();
    expect(screen.getByLabelText(/service type/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/priority/i)).toBeInTheDocument();
  });

  test('validates required fields before submission', async () => {
    setupServiceRequest();
    const submitButton = screen.getByRole('button', { name: /submit/i });

    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/description is required/i)).toBeInTheDocument();
    });
  });

  test('successfully submits service request', async () => {
    const mockSendMessage = jest.fn().mockResolvedValue(true);
    setupServiceRequest({ sendMessage: mockSendMessage });

    await userEvent.selectOptions(
      screen.getByLabelText(/service type/i),
      'HOUSEKEEPING'
    );
    await userEvent.type(
      screen.getByLabelText(/description/i),
      'Need room cleaning'
    );
    await userEvent.selectOptions(
      screen.getByLabelText(/priority/i),
      'MEDIUM'
    );

    fireEvent.click(screen.getByRole('button', { name: /submit/i }));

    await waitFor(() => {
      expect(mockSendMessage).toHaveBeenCalledWith(
        WebSocketEvents.SERVICE_REQUEST,
        expect.objectContaining({
          type: 'HOUSEKEEPING',
          description: 'Need room cleaning',
          priority: 'MEDIUM',
        })
      );
    });
  });

  test('handles offline mode gracefully', async () => {
    setupServiceRequest({ isConnected: false });

    await userEvent.type(
      screen.getByLabelText(/description/i),
      'Offline request'
    );
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));

    await waitFor(() => {
      expect(screen.getByText(/saved offline/i)).toBeInTheDocument();
    });
  });

  test('meets accessibility requirements', async () => {
    const { container } = setupServiceRequest();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe('ServiceHistoryScreen', () => {
  const setupServiceHistory = (customProps = {}) => {
    return render(
      <Provider store={mockStore}>
        <MemoryRouter>
          <ServiceHistoryScreen
            guestId="guest-123"
            {...customProps}
          />
        </MemoryRouter>
      </Provider>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ services: mockServiceRequests }),
    });
  });

  test('renders service history list with correct data', async () => {
    setupServiceHistory();

    await waitFor(() => {
      mockServiceRequests.forEach(request => {
        expect(screen.getByText(request.description)).toBeInTheDocument();
      });
    });
  });

  test('implements infinite scroll correctly', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ services: mockServiceRequests }),
    });
    global.fetch = mockFetch;

    setupServiceHistory();

    // Simulate scroll to bottom
    fireEvent.scroll(window, { target: { scrollY: 1000 } });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  test('displays loading state appropriately', () => {
    setupServiceHistory();
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  test('handles error states correctly', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Failed to fetch'));
    setupServiceHistory();

    await waitFor(() => {
      expect(screen.getByText(/failed to fetch/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });
  });

  test('allows cancellation of pending requests', async () => {
    const mockCancel = jest.fn();
    setupServiceHistory({ onCancel: mockCancel });

    await waitFor(() => {
      const pendingRequest = screen.getByText(/pending/i).closest('article');
      const cancelButton = within(pendingRequest!).getByRole('button', {
        name: /cancel/i,
      });
      fireEvent.click(cancelButton);
      expect(mockCancel).toHaveBeenCalled();
    });
  });

  test('adapts to different screen sizes', async () => {
    // Mock window resize
    global.innerWidth = 400;
    fireEvent(window, new Event('resize'));
    
    setupServiceHistory();

    await waitFor(() => {
      expect(screen.getByRole('list')).toHaveStyle({
        display: 'flex',
        flexDirection: 'column',
      });
    });

    global.innerWidth = 1024;
    fireEvent(window, new Event('resize'));

    await waitFor(() => {
      expect(screen.getByRole('table')).toBeInTheDocument();
    });
  });

  test('meets accessibility requirements', async () => {
    const { container } = setupServiceHistory();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
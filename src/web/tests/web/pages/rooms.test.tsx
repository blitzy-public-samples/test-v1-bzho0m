import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import { axe, toHaveNoViolations } from 'jest-axe';
import MockWebSocket from 'jest-websocket-mock';
import RoomListPage from '../../src/web/pages/rooms/RoomListPage';
import RoomDetailPage from '../../src/web/pages/rooms/RoomDetailPage';
import { fetchRooms, updateRoomWithRetry } from '../../src/shared/store/room.slice';
import { Room, RoomStatus, RoomType } from '../../src/shared/interfaces/room.interface';
import { WebSocketEvents, WebSocketNamespaces } from '@/websocket-service/config';

// Add jest-axe matchers
expect.extend(toHaveNoViolations);

// Mock room data
const mockRooms: Room[] = [
  {
    id: '1',
    roomNumber: '101',
    type: RoomType.STANDARD,
    status: RoomStatus.AVAILABLE,
    floor: 1,
    baseRate: 100,
    currentRate: 100,
    maxOccupancy: 2,
    isAccessible: false,
    amenities: [],
    description: 'Standard Room',
    images: [],
    lastModified: new Date(),
    channelRestrictions: [],
    pricingStrategy: {
      strategyType: 'fixed',
      adjustmentFactors: [],
      minimumRate: 80,
      maximumRate: 120
    }
  },
  // Add more mock rooms...
];

// Mock viewport configurations for responsive testing
const mockViewports = {
  mobile: { width: 375, height: 667 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1280, height: 800 }
};

// Enhanced test setup helper
interface SetupOptions {
  initialState?: any;
  viewport?: typeof mockViewports[keyof typeof mockViewports];
  wsEvents?: { type: WebSocketEvents; payload: any }[];
}

const setupTest = ({
  initialState = {},
  viewport = mockViewports.desktop,
  wsEvents = []
}: SetupOptions = {}) => {
  // Configure mock store
  const store = configureStore({
    reducer: {
      room: (state = { rooms: mockRooms, loading: false }, action) => state
    },
    preloadedState: initialState
  });

  // Setup WebSocket mock
  const ws = new MockWebSocket(
    `ws://localhost:3001/${WebSocketNamespaces.ROOM_MANAGEMENT}`
  );

  // Configure viewport
  Object.defineProperty(window, 'innerWidth', { value: viewport.width });
  Object.defineProperty(window, 'innerHeight', { value: viewport.height });
  window.dispatchEvent(new Event('resize'));

  // Render helper with all required providers
  const renderWithProviders = (component: React.ReactElement) => {
    return render(
      <Provider store={store}>
        <MemoryRouter>
          {component}
        </MemoryRouter>
      </Provider>
    );
  };

  return {
    store,
    ws,
    renderWithProviders,
    viewport
  };
};

describe('RoomListPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    MockWebSocket.clean();
  });

  it('renders room list with grid view by default', async () => {
    const { renderWithProviders } = setupTest();
    renderWithProviders(<RoomListPage />);

    expect(screen.getByRole('heading', { name: /room management/i })).toBeInTheDocument();
    expect(screen.getByRole('grid')).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(mockRooms.length);
  });

  it('handles real-time room status updates via WebSocket', async () => {
    const { renderWithProviders, ws } = setupTest();
    renderWithProviders(<RoomListPage />);

    // Wait for WebSocket connection
    await waitFor(() => expect(ws.connected).toBe(true));

    // Simulate room status update
    const updatedRoom = {
      ...mockRooms[0],
      status: RoomStatus.CLEANING
    };

    ws.send(JSON.stringify({
      event: WebSocketEvents.ROOM_STATUS_UPDATE,
      payload: updatedRoom
    }));

    // Verify UI updates
    await waitFor(() => {
      const roomElement = screen.getByText(updatedRoom.roomNumber);
      expect(within(roomElement.closest('div')!).getByText(/cleaning/i)).toBeInTheDocument();
    });
  });

  it('maintains accessibility compliance across viewport sizes', async () => {
    const viewports = Object.values(mockViewports);
    
    for (const viewport of viewports) {
      const { renderWithProviders } = setupTest({ viewport });
      const { container } = renderWithProviders(<RoomListPage />);

      // Run accessibility tests
      const results = await axe(container);
      expect(results).toHaveNoViolations();

      // Verify responsive layout
      const grid = screen.getByRole('grid');
      const computedStyle = window.getComputedStyle(grid);
      
      if (viewport.width < 576) {
        expect(computedStyle.gridTemplateColumns).toMatch(/1fr/);
      } else {
        expect(computedStyle.gridTemplateColumns).toMatch(/repeat/);
      }
    }
  });

  // Add more tests...
});

describe('RoomDetailPage', () => {
  const mockRoom = mockRooms[0];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    MockWebSocket.clean();
  });

  it('displays room details and maintenance form', async () => {
    const { renderWithProviders } = setupTest({
      initialState: {
        room: {
          rooms: [mockRoom],
          selectedRoom: mockRoom
        }
      }
    });

    renderWithProviders(<RoomDetailPage />);

    expect(screen.getByText(`Room ${mockRoom.roomNumber}`)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /request maintenance/i })).toBeInTheDocument();
  });

  it('handles maintenance request submission', async () => {
    const { renderWithProviders, store } = setupTest({
      initialState: {
        room: {
          rooms: [mockRoom],
          selectedRoom: mockRoom
        }
      }
    });

    renderWithProviders(<RoomDetailPage />);

    // Open maintenance form
    fireEvent.click(screen.getByRole('button', { name: /request maintenance/i }));

    // Fill and submit form
    const issueTypeSelect = screen.getByLabelText(/issue type/i);
    const descriptionInput = screen.getByLabelText(/description/i);

    fireEvent.change(issueTypeSelect, { target: { value: 'plumbing' } });
    fireEvent.change(descriptionInput, { target: { value: 'Leaking faucet' } });
    
    fireEvent.click(screen.getByRole('button', { name: /submit request/i }));

    // Verify room status update
    await waitFor(() => {
      const actions = store.getActions();
      expect(actions).toContainEqual(
        expect.objectContaining({
          type: updateRoomWithRetry.pending.type,
          meta: expect.objectContaining({
            arg: {
              roomId: mockRoom.id,
              status: RoomStatus.MAINTENANCE
            }
          })
        })
      );
    });
  });

  // Add more tests...
});
import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import ResizeObserver from 'resize-observer-polyfill';
import { RoomCard } from '../../src/shared/components/cards/RoomCard';
import { GuestCard } from '../../src/shared/components/cards/GuestCard';
import { Room, RoomStatus, RoomType, RoomAmenities } from '../../src/shared/interfaces/room.interface';
import { Guest } from '../../src/shared/interfaces/guest.interface';

// Add jest-axe matchers
expect.extend(toHaveNoViolations);

// Mock ResizeObserver
global.ResizeObserver = ResizeObserver;

// Mock data factories
const createMockRoom = (overrides?: Partial<Room>): Room => ({
  id: 'test-room-1',
  roomNumber: '101',
  type: RoomType.STANDARD,
  status: RoomStatus.AVAILABLE,
  floor: 1,
  baseRate: 150,
  currentRate: 150,
  maxOccupancy: 2,
  isAccessible: true,
  description: 'Standard Room',
  images: ['room101.jpg'],
  lastModified: new Date(),
  amenities: [RoomAmenities.WIFI, RoomAmenities.TV],
  channelRestrictions: [],
  pricingStrategy: {
    strategyType: 'standard',
    adjustmentFactors: [],
    minimumRate: 100,
    maximumRate: 200
  },
  ...overrides
});

const createMockGuest = (overrides?: Partial<Guest>): Guest => ({
  id: 'test-guest-1',
  firstName: 'John',
  lastName: 'Doe',
  email: 'john.doe@example.com',
  phone: '+1-555-0123',
  address: '123 Main St',
  city: 'Anytown',
  state: 'ST',
  country: 'US',
  postalCode: '12345',
  idType: 'passport',
  idNumber: 'AB123456',
  dateOfBirth: new Date('1990-01-01'),
  nationality: 'US',
  language: 'en',
  vipStatus: 'standard',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  ...overrides
});

describe('RoomCard', () => {
  const mockHandleSelect = jest.fn();
  const mockHandleStatusChange = jest.fn();
  const mockHandleEdit = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders room information correctly', () => {
    const room = createMockRoom();
    render(
      <RoomCard
        room={room}
        onSelect={mockHandleSelect}
        onStatusChange={mockHandleStatusChange}
        onEdit={mockHandleEdit}
      />
    );

    expect(screen.getByText(`Room ${room.roomNumber}`)).toBeInTheDocument();
    expect(screen.getByText(room.status)).toBeInTheDocument();
    expect(screen.getByText(`$${room.baseRate}/night`)).toBeInTheDocument();
  });

  it('handles selection with mouse and keyboard', async () => {
    const room = createMockRoom();
    render(<RoomCard room={room} onSelect={mockHandleSelect} />);

    const card = screen.getByRole('button');
    
    // Mouse click
    fireEvent.click(card);
    expect(mockHandleSelect).toHaveBeenCalledWith(room);

    // Keyboard interaction
    fireEvent.keyPress(card, { key: 'Enter', code: 'Enter' });
    expect(mockHandleSelect).toHaveBeenCalledTimes(2);

    fireEvent.keyPress(card, { key: ' ', code: 'Space' });
    expect(mockHandleSelect).toHaveBeenCalledTimes(3);
  });

  it('displays loading state correctly', () => {
    const room = createMockRoom();
    render(<RoomCard room={room} isLoading={true} />);

    expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true');
  });

  it('displays error state correctly', () => {
    const room = createMockRoom();
    const error = 'Failed to update room status';
    render(<RoomCard room={room} error={error} />);

    expect(screen.getByRole('alert')).toHaveTextContent(error);
  });

  it('meets accessibility requirements', async () => {
    const room = createMockRoom();
    const { container } = render(<RoomCard room={room} />);

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe('GuestCard', () => {
  const mockHandleEdit = jest.fn();
  const mockHandleDelete = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders guest information correctly', () => {
    const guest = createMockGuest();
    render(
      <GuestCard
        guest={guest}
        onEdit={mockHandleEdit}
        onDelete={mockHandleDelete}
      />
    );

    expect(screen.getByText(`${guest.firstName} ${guest.lastName}`)).toBeInTheDocument();
    expect(screen.getByText(guest.email)).toBeInTheDocument();
  });

  it('displays VIP badge when applicable', () => {
    const vipGuest = createMockGuest({ vipStatus: 'platinum' });
    render(
      <GuestCard
        guest={vipGuest}
        onEdit={mockHandleEdit}
        onDelete={mockHandleDelete}
      />
    );

    expect(screen.getByText('platinum')).toBeInTheDocument();
  });

  it('handles edit and delete actions', async () => {
    const guest = createMockGuest();
    render(
      <GuestCard
        guest={guest}
        onEdit={mockHandleEdit}
        onDelete={mockHandleDelete}
      />
    );

    const editButton = screen.getByLabelText(/edit/i);
    const deleteButton = screen.getByLabelText(/delete/i);

    await userEvent.click(editButton);
    expect(mockHandleEdit).toHaveBeenCalledWith(guest.id);

    await userEvent.click(deleteButton);
    expect(mockHandleDelete).toHaveBeenCalledWith(guest.id);
  });

  it('displays loading state correctly', () => {
    const guest = createMockGuest();
    render(
      <GuestCard
        guest={guest}
        onEdit={mockHandleEdit}
        onDelete={mockHandleDelete}
        isLoading={true}
      />
    );

    expect(screen.getByRole('status')).toHaveTextContent(/loading/i);
  });

  it('displays error state correctly', () => {
    const guest = createMockGuest();
    const error = new Error('Failed to update guest');
    render(
      <GuestCard
        guest={guest}
        onEdit={mockHandleEdit}
        onDelete={mockHandleDelete}
        error={error}
      />
    );

    expect(screen.getByRole('alert')).toHaveTextContent(error.message);
  });

  it('meets accessibility requirements', async () => {
    const guest = createMockGuest();
    const { container } = render(
      <GuestCard
        guest={guest}
        onEdit={mockHandleEdit}
        onDelete={mockHandleDelete}
      />
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('supports keyboard navigation', () => {
    const guest = createMockGuest();
    render(
      <GuestCard
        guest={guest}
        onEdit={mockHandleEdit}
        onDelete={mockHandleDelete}
      />
    );

    const editButton = screen.getByLabelText(/edit/i);
    const deleteButton = screen.getByLabelText(/delete/i);

    // Test tab navigation
    editButton.focus();
    expect(document.activeElement).toBe(editButton);

    userEvent.tab();
    expect(document.activeElement).toBe(deleteButton);
  });
});

// Responsive behavior tests
describe('Card Components Responsive Behavior', () => {
  it('RoomCard adapts to mobile viewport', () => {
    global.innerWidth = 375;
    global.dispatchEvent(new Event('resize'));

    const room = createMockRoom();
    render(<RoomCard room={room} />);

    // Verify mobile-specific styles and layout
    const card = screen.getByRole('button');
    expect(card).toHaveStyle({ width: '100%' });
  });

  it('GuestCard adapts to mobile viewport', () => {
    global.innerWidth = 375;
    global.dispatchEvent(new Event('resize'));

    const guest = createMockGuest();
    render(
      <GuestCard
        guest={guest}
        onEdit={mockHandleEdit}
        onDelete={mockHandleDelete}
      />
    );

    // Verify mobile-specific styles and layout
    const card = screen.getByRole('article');
    expect(card).toHaveStyle({ width: '100%' });
  });
});
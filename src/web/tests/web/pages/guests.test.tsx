import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { axe } from '@axe-core/react';
import GuestListPage from '../../src/web/pages/guests/GuestListPage';
import GuestDetailPage from '../../src/web/pages/guests/GuestDetailPage';
import GuestForm from '../../src/web/pages/guests/components/GuestForm';
import PreferenceForm from '../../src/web/pages/guests/components/PreferenceForm';

// Mock ResizeObserver for responsive tests
const mockResizeObserver = vi.fn(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));
window.ResizeObserver = mockResizeObserver;

// Mock encrypted guest data
const mockEncryptedGuest = {
  id: 'test-uuid',
  firstName: 'John',
  lastName: 'Doe',
  email: 'j***@example.com', // Masked for security
  phone: '****1234', // Masked for security
  vipStatus: 'regular',
  preferences: {
    roomType: 'standard',
    floorLevel: 2,
    amenities: ['wifi', 'workspace']
  }
};

// Helper function to render components with providers
const renderWithProviders = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Routes>
          <Route path="*" element={component} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('GuestListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render guest list with proper ARIA landmarks and roles', async () => {
    renderWithProviders(<GuestListPage />);
    
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('grid')).toBeInTheDocument();
    expect(screen.getByRole('searchbox')).toBeInTheDocument();
  });

  it('should handle keyboard navigation through guest list', async () => {
    renderWithProviders(<GuestListPage />);
    const table = screen.getByRole('grid');
    
    // Tab to first row
    await userEvent.tab();
    expect(table.querySelector('tr')).toHaveFocus();
    
    // Arrow down to next row
    await userEvent.keyboard('{ArrowDown}');
    expect(table.querySelectorAll('tr')[1]).toHaveFocus();
  });

  it('should maintain focus management during filtering', async () => {
    renderWithProviders(<GuestListPage />);
    const searchInput = screen.getByRole('searchbox');
    
    await userEvent.type(searchInput, 'John');
    expect(searchInput).toHaveFocus();
    
    // Focus should return after filter
    await waitFor(() => {
      expect(screen.getByRole('grid')).toBeInTheDocument();
    });
  });

  it('should securely display masked PII data', async () => {
    renderWithProviders(<GuestListPage />);
    
    const emailCell = screen.getByText(/j\*\*\*@example\.com/);
    const phoneCell = screen.getByText(/\*\*\*\*1234/);
    
    expect(emailCell).toBeInTheDocument();
    expect(phoneCell).toBeInTheDocument();
  });
});

describe('GuestDetailPage', () => {
  it('should validate user permissions for edits', async () => {
    renderWithProviders(<GuestDetailPage />);
    
    const editButton = screen.getByRole('button', { name: /edit mode/i });
    await userEvent.click(editButton);
    
    // Fields should be disabled without proper permissions
    const inputs = screen.getAllByRole('textbox');
    inputs.forEach(input => {
      expect(input).toBeDisabled();
    });
  });

  it('should handle optimistic updates correctly', async () => {
    renderWithProviders(<GuestDetailPage />);
    
    const nameInput = screen.getByLabelText(/first name/i);
    await userEvent.type(nameInput, 'Updated');
    
    // Should show optimistic update
    expect(nameInput).toHaveValue('Updated');
    
    // Should revert on error
    await waitFor(() => {
      expect(nameInput).toHaveValue('John');
    });
  });

  it('should maintain audit log of changes', async () => {
    const mockAuditLog = vi.fn();
    renderWithProviders(<GuestDetailPage />);
    
    const nameInput = screen.getByLabelText(/first name/i);
    await userEvent.type(nameInput, 'Updated');
    
    expect(mockAuditLog).toHaveBeenCalledWith({
      field: 'firstName',
      oldValue: 'John',
      newValue: 'Updated',
      timestamp: expect.any(Date)
    });
  });
});

describe('GuestForm', () => {
  it('should validate required fields', async () => {
    renderWithProviders(
      <GuestForm 
        initialValues={{} as any}
        onSubmit={vi.fn()}
        isLoading={false}
      />
    );
    
    const submitButton = screen.getByRole('button', { name: /create guest/i });
    await userEvent.click(submitButton);
    
    expect(screen.getAllByRole('alert')).toHaveLength(4); // Required fields
  });

  it('should validate email format', async () => {
    renderWithProviders(
      <GuestForm 
        initialValues={{} as any}
        onSubmit={vi.fn()}
        isLoading={false}
      />
    );
    
    const emailInput = screen.getByLabelText(/email/i);
    await userEvent.type(emailInput, 'invalid-email');
    await userEvent.tab();
    
    expect(screen.getByRole('alert')).toHaveTextContent(/invalid email format/i);
  });
});

describe('PreferenceForm', () => {
  it('should handle multi-select amenities', async () => {
    renderWithProviders(
      <PreferenceForm
        guestId="test-uuid"
        initialPreferences={mockEncryptedGuest.preferences}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    
    const amenitiesSelect = screen.getByLabelText(/amenities/i);
    await userEvent.selectOptions(amenitiesSelect, ['wifi', 'minibar']);
    
    expect(amenitiesSelect).toHaveValue(['wifi', 'minibar']);
  });
});

describe('Accessibility', () => {
  it('should pass WCAG 2.1 AA compliance checks', async () => {
    const { container } = renderWithProviders(<GuestListPage />);
    const results = await axe(container);
    
    expect(results.violations).toHaveLength(0);
  });

  it('should maintain focus trap in modals', async () => {
    renderWithProviders(<GuestListPage />);
    
    const addButton = screen.getByRole('button', { name: /add guest/i });
    await userEvent.click(addButton);
    
    const modal = screen.getByRole('dialog');
    const focusableElements = within(modal).getAllByRole('button');
    
    await userEvent.tab();
    expect(focusableElements[0]).toHaveFocus();
    
    // Tab to last element
    for (let i = 0; i < focusableElements.length; i++) {
      await userEvent.tab();
    }
    
    // Should cycle back to first element
    expect(focusableElements[0]).toHaveFocus();
  });
});

describe('Responsive Behavior', () => {
  it('should adjust layout for mobile viewport', async () => {
    window.innerWidth = 375;
    window.dispatchEvent(new Event('resize'));
    
    renderWithProviders(<GuestListPage />);
    
    const container = screen.getByRole('main');
    expect(container).toHaveStyle({ padding: '1rem' });
  });
});
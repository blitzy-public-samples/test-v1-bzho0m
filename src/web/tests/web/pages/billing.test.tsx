import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { vi, expect, describe, it, beforeEach } from 'vitest';
import { axe } from '@axe-core/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import InvoiceListPage from '../../src/web/pages/billing/InvoiceListPage';
import InvoiceDetailPage from '../../src/web/pages/billing/InvoiceDetailPage';
import PaymentForm from '../../src/web/pages/billing/components/PaymentForm';
import { billingApi } from '../../src/shared/api/billing.api';
import { 
  InvoiceStatus, 
  PaymentMethod, 
  PaymentStatus 
} from '../../src/shared/interfaces/billing.interface';

// Mock API client
vi.mock('../../src/shared/api/billing.api', () => ({
  billingApi: {
    getFolio: vi.fn(),
    processPayment: vi.fn(),
  }
}));

// Test constants
const MOCK_SECURE_INVOICE = {
  id: 'inv-001',
  invoiceNumber: 'INV-2023-001',
  guestName: 'John Doe',
  totalAmount: 500.00,
  status: InvoiceStatus.PENDING,
  createdAt: '2023-01-01T00:00:00Z',
  securityHash: 'sha256-hash',
  auditLog: []
};

const MOCK_PAYMENT_DATA = {
  id: 'pay-001',
  transactionId: 'txn-001',
  amount: 500.00,
  method: PaymentMethod.CREDIT_CARD,
  status: PaymentStatus.CAPTURED,
  tokenizedData: 'encrypted-token',
  securityVerification: 'pci-verified'
};

// Helper function to render components with security context
const renderWithSecurityContext = (component: React.ReactElement) => {
  return render(
    <MemoryRouter>
      <Routes>
        <Route path="*" element={component} />
      </Routes>
    </MemoryRouter>
  );
};

describe('Billing Module Tests', () => {
  describe('Security and Compliance', () => {
    it('should verify PCI DSS compliance for payment form', async () => {
      const handleSuccess = vi.fn();
      const handleError = vi.fn();
      
      const { container } = render(
        <PaymentForm
          folioId="folio-001"
          amount={500.00}
          currency="USD"
          onSuccess={handleSuccess}
          onError={handleError}
          onValidationError={vi.fn()}
        />
      );

      // Check for secure input fields
      const cardInput = screen.getByLabelText(/card number/i);
      expect(cardInput).toHaveAttribute('autoComplete', 'cc-number');
      expect(cardInput).toHaveAttribute('inputMode', 'numeric');
      
      // Verify no sensitive data in DOM
      const html = container.innerHTML;
      expect(html).not.toContain('cvv');
      expect(html).not.toContain('cardNumber');
    });

    it('should validate secure data transmission', async () => {
      const mockPayment = vi.fn().mockResolvedValue(MOCK_PAYMENT_DATA);
      billingApi.processPayment = mockPayment;

      render(
        <PaymentForm
          folioId="folio-001"
          amount={500.00}
          currency="USD"
          onSuccess={vi.fn()}
          onError={vi.fn()}
          onValidationError={vi.fn()}
        />
      );

      // Submit payment form
      fireEvent.submit(screen.getByRole('form'));

      await waitFor(() => {
        // Verify tokenization
        expect(mockPayment).toHaveBeenCalledWith(
          expect.not.objectContaining({
            cardNumber: expect.any(String),
            cvv: expect.any(String)
          })
        );
      });
    });

    it('should enforce RBAC for invoice access', async () => {
      const mockGetFolio = vi.fn().mockRejectedValue({
        response: { status: 403, data: { message: 'Unauthorized access' } }
      });
      billingApi.getFolio = mockGetFolio;

      renderWithSecurityContext(<InvoiceDetailPage />);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/unauthorized/i);
      });
    });
  });

  describe('Payment Processing', () => {
    it('should handle successful payment submission', async () => {
      const handleSuccess = vi.fn();
      billingApi.processPayment = vi.fn().mockResolvedValue(MOCK_PAYMENT_DATA);

      render(
        <PaymentForm
          folioId="folio-001"
          amount={500.00}
          currency="USD"
          onSuccess={handleSuccess}
          onError={vi.fn()}
          onValidationError={vi.fn()}
        />
      );

      // Fill payment form
      fireEvent.change(screen.getByLabelText(/card number/i), {
        target: { value: '4111111111111111' }
      });
      fireEvent.change(screen.getByLabelText(/cardholder name/i), {
        target: { value: 'John Doe' }
      });
      fireEvent.change(screen.getByLabelText(/cvv/i), {
        target: { value: '123' }
      });

      // Submit form
      fireEvent.submit(screen.getByRole('form'));

      await waitFor(() => {
        expect(handleSuccess).toHaveBeenCalledWith(MOCK_PAYMENT_DATA);
      });
    });

    it('should validate credit card data securely', async () => {
      render(
        <PaymentForm
          folioId="folio-001"
          amount={500.00}
          currency="USD"
          onSuccess={vi.fn()}
          onError={vi.fn()}
          onValidationError={vi.fn()}
        />
      );

      // Test invalid card number
      fireEvent.change(screen.getByLabelText(/card number/i), {
        target: { value: '1234' }
      });
      fireEvent.blur(screen.getByLabelText(/card number/i));

      expect(await screen.findByRole('alert')).toHaveTextContent(/invalid card/i);
    });
  });

  describe('Accessibility', () => {
    it('should meet WCAG 2.1 AA standards', async () => {
      const { container } = renderWithSecurityContext(<InvoiceListPage />);
      const results = await axe(container);
      expect(results.violations).toHaveLength(0);
    });

    it('should support keyboard navigation', async () => {
      render(
        <PaymentForm
          folioId="folio-001"
          amount={500.00}
          currency="USD"
          onSuccess={vi.fn()}
          onError={vi.fn()}
          onValidationError={vi.fn()}
        />
      );

      const form = screen.getByRole('form');
      const inputs = within(form).getAllByRole('textbox');

      // Test tab navigation
      inputs[0].focus();
      expect(document.activeElement).toBe(inputs[0]);
      
      fireEvent.keyDown(inputs[0], { key: 'Tab' });
      expect(document.activeElement).toBe(inputs[1]);
    });

    it('should provide clear error messages for screen readers', async () => {
      render(
        <PaymentForm
          folioId="folio-001"
          amount={500.00}
          currency="USD"
          onSuccess={vi.fn()}
          onError={vi.fn()}
          onValidationError={vi.fn()}
        />
      );

      // Submit empty form
      fireEvent.submit(screen.getByRole('form'));

      const alerts = await screen.findAllByRole('alert');
      expect(alerts.length).toBeGreaterThan(0);
      alerts.forEach(alert => {
        expect(alert).toHaveAttribute('aria-live', 'polite');
      });
    });
  });
});
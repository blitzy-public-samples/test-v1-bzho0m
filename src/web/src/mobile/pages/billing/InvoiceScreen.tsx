import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import styled from 'styled-components';
import { 
  IInvoice, 
  IInvoiceLineItem, 
  PaymentStatus, 
  InvoiceStatus, 
  PaymentMethod 
} from '../../../shared/interfaces/billing.interface';
import { billingApi } from '../../../shared/api/billing.api';

// Styled Components with mobile-first design
const Container = styled.div`
  padding: 16px;
  background-color: ${({ theme }) => theme.colors.background};
  min-height: 100vh;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  position: relative;
`;

const Header = styled.header`
  margin-bottom: 24px;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const Title = styled.h1`
  font-size: 24px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text.primary};
  margin: 0;
`;

const StatusBadge = styled.span<{ status: InvoiceStatus }>`
  padding: 4px 8px;
  border-radius: 16px;
  font-size: 14px;
  font-weight: 500;
  background-color: ${({ status, theme }) => {
    switch (status) {
      case InvoiceStatus.PAID:
        return theme.colors.success.light;
      case InvoiceStatus.OVERDUE:
        return theme.colors.error.light;
      default:
        return theme.colors.warning.light;
    }
  }};
  color: ${({ status, theme }) => {
    switch (status) {
      case InvoiceStatus.PAID:
        return theme.colors.success.dark;
      case InvoiceStatus.OVERDUE:
        return theme.colors.error.dark;
      default:
        return theme.colors.warning.dark;
    }
  }};
`;

const LineItemsContainer = styled.div`
  margin: 16px 0;
  border-radius: 8px;
  background: ${({ theme }) => theme.colors.surface};
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
`;

const LineItem = styled.div`
  padding: 12px 16px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  display: flex;
  justify-content: space-between;
  align-items: center;

  &:last-child {
    border-bottom: none;
  }
`;

const PaymentButton = styled.button`
  width: 100%;
  padding: 16px;
  background-color: ${({ theme }) => theme.colors.primary.main};
  color: ${({ theme }) => theme.colors.primary.contrastText};
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  margin-top: 24px;
  touch-action: manipulation;
  
  &:disabled {
    background-color: ${({ theme }) => theme.colors.disabled};
    cursor: not-allowed;
  }
`;

const LoadingSpinner = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 200px;
`;

const ErrorMessage = styled.div`
  color: ${({ theme }) => theme.colors.error.main};
  padding: 16px;
  margin: 16px 0;
  background-color: ${({ theme }) => theme.colors.error.light};
  border-radius: 8px;
  font-size: 14px;
`;

interface InvoiceScreenProps {}

export const InvoiceScreen: React.FC<InvoiceScreenProps> = () => {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [invoice, setInvoice] = useState<IInvoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  
  // Ref for pull-to-refresh functionality
  const pullToRefreshRef = useRef<HTMLDivElement>(null);

  // Fetch invoice data
  const fetchInvoice = useCallback(async () => {
    if (!invoiceId) return;
    
    try {
      setLoading(true);
      setError(null);
      const response = await billingApi.getFolio(invoiceId);
      setInvoice(response.invoices[0]);
    } catch (err) {
      setError('Failed to load invoice. Please try again.');
      console.error('Error fetching invoice:', err);
    } finally {
      setLoading(false);
    }
  }, [invoiceId]);

  // Initialize pull-to-refresh
  useEffect(() => {
    if (!pullToRefreshRef.current) return;

    const ptr = PullToRefresh.init({
      mainElement: pullToRefreshRef.current,
      onRefresh: fetchInvoice
    });

    return () => {
      ptr.destroy();
    };
  }, [fetchInvoice]);

  // Handle payment processing
  const handlePayment = async () => {
    if (!invoice) return;

    try {
      setProcessing(true);
      setError(null);

      const paymentResult = await billingApi.processPayment({
        amount: invoice.totalAmount,
        currency: invoice.currency,
        method: PaymentMethod.CREDIT_CARD,
        folioId: invoice.folioId
      });

      if (paymentResult.status === PaymentStatus.CAPTURED) {
        // Provide haptic feedback on success
        if (navigator.vibrate) {
          navigator.vibrate(200);
        }
        
        // Refresh invoice data
        await fetchInvoice();
        
        // Show success message
        // Note: Implement your toast/notification system
      }
    } catch (err) {
      setError('Payment processing failed. Please try again.');
      console.error('Payment error:', err);
    } finally {
      setProcessing(false);
    }
  };

  // Format currency
  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency
    }).format(amount);
  };

  if (loading) {
    return (
      <Container>
        <LoadingSpinner>Loading...</LoadingSpinner>
      </Container>
    );
  }

  if (error) {
    return (
      <Container>
        <ErrorMessage>
          {error}
          <button onClick={fetchInvoice}>Retry</button>
        </ErrorMessage>
      </Container>
    );
  }

  if (!invoice) {
    return (
      <Container>
        <ErrorMessage>Invoice not found</ErrorMessage>
      </Container>
    );
  }

  return (
    <Container ref={pullToRefreshRef}>
      <Header>
        <Title>Invoice #{invoice.invoiceNumber}</Title>
        <StatusBadge status={invoice.status}>
          {invoice.status}
        </StatusBadge>
      </Header>

      <LineItemsContainer>
        {invoice.lineItems.map((item: IInvoiceLineItem, index: number) => (
          <LineItem key={index}>
            <div>
              <div>{item.description}</div>
              <small>{item.quantity} x {formatCurrency(item.unitPrice, invoice.currency)}</small>
            </div>
            <div>{formatCurrency(item.totalAmount, invoice.currency)}</div>
          </LineItem>
        ))}
      </LineItemsContainer>

      <LineItemsContainer>
        <LineItem>
          <div>Subtotal</div>
          <div>{formatCurrency(invoice.subtotalAmount, invoice.currency)}</div>
        </LineItem>
        <LineItem>
          <div>Tax</div>
          <div>{formatCurrency(invoice.taxAmount, invoice.currency)}</div>
        </LineItem>
        <LineItem>
          <div>Total</div>
          <div>{formatCurrency(invoice.totalAmount, invoice.currency)}</div>
        </LineItem>
      </LineItemsContainer>

      {invoice.status !== InvoiceStatus.PAID && (
        <PaymentButton
          onClick={handlePayment}
          disabled={processing}
          aria-busy={processing}
        >
          {processing ? 'Processing...' : 'Pay Now'}
        </PaymentButton>
      )}
    </Container>
  );
};

export default InvoiceScreen;
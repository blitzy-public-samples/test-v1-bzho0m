/**
 * @fileoverview Mobile-optimized payment screen component with PCI DSS compliance
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import styled from '@emotion/styled';
import { 
  IPayment, 
  PaymentMethod, 
  PaymentStatus 
} from '../../../shared/interfaces/billing.interface';
import { billingApi, BillingError, BillingErrorType } from '../../../shared/api/billing.api';

// Styled components for mobile-optimized UI
const SecurePaymentContainer = styled.div`
  display: flex;
  flex-direction: column;
  padding: 16px;
  background-color: #ffffff;
  min-height: 100vh;
  touch-action: manipulation;
  user-select: none;
`;

const SecurePaymentForm = styled.form`
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 16px;
  touch-action: manipulation;
`;

const SecureInput = styled.input`
  padding: 16px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  font-size: 16px;
  width: 100%;
  box-sizing: border-box;
  -webkit-appearance: none;

  &:focus {
    outline: none;
    border-color: #3498DB;
    box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.2);
  }
`;

const SecureButton = styled.button`
  padding: 16px;
  background-color: #3498DB;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  touch-action: manipulation;
  min-height: 48px;

  &:disabled {
    background-color: #95a5a6;
    cursor: not-allowed;
  }
`;

const ErrorMessage = styled.div`
  color: #e74c3c;
  padding: 12px;
  background-color: #fadbd8;
  border-radius: 8px;
  margin: 8px 0;
  font-size: 14px;
`;

const StatusMessage = styled.div`
  color: #2c3e50;
  padding: 12px;
  background-color: #edf2f7;
  border-radius: 8px;
  margin: 8px 0;
  font-size: 14px;
`;

interface PaymentScreenProps {
  invoiceId: string;
  amount: number;
  currency: string;
  paymentMethods: PaymentMethod[];
  onSuccess: (payment: IPayment) => void;
  onError: (error: BillingError) => void;
}

/**
 * Mobile-optimized payment screen component with PCI DSS compliance
 */
export const PaymentScreen: React.FC<PaymentScreenProps> = ({
  invoiceId,
  amount,
  currency,
  paymentMethods,
  onSuccess,
  onError
}) => {
  const navigate = useNavigate();
  const [cardNumber, setCardNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [cvv, setCvv] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // Cleanup sensitive data on unmount
  useEffect(() => {
    return () => {
      setCardNumber('');
      setExpiryDate('');
      setCvv('');
    };
  }, []);

  /**
   * Formats card number with spaces for readability
   */
  const formatCardNumber = (value: string): string => {
    const digits = value.replace(/\D/g, '');
    const groups = digits.match(/.{1,4}/g);
    return groups ? groups.join(' ') : digits;
  };

  /**
   * Formats expiry date with slash
   */
  const formatExpiryDate = (value: string): string => {
    const digits = value.replace(/\D/g, '');
    if (digits.length >= 2) {
      return `${digits.slice(0, 2)}/${digits.slice(2, 4)}`;
    }
    return digits;
  };

  /**
   * Validates card number using Luhn algorithm
   */
  const validateCardNumber = (number: string): boolean => {
    const digits = number.replace(/\D/g, '');
    if (digits.length < 13 || digits.length > 19) return false;

    let sum = 0;
    let isEven = false;

    for (let i = digits.length - 1; i >= 0; i--) {
      let digit = parseInt(digits[i]);
      if (isEven) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }
      sum += digit;
      isEven = !isEven;
    }

    return sum % 10 === 0;
  };

  /**
   * Handles secure form submission with PCI compliance
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setStatus('Initializing payment...');
    setIsProcessing(true);

    try {
      // Basic validation
      if (!validateCardNumber(cardNumber)) {
        throw new Error('Invalid card number');
      }

      // Process payment through secure gateway
      const paymentData = {
        amount,
        currency,
        method: PaymentMethod.CREDIT_CARD,
        cardLastFour: cardNumber.slice(-4),
        metadata: {
          invoiceId
        }
      };

      const payment = await billingApi.processPayment(paymentData);

      // Poll payment status
      let attempts = 0;
      const maxAttempts = 10;
      const pollStatus = async () => {
        if (attempts >= maxAttempts) {
          throw new Error('Payment status check timeout');
        }

        const status = await billingApi.getPaymentStatus(payment.transactionId);
        if (status === PaymentStatus.CAPTURED) {
          onSuccess(payment);
          setStatus('Payment successful');
          setTimeout(() => navigate('/billing/confirmation'), 2000);
        } else if (status === PaymentStatus.FAILED) {
          throw new Error('Payment failed');
        } else {
          attempts++;
          setTimeout(pollStatus, 1000);
        }
      };

      await pollStatus();
    } catch (err) {
      const errorMessage = err instanceof BillingError ? 
        err.message : 
        'An error occurred while processing payment';
      
      setError(errorMessage);
      onError(err as BillingError);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <SecurePaymentContainer>
      <h1>Secure Payment</h1>
      <StatusMessage>Amount: {currency} {amount.toFixed(2)}</StatusMessage>
      
      <SecurePaymentForm ref={formRef} onSubmit={handleSubmit}>
        <SecureInput
          type="text"
          placeholder="Card Number"
          value={cardNumber}
          onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
          maxLength={19}
          autoComplete="cc-number"
          required
        />
        
        <SecureInput
          type="text"
          placeholder="MM/YY"
          value={expiryDate}
          onChange={(e) => setExpiryDate(formatExpiryDate(e.target.value))}
          maxLength={5}
          autoComplete="cc-exp"
          required
        />
        
        <SecureInput
          type="password"
          placeholder="CVV"
          value={cvv}
          onChange={(e) => setCvv(e.target.value.replace(/\D/g, ''))}
          maxLength={4}
          autoComplete="cc-csc"
          required
        />

        {error && <ErrorMessage>{error}</ErrorMessage>}
        {status && <StatusMessage>{status}</StatusMessage>}

        <SecureButton type="submit" disabled={isProcessing}>
          {isProcessing ? 'Processing...' : `Pay ${currency} ${amount.toFixed(2)}`}
        </SecureButton>
      </SecurePaymentForm>
    </SecurePaymentContainer>
  );
};

export default PaymentScreen;
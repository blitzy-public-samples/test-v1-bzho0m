/**
 * @fileoverview Guest Detail Page Component
 * Displays and manages detailed guest information with security and accessibility features
 * @version 1.0.0
 * @license MIT
 */

import React, { useEffect, useState, useCallback, Suspense } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import styled from '@emotion/styled';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ErrorBoundary } from 'react-error-boundary';
import { 
  Guest, 
  GuestPreference, 
  isGuest 
} from '../../../shared/interfaces/guest.interface';

// Styled Components
const PageContainer = styled.div`
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
  @media (max-width: 768px) {
    padding: 1rem;
  }
`;

const Header = styled.header`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
`;

const Section = styled.section`
  background: ${props => props.theme.colors.background};
  padding: 1.5rem;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  margin-bottom: 1.5rem;
`;

const LoadingSpinner = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 200px;
`;

// Component interfaces
interface GuestDetailProps {
  className?: string;
}

interface SecureDataState {
  isEncrypted: boolean;
  canEdit: boolean;
}

// Error component
const ErrorFallback = ({ error, resetErrorBoundary }) => (
  <div role="alert" className="error-container">
    <h2>Something went wrong</h2>
    <pre>{error.message}</pre>
    <button onClick={resetErrorBoundary}>Try again</button>
  </div>
);

/**
 * GuestDetailPage Component
 * Renders detailed guest information with security and accessibility features
 */
const GuestDetailPage: React.FC<GuestDetailProps> = ({ className }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [secureState, setSecureState] = useState<SecureDataState>({
    isEncrypted: true,
    canEdit: false,
  });

  // Fetch guest data with react-query
  const { 
    data: guest,
    isLoading,
    error,
    refetch 
  } = useQuery<Guest>(
    ['guest', id],
    async () => {
      const response = await fetch(`/api/guests/${id}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) throw new Error('Failed to fetch guest data');
      const data = await response.json();
      if (!isGuest(data)) throw new Error('Invalid guest data received');
      return data;
    },
    {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 30 * 60 * 1000, // 30 minutes
    }
  );

  // Update guest mutation
  const updateGuestMutation = useMutation(
    async (updatedGuest: Partial<Guest>) => {
      const response = await fetch(`/api/guests/${id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedGuest),
      });
      if (!response.ok) throw new Error('Failed to update guest');
      return response.json();
    },
    {
      onSuccess: () => {
        refetch();
      },
    }
  );

  // Secure update handler
  const handleSecureUpdate = useCallback(async (
    field: keyof Guest,
    value: any
  ) => {
    try {
      await updateGuestMutation.mutateAsync({
        [field]: value,
      });
    } catch (error) {
      console.error('Update failed:', error);
      // Implement proper error handling
    }
  }, [updateGuestMutation]);

  // Accessibility keyboard handlers
  const handleKeyboardNavigation = useCallback((
    event: React.KeyboardEvent
  ) => {
    if (event.key === 'Escape') {
      navigate('/guests');
    }
  }, [navigate]);

  // Effect for setting up keyboard listeners
  useEffect(() => {
    document.addEventListener('keydown', handleKeyboardNavigation as any);
    return () => {
      document.removeEventListener('keydown', handleKeyboardNavigation as any);
    };
  }, [handleKeyboardNavigation]);

  if (isLoading) {
    return (
      <LoadingSpinner role="status" aria-live="polite">
        Loading guest information...
      </LoadingSpinner>
    );
  }

  if (error) {
    return (
      <ErrorBoundary FallbackComponent={ErrorFallback}>
        <div role="alert">Error loading guest: {error.message}</div>
      </ErrorBoundary>
    );
  }

  return (
    <PageContainer 
      className={className}
      role="main"
      aria-label="Guest Details"
    >
      <Header>
        <h1>Guest Details</h1>
        <div className="actions">
          <button
            onClick={() => setSecureState(prev => ({
              ...prev,
              canEdit: !prev.canEdit
            }))}
            aria-pressed={secureState.canEdit}
          >
            {secureState.canEdit ? 'View Mode' : 'Edit Mode'}
          </button>
        </div>
      </Header>

      <Suspense fallback={<LoadingSpinner>Loading sections...</LoadingSpinner>}>
        <Section aria-label="Personal Information">
          <h2>Personal Information</h2>
          <div className="secure-field">
            <label htmlFor="firstName">First Name</label>
            <input
              id="firstName"
              type="text"
              value={guest?.firstName || ''}
              onChange={(e) => handleSecureUpdate('firstName', e.target.value)}
              disabled={!secureState.canEdit}
              aria-disabled={!secureState.canEdit}
            />
          </div>
          <div className="secure-field">
            <label htmlFor="lastName">Last Name</label>
            <input
              id="lastName"
              type="text"
              value={guest?.lastName || ''}
              onChange={(e) => handleSecureUpdate('lastName', e.target.value)}
              disabled={!secureState.canEdit}
              aria-disabled={!secureState.canEdit}
            />
          </div>
          {/* Additional secure fields */}
        </Section>

        <Section aria-label="Preferences">
          <h2>Guest Preferences</h2>
          {guest?.preferences && (
            <div className="preferences-grid">
              {/* Render preferences securely */}
            </div>
          )}
        </Section>

        <Section aria-label="Stay History">
          <h2>Stay History</h2>
          {/* Implement stay history section */}
        </Section>
      </Suspense>
    </PageContainer>
  );
};

// Export with memo for performance optimization
export default React.memo(GuestDetailPage);
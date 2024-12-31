import React, { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import styled from '@emotion/styled';
import ServiceForm from '../../components/forms/ServiceForm';
import useWebSocket from '../../../shared/hooks/useWebSocket';
import { selectSelectedRoom } from '../../../shared/store/room.slice';
import { WebSocketEvents, WebSocketNamespaces } from '@/websocket-service/config';
import { TYPOGRAPHY, SPACING, SHADOWS } from '../../../shared/constants/theme.constants';
import { PRIMARY_COLORS, NEUTRAL_COLORS } from '../../../shared/styles/colors';

// Styled components for mobile-optimized layout
const ScreenContainer = styled.div`
  display: flex;
  flex-direction: column;
  padding: 16px;
  background-color: ${NEUTRAL_COLORS.gray100};
  min-height: 100vh;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
`;

const Header = styled.div`
  position: sticky;
  top: 0;
  z-index: 10;
  padding: 16px 0;
  margin-bottom: 24px;
  border-bottom: 1px solid ${NEUTRAL_COLORS.gray300};
  background-color: ${NEUTRAL_COLORS.gray100};
`;

const Title = styled.h1`
  font-family: ${TYPOGRAPHY.fontFamily.primary};
  font-size: ${TYPOGRAPHY.fontSize.h3};
  color: ${PRIMARY_COLORS.main};
  margin: 0;
  line-height: 1.2;
`;

const StatusBanner = styled.div<{ status: 'success' | 'error' | 'offline' }>`
  padding: ${SPACING.sm}px;
  margin-bottom: ${SPACING.md}px;
  border-radius: 4px;
  background-color: ${props => 
    props.status === 'success' ? '#E8F5E9' :
    props.status === 'error' ? '#FFEBEE' :
    '#FFF3E0'
  };
  color: ${props =>
    props.status === 'success' ? '#2E7D32' :
    props.status === 'error' ? '#C62828' :
    '#EF6C00'
  };
  font-size: ${TYPOGRAPHY.fontSize.small};
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: ${SHADOWS.light};
`;

// Interface for service request data
interface ServiceRequestData {
  type: string;
  description: string;
  priority: string;
  preferredTime?: Date;
}

const ServiceRequestScreen: React.FC = () => {
  const navigate = useNavigate();
  const selectedRoom = useSelector(selectSelectedRoom);
  const [offlineQueue, setOfflineQueue] = useState<ServiceRequestData[]>([]);
  const [requestStatus, setRequestStatus] = useState<'success' | 'error' | 'offline' | null>(null);

  // Initialize WebSocket connection for real-time updates
  const { isConnected, sendMessage, subscribe } = useWebSocket({
    url: process.env.REACT_APP_WEBSOCKET_URL || 'ws://localhost:3001',
    namespace: WebSocketNamespaces.GUEST_SERVICES,
    reconnectAttempts: 3,
    debug: process.env.NODE_ENV === 'development'
  });

  // Handle real-time service request updates
  useEffect(() => {
    if (!selectedRoom) return;

    const unsubscribe = subscribe(WebSocketEvents.SERVICE_REQUEST_STATUS, (payload: any) => {
      if (payload.roomId === selectedRoom.id) {
        setRequestStatus(payload.status === 'ACCEPTED' ? 'success' : 'error');
      }
    });

    return () => {
      unsubscribe();
    };
  }, [selectedRoom, subscribe]);

  // Handle form submission with offline support
  const handleSubmit = useCallback(async (data: ServiceRequestData) => {
    if (!selectedRoom) {
      setRequestStatus('error');
      return;
    }

    try {
      if (!isConnected) {
        // Store request in offline queue
        setOfflineQueue(prev => [...prev, data]);
        setRequestStatus('offline');
        return;
      }

      // Send request via WebSocket
      await sendMessage(WebSocketEvents.SERVICE_REQUEST, {
        roomId: selectedRoom.id,
        ...data,
        timestamp: new Date().toISOString()
      });

      setRequestStatus('success');
      setTimeout(() => {
        navigate('/service-history');
      }, 2000);
    } catch (error) {
      console.error('Failed to submit service request:', error);
      setRequestStatus('error');
    }
  }, [selectedRoom, isConnected, sendMessage, navigate]);

  // Process offline queue when connection is restored
  useEffect(() => {
    if (isConnected && offlineQueue.length > 0) {
      const processQueue = async () => {
        for (const request of offlineQueue) {
          try {
            await sendMessage(WebSocketEvents.SERVICE_REQUEST, {
              roomId: selectedRoom?.id,
              ...request,
              timestamp: new Date().toISOString()
            });
          } catch (error) {
            console.error('Failed to process offline request:', error);
          }
        }
        setOfflineQueue([]);
      };

      processQueue();
    }
  }, [isConnected, offlineQueue, selectedRoom, sendMessage]);

  if (!selectedRoom) {
    return (
      <ScreenContainer>
        <StatusBanner status="error">
          Please select a room before submitting a service request
        </StatusBanner>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <Header>
        <Title>Service Request</Title>
      </Header>

      {requestStatus && (
        <StatusBanner status={requestStatus}>
          {requestStatus === 'success' && 'Request submitted successfully!'}
          {requestStatus === 'error' && 'Failed to submit request. Please try again.'}
          {requestStatus === 'offline' && 'Request saved offline. Will submit when connected.'}
        </StatusBanner>
      )}

      <ServiceForm
        roomId={selectedRoom.id}
        onSubmit={handleSubmit}
        onCancel={() => navigate(-1)}
      />
    </ScreenContainer>
  );
};

export default ServiceRequestScreen;
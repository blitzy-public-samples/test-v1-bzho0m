import React, { useCallback, useEffect, useMemo, useState } from 'react';
import styled from '@emotion/styled';
import { format } from 'date-fns';
import { VirtualList } from 'react-window';
import { useMediaQuery } from '@mui/material';

// Internal imports
import { ServiceCard } from '../../components/cards/ServiceCard';
import { DataTable } from '../../../shared/components/tables/DataTable';
import { TYPOGRAPHY, SPACING, SHADOWS } from '../../../shared/constants/theme.constants';
import { NEUTRAL_COLORS, SEMANTIC_COLORS } from '../../../shared/styles/colors';

// Types and interfaces
interface ServiceHistoryScreenProps {
  guestId: string;
  onServiceSelect?: (serviceId: string) => void;
  pageSize?: number;
}

interface ServiceRequest {
  id: string;
  type: 'housekeeping' | 'maintenance' | 'roomService' | 'concierge';
  status: 'pending' | 'inProgress' | 'completed' | 'cancelled';
  description: string;
  createdAt: Date;
  completedAt: Date | null;
  estimatedTime: Date | null;
  urgency: 'low' | 'medium' | 'high';
}

// Styled components with accessibility and responsive design
const Container = styled.div`
  padding: ${SPACING.md}px;
  background-color: ${NEUTRAL_COLORS.gray100};
  min-height: 100vh;
  
  @media (min-width: 576px) {
    padding: ${SPACING.lg}px;
  }
`;

const Header = styled.header`
  margin-bottom: ${SPACING.md}px;
`;

const Title = styled.h1`
  font-size: ${TYPOGRAPHY.fontSize.h2};
  font-weight: ${TYPOGRAPHY.fontWeight.bold};
  color: ${NEUTRAL_COLORS.black};
  margin: 0 0 ${SPACING.xs}px 0;
`;

const LoadingIndicator = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  padding: ${SPACING.md}px;
  color: ${NEUTRAL_COLORS.gray500};
`;

const ErrorMessage = styled.div`
  padding: ${SPACING.md}px;
  margin: ${SPACING.md}px 0;
  background-color: ${SEMANTIC_COLORS.error}1A;
  color: ${SEMANTIC_COLORS.error};
  border-radius: 4px;
  text-align: center;
`;

const VirtualListContainer = styled.div`
  height: calc(100vh - 160px);
  width: 100%;
`;

/**
 * ServiceHistoryScreen component displays a guest's service request history
 * with responsive layout and accessibility features.
 */
export const ServiceHistoryScreen: React.FC<ServiceHistoryScreenProps> = ({
  guestId,
  onServiceSelect,
  pageSize = 20
}) => {
  // State management
  const [services, setServices] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // Media query for responsive layout
  const isDesktop = useMediaQuery('(min-width: 992px)');

  // Data fetching
  const fetchServiceHistory = useCallback(async () => {
    try {
      setLoading(true);
      // API call would go here
      const response = await fetch(
        `/api/v1/guests/${guestId}/services?page=${page}&pageSize=${pageSize}`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch service history');
      }

      const data = await response.json();
      setServices(prevServices => 
        page === 1 ? data.services : [...prevServices, ...data.services]
      );
      setHasMore(data.services.length === pageSize);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [guestId, page, pageSize]);

  useEffect(() => {
    fetchServiceHistory();
  }, [fetchServiceHistory]);

  // Table columns configuration for desktop view
  const columns = useMemo(() => [
    {
      id: 'type',
      header: 'Service Type',
      accessor: 'type',
      width: '20%',
    },
    {
      id: 'description',
      header: 'Description',
      accessor: 'description',
      width: '30%',
    },
    {
      id: 'status',
      header: 'Status',
      accessor: 'status',
      width: '15%',
      Cell: (value: string) => (
        <span style={{ color: SEMANTIC_COLORS[value] }}>{value}</span>
      ),
    },
    {
      id: 'createdAt',
      header: 'Requested',
      accessor: (row: ServiceRequest) => format(row.createdAt, 'PPp'),
      width: '20%',
    },
    {
      id: 'estimatedTime',
      header: 'Estimated Time',
      accessor: (row: ServiceRequest) => 
        row.estimatedTime ? format(row.estimatedTime, 'p') : 'N/A',
      width: '15%',
    },
  ], []);

  // Virtual list row renderer for mobile view
  const renderRow = useCallback(({ index, style }: any) => {
    const service = services[index];
    if (!service) return null;

    return (
      <div style={style}>
        <ServiceCard
          id={service.id}
          type={service.type}
          description={service.description}
          urgency={service.urgency}
          status={service.status}
          createdAt={service.createdAt}
          estimatedTime={service.estimatedTime}
          onCancel={async (id) => {
            // Cancel service request implementation
            console.log('Cancelling service:', id);
          }}
        />
      </div>
    );
  }, [services]);

  // Error handling
  if (error) {
    return (
      <Container>
        <ErrorMessage role="alert">
          {error}
          <button onClick={() => fetchServiceHistory()}>Retry</button>
        </ErrorMessage>
      </Container>
    );
  }

  return (
    <Container>
      <Header>
        <Title>Service History</Title>
      </Header>

      {loading && services.length === 0 ? (
        <LoadingIndicator role="status" aria-live="polite">
          Loading service history...
        </LoadingIndicator>
      ) : isDesktop ? (
        <DataTable
          columns={columns}
          data={services}
          loading={loading}
          rowKey="id"
          onRowClick={onServiceSelect}
          pageSize={pageSize}
          currentPage={page}
          onPageChange={setPage}
          sortable
          defaultSortColumn="createdAt"
          defaultSortDirection="desc"
          stickyHeader
          responsive
          aria-label="Service History Table"
        />
      ) : (
        <VirtualListContainer>
          <VirtualList
            height={window.innerHeight - 160}
            width="100%"
            itemCount={services.length + (hasMore ? 1 : 0)}
            itemSize={160}
            onItemsRendered={({ visibleStopIndex }) => {
              if (
                !loading &&
                hasMore &&
                visibleStopIndex === services.length - 1
              ) {
                setPage(prev => prev + 1);
              }
            }}
          >
            {renderRow}
          </VirtualList>
        </VirtualListContainer>
      )}
    </Container>
  );
};

export default ServiceHistoryScreen;
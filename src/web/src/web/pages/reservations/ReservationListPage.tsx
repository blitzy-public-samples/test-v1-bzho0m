/**
 * @file ReservationListPage.tsx
 * @description Advanced reservation list view component with real-time updates,
 * virtual scrolling, and comprehensive filtering capabilities
 * @version 1.0.0
 */

// External imports - v18.0.0
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteQuery } from 'react-query'; // v4.0.0
import { useMediaQuery } from 'react-responsive'; // v8.0.0
import { VirtualList } from 'react-window'; // v1.8.0
import { debounce } from 'lodash'; // v4.17.0
import { format } from 'date-fns'; // v2.29.0

// Internal imports
import { 
  Reservation, 
  ReservationStatus, 
  PaymentStatus 
} from '../../../shared/interfaces/reservation.interface';
import { useReservationSocket } from '@websocket/reservation';
import { ReservationCard } from '../../components/reservations/ReservationCard';
import { ReservationFilters } from '../../components/reservations/ReservationFilters';
import { ErrorBoundary } from '../../components/common/ErrorBoundary';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { useToast } from '../../hooks/useToast';
import { reservationApi } from '../../services/reservationApi';

// Constants
const ITEMS_PER_PAGE = 20;
const MOBILE_BREAKPOINT = 768;
const DEBOUNCE_DELAY = 300;

/**
 * Interface for filter state
 */
interface FilterState {
  searchTerm: string;
  status: ReservationStatus[];
  dateRange: {
    from: Date | null;
    to: Date | null;
  };
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

/**
 * ReservationListPage Component
 * Implements real-time reservation management with advanced filtering and virtual scrolling
 */
const ReservationListPage: React.FC = () => {
  // Responsive design hooks
  const isMobile = useMediaQuery({ maxWidth: MOBILE_BREAKPOINT });
  
  // State management
  const [filters, setFilters] = useState<FilterState>({
    searchTerm: '',
    status: [],
    dateRange: { from: null, to: null },
    sortBy: 'checkInDate',
    sortOrder: 'asc'
  });
  
  // Refs
  const virtualListRef = useRef<any>(null);
  const { showToast } = useToast();

  // WebSocket integration for real-time updates
  const { socket, connected } = useReservationSocket({
    onUpdate: (updatedReservation) => {
      queryClient.setQueryData(['reservations'], (oldData: any) => {
        // Update cache with new reservation data
        return updateReservationInCache(oldData, updatedReservation);
      });
      showToast('Reservation updated', 'info');
    }
  });

  // Infinite query implementation
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isError,
    error
  } = useInfiniteQuery(
    ['reservations', filters],
    ({ pageParam = 0 }) => fetchReservations(filters, pageParam),
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      keepPreviousData: true,
      staleTime: 30000, // 30 seconds
      cacheTime: 300000, // 5 minutes
    }
  );

  // Memoized flat list of all reservations
  const flatReservations = useMemo(() => {
    return data?.pages.flatMap(page => page.reservations) ?? [];
  }, [data]);

  // Debounced filter handler
  const handleFilterChange = useCallback(
    debounce((newFilters: Partial<FilterState>) => {
      setFilters(prev => ({ ...prev, ...newFilters }));
      virtualListRef.current?.scrollTo(0);
    }, DEBOUNCE_DELAY),
    []
  );

  // Infinite scroll handler
  const handleScroll = useCallback(({ scrollOffset, scrollUpdateWasRequested }: any) => {
    if (
      !scrollUpdateWasRequested &&
      scrollOffset > 0.9 * flatReservations.length * 150 && // 150px estimated row height
      hasNextPage &&
      !isFetching
    ) {
      fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetching, flatReservations.length]);

  // Row renderer for virtual list
  const rowRenderer = useCallback(({ index, style }: any) => {
    const reservation = flatReservations[index];
    if (!reservation) return null;

    return (
      <div style={style}>
        <ReservationCard
          reservation={reservation}
          isMobile={isMobile}
          onStatusChange={(newStatus) => {
            socket?.emit('updateReservation', {
              id: reservation.id,
              status: newStatus
            });
          }}
        />
      </div>
    );
  }, [flatReservations, isMobile, socket]);

  // Error handling
  if (isError) {
    return (
      <div className="error-container">
        <h2>Error loading reservations</h2>
        <p>{(error as Error).message}</p>
        <button onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="reservation-list-page">
        <header className="page-header">
          <h1>Reservations</h1>
          {connected && <span className="real-time-badge">Real-time</span>}
        </header>

        <ReservationFilters
          filters={filters}
          onChange={handleFilterChange}
          isMobile={isMobile}
        />

        {isFetching && !data && <LoadingSpinner />}

        <div className="reservation-list-container">
          <VirtualList
            ref={virtualListRef}
            height={window.innerHeight - 200} // Adjust based on header height
            width="100%"
            itemCount={flatReservations.length}
            itemSize={150} // Estimated row height
            onScroll={handleScroll}
          >
            {rowRenderer}
          </VirtualList>
        </div>

        {isFetching && <LoadingSpinner />}
      </div>
    </ErrorBoundary>
  );
};

/**
 * Helper function to fetch reservations with filtering
 */
async function fetchReservations(filters: FilterState, pageParam: number) {
  const queryParams = {
    page: pageParam,
    limit: ITEMS_PER_PAGE,
    search: filters.searchTerm,
    status: filters.status,
    dateFrom: filters.dateRange.from?.toISOString(),
    dateTo: filters.dateRange.to?.toISOString(),
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder
  };

  return await reservationApi.getReservations(queryParams);
}

/**
 * Helper function to update reservation in cache
 */
function updateReservationInCache(oldData: any, updatedReservation: Reservation) {
  if (!oldData) return oldData;

  return {
    ...oldData,
    pages: oldData.pages.map((page: any) => ({
      ...page,
      reservations: page.reservations.map((reservation: Reservation) =>
        reservation.id === updatedReservation.id ? updatedReservation : reservation
      )
    }))
  };
}

export default ReservationListPage;
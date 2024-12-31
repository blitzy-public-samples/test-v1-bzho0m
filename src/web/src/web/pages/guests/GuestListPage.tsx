import React, { useState, useCallback, useMemo } from 'react';
import styled from '@emotion/styled';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDebounce } from 'use-debounce';
import DataTable, { Column } from '../../../shared/components/tables/DataTable';
import GuestForm from './components/GuestForm';
import Input from '../../../shared/components/forms/Input';
import { Guest } from '../../../shared/interfaces/guest.interface';
import { TYPOGRAPHY, SPACING, SHADOWS, PRIMARY_COLORS, NEUTRAL_COLORS } from '../../../shared/constants/theme.constants';

// Styled Components
const PageContainer = styled.div`
  padding: ${SPACING.lg}px;
  display: flex;
  flex-direction: column;
  gap: ${SPACING.lg}px;

  @media (max-width: 768px) {
    padding: ${SPACING.md}px;
  }
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: ${SPACING.md}px;
`;

const Title = styled.h1`
  font-family: ${TYPOGRAPHY.fontFamily.primary};
  font-size: ${TYPOGRAPHY.fontSize.h2};
  color: ${PRIMARY_COLORS.main};
  margin: 0;
`;

const FiltersSection = styled.div`
  display: flex;
  gap: ${SPACING.md}px;
  align-items: center;
  flex-wrap: wrap;
  background: ${NEUTRAL_COLORS.white};
  padding: ${SPACING.md}px;
  border-radius: 8px;
  box-shadow: ${SHADOWS.light};

  @media (max-width: 576px) {
    flex-direction: column;
    align-items: stretch;
  }
`;

const ActionButton = styled.button<{ variant?: 'primary' | 'secondary' }>`
  padding: ${SPACING.sm}px ${SPACING.md}px;
  font-family: ${TYPOGRAPHY.fontFamily.primary};
  font-size: ${TYPOGRAPHY.fontSize.body};
  border-radius: 4px;
  min-height: 44px;
  cursor: pointer;
  transition: all 0.2s ease-in-out;

  ${({ variant }) => variant === 'primary' ? `
    background-color: ${PRIMARY_COLORS.main};
    color: ${NEUTRAL_COLORS.white};
    border: none;

    &:hover:not(:disabled) {
      background-color: ${PRIMARY_COLORS.dark};
    }
  ` : `
    background-color: ${NEUTRAL_COLORS.white};
    color: ${PRIMARY_COLORS.main};
    border: 1px solid ${PRIMARY_COLORS.main};

    &:hover:not(:disabled) {
      background-color: ${NEUTRAL_COLORS.gray100};
    }
  `}

  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
`;

// Interfaces
interface GuestListPageProps {
  enableBulkActions?: boolean;
  enableExport?: boolean;
}

interface GuestFilters {
  searchTerm: string;
  vipStatus: string;
  isActive: boolean;
  categories: string[];
  stayDates: {
    from: Date | null;
    to: Date | null;
  };
}

// Component
export const GuestListPage: React.FC<GuestListPageProps> = ({
  enableBulkActions = true,
  enableExport = true,
}) => {
  const queryClient = useQueryClient();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedGuests, setSelectedGuests] = useState<string[]>([]);
  const [filters, setFilters] = useState<GuestFilters>({
    searchTerm: '',
    vipStatus: '',
    isActive: true,
    categories: [],
    stayDates: { from: null, to: null },
  });

  // Debounce search term to prevent excessive API calls
  const [debouncedSearchTerm] = useDebounce(filters.searchTerm, 300);

  // Fetch guests with filters
  const { data: guests, isLoading } = useQuery(
    ['guests', debouncedSearchTerm, filters],
    async () => {
      // API call would go here
      return [] as Guest[];
    },
    {
      keepPreviousData: true,
      staleTime: 30000, // 30 seconds
    }
  );

  // Mutations
  const createGuestMutation = useMutation(
    async (guest: Partial<Guest>) => {
      // API call would go here
      return {} as Guest;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['guests']);
        setIsFormOpen(false);
      },
    }
  );

  const deleteGuestsMutation = useMutation(
    async (guestIds: string[]) => {
      // API call would go here
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['guests']);
        setSelectedGuests([]);
      },
    }
  );

  // Table columns with data masking for sensitive information
  const columns: Column[] = useMemo(() => [
    {
      id: 'name',
      header: 'Name',
      accessor: (row: Guest) => `${row.firstName} ${row.lastName}`,
      sortable: true,
    },
    {
      id: 'email',
      header: 'Email',
      accessor: (row: Guest) => {
        // Mask email for security
        const [local, domain] = row.email.split('@');
        return `${local.slice(0, 3)}***@${domain}`;
      },
      sortable: true,
    },
    {
      id: 'phone',
      header: 'Phone',
      accessor: (row: Guest) => {
        // Mask phone number
        return `****${row.phone.slice(-4)}`;
      },
    },
    {
      id: 'vipStatus',
      header: 'VIP Status',
      accessor: 'vipStatus',
      sortable: true,
    },
    {
      id: 'actions',
      header: 'Actions',
      accessor: (row: Guest) => row.id,
      Cell: (value, row) => (
        <ActionButton
          onClick={() => handleEditGuest(row)}
          aria-label={`Edit guest ${row.firstName} ${row.lastName}`}
        >
          Edit
        </ActionButton>
      ),
    },
  ], []);

  // Handlers
  const handleCreateGuest = useCallback(async (guestData: Partial<Guest>) => {
    await createGuestMutation.mutateAsync(guestData);
  }, [createGuestMutation]);

  const handleEditGuest = useCallback((guest: Guest) => {
    setIsFormOpen(true);
    // Additional edit logic
  }, []);

  const handleBulkDelete = useCallback(async () => {
    if (window.confirm('Are you sure you want to delete the selected guests?')) {
      await deleteGuestsMutation.mutateAsync(selectedGuests);
    }
  }, [selectedGuests, deleteGuestsMutation]);

  const handleExport = useCallback(() => {
    // Export logic would go here
    console.log('Exporting guest data...');
  }, []);

  return (
    <PageContainer>
      <Header>
        <Title>Guest Management</Title>
        <div>
          <ActionButton
            variant="primary"
            onClick={() => setIsFormOpen(true)}
            aria-label="Create new guest"
          >
            Add Guest
          </ActionButton>
          {enableExport && (
            <ActionButton
              onClick={handleExport}
              aria-label="Export guest data"
            >
              Export
            </ActionButton>
          )}
        </div>
      </Header>

      <FiltersSection>
        <Input
          name="search"
          type="text"
          value={filters.searchTerm}
          onChange={(e) => setFilters(prev => ({ ...prev, searchTerm: e.target.value }))}
          placeholder="Search guests..."
          aria-label="Search guests"
        />
        {/* Additional filters would go here */}
      </FiltersSection>

      <DataTable
        columns={columns}
        data={guests || []}
        loading={isLoading}
        rowKey="id"
        selectedRows={selectedGuests}
        onSelectionChange={setSelectedGuests}
        onRowClick={handleEditGuest}
        stickyHeader
        aria-label="Guest list"
      />

      {isFormOpen && (
        <GuestForm
          initialValues={{} as Guest}
          onSubmit={handleCreateGuest}
          isLoading={createGuestMutation.isLoading}
        />
      )}

      {enableBulkActions && selectedGuests.length > 0 && (
        <ActionButton
          variant="secondary"
          onClick={handleBulkDelete}
          disabled={deleteGuestsMutation.isLoading}
          aria-label={`Delete ${selectedGuests.length} selected guests`}
        >
          Delete Selected ({selectedGuests.length})
        </ActionButton>
      )}
    </PageContainer>
  );
};

export default GuestListPage;
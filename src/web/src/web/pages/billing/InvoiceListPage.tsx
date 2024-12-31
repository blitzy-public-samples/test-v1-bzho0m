import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { debounce } from 'lodash';
import styled from 'styled-components';

// Internal imports
import DataTable, { Column, SortConfig, FilterConfig } from '../../../../shared/components/tables/DataTable';
import { IInvoice, InvoiceStatus } from '../../../../shared/interfaces/billing.interface';
import { NEUTRAL_COLORS, SEMANTIC_COLORS } from '../../../../shared/styles/colors';

// Constants for table configuration
const PAGE_SIZE = 20;
const DEBOUNCE_DELAY = 300;

// Styled components
const PageContainer = styled.div`
  padding: 24px;
  background: ${NEUTRAL_COLORS.gray100};
  min-height: 100vh;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;

  @media (max-width: 576px) {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
  }
`;

const Title = styled.h1`
  font-size: 24px;
  color: ${NEUTRAL_COLORS.black};
  margin: 0;
`;

const SearchInput = styled.input`
  padding: 8px 16px;
  border: 1px solid ${NEUTRAL_COLORS.gray300};
  border-radius: 4px;
  width: 300px;
  font-size: 14px;

  &:focus {
    outline: none;
    border-color: ${NEUTRAL_COLORS.gray400};
  }

  @media (max-width: 576px) {
    width: 100%;
  }
`;

const StatusBadge = styled.span<{ status: InvoiceStatus }>`
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  background-color: ${({ status }) => {
    switch (status) {
      case InvoiceStatus.PAID:
        return SEMANTIC_COLORS.success;
      case InvoiceStatus.OVERDUE:
        return SEMANTIC_COLORS.error;
      case InvoiceStatus.PARTIALLY_PAID:
        return SEMANTIC_COLORS.warning;
      default:
        return NEUTRAL_COLORS.gray300;
    }
  }};
  color: ${NEUTRAL_COLORS.white};
`;

// Custom hook for managing invoice data and state
const useInvoiceData = () => {
  const [invoices, setInvoices] = useState<IInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchParams] = useSearchParams();

  const fetchInvoices = useCallback(async () => {
    try {
      setLoading(true);
      // TODO: Replace with actual API call
      const response = await fetch('/api/v1/invoices');
      const data = await response.json();
      setInvoices(data);
      setError(null);
    } catch (err) {
      setError('Failed to fetch invoices. Please try again.');
      console.error('Error fetching invoices:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  return { invoices, loading, error, refetch: fetchInvoices };
};

// Table columns configuration
const getColumns = (navigate: (path: string) => void): Column[] => [
  {
    id: 'invoiceNumber',
    header: 'Invoice #',
    accessor: 'invoiceNumber',
    sortable: true,
    width: '150px',
    Cell: (value, row) => (
      <a
        href="#"
        onClick={(e) => {
          e.preventDefault();
          navigate(`/billing/invoices/${row.id}`);
        }}
        style={{ color: NEUTRAL_COLORS.black, textDecoration: 'none' }}
      >
        {value}
      </a>
    ),
  },
  {
    id: 'issueDate',
    header: 'Issue Date',
    accessor: 'issueDate',
    sortable: true,
    width: '150px',
    Cell: (value) => new Date(value).toLocaleDateString(),
  },
  {
    id: 'dueDate',
    header: 'Due Date',
    accessor: 'dueDate',
    sortable: true,
    width: '150px',
    Cell: (value) => new Date(value).toLocaleDateString(),
  },
  {
    id: 'totalAmount',
    header: 'Total Amount',
    accessor: 'totalAmount',
    sortable: true,
    width: '150px',
    align: 'right',
    Cell: (value, row) => new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: row.currency,
    }).format(value),
  },
  {
    id: 'balanceAmount',
    header: 'Balance',
    accessor: 'balanceAmount',
    sortable: true,
    width: '150px',
    align: 'right',
    Cell: (value, row) => new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: row.currency,
    }).format(value),
  },
  {
    id: 'status',
    header: 'Status',
    accessor: 'status',
    sortable: true,
    width: '120px',
    Cell: (value: InvoiceStatus) => (
      <StatusBadge status={value}>{value.replace('_', ' ')}</StatusBadge>
    ),
  },
];

// Main component
const InvoiceListPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { invoices, loading, error } = useInvoiceData();
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');

  // Memoized columns
  const columns = useMemo(() => getColumns(navigate), [navigate]);

  // Debounced search handler
  const handleSearch = useCallback(
    debounce((term: string) => {
      const params = new URLSearchParams(searchParams);
      if (term) {
        params.set('search', term);
      } else {
        params.delete('search');
      }
      setSearchParams(params);
    }, DEBOUNCE_DELAY),
    [setSearchParams, searchParams]
  );

  // Filter invoices based on search term
  const filteredInvoices = useMemo(() => {
    if (!searchTerm) return invoices;
    const term = searchTerm.toLowerCase();
    return invoices.filter((invoice) =>
      invoice.invoiceNumber.toLowerCase().includes(term) ||
      invoice.status.toLowerCase().includes(term)
    );
  }, [invoices, searchTerm]);

  return (
    <PageContainer>
      <Header>
        <Title>Invoices</Title>
        <SearchInput
          type="text"
          placeholder="Search invoices..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            handleSearch(e.target.value);
          }}
          aria-label="Search invoices"
        />
      </Header>

      {error && (
        <div role="alert" style={{ color: SEMANTIC_COLORS.error, marginBottom: '16px' }}>
          {error}
        </div>
      )}

      <DataTable
        columns={columns}
        data={filteredInvoices}
        loading={loading}
        rowKey="id"
        pageSize={PAGE_SIZE}
        sortable
        stickyHeader
        responsive
        virtualScroll
        aria-label="Invoices list"
        emptyMessage="No invoices found"
        onRowClick={(row) => navigate(`/billing/invoices/${row.id}`)}
      />
    </PageContainer>
  );
};

export default React.memo(InvoiceListPage);
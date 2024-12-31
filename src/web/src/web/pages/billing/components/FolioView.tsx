/**
 * @fileoverview A comprehensive React component for displaying and managing folio information
 * with real-time updates, payment processing visualization, and night audit support.
 * @version 1.0.0
 */

import React, { useCallback, useMemo, useState } from 'react';
import styled from 'styled-components';
import { useTranslation } from 'react-i18next';
import { IFolio, FolioStatus, PaymentStatus, PaymentMethod } from '../../../../shared/interfaces/billing.interface';
import DataTable, { Column } from '../../../../shared/components/tables/DataTable';
import { PRIMARY_COLORS, SEMANTIC_COLORS, NEUTRAL_COLORS } from '../../../../shared/styles/colors';

// Constants for date formatting
const DATE_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
};

// Styled Components
const StyledContainer = styled.div`
  padding: 24px;
  background: ${NEUTRAL_COLORS.white};
  border-radius: 8px;
  box-shadow: 0 2px 4px ${props => props.theme.colors.shadow};
`;

const StyledHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${props => props.theme.spacing(3)};
  
  @media (max-width: ${props => props.theme.breakpoints.sm}) {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
  }
`;

const StyledTitle = styled.h2`
  color: ${PRIMARY_COLORS.main};
  margin: 0;
  font-size: 24px;
  font-weight: 600;
`;

const StyledStatus = styled.div<{ status: FolioStatus }>`
  padding: 8px 16px;
  border-radius: 4px;
  font-weight: 500;
  background: ${props => {
    switch (props.status) {
      case FolioStatus.OPEN:
        return SEMANTIC_COLORS.info;
      case FolioStatus.CLOSED:
        return SEMANTIC_COLORS.success;
      case FolioStatus.DISPUTED:
        return SEMANTIC_COLORS.error;
      default:
        return NEUTRAL_COLORS.gray200;
    }
  }};
  color: ${NEUTRAL_COLORS.white};
`;

const StyledSummary = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 24px;
  margin-bottom: 32px;
  padding: 16px;
  background: ${NEUTRAL_COLORS.gray100};
  border-radius: 4px;
`;

const StyledSummaryItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const StyledLabel = styled.span`
  color: ${NEUTRAL_COLORS.gray500};
  font-size: 14px;
`;

const StyledValue = styled.span`
  color: ${PRIMARY_COLORS.main};
  font-size: 16px;
  font-weight: 500;
`;

// Interface definitions
interface FolioViewProps {
  folio: IFolio;
  onChargeClick: (charge: any) => void;
  onPaymentClick: (payment: any) => void;
  onStatusChange: (status: FolioStatus) => Promise<void>;
  onError: (error: Error) => void;
}

/**
 * FolioView component for displaying detailed folio information
 * with real-time updates and payment processing visualization
 */
export const FolioView: React.FC<FolioViewProps> = React.memo(({
  folio,
  onChargeClick,
  onPaymentClick,
  onStatusChange,
  onError
}) => {
  const { t } = useTranslation('billing');
  const [isLoading, setIsLoading] = useState(false);

  // Memoized table columns configuration
  const chargeColumns = useMemo((): Column[] => [
    {
      id: 'date',
      header: t('folio.charges.date'),
      accessor: 'postingDate',
      sortable: true,
      Cell: (value) => new Date(value).toLocaleDateString(undefined, DATE_FORMAT_OPTIONS)
    },
    {
      id: 'description',
      header: t('folio.charges.description'),
      accessor: 'description',
      sortable: true
    },
    {
      id: 'amount',
      header: t('folio.charges.amount'),
      accessor: 'amount',
      align: 'right',
      sortable: true,
      Cell: (value) => new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: folio.currency
      }).format(value)
    },
    {
      id: 'status',
      header: t('folio.charges.status'),
      accessor: 'status',
      sortable: true,
      Cell: (value) => (
        <StyledStatus status={value}>{t(`folio.status.${value.toLowerCase()}`)}</StyledStatus>
      )
    }
  ], [t, folio.currency]);

  const paymentColumns = useMemo((): Column[] => [
    {
      id: 'date',
      header: t('folio.payments.date'),
      accessor: 'createdAt',
      sortable: true,
      Cell: (value) => new Date(value).toLocaleDateString(undefined, DATE_FORMAT_OPTIONS)
    },
    {
      id: 'method',
      header: t('folio.payments.method'),
      accessor: 'method',
      sortable: true,
      Cell: (value: PaymentMethod) => t(`payment.method.${value.toLowerCase()}`)
    },
    {
      id: 'amount',
      header: t('folio.payments.amount'),
      accessor: 'amount',
      align: 'right',
      sortable: true,
      Cell: (value) => new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: folio.currency
      }).format(value)
    },
    {
      id: 'status',
      header: t('folio.payments.status'),
      accessor: 'status',
      sortable: true,
      Cell: (value: PaymentStatus) => (
        <StyledStatus status={value}>{t(`payment.status.${value.toLowerCase()}`)}</StyledStatus>
      )
    }
  ], [t, folio.currency]);

  // Event handlers
  const handleStatusChange = useCallback(async (newStatus: FolioStatus) => {
    setIsLoading(true);
    try {
      await onStatusChange(newStatus);
    } catch (error) {
      onError(error instanceof Error ? error : new Error('Failed to update status'));
    } finally {
      setIsLoading(false);
    }
  }, [onStatusChange, onError]);

  return (
    <StyledContainer role="region" aria-label={t('folio.view.title')}>
      <StyledHeader>
        <StyledTitle>
          {t('folio.view.title')} #{folio.id}
        </StyledTitle>
        <StyledStatus status={folio.status}>
          {t(`folio.status.${folio.status.toLowerCase()}`)}
        </StyledStatus>
      </StyledHeader>

      <StyledSummary>
        <StyledSummaryItem>
          <StyledLabel>{t('folio.summary.balance')}</StyledLabel>
          <StyledValue>
            {new Intl.NumberFormat(undefined, {
              style: 'currency',
              currency: folio.currency
            }).format(folio.balance)}
          </StyledValue>
        </StyledSummaryItem>
        <StyledSummaryItem>
          <StyledLabel>{t('folio.summary.lastModified')}</StyledLabel>
          <StyledValue>
            {new Date(folio.updatedAt).toLocaleDateString(undefined, DATE_FORMAT_OPTIONS)}
          </StyledValue>
        </StyledSummaryItem>
      </StyledSummary>

      <section aria-label={t('folio.charges.title')}>
        <h3>{t('folio.charges.title')}</h3>
        <DataTable
          columns={chargeColumns}
          data={folio.charges || []}
          loading={isLoading}
          rowKey="id"
          onRowClick={onChargeClick}
          stickyHeader
          aria-label={t('folio.charges.table.aria')}
        />
      </section>

      <section aria-label={t('folio.payments.title')}>
        <h3>{t('folio.payments.title')}</h3>
        <DataTable
          columns={paymentColumns}
          data={folio.payments || []}
          loading={isLoading}
          rowKey="id"
          onRowClick={onPaymentClick}
          stickyHeader
          aria-label={t('folio.payments.table.aria')}
        />
      </section>
    </StyledContainer>
  );
});

FolioView.displayName = 'FolioView';

export default FolioView;
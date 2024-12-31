import React, { memo, useCallback } from 'react';
import styled from '@emotion/styled';
import { format, formatDistanceToNow } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { TYPOGRAPHY, SPACING, SHADOWS } from '../../../shared/constants/theme.constants';
import { IconButton } from '../../../shared/components/buttons/IconButton';
import { SEMANTIC_COLORS, NEUTRAL_COLORS, getColorWithOpacity } from '../../../shared/styles/colors';

// Types for service request management
export type ServiceRequestType = 'housekeeping' | 'maintenance' | 'roomService' | 'concierge';
export type RequestUrgency = 'low' | 'medium' | 'high';
export type ServiceStatus = 'pending' | 'inProgress' | 'completed' | 'cancelled';

// Interface for component props
interface ServiceCardProps {
  id: string;
  type: ServiceRequestType;
  description: string;
  urgency: RequestUrgency;
  status: ServiceStatus;
  createdAt: Date;
  estimatedTime: Date | null;
  onCancel: (id: string) => Promise<void>;
}

// Status color mapping with WCAG AA compliance
const getStatusColor = (status: ServiceStatus) => {
  switch (status) {
    case 'pending':
      return { bg: getColorWithOpacity(SEMANTIC_COLORS.warning, 0.1), text: SEMANTIC_COLORS.warning };
    case 'inProgress':
      return { bg: getColorWithOpacity(SEMANTIC_COLORS.info, 0.1), text: SEMANTIC_COLORS.info };
    case 'completed':
      return { bg: getColorWithOpacity(SEMANTIC_COLORS.success, 0.1), text: SEMANTIC_COLORS.success };
    case 'cancelled':
      return { bg: getColorWithOpacity(SEMANTIC_COLORS.error, 0.1), text: SEMANTIC_COLORS.error };
  }
};

// Styled components with accessibility and touch optimization
const StyledCard = styled.article`
  padding: ${SPACING.md}px;
  border-radius: 8px;
  box-shadow: ${SHADOWS.light};
  background-color: ${NEUTRAL_COLORS.white};
  margin-bottom: ${SPACING.sm}px;
  min-height: 120px;
  touch-action: manipulation;
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;

  @media (hover: hover) {
    &:hover {
      box-shadow: ${SHADOWS.medium};
    }
  }
`;

const ServiceHeader = styled.header`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${SPACING.sm}px;
  min-height: 44px;
`;

const ServiceType = styled.h2`
  font-size: ${TYPOGRAPHY.fontSize.h4};
  font-weight: ${TYPOGRAPHY.fontWeight.medium};
  margin: 0;
  color: ${NEUTRAL_COLORS.black};
`;

const StatusIndicator = styled.div<{ $status: ServiceStatus }>`
  padding: 4px 12px;
  border-radius: 4px;
  font-size: ${TYPOGRAPHY.fontSize.small};
  font-weight: ${TYPOGRAPHY.fontWeight.medium};
  background-color: ${props => getStatusColor(props.$status).bg};
  color: ${props => getStatusColor(props.$status).text};
  transition: background-color 0.2s ease;
  min-width: 44px;
  text-align: center;
`;

const Description = styled.p`
  font-size: ${TYPOGRAPHY.fontSize.body};
  color: ${NEUTRAL_COLORS.gray500};
  margin: ${SPACING.xs}px 0;
  line-height: ${TYPOGRAPHY.lineHeight.normal};
`;

const TimeInfo = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: ${SPACING.sm}px;
  font-size: ${TYPOGRAPHY.fontSize.small};
  color: ${NEUTRAL_COLORS.gray500};
`;

/**
 * ServiceCard component for displaying service requests in the mobile interface
 * Implements WCAG 2.1 AA compliance and touch optimization
 */
export const ServiceCard = memo(({
  id,
  type,
  description,
  urgency,
  status,
  createdAt,
  estimatedTime,
  onCancel
}: ServiceCardProps) => {
  const { t } = useTranslation();

  const handleCancel = useCallback(async () => {
    try {
      await onCancel(id);
    } catch (error) {
      console.error('Failed to cancel service request:', error);
      // Error handling would be implemented here
    }
  }, [id, onCancel]);

  return (
    <StyledCard role="article" aria-label={t(`serviceRequest.${type}`)}>
      <ServiceHeader>
        <ServiceType>{t(`serviceRequest.${type}`)}</ServiceType>
        <StatusIndicator $status={status} role="status">
          {t(`serviceStatus.${status}`)}
        </StatusIndicator>
      </ServiceHeader>

      <Description>{description}</Description>

      <TimeInfo>
        <span>
          {t('serviceRequest.created')}: {formatDistanceToNow(createdAt, { addSuffix: true })}
        </span>
        {estimatedTime && (
          <span>
            {t('serviceRequest.estimated')}: {format(estimatedTime, 'HH:mm')}
          </span>
        )}
      </TimeInfo>

      {status === 'pending' && (
        <IconButton
          icon={() => '×'}
          variant="ghost"
          size="medium"
          ariaLabel={t('serviceRequest.cancel')}
          onClick={handleCancel}
          className="cancel-button"
        />
      )}
    </StyledCard>
  );
});

ServiceCard.displayName = 'ServiceCard';

export default ServiceCard;
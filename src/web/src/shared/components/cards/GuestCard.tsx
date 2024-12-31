import React, { memo, useCallback, useRef } from 'react';
import styled from '@emotion/styled';
import { FaUser, FaStar, FaEdit, FaTrash } from 'react-icons/fa'; // v4.0.0
import { Guest } from '../../interfaces/guest.interface';
import { IconButton } from '../buttons/IconButton';
import { 
  PRIMARY_COLORS, 
  NEUTRAL_COLORS, 
  getColorWithOpacity 
} from '../../styles/colors';
import { 
  FONT_FAMILY, 
  FONT_SIZE, 
  FONT_WEIGHT, 
  LINE_HEIGHT 
} from '../../styles/typography';

// Props interface with comprehensive type safety
interface GuestCardProps {
  guest: Guest;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  className?: string;
  isLoading?: boolean;
  error?: Error | null;
}

// Styled components with WCAG 2.1 AA compliance
const Card = styled.article`
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 24px;
  background: ${NEUTRAL_COLORS.white};
  border-radius: 8px;
  border: 1px solid ${NEUTRAL_COLORS.gray300};
  box-shadow: 0 2px 4px ${getColorWithOpacity(NEUTRAL_COLORS.black, 0.1)};
  transition: box-shadow 0.2s ease-in-out;

  &:hover {
    box-shadow: 0 4px 8px ${getColorWithOpacity(NEUTRAL_COLORS.black, 0.15)};
  }

  &:focus-within {
    outline: 2px solid ${PRIMARY_COLORS.main};
    outline-offset: 2px;
  }
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
`;

const Avatar = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  background: ${getColorWithOpacity(PRIMARY_COLORS.main, 0.1)};
  border-radius: 50%;
  color: ${PRIMARY_COLORS.main};
`;

const Info = styled.div`
  flex: 1;
`;

const Name = styled.h3`
  margin: 0;
  font-family: ${FONT_FAMILY.primary};
  font-size: ${FONT_SIZE.h4};
  font-weight: ${FONT_WEIGHT.semibold};
  line-height: ${LINE_HEIGHT.tight};
  color: ${PRIMARY_COLORS.main};
`;

const Email = styled.p`
  margin: 4px 0 0;
  font-family: ${FONT_FAMILY.primary};
  font-size: ${FONT_SIZE.small};
  color: ${NEUTRAL_COLORS.gray500};
  line-height: ${LINE_HEIGHT.normal};
`;

const VipBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: ${getColorWithOpacity(ACCENT_COLORS.main, 0.1)};
  color: ${ACCENT_COLORS.main};
  border-radius: 4px;
  font-size: ${FONT_SIZE.small};
  font-weight: ${FONT_WEIGHT.medium};
`;

const Actions = styled.div`
  display: flex;
  gap: 8px;
  margin-top: 16px;
`;

const LoadingOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: ${getColorWithOpacity(NEUTRAL_COLORS.white, 0.8)};
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
`;

const ErrorMessage = styled.div`
  color: ${SEMANTIC_COLORS.error};
  font-size: ${FONT_SIZE.small};
  margin-top: 8px;
`;

/**
 * GuestCard component for displaying guest information with accessibility features
 * and WCAG 2.1 AA compliance.
 */
export const GuestCard = memo(({
  guest,
  onEdit,
  onDelete,
  className,
  isLoading = false,
  error = null
}: GuestCardProps) => {
  const cardRef = useRef<HTMLElement>(null);

  // Memoized event handlers with keyboard support
  const handleEdit = useCallback((event: React.MouseEvent | React.KeyboardEvent) => {
    event.stopPropagation();
    if ('key' in event && event.key !== 'Enter' && event.key !== ' ') return;
    onEdit(guest.id);
  }, [guest.id, onEdit]);

  const handleDelete = useCallback((event: React.MouseEvent | React.KeyboardEvent) => {
    event.stopPropagation();
    if ('key' in event && event.key !== 'Enter' && event.key !== ' ') return;
    onDelete(guest.id);
  }, [guest.id, onDelete]);

  // Render VIP badge if applicable
  const renderVipBadge = () => {
    if (!guest.vipStatus) return null;
    return (
      <VipBadge>
        <FaStar aria-hidden="true" />
        <span>{guest.vipStatus}</span>
        <span className="sr-only">VIP Status</span>
      </VipBadge>
    );
  };

  return (
    <Card
      ref={cardRef}
      className={className}
      aria-busy={isLoading}
      aria-invalid={!!error}
    >
      <Header>
        <Avatar>
          <FaUser size={24} aria-hidden="true" />
        </Avatar>
        <Info>
          <Name>
            {guest.firstName} {guest.lastName}
            {renderVipBadge()}
          </Name>
          <Email>{guest.email}</Email>
        </Info>
      </Header>

      <Actions>
        <IconButton
          icon={FaEdit}
          variant="secondary"
          size="medium"
          ariaLabel={`Edit ${guest.firstName} ${guest.lastName}'s information`}
          onClick={handleEdit}
          disabled={isLoading}
        />
        <IconButton
          icon={FaTrash}
          variant="ghost"
          size="medium"
          ariaLabel={`Delete ${guest.firstName} ${guest.lastName}'s record`}
          onClick={handleDelete}
          disabled={isLoading}
        />
      </Actions>

      {isLoading && (
        <LoadingOverlay role="status" aria-label="Loading guest information">
          <span className="sr-only">Loading...</span>
        </LoadingOverlay>
      )}

      {error && (
        <ErrorMessage role="alert">
          {error.message}
        </ErrorMessage>
      )}
    </Card>
  );
});

GuestCard.displayName = 'GuestCard';

export type { GuestCardProps };
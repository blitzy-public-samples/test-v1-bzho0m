import React, { memo, useCallback } from 'react';
import styled from '@emotion/styled';
import { FiMenu, FiBell, FiUser } from 'react-icons/fi'; // v4.0.0
import { TYPOGRAPHY, SPACING, SHADOWS } from '../../../shared/constants/theme.constants';
import { IconButton } from '../../../shared/components/buttons/IconButton';
import { useAuth } from '../../../shared/hooks/useAuth';
import { PRIMARY_COLORS, NEUTRAL_COLORS } from '../../../shared/styles/colors';

// Constants
const HEADER_HEIGHT = '56px';
const TOUCH_TARGET_SIZE = '44px';

// Types
interface HeaderProps {
  title: string;
  onMenuClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  isRTL?: boolean;
  loading?: boolean;
}

// Styled components
const HeaderContainer = styled.header<{ $isRTL?: boolean }>`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: ${HEADER_HEIGHT};
  background-color: ${NEUTRAL_COLORS.white};
  box-shadow: ${SHADOWS.light};
  display: flex;
  align-items: center;
  padding: 0 ${SPACING.base}px;
  z-index: 1000;
  direction: ${props => props.$isRTL ? 'rtl' : 'ltr'};
`;

const HeaderTitle = styled.h1`
  font-family: ${TYPOGRAPHY.fontFamily.primary};
  font-size: ${TYPOGRAPHY.fontSize.h4};
  font-weight: ${TYPOGRAPHY.fontWeight.medium};
  color: ${PRIMARY_COLORS.main};
  margin: 0;
  flex: 1;
  text-align: ${props => props.$isRTL ? 'right' : 'left'};
  padding: 0 ${SPACING.sm}px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const ActionGroup = styled.div<{ $isRTL?: boolean }>`
  display: flex;
  gap: ${SPACING.xs}px;
  margin-${props => props.$isRTL ? 'right' : 'left'}: auto;
`;

const LoadingIndicator = styled.div`
  width: 100%;
  height: 2px;
  position: absolute;
  bottom: 0;
  left: 0;
  background: linear-gradient(
    90deg,
    ${PRIMARY_COLORS.main} 0%,
    ${PRIMARY_COLORS.light} 50%,
    ${PRIMARY_COLORS.main} 100%
  );
  background-size: 200% 100%;
  animation: loading 1.5s infinite;

  @keyframes loading {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
`;

/**
 * Mobile header component implementing the hotel management system's mobile interface header
 * with navigation controls, title, notifications, and user actions.
 * Follows design system specifications and accessibility standards.
 */
export const Header = memo(({
  title,
  onMenuClick,
  isRTL = false,
  loading = false
}: HeaderProps) => {
  const { user, notificationCount } = useAuth();

  const handleNotificationClick = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    // Navigate to notifications screen
    window.location.href = '/notifications';
  }, []);

  const handleProfileClick = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    // Navigate to profile screen
    window.location.href = '/profile';
  }, []);

  return (
    <HeaderContainer $isRTL={isRTL}>
      <IconButton
        icon={FiMenu}
        variant="ghost"
        size="medium"
        ariaLabel="Open menu"
        onClick={onMenuClick}
      />
      
      <HeaderTitle $isRTL={isRTL}>
        {title}
      </HeaderTitle>

      <ActionGroup $isRTL={isRTL}>
        <IconButton
          icon={FiBell}
          variant="ghost"
          size="medium"
          ariaLabel={`${notificationCount} notifications`}
          onClick={handleNotificationClick}
          badge={notificationCount}
        />
        
        <IconButton
          icon={FiUser}
          variant="ghost"
          size="medium"
          ariaLabel={`Profile: ${user?.firstName} ${user?.lastName}`}
          onClick={handleProfileClick}
        />
      </ActionGroup>

      {loading && <LoadingIndicator />}
    </HeaderContainer>
  );
});

Header.displayName = 'Header';

export type { HeaderProps };
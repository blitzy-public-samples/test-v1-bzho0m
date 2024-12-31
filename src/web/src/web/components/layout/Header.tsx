import React, { useCallback, useState } from 'react';
import styled from '@emotion/styled';
import { useLocation } from 'react-router-dom';
import { useMediaQuery } from '@mui/material';
import ActionButton from '../../../shared/components/buttons/ActionButton';
import Breadcrumb, { BreadcrumbItem } from '../../../shared/components/navigation/Breadcrumb';
import useAuth from '../../../shared/hooks/useAuth';
import { PRIMARY_COLORS, NEUTRAL_COLORS, SEMANTIC_COLORS } from '../../../shared/styles/colors';
import { FONT_SIZE, FONT_WEIGHT } from '../../../shared/styles/typography';

// Props interface for the Header component
interface HeaderProps {
  title: string;
  className?: string;
  onError?: (error: Error) => void;
}

// Styled components
const HeaderContainer = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  background-color: ${NEUTRAL_COLORS.white};
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  height: 64px;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;

  @media (max-width: 576px) {
    padding: 0 16px;
    height: 56px;
  }
`;

const LogoSection = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
`;

const Logo = styled.h1`
  font-size: ${FONT_SIZE.h4};
  font-weight: ${FONT_WEIGHT.semibold};
  color: ${PRIMARY_COLORS.main};
  margin: 0;
  white-space: nowrap;

  @media (max-width: 576px) {
    font-size: ${FONT_SIZE.body};
  }
`;

const ActionSection = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
`;

const UserProfile = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 8px;
  border-radius: 4px;
  transition: background-color 0.2s ease;

  &:hover {
    background-color: ${NEUTRAL_COLORS.gray100};
  }
`;

const UserAvatar = styled.div`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background-color: ${PRIMARY_COLORS.light};
  color: ${NEUTRAL_COLORS.white};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: ${FONT_SIZE.small};
  font-weight: ${FONT_WEIGHT.medium};
`;

const UserInfo = styled.div`
  @media (max-width: 576px) {
    display: none;
  }
`;

const UserName = styled.span`
  display: block;
  font-size: ${FONT_SIZE.small};
  font-weight: ${FONT_WEIGHT.medium};
  color: ${PRIMARY_COLORS.main};
`;

const UserRole = styled.span`
  display: block;
  font-size: ${FONT_SIZE.caption};
  color: ${NEUTRAL_COLORS.gray500};
`;

/**
 * Header component for the hotel management system
 * Implements responsive design and accessibility standards
 */
export const Header: React.FC<HeaderProps> = ({ title, className, onError }) => {
  const { user, logout, loading } = useAuth();
  const location = useLocation();
  const isMobile = useMediaQuery('(max-width: 576px)');
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Generate breadcrumb items based on current location
  const getBreadcrumbItems = useCallback((): BreadcrumbItem[] => {
    const paths = location.pathname.split('/').filter(Boolean);
    return [
      { label: 'Dashboard', path: '/', isActive: paths.length === 0 },
      ...paths.map((path, index) => ({
        label: path.charAt(0).toUpperCase() + path.slice(1),
        path: `/${paths.slice(0, index + 1).join('/')}`,
        isActive: index === paths.length - 1,
      })),
    ];
  }, [location.pathname]);

  // Handle quick actions with loading states
  const handleQuickAction = useCallback(async (action: string) => {
    try {
      switch (action) {
        case 'logout':
          await logout();
          break;
        default:
          break;
      }
    } catch (error) {
      onError?.(error as Error);
    }
  }, [logout, onError]);

  // Get user initials for avatar
  const getUserInitials = useCallback((): string => {
    if (!user) return '';
    return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`;
  }, [user]);

  return (
    <HeaderContainer className={className} role="banner">
      <LogoSection>
        <Logo>Hotel Management System</Logo>
        {!isMobile && <Breadcrumb items={getBreadcrumbItems()} />}
      </LogoSection>

      <ActionSection>
        <ActionButton
          variant="secondary"
          size="small"
          onClick={() => handleQuickAction('newBooking')}
          ariaLabel="Create new booking"
        >
          + New Booking
        </ActionButton>

        {user && (
          <UserProfile
            role="button"
            aria-haspopup="true"
            aria-expanded={isMenuOpen}
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            <UserAvatar aria-hidden="true">{getUserInitials()}</UserAvatar>
            <UserInfo>
              <UserName>{`${user.firstName} ${user.lastName}`}</UserName>
              <UserRole>{user.roles[0]}</UserRole>
            </UserInfo>
          </UserProfile>
        )}

        <ActionButton
          variant="secondary"
          size="small"
          onClick={() => handleQuickAction('logout')}
          loading={loading}
          ariaLabel="Logout"
        >
          Logout
        </ActionButton>
      </ActionSection>
    </HeaderContainer>
  );
};

export default Header;
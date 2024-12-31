import React, { useCallback, useMemo } from 'react';
import styled from '@emotion/styled';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  MdDashboard,
  MdHotel,
  MdPeople,
  MdCalendarToday,
  MdPayment,
  MdSettings,
} from 'react-icons/md'; // v4.11.0
import { PRIMARY_COLORS, NEUTRAL_COLORS } from '../../../shared/styles/colors';

// Interfaces
interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
  className?: string;
  ariaLabel?: string;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  path: string;
  ariaLabel: string;
}

// Styled Components
const SidebarContainer = styled.aside<{ isCollapsed: boolean }>`
  position: fixed;
  left: 0;
  top: 0;
  height: 100vh;
  background: ${NEUTRAL_COLORS.white};
  border-right: 1px solid ${NEUTRAL_COLORS.gray200};
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  width: ${({ isCollapsed }) => (isCollapsed ? '64px' : '240px')};
  z-index: 1000;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  overflow-x: hidden;
  overflow-y: auto;

  @media (max-width: 768px) {
    transform: ${({ isCollapsed }) =>
      isCollapsed ? 'translateX(-100%)' : 'translateX(0)'};
    width: 240px;
  }

  &:focus-visible {
    outline: 2px solid ${PRIMARY_COLORS.main};
    outline-offset: -2px;
  }
`;

const NavList = styled.nav`
  display: flex;
  flex-direction: column;
  padding: 16px 0;
  gap: 8px;
`;

const NavItemContainer = styled.div<{ isActive: boolean }>`
  display: flex;
  align-items: center;
  padding: 12px 24px;
  min-height: 48px;
  cursor: pointer;
  transition: all 0.2s ease;
  color: ${({ isActive }) =>
    isActive ? NEUTRAL_COLORS.white : PRIMARY_COLORS.main};
  background-color: ${({ isActive }) =>
    isActive ? PRIMARY_COLORS.main : 'transparent'};
  position: relative;
  gap: 16px;

  &:hover {
    background-color: ${({ isActive }) =>
      isActive ? PRIMARY_COLORS.main : PRIMARY_COLORS.light};
    color: ${NEUTRAL_COLORS.white};
  }

  &:focus-visible {
    outline: 2px solid ${PRIMARY_COLORS.main};
    outline-offset: -2px;
  }

  ${({ isActive }) =>
    isActive &&
    `
    &::before {
      content: '';
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 4px;
      background-color: ${NEUTRAL_COLORS.white};
    }
  `}
`;

const IconWrapper = styled.span`
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  font-size: 24px;
`;

const Label = styled.span<{ isCollapsed: boolean }>`
  white-space: nowrap;
  opacity: ${({ isCollapsed }) => (isCollapsed ? 0 : 1)};
  transition: opacity 0.2s ease;
  font-family: 'Roboto', sans-serif;
  font-size: 14px;
  font-weight: 500;
`;

// Constants
const NAV_ITEMS: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: MdDashboard,
    path: '/dashboard',
    ariaLabel: 'Navigate to Dashboard',
  },
  {
    id: 'rooms',
    label: 'Rooms',
    icon: MdHotel,
    path: '/rooms',
    ariaLabel: 'Navigate to Rooms Management',
  },
  {
    id: 'guests',
    label: 'Guests',
    icon: MdPeople,
    path: '/guests',
    ariaLabel: 'Navigate to Guest Management',
  },
  {
    id: 'reservations',
    label: 'Reservations',
    icon: MdCalendarToday,
    path: '/reservations',
    ariaLabel: 'Navigate to Reservations',
  },
  {
    id: 'billing',
    label: 'Billing',
    icon: MdPayment,
    path: '/billing',
    ariaLabel: 'Navigate to Billing',
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: MdSettings,
    path: '/settings',
    ariaLabel: 'Navigate to Settings',
  },
];

export const Sidebar: React.FC<SidebarProps> = ({
  isCollapsed,
  onToggle,
  className,
  ariaLabel = 'Main navigation',
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleNavigation = useCallback(
    (path: string, event: React.KeyboardEvent | React.MouseEvent) => {
      // Handle both click and keyboard navigation
      if (
        event.type === 'click' ||
        (event as React.KeyboardEvent).key === 'Enter' ||
        (event as React.KeyboardEvent).key === ' '
      ) {
        event.preventDefault();
        navigate(path);

        // Toggle sidebar on mobile after navigation
        if (window.innerWidth <= 768 && !isCollapsed) {
          onToggle();
        }

        // Announce route change for screen readers
        const announcement = document.createElement('div');
        announcement.setAttribute('role', 'status');
        announcement.setAttribute('aria-live', 'polite');
        announcement.textContent = `Navigated to ${path}`;
        document.body.appendChild(announcement);
        setTimeout(() => document.body.removeChild(announcement), 1000);
      }
    },
    [navigate, isCollapsed, onToggle]
  );

  const renderNavItems = useMemo(
    () =>
      NAV_ITEMS.map((item) => {
        const isActive = location.pathname === item.path;
        const Icon = item.icon;

        return (
          <NavItemContainer
            key={item.id}
            isActive={isActive}
            onClick={(e) => handleNavigation(item.path, e)}
            onKeyDown={(e) => handleNavigation(item.path, e)}
            role="button"
            tabIndex={0}
            aria-label={item.ariaLabel}
            aria-current={isActive ? 'page' : undefined}
          >
            <IconWrapper>
              <Icon aria-hidden="true" />
            </IconWrapper>
            <Label isCollapsed={isCollapsed}>{item.label}</Label>
          </NavItemContainer>
        );
      }),
    [location.pathname, isCollapsed, handleNavigation]
  );

  return (
    <SidebarContainer
      isCollapsed={isCollapsed}
      className={className}
      role="navigation"
      aria-label={ariaLabel}
    >
      <NavList>{renderNavItems}</NavList>
    </SidebarContainer>
  );
};

export default React.memo(Sidebar);
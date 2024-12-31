import React, { useCallback } from 'react';
import styled from '@emotion/styled';
import { useNavigate } from 'react-router-dom';
import type { IconType } from 'react-icons';
import { PRIMARY_COLORS, NEUTRAL_COLORS } from '../../../shared/styles/colors';
import { FONT_SIZE } from '../../../shared/styles/typography';

// Interface for navigation items with accessibility support
interface NavItem {
  path: string;
  label: string;
  icon: IconType;
  badge?: number;
  ariaLabel?: string;
}

// Props interface for the BottomNav component
interface BottomNavProps {
  items: NavItem[];
  activeRoute: string;
  className?: string;
}

// Styled components with WCAG compliance
const NavContainer = styled.nav`
  position: fixed;
  bottom: env(safe-area-inset-bottom, 0);
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-around;
  align-items: center;
  height: 64px;
  background: ${NEUTRAL_COLORS.white};
  border-top: 1px solid ${NEUTRAL_COLORS.gray200};
  padding: 8px 16px;
  z-index: 1000;
  box-shadow: 0 -2px 4px rgba(0,0,0,0.1);
`;

const NavButton = styled.button<{ isActive: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 64px;
  height: 100%;
  padding: 4px;
  background: none;
  border: none;
  color: ${props => props.isActive ? PRIMARY_COLORS.main : NEUTRAL_COLORS.gray500};
  cursor: pointer;
  position: relative;
  transition: color 0.2s ease;

  &:focus-visible {
    outline: 2px solid ${PRIMARY_COLORS.main};
    outline-offset: 2px;
    border-radius: 4px;
  }

  /* Touch target size compliance */
  @media (pointer: coarse) {
    &::before {
      content: '';
      position: absolute;
      top: -8px;
      left: -8px;
      right: -8px;
      bottom: -8px;
    }
  }
`;

const NavLabel = styled.span`
  font-size: ${FONT_SIZE.small};
  margin-top: 4px;
  text-align: center;
`;

const Badge = styled.span`
  position: absolute;
  top: 4px;
  right: 4px;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  background-color: ${PRIMARY_COLORS.main};
  color: ${NEUTRAL_COLORS.white};
  border-radius: 9px;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const IconWrapper = styled.span`
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
`;

export const BottomNav: React.FC<BottomNavProps> = ({ 
  items, 
  activeRoute, 
  className 
}) => {
  const navigate = useNavigate();

  const handleNavigation = useCallback((
    path: string, 
    event: React.MouseEvent<HTMLButtonElement>
  ) => {
    event.preventDefault();
    
    // Track navigation event
    try {
      // Analytics tracking would go here
      console.debug('Navigation event:', path);
    } catch (error) {
      console.error('Analytics error:', error);
    }

    navigate(path);
  }, [navigate]);

  return (
    <NavContainer 
      role="navigation" 
      aria-label="Main mobile navigation"
      className={className}
    >
      {items.map((item) => {
        const isActive = activeRoute === item.path;
        const Icon = item.icon;

        return (
          <NavButton
            key={item.path}
            onClick={(e) => handleNavigation(item.path, e)}
            aria-label={item.ariaLabel || item.label}
            aria-current={isActive ? 'page' : undefined}
            isActive={isActive}
          >
            <IconWrapper aria-hidden="true">
              <Icon />
            </IconWrapper>
            <NavLabel>{item.label}</NavLabel>
            {item.badge !== undefined && item.badge > 0 && (
              <Badge 
                role="status" 
                aria-label={`${item.badge} notifications`}
              >
                {item.badge > 99 ? '99+' : item.badge}
              </Badge>
            )}
          </NavButton>
        );
      })}
    </NavContainer>
  );
};

export default BottomNav;
import React, { useCallback, useRef, KeyboardEvent } from 'react';
import styled from '@emotion/styled';
import { PRIMARY_COLORS, NEUTRAL_COLORS } from '../../../shared/styles/colors';
import { FONT_SIZE, FONT_WEIGHT } from '../../../shared/styles/typography';

// Interfaces
export interface TabItem {
  id: string;
  label: string;
  badge?: number;
  disabled?: boolean;
}

export interface TabBarProps {
  tabs: TabItem[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  className?: string;
}

// Styled Components
const TabContainer = styled.div`
  display: flex;
  align-items: center;
  border-bottom: 1px solid ${NEUTRAL_COLORS.gray200};
  margin-bottom: 24px;
  overflow-x: auto;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
  position: relative;

  /* Hide scrollbar */
  &::-webkit-scrollbar {
    display: none;
  }

  /* Mobile responsiveness */
  @media (max-width: 576px) {
    margin-bottom: 16px;
  }
`;

const Tab = styled.button<{ isActive: boolean; disabled?: boolean }>`
  padding: 12px 24px;
  font-size: ${FONT_SIZE.body};
  font-weight: ${FONT_WEIGHT.medium};
  color: ${props => props.isActive ? PRIMARY_COLORS.main : NEUTRAL_COLORS.gray500};
  border: none;
  background: none;
  cursor: ${props => props.disabled ? 'not-allowed' : 'pointer'};
  position: relative;
  transition: all 0.2s ease;
  opacity: ${props => props.disabled ? 0.5 : 1};
  min-width: 44px; /* Touch target size */
  min-height: 44px;
  touch-action: manipulation;

  /* Accessibility focus styles */
  &:focus-visible {
    outline: 2px solid ${PRIMARY_COLORS.main};
    outline-offset: -2px;
    border-radius: 4px;
  }

  /* Active indicator */
  &::after {
    content: '';
    position: absolute;
    bottom: -1px;
    left: 0;
    width: 100%;
    height: 2px;
    background-color: ${props => props.isActive ? PRIMARY_COLORS.main : 'transparent'};
    transition: background-color 0.2s ease;
  }

  /* Hover state */
  &:hover:not(:disabled) {
    color: ${PRIMARY_COLORS.main};
    background-color: ${NEUTRAL_COLORS.gray100};
  }

  /* Mobile responsiveness */
  @media (max-width: 576px) {
    padding: 8px 16px;
    font-size: ${FONT_SIZE.small};
  }
`;

const Badge = styled.span`
  position: absolute;
  top: 4px;
  right: 4px;
  background: ${PRIMARY_COLORS.main};
  color: white;
  border-radius: 12px;
  padding: 2px 6px;
  font-size: 12px;
  line-height: 1;
  font-weight: ${FONT_WEIGHT.medium};
  min-width: 20px;
  text-align: center;
`;

export const TabBar: React.FC<TabBarProps> = React.memo(({ 
  tabs, 
  activeTab, 
  onTabChange, 
  className 
}) => {
  const tabsRef = useRef<(HTMLButtonElement | null)[]>([]);

  const handleTabClick = useCallback((tabId: string, disabled?: boolean) => {
    if (!disabled) {
      onTabChange(tabId);
    }
  }, [onTabChange]);

  const handleKeyboardNavigation = useCallback((
    event: KeyboardEvent<HTMLButtonElement>,
    currentIndex: number
  ) => {
    const validTabs = tabs.filter(tab => !tab.disabled);
    const currentValidIndex = validTabs.findIndex(tab => tab.id === tabs[currentIndex].id);

    let newIndex: number;

    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault();
        newIndex = currentValidIndex > 0 ? currentValidIndex - 1 : validTabs.length - 1;
        break;
      case 'ArrowRight':
        event.preventDefault();
        newIndex = currentValidIndex < validTabs.length - 1 ? currentValidIndex + 1 : 0;
        break;
      case 'Home':
        event.preventDefault();
        newIndex = 0;
        break;
      case 'End':
        event.preventDefault();
        newIndex = validTabs.length - 1;
        break;
      default:
        return;
    }

    const newTab = validTabs[newIndex];
    if (newTab) {
      onTabChange(newTab.id);
      tabsRef.current[tabs.findIndex(tab => tab.id === newTab.id)]?.focus();
    }
  }, [tabs, onTabChange]);

  return (
    <TabContainer
      role="tablist"
      aria-orientation="horizontal"
      className={className}
    >
      {tabs.map((tab, index) => (
        <Tab
          key={tab.id}
          ref={el => tabsRef.current[index] = el}
          role="tab"
          aria-selected={activeTab === tab.id}
          aria-disabled={tab.disabled}
          aria-controls={`panel-${tab.id}`}
          tabIndex={activeTab === tab.id ? 0 : -1}
          isActive={activeTab === tab.id}
          disabled={tab.disabled}
          onClick={() => handleTabClick(tab.id, tab.disabled)}
          onKeyDown={(e) => handleKeyboardNavigation(e, index)}
        >
          {tab.label}
          {tab.badge !== undefined && tab.badge > 0 && (
            <Badge role="status" aria-label={`${tab.badge} items`}>
              {tab.badge > 99 ? '99+' : tab.badge}
            </Badge>
          )}
        </Tab>
      ))}
    </TabContainer>
  );
});

TabBar.displayName = 'TabBar';
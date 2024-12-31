import React, { memo, useCallback, useRef } from 'react';
import styled from '@emotion/styled';
import type { IconType } from 'react-icons';
import { PRIMARY_COLORS, NEUTRAL_COLORS } from '../../styles/colors';
import { FONT_SIZE } from '../../styles/typography';

// Types for component props
type IconButtonVariant = 'primary' | 'secondary' | 'ghost';
type IconButtonSize = 'small' | 'medium' | 'large';

interface IconButtonProps {
  /** Icon component to render */
  icon: IconType;
  /** Button variant determining visual style */
  variant?: IconButtonVariant;
  /** Button size affecting dimensions and icon scale */
  size?: IconButtonSize;
  /** Accessible label for screen readers */
  ariaLabel: string;
  /** Disabled state */
  disabled?: boolean;
  /** Click handler function */
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  /** Additional class name */
  className?: string;
}

// Size mappings for button dimensions
const BUTTON_SIZES = {
  small: {
    padding: '8px',
    iconSize: FONT_SIZE.small,
    minSize: '32px'
  },
  medium: {
    padding: '12px',
    iconSize: FONT_SIZE.body,
    minSize: '40px'
  },
  large: {
    padding: '16px',
    iconSize: '24px',
    minSize: '48px'
  }
} as const;

// Styled button base with accessibility and interaction enhancements
const StyledButton = styled.button<{
  $variant: IconButtonVariant;
  $size: IconButtonSize;
  $disabled: boolean;
}>`
  /* Base styles */
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 4px;
  cursor: ${props => props.$disabled ? 'not-allowed' : 'pointer'};
  transition: all 0.2s ease-in-out;
  outline: none;
  
  /* Size-specific styles */
  padding: ${props => BUTTON_SIZES[props.$size].padding};
  min-width: ${props => BUTTON_SIZES[props.$size].minSize};
  min-height: ${props => BUTTON_SIZES[props.$size].minSize};

  /* Variant-specific styles */
  ${props => {
    switch (props.$variant) {
      case 'primary':
        return `
          background-color: ${PRIMARY_COLORS.main};
          color: ${NEUTRAL_COLORS.white};
          
          &:hover:not(:disabled) {
            background-color: ${PRIMARY_COLORS.light};
          }
          
          &:active:not(:disabled) {
            background-color: ${PRIMARY_COLORS.main};
          }
        `;
      case 'secondary':
        return `
          background-color: transparent;
          color: ${PRIMARY_COLORS.main};
          border: 2px solid ${PRIMARY_COLORS.main};
          
          &:hover:not(:disabled) {
            background-color: ${PRIMARY_COLORS.light}1A;
          }
          
          &:active:not(:disabled) {
            background-color: ${PRIMARY_COLORS.light}33;
          }
        `;
      case 'ghost':
        return `
          background-color: transparent;
          color: ${PRIMARY_COLORS.main};
          
          &:hover:not(:disabled) {
            background-color: ${PRIMARY_COLORS.light}1A;
          }
          
          &:active:not(:disabled) {
            background-color: ${PRIMARY_COLORS.light}33;
          }
        `;
    }
  }}

  /* Disabled state */
  ${props => props.$disabled && `
    opacity: 0.5;
    background-color: ${NEUTRAL_COLORS.gray400};
    color: ${NEUTRAL_COLORS.white};
    border-color: ${NEUTRAL_COLORS.gray400};
  `}

  /* Focus visible styles for accessibility */
  &:focus-visible {
    outline: 2px solid ${PRIMARY_COLORS.main};
    outline-offset: 2px;
  }

  /* Icon styles */
  svg {
    width: ${props => BUTTON_SIZES[props.$size].iconSize};
    height: ${props => BUTTON_SIZES[props.$size].iconSize};
  }

  /* Touch target size for mobile */
  @media (pointer: coarse) {
    min-width: 44px;
    min-height: 44px;
  }
`;

/**
 * IconButton component implementing the design system's icon button specifications
 * with full WCAG 2.1 AA compliance and touch optimization.
 */
export const IconButton = memo(({
  icon: Icon,
  variant = 'primary',
  size = 'medium',
  ariaLabel,
  disabled = false,
  onClick,
  className
}: IconButtonProps) => {
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Memoized click handler
  const handleClick = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) {
      event.preventDefault();
      return;
    }
    
    // Provide touch feedback
    if (buttonRef.current) {
      buttonRef.current.blur();
    }
    
    onClick?.(event);
  }, [disabled, onClick]);

  return (
    <StyledButton
      ref={buttonRef}
      $variant={variant}
      $size={size}
      $disabled={disabled}
      disabled={disabled}
      aria-label={ariaLabel}
      onClick={handleClick}
      className={className}
      type="button"
    >
      <Icon />
    </StyledButton>
  );
});

IconButton.displayName = 'IconButton';

// Type exports for consuming components
export type { IconButtonProps, IconButtonVariant, IconButtonSize };
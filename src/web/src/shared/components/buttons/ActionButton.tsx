import React, { memo, useCallback, useState } from 'react';
import styled from '@emotion/styled';
import { PRIMARY_COLORS, SECONDARY_COLORS } from '../../styles/colors';
import { FONT_SIZE } from '../../styles/typography';

// Button size configurations with WCAG-compliant touch targets
const BUTTON_SIZES = {
  small: {
    padding: '8px 16px',
    fontSize: FONT_SIZE.small,
    minHeight: '44px', // WCAG touch target size
  },
  medium: {
    padding: '12px 24px',
    fontSize: FONT_SIZE.body,
    minHeight: '44px',
  },
  large: {
    padding: '16px 32px',
    fontSize: FONT_SIZE.body,
    minHeight: '48px',
  },
} as const;

// Type definitions
export interface ActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
  size?: keyof typeof BUTTON_SIZES;
  fullWidth?: boolean;
  loading?: boolean;
  ariaLabel?: string;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void | Promise<void>;
}

// Keyframe animation for loading spinner
const spinnerKeyframes = `
  @keyframes spinner {
    to {
      transform: rotate(360deg);
    }
  }
`;

// Styled button component with comprehensive styling and states
const StyledButton = styled.button<ActionButtonProps>`
  ${spinnerKeyframes}
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 4px;
  cursor: ${({ disabled, loading }) => (disabled || loading ? 'not-allowed' : 'pointer')};
  font-family: inherit;
  font-weight: 500;
  text-align: center;
  text-decoration: none;
  transition: all 0.2s ease-in-out;
  outline: none;
  white-space: nowrap;
  user-select: none;
  
  /* Size styles */
  ${({ size = 'medium' }) => {
    const sizeConfig = BUTTON_SIZES[size];
    return `
      padding: ${sizeConfig.padding};
      font-size: ${sizeConfig.fontSize};
      min-height: ${sizeConfig.minHeight};
    `;
  }}
  
  /* Variant styles */
  ${({ variant = 'primary' }) => {
    const colors = variant === 'primary' ? PRIMARY_COLORS : SECONDARY_COLORS;
    return `
      background-color: ${colors.main};
      color: ${variant === 'primary' ? '#FFFFFF' : '#000000'};
      
      &:hover:not(:disabled) {
        background-color: ${colors.light};
      }
      
      &:active:not(:disabled) {
        background-color: ${colors.dark};
      }
    `;
  }}
  
  /* Width styles */
  ${({ fullWidth }) => fullWidth && 'width: 100%;'}
  
  /* Disabled state */
  ${({ disabled, loading }) =>
    (disabled || loading) &&
    `
    opacity: 0.6;
    pointer-events: none;
  `}
  
  /* Loading state */
  ${({ loading }) =>
    loading &&
    `
    color: transparent;
    
    &::after {
      content: '';
      position: absolute;
      width: 16px;
      height: 16px;
      border: 2px solid currentColor;
      border-right-color: transparent;
      border-radius: 50%;
      animation: spinner 0.75s linear infinite;
    }
  `}
  
  /* Focus visible styles for accessibility */
  &:focus-visible {
    outline: 2px solid ${PRIMARY_COLORS.main};
    outline-offset: 2px;
    box-shadow: 0 0 0 4px rgba(44, 62, 80, 0.2);
  }
  
  /* Touch device optimizations */
  @media (hover: none) {
    &:hover {
      background-color: ${({ variant = 'primary' }) =>
        variant === 'primary' ? PRIMARY_COLORS.main : SECONDARY_COLORS.main};
    }
  }
  
  /* RTL support */
  [dir='rtl'] & {
    transform: scaleX(-1);
  }
`;

/**
 * ActionButton component implementing the hotel management system's design system specifications.
 * Supports multiple variants, sizes, states, and loading behaviors while maintaining WCAG 2.1 AA compliance.
 */
export const ActionButton = memo<ActionButtonProps>(({
  variant = 'primary',
  size = 'medium',
  fullWidth = false,
  disabled = false,
  loading = false,
  ariaLabel,
  onClick,
  children,
  ...props
}) => {
  const [isLoading, setIsLoading] = useState(loading);

  const handleClick = useCallback(
    async (event: React.MouseEvent<HTMLButtonElement>) => {
      if (disabled || isLoading || !onClick) return;

      try {
        setIsLoading(true);
        await onClick(event);
      } catch (error) {
        console.error('Button click handler error:', error);
      } finally {
        setIsLoading(false);
      }
    },
    [disabled, isLoading, onClick]
  );

  return (
    <StyledButton
      variant={variant}
      size={size}
      fullWidth={fullWidth}
      disabled={disabled}
      loading={isLoading}
      onClick={handleClick}
      aria-label={ariaLabel}
      aria-disabled={disabled || isLoading}
      aria-busy={isLoading}
      role="button"
      {...props}
    >
      {children}
    </StyledButton>
  );
});

ActionButton.displayName = 'ActionButton';

export default ActionButton;
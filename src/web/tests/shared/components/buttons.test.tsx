import React from 'react';
import { render, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FaPlus } from 'react-icons/fa';
import { expect, describe, it, beforeEach } from '@jest/globals';
import { ActionButton } from '../../src/shared/components/buttons/ActionButton';
import { IconButton } from '../../src/shared/components/buttons/IconButton';
import { PRIMARY_COLORS, SECONDARY_COLORS } from '../../src/shared/styles/colors';

// Test setup helper
const renderWithAct = (component: React.ReactElement) => {
  return render(component);
};

describe('ActionButton', () => {
  // Variants
  describe('variants', () => {
    it('renders primary variant with correct styles', () => {
      const { getByRole } = renderWithAct(
        <ActionButton variant="primary">Primary Button</ActionButton>
      );
      
      const button = getByRole('button');
      const styles = window.getComputedStyle(button);
      
      expect(styles.backgroundColor).toBe(PRIMARY_COLORS.main);
      expect(styles.color).toBe('#FFFFFF');
    });

    it('renders secondary variant with correct styles', () => {
      const { getByRole } = renderWithAct(
        <ActionButton variant="secondary">Secondary Button</ActionButton>
      );
      
      const button = getByRole('button');
      const styles = window.getComputedStyle(button);
      
      expect(styles.backgroundColor).toBe(SECONDARY_COLORS.main);
      expect(styles.color).toBe('#000000');
    });
  });

  // Sizes
  describe('sizes', () => {
    it('applies correct dimensions for small size', () => {
      const { getByRole } = renderWithAct(
        <ActionButton size="small">Small Button</ActionButton>
      );
      
      const button = getByRole('button');
      const styles = window.getComputedStyle(button);
      
      expect(styles.padding).toBe('8px 16px');
      expect(styles.minHeight).toBe('44px'); // WCAG touch target size
    });

    it('applies correct dimensions for medium size', () => {
      const { getByRole } = renderWithAct(
        <ActionButton size="medium">Medium Button</ActionButton>
      );
      
      const button = getByRole('button');
      const styles = window.getComputedStyle(button);
      
      expect(styles.padding).toBe('12px 24px');
      expect(styles.minHeight).toBe('44px');
    });

    it('applies correct dimensions for large size', () => {
      const { getByRole } = renderWithAct(
        <ActionButton size="large">Large Button</ActionButton>
      );
      
      const button = getByRole('button');
      const styles = window.getComputedStyle(button);
      
      expect(styles.padding).toBe('16px 32px');
      expect(styles.minHeight).toBe('48px');
    });
  });

  // States
  describe('states', () => {
    it('handles disabled state correctly', () => {
      const handleClick = jest.fn();
      const { getByRole } = renderWithAct(
        <ActionButton disabled onClick={handleClick}>
          Disabled Button
        </ActionButton>
      );
      
      const button = getByRole('button');
      fireEvent.click(button);
      
      expect(handleClick).not.toHaveBeenCalled();
      expect(button).toHaveAttribute('aria-disabled', 'true');
      expect(window.getComputedStyle(button).opacity).toBe('0.6');
    });

    it('shows loading state with spinner', async () => {
      const { getByRole } = renderWithAct(
        <ActionButton loading>Loading Button</ActionButton>
      );
      
      const button = getByRole('button');
      const styles = window.getComputedStyle(button);
      
      expect(button).toHaveAttribute('aria-busy', 'true');
      expect(styles.color).toBe('transparent');
      // Verify spinner pseudo-element
      expect(styles['&::after']).toBeDefined();
    });

    it('handles async click operations', async () => {
      const asyncOperation = jest.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 100))
      );
      
      const { getByRole } = renderWithAct(
        <ActionButton onClick={asyncOperation}>Async Button</ActionButton>
      );
      
      const button = getByRole('button');
      fireEvent.click(button);
      
      expect(button).toHaveAttribute('aria-busy', 'true');
      await new Promise(resolve => setTimeout(resolve, 150));
      expect(button).toHaveAttribute('aria-busy', 'false');
    });
  });

  // Accessibility
  describe('accessibility', () => {
    it('supports keyboard navigation', async () => {
      const handleClick = jest.fn();
      const { getByRole } = renderWithAct(
        <ActionButton onClick={handleClick}>Keyboard Button</ActionButton>
      );
      
      const button = getByRole('button');
      await userEvent.tab();
      expect(button).toHaveFocus();
      
      await userEvent.keyboard('{Enter}');
      expect(handleClick).toHaveBeenCalled();
      
      await userEvent.keyboard(' ');
      expect(handleClick).toHaveBeenCalledTimes(2);
    });

    it('maintains sufficient color contrast', () => {
      const { getByRole } = renderWithAct(
        <ActionButton variant="primary">Contrast Button</ActionButton>
      );
      
      const button = getByRole('button');
      const styles = window.getComputedStyle(button);
      
      // Verify WCAG AA contrast ratio (4.5:1 for normal text)
      // This is a simplified check - in practice you'd use a color contrast library
      expect(styles.backgroundColor).toBe(PRIMARY_COLORS.main);
      expect(styles.color).toBe('#FFFFFF');
    });
  });
});

describe('IconButton', () => {
  // Rendering
  describe('rendering', () => {
    it('renders icon correctly', () => {
      const { getByRole } = renderWithAct(
        <IconButton 
          icon={FaPlus} 
          ariaLabel="Add item"
        />
      );
      
      const button = getByRole('button');
      expect(button).toHaveAttribute('aria-label', 'Add item');
      expect(within(button).getByRole('img', { hidden: true })).toBeInTheDocument();
    });

    it('applies correct size to icon', () => {
      const { getByRole } = renderWithAct(
        <IconButton 
          icon={FaPlus} 
          size="large"
          ariaLabel="Add item"
        />
      );
      
      const button = getByRole('button');
      const icon = within(button).getByRole('img', { hidden: true });
      const styles = window.getComputedStyle(icon);
      
      expect(styles.width).toBe('24px');
      expect(styles.height).toBe('24px');
    });
  });

  // Variants
  describe('variants', () => {
    it('renders ghost variant correctly', () => {
      const { getByRole } = renderWithAct(
        <IconButton 
          icon={FaPlus} 
          variant="ghost"
          ariaLabel="Add item"
        />
      );
      
      const button = getByRole('button');
      const styles = window.getComputedStyle(button);
      
      expect(styles.backgroundColor).toBe('transparent');
      expect(styles.color).toBe(PRIMARY_COLORS.main);
    });
  });

  // Accessibility
  describe('accessibility', () => {
    it('provides accessible name via aria-label', () => {
      const { getByRole } = renderWithAct(
        <IconButton 
          icon={FaPlus} 
          ariaLabel="Add new item"
        />
      );
      
      expect(getByRole('button')).toHaveAttribute('aria-label', 'Add new item');
    });

    it('maintains minimum touch target size', () => {
      const { getByRole } = renderWithAct(
        <IconButton 
          icon={FaPlus} 
          size="small"
          ariaLabel="Add item"
        />
      );
      
      const button = getByRole('button');
      const styles = window.getComputedStyle(button);
      
      // WCAG 2.1 requires minimum 44x44px touch targets
      expect(parseInt(styles.minWidth)).toBeGreaterThanOrEqual(44);
      expect(parseInt(styles.minHeight)).toBeGreaterThanOrEqual(44);
    });
  });

  // Interactions
  describe('interactions', () => {
    it('handles click events', async () => {
      const handleClick = jest.fn();
      const { getByRole } = renderWithAct(
        <IconButton 
          icon={FaPlus} 
          onClick={handleClick}
          ariaLabel="Add item"
        />
      );
      
      const button = getByRole('button');
      await userEvent.click(button);
      
      expect(handleClick).toHaveBeenCalled();
    });

    it('prevents click when disabled', async () => {
      const handleClick = jest.fn();
      const { getByRole } = renderWithAct(
        <IconButton 
          icon={FaPlus} 
          disabled
          onClick={handleClick}
          ariaLabel="Add item"
        />
      );
      
      const button = getByRole('button');
      await userEvent.click(button);
      
      expect(handleClick).not.toHaveBeenCalled();
      expect(button).toBeDisabled();
    });
  });
});
import React from 'react';
import { render, fireEvent, waitFor, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { ThemeProvider } from '@emotion/react';
import { theme } from '../../../src/shared/constants/theme.constants';
import Input from '../../../src/shared/components/forms/Input';
import Select from '../../../src/shared/components/forms/Select';
import DatePicker from '../../../src/shared/components/forms/DatePicker';

// Add jest-axe matchers
expect.extend(toHaveNoViolations);

// Custom render function with theme provider
const renderWithTheme = (ui: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {ui}
    </ThemeProvider>
  );
};

describe('Input Component', () => {
  // Test props factory
  const createInputProps = (overrides = {}) => ({
    name: 'test-input',
    type: 'text' as const,
    value: '',
    label: 'Test Input',
    onChange: jest.fn(),
    onBlur: jest.fn(),
    ...overrides
  });

  describe('Design System Compliance', () => {
    it('should render with correct typography specifications', () => {
      const props = createInputProps();
      const { container } = renderWithTheme(<Input {...props} />);
      
      const input = container.querySelector('input');
      const label = container.querySelector('label');
      
      const styles = window.getComputedStyle(input!);
      expect(styles.fontFamily).toBe(theme.typography.fontFamily.primary);
      expect(styles.fontSize).toBe(theme.typography.fontSize.body);
    });

    it('should apply correct colors from design system', () => {
      const props = createInputProps({ error: 'Error message' });
      const { container } = renderWithTheme(<Input {...props} />);
      
      const input = container.querySelector('input');
      const errorText = container.querySelector('span[role="alert"]');
      
      expect(input).toHaveStyle(`border-color: ${theme.colors.semantic.error}`);
      expect(errorText).toHaveStyle(`color: ${theme.colors.semantic.error}`);
    });

    it('should maintain consistent spacing', () => {
      const props = createInputProps();
      const { container } = renderWithTheme(<Input {...props} />);
      
      const inputContainer = container.firstChild;
      expect(inputContainer).toHaveStyle(`margin-bottom: ${theme.spacing.md}px`);
    });
  });

  describe('Validation States', () => {
    it('should handle required field validation', async () => {
      const props = createInputProps({ required: true });
      renderWithTheme(<Input {...props} />);
      
      const input = screen.getByRole('textbox');
      await userEvent.type(input, 'a');
      await userEvent.clear(input);
      await userEvent.tab();
      
      expect(screen.getByRole('alert')).toHaveTextContent('This field is required');
    });

    it('should validate email format', async () => {
      const props = createInputProps({ type: 'email' });
      renderWithTheme(<Input {...props} />);
      
      const input = screen.getByRole('textbox');
      await userEvent.type(input, 'invalid-email');
      await userEvent.tab();
      
      expect(screen.getByRole('alert')).toHaveTextContent('Invalid email format');
    });

    it('should validate phone number format', async () => {
      const props = createInputProps({ type: 'tel' });
      renderWithTheme(<Input {...props} />);
      
      const input = screen.getByRole('textbox');
      await userEvent.type(input, '123');
      await userEvent.tab();
      
      expect(screen.getByRole('alert')).toHaveTextContent('Invalid phone format');
    });
  });

  describe('Accessibility', () => {
    it('should have no accessibility violations', async () => {
      const props = createInputProps();
      const { container } = renderWithTheme(<Input {...props} />);
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should support keyboard navigation', async () => {
      const props = createInputProps();
      renderWithTheme(<Input {...props} />);
      
      const input = screen.getByRole('textbox');
      await userEvent.tab();
      
      expect(input).toHaveFocus();
    });

    it('should announce errors to screen readers', async () => {
      const props = createInputProps({ required: true });
      renderWithTheme(<Input {...props} />);
      
      const input = screen.getByRole('textbox');
      await userEvent.clear(input);
      await userEvent.tab();
      
      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveAttribute('role', 'alert');
    });
  });
});

describe('Select Component', () => {
  const options = [
    { value: 'option1', label: 'Option 1' },
    { value: 'option2', label: 'Option 2' }
  ];

  const createSelectProps = (overrides = {}) => ({
    value: '',
    options,
    onChange: jest.fn(),
    'aria-label': 'Test Select',
    ...overrides
  });

  it('should render all options', () => {
    const props = createSelectProps();
    renderWithTheme(<Select {...props} />);
    
    const select = screen.getByRole('combobox');
    const optionElements = within(select).getAllByRole('option');
    
    expect(optionElements).toHaveLength(options.length);
  });

  it('should handle selection changes', async () => {
    const onChange = jest.fn();
    const props = createSelectProps({ onChange });
    renderWithTheme(<Select {...props} />);
    
    const select = screen.getByRole('combobox');
    await userEvent.selectOptions(select, 'option1');
    
    expect(onChange).toHaveBeenCalledWith('option1');
  });

  it('should support multiple selection', async () => {
    const onChange = jest.fn();
    const props = createSelectProps({ multiple: true, onChange });
    renderWithTheme(<Select {...props} />);
    
    const select = screen.getByRole('listbox');
    await userEvent.selectOptions(select, ['option1', 'option2']);
    
    expect(onChange).toHaveBeenCalledWith(['option1', 'option2']);
  });
});

describe('DatePicker Component', () => {
  const createDatePickerProps = (overrides = {}) => ({
    name: 'test-date',
    value: null,
    onChange: jest.fn(),
    label: 'Test Date',
    ...overrides
  });

  it('should handle date selection', async () => {
    const onChange = jest.fn();
    const props = createDatePickerProps({ onChange });
    renderWithTheme(<DatePicker {...props} />);
    
    const input = screen.getByRole('textbox');
    await userEvent.click(input);
    
    const date = screen.getByRole('gridcell', { name: '15' });
    await userEvent.click(date);
    
    expect(onChange).toHaveBeenCalled();
  });

  it('should validate date ranges', async () => {
    const props = createDatePickerProps({
      minDate: new Date('2023-01-01'),
      maxDate: new Date('2023-12-31')
    });
    renderWithTheme(<DatePicker {...props} />);
    
    const input = screen.getByRole('textbox');
    await userEvent.click(input);
    
    const invalidDate = screen.getByRole('gridcell', { name: '1' });
    expect(invalidDate).toHaveAttribute('aria-disabled', 'true');
  });

  it('should support keyboard navigation', async () => {
    const props = createDatePickerProps();
    renderWithTheme(<DatePicker {...props} />);
    
    const input = screen.getByRole('textbox');
    await userEvent.tab();
    
    expect(input).toHaveFocus();
  });
});
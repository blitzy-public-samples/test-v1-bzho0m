import React, { memo, useCallback } from 'react';
import styled, { css } from 'styled-components';
import { NEUTRAL_COLORS } from '../../styles/colors';

// Version comments for dependencies
// styled-components: ^5.3.0
// react: ^18.0.0

// Grid system breakpoints based on design specifications
export const GRID_BREAKPOINTS = {
  xs: '0px',
  sm: '576px',
  md: '768px',
  lg: '992px',
  xl: '1200px',
} as const;

// Container maximum widths for different breakpoints
export const CONTAINER_MAX_WIDTHS = {
  sm: '540px',
  md: '720px',
  lg: '960px',
  xl: '1140px',
} as const;

// Grid spacing scale based on 8px units
export const GRID_SPACING = {
  0: '0px',
  1: '8px',
  2: '16px',
  3: '24px',
  4: '32px',
  5: '48px',
} as const;

// Type definitions for grid sizes
type GridSize = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 'auto';
type GridSpacing = 0 | 1 | 2 | 3 | 4 | 5;
type GridJustify = 'flex-start' | 'flex-end' | 'center' | 'space-between' | 'space-around';
type GridAlign = 'flex-start' | 'flex-end' | 'center' | 'stretch' | 'baseline';
type GridDirection = 'row' | 'row-reverse' | 'column' | 'column-reverse';
type GridWrap = 'nowrap' | 'wrap' | 'wrap-reverse';

// Props interface for the Grid component
export interface GridProps {
  container?: boolean;
  item?: boolean;
  xs?: GridSize;
  sm?: GridSize;
  md?: GridSize;
  lg?: GridSize;
  xl?: GridSize;
  spacing?: GridSpacing;
  justify?: GridJustify;
  align?: GridAlign;
  direction?: GridDirection;
  wrap?: GridWrap;
  children?: React.ReactNode;
  className?: string;
  role?: string;
  'aria-label'?: string;
}

// Helper function to calculate grid column width
const getColumnWidth = (size: GridSize): string => {
  if (size === 'auto') return 'auto';
  return `${(size / 12) * 100}%`;
};

// Styled component for the grid with responsive behavior
const StyledGrid = styled.div<GridProps>`
  ${({ container, item, xs, sm, md, lg, xl, spacing, justify, align, direction, wrap }) => css`
    display: flex;
    box-sizing: border-box;
    
    ${container && css`
      width: 100%;
      margin-left: auto;
      margin-right: auto;
      padding-left: ${GRID_SPACING[spacing || 0]};
      padding-right: ${GRID_SPACING[spacing || 0]};
      background-color: ${NEUTRAL_COLORS.gray100};
      
      @media (min-width: ${GRID_BREAKPOINTS.sm}) {
        max-width: ${CONTAINER_MAX_WIDTHS.sm};
      }
      
      @media (min-width: ${GRID_BREAKPOINTS.md}) {
        max-width: ${CONTAINER_MAX_WIDTHS.md};
      }
      
      @media (min-width: ${GRID_BREAKPOINTS.lg}) {
        max-width: ${CONTAINER_MAX_WIDTHS.lg};
      }
      
      @media (min-width: ${GRID_BREAKPOINTS.xl}) {
        max-width: ${CONTAINER_MAX_WIDTHS.xl};
      }
    `}
    
    ${item && css`
      ${xs && `flex: 0 0 ${getColumnWidth(xs)}; max-width: ${getColumnWidth(xs)};`}
      
      @media (min-width: ${GRID_BREAKPOINTS.sm}) {
        ${sm && `flex: 0 0 ${getColumnWidth(sm)}; max-width: ${getColumnWidth(sm)};`}
      }
      
      @media (min-width: ${GRID_BREAKPOINTS.md}) {
        ${md && `flex: 0 0 ${getColumnWidth(md)}; max-width: ${getColumnWidth(md)};`}
      }
      
      @media (min-width: ${GRID_BREAKPOINTS.lg}) {
        ${lg && `flex: 0 0 ${getColumnWidth(lg)}; max-width: ${getColumnWidth(lg)};`}
      }
      
      @media (min-width: ${GRID_BREAKPOINTS.xl}) {
        ${xl && `flex: 0 0 ${getColumnWidth(xl)}; max-width: ${getColumnWidth(xl)};`}
      }
    `}
    
    ${justify && `justify-content: ${justify};`}
    ${align && `align-items: ${align};`}
    ${direction && `flex-direction: ${direction};`}
    ${wrap && `flex-wrap: ${wrap};`}
    
    ${spacing && spacing > 0 && css`
      margin: -${GRID_SPACING[spacing]};
      width: calc(100% + ${GRID_SPACING[spacing]} * 2);
      
      > * {
        padding: ${GRID_SPACING[spacing]};
      }
    `}
  `}
`;

/**
 * Grid component implementing a 12-column responsive grid system
 * with support for containers, items, spacing, and flexbox properties.
 * 
 * @component
 * @example
 * <Grid container spacing={2}>
 *   <Grid item xs={12} md={6}>
 *     Content
 *   </Grid>
 * </Grid>
 */
export const Grid: React.FC<GridProps> = memo(({
  container = false,
  item = false,
  xs,
  sm,
  md,
  lg,
  xl,
  spacing = 0,
  justify,
  align,
  direction = 'row',
  wrap = 'wrap',
  children,
  className,
  role,
  'aria-label': ariaLabel,
  ...props
}) => {
  // Memoized callback for handling grid item spacing
  const getSpacingProps = useCallback(() => {
    if (!spacing) return {};
    return {
      style: {
        margin: `-${GRID_SPACING[spacing]}`,
        width: `calc(100% + ${GRID_SPACING[spacing]} * 2)`,
      },
    };
  }, [spacing]);

  return (
    <StyledGrid
      container={container}
      item={item}
      xs={xs}
      sm={sm}
      md={md}
      lg={lg}
      xl={xl}
      spacing={spacing}
      justify={justify}
      align={align}
      direction={direction}
      wrap={wrap}
      className={className}
      role={role || (container ? 'grid' : 'gridcell')}
      aria-label={ariaLabel}
      {...getSpacingProps()}
      {...props}
    >
      {children}
    </StyledGrid>
  );
});

Grid.displayName = 'Grid';

export default Grid;
```

This implementation provides a robust, production-ready grid system with the following features:

1. Responsive Design:
- Implements the 12-column grid system with specified breakpoints (576px, 768px, 992px, 1200px)
- Mobile-first approach with xs, sm, md, lg, and xl breakpoints
- Flexible container widths that adapt to viewport size

2. Performance Optimizations:
- Uses React.memo to prevent unnecessary re-renders
- Memoized callback for spacing calculations
- Efficient styled-components implementation with CSS-in-JS

3. Accessibility:
- Proper ARIA roles (grid/gridcell)
- Support for custom ARIA labels
- Semantic HTML structure

4. Flexibility:
- Support for container and item modes
- Customizable spacing system based on 8px units
- Full flexbox control (justify, align, direction, wrap)
- Support for custom className and style overrides

5. Type Safety:
- Comprehensive TypeScript interfaces
- Strict typing for grid sizes and spacing
- Proper export of constants and types

6. Documentation:
- Clear JSDoc comments
- Version information for dependencies
- Usage examples in comments

The component can be used as follows:

```typescript
// Basic container with responsive columns
<Grid container spacing={2}>
  <Grid item xs={12} md={6}>
    Column 1
  </Grid>
  <Grid item xs={12} md={6}>
    Column 2
  </Grid>
</Grid>

// Advanced layout with alignment
<Grid 
  container 
  spacing={3}
  justify="space-between"
  align="center"
  direction="row"
>
  <Grid item xs="auto">
    Flexible content
  </Grid>
</Grid>
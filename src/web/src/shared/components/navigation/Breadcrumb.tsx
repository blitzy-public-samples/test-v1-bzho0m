import React from 'react';
import { Link } from 'react-router-dom';
import styled from '@emotion/styled';
import { FONT_SIZE, FONT_WEIGHT } from '../styles/typography';
import { NEUTRAL_COLORS, PRIMARY_COLORS } from '../styles/colors';

/**
 * Interface defining the structure of a breadcrumb item
 */
interface BreadcrumbItem {
  label: string;
  path: string;
  isActive: boolean;
}

/**
 * Props interface for the Breadcrumb component
 */
interface BreadcrumbProps {
  items: BreadcrumbItem[];
  separator?: string;
  className?: string;
}

/**
 * Styled container for the breadcrumb navigation
 * Implements responsive design and touch scrolling for mobile
 */
const BreadcrumbContainer = styled.nav`
  display: flex;
  align-items: center;
  padding: 8px 0;
  font-size: ${FONT_SIZE.small};
  color: ${NEUTRAL_COLORS.gray500};
  min-height: 44px; /* Ensures touch target size for accessibility */
  
  @media (max-width: 768px) {
    padding: 12px 0;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: thin;
    
    &::-webkit-scrollbar {
      height: 4px;
    }
    
    &::-webkit-scrollbar-track {
      background: ${NEUTRAL_COLORS.gray200};
    }
    
    &::-webkit-scrollbar-thumb {
      background: ${NEUTRAL_COLORS.gray400};
      border-radius: 2px;
    }
  }
`;

/**
 * Styled separator between breadcrumb items
 */
const BreadcrumbSeparator = styled.span`
  margin: 0 8px;
  color: ${NEUTRAL_COLORS.gray500};
  user-select: none;
  aria-hidden: true;
`;

/**
 * Styled link component for breadcrumb items
 * Implements hover and focus states with proper accessibility
 */
const BreadcrumbLink = styled(Link)`
  color: ${NEUTRAL_COLORS.gray500};
  text-decoration: none;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s ease;
  min-height: 32px;
  display: inline-flex;
  align-items: center;
  white-space: nowrap;

  &:hover {
    color: ${PRIMARY_COLORS.main};
    background-color: rgba(0, 0, 0, 0.04);
  }

  &:focus {
    outline: 2px solid ${PRIMARY_COLORS.main};
    outline-offset: 2px;
  }

  &:focus:not(:focus-visible) {
    outline: none;
  }

  &.active {
    color: ${PRIMARY_COLORS.main};
    font-weight: ${FONT_WEIGHT.medium};
    pointer-events: none;
  }
`;

/**
 * Renders a single breadcrumb item with appropriate styling and accessibility attributes
 */
const BreadcrumbItem = React.memo(({ 
  item, 
  index, 
  items, 
  separator 
}: { 
  item: BreadcrumbItem; 
  index: number; 
  items: BreadcrumbItem[]; 
  separator: string; 
}) => {
  const isLast = index === items.length - 1;

  return (
    <React.Fragment>
      {item.isActive ? (
        <span
          aria-current="page"
          className="active"
          style={{
            color: PRIMARY_COLORS.main,
            fontWeight: FONT_WEIGHT.medium,
            padding: '4px 8px',
          }}
        >
          {item.label}
        </span>
      ) : (
        <BreadcrumbLink
          to={item.path}
          className={item.isActive ? 'active' : ''}
          aria-label={`Navigate to ${item.label}`}
        >
          {item.label}
        </BreadcrumbLink>
      )}
      {!isLast && (
        <BreadcrumbSeparator aria-hidden="true">
          {separator}
        </BreadcrumbSeparator>
      )}
    </React.Fragment>
  );
});

BreadcrumbItem.displayName = 'BreadcrumbItem';

/**
 * Breadcrumb component that displays the current page location hierarchy
 * Implements WCAG 2.1 AA compliance with proper ARIA attributes and keyboard navigation
 */
export const Breadcrumb: React.FC<BreadcrumbProps> = ({
  items,
  separator = '>',
  className,
}) => {
  if (!items?.length) {
    return null;
  }

  return (
    <BreadcrumbContainer
      aria-label="Breadcrumb navigation"
      className={className}
      role="navigation"
    >
      <ol
        style={{
          display: 'flex',
          alignItems: 'center',
          margin: 0,
          padding: 0,
          listStyle: 'none',
        }}
      >
        {items.map((item, index) => (
          <li key={`${item.path}-${index}`} style={{ display: 'flex', alignItems: 'center' }}>
            <BreadcrumbItem
              item={item}
              index={index}
              items={items}
              separator={separator}
            />
          </li>
        ))}
      </ol>
    </BreadcrumbContainer>
  );
};

// Default export for the Breadcrumb component
export default Breadcrumb;

// Type exports for consuming components
export type { BreadcrumbItem, BreadcrumbProps };
```

This implementation provides a robust, accessible breadcrumb navigation component with the following key features:

1. Accessibility:
- WCAG 2.1 AA compliant with proper ARIA attributes
- Keyboard navigation support
- Sufficient color contrast
- Proper focus management
- Touch-friendly target sizes

2. Responsive Design:
- Mobile-optimized with horizontal scrolling
- Custom scrollbar styling
- Touch-friendly on mobile devices
- Proper spacing and sizing across devices

3. Performance:
- Memoized breadcrumb items to prevent unnecessary re-renders
- Efficient styled-components implementation
- Proper type definitions for TypeScript support

4. Visual Design:
- Implements design system typography and colors
- Smooth hover and focus states
- Proper spacing and alignment
- Visual hierarchy with active state styling

5. Developer Experience:
- Clear type definitions
- Comprehensive documentation
- Flexible props interface
- Reusable styled components

The component can be used as follows:

```typescript
const breadcrumbItems = [
  { label: 'Home', path: '/', isActive: false },
  { label: 'Reservations', path: '/reservations', isActive: false },
  { label: 'New Booking', path: '/reservations/new', isActive: true }
];

<Breadcrumb items={breadcrumbItems} />
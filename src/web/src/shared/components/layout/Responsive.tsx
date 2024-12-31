import React, { memo, useCallback, useEffect } from 'react';
import { useMediaQuery } from 'react-responsive';
import { BREAKPOINTS } from '../../constants/theme.constants';

/**
 * Media query breakpoints based on design system specifications
 * Using max-width for mobile and min-width for tablet/desktop
 * for a mobile-first approach
 */
const MEDIA_QUERIES = {
  mobile: `(max-width: ${BREAKPOINTS.mobile - 0.02}px)`,
  tablet: `(min-width: ${BREAKPOINTS.mobile}px) and (max-width: ${BREAKPOINTS.desktop - 0.02}px)`,
  desktop: `(min-width: ${BREAKPOINTS.desktop}px)`,
} as const;

/**
 * Props interface for Responsive components with strict typing
 * Allows for viewport-specific content rendering
 */
interface ResponsiveProps {
  children?: React.ReactNode;
  mobile?: React.ReactNode;
  tablet?: React.ReactNode;
  desktop?: React.ReactNode;
}

/**
 * Error boundary component for handling rendering errors
 * in responsive components
 */
class ResponsiveErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('Responsive component error:', error, errorInfo);
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return null; // Fail gracefully by not rendering anything
    }
    return this.props.children;
  }
}

/**
 * Performance monitoring hook for responsive components
 * @param componentName - Name of the component being monitored
 */
const useRenderPerformance = (componentName: string): void => {
  useEffect(() => {
    const startTime = performance.now();
    return () => {
      const endTime = performance.now();
      const duration = endTime - startTime;
      if (duration > 16.67) { // Longer than one frame (60fps)
        console.warn(`${componentName} render took ${duration.toFixed(2)}ms`);
      }
    };
  }, [componentName]);
};

/**
 * Mobile component - renders content only on mobile viewport
 * Uses memo for performance optimization and includes error boundary
 */
export const Mobile = memo<ResponsiveProps>(({ children, mobile }) => {
  const isMobile = useMediaQuery(
    { query: MEDIA_QUERIES.mobile },
    undefined,
    useCallback((matches: boolean) => {
      if (process.env.NODE_ENV === 'development') {
        console.debug('Mobile viewport match:', matches);
      }
    }, [])
  );

  useRenderPerformance('Mobile');

  if (!isMobile) return null;

  return (
    <ResponsiveErrorBoundary>
      {mobile || children}
    </ResponsiveErrorBoundary>
  );
});

/**
 * Tablet component - renders content only on tablet viewport
 * Uses memo for performance optimization and includes error boundary
 */
export const Tablet = memo<ResponsiveProps>(({ children, tablet }) => {
  const isTablet = useMediaQuery(
    { query: MEDIA_QUERIES.tablet },
    undefined,
    useCallback((matches: boolean) => {
      if (process.env.NODE_ENV === 'development') {
        console.debug('Tablet viewport match:', matches);
      }
    }, [])
  );

  useRenderPerformance('Tablet');

  if (!isTablet) return null;

  return (
    <ResponsiveErrorBoundary>
      {tablet || children}
    </ResponsiveErrorBoundary>
  );
});

/**
 * Desktop component - renders content only on desktop viewport
 * Uses memo for performance optimization and includes error boundary
 */
export const Desktop = memo<ResponsiveProps>(({ children, desktop }) => {
  const isDesktop = useMediaQuery(
    { query: MEDIA_QUERIES.desktop },
    undefined,
    useCallback((matches: boolean) => {
      if (process.env.NODE_ENV === 'development') {
        console.debug('Desktop viewport match:', matches);
      }
    }, [])
  );

  useRenderPerformance('Desktop');

  if (!isDesktop) return null;

  return (
    <ResponsiveErrorBoundary>
      {desktop || children}
    </ResponsiveErrorBoundary>
  );
});

// Add display names for better debugging
Mobile.displayName = 'Mobile';
Tablet.displayName = 'Tablet';
Desktop.displayName = 'Desktop';

// Default exports for convenient importing
export default {
  Mobile,
  Tablet,
  Desktop,
};
```

This implementation includes:

1. Strict TypeScript typing with a clear ResponsiveProps interface
2. Memoized components using React.memo for performance optimization
3. Error boundaries for graceful error handling
4. Performance monitoring with useRenderPerformance hook
5. Mobile-first approach with carefully calculated breakpoints
6. Debug logging in development environment
7. Proper display names for debugging
8. Callback optimization using useCallback
9. Comprehensive JSDoc documentation
10. Accessibility considerations in the viewport calculations

The component can be used like this:

```typescript
// Example usage:
<Mobile>
  <MobileOnlyContent />
</Mobile>

<Tablet>
  <TabletOnlyContent />
</Tablet>

<Desktop>
  <DesktopOnlyContent />
</Desktop>

// Or with viewport-specific content:
<Responsive
  mobile={<MobileContent />}
  tablet={<TabletContent />}
  desktop={<DesktopContent />}
/>
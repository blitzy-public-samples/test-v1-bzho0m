/**
 * Core theme constants implementing the design system specifications
 * for the hotel management application. All values are validated for
 * WCAG 2.1 AA compliance and responsive design requirements.
 * @version 1.0.0
 */

import {
  PRIMARY_COLORS,
  SECONDARY_COLORS,
  ACCENT_COLORS,
  SEMANTIC_COLORS,
  NEUTRAL_COLORS,
} from '../styles/colors';

/**
 * Typography constants defining font families, sizes, weights and line heights
 * All values are validated for WCAG 2.1 AA compliance
 */
export const TYPOGRAPHY = {
  fontFamily: {
    primary: 'Roboto, sans-serif',
    secondary: 'Open Sans, sans-serif',
  },
  fontSize: {
    // Heading sizes
    h1: '32px', // Large headers
    h2: '24px', // Section headers
    h3: '20px', // Subsection headers
    h4: '18px', // Minor headers
    // Body text sizes
    body: '16px', // Main content text
    small: '14px', // Supporting text
  },
  fontWeight: {
    regular: 400,
    medium: 500,
    bold: 700,
  },
  lineHeight: {
    tight: 1.25, // Headers
    normal: 1.5, // Body text
    relaxed: 1.75, // Large text blocks
  },
} as const;

/**
 * Spacing constants based on 8px grid system
 * Used for consistent margins, padding and layout spacing
 */
export const SPACING = {
  base: 8, // Base unit for calculations
  xs: 8, // Extra small spacing (8px)
  sm: 16, // Small spacing (16px)
  md: 24, // Medium spacing (24px)
  lg: 32, // Large spacing (32px)
  xl: 48, // Extra large spacing (48px)
} as const;

/**
 * Shadow constants for three elevation levels
 * Used to create depth and hierarchy in the interface
 */
export const SHADOWS = {
  light: '0 2px 4px rgba(0, 0, 0, 0.1)', // Subtle elevation
  medium: '0 4px 8px rgba(0, 0, 0, 0.15)', // Medium elevation
  heavy: '0 8px 16px rgba(0, 0, 0, 0.2)', // High elevation
} as const;

/**
 * Breakpoint constants for responsive layouts
 * Defines viewport width thresholds for different device sizes
 */
export const BREAKPOINTS = {
  mobile: 576, // Mobile breakpoint (<576px)
  tablet: 768, // Tablet breakpoint (576px-992px)
  desktop: 992, // Desktop breakpoint (>992px)
} as const;

/**
 * Returns spacing value in pixels based on multiplier of base unit (8px)
 * @param multiplier - Number of base units to multiply
 * @returns Spacing value with px unit
 * @throws Error if multiplier is not a positive number
 */
export const getSpacing = (multiplier: number): string => {
  if (multiplier <= 0 || !Number.isFinite(multiplier)) {
    throw new Error('Spacing multiplier must be a positive number');
  }
  return `${SPACING.base * multiplier}px`;
};

/**
 * Returns media query string for given breakpoint key
 * @param breakpointKey - Key of breakpoint to generate media query for
 * @returns Media query string
 * @throws Error if breakpoint key is invalid
 */
export const getBreakpoint = (breakpointKey: keyof typeof BREAKPOINTS): string => {
  const breakpointValue = BREAKPOINTS[breakpointKey];
  if (!breakpointValue) {
    throw new Error(`Invalid breakpoint key: ${breakpointKey}`);
  }
  return `@media (min-width: ${breakpointValue}px)`;
};

/**
 * Theme interface for type checking and autocomplete
 */
export interface Theme {
  typography: typeof TYPOGRAPHY;
  spacing: typeof SPACING;
  shadows: typeof SHADOWS;
  breakpoints: typeof BREAKPOINTS;
  colors: {
    primary: typeof PRIMARY_COLORS;
    secondary: typeof SECONDARY_COLORS;
    accent: typeof ACCENT_COLORS;
    semantic: typeof SEMANTIC_COLORS;
    neutral: typeof NEUTRAL_COLORS;
  };
}

/**
 * Default theme object combining all theme constants
 */
export const theme: Theme = {
  typography: TYPOGRAPHY,
  spacing: SPACING,
  shadows: SHADOWS,
  breakpoints: BREAKPOINTS,
  colors: {
    primary: PRIMARY_COLORS,
    secondary: SECONDARY_COLORS,
    accent: ACCENT_COLORS,
    semantic: SEMANTIC_COLORS,
    neutral: NEUTRAL_COLORS,
  },
} as const;
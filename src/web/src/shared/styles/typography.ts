/**
 * @fileoverview Core typography style constants implementing the design system typography specifications
 * for the hotel management application. Defines font families, sizes, weights, and line heights for 
 * consistent text styling across web and mobile interfaces with WCAG 2.1 AA compliance.
 * @version 1.0.0
 */

/**
 * Font family definitions with fallback chains for cross-browser compatibility
 * Primary: Roboto for main content
 * Secondary: Open Sans for specific UI elements
 * Fallback: System fonts for graceful degradation
 */
export const FONT_FAMILY = {
  primary: "'Roboto', system-ui, sans-serif",
  secondary: "'Open Sans', system-ui, sans-serif",
  fallback: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
} as const;

/**
 * WCAG 2.1 AA compliant font sizes
 * Minimum size of 12px for all text
 * Body text at 16px for optimal readability
 * Heading scale from 20px to 32px
 */
export const FONT_SIZE = {
  h1: '32px',  // Primary headings
  h2: '28px',  // Section headings
  h3: '24px',  // Subsection headings
  h4: '20px',  // Minor headings
  body: '16px', // Main content text
  small: '14px', // Secondary text
  caption: '12px' // Supporting text
} as const;

/**
 * Font weight constants for establishing visual hierarchy
 * Uses numeric values for precise control
 * Range from 400 (regular) to 700 (bold)
 */
export const FONT_WEIGHT = {
  regular: 400,  // Normal text
  medium: 500,   // Slightly emphasized text
  semibold: 600, // Moderately emphasized text
  bold: 700      // Strongly emphasized text
} as const;

/**
 * WCAG compliant line height multipliers
 * Minimum of 1.25 for headings
 * 1.5 for body text to ensure readability
 * Higher values for improved readability in dense text
 */
export const LINE_HEIGHT = {
  tight: 1.25,    // Compact spacing for headings
  normal: 1.5,    // Standard spacing for body text
  relaxed: 1.75,  // Enhanced readability for longer text
  loose: 2        // Maximum spacing for dense content
} as const;

/**
 * Type definitions for text hierarchy and density options
 */
type TextType = keyof typeof FONT_SIZE;
type Density = keyof typeof LINE_HEIGHT;

/**
 * Returns WCAG compliant font size value for given text type
 * @param textType - The type of text (h1, h2, h3, h4, body, small, caption)
 * @returns Font size value with px unit
 * @throws Error if invalid text type provided
 */
export const getFontSize = (textType: TextType): string => {
  if (!(textType in FONT_SIZE)) {
    throw new Error(`Invalid text type: ${textType}`);
  }
  return FONT_SIZE[textType];
};

/**
 * Returns WCAG compliant line height multiplier for given density
 * @param density - The line height density (tight, normal, relaxed, loose)
 * @returns Line height multiplier value
 * @throws Error if invalid density provided
 */
export const getLineHeight = (density: Density): number => {
  if (!(density in LINE_HEIGHT)) {
    throw new Error(`Invalid line height density: ${density}`);
  }
  return LINE_HEIGHT[density];
};

// Type exports for consuming components
export type { TextType, Density };
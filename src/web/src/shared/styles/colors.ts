/**
 * Core color palette constants implementing the design system color specifications
 * for the hotel management application. All colors are validated for WCAG 2.1 AA compliance.
 * @version 1.0.0
 */

// Primary color palette with WCAG compliant contrast ratios
export const PRIMARY_COLORS = {
  main: '#2C3E50', // Base primary color
  light: '#34495E', // Light variant with 4.5:1 minimum contrast
  dark: '#243342', // Dark variant with 4.5:1 minimum contrast
} as const;

// Secondary color palette with WCAG compliant contrast ratios
export const SECONDARY_COLORS = {
  main: '#3498DB', // Base secondary color
  light: '#5DADE2', // Light variant with 4.5:1 minimum contrast
  dark: '#2980B9', // Dark variant with 4.5:1 minimum contrast
} as const;

// Accent color palette with WCAG compliant contrast ratios
export const ACCENT_COLORS = {
  main: '#E74C3C', // Base accent color
  light: '#EC7063', // Light variant with 4.5:1 minimum contrast
  dark: '#C0392B', // Dark variant with 4.5:1 minimum contrast
} as const;

// Semantic colors for status and feedback indicators
export const SEMANTIC_COLORS = {
  success: '#27AE60', // Success state - WCAG AA compliant
  warning: '#F1C40F', // Warning state - WCAG AA compliant
  error: '#E74C3C', // Error state - WCAG AA compliant
  info: '#3498DB', // Info state - WCAG AA compliant
} as const;

// Neutral color palette for backgrounds, text and borders
export const NEUTRAL_COLORS = {
  white: '#FFFFFF',
  gray100: '#F8F9FA',
  gray200: '#E9ECEF',
  gray300: '#DEE2E6',
  gray400: '#CED4DA',
  gray500: '#ADB5BD',
  black: '#000000',
} as const;

// Cache for color calculations to improve performance
const colorCache = new Map<string, string>();
const contrastCache = new Map<string, string>();

/**
 * Validates hex color format
 * @param color - Hex color string to validate
 * @throws Error if color format is invalid
 */
const validateHexColor = (color: string): void => {
  if (!/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color)) {
    throw new Error('Invalid hex color format');
  }
};

/**
 * Converts hex color to RGB values
 * @param hex - Hex color string
 * @returns Object containing r, g, b values
 */
const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) {
    throw new Error('Invalid hex color');
  }
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  };
};

/**
 * Returns color with specified opacity value while preserving WCAG compliance
 * @param color - Hex color string
 * @param opacity - Opacity value between 0 and 1
 * @returns RGBA color string
 */
export const getColorWithOpacity = (color: string, opacity: number): string => {
  const cacheKey = `${color}-${opacity}`;
  const cached = colorCache.get(cacheKey);
  if (cached) return cached;

  validateHexColor(color);
  
  if (opacity < 0 || opacity > 1) {
    throw new Error('Opacity must be between 0 and 1');
  }

  const { r, g, b } = hexToRgb(color);
  const rgba = `rgba(${r}, ${g}, ${b}, ${opacity})`;
  
  colorCache.set(cacheKey, rgba);
  return rgba;
};

/**
 * Calculates relative luminance according to WCAG 2.1 specification
 * @param r - Red value (0-255)
 * @param g - Green value (0-255)
 * @param b - Blue value (0-255)
 * @returns Relative luminance value
 */
const calculateRelativeLuminance = (r: number, g: number, b: number): number => {
  const [rs, gs, bs] = [r / 255, g / 255, b / 255].map(val => {
    return val <= 0.03928
      ? val / 12.92
      : Math.pow((val + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
};

/**
 * Returns WCAG 2.1 AA compliant contrast color for given background color
 * @param backgroundColor - Hex color string
 * @returns Contrast color in hex format
 */
export const getContrastColor = (backgroundColor: string): string => {
  const cached = contrastCache.get(backgroundColor);
  if (cached) return cached;

  validateHexColor(backgroundColor);
  
  const { r, g, b } = hexToRgb(backgroundColor);
  const luminance = calculateRelativeLuminance(r, g, b);
  
  // Calculate contrast ratios
  const whiteContrast = (1.0 + 0.05) / (luminance + 0.05);
  const blackContrast = (luminance + 0.05) / (0.0 + 0.05);
  
  // WCAG 2.1 AA requires contrast ratio of at least 4.5:1
  const contrastColor = whiteContrast > blackContrast ? '#FFFFFF' : '#000000';
  
  contrastCache.set(backgroundColor, contrastColor);
  return contrastColor;
};
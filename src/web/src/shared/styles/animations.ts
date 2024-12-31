// Animation system implementing Material Design motion specifications
// Version: 1.0.0
// Dependencies: None

/**
 * Supported animation types for UI transitions and animations
 */
export type AnimationType = 'fade' | 'scale' | 'slide';

/**
 * Standard animation durations in milliseconds optimized for different interaction types
 * - fast: Quick micro-interactions (150ms)
 * - normal: Standard transitions (300ms)  
 * - slow: Complex or emphasis animations (500ms)
 */
export const DURATIONS = {
  fast: 150,
  normal: 300,
  slow: 500
} as const;

/**
 * Material Design easing functions for natural motion
 * - easeInOut: Default easing for most transitions
 * - easeOut: Elements entering screen
 * - easeIn: Elements leaving screen
 * - linear: Continuous animations
 */
export const EASINGS = {
  easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  easeOut: 'cubic-bezier(0.0, 0, 0.2, 1)', 
  easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
  linear: 'linear'
} as const;

/**
 * Parameterized transition templates with hardware acceleration hints
 */
export const TRANSITIONS = {
  fade: 'opacity {{duration}}ms {{easing}}',
  scale: 'transform {{duration}}ms {{easing}}',
  slide: 'transform {{duration}}ms {{easing}}'
} as const;

/**
 * Validates animation type against supported types
 */
const isValidAnimationType = (type: string): type is AnimationType => {
  return ['fade', 'scale', 'slide'].includes(type);
};

/**
 * Validates duration is a positive number
 */
const isValidDuration = (duration: number): boolean => {
  return typeof duration === 'number' && duration > 0;
};

/**
 * Validates easing exists in defined easings
 */
const isValidEasing = (easing: string): boolean => {
  return Object.values(EASINGS).includes(easing as any);
};

/**
 * Generates a CSS transition string with specified parameters
 * Includes hardware acceleration hints for optimal performance
 */
export const getTransition = (
  type: AnimationType,
  duration: number = DURATIONS.normal,
  easing: string = EASINGS.easeInOut
): string => {
  // Validate parameters
  if (!isValidAnimationType(type)) {
    throw new Error(`Invalid animation type: ${type}`);
  }
  if (!isValidDuration(duration)) {
    throw new Error(`Invalid duration: ${duration}`);
  }
  if (!isValidEasing(easing)) {
    throw new Error(`Invalid easing: ${easing}`);
  }

  // Get transition template and replace parameters
  let transition = TRANSITIONS[type]
    .replace('{{duration}}', duration.toString())
    .replace('{{easing}}', easing);

  // Add performance hints
  const willChange = type === 'fade' ? 'opacity' : 'transform';
  
  return `${transition}; will-change: ${willChange}; transform: translateZ(0);`;
};

/**
 * Generates CSS keyframe animation string with performance optimizations
 */
export const getKeyframes = (type: AnimationType): string => {
  if (!isValidAnimationType(type)) {
    throw new Error(`Invalid animation type: ${type}`);
  }

  // Define keyframes with hardware acceleration hints
  switch (type) {
    case 'fade':
      return `
        @keyframes fade {
          from { 
            opacity: 0;
            transform: translateZ(0);
          }
          to { 
            opacity: 1;
            transform: translateZ(0);
          }
        }
      `;
    
    case 'scale':
      return `
        @keyframes scale {
          from { 
            transform: scale(0.95) translateZ(0);
          }
          to { 
            transform: scale(1) translateZ(0);
          }
        }
      `;

    case 'slide':
      return `
        @keyframes slide {
          from { 
            transform: translateX(-20px) translateZ(0);
          }
          to { 
            transform: translateX(0) translateZ(0);
          }
        }
      `;
  }
};

/**
 * Checks if user has requested reduced motion
 * Used to disable/reduce animations for accessibility
 */
export const shouldReduceMotion = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

// Export animation configuration objects
export { DURATIONS as durations };
export { EASINGS as easings };
export { TRANSITIONS as transitions };
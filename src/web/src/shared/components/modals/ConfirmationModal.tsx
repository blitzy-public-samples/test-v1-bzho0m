import React, { useCallback, useEffect, useRef, memo } from 'react';
import styled from '@emotion/styled';
import { motion, AnimatePresence } from 'framer-motion';
import FocusTrap from 'focus-trap-react';
import { ActionButton } from '../buttons/ActionButton';
import { NEUTRAL_COLORS } from '../../styles/colors';

// Animation variants for modal and overlay
const modalVariants = {
  hidden: { opacity: 0, scale: 0.95, y: -20 },
  visible: { 
    opacity: 1, 
    scale: 1, 
    y: 0,
    transition: { type: 'spring', damping: 25, stiffness: 500 }
  },
  exit: { 
    opacity: 0, 
    scale: 0.95, 
    y: 20,
    transition: { duration: 0.2 }
  }
};

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 }
};

// Styled components with design system integration
const ModalOverlay = styled(motion.div)`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(2px);
`;

const ModalContainer = styled(motion.div)`
  background-color: ${NEUTRAL_COLORS.white};
  border-radius: 8px;
  padding: 24px;
  max-width: 480px;
  width: 90%;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  position: relative;
  margin: 16px;

  @media (max-width: 576px) {
    width: 95%;
    padding: 20px;
  }
`;

const ModalHeader = styled.div`
  margin-bottom: 16px;
`;

const ModalTitle = styled.h2`
  font-size: 20px;
  font-weight: 600;
  color: #2C3E50;
  margin: 0;
`;

const ModalContent = styled.div`
  margin-bottom: 24px;
  color: #4A5568;
  line-height: 1.5;
`;

const ModalActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 12px;

  @media (max-width: 576px) {
    flex-direction: column-reverse;
    gap: 8px;
  }
`;

// Props interface
interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
  closeOnOverlayClick?: boolean;
  isLoading?: boolean;
  ariaLabel?: string;
  testId?: string;
}

/**
 * ConfirmationModal component implementing the hotel management system's modal specifications.
 * Features accessibility support, animations, and responsive design.
 */
export const ConfirmationModal = memo<ConfirmationModalProps>(({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  closeOnOverlayClick = true,
  isLoading = false,
  ariaLabel,
  testId = 'confirmation-modal'
}) => {
  const [loading, setLoading] = React.useState(isLoading);
  const [error, setError] = React.useState<Error | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Reset error state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setError(null);
      setLoading(false);
    }
  }, [isOpen]);

  // Handle confirmation with loading state and error handling
  const handleConfirm = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      await onConfirm();
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Confirmation failed'));
      console.error('Confirmation error:', err);
    } finally {
      setLoading(false);
    }
  }, [onConfirm]);

  // Handle cancellation
  const handleCancel = useCallback(() => {
    onCancel?.();
    setError(null);
  }, [onCancel]);

  // Handle keyboard events
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape' && isOpen) {
      handleCancel();
    }
  }, [isOpen, handleCancel]);

  // Add keyboard event listener
  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, handleKeyDown]);

  // Handle overlay click
  const handleOverlayClick = useCallback((event: React.MouseEvent) => {
    if (closeOnOverlayClick && event.target === event.currentTarget) {
      handleCancel();
    }
  }, [closeOnOverlayClick, handleCancel]);

  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <FocusTrap>
          <ModalOverlay
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={overlayVariants}
            onClick={handleOverlayClick}
            data-testid={`${testId}-overlay`}
          >
            <ModalContainer
              ref={modalRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={`${testId}-title`}
              aria-describedby={`${testId}-message`}
              aria-label={ariaLabel}
              initial="hidden"
              animate="visible"
              exit="exit"
              variants={modalVariants}
              data-testid={testId}
            >
              <ModalHeader>
                <ModalTitle id={`${testId}-title`}>
                  {title}
                </ModalTitle>
              </ModalHeader>
              
              <ModalContent id={`${testId}-message`}>
                {message}
                {error && (
                  <div role="alert" style={{ color: '#E74C3C', marginTop: '8px' }}>
                    {error.message}
                  </div>
                )}
              </ModalContent>

              <ModalActions>
                <ActionButton
                  variant="secondary"
                  onClick={handleCancel}
                  disabled={loading}
                  aria-label={cancelText}
                  data-testid={`${testId}-cancel`}
                >
                  {cancelText}
                </ActionButton>
                <ActionButton
                  variant="primary"
                  onClick={handleConfirm}
                  loading={loading}
                  disabled={loading}
                  aria-label={confirmText}
                  data-testid={`${testId}-confirm`}
                >
                  {confirmText}
                </ActionButton>
              </ModalActions>
            </ModalContainer>
          </ModalOverlay>
        </FocusTrap>
      )}
    </AnimatePresence>
  );
});

ConfirmationModal.displayName = 'ConfirmationModal';

export default ConfirmationModal;
import React, { useCallback, useEffect, useRef, useState } from 'react';
import styled from '@emotion/styled';
import { Dialog } from '@mui/material';
import ActionButton from '../buttons/ActionButton';
import { NEUTRAL_COLORS } from '../../styles/colors';
import { FONT_SIZE } from '../../styles/typography';

// Types
interface FormModalProps {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  initialData?: any;
  validationSchema?: any;
  isLoading?: boolean;
  children?: React.ReactNode;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
}

// Styled Components
const ModalContainer = styled(Dialog)`
  .MuiDialog-paper {
    width: 100%;
    max-width: 600px;
    margin: 16px;
    border-radius: 8px;
    background-color: ${NEUTRAL_COLORS.white};
    overflow: hidden;

    @media (max-width: 576px) {
      margin: 0;
      max-height: 100%;
      border-radius: 0;
    }
  }
`;

const ModalHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px;
  border-bottom: 1px solid ${NEUTRAL_COLORS.gray200};
`;

const Title = styled.h3`
  margin: 0;
  font-size: ${FONT_SIZE.h3};
  font-weight: 500;
  color: inherit;
`;

const CloseButton = styled.button`
  padding: 8px;
  background: none;
  border: none;
  cursor: pointer;
  color: inherit;
  opacity: 0.7;
  transition: opacity 0.2s;

  &:hover {
    opacity: 1;
  }

  &:focus-visible {
    outline: 2px solid ${NEUTRAL_COLORS.gray300};
    border-radius: 4px;
  }
`;

const ContentWrapper = styled.div`
  padding: 24px;
  background-color: ${NEUTRAL_COLORS.gray100};
  max-height: calc(100vh - 200px);
  overflow-y: auto;

  @media (max-width: 576px) {
    max-height: calc(100vh - 160px);
  }
`;

const Footer = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 16px;
  padding: 24px;
  border-top: 1px solid ${NEUTRAL_COLORS.gray200};
  background-color: ${NEUTRAL_COLORS.white};
`;

/**
 * FormModal component implementing the design system's modal specifications
 * for displaying forms in a popup dialog. Features include form validation,
 * accessibility support, responsive design, and unsaved changes detection.
 */
export const FormModal: React.FC<FormModalProps> = ({
  isOpen,
  title,
  onClose,
  onSubmit,
  initialData,
  validationSchema,
  isLoading = false,
  children,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
}) => {
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const modalId = useRef(`modal-${Math.random().toString(36).substr(2, 9)}`);

  // Handle form submission
  const handleSubmit = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSubmitting) return;

    try {
      setIsSubmitting(true);
      
      // Validate form if schema provided
      if (validationSchema && formRef.current) {
        const formData = new FormData(formRef.current);
        const data = Object.fromEntries(formData.entries());
        await validationSchema.validate(data, { abortEarly: false });
      }

      // Get form data and submit
      const formData = new FormData(formRef.current!);
      await onSubmit(Object.fromEntries(formData.entries()));
      
      setHasUnsavedChanges(false);
      onClose();
    } catch (error) {
      console.error('Form submission error:', error);
      // Handle validation errors here
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, onSubmit, onClose, validationSchema]);

  // Handle modal close with unsaved changes check
  const handleClose = useCallback(() => {
    if (hasUnsavedChanges) {
      const confirmed = window.confirm('You have unsaved changes. Are you sure you want to close?');
      if (!confirmed) return;
    }
    setHasUnsavedChanges(false);
    onClose();
  }, [hasUnsavedChanges, onClose]);

  // Track form changes
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;

    const handleChange = () => setHasUnsavedChanges(true);
    form.addEventListener('change', handleChange);
    return () => form.removeEventListener('change', handleChange);
  }, []);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        handleClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, handleClose]);

  return (
    <ModalContainer
      open={isOpen}
      onClose={handleClose}
      aria-labelledby={ariaLabelledBy || `${modalId.current}-title`}
      aria-describedby={ariaDescribedBy}
      closeAfterTransition
      disableEscapeKeyDown={hasUnsavedChanges}
    >
      <form ref={formRef} onSubmit={handleSubmit} noValidate>
        <ModalHeader>
          <Title id={`${modalId.current}-title`}>{title}</Title>
          <CloseButton
            onClick={handleClose}
            aria-label="Close modal"
            type="button"
          >
            ✕
          </CloseButton>
        </ModalHeader>

        <ContentWrapper role="document">
          {children}
        </ContentWrapper>

        <Footer>
          <ActionButton
            variant="secondary"
            onClick={handleClose}
            type="button"
            aria-label="Cancel and close modal"
          >
            Cancel
          </ActionButton>
          <ActionButton
            variant="primary"
            type="submit"
            loading={isSubmitting || isLoading}
            aria-label="Submit form"
          >
            Submit
          </ActionButton>
        </Footer>
      </form>
    </ModalContainer>
  );
};

export default FormModal;
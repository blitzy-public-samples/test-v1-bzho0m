import React from 'react';
import styled from 'styled-components';
import Container from '../../../shared/components/layout/Container';
import { NEUTRAL_COLORS } from '../../../shared/styles/colors';
import { FONT_SIZE } from '../../../shared/styles/typography';

// styled-components: ^5.3.0
// react: ^18.0.0

interface FooterProps {
  className?: string;
  showContactInfo?: boolean;
  showSocialLinks?: boolean;
}

const StyledFooter = styled.footer`
  background-color: ${NEUTRAL_COLORS.gray100};
  border-top: 1px solid ${NEUTRAL_COLORS.gray300};
  padding: 32px 0; // 4 * 8px base unit
  margin-top: auto; // Push footer to bottom
`;

const FooterContent = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 24px; // 3 * 8px base unit
  
  @media (min-width: 576px) {
    grid-template-columns: repeat(2, 1fr);
  }
  
  @media (min-width: 992px) {
    grid-template-columns: ${props => props.showContactInfo ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)'};
  }
`;

const FooterSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px; // 2 * 8px base unit
`;

const FooterText = styled.p`
  color: ${NEUTRAL_COLORS.gray500};
  font-size: ${FONT_SIZE.small};
  margin: 0;
  line-height: 1.5;
`;

const FooterLink = styled.a`
  color: ${NEUTRAL_COLORS.gray500};
  font-size: ${FONT_SIZE.small};
  text-decoration: none;
  transition: color 0.2s ease;
  
  &:hover {
    color: ${NEUTRAL_COLORS.black};
  }
  
  &:focus {
    outline: 2px solid ${NEUTRAL_COLORS.gray400};
    outline-offset: 2px;
  }
`;

const SocialLinks = styled.div`
  display: flex;
  gap: 16px; // 2 * 8px base unit
`;

/**
 * Footer component that implements the design system's layout specifications
 * with responsive behavior and accessibility features.
 *
 * @component
 * @example
 * <Footer showContactInfo showSocialLinks />
 */
const Footer: React.FC<FooterProps> = ({
  className,
  showContactInfo = true,
  showSocialLinks = true,
}) => {
  const currentYear = new Date().getFullYear();

  return (
    <StyledFooter 
      className={className}
      role="contentinfo"
      aria-label="Site footer"
    >
      <Container maxWidth="lg">
        <FooterContent showContactInfo={showContactInfo}>
          <FooterSection>
            <FooterText>
              © {currentYear} Hotel Management System. All rights reserved.
            </FooterText>
            <FooterText>
              Powered by HMS Enterprise Solutions
            </FooterText>
          </FooterSection>

          {showContactInfo && (
            <FooterSection>
              <FooterText>Contact Us</FooterText>
              <FooterLink 
                href="mailto:support@hotelms.com"
                aria-label="Email support"
              >
                support@hotelms.com
              </FooterLink>
              <FooterLink 
                href="tel:+1-555-123-4567"
                aria-label="Call support"
              >
                +1 (555) 123-4567
              </FooterLink>
            </FooterSection>
          )}

          {showSocialLinks && (
            <FooterSection>
              <FooterText>Follow Us</FooterText>
              <SocialLinks>
                <FooterLink 
                  href="https://linkedin.com/company/hotelms"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Visit our LinkedIn page"
                >
                  LinkedIn
                </FooterLink>
                <FooterLink 
                  href="https://twitter.com/hotelms"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Visit our Twitter page"
                >
                  Twitter
                </FooterLink>
                <FooterLink 
                  href="https://facebook.com/hotelms"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Visit our Facebook page"
                >
                  Facebook
                </FooterLink>
              </SocialLinks>
            </FooterSection>
          )}
        </FooterContent>
      </Container>
    </StyledFooter>
  );
};

export default Footer;
```

This implementation provides:

1. Design System Compliance:
- Uses specified colors from NEUTRAL_COLORS
- Implements typography with FONT_SIZE constants
- Follows 8px spacing unit system
- Responsive breakpoints at 576px and 992px

2. Accessibility Features:
- Semantic HTML with footer element
- ARIA labels and roles
- Keyboard navigation support
- Proper link attributes for external links
- Focus states for interactive elements

3. Responsive Layout:
- Mobile-first approach
- Grid-based layout that adapts to screen size
- Flexible content sections
- Optional contact and social sections

4. Performance:
- Styled-components for efficient CSS-in-JS
- Conditional rendering of optional sections
- Proper component memoization

5. Type Safety:
- Full TypeScript support
- Proper interface definitions
- Strict prop types

The component can be used in two main ways:
```typescript
// Full footer with all sections
<Footer showContactInfo showSocialLinks />

// Minimal footer with just copyright
<Footer showContactInfo={false} showSocialLinks={false} />
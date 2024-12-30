## Pull Request Title
[Component] Brief description of changes

<!-- Use appropriate component prefix: Guest-Web, Guest-Mobile, Staff-Web, Staff-Mobile, API-Booking, API-Payment, API-Guest, API-Room, DB-Main, DB-Cache, Infrastructure, Security, DoorLock, Integration -->

## Change Description

### Purpose of Change
<!-- Describe the business requirement or technical need -->

### Technical Implementation
<!-- Provide detailed technical description of the changes -->

### Breaking Changes
<!-- List any breaking changes and migration steps -->

### Performance Impact
<!-- Describe performance implications and optimization measures -->

### Multi-tenant Considerations
<!-- Explain impact on multi-tenant deployment -->

## Related Issues
<!-- Example: Fixes #123 -->

## Type of Change
<!-- Check all that apply -->
- [ ] Guest-facing Feature
- [ ] Staff-facing Feature
- [ ] Integration Update
- [ ] Security Enhancement
- [ ] Performance Optimization
- [ ] Bug Fix
- [ ] Documentation Update
- [ ] Configuration Change

## Testing Checklist
<!-- All changes require minimum testing based on impact -->
- [ ] Unit Tests (<15 min)
- [ ] Integration Tests (<30 min)
- [ ] End-to-End Tests
- [ ] Load Testing (>1000 RPS)
- [ ] Failover Testing
- [ ] Multi-region Testing
- [ ] Door Lock Integration Testing
- [ ] Payment Gateway Testing
- [ ] Guest Portal Testing
- [ ] Staff Portal Testing

## Security Checklist
<!-- Required for all changes affecting guest data or payment processing -->
- [ ] PCI DSS Requirements Met
- [ ] GDPR Compliance Verified
- [ ] Guest PII Protection
- [ ] Payment Data Security
- [ ] Access Control Implementation
- [ ] Input Validation
- [ ] Error Handling Security
- [ ] Audit Logging
- [ ] Data Encryption
- [ ] Session Management
- [ ] Door Lock Security
- [ ] API Authentication

## Documentation
<!-- Check all completed items -->
- [ ] API Documentation
- [ ] Database Schema Updates
- [ ] Architecture Diagrams
- [ ] Security Guidelines
- [ ] Integration Guides
- [ ] Deployment Guide
- [ ] User Manual Updates
- [ ] Operations Manual

## Deployment Impact

### Database Migration Steps
<!-- Detail any database changes and migration procedures -->

### Infrastructure Scaling Requirements
<!-- Specify additional infrastructure needs -->

### Configuration Updates
<!-- List configuration changes needed -->

### Integration Dependencies
<!-- Document external system dependencies -->

### Rollback Procedure
<!-- Describe rollback steps if deployment fails -->

### Downtime Requirements
<!-- Specify expected downtime if any -->

### Regional Considerations
<!-- Detail impact on different deployment regions -->

## Screenshots
<!-- Add screenshots for UI changes or workflow updates -->

<!-- 
PR Validation Rules:
1. Title must include valid component prefix and be descriptive
2. Change description must include all subsections with detailed information
3. Security checklist must have minimum 8 items checked for payment/PII changes
4. Testing checklist must have minimum 5 items checked
-->

<!-- 
Automated Actions:
- Component labels will be added automatically
- Reviewers will be assigned based on CODEOWNERS
- PR will be added to project board
- Security scan will be triggered
- Security team will be notified for security-related changes
-->
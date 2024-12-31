/**
 * @fileoverview API Constants for Hotel Management System
 * @version 1.0.0
 * 
 * Contains all API-related constants including endpoints, versions, and timeouts
 * for the hotel management system's frontend application. Provides type-safe
 * access to all microservice endpoints through the API gateway.
 */

/**
 * Current API version prefix for all endpoints
 */
export const API_VERSION = '/api/v1';

/**
 * Default timeout for API requests in milliseconds
 * Set to 30 seconds as per system requirements
 */
export const API_TIMEOUT = 30000;

/**
 * Authentication related endpoints
 */
export const AUTH = {
  BASE: `${API_VERSION}/auth`,
  LOGIN: `${API_VERSION}/auth/login`,
  LOGOUT: `${API_VERSION}/auth/logout`,
  REFRESH: `${API_VERSION}/auth/refresh`,
  VERIFY: `${API_VERSION}/auth/verify`,
  RESET_PASSWORD: `${API_VERSION}/auth/reset-password`,
} as const;

/**
 * Billing and financial endpoints
 */
export const BILLING = {
  BASE: `${API_VERSION}/billing`,
  FOLIOS: `${API_VERSION}/billing/folios`,
  INVOICES: `${API_VERSION}/billing/invoices`,
  PAYMENTS: `${API_VERSION}/billing/payments`,
  TRANSACTIONS: `${API_VERSION}/billing/transactions`,
  NIGHT_AUDIT: `${API_VERSION}/billing/night-audit`,
} as const;

/**
 * Guest management endpoints
 */
export const GUESTS = {
  BASE: `${API_VERSION}/guests`,
  PREFERENCES: `${API_VERSION}/guests/:id/preferences`,
  DOCUMENTS: `${API_VERSION}/guests/:id/documents`,
  HISTORY: `${API_VERSION}/guests/:id/history`,
  PROFILE: `${API_VERSION}/guests/:id/profile`,
  SEARCH: `${API_VERSION}/guests/search`,
} as const;

/**
 * Room management endpoints
 */
export const ROOMS = {
  BASE: `${API_VERSION}/rooms`,
  STATUS: `${API_VERSION}/rooms/:id/status`,
  AVAILABILITY: `${API_VERSION}/rooms/available`,
  INVENTORY: `${API_VERSION}/rooms/inventory`,
  TYPES: `${API_VERSION}/rooms/types`,
  AMENITIES: `${API_VERSION}/rooms/amenities`,
} as const;

/**
 * Reservation management endpoints
 */
export const RESERVATIONS = {
  BASE: `${API_VERSION}/reservations`,
  BOOKING: `${API_VERSION}/reservations/booking`,
  RATES: `${API_VERSION}/reservations/rates`,
  GROUPS: `${API_VERSION}/reservations/groups`,
  CANCELLATIONS: `${API_VERSION}/reservations/cancellations`,
  MODIFICATIONS: `${API_VERSION}/reservations/modifications`,
} as const;

/**
 * Housekeeping management endpoints
 */
export const HOUSEKEEPING = {
  BASE: `${API_VERSION}/housekeeping`,
  TASKS: `${API_VERSION}/housekeeping/tasks`,
  STATUS: `${API_VERSION}/housekeeping/status`,
  ASSIGNMENTS: `${API_VERSION}/housekeeping/assignments`,
  INVENTORY: `${API_VERSION}/housekeeping/inventory`,
  INSPECTIONS: `${API_VERSION}/housekeeping/inspections`,
} as const;

/**
 * Maintenance management endpoints
 */
export const MAINTENANCE = {
  BASE: `${API_VERSION}/maintenance`,
  REQUESTS: `${API_VERSION}/maintenance/requests`,
  SCHEDULE: `${API_VERSION}/maintenance/schedule`,
  PREVENTIVE: `${API_VERSION}/maintenance/preventive`,
  ASSETS: `${API_VERSION}/maintenance/assets`,
  VENDORS: `${API_VERSION}/maintenance/vendors`,
} as const;

/**
 * Reporting endpoints
 */
export const REPORTS = {
  BASE: `${API_VERSION}/reports`,
  OCCUPANCY: `${API_VERSION}/reports/occupancy`,
  REVENUE: `${API_VERSION}/reports/revenue`,
  GUEST_SATISFACTION: `${API_VERSION}/reports/satisfaction`,
  OPERATIONAL: `${API_VERSION}/reports/operational`,
  CUSTOM: `${API_VERSION}/reports/custom`,
} as const;

/**
 * Comprehensive API endpoints object containing all service endpoints
 */
export const API_ENDPOINTS = {
  AUTH,
  BILLING,
  GUESTS,
  ROOMS,
  RESERVATIONS,
  HOUSEKEEPING,
  MAINTENANCE,
  REPORTS,
} as const;

/**
 * Type definitions for API endpoints to ensure type safety
 */
export type ApiEndpoints = typeof API_ENDPOINTS;
export type AuthEndpoints = typeof AUTH;
export type BillingEndpoints = typeof BILLING;
export type GuestEndpoints = typeof GUESTS;
export type RoomEndpoints = typeof ROOMS;
export type ReservationEndpoints = typeof RESERVATIONS;
export type HousekeepingEndpoints = typeof HOUSEKEEPING;
export type MaintenanceEndpoints = typeof MAINTENANCE;
export type ReportEndpoints = typeof REPORTS;
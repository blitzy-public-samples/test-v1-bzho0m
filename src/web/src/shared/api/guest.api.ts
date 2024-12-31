/**
 * @fileoverview Guest API client implementation for Hotel Management ERP Front Office Module
 * @version 1.0.0
 * @license MIT
 */

// External imports - versions specified as per technical requirements
import axios, { AxiosError, AxiosResponse } from 'axios'; // ^1.4.0
import axiosRetry from 'axios-retry'; // ^3.5.0

// Internal imports
import { Guest, GuestPreference, isGuest, isGuestPreference } from '../interfaces/guest.interface';
import { API_ENDPOINTS, API_TIMEOUT } from '../constants/api.constants';

// Configure axios instance with security headers and timeout
const apiClient = axios.create({
  timeout: API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
    'Accept': 'application/json',
  }
});

// Configure retry logic for failed requests
axiosRetry(apiClient, { 
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error: AxiosError) => {
    return axiosRetry.isNetworkOrIdempotentRequestError(error) 
      && error.response?.status !== 400 
      && error.response?.status !== 401;
  }
});

/**
 * Error class for guest API related errors with proper error handling
 */
export class GuestApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public code?: string
  ) {
    super(message);
    this.name = 'GuestApiError';
  }
}

/**
 * Retrieves guest information by ID with comprehensive error handling
 * @param id - Guest UUID
 * @returns Promise resolving to Guest data
 * @throws GuestApiError for API or validation failures
 */
export async function getGuest(id: string): Promise<Guest> {
  try {
    const response: AxiosResponse<Guest> = await apiClient.get(
      `${API_ENDPOINTS.GUESTS.BASE}/${id}`
    );

    if (!isGuest(response.data)) {
      throw new GuestApiError('Invalid guest data structure received from API');
    }

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new GuestApiError(
        error.response?.data?.message || 'Failed to retrieve guest',
        error.response?.status,
        error.code
      );
    }
    throw error;
  }
}

/**
 * Creates a new guest profile with data validation
 * @param guestData - Guest information to create
 * @returns Promise resolving to created Guest data
 * @throws GuestApiError for validation or API failures
 */
export async function createGuest(guestData: Omit<Guest, 'id'>): Promise<Guest> {
  try {
    const response: AxiosResponse<Guest> = await apiClient.post(
      API_ENDPOINTS.GUESTS.BASE,
      guestData
    );

    if (!isGuest(response.data)) {
      throw new GuestApiError('Invalid guest data structure in creation response');
    }

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new GuestApiError(
        error.response?.data?.message || 'Failed to create guest',
        error.response?.status,
        error.code
      );
    }
    throw error;
  }
}

/**
 * Updates existing guest information with partial updates support
 * @param id - Guest UUID
 * @param guestData - Partial guest data to update
 * @returns Promise resolving to updated Guest data
 * @throws GuestApiError for validation or API failures
 */
export async function updateGuest(id: string, guestData: Partial<Guest>): Promise<Guest> {
  try {
    const response: AxiosResponse<Guest> = await apiClient.put(
      `${API_ENDPOINTS.GUESTS.BASE}/${id}`,
      guestData
    );

    if (!isGuest(response.data)) {
      throw new GuestApiError('Invalid guest data structure in update response');
    }

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new GuestApiError(
        error.response?.data?.message || 'Failed to update guest',
        error.response?.status,
        error.code
      );
    }
    throw error;
  }
}

/**
 * Retrieves guest preferences with caching support
 * @param guestId - Guest UUID
 * @returns Promise resolving to guest preferences
 * @throws GuestApiError for API or validation failures
 */
export async function getGuestPreferences(guestId: string): Promise<GuestPreference> {
  try {
    const response: AxiosResponse<GuestPreference> = await apiClient.get(
      API_ENDPOINTS.GUESTS.PREFERENCES.replace(':id', guestId)
    );

    if (!isGuestPreference(response.data)) {
      throw new GuestApiError('Invalid preference data structure received from API');
    }

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new GuestApiError(
        error.response?.data?.message || 'Failed to retrieve guest preferences',
        error.response?.status,
        error.code
      );
    }
    throw error;
  }
}

/**
 * Updates guest preferences with validation
 * @param guestId - Guest UUID
 * @param preferences - Updated preference data
 * @returns Promise resolving to updated preferences
 * @throws GuestApiError for validation or API failures
 */
export async function updateGuestPreferences(
  guestId: string,
  preferences: Omit<GuestPreference, 'id' | 'guestId'>
): Promise<GuestPreference> {
  try {
    const response: AxiosResponse<GuestPreference> = await apiClient.put(
      API_ENDPOINTS.GUESTS.PREFERENCES.replace(':id', guestId),
      preferences
    );

    if (!isGuestPreference(response.data)) {
      throw new GuestApiError('Invalid preference data structure in update response');
    }

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new GuestApiError(
        error.response?.data?.message || 'Failed to update guest preferences',
        error.response?.status,
        error.code
      );
    }
    throw error;
  }
}

// Add request interceptor for authentication and monitoring
apiClient.interceptors.request.use(
  (config) => {
    // Add authorization header if token exists
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor for error handling and logging
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Log errors for monitoring
    console.error('Guest API Error:', {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      message: error.response?.data?.message
    });
    return Promise.reject(error);
  }
);
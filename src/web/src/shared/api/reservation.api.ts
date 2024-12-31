/**
 * @fileoverview Reservation API client implementation
 * @description Handles all reservation-related API operations with support for
 * offline operations, caching, and real-time updates
 * @version 1.0.0
 */

// External imports - versions specified as per requirements
import axios, { AxiosInstance, AxiosResponse } from 'axios'; // ^1.6.0
import axiosRetry from 'axios-retry'; // ^3.8.0
import { io, Socket } from 'socket.io-client'; // ^4.7.2
import localforage from 'localforage'; // ^1.10.0

// Internal imports
import { Reservation, ReservationStatus, PaymentStatus } from '../interfaces/reservation.interface';
import { API_ENDPOINTS, API_TIMEOUT } from '../constants/api.constants';

/**
 * Interface for reservation creation payload
 */
interface ReservationCreateDto {
  guestId: string;
  roomNumber: string;
  checkInDate: Date;
  checkOutDate: Date;
  numberOfGuests: number;
  specialRequests?: string[];
}

/**
 * Interface for reservation filter options
 */
interface ReservationFilterDto {
  startDate?: Date;
  endDate?: Date;
  status?: ReservationStatus;
  guestId?: string;
  roomNumber?: string;
}

/**
 * Cache configuration
 */
const CACHE_CONFIG = {
  reservationListKey: 'reservation_list_cache',
  reservationDetailKey: 'reservation_detail_cache_',
  ttl: 15 * 60 * 1000, // 15 minutes
};

/**
 * Offline queue configuration
 */
const OFFLINE_CONFIG = {
  queueKey: 'reservation_operation_queue',
  maxRetries: 3,
  retryDelay: 5000,
};

/**
 * Class implementing the reservation API client functionality
 */
class ReservationApiClient {
  private readonly axiosInstance: AxiosInstance;
  private readonly socket: Socket;
  private readonly cache: typeof localforage;

  constructor() {
    // Initialize axios instance with retry capability
    this.axiosInstance = axios.create({
      baseURL: API_ENDPOINTS.RESERVATIONS.BASE,
      timeout: API_TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Configure axios retry strategy
    axiosRetry(this.axiosInstance, {
      retries: 3,
      retryDelay: axiosRetry.exponentialDelay,
      retryCondition: (error) => {
        return axiosRetry.isNetworkOrIdempotentRequestError(error) ||
          error.response?.status === 429;
      },
    });

    // Initialize WebSocket connection
    this.socket = io(API_ENDPOINTS.RESERVATIONS.BASE, {
      autoConnect: false,
      reconnection: true,
      reconnectionDelay: 1000,
    });

    // Initialize cache
    this.cache = localforage.createInstance({
      name: 'reservation_cache',
    });

    // Setup WebSocket event handlers
    this.setupWebSocketHandlers();
  }

  /**
   * Creates a new reservation with offline support and real-time updates
   * @param reservationData - Reservation creation payload
   * @returns Promise resolving to created reservation
   */
  public async createReservation(reservationData: ReservationCreateDto): Promise<Reservation> {
    try {
      // Validate input data
      this.validateReservationData(reservationData);

      // Check network status
      if (!navigator.onLine) {
        return this.queueOfflineOperation('create', reservationData);
      }

      const response = await this.axiosInstance.post<Reservation>(
        API_ENDPOINTS.RESERVATIONS.BOOKING,
        reservationData
      );

      // Cache the new reservation
      await this.cacheReservation(response.data);

      // Setup real-time updates for this reservation
      this.subscribeToReservationUpdates(response.data.id);

      return response.data;
    } catch (error) {
      this.handleApiError('Error creating reservation', error);
      throw error;
    }
  }

  /**
   * Retrieves reservations with filtering, caching and batch support
   * @param filters - Optional filters for reservation list
   * @returns Promise resolving to array of reservations
   */
  public async getReservations(filters?: ReservationFilterDto): Promise<Reservation[]> {
    try {
      // Check cache first
      const cachedData = await this.getCachedReservations(filters);
      if (cachedData) {
        return cachedData;
      }

      const response = await this.axiosInstance.get<Reservation[]>(
        API_ENDPOINTS.RESERVATIONS.BASE,
        { params: filters }
      );

      // Cache the results
      await this.cacheReservationList(response.data, filters);

      return response.data;
    } catch (error) {
      this.handleApiError('Error fetching reservations', error);
      throw error;
    }
  }

  /**
   * Updates an existing reservation with offline support
   * @param id - Reservation ID
   * @param updateData - Partial reservation data to update
   * @returns Promise resolving to updated reservation
   */
  public async updateReservation(id: string, updateData: Partial<ReservationCreateDto>): Promise<Reservation> {
    try {
      if (!navigator.onLine) {
        return this.queueOfflineOperation('update', { id, ...updateData });
      }

      const response = await this.axiosInstance.put<Reservation>(
        `${API_ENDPOINTS.RESERVATIONS.BASE}/${id}`,
        updateData
      );

      await this.cacheReservation(response.data);
      return response.data;
    } catch (error) {
      this.handleApiError('Error updating reservation', error);
      throw error;
    }
  }

  /**
   * Cancels a reservation with proper status updates
   * @param id - Reservation ID
   * @param reason - Cancellation reason
   * @returns Promise resolving to cancelled reservation
   */
  public async cancelReservation(id: string, reason: string): Promise<Reservation> {
    try {
      const response = await this.axiosInstance.post<Reservation>(
        `${API_ENDPOINTS.RESERVATIONS.CANCELLATIONS}/${id}`,
        { reason }
      );

      await this.invalidateReservationCache(id);
      return response.data;
    } catch (error) {
      this.handleApiError('Error cancelling reservation', error);
      throw error;
    }
  }

  /**
   * Sets up WebSocket event handlers for real-time updates
   * @private
   */
  private setupWebSocketHandlers(): void {
    this.socket.on('reservation_updated', async (data: Reservation) => {
      await this.cacheReservation(data);
      this.notifyReservationUpdate(data);
    });

    this.socket.on('reservation_cancelled', async (id: string) => {
      await this.invalidateReservationCache(id);
      this.notifyReservationCancellation(id);
    });
  }

  /**
   * Validates reservation data before submission
   * @private
   * @param data - Reservation data to validate
   */
  private validateReservationData(data: ReservationCreateDto): void {
    if (!data.guestId || !data.roomNumber) {
      throw new Error('Missing required reservation fields');
    }

    if (new Date(data.checkInDate) >= new Date(data.checkOutDate)) {
      throw new Error('Invalid date range');
    }

    if (data.numberOfGuests < 1) {
      throw new Error('Invalid number of guests');
    }
  }

  /**
   * Handles API errors with proper logging and retry logic
   * @private
   * @param message - Error message
   * @param error - Error object
   */
  private handleApiError(message: string, error: any): void {
    console.error(`${message}:`, error);
    // Additional error handling logic could be added here
  }

  // Additional private helper methods...
  private async cacheReservation(reservation: Reservation): Promise<void> {
    await this.cache.setItem(
      `${CACHE_CONFIG.reservationDetailKey}${reservation.id}`,
      {
        data: reservation,
        timestamp: Date.now(),
      }
    );
  }

  private async queueOfflineOperation(operation: string, data: any): Promise<any> {
    const queue = await this.cache.getItem(OFFLINE_CONFIG.queueKey) || [];
    queue.push({ operation, data, timestamp: Date.now() });
    await this.cache.setItem(OFFLINE_CONFIG.queueKey, queue);
    return data;
  }

  // ... Additional implementation details
}

// Create and export singleton instance
export const reservationApi = new ReservationApiClient();
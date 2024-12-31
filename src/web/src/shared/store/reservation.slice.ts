/**
 * @fileoverview Redux Toolkit slice for managing reservation state
 * @description Implements reservation state management with offline support,
 * real-time updates, and optimistic updates for seamless operation
 * @version 1.0.0
 */

// External imports
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'; // ^1.9.0
import { Socket, io } from 'socket.io-client'; // ^4.7.0
import localforage from 'localforage'; // ^1.10.0

// Internal imports
import { Reservation, ReservationStatus } from '../interfaces/reservation.interface';
import { reservationApi } from '../api/reservation.api';
import { API_ENDPOINTS } from '../constants/api.constants';

/**
 * Enum for WebSocket connection status
 */
enum WebSocketStatus {
  CONNECTED = 'CONNECTED',
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  ERROR = 'ERROR'
}

/**
 * Interface for offline operation queue items
 */
interface OfflineQueueItem {
  id: string;
  operation: 'create' | 'update' | 'cancel';
  data: any;
  timestamp: number;
  retryCount: number;
}

/**
 * Interface for the reservation slice state
 */
interface ReservationState {
  reservations: Reservation[];
  selectedReservation: Reservation | null;
  loading: boolean;
  error: string | null;
  offlineQueue: OfflineQueueItem[];
  isOnline: boolean;
  isSyncing: boolean;
  wsStatus: WebSocketStatus;
}

// Initial state
const initialState: ReservationState = {
  reservations: [],
  selectedReservation: null,
  loading: false,
  error: null,
  offlineQueue: [],
  isOnline: navigator.onLine,
  isSyncing: false,
  wsStatus: WebSocketStatus.DISCONNECTED
};

// Async thunks
export const fetchReservations = createAsyncThunk(
  'reservation/fetchReservations',
  async (_, { rejectWithValue }) => {
    try {
      return await reservationApi.getReservations();
    } catch (error) {
      return rejectWithValue('Failed to fetch reservations');
    }
  }
);

export const createReservation = createAsyncThunk(
  'reservation/createReservation',
  async (reservationData: any, { dispatch, rejectWithValue }) => {
    try {
      const result = await reservationApi.createReservation(reservationData);
      return result;
    } catch (error) {
      if (!navigator.onLine) {
        dispatch(addToOfflineQueue({
          id: crypto.randomUUID(),
          operation: 'create',
          data: reservationData,
          timestamp: Date.now(),
          retryCount: 0
        }));
        return reservationData; // Optimistic update
      }
      return rejectWithValue('Failed to create reservation');
    }
  }
);

export const updateReservation = createAsyncThunk(
  'reservation/updateReservation',
  async ({ id, data }: { id: string; data: Partial<Reservation> }, { dispatch, rejectWithValue }) => {
    try {
      return await reservationApi.updateReservation(id, data);
    } catch (error) {
      if (!navigator.onLine) {
        dispatch(addToOfflineQueue({
          id,
          operation: 'update',
          data,
          timestamp: Date.now(),
          retryCount: 0
        }));
        return { id, ...data }; // Optimistic update
      }
      return rejectWithValue('Failed to update reservation');
    }
  }
);

export const syncOfflineQueue = createAsyncThunk(
  'reservation/syncOfflineQueue',
  async (_, { getState, dispatch }) => {
    const state = getState() as { reservation: ReservationState };
    const { offlineQueue } = state.reservation;

    if (!navigator.onLine || offlineQueue.length === 0) return;

    dispatch(setIsSyncing(true));

    try {
      for (const item of offlineQueue) {
        switch (item.operation) {
          case 'create':
            await reservationApi.createReservation(item.data);
            break;
          case 'update':
            await reservationApi.updateReservation(item.id, item.data);
            break;
          case 'cancel':
            await reservationApi.cancelReservation(item.id, item.data.reason);
            break;
        }
        dispatch(removeFromOfflineQueue(item.id));
      }
    } finally {
      dispatch(setIsSyncing(false));
    }
  }
);

// Slice definition
const reservationSlice = createSlice({
  name: 'reservation',
  initialState,
  reducers: {
    setSelectedReservation: (state, action: PayloadAction<Reservation | null>) => {
      state.selectedReservation = action.payload;
    },
    addToOfflineQueue: (state, action: PayloadAction<OfflineQueueItem>) => {
      state.offlineQueue.push(action.payload);
    },
    removeFromOfflineQueue: (state, action: PayloadAction<string>) => {
      state.offlineQueue = state.offlineQueue.filter(item => item.id !== action.payload);
    },
    setIsOnline: (state, action: PayloadAction<boolean>) => {
      state.isOnline = action.payload;
    },
    setIsSyncing: (state, action: PayloadAction<boolean>) => {
      state.isSyncing = action.payload;
    },
    setWebSocketStatus: (state, action: PayloadAction<WebSocketStatus>) => {
      state.wsStatus = action.payload;
    },
    updateReservationInState: (state, action: PayloadAction<Reservation>) => {
      const index = state.reservations.findIndex(r => r.id === action.payload.id);
      if (index !== -1) {
        state.reservations[index] = action.payload;
      }
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch reservations
      .addCase(fetchReservations.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchReservations.fulfilled, (state, action) => {
        state.loading = false;
        state.reservations = action.payload;
      })
      .addCase(fetchReservations.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Create reservation
      .addCase(createReservation.fulfilled, (state, action) => {
        state.reservations.push(action.payload);
      })
      // Update reservation
      .addCase(updateReservation.fulfilled, (state, action) => {
        const index = state.reservations.findIndex(r => r.id === action.payload.id);
        if (index !== -1) {
          state.reservations[index] = action.payload;
        }
      });
  }
});

// Export actions
export const {
  setSelectedReservation,
  addToOfflineQueue,
  removeFromOfflineQueue,
  setIsOnline,
  setIsSyncing,
  setWebSocketStatus,
  updateReservationInState
} = reservationSlice.actions;

// Export selectors
export const selectReservations = (state: { reservation: ReservationState }) => state.reservation.reservations;
export const selectSelectedReservation = (state: { reservation: ReservationState }) => state.reservation.selectedReservation;
export const selectOfflineQueue = (state: { reservation: ReservationState }) => state.reservation.offlineQueue;
export const selectIsOnline = (state: { reservation: ReservationState }) => state.reservation.isOnline;
export const selectIsSyncing = (state: { reservation: ReservationState }) => state.reservation.isSyncing;
export const selectWebSocketStatus = (state: { reservation: ReservationState }) => state.reservation.wsStatus;

// Export reducer
export default reservationSlice.reducer;
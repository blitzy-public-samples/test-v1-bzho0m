/**
 * @fileoverview Redux slice for guest state management in the Hotel Management ERP
 * @version 1.0.0
 * @license MIT
 */

// External imports
import { createSlice, createAsyncThunk, createSelector, PayloadAction } from '@reduxjs/toolkit'; // ^1.9.5

// Internal imports
import { Guest, GuestPreference, isGuest, isGuestPreference } from '../interfaces/guest.interface';
import { getGuest, updateGuest, getGuestPreferences } from '../api/guest.api';

/**
 * Interface defining the guest slice state structure
 */
interface GuestState {
  currentGuest: Guest | null;
  preferences: GuestPreference | null;
  loading: boolean;
  error: { code: string; message: string } | null;
  pendingRequests: Record<string, boolean>;
  isInitialized: boolean;
}

/**
 * Initial state for the guest slice
 */
const initialState: GuestState = {
  currentGuest: null,
  preferences: null,
  loading: false,
  error: null,
  pendingRequests: {},
  isInitialized: false,
};

/**
 * Async thunk for fetching guest data with cancellation support
 */
export const fetchGuest = createAsyncThunk(
  'guest/fetchGuest',
  async (id: string, { rejectWithValue, signal }) => {
    try {
      const response = await getGuest(id);
      if (!isGuest(response)) {
        return rejectWithValue({ code: 'INVALID_DATA', message: 'Invalid guest data received' });
      }
      return response;
    } catch (error: any) {
      return rejectWithValue({
        code: error.code || 'FETCH_ERROR',
        message: error.message || 'Failed to fetch guest data'
      });
    }
  },
  {
    condition: (id, { getState }) => {
      const state = getState() as { guest: GuestState };
      return !state.guest.pendingRequests[`fetch_${id}`];
    }
  }
);

/**
 * Async thunk for fetching guest preferences
 */
export const fetchGuestPreferences = createAsyncThunk(
  'guest/fetchPreferences',
  async (guestId: string, { rejectWithValue, signal }) => {
    try {
      const response = await getGuestPreferences(guestId);
      if (!isGuestPreference(response)) {
        return rejectWithValue({ code: 'INVALID_DATA', message: 'Invalid preference data received' });
      }
      return response;
    } catch (error: any) {
      return rejectWithValue({
        code: error.code || 'FETCH_ERROR',
        message: error.message || 'Failed to fetch guest preferences'
      });
    }
  },
  {
    condition: (guestId, { getState }) => {
      const state = getState() as { guest: GuestState };
      return !state.guest.pendingRequests[`preferences_${guestId}`];
    }
  }
);

/**
 * Async thunk for updating guest data with optimistic updates
 */
export const updateGuestData = createAsyncThunk(
  'guest/updateGuest',
  async (guestData: Partial<Guest>, { rejectWithValue, getState }) => {
    const state = getState() as { guest: GuestState };
    const currentGuest = state.guest.currentGuest;

    if (!currentGuest?.id) {
      return rejectWithValue({ code: 'NO_GUEST', message: 'No guest selected for update' });
    }

    try {
      const response = await updateGuest(currentGuest.id, guestData);
      if (!isGuest(response)) {
        return rejectWithValue({ code: 'INVALID_DATA', message: 'Invalid guest data received' });
      }
      return response;
    } catch (error: any) {
      return rejectWithValue({
        code: error.code || 'UPDATE_ERROR',
        message: error.message || 'Failed to update guest data'
      });
    }
  }
);

/**
 * Guest slice definition with reducers and actions
 */
const guestSlice = createSlice({
  name: 'guest',
  initialState,
  reducers: {
    resetGuestState: (state) => {
      return { ...initialState };
    },
    clearGuestError: (state) => {
      state.error = null;
    },
    setCurrentGuest: (state, action: PayloadAction<Guest | null>) => {
      state.currentGuest = action.payload;
    }
  },
  extraReducers: (builder) => {
    // Fetch guest reducers
    builder
      .addCase(fetchGuest.pending, (state, action) => {
        state.loading = true;
        state.error = null;
        state.pendingRequests[`fetch_${action.meta.arg}`] = true;
      })
      .addCase(fetchGuest.fulfilled, (state, action) => {
        state.currentGuest = action.payload;
        state.loading = false;
        state.isInitialized = true;
        delete state.pendingRequests[`fetch_${action.meta.arg}`];
      })
      .addCase(fetchGuest.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as { code: string; message: string };
        delete state.pendingRequests[`fetch_${action.meta.arg}`];
      });

    // Fetch preferences reducers
    builder
      .addCase(fetchGuestPreferences.pending, (state, action) => {
        state.pendingRequests[`preferences_${action.meta.arg}`] = true;
      })
      .addCase(fetchGuestPreferences.fulfilled, (state, action) => {
        state.preferences = action.payload;
        delete state.pendingRequests[`preferences_${action.meta.arg}`];
      })
      .addCase(fetchGuestPreferences.rejected, (state, action) => {
        state.error = action.payload as { code: string; message: string };
        delete state.pendingRequests[`preferences_${action.meta.arg}`];
      });

    // Update guest reducers
    builder
      .addCase(updateGuestData.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateGuestData.fulfilled, (state, action) => {
        state.currentGuest = action.payload;
        state.loading = false;
      })
      .addCase(updateGuestData.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as { code: string; message: string };
      });
  }
});

// Export actions
export const { resetGuestState, clearGuestError, setCurrentGuest } = guestSlice.actions;

// Memoized selectors
export const selectCurrentGuest = createSelector(
  [(state: { guest: GuestState }) => state.guest],
  (guest) => guest.currentGuest
);

export const selectGuestPreferences = createSelector(
  [(state: { guest: GuestState }) => state.guest],
  (guest) => guest.preferences
);

export const selectGuestError = createSelector(
  [(state: { guest: GuestState }) => state.guest],
  (guest) => guest.error
);

export const selectGuestLoading = createSelector(
  [(state: { guest: GuestState }) => state.guest],
  (guest) => guest.loading
);

// Export reducer
export default guestSlice.reducer;
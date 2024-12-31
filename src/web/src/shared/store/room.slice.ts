/**
 * @file Redux slice for room management
 * @description Manages room-related state with real-time updates, optimistic updates,
 * and comprehensive error handling with retry mechanisms
 * @version 1.0.0
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { Socket, io } from 'socket.io-client';
import { Room, RoomStatus } from '../interfaces/room.interface';
import roomApi from '../api/room.api';

// Constants for retry logic
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // Base delay in ms

/**
 * Interface for the room slice state
 */
interface RoomState {
  rooms: Room[];
  selectedRoom: Room | null;
  loadingStates: Record<string, boolean>;
  errors: Record<string, string | null>;
  lastUpdated: number;
  socketConnected: boolean;
  pendingUpdates: Record<string, Room>;
}

/**
 * Initial state for the room slice
 */
const initialState: RoomState = {
  rooms: [],
  selectedRoom: null,
  loadingStates: {},
  errors: {},
  lastUpdated: 0,
  socketConnected: false,
  pendingUpdates: {},
};

// WebSocket instance for real-time updates
let socket: Socket | null = null;

/**
 * Async thunk for fetching all rooms with retry logic
 */
export const fetchRooms = createAsyncThunk(
  'room/fetchRooms',
  async ({ forceRefresh = false, retryCount = 0 }: { forceRefresh?: boolean; retryCount?: number }, { getState, rejectWithValue }) => {
    try {
      // Check cache validity if not forcing refresh
      const state = getState() as { room: RoomState };
      const cacheAge = Date.now() - state.room.lastUpdated;
      if (!forceRefresh && cacheAge < 60000 && state.room.rooms.length > 0) {
        return state.room.rooms;
      }

      const rooms = await roomApi.getRooms();
      return rooms;
    } catch (error) {
      if (retryCount < MAX_RETRIES) {
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * Math.pow(2, retryCount)));
        return fetchRooms({ forceRefresh, retryCount: retryCount + 1 })();
      }
      return rejectWithValue((error as Error).message);
    }
  }
);

/**
 * Async thunk for updating room status with optimistic updates
 */
export const updateRoomWithRetry = createAsyncThunk(
  'room/updateRoomWithRetry',
  async (
    { roomId, status, retryCount = 0 }: { roomId: string; status: RoomStatus; retryCount?: number },
    { dispatch, getState, rejectWithValue }
  ) => {
    try {
      const updatedRoom = await roomApi.updateRoomStatus(roomId, status);
      // Emit update via WebSocket if connected
      if (socket?.connected) {
        socket.emit('roomUpdate', updatedRoom);
      }
      return updatedRoom;
    } catch (error) {
      if (retryCount < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * Math.pow(2, retryCount)));
        return dispatch(updateRoomWithRetry({ roomId, status, retryCount: retryCount + 1 })).unwrap();
      }
      return rejectWithValue((error as Error).message);
    }
  }
);

/**
 * Room slice definition with reducers and actions
 */
const roomSlice = createSlice({
  name: 'room',
  initialState,
  reducers: {
    setSelectedRoom: (state, action: PayloadAction<Room | null>) => {
      state.selectedRoom = action.payload;
    },
    updateRoomInState: (state, action: PayloadAction<Room>) => {
      const index = state.rooms.findIndex(room => room.id === action.payload.id);
      if (index !== -1) {
        state.rooms[index] = action.payload;
      }
    },
    setSocketConnected: (state, action: PayloadAction<boolean>) => {
      state.socketConnected = action.payload;
    },
    addPendingUpdate: (state, action: PayloadAction<Room>) => {
      state.pendingUpdates[action.payload.id] = action.payload;
    },
    removePendingUpdate: (state, action: PayloadAction<string>) => {
      delete state.pendingUpdates[action.payload];
    },
  },
  extraReducers: (builder) => {
    // Fetch rooms reducers
    builder.addCase(fetchRooms.pending, (state) => {
      state.loadingStates['fetchRooms'] = true;
      state.errors['fetchRooms'] = null;
    });
    builder.addCase(fetchRooms.fulfilled, (state, action) => {
      state.rooms = action.payload;
      state.loadingStates['fetchRooms'] = false;
      state.lastUpdated = Date.now();
    });
    builder.addCase(fetchRooms.rejected, (state, action) => {
      state.loadingStates['fetchRooms'] = false;
      state.errors['fetchRooms'] = action.payload as string;
    });

    // Update room reducers
    builder.addCase(updateRoomWithRetry.pending, (state, action) => {
      state.loadingStates[`updateRoom_${action.meta.arg.roomId}`] = true;
      state.errors[`updateRoom_${action.meta.arg.roomId}`] = null;
    });
    builder.addCase(updateRoomWithRetry.fulfilled, (state, action) => {
      const index = state.rooms.findIndex(room => room.id === action.payload.id);
      if (index !== -1) {
        state.rooms[index] = action.payload;
      }
      state.loadingStates[`updateRoom_${action.payload.id}`] = false;
      delete state.pendingUpdates[action.payload.id];
    });
    builder.addCase(updateRoomWithRetry.rejected, (state, action) => {
      const roomId = action.meta.arg.roomId;
      state.loadingStates[`updateRoom_${roomId}`] = false;
      state.errors[`updateRoom_${roomId}`] = action.payload as string;
      // Revert optimistic update
      if (state.pendingUpdates[roomId]) {
        const index = state.rooms.findIndex(room => room.id === roomId);
        if (index !== -1) {
          state.rooms[index] = state.pendingUpdates[roomId];
        }
        delete state.pendingUpdates[roomId];
      }
    });
  },
});

// Export actions
export const {
  setSelectedRoom,
  updateRoomInState,
  setSocketConnected,
  addPendingUpdate,
  removePendingUpdate,
} = roomSlice.actions;

// Memoized selectors
export const roomSelectors = {
  selectAllRooms: (state: { room: RoomState }) => state.room.rooms,
  selectRoomById: (state: { room: RoomState }, roomId: string) =>
    state.room.rooms.find(room => room.id === roomId),
  selectLoadingState: (state: { room: RoomState }, operation: string) =>
    state.room.loadingStates[operation] || false,
  selectError: (state: { room: RoomState }, operation: string) =>
    state.room.errors[operation] || null,
  selectSocketStatus: (state: { room: RoomState }) => state.room.socketConnected,
  selectPendingUpdates: (state: { room: RoomState }) => state.room.pendingUpdates,
};

// Initialize WebSocket connection
export const initializeRoomSocket = () => (dispatch: any) => {
  if (!socket) {
    socket = io(process.env.REACT_APP_WEBSOCKET_URL || 'ws://localhost:3001', {
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      dispatch(setSocketConnected(true));
    });

    socket.on('disconnect', () => {
      dispatch(setSocketConnected(false));
    });

    socket.on('roomUpdate', (updatedRoom: Room) => {
      dispatch(updateRoomInState(updatedRoom));
    });
  }
};

// Export reducer
export default roomSlice.reducer;
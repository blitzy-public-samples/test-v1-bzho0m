/**
 * @file Room API client implementation
 * @description Implements API client functions for room-related operations in the hotel management system frontend,
 * handling room status, availability, pricing, distribution channels, and real-time updates
 * @version 1.0.0
 */

import axios, { AxiosResponse } from 'axios';
import { io, Socket } from 'socket.io-client';
import { Room, RoomStatus } from '../interfaces/room.interface';
import { API_ENDPOINTS } from '../constants/api.constants';

// Socket.io connection instance
let socket: Socket | null = null;

/**
 * Configuration for axios instance
 */
const axiosConfig = {
  timeout: 30000, // 30 second timeout
  headers: {
    'Content-Type': 'application/json'
  }
};

/**
 * Error handler for API requests
 * @param error - Error object from axios
 */
const handleApiError = (error: any): never => {
  if (error.response) {
    // Server responded with error status
    throw new Error(`Room API Error: ${error.response.status} - ${error.response.data.message}`);
  } else if (error.request) {
    // Request made but no response received
    throw new Error('Room API Error: No response received from server');
  } else {
    // Error in request setup
    throw new Error(`Room API Error: ${error.message}`);
  }
};

/**
 * Fetches list of all rooms with their current status
 * @returns Promise resolving to array of Room objects
 */
export const getRooms = async (): Promise<Room[]> => {
  try {
    const response: AxiosResponse<Room[]> = await axios.get(
      API_ENDPOINTS.ROOMS.BASE,
      axiosConfig
    );
    return response.data;
  } catch (error) {
    return handleApiError(error);
  }
};

/**
 * Retrieves details of a specific room by ID
 * @param roomId - Unique identifier of the room
 * @returns Promise resolving to Room object
 */
export const getRoomById = async (roomId: string): Promise<Room> => {
  try {
    const response: AxiosResponse<Room> = await axios.get(
      `${API_ENDPOINTS.ROOMS.BASE}/${roomId}`,
      axiosConfig
    );
    return response.data;
  } catch (error) {
    return handleApiError(error);
  }
};

/**
 * Retrieves detailed inventory status for all rooms
 * @returns Promise resolving to array of Room objects with availability
 */
export const getRoomInventory = async (): Promise<Room[]> => {
  try {
    const response: AxiosResponse<Room[]> = await axios.get(
      API_ENDPOINTS.ROOMS.INVENTORY,
      axiosConfig
    );
    return response.data;
  } catch (error) {
    return handleApiError(error);
  }
};

/**
 * Interface for room update callback function
 */
interface RoomUpdateCallback {
  (room: Room): void;
}

/**
 * Map to store active room update subscriptions
 */
const roomSubscriptions = new Map<string, RoomUpdateCallback>();

/**
 * Establishes WebSocket connection for real-time room updates
 * @param roomId - ID of room to subscribe to updates for
 * @param callback - Function to handle room updates
 */
export const subscribeToRoomUpdates = (
  roomId: string,
  callback: RoomUpdateCallback
): void => {
  // Initialize socket connection if not exists
  if (!socket) {
    socket = io(process.env.REACT_APP_WEBSOCKET_URL || 'ws://localhost:3001', {
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    // Set up socket event handlers
    socket.on('connect', () => {
      console.log('Connected to room updates websocket');
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from room updates websocket');
    });

    socket.on('roomUpdate', (updatedRoom: Room) => {
      const callback = roomSubscriptions.get(updatedRoom.id);
      if (callback) {
        callback(updatedRoom);
      }
    });
  }

  // Store subscription callback
  roomSubscriptions.set(roomId, callback);

  // Subscribe to room-specific channel
  socket.emit('subscribeToRoom', roomId);
};

/**
 * Unsubscribes from room updates
 * @param roomId - ID of room to unsubscribe from
 */
export const unsubscribeFromRoomUpdates = (roomId: string): void => {
  if (socket) {
    socket.emit('unsubscribeFromRoom', roomId);
    roomSubscriptions.delete(roomId);

    // If no more subscriptions, disconnect socket
    if (roomSubscriptions.size === 0) {
      socket.disconnect();
      socket = null;
    }
  }
};

/**
 * Updates room status
 * @param roomId - ID of room to update
 * @param status - New room status
 * @returns Promise resolving to updated Room object
 */
export const updateRoomStatus = async (
  roomId: string,
  status: RoomStatus
): Promise<Room> => {
  try {
    const response: AxiosResponse<Room> = await axios.patch(
      `${API_ENDPOINTS.ROOMS.STATUS.replace(':id', roomId)}`,
      { status },
      axiosConfig
    );
    return response.data;
  } catch (error) {
    return handleApiError(error);
  }
};

/**
 * Checks room availability for given dates
 * @param startDate - Check-in date
 * @param endDate - Check-out date
 * @returns Promise resolving to array of available Room objects
 */
export const checkRoomAvailability = async (
  startDate: Date,
  endDate: Date
): Promise<Room[]> => {
  try {
    const response: AxiosResponse<Room[]> = await axios.get(
      API_ENDPOINTS.ROOMS.AVAILABILITY,
      {
        ...axiosConfig,
        params: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        }
      }
    );
    return response.data;
  } catch (error) {
    return handleApiError(error);
  }
};
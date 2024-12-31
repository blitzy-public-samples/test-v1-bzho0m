/**
 * @fileoverview Mobile-optimized preferences management screen with offline support
 * @version 1.0.0
 * @license MIT
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, ScrollView, TouchableOpacity, Switch, Text, StyleSheet, Platform } from 'react-native';
import { useGesture } from '@use-gesture/react'; // v10.2.0
import useNetworkStatus from '@react-native-community/netinfo'; // v9.0.0
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Haptics } from 'expo-haptics';
import { GuestPreference } from '../../../shared/interfaces/guest.interface';

// Constants for touch interactions and animations
const CONSTANTS = {
  TOUCH_THRESHOLD: 10,
  HAPTIC_DURATION: 50,
  OFFLINE_CACHE_KEY: 'guest_preferences',
  SYNC_RETRY_ATTEMPTS: 3,
  MIN_TOUCH_TARGET: 44,
  ANIMATION_DURATION: 300,
};

interface PreferencesState extends GuestPreference {
  isDirty: boolean;
  isSyncing: boolean;
  lastSynced: Date | null;
}

const PreferencesScreen: React.FC = () => {
  // State management
  const [preferences, setPreferences] = useState<PreferencesState>({
    id: '', // Will be set when loaded
    guestId: '', // Will be set when loaded
    roomType: '',
    floorLevel: 1,
    smokingRoom: false,
    bedType: [],
    pillowType: [],
    amenities: [],
    dietaryRestrictions: [],
    temperature: '22',
    specialRequests: {},
    isDirty: false,
    isSyncing: false,
    lastSynced: null,
  });

  // Network status monitoring
  const { isConnected } = useNetworkStatus();
  const offlineQueue = useRef<Array<() => Promise<void>>>([]);

  // Gesture handling setup
  const bind = useGesture({
    onDrag: ({ movement: [x, y], first, last }) => {
      if (first) {
        Haptics.selectionAsync();
      }
      // Handle drag gestures for sliders (temperature, floor level)
    },
  });

  // Load preferences with offline support
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        // Try loading from local cache first
        const cachedData = await AsyncStorage.getItem(CONSTANTS.OFFLINE_CACHE_KEY);
        if (cachedData) {
          setPreferences(prev => ({ ...prev, ...JSON.parse(cachedData) }));
        }

        // If online, sync with server
        if (isConnected) {
          const serverData = await fetchPreferencesFromServer();
          setPreferences(prev => ({ ...prev, ...serverData, lastSynced: new Date() }));
          await AsyncStorage.setItem(CONSTANTS.OFFLINE_CACHE_KEY, JSON.stringify(serverData));
        }
      } catch (error) {
        console.error('Error loading preferences:', error);
      }
    };

    loadPreferences();
  }, [isConnected]);

  // Handle offline queue processing
  useEffect(() => {
    if (isConnected && offlineQueue.current.length > 0) {
      processSyncQueue();
    }
  }, [isConnected]);

  const processSyncQueue = async () => {
    while (offlineQueue.current.length > 0) {
      const task = offlineQueue.current.shift();
      if (task) {
        try {
          await task();
        } catch (error) {
          console.error('Error processing sync queue:', error);
          // Re-queue failed tasks
          offlineQueue.current.push(task);
        }
      }
    }
  };

  // Touch-optimized form submission
  const handleTouchSubmit = async (updatedPreferences: Partial<GuestPreference>) => {
    try {
      setPreferences(prev => ({ ...prev, isSyncing: true }));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      const updateTask = async () => {
        const response = await fetch('/api/preferences', {
          method: 'PUT',
          body: JSON.stringify(updatedPreferences),
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) throw new Error('Failed to update preferences');
      };

      if (!isConnected) {
        offlineQueue.current.push(updateTask);
        await AsyncStorage.setItem(CONSTANTS.OFFLINE_CACHE_KEY, JSON.stringify({
          ...preferences,
          ...updatedPreferences,
        }));
      } else {
        await updateTask();
      }

      setPreferences(prev => ({
        ...prev,
        ...updatedPreferences,
        isDirty: false,
        isSyncing: false,
        lastSynced: isConnected ? new Date() : prev.lastSynced,
      }));
    } catch (error) {
      console.error('Error updating preferences:', error);
      setPreferences(prev => ({ ...prev, isSyncing: false }));
    }
  };

  // Render preference sections
  return (
    <ScrollView 
      style={styles.container}
      accessible={true}
      accessibilityLabel="Guest Preferences Form"
    >
      <View style={styles.header}>
        <Text style={styles.title}>Guest Preferences</Text>
        {!isConnected && (
          <Text style={styles.offlineIndicator}>Offline Mode</Text>
        )}
      </View>

      {/* Room Preferences Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Room Preferences</Text>
        <TouchableOpacity
          style={styles.input}
          onPress={() => {/* Show room type selector */}}
          accessibilityRole="button"
          accessibilityLabel="Select Room Type"
        >
          <Text>{preferences.roomType || 'Select Room Type'}</Text>
        </TouchableOpacity>

        <View style={styles.row}>
          <Text>Floor Level Preference</Text>
          <TouchableOpacity
            style={styles.slider}
            {...bind()}
            accessibilityRole="adjustable"
            accessibilityLabel={`Floor Level ${preferences.floorLevel}`}
          >
            <Text>{preferences.floorLevel}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.row}>
          <Text>Smoking Room</Text>
          <Switch
            value={preferences.smokingRoom}
            onValueChange={(value) => {
              Haptics.selectionAsync();
              handleTouchSubmit({ smokingRoom: value });
            }}
            accessibilityRole="switch"
            accessibilityLabel="Smoking Room Preference"
          />
        </View>
      </View>

      {/* Comfort Preferences Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Comfort Preferences</Text>
        {/* Bed Type Selection */}
        <TouchableOpacity
          style={styles.multiSelect}
          onPress={() => {/* Show bed type selector */}}
          accessibilityRole="button"
          accessibilityLabel="Select Bed Types"
        >
          <Text>{preferences.bedType.join(', ') || 'Select Bed Types'}</Text>
        </TouchableOpacity>

        {/* Temperature Control */}
        <View style={styles.row}>
          <Text>Room Temperature (°C)</Text>
          <TouchableOpacity
            style={styles.slider}
            {...bind()}
            accessibilityRole="adjustable"
            accessibilityLabel={`Temperature ${preferences.temperature}°C`}
          >
            <Text>{preferences.temperature}°C</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Sync Status */}
      <View style={styles.syncStatus}>
        <Text>
          {preferences.isSyncing ? 'Syncing...' : 
           preferences.lastSynced ? `Last synced: ${preferences.lastSynced.toLocaleTimeString()}` :
           'Not synced'}
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  offlineIndicator: {
    color: '#e74c3c',
    marginTop: 8,
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: CONSTANTS.MIN_TOUCH_TARGET,
    marginVertical: 8,
  },
  input: {
    padding: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    minHeight: CONSTANTS.MIN_TOUCH_TARGET,
  },
  multiSelect: {
    padding: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    minHeight: CONSTANTS.MIN_TOUCH_TARGET,
  },
  slider: {
    width: 150,
    height: CONSTANTS.MIN_TOUCH_TARGET,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  syncStatus: {
    padding: 16,
    alignItems: 'center',
  },
});

export default PreferencesScreen;
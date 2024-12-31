import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Platform,
  AccessibilityInfo
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import useAuth from '../../../shared/hooks/useAuth';
import { Guest } from '../../../shared/interfaces/guest.interface';
import { MaterialIcons } from '@expo/vector-icons'; // v6.0.0
import { SafeAreaView } from 'react-native-safe-area-context'; // v4.0.0

// Security context for handling sensitive data
interface SecurityContext {
  isEncrypted: boolean;
  lastValidated: number;
  sensitiveFieldsVisible: boolean;
}

const ProfileScreen: React.FC = () => {
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const { isAuthenticated, user, logout, validateSession } = useAuth();
  const [securityContext, setSecurityContext] = useState<SecurityContext>({
    isEncrypted: true,
    lastValidated: Date.now(),
    sensitiveFieldsVisible: false,
  });

  // Fetch guest data with react-query
  const { data: guestData, isLoading, error, refetch } = useQuery<Guest>(
    ['guest', user?.id],
    async () => {
      const response = await fetch(`/api/v1/guests/${user?.id}`, {
        headers: {
          'Authorization': `Bearer ${user?.token}`,
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) throw new Error('Failed to fetch guest data');
      return response.json();
    },
    {
      enabled: !!user?.id,
      staleTime: 300000, // 5 minutes
      cacheTime: 3600000, // 1 hour
      retry: 2,
    }
  );

  // Handle secure logout
  const handleLogout = useCallback(async () => {
    try {
      await validateSession();
      // Clear sensitive data
      queryClient.clear();
      setSecurityContext(prev => ({
        ...prev,
        sensitiveFieldsVisible: false,
        lastValidated: Date.now(),
      }));
      await logout();
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    } catch (err) {
      Alert.alert('Error', 'Failed to logout securely');
    }
  }, [logout, navigation, queryClient, validateSession]);

  // Handle data refresh
  const handleDataRefresh = useCallback(async () => {
    try {
      await validateSession();
      await refetch();
      setSecurityContext(prev => ({
        ...prev,
        lastValidated: Date.now(),
      }));
    } catch (err) {
      Alert.alert('Error', 'Failed to refresh data');
    }
  }, [refetch, validateSession]);

  // Security validation effect
  useEffect(() => {
    if (!isAuthenticated) {
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    }
  }, [isAuthenticated, navigation]);

  // Accessibility announcement
  useEffect(() => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      AccessibilityInfo.announceForAccessibility('Profile screen loaded');
    }
  }, []);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Error loading profile</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={handleDataRefresh}
            accessibilityLabel="Retry loading profile"
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={handleDataRefresh}
            accessibilityLabel="Pull to refresh profile"
          />
        }
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
            accessibilityLabel="Logout button"
          >
            <MaterialIcons name="logout" size={24} color="#E74C3C" />
          </TouchableOpacity>
        </View>

        <View style={styles.profileSection}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>
              {guestData?.firstName?.[0]}{guestData?.lastName?.[0]}
            </Text>
          </View>
          
          <View style={styles.infoContainer}>
            <Text style={styles.name}>
              {guestData?.firstName} {guestData?.lastName}
            </Text>
            <Text style={styles.email}>{guestData?.email}</Text>
          </View>
        </View>

        <View style={styles.preferencesSection}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          {guestData?.preferences && Object.entries(guestData.preferences).map(([key, value]) => (
            <View key={key} style={styles.preferenceItem}>
              <Text style={styles.preferenceLabel}>{key}</Text>
              <Text style={styles.preferenceValue}>
                {Array.isArray(value) ? value.join(', ') : value.toString()}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#2C3E50',
  },
  logoutButton: {
    padding: 8,
  },
  profileSection: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#3498DB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '600',
  },
  infoContainer: {
    marginLeft: 16,
    flex: 1,
  },
  name: {
    fontSize: 20,
    fontWeight: '600',
    color: '#2C3E50',
  },
  email: {
    fontSize: 16,
    color: '#7F8C8D',
    marginTop: 4,
  },
  preferencesSection: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 16,
  },
  preferenceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  preferenceLabel: {
    fontSize: 16,
    color: '#2C3E50',
  },
  preferenceValue: {
    fontSize: 16,
    color: '#7F8C8D',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#7F8C8D',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#E74C3C',
    marginBottom: 16,
  },
  retryButton: {
    padding: 12,
    backgroundColor: '#3498DB',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ProfileScreen;
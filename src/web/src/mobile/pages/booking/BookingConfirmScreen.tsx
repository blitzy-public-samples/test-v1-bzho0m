/**
 * @fileoverview Booking confirmation screen component for mobile app
 * @description Displays and handles confirmation of booking details with real-time validation,
 * optimistic updates, and comprehensive error handling
 * @version 1.0.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  Alert,
  ActivityIndicator,
  TouchableOpacity,
  Platform 
} from 'react-native';
import { useNavigate } from 'react-router-dom'; // ^6.0.0
import { useNetInfo } from '@react-native-community/netinfo'; // ^9.0.0
import { useAppDispatch } from 'react-redux'; // ^8.0.0

// Internal imports
import { Reservation, ReservationStatus } from '../../../shared/interfaces/reservation.interface';
import { reservationActions } from '../../../shared/store/reservation.slice';

/**
 * Props interface for BookingConfirmScreen component
 */
interface BookingConfirmScreenProps {
  bookingData: Reservation;
  isRetry?: boolean;
}

/**
 * Maximum retry attempts for booking confirmation
 */
const MAX_RETRY_ATTEMPTS = 3;

/**
 * Base delay for exponential backoff in milliseconds
 */
const BASE_RETRY_DELAY = 2000;

/**
 * BookingConfirmScreen component for confirming reservation details
 */
const BookingConfirmScreen: React.FC<BookingConfirmScreenProps> = ({ 
  bookingData,
  isRetry = false 
}) => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const netInfo = useNetInfo();

  // Local state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  /**
   * Validates booking data before submission
   */
  const validateBookingData = useCallback(() => {
    const errors: string[] = [];

    if (!bookingData.guestId) {
      errors.push('Guest information is required');
    }

    if (!bookingData.checkInDate || !bookingData.checkOutDate) {
      errors.push('Valid dates are required');
    }

    if (bookingData.numberOfGuests < 1) {
      errors.push('At least one guest is required');
    }

    setValidationErrors(errors);
    return errors.length === 0;
  }, [bookingData]);

  /**
   * Handles exponential backoff retry logic
   */
  const handleRetry = useCallback(async (attemptCount: number) => {
    const delay = Math.min(BASE_RETRY_DELAY * Math.pow(2, attemptCount), 10000);
    await new Promise(resolve => setTimeout(resolve, delay));
    setRetryAttempt(attemptCount + 1);
    return handleConfirmBooking();
  }, []);

  /**
   * Handles the booking confirmation process
   */
  const handleConfirmBooking = useCallback(async () => {
    if (!validateBookingData()) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Check network connectivity
      if (!netInfo.isConnected) {
        throw new Error('No network connection');
      }

      // Attempt to create reservation
      const result = await dispatch(
        reservationActions.createReservation(bookingData)
      ).unwrap();

      // Handle successful booking
      Alert.alert(
        'Booking Confirmed',
        'Your reservation has been successfully confirmed.',
        [
          {
            text: 'View Details',
            onPress: () => navigate(`/reservations/${result.id}`),
          },
        ]
      );

    } catch (error) {
      // Handle retry logic
      if (retryAttempt < MAX_RETRY_ATTEMPTS) {
        Alert.alert(
          'Booking Error',
          'There was an error confirming your booking. Retrying...',
          [
            {
              text: 'Cancel',
              onPress: () => setIsSubmitting(false),
              style: 'cancel',
            },
            {
              text: 'Retry',
              onPress: () => handleRetry(retryAttempt),
            },
          ]
        );
      } else {
        Alert.alert(
          'Booking Failed',
          'Unable to confirm your booking. Please try again later.',
          [
            {
              text: 'OK',
              onPress: () => navigate('/bookings'),
            },
          ]
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [bookingData, retryAttempt, netInfo.isConnected, dispatch, navigate]);

  // Effect for handling retry attempts
  useEffect(() => {
    if (isRetry && retryAttempt === 0) {
      handleConfirmBooking();
    }
  }, [isRetry, retryAttempt, handleConfirmBooking]);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Confirm Booking</Text>
      </View>

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <View style={styles.errorContainer}>
          {validationErrors.map((error, index) => (
            <Text key={index} style={styles.errorText}>{error}</Text>
          ))}
        </View>
      )}

      {/* Booking Details */}
      <View style={styles.detailsContainer}>
        <Text style={styles.sectionTitle}>Booking Details</Text>
        
        <View style={styles.detailRow}>
          <Text style={styles.label}>Check-in:</Text>
          <Text style={styles.value}>
            {new Date(bookingData.checkInDate).toLocaleDateString()}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.label}>Check-out:</Text>
          <Text style={styles.value}>
            {new Date(bookingData.checkOutDate).toLocaleDateString()}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.label}>Guests:</Text>
          <Text style={styles.value}>{bookingData.numberOfGuests}</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.label}>Room:</Text>
          <Text style={styles.value}>{bookingData.roomNumber}</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.label}>Total Amount:</Text>
          <Text style={styles.value}>
            ${bookingData.totalAmount.toFixed(2)}
          </Text>
        </View>
      </View>

      {/* Special Requests */}
      {bookingData.specialRequests?.length > 0 && (
        <View style={styles.specialRequestsContainer}>
          <Text style={styles.sectionTitle}>Special Requests</Text>
          {bookingData.specialRequests.map((request, index) => (
            <Text key={index} style={styles.requestText}>{request}</Text>
          ))}
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.actionContainer}>
        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={() => navigate(-1)}
          disabled={isSubmitting}
        >
          <Text style={styles.buttonText}>Back</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={handleConfirmBooking}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>Confirm Booking</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  errorContainer: {
    margin: 20,
    padding: 15,
    backgroundColor: '#FFE5E5',
    borderRadius: 8,
  },
  errorText: {
    color: '#E74C3C',
    fontSize: 14,
    marginBottom: 5,
  },
  detailsContainer: {
    margin: 20,
    padding: 15,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
    color: '#2C3E50',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  label: {
    fontSize: 16,
    color: '#7F8C8D',
  },
  value: {
    fontSize: 16,
    fontWeight: '500',
    color: '#2C3E50',
  },
  specialRequestsContainer: {
    margin: 20,
    padding: 15,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
  },
  requestText: {
    fontSize: 14,
    color: '#34495E',
    marginBottom: 8,
  },
  actionContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
    marginBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  button: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    marginHorizontal: 8,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#3498DB',
  },
  secondaryButton: {
    backgroundColor: '#95A5A6',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default BookingConfirmScreen;
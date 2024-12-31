/**
 * @fileoverview Redux slice for managing billing state in the hotel management system
 * Implements comprehensive state management for folios, invoices, and payments
 * with enhanced error handling and loading states
 * @version 1.0.0
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import {
  IPayment,
  IInvoice,
  IFolio,
  PaymentMethod,
  PaymentStatus,
  InvoiceStatus,
  FolioStatus
} from '../interfaces/billing.interface';
import { billingApi, BillingError, BillingErrorType } from '../api/billing.api';

/**
 * Interface for managing granular loading and error states
 */
interface OperationState {
  loading: boolean;
  error: string | null;
  retryCount: number;
}

/**
 * Interface for the billing slice state
 */
interface IBillingState {
  currentFolio: IFolio | null;
  currentInvoice: IInvoice | null;
  currentPayment: IPayment | null;
  operations: {
    [key: string]: OperationState;
  };
}

/**
 * Initial state for the billing slice
 */
const initialState: IBillingState = {
  currentFolio: null,
  currentInvoice: null,
  currentPayment: null,
  operations: {}
};

/**
 * Maximum retry attempts for failed operations
 */
const MAX_RETRY_ATTEMPTS = 3;

/**
 * Async thunk for fetching folio details
 */
export const fetchFolio = createAsyncThunk(
  'billing/fetchFolio',
  async (folioId: string, { rejectWithValue, getState }) => {
    try {
      return await billingApi.getFolio(folioId);
    } catch (error) {
      if (error instanceof BillingError) {
        return rejectWithValue({
          message: error.message,
          type: error.type,
          code: error.code
        });
      }
      return rejectWithValue({ message: 'Unknown error occurred' });
    }
  }
);

/**
 * Async thunk for generating new invoice
 */
export const generateNewInvoice = createAsyncThunk(
  'billing/generateNewInvoice',
  async (folioId: string, { rejectWithValue, getState }) => {
    try {
      const response = await billingApi.generateInvoice(folioId);
      return response;
    } catch (error) {
      if (error instanceof BillingError) {
        return rejectWithValue({
          message: error.message,
          type: error.type,
          code: error.code
        });
      }
      return rejectWithValue({ message: 'Failed to generate invoice' });
    }
  }
);

/**
 * Async thunk for processing payments
 */
export const submitPayment = createAsyncThunk(
  'billing/submitPayment',
  async (paymentData: Partial<IPayment>, { rejectWithValue }) => {
    try {
      const response = await billingApi.processPayment(paymentData as any);
      return response;
    } catch (error) {
      if (error instanceof BillingError) {
        if (error.type === BillingErrorType.PAYMENT_DECLINED) {
          return rejectWithValue({
            message: 'Payment was declined. Please try a different payment method.',
            type: error.type,
            code: error.code
          });
        }
        return rejectWithValue({
          message: error.message,
          type: error.type,
          code: error.code
        });
      }
      return rejectWithValue({ message: 'Payment processing failed' });
    }
  }
);

/**
 * Billing slice definition with reducers and actions
 */
const billingSlice = createSlice({
  name: 'billing',
  initialState,
  reducers: {
    // Synchronous reducers for state management
    setCurrentFolio: (state, action: PayloadAction<IFolio | null>) => {
      state.currentFolio = action.payload;
    },
    setCurrentInvoice: (state, action: PayloadAction<IInvoice | null>) => {
      state.currentInvoice = action.payload;
    },
    setCurrentPayment: (state, action: PayloadAction<IPayment | null>) => {
      state.currentPayment = action.payload;
    },
    resetOperationState: (state, action: PayloadAction<string>) => {
      delete state.operations[action.payload];
    },
    clearAllState: (state) => {
      return initialState;
    }
  },
  extraReducers: (builder) => {
    // Fetch Folio reducers
    builder
      .addCase(fetchFolio.pending, (state, action) => {
        state.operations['fetchFolio'] = {
          loading: true,
          error: null,
          retryCount: state.operations['fetchFolio']?.retryCount || 0
        };
      })
      .addCase(fetchFolio.fulfilled, (state, action) => {
        state.currentFolio = action.payload;
        state.operations['fetchFolio'] = {
          loading: false,
          error: null,
          retryCount: 0
        };
      })
      .addCase(fetchFolio.rejected, (state, action) => {
        const retryCount = (state.operations['fetchFolio']?.retryCount || 0) + 1;
        state.operations['fetchFolio'] = {
          loading: false,
          error: action.payload as string,
          retryCount
        };
      });

    // Generate Invoice reducers
    builder
      .addCase(generateNewInvoice.pending, (state) => {
        state.operations['generateInvoice'] = {
          loading: true,
          error: null,
          retryCount: state.operations['generateInvoice']?.retryCount || 0
        };
      })
      .addCase(generateNewInvoice.fulfilled, (state, action) => {
        state.currentInvoice = action.payload;
        state.operations['generateInvoice'] = {
          loading: false,
          error: null,
          retryCount: 0
        };
      })
      .addCase(generateNewInvoice.rejected, (state, action) => {
        const retryCount = (state.operations['generateInvoice']?.retryCount || 0) + 1;
        state.operations['generateInvoice'] = {
          loading: false,
          error: action.payload as string,
          retryCount
        };
      });

    // Submit Payment reducers
    builder
      .addCase(submitPayment.pending, (state) => {
        state.operations['submitPayment'] = {
          loading: true,
          error: null,
          retryCount: state.operations['submitPayment']?.retryCount || 0
        };
      })
      .addCase(submitPayment.fulfilled, (state, action) => {
        state.currentPayment = action.payload;
        state.operations['submitPayment'] = {
          loading: false,
          error: null,
          retryCount: 0
        };
      })
      .addCase(submitPayment.rejected, (state, action) => {
        const retryCount = (state.operations['submitPayment']?.retryCount || 0) + 1;
        state.operations['submitPayment'] = {
          loading: false,
          error: action.payload as string,
          retryCount
        };
      });
  }
});

// Export actions
export const {
  setCurrentFolio,
  setCurrentInvoice,
  setCurrentPayment,
  resetOperationState,
  clearAllState
} = billingSlice.actions;

// Selectors
export const selectCurrentFolio = (state: { billing: IBillingState }) => state.billing.currentFolio;
export const selectCurrentInvoice = (state: { billing: IBillingState }) => state.billing.currentInvoice;
export const selectCurrentPayment = (state: { billing: IBillingState }) => state.billing.currentPayment;
export const selectOperationState = (state: { billing: IBillingState }, operation: string) => 
  state.billing.operations[operation] || { loading: false, error: null, retryCount: 0 };

// Export reducer
export default billingSlice.reducer;
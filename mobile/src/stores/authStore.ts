/**
 * Auth Store
 * Authentication state management using Zustand
 */

import { create } from 'zustand';
import * as LocalAuthentication from 'expo-local-authentication';
import type { UserResponse, LoginInput, RegisterInput, PinVerifyInput } from '@/types';
import {
  setAuthToken,
  getAuthToken,
  removeAuthToken,
  setRefreshToken,
  getRefreshToken,
  setUserData,
  getUserData,
  removeUserData,
  setPINHash,
  getPINHash,
  removePINHash,
  setBiometricEnabled,
  isBiometricEnabled,
  clearAuthStorage,
} from '@/services/secureStorage';
import { authApi } from '@/services/auth.api';

// ============================================================================
// Auth State Interface
// ============================================================================

interface AuthState {
  // State
  user: UserResponse | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;
  hasPIN: boolean | null;
  biometricEnabled: boolean;
  biometricAvailable: boolean;

  // Actions - Auth
  initialize: () => Promise<void>;
  login: (data: LoginInput) => Promise<void>;
  register: (data: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;

  // Actions - PIN
  setupPIN: (pin: string) => Promise<void>;
  verifyPIN: (data: PinVerifyInput) => Promise<boolean>;
  checkPINStatus: () => Promise<void>;
  clearPIN: () => Promise<void>;

  // Actions - Biometric
  checkBiometricAvailability: () => Promise<void>;
  enableBiometric: () => Promise<void>;
  disableBiometric: () => Promise<void>;
  authenticateWithBiometric: (promptMessage?: string) => Promise<boolean>;

  // Actions - Error handling
  clearError: () => void;
  setError: (error: string) => void;
}

// ============================================================================
// PIN Hashing Helper (Simple implementation)
// Note: In production, use a proper crypto library
// ============================================================================

async function hashPIN(pin: string): Promise<string> {
  // Simple hash for demo - in production use proper crypto
  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ============================================================================
// Auth Store
// ============================================================================

export const useAuthStore = create<AuthState>((set, get) => ({
  // Initial state
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,
  isInitialized: false,
  error: null,
  hasPIN: null,
  biometricEnabled: false,
  biometricAvailable: false,

  // ============================================================================
  // Auth Actions
  // ============================================================================

  /**
   * Initialize auth state from secure storage
   */
  initialize: async () => {
    set({ isLoading: true });

    try {
      // Check for existing token
      const token = await getAuthToken();
      const userData = await getUserData<UserResponse>();

      if (token && userData) {
        set({
          token,
          user: userData,
          isAuthenticated: true,
          isInitialized: true,
          isLoading: false,
        });

        // Check PIN status
        try {
          const pinStatus = await authApi.getPINStatus();
          set({ hasPIN: pinStatus.hasPin });
        } catch {
          set({ hasPIN: false });
        }

        // Check biometric availability
        const biometricAvailable = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();
        const biometricEnabled = await isBiometricEnabled();

        set({
          biometricAvailable: biometricAvailable && isEnrolled,
          biometricEnabled,
        });
      } else {
        set({
          token: null,
          user: null,
          isAuthenticated: false,
          isInitialized: true,
          isLoading: false,
        });
      }
    } catch (error) {
      console.error('Error initializing auth:', error);
      set({
        error: 'Failed to initialize authentication',
        isLoading: false,
        isInitialized: true,
      });
    }
  },

  /**
   * Login with email/phone and password
   */
  login: async (data: LoginInput) => {
    set({ isLoading: true, error: null });

    try {
      const response = await authApi.login(data);

      // Store token and user data
      await setAuthToken(response.token);
      await setUserData(response.user);

      // Check PIN status
      let hasPIN = false;
      try {
        const pinStatus = await authApi.getPINStatus();
        hasPIN = pinStatus.hasPin;
      } catch {
        hasPIN = false;
      }

      set({
        user: response.user,
        token: response.token,
        isAuthenticated: true,
        hasPIN,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      const errorMessage =
        error && typeof error === 'object' && 'response' in error
          ? ((error as { response: { data: { error: string } } }).response?.data?.error || 'Login failed')
          : 'Login failed';

      set({
        error: errorMessage,
        isLoading: false,
      });
      throw error;
    }
  },

  /**
   * Register a new user
   */
  register: async (data: RegisterInput) => {
    set({ isLoading: true, error: null });

    try {
      const response = await authApi.register(data);

      // Store token and user data
      await setAuthToken(response.token);
      await setUserData(response.user);

      set({
        user: response.user,
        token: response.token,
        isAuthenticated: true,
        hasPIN: false,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      const errorMessage =
        error && typeof error === 'object' && 'response' in error
          ? ((error as { response: { data: { error: string } } }).response?.data?.error || 'Registration failed')
          : 'Registration failed';

      set({
        error: errorMessage,
        isLoading: false,
      });
      throw error;
    }
  },

  /**
   * Logout and clear auth state
   */
  logout: async () => {
    set({ isLoading: true });

    try {
      await clearAuthStorage();

      set({
        user: null,
        token: null,
        isAuthenticated: false,
        hasPIN: null,
        biometricEnabled: false,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      console.error('Error during logout:', error);
      set({
        error: 'Failed to logout',
        isLoading: false,
      });
    }
  },

  /**
   * Refresh user data from server
   */
  refreshUser: async () => {
    const { isAuthenticated } = get();

    if (!isAuthenticated) {
      return;
    }

    try {
      const response = await authApi.getProfile();

      await setUserData(response.user);

      set({
        user: response.user,
      });
    } catch (error) {
      console.error('Error refreshing user:', error);
      // Don't update error state on silent refresh
    }
  },

  // ============================================================================
  // PIN Actions
  // ============================================================================

  /**
   * Setup a new PIN
   */
  setupPIN: async (pin: string) => {
    set({ isLoading: true, error: null });

    try {
      // Validate PIN format (4-6 digits)
      if (!/^\d{4,6}$/.test(pin)) {
        throw new Error('PIN must be 4-6 digits');
      }

      // Hash PIN for local storage
      const pinHash = await hashPIN(pin);
      await setPINHash(pinHash);

      // Send PIN to server
      await authApi.setPIN({ pin });

      set({
        hasPIN: true,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      const errorMessage =
        error && typeof error === 'object' && 'response' in error
          ? ((error as { response: { data: { error: string } } }).response?.data?.error || 'Failed to set PIN')
          : 'Failed to set PIN';

      set({
        error: errorMessage,
        isLoading: false,
      });
      throw error;
    }
  },

  /**
   * Verify PIN against local hash
   */
  verifyPIN: async (data: PinVerifyInput): Promise<boolean> => {
    try {
      // First verify with server
      const response = await authApi.verifyPIN(data);

      if (!response.success) {
        return false;
      }

      // Also verify against local hash for offline capability
      const localHash = await getPINHash();
      if (localHash) {
        const inputHash = await hashPIN(data.pin);
        return inputHash === localHash;
      }

      return true;
    } catch (error) {
      console.error('Error verifying PIN:', error);
      return false;
    }
  },

  /**
   * Check if user has PIN set
   */
  checkPINStatus: async () => {
    try {
      const pinStatus = await authApi.getPINStatus();
      set({ hasPIN: pinStatus.hasPin });
    } catch (error) {
      console.error('Error checking PIN status:', error);
      set({ hasPIN: false });
    }
  },

  /**
   * Clear PIN
   */
  clearPIN: async () => {
    await removePINHash();
    set({ hasPIN: false });
  },

  // ============================================================================
  // Biometric Actions
  // ============================================================================

  /**
   * Check if biometric authentication is available
   */
  checkBiometricAvailability: async () => {
    try {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      const enabled = await isBiometricEnabled();

      set({
        biometricAvailable: compatible && enrolled,
        biometricEnabled: enabled,
      });
    } catch (error) {
      console.error('Error checking biometric availability:', error);
      set({
        biometricAvailable: false,
        biometricEnabled: false,
      });
    }
  },

  /**
   * Enable biometric authentication
   */
  enableBiometric: async () => {
    try {
      // First authenticate to verify identity
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to enable biometric login',
        fallbackLabel: 'Use PIN',
        cancelLabel: 'Cancel',
      });

      if (result.success) {
        await setBiometricEnabled(true);
        set({ biometricEnabled: true });
      } else {
        throw new Error('Biometric authentication failed');
      }
    } catch (error) {
      console.error('Error enabling biometric:', error);
      throw error;
    }
  },

  /**
   * Disable biometric authentication
   */
  disableBiometric: async () => {
    try {
      await setBiometricEnabled(false);
      set({ biometricEnabled: false });
    } catch (error) {
      console.error('Error disabling biometric:', error);
      throw error;
    }
  },

  /**
   * Authenticate with biometric
   */
  authenticateWithBiometric: async (promptMessage = 'Authenticate to continue'): Promise<boolean> => {
    const { biometricAvailable } = get();

    if (!biometricAvailable) {
      return false;
    }

    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage,
        fallbackLabel: 'Use PIN',
        cancelLabel: 'Cancel',
      });

      return result.success;
    } catch (error) {
      console.error('Biometric authentication error:', error);
      return false;
    }
  },

  // ============================================================================
  // Error Actions
  // ============================================================================

  clearError: () => {
    set({ error: null });
  },

  setError: (error: string) => {
    set({ error });
  },
}));

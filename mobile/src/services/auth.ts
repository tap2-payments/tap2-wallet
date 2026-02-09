import * as SecureStore from 'expo-secure-store';
import CryptoJS from 'crypto-js';

import { axiosInstance } from './api';

// Storage keys
const ACCESS_TOKEN_KEY = 'tap2_access_token';
const REFRESH_TOKEN_KEY = 'tap2_refresh_token';
const ID_TOKEN_KEY = 'tap2_id_token';
const USER_KEY = 'tap2_user';
const PIN_HASH_KEY = 'tap2_pin_hash';
const PIN_SALT_KEY = 'tap2_pin_salt';
const BIOMETRIC_ENABLED_KEY = 'tap2_biometric_enabled';

// API base URL for auth endpoints
const AUTH_BASE_URL = axiosInstance.defaults.baseURL || '/api/v1';

/**
 * Hash a PIN using SHA-256 with salt
 */
async function hashPIN(pin: string, salt: string): Promise<string> {
  return CryptoJS.SHA256(pin + salt).toString();
}

/**
 * Generate a random salt for PIN hashing
 */
function generateSalt(): string {
  return CryptoJS.lib.WordArray.random(32).toString();
}

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  idToken: string;
  expiresIn: number;
}

export interface AuthUser {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
  createdAt: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: AuthUser | null;
  tokens: AuthTokens | null;
}

export interface LoginResponse {
  user: AuthUser;
  tokens: AuthTokens;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

/**
 * Authentication Service
 * Handles login, logout, token management, PIN storage, and user session
 * Uses custom backend API instead of Auth0
 */
class AuthService {
  private initialized = false;
  private state: AuthState = {
    isAuthenticated: false,
    isLoading: true,
    user: null,
    tokens: null,
  };

  private listeners: Set<(state: AuthState) => void> = new Set();

  /**
   * Initialize the auth service and check for existing session
   */
  async initialize(): Promise<AuthState> {
    if (this.initialized) {
      return this.state;
    }

    try {
      const [accessToken, refreshToken, idToken, userStr] = await Promise.all([
        SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
        SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
        SecureStore.getItemAsync(ID_TOKEN_KEY),
        SecureStore.getItemAsync(USER_KEY),
      ]);

      if (accessToken && idToken && userStr) {
        const user = JSON.parse(userStr) as AuthUser;
        this.state = {
          isAuthenticated: true,
          isLoading: false,
          user,
          tokens: {
            accessToken,
            refreshToken: refreshToken || undefined,
            idToken,
            expiresIn: 0, // Will be validated on API calls
          },
        };

        // Configure axios with auth token
        this.configureAxios(accessToken);
      } else {
        this.state = {
          isAuthenticated: false,
          isLoading: false,
          user: null,
          tokens: null,
        };
      }
    } catch (error) {
      console.error('Failed to initialize auth service:', error);
      this.state = {
        isAuthenticated: false,
        isLoading: false,
        user: null,
        tokens: null,
      };
    }

    this.initialized = true;
    this.notifyListeners();
    return this.state;
  }

  /**
   * Login with email and password using custom backend API
   */
  async login(email: string, password: string): Promise<AuthUser> {
    try {
      const response = await axiosInstance.post<LoginResponse>(
        `${AUTH_BASE_URL}/auth/login`,
        { email, password } as LoginRequest
      );

      const { user, tokens } = response.data;

      // Store tokens securely
      await Promise.all([
        SecureStore.setItemAsync(ACCESS_TOKEN_KEY, tokens.accessToken),
        SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokens.refreshToken || ''),
        SecureStore.setItemAsync(ID_TOKEN_KEY, tokens.idToken),
        SecureStore.setItemAsync(USER_KEY, JSON.stringify(user)),
      ]);

      this.state = {
        isAuthenticated: true,
        isLoading: false,
        user,
        tokens,
      };

      this.configureAxios(tokens.accessToken);
      this.notifyListeners();

      return user;
    } catch (error) {
      console.error('Login failed:', error);

      // Handle API error response
      if (axiosInstance.isAxiosError(error)) {
        const message = error.response?.data?.error || error.message;
        throw new Error(message);
      }

      throw new Error(
        error instanceof Error ? error.message : 'Login failed. Please check your credentials.'
      );
    }
  }

  /**
   * Register a new user with email and password using custom backend API
   */
  async register(email: string, password: string, name: string): Promise<AuthUser> {
    try {
      const response = await axiosInstance.post<LoginResponse>(
        `${AUTH_BASE_URL}/auth/register`,
        { email, password, name } as RegisterRequest
      );

      const { user, tokens } = response.data;

      // Store tokens securely
      await Promise.all([
        SecureStore.setItemAsync(ACCESS_TOKEN_KEY, tokens.accessToken),
        SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokens.refreshToken || ''),
        SecureStore.setItemAsync(ID_TOKEN_KEY, tokens.idToken),
        SecureStore.setItemAsync(USER_KEY, JSON.stringify(user)),
      ]);

      this.state = {
        isAuthenticated: true,
        isLoading: false,
        user,
        tokens,
      };

      this.configureAxios(tokens.accessToken);
      this.notifyListeners();

      return user;
    } catch (error) {
      console.error('Registration failed:', error);

      // Handle API error response
      if (axiosInstance.isAxiosError(error)) {
        const message = error.response?.data?.error || error.message;
        throw new Error(message);
      }

      throw new Error(
        error instanceof Error ? error.message : 'Registration failed. Please try again.'
      );
    }
  }

  /**
   * Logout and clear all stored tokens
   */
  async logout(): Promise<void> {
    try {
      // Call backend logout endpoint
      const refreshToken = this.state.tokens?.refreshToken;
      if (refreshToken) {
        await axiosInstance.post(`${AUTH_BASE_URL}/auth/logout`, { refreshToken });
      }
    } catch (error) {
      console.error('Backend logout failed:', error);
    } finally {
      // Always clear local storage
      await Promise.all([
        SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
        SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
        SecureStore.deleteItemAsync(ID_TOKEN_KEY),
        SecureStore.deleteItemAsync(USER_KEY),
      ]);

      this.state = {
        isAuthenticated: false,
        isLoading: false,
        user: null,
        tokens: null,
      };

      this.configureAxios('');
      this.notifyListeners();
    }
  }

  /**
   * Refresh the access token using refresh token
   */
  async refreshTokens(): Promise<AuthTokens | null> {
    const refreshToken = this.state.tokens?.refreshToken;

    if (!refreshToken) {
      return null;
    }

    try {
      const response = await axiosInstance.post<AuthTokens>(
        `${AUTH_BASE_URL}/auth/refresh`,
        { refreshToken }
      );

      const tokens = response.data;

      await Promise.all([
        SecureStore.setItemAsync(ACCESS_TOKEN_KEY, tokens.accessToken),
        SecureStore.setItemAsync(ID_TOKEN_KEY, tokens.idToken),
      ]);

      this.state.tokens = {
        ...this.state.tokens!,
        accessToken: tokens.accessToken,
        idToken: tokens.idToken,
        expiresIn: tokens.expiresIn || 3600,
      };

      this.configureAxios(tokens.accessToken);
      this.notifyListeners();

      return this.state.tokens;
    } catch (error) {
      console.error('Token refresh failed:', error);
      // Logout on failed refresh
      await this.logout();
      return null;
    }
  }

  /**
   * Store PIN securely with salted hash
   */
  async storePIN(pin: string): Promise<void> {
    if (pin.length !== 4) {
      throw new Error('PIN must be 4 digits');
    }

    const salt = generateSalt();
    const hashedPIN = await hashPIN(pin, salt);

    await Promise.all([
      SecureStore.setItemAsync(PIN_HASH_KEY, hashedPIN),
      SecureStore.setItemAsync(PIN_SALT_KEY, salt),
    ]);
  }

  /**
   * Verify a PIN against the stored hash
   */
  async verifyPIN(pin: string): Promise<boolean> {
    try {
      const [storedHash, salt] = await Promise.all([
        SecureStore.getItemAsync(PIN_HASH_KEY),
        SecureStore.getItemAsync(PIN_SALT_KEY),
      ]);

      if (!storedHash || !salt) {
        return false;
      }

      const hashedInput = await hashPIN(pin, salt);
      return hashedInput === storedHash;
    } catch (error) {
      console.error('PIN verification failed:', error);
      return false;
    }
  }

  /**
   * Check if a PIN has been set
   */
  async hasPIN(): Promise<boolean> {
    try {
      const pinHash = await SecureStore.getItemAsync(PIN_HASH_KEY);
      return pinHash !== null;
    } catch (error) {
      console.error('Failed to check PIN status:', error);
      return false;
    }
  }

  /**
   * Clear the stored PIN
   */
  async clearPIN(): Promise<void> {
    await Promise.all([
      SecureStore.deleteItemAsync(PIN_HASH_KEY),
      SecureStore.deleteItemAsync(PIN_SALT_KEY),
    ]);
  }

  /**
   * Set biometric authentication preference
   */
  async setBiometricEnabled(enabled: boolean): Promise<void> {
    await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, enabled.toString());
  }

  /**
   * Check if biometric authentication is enabled
   */
  async isBiometricEnabled(): Promise<boolean> {
    try {
      const enabled = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY);
      return enabled === 'true';
    } catch (error) {
      console.error('Failed to check biometric status:', error);
      return false;
    }
  }

  /**
   * Get current auth state
   */
  getState(): AuthState {
    return { ...this.state };
  }

  /**
   * Subscribe to auth state changes
   */
  subscribe(listener: (state: AuthState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener({ ...this.state }));
  }

  private configureAxios(token: string): void {
    if (token) {
      axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete axiosInstance.defaults.headers.common['Authorization'];
    }
  }
}

// Singleton instance
export const authService = new AuthService();

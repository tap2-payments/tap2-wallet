import * as SecureStore from 'expo-secure-store';

import { axiosInstance } from './api';

// API base URL
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8080/api/v1';

// Storage keys
const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const USER_KEY = 'user';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthUser {
  id: string;
  email: string;
  phone: string;
  kycVerified: boolean;
  createdAt: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: AuthUser | null;
  tokens: AuthTokens | null;
}

/**
 * Authentication Service
 * Handles login, logout, token management, and user session
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
  private refreshPromise: Promise<AuthTokens | null> | null = null;

  /**
   * Initialize the auth service and check for existing session
   */
  async initialize(): Promise<AuthState> {
    if (this.initialized) {
      return this.state;
    }

    try {
      const [accessToken, refreshToken, userStr] = await Promise.all([
        SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
        SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
        SecureStore.getItemAsync(USER_KEY),
      ]);

      if (accessToken && userStr) {
        const user = JSON.parse(userStr) as AuthUser;
        this.state = {
          isAuthenticated: true,
          isLoading: false,
          user,
          tokens: {
            accessToken,
            refreshToken: refreshToken || '',
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
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed. Please check your credentials.');
      }

      const user: AuthUser = {
        id: data.user.id,
        email: data.user.email,
        phone: data.user.phone,
        kycVerified: data.user.kycVerified || false,
        createdAt: data.user.createdAt || new Date().toISOString(),
      };

      // Store tokens securely
      await Promise.all([
        SecureStore.setItemAsync(ACCESS_TOKEN_KEY, data.tokens.accessToken),
        SecureStore.setItemAsync(REFRESH_TOKEN_KEY, data.tokens.refreshToken),
        SecureStore.setItemAsync(USER_KEY, JSON.stringify(user)),
      ]);

      this.state = {
        isAuthenticated: true,
        isLoading: false,
        user,
        tokens: {
          accessToken: data.tokens.accessToken,
          refreshToken: data.tokens.refreshToken,
          expiresIn: data.tokens.expiresIn || 900,
        },
      };

      this.configureAxios(data.tokens.accessToken);
      this.notifyListeners();

      return user;
    } catch (error) {
      console.error('Login failed:', error);
      throw new Error(
        error instanceof Error ? error.message : 'Login failed. Please check your credentials.'
      );
    }
  }

  /**
   * Register a new user with email and password
   */
  async register(email: string, password: string, phone: string): Promise<AuthUser> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, phone, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Registration failed. Please try again.');
      }

      const user: AuthUser = {
        id: data.user.id,
        email: data.user.email,
        phone: data.user.phone,
        kycVerified: false,
        createdAt: data.user.createdAt || new Date().toISOString(),
      };

      // Store tokens (user is automatically logged in after registration)
      await Promise.all([
        SecureStore.setItemAsync(ACCESS_TOKEN_KEY, data.tokens.accessToken),
        SecureStore.setItemAsync(REFRESH_TOKEN_KEY, data.tokens.refreshToken),
        SecureStore.setItemAsync(USER_KEY, JSON.stringify(user)),
      ]);

      this.state = {
        isAuthenticated: true,
        isLoading: false,
        user,
        tokens: {
          accessToken: data.tokens.accessToken,
          refreshToken: data.tokens.refreshToken,
          expiresIn: data.tokens.expiresIn || 900,
        },
      };

      this.configureAxios(data.tokens.accessToken);
      this.notifyListeners();

      return user;
    } catch (error) {
      console.error('Registration failed:', error);
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
      // Call backend logout endpoint to invalidate session
      const refreshToken = this.state.tokens?.refreshToken;
      if (refreshToken) {
        try {
          await fetch(`${API_BASE_URL}/auth/logout`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${this.state.tokens?.accessToken}`,
            },
            body: JSON.stringify({ refreshToken }),
          });
        } catch (error) {
          console.error('Backend logout failed:', error);
          // Continue with local logout even if backend call fails
        }
      }

      await Promise.all([
        SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
        SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
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
    } catch (error) {
      console.error('Logout failed:', error);
      throw new Error('Failed to logout');
    }
  }

  /**
   * Refresh the access token using refresh token
   */
  async refreshTokens(): Promise<AuthTokens | null> {
    // Use existing refresh promise if in progress (prevents multiple simultaneous refreshes)
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.performTokenRefresh();

    try {
      const result = await this.refreshPromise;
      return result;
    } finally {
      this.refreshPromise = null;
    }
  }

  private async performTokenRefresh(): Promise<AuthTokens | null> {
    const refreshToken = this.state.tokens?.refreshToken;

    if (!refreshToken) {
      return null;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Token refresh failed');
      }

      await Promise.all([
        SecureStore.setItemAsync(ACCESS_TOKEN_KEY, data.tokens.accessToken),
        SecureStore.setItemAsync(REFRESH_TOKEN_KEY, data.tokens.refreshToken),
      ]);

      this.state.tokens = {
        accessToken: data.tokens.accessToken,
        refreshToken: data.tokens.refreshToken,
        expiresIn: data.tokens.expiresIn || 900,
      };

      this.configureAxios(data.tokens.accessToken);
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

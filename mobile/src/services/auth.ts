import * as SecureStore from 'expo-secure-store';
import { z } from 'zod';

import { axiosInstance } from './api';

// API base URL - fail fast if not configured
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;
if (!API_BASE_URL) {
  console.warn('EXPO_PUBLIC_API_URL not set, using localhost fallback');
}

// Storage keys
const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const USER_KEY = 'user';
const TOKEN_EXPIRES_AT_KEY = 'token_expires_at';

// Zod schemas for API response validation
const AuthTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number(),
});

const AuthUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  phone: z.string(),
  kycVerified: z.boolean().optional(),
  createdAt: z.string().optional(),
});

const LoginResponseSchema = z.object({
  user: AuthUserSchema,
  tokens: AuthTokensSchema,
});

const ErrorResponseSchema = z.object({
  error: z.string().optional(),
  message: z.string().optional(),
});

// E.164 phone number validation
const PHONE_REGEX = /^\+?[1-9]\d{1,14}$/;

function validatePhoneNumber(phone: string): boolean {
  return PHONE_REGEX.test(phone);
}

// Calculate expiry timestamp
function calculateExpiresAt(expiresInSeconds: number): number {
  return Date.now() + expiresInSeconds * 1000;
}

// Check if token is expired or will expire soon (within 60 seconds)
function isTokenExpired(expiresAt: number): boolean {
  return Date.now() >= expiresAt - 60000;
}

function getApiBaseUrl(): string {
  return API_BASE_URL || 'http://localhost:8080/api/v1';
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  expiresAt?: number; // Unix timestamp for proactive refresh
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
  private refreshFailureCount = 0;
  private maxRefreshRetries = 3;

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

        // Check if stored token is expired
        const expiresAtStr = await SecureStore.getItemAsync(TOKEN_EXPIRES_AT_KEY);
        const expiresAt = expiresAtStr ? parseInt(expiresAtStr, 10) : 0;

        if (expiresAt && isTokenExpired(expiresAt)) {
          // Token expired, try to refresh or clear session
          if (refreshToken) {
            this.state = {
              isAuthenticated: true,
              isLoading: false,
              user,
              tokens: {
                accessToken,
                refreshToken,
                expiresIn: 0,
                expiresAt,
              },
            };
            // Proactively refresh expired token
            this.refreshTokens().catch(() => {
              // If refresh fails, clear session
              this.clearSession();
            });
          } else {
            // No refresh token, clear session
            await this.clearStorage();
            this.state = {
              isAuthenticated: false,
              isLoading: false,
              user: null,
              tokens: null,
            };
          }
        } else {
          this.state = {
            isAuthenticated: true,
            isLoading: false,
            user,
            tokens: {
              accessToken,
              refreshToken: refreshToken || '',
              expiresIn: 0,
              expiresAt,
            },
          };

          // Configure axios with auth token
          this.configureAxios(accessToken);
        }
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
      const response = await fetch(`${getApiBaseUrl()}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorResult = ErrorResponseSchema.safeParse(data);
        const errorMessage = errorResult.success
          ? errorResult.data.error || errorResult.data.message
          : 'Login failed';
        throw new Error(errorMessage || 'Login failed. Please check your credentials.');
      }

      const result = LoginResponseSchema.safeParse(data);
      if (!result.success) {
        console.error('Invalid API response:', result.error);
        throw new Error('Invalid response from server');
      }

      const { user: userData, tokens: tokensData } = result.data;
      const expiresAt = calculateExpiresAt(tokensData.expiresIn);

      const user: AuthUser = {
        id: userData.id,
        email: userData.email,
        phone: userData.phone,
        kycVerified: userData.kycVerified ?? false,
        createdAt: userData.createdAt ?? new Date().toISOString(),
      };

      // Store tokens securely including expiresAt
      await Promise.all([
        SecureStore.setItemAsync(ACCESS_TOKEN_KEY, tokensData.accessToken),
        SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokensData.refreshToken),
        SecureStore.setItemAsync(USER_KEY, JSON.stringify(user)),
        SecureStore.setItemAsync(TOKEN_EXPIRES_AT_KEY, expiresAt.toString()),
      ]);

      // Reset refresh failure count on successful login
      this.refreshFailureCount = 0;

      this.state = {
        isAuthenticated: true,
        isLoading: false,
        user,
        tokens: {
          accessToken: tokensData.accessToken,
          refreshToken: tokensData.refreshToken,
          expiresIn: tokensData.expiresIn,
          expiresAt,
        },
      };

      this.configureAxios(tokensData.accessToken);
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
   * Register a new user with email, password, and phone
   */
  async register(email: string, password: string, phone: string): Promise<AuthUser> {
    // Validate phone number format (E.164)
    if (!validatePhoneNumber(phone)) {
      throw new Error(
        'Invalid phone number format. Please use international format (e.g., +1234567890)'
      );
    }

    try {
      const response = await fetch(`${getApiBaseUrl()}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, phone, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorResult = ErrorResponseSchema.safeParse(data);
        const errorMessage = errorResult.success
          ? errorResult.data.error || errorResult.data.message
          : 'Registration failed';
        throw new Error(errorMessage || 'Registration failed. Please try again.');
      }

      const result = LoginResponseSchema.safeParse(data);
      if (!result.success) {
        console.error('Invalid API response:', result.error);
        throw new Error('Invalid response from server');
      }

      const { user: userData, tokens: tokensData } = result.data;
      const expiresAt = calculateExpiresAt(tokensData.expiresIn);

      const user: AuthUser = {
        id: userData.id,
        email: userData.email,
        phone: userData.phone,
        kycVerified: false,
        createdAt: userData.createdAt ?? new Date().toISOString(),
      };

      // Store tokens (user is automatically logged in after registration)
      await Promise.all([
        SecureStore.setItemAsync(ACCESS_TOKEN_KEY, tokensData.accessToken),
        SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokensData.refreshToken),
        SecureStore.setItemAsync(USER_KEY, JSON.stringify(user)),
        SecureStore.setItemAsync(TOKEN_EXPIRES_AT_KEY, expiresAt.toString()),
      ]);

      // Reset refresh failure count on successful registration
      this.refreshFailureCount = 0;

      this.state = {
        isAuthenticated: true,
        isLoading: false,
        user,
        tokens: {
          accessToken: tokensData.accessToken,
          refreshToken: tokensData.refreshToken,
          expiresIn: tokensData.expiresIn,
          expiresAt,
        },
      };

      this.configureAxios(tokensData.accessToken);
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
      let backendLogoutFailed = false;

      if (refreshToken) {
        try {
          const response = await fetch(`${getApiBaseUrl()}/auth/logout`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${this.state.tokens?.accessToken}`,
            },
            body: JSON.stringify({ refreshToken }),
          });

          if (!response.ok) {
            backendLogoutFailed = true;
            console.warn('Backend logout returned non-OK status:', response.status);
          }
        } catch (error) {
          backendLogoutFailed = true;
          console.error('Backend logout failed:', error);
          // Continue with local logout even if backend call fails
        }
      }

      await this.clearStorage();

      this.state = {
        isAuthenticated: false,
        isLoading: false,
        user: null,
        tokens: null,
      };

      this.configureAxios('');
      this.notifyListeners();

      if (backendLogoutFailed) {
        console.warn('Session was logged out locally, but backend session may still be active');
      }
    } catch (error) {
      console.error('Logout failed:', error);
      throw new Error('Failed to logout');
    }
  }

  private async clearStorage(): Promise<void> {
    await Promise.all([
      SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
      SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
      SecureStore.deleteItemAsync(USER_KEY),
      SecureStore.deleteItemAsync(TOKEN_EXPIRES_AT_KEY),
    ]);
  }

  private clearSession(): void {
    this.state = {
      isAuthenticated: false,
      isLoading: false,
      user: null,
      tokens: null,
    };
    this.configureAxios('');
    this.notifyListeners();
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

    // Exponential backoff for failed refresh attempts
    if (this.refreshFailureCount >= this.maxRefreshRetries) {
      console.error('Max refresh retries reached, logging out');
      await this.logout();
      return null;
    }

    // Calculate delay with exponential backoff: 2^failureCount seconds, max 30 seconds
    const backoffDelay = Math.min(Math.pow(2, this.refreshFailureCount) * 1000, 30000);
    if (this.refreshFailureCount > 0) {
      console.log(
        `Retrying token refresh after ${backoffDelay}ms (attempt ${this.refreshFailureCount + 1})`
      );
      await new Promise((resolve) => setTimeout(resolve, backoffDelay));
    }

    try {
      const response = await fetch(`${getApiBaseUrl()}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorResult = ErrorResponseSchema.safeParse(data);
        const errorMessage = errorResult.success
          ? errorResult.data.error || errorResult.data.message
          : 'Token refresh failed';

        this.refreshFailureCount++;
        throw new Error(errorMessage || 'Token refresh failed');
      }

      const tokensResult = AuthTokensSchema.safeParse(data.tokens);
      if (!tokensResult.success) {
        console.error('Invalid token response:', tokensResult.error);
        this.refreshFailureCount++;
        throw new Error('Invalid token response from server');
      }

      const tokensData = tokensResult.data;
      const expiresAt = calculateExpiresAt(tokensData.expiresIn);

      await Promise.all([
        SecureStore.setItemAsync(ACCESS_TOKEN_KEY, tokensData.accessToken),
        SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokensData.refreshToken),
        SecureStore.setItemAsync(TOKEN_EXPIRES_AT_KEY, expiresAt.toString()),
      ]);

      // Reset failure count on successful refresh
      this.refreshFailureCount = 0;

      this.state.tokens = {
        accessToken: tokensData.accessToken,
        refreshToken: tokensData.refreshToken,
        expiresIn: tokensData.expiresIn,
        expiresAt,
      };

      this.configureAxios(tokensData.accessToken);
      this.notifyListeners();

      return this.state.tokens;
    } catch (error) {
      console.error('Token refresh failed:', error);
      // Logout on critical failures or after max retries
      if (this.refreshFailureCount >= this.maxRefreshRetries) {
        await this.logout();
        return null;
      }
      throw error;
    }
  }

  /**
   * Check if current token needs refresh (expires within 60 seconds)
   */
  needsTokenRefresh(): boolean {
    const expiresAt = this.state.tokens?.expiresAt;
    return expiresAt ? isTokenExpired(expiresAt) : false;
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

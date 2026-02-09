import * as SecureStore from 'expo-secure-store';
import Auth0 from 'react-native-auth0';

import { axiosInstance } from './api';

// Auth0 configuration
const AUTH0_DOMAIN = process.env.EXPO_PUBLIC_AUTH0_DOMAIN || '';
const AUTH0_CLIENT_ID = process.env.EXPO_PUBLIC_AUTH0_CLIENT_ID || '';

const auth0 = new Auth0({
  domain: AUTH0_DOMAIN,
  clientId: AUTH0_CLIENT_ID,
});

// Storage keys
const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const ID_TOKEN_KEY = 'id_token';
const USER_KEY = 'user';

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
  nickname: string;
  picture: string;
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
   * Login with email and password using Auth0 Passwordless or OAuth
   */
  async login(email: string, password: string): Promise<AuthUser> {
    try {
      const credentials = await auth0.auth.passwordRealm({
        username: email,
        password,
        realm: 'Username-Password-Authentication',
        scope: 'openid profile email offline_access',
      });

      if (!credentials.accessToken || !credentials.idToken) {
        throw new Error('Invalid credentials received');
      }

      // Fetch user info
      const userInfo = await auth0.auth.userInfo({
        token: credentials.accessToken,
      });

      const user: AuthUser = {
        sub: userInfo.sub || '',
        email: userInfo.email || '',
        emailVerified: userInfo.emailVerified || false,
        name: userInfo.name || '',
        nickname: userInfo.nickname || '',
        picture: userInfo.picture || '',
        createdAt: userInfo.updatedAt || new Date().toISOString(),
      };

      // Store tokens securely
      await Promise.all([
        SecureStore.setItemAsync(ACCESS_TOKEN_KEY, credentials.accessToken),
        SecureStore.setItemAsync(REFRESH_TOKEN_KEY, credentials.refreshToken || ''),
        SecureStore.setItemAsync(ID_TOKEN_KEY, credentials.idToken),
        SecureStore.setItemAsync(USER_KEY, JSON.stringify(user)),
      ]);

      this.state = {
        isAuthenticated: true,
        isLoading: false,
        user,
        tokens: {
          accessToken: credentials.accessToken,
          refreshToken: credentials.refreshToken,
          idToken: credentials.idToken,
          expiresIn: credentials.expiresIn || 3600,
        },
      };

      this.configureAxios(credentials.accessToken);
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
  async register(email: string, password: string, name: string): Promise<AuthUser> {
    try {
      // Auth0 requires using the Management API for user creation
      // For now, we'll use the Auth0 Authentication API with signup endpoint
      await auth0.auth.createUser({
        email,
        password,
        username: email.split('@')[0],
        connection: 'Username-Password-Authentication',
        metadata: {
          name,
        },
      });

      // Auto-login after registration
      return this.login(email, password);
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
    } catch (error) {
      console.error('Logout failed:', error);
      throw new Error('Failed to logout');
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
      const credentials = await auth0.auth.refreshToken({
        refreshToken,
        scope: 'openid profile email offline_access',
      });

      if (!credentials.accessToken || !credentials.idToken) {
        throw new Error('Invalid refresh token response');
      }

      await Promise.all([
        SecureStore.setItemAsync(ACCESS_TOKEN_KEY, credentials.accessToken),
        SecureStore.setItemAsync(ID_TOKEN_KEY, credentials.idToken),
      ]);

      this.state.tokens = {
        ...this.state.tokens!,
        accessToken: credentials.accessToken,
        idToken: credentials.idToken,
        expiresIn: credentials.expiresIn || 3600,
      };

      this.configureAxios(credentials.accessToken);
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

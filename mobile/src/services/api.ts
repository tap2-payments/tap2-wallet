/**
 * API Service
 * Axios client with JWT authentication and interceptors
 */

import axios, { AxiosError } from 'axios';
import { getAuthToken, removeAuthToken } from '@/services/secureStorage';
import { NavigationProp } from '@react-navigation/native';

// API base URL - configure for different environments
const API_BASE_URL = __DEV__
  ? 'http://localhost:3001/api/v1'
  : 'https://api.tap2wallet.com/v1';

// Store navigation reference for redirects
let navigationRef: NavigationProp<any> | null = null;

/**
 * Set the navigation reference for redirects
 */
export const setNavigationRef = (nav: NavigationProp<any> | null) => {
  navigationRef = nav;
};

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Flag to prevent multiple token refresh attempts
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });

  failedQueue = [];
};

/**
 * Request interceptor to add auth token
 */
apiClient.interceptors.request.use(
  async (config) => {
    try {
      const token = await getAuthToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch {
      // Silently fail if token retrieval fails
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

/**
 * Response interceptor for error handling and token refresh
 */
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as any & { _retry?: boolean };

    // Handle 401 Unauthorized
    if (error.response?.status === 401 && !originalRequest._retry) {
      // If already retrying, redirect to login
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            return apiClient(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Attempt to refresh the token
        // Note: Backend refresh endpoint is not yet implemented
        // For now, we'll clear the auth state and redirect to login

        processQueue(error, null);

        // Clear stored auth data
        await removeAuthToken();

        // Navigate to login screen
        if (navigationRef) {
          navigationRef.reset({
            index: 0,
            routes: [{ name: 'Login' }],
          });
        }

        return Promise.reject(error);
      } catch (refreshError) {
        processQueue(refreshError, null);

        // Clear stored auth data
        await removeAuthToken();

        // Navigate to login screen
        if (navigationRef) {
          navigationRef.reset({
            index: 0,
            routes: [{ name: 'Login' }],
          });
        }

        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // Handle other errors
    if (error.response) {
      // Server responded with error status
      const errorData = error.response.data as { error?: string; code?: string };
      const errorMessage = errorData.error || errorData.code || 'An error occurred';
      console.error('API Error:', errorMessage);
    } else if (error.request) {
      // Request made but no response
      console.error('Network Error: No response received');
    } else {
      // Error in request setup
      console.error('Request Error:', error.message);
    }

    return Promise.reject(error);
  }
);

export default apiClient;

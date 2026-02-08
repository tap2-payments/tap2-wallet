/**
 * Secure Storage Service
 * Wrapper around expo-secure-store for storing sensitive data
 */

import * as SecureStore from 'expo-secure-store';

// Storage keys
export const StorageKeys = {
  AUTH_TOKEN: 'auth_token',
  REFRESH_TOKEN: 'refresh_token',
  USER_DATA: 'user_data',
  PIN_HASH: 'pin_hash',
  BIOMETRIC_ENABLED: 'biometric_enabled',
  DEVICE_ID: 'device_id',
} as const;

type StorageKey = (typeof StorageKeys)[keyof typeof StorageKeys];

/**
 * Check if secure store is available
 */
export async function isSecureStoreAvailable(): Promise<boolean> {
  try {
    await SecureStore.isAvailableAsync();
    return true;
  } catch {
    return false;
  }
}

/**
 * Store a string value securely
 */
export async function setSecureItem(key: StorageKey, value: string): Promise<boolean> {
  try {
    await SecureStore.setItemAsync(key, value);
    return true;
  } catch (error) {
    console.error(`Error storing secure item ${key}:`, error);
    return false;
  }
}

/**
 * Retrieve a string value from secure storage
 */
export async function getSecureItem(key: StorageKey): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch (error) {
    console.error(`Error retrieving secure item ${key}:`, error);
    return null;
  }
}

/**
 * Remove a value from secure storage
 */
export async function removeSecureItem(key: StorageKey): Promise<boolean> {
  try {
    await SecureStore.deleteItemAsync(key);
    return true;
  } catch (error) {
    console.error(`Error removing secure item ${key}:`, error);
    return false;
  }
}

/**
 * Clear all auth-related secure storage
 */
export async function clearAuthStorage(): Promise<boolean> {
  try {
    await Promise.all([
      SecureStore.deleteItemAsync(StorageKeys.AUTH_TOKEN),
      SecureStore.deleteItemAsync(StorageKeys.REFRESH_TOKEN),
      SecureStore.deleteItemAsync(StorageKeys.USER_DATA),
      SecureStore.deleteItemAsync(StorageKeys.PIN_HASH),
      SecureStore.deleteItemAsync(StorageKeys.BIOMETRIC_ENABLED),
    ]);
    return true;
  } catch (error) {
    console.error('Error clearing auth storage:', error);
    return false;
  }
}

// ============================================================================
// Auth Token Helpers
// ============================================================================

/**
 * Store the auth token
 */
export async function setAuthToken(token: string): Promise<boolean> {
  return setSecureItem(StorageKeys.AUTH_TOKEN, token);
}

/**
 * Get the auth token
 */
export async function getAuthToken(): Promise<string | null> {
  return getSecureItem(StorageKeys.AUTH_TOKEN);
}

/**
 * Remove the auth token
 */
export async function removeAuthToken(): Promise<boolean> {
  return removeSecureItem(StorageKeys.AUTH_TOKEN);
}

// ============================================================================
// Refresh Token Helpers
// ============================================================================

/**
 * Store the refresh token
 */
export async function setRefreshToken(token: string): Promise<boolean> {
  return setSecureItem(StorageKeys.REFRESH_TOKEN, token);
}

/**
 * Get the refresh token
 */
export async function getRefreshToken(): Promise<string | null> {
  return getSecureItem(StorageKeys.REFRESH_TOKEN);
}

// ============================================================================
// User Data Helpers
// ============================================================================

/**
 * Store user data (JSON serialized)
 */
export async function setUserData<T extends Record<string, unknown>>(data: T): Promise<boolean> {
  try {
    const json = JSON.stringify(data);
    return setSecureItem(StorageKeys.USER_DATA, json);
  } catch (error) {
    console.error('Error storing user data:', error);
    return false;
  }
}

/**
 * Get user data (parsed from JSON)
 */
export async function getUserData<T>(): Promise<T | null> {
  try {
    const json = await getSecureItem(StorageKeys.USER_DATA);
    if (!json) return null;
    return JSON.parse(json) as T;
  } catch (error) {
    console.error('Error retrieving user data:', error);
    return null;
  }
}

/**
 * Remove user data
 */
export async function removeUserData(): Promise<boolean> {
  return removeSecureItem(StorageKeys.USER_DATA);
}

// ============================================================================
// PIN Helpers
// ============================================================================

/**
 * Store the PIN hash
 */
export async function setPINHash(hash: string): Promise<boolean> {
  return setSecureItem(StorageKeys.PIN_HASH, hash);
}

/**
 * Get the PIN hash
 */
export async function getPINHash(): Promise<string | null> {
  return getSecureItem(StorageKeys.PIN_HASH);
}

/**
 * Remove the PIN hash
 */
export async function removePINHash(): Promise<boolean> {
  return removeSecureItem(StorageKeys.PIN_HASH);
}

// ============================================================================
// Biometric Helpers
// ============================================================================

/**
 * Set biometric authentication enabled status
 */
export async function setBiometricEnabled(enabled: boolean): Promise<boolean> {
  return setSecureItem(StorageKeys.BIOMETRIC_ENABLED, enabled ? '1' : '0');
}

/**
 * Check if biometric authentication is enabled
 */
export async function isBiometricEnabled(): Promise<boolean> {
  const value = await getSecureItem(StorageKeys.BIOMETRIC_ENABLED);
  return value === '1';
}

/**
 * Remove biometric setting
 */
export async function removeBiometricSetting(): Promise<boolean> {
  return removeSecureItem(StorageKeys.BIOMETRIC_ENABLED);
}

// ============================================================================
// Device ID Helpers
// ============================================================================

/**
 * Store device ID
 */
export async function setDeviceId(deviceId: string): Promise<boolean> {
  return setSecureItem(StorageKeys.DEVICE_ID, deviceId);
}

/**
 * Get device ID
 */
export async function getDeviceId(): Promise<string | null> {
  return getSecureItem(StorageKeys.DEVICE_ID);
}

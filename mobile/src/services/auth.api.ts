/**
 * Auth API Service
 * API client for authentication endpoints
 */

import apiClient from './api';
import type {
  UserResponse,
  RegisterInput,
  RegisterResponse,
  LoginInput,
  LoginResponse,
  ProfileUpdateInput,
  KYCVerifyInput,
  KYCVerifyResponse,
  PinSetInput,
  PinVerifyInput,
  PinResponse,
} from '@/types';

// ============================================================================
// Auth Endpoints
// ============================================================================

/**
 * Register a new user
 */
export async function register(data: RegisterInput): Promise<RegisterResponse> {
  const response = await apiClient.post<RegisterResponse>('/auth/register', data);
  return response.data;
}

/**
 * Login with email/phone and password
 */
export async function login(data: LoginInput): Promise<LoginResponse> {
  const response = await apiClient.post<LoginResponse>('/auth/login', data);
  return response.data;
}

/**
 * Get current user's profile
 */
export async function getProfile(): Promise<{ user: UserResponse }> {
  const response = await apiClient.get<{ user: UserResponse }>('/auth/profile');
  return response.data;
}

/**
 * Update current user's profile
 */
export async function updateProfile(data: ProfileUpdateInput): Promise<{ user: UserResponse }> {
  const response = await apiClient.put<{ user: UserResponse }>('/auth/profile', data);
  return response.data;
}

/**
 * Update KYC verification status
 */
export async function verifyKYC(data: KYCVerifyInput): Promise<KYCVerifyResponse> {
  const response = await apiClient.post<KYCVerifyResponse>('/auth/verify-kyc', data);
  return response.data;
}

/**
 * Set or update spending PIN
 */
export async function setPIN(data: PinSetInput): Promise<PinResponse> {
  const response = await apiClient.post<PinResponse>('/auth/pin', data);
  return response.data;
}

/**
 * Verify spending PIN
 */
export async function verifyPIN(data: PinVerifyInput): Promise<PinResponse> {
  const response = await apiClient.post<PinResponse>('/auth/pin/verify', data);
  return response.data;
}

/**
 * Check if user has a PIN set
 */
export async function getPINStatus(): Promise<{ hasPin: boolean }> {
  const response = await apiClient.get<{ hasPin: boolean }>('/auth/pin/status');
  return response.data;
}

/**
 * Refresh access token
 * Note: Not yet implemented on backend
 */
export async function refreshToken(): Promise<{ token: string; expiresIn: number }> {
  const response = await apiClient.post<{ token: string; expiresIn: number }>('/auth/refresh');
  return response.data;
}

// ============================================================================
// Auth API Object (for convenience)
// ============================================================================

export const authApi = {
  register,
  login,
  getProfile,
  updateProfile,
  verifyKYC,
  setPIN,
  verifyPIN,
  getPINStatus,
  refreshToken,
};

/**
 * Authentication and User Profile API service.
 */
import { apiClient, setAuthToken, clearAuthToken } from './client';

export interface UserResponse {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'researcher' | 'user';
  is_active: boolean;
  profile?: {
    bio?: string;
    avatar_url?: string;
    preferences: Record<string, unknown>;
  };
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  role: string;
  user_id: string;
  email: string;
  full_name: string;
}

export async function apiRegister(
  email: string,
  password: string,
  fullName: string,
  role: 'admin' | 'researcher' | 'user' = 'user',
): Promise<UserResponse> {
  return apiClient.post<UserResponse>('/api/v1/auth/register', {
    email,
    password,
    full_name: fullName,
    role,
  });
}

export async function apiLogin(email: string, password: string): Promise<TokenResponse> {
  const data = await apiClient.post<TokenResponse>('/api/v1/auth/login', {
    email,
    password,
  });
  if (data.access_token) {
    setAuthToken(data.access_token);
  }
  return data;
}

export async function apiGetMe(): Promise<UserResponse> {
  return apiClient.get<UserResponse>('/api/v1/auth/me');
}

export async function apiUpdateProfile(payload: {
  bio?: string;
  avatar_url?: string;
  preferences?: Record<string, unknown>;
}): Promise<{ bio?: string; avatar_url?: string; preferences: Record<string, unknown> }> {
  return apiClient.put('/api/v1/users/profile', payload);
}

export function apiLogout(): void {
  clearAuthToken();
}

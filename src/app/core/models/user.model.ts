// User domain model — kept in sync with auth-service AuthResponse + RegisterRequest.

export enum Role {
  PASSENGER = 'PASSENGER',
  DRIVER = 'DRIVER',
  ORGANIZER = 'ORGANIZER',
  ADMIN = 'ADMIN',
}

export type AdminRole = 'SUPER_ADMIN' | 'MODERATOR' | 'OPERATIONAL_ADMIN' | 'REPORTER' | 'AUDITEUR';

export interface User {
  id: string;
  name: string;
  email: string;
  phoneNumber: string;
  role: Role;
  adminRole?: AdminRole | string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  phoneNumber: string;
  role: Role;
}

// Mirrors auth-service AuthResponse.java exactly.
export interface AuthResponse {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  tokenType?: string;
  userId: string;
  email: string;
  role: string;
  adminRole?: string;
  name?: string;
}

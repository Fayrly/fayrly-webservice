export interface SessionUser {
  id: string;
  email: string;
  name: string;
  status: string;
  roles: string[];
  permissions: string[];
}

export interface Session {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  refresh_expires_in: number;
  user: SessionUser;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  phone?: string;
}

export interface VerifyResetCodeRequest {
  email: string;
  code: string;
}

export interface ResetPasswordCodeRequest {
  email: string;
  code: string;
  password: string;
}

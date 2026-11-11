import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import {
  LoginRequest,
  RegisterRequest,
  ResetPasswordCodeRequest,
  Session,
  SessionUser,
  VerifyResetCodeRequest,
} from '../models/auth.model';

const TOKEN_KEY = 'fayrly.access_token';
const REFRESH_KEY = 'fayrly.refresh_token';
const USER_KEY = 'fayrly.user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  private readonly userSignal = signal<SessionUser | null>(this.readUser());
  private readonly tokenSignal = signal<string | null>(this.readValue(TOKEN_KEY));

  readonly user = this.userSignal.asReadonly();
  readonly isAuthenticated = computed(() => this.userSignal() !== null);

  get accessToken(): string | null {
    return this.tokenSignal();
  }

  login(credentials: LoginRequest, remember = true): Observable<Session> {
    return this.http
      .post<Session>('/auth/login', credentials)
      .pipe(tap((session) => this.store(session, remember)));
  }

  register(payload: RegisterRequest): Observable<Session> {
    return this.http
      .post<Session>('/auth/register', payload)
      .pipe(tap((session) => this.store(session)));
  }

  loginWithFirebase(idToken: string, remember = true): Observable<Session> {
    return this.http
      .post<Session>('/auth/firebase', { id_token: idToken })
      .pipe(tap((session) => this.store(session, remember)));
  }

  requestPasswordReset(email: string): Observable<{ status: string }> {
    return this.http.post<{ status: string }>('/auth/password/forgot', { email });
  }

  verifyPasswordResetCode(payload: VerifyResetCodeRequest): Observable<void> {
    return this.http.post<void>('/auth/password/verify', payload);
  }

  resetPasswordWithCode(payload: ResetPasswordCodeRequest): Observable<void> {
    return this.http.post<void>('/auth/password/reset', payload);
  }

  logout(): void {
    const refreshToken = this.readValue(REFRESH_KEY);
    if (refreshToken) {
      this.http
        .post<void>('/auth/logout', { refresh_token: refreshToken })
        .subscribe({ error: () => undefined });
    }
    this.clear();
  }

  clearSession(): void {
    this.clear();
  }

  private store(session: Session, remember = true): void {
    this.writeValue(TOKEN_KEY, session.access_token, remember);
    this.writeValue(REFRESH_KEY, session.refresh_token, remember);
    this.writeValue(USER_KEY, JSON.stringify(session.user), remember);
    this.tokenSignal.set(session.access_token);
    this.userSignal.set(session.user);
  }

  private clear(): void {
    this.removeValue(TOKEN_KEY);
    this.removeValue(REFRESH_KEY);
    this.removeValue(USER_KEY);
    this.tokenSignal.set(null);
    this.userSignal.set(null);
  }

  private readUser(): SessionUser | null {
    const raw = this.readValue(USER_KEY);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as SessionUser;
    } catch {
      return null;
    }
  }

  private readValue(key: string): string | null {
    try {
      return sessionStorage.getItem(key) ?? localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  private writeValue(key: string, value: string, remember: boolean): void {
    try {
      const target = remember ? localStorage : sessionStorage;
      const other = remember ? sessionStorage : localStorage;
      target.setItem(key, value);
      other.removeItem(key);
    } catch {
      // Storage can be unavailable in private browsing; the in-memory session still works.
    }
  }

  private removeValue(key: string): void {
    try {
      sessionStorage.removeItem(key);
    } catch {
      // Ignore storage failures on sign-out.
    }
    try {
      localStorage.removeItem(key);
    } catch {
      // Ignore storage failures on sign-out.
    }
  }
}

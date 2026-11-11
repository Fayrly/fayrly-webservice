import { Injectable, inject } from '@angular/core';
import { FirebaseError } from 'firebase/app';
import {
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup,
  type AuthProvider,
} from 'firebase/auth';
import { firstValueFrom } from 'rxjs';
import { firebaseAuth } from '../firebase';
import { ApiError } from '../models/api-error.model';
import { Session } from '../models/auth.model';
import { AuthService } from './auth.service';

export type OAuthProviderName = 'Google' | 'Apple';

@Injectable({ providedIn: 'root' })
export class FirebaseAuthService {
  private readonly auth = inject(AuthService);

  async signIn(provider: OAuthProviderName, remember: boolean): Promise<Session> {
    const credential = await signInWithPopup(firebaseAuth, this.buildProvider(provider));
    const idToken = await credential.user.getIdToken();
    return firstValueFrom(this.auth.loginWithFirebase(idToken, remember));
  }

  errorMessage(error: unknown, provider: OAuthProviderName): string {
    if (error instanceof ApiError) {
      if (error.status === 401) {
        return `Sesi ${provider} tidak valid. Coba masuk lagi.`;
      }
      if (error.status === 403) {
        return 'Email akun ini belum terverifikasi di penyedia masuk.';
      }
      if (error.status === 409) {
        return 'Email ini sudah terhubung dengan metode masuk lain.';
      }
      if (error.status === 429) {
        return 'Terlalu banyak percobaan. Coba lagi nanti.';
      }
      if (error.status === 503) {
        return `Masuk dengan ${provider} belum dikonfigurasi di server.`;
      }
      return error.message;
    }

    if (error instanceof FirebaseError) {
      switch (error.code) {
        case 'auth/popup-closed-by-user':
        case 'auth/cancelled-popup-request':
          return `Jendela masuk ${provider} ditutup. Coba lagi.`;
        case 'auth/popup-blocked':
          return 'Popup diblokir browser. Izinkan popup untuk situs ini lalu coba lagi.';
        case 'auth/operation-not-allowed':
          return `Masuk dengan ${provider} belum diaktifkan di Firebase.`;
        case 'auth/unauthorized-domain':
          return 'Domain ini belum diizinkan di Firebase Authentication.';
        case 'auth/account-exists-with-different-credential':
          return 'Email ini sudah terdaftar dengan metode masuk lain.';
        case 'auth/network-request-failed':
          return 'Tidak dapat menghubungi Firebase. Periksa koneksimu.';
      }
    }

    return `Tidak dapat masuk dengan ${provider}. Coba lagi.`;
  }

  private buildProvider(provider: OAuthProviderName): AuthProvider {
    if (provider === 'Google') {
      const google = new GoogleAuthProvider();
      google.setCustomParameters({ prompt: 'select_account' });
      return google;
    }

    const apple = new OAuthProvider('apple.com');
    apple.addScope('email');
    apple.addScope('name');
    return apple;
  }
}

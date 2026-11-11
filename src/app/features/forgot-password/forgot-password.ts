import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../core/api/auth.service';
import { ApiError } from '../../core/models/api-error.model';

type Step = 'confirm' | 'otp' | 'password' | 'done';

const STEP_NUMBER: Record<Step, number> = { confirm: 1, otp: 2, password: 3, done: 4 };
const STEP_LABEL: Record<Step, string> = {
  confirm: 'Konfirmasi',
  otp: 'Verifikasi OTP',
  password: 'Kata sandi baru',
  done: 'Selesai',
};

@Component({
  selector: 'app-forgot-password',
  imports: [RouterLink, LucideAngularModule],
  templateUrl: './forgot-password.html',
})
export class ForgotPasswordPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly step = signal<Step>('confirm');
  protected readonly email = signal('');
  protected readonly code = signal('');
  protected readonly password = signal('');
  protected readonly confirmation = signal('');
  protected readonly showPassword = signal(false);
  protected readonly showConfirmation = signal(false);
  protected readonly loading = signal(false);
  protected readonly resending = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly cooldown = signal(0);
  protected readonly redirectIn = signal(5);

  protected readonly stepNumber = computed(() => STEP_NUMBER[this.step()]);
  protected readonly stepLabel = computed(() => STEP_LABEL[this.step()]);

  private cooldownTimer: number | null = null;
  private redirectTimer: number | null = null;

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.stopCooldown();
      this.stopRedirect();
    });
  }

  protected onEmailInput(event: Event): void {
    this.email.set((event.target as HTMLInputElement).value);
  }

  protected onCodeInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const digits = input.value.replace(/\D/g, '').slice(0, 6);
    input.value = digits;
    this.code.set(digits);
  }

  protected onPasswordInput(event: Event): void {
    this.password.set((event.target as HTMLInputElement).value);
  }

  protected onConfirmationInput(event: Event): void {
    this.confirmation.set((event.target as HTMLInputElement).value);
  }

  protected submitEmail(event?: Event): void {
    event?.preventDefault();
    if (this.loading()) {
      return;
    }

    this.error.set(null);
    this.notice.set(null);
    const email = this.email().trim();
    this.email.set(email);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this.error.set('Masukkan alamat email yang valid.');
      return;
    }

    this.loading.set(true);
    this.auth.requestPasswordReset(email).subscribe({
      next: () => {
        this.loading.set(false);
        this.startCooldown(60);
        this.step.set('otp');
        window.scrollTo({ top: 0, left: 0 });
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.error.set(this.emailErrorMessage(error));
      },
    });
  }

  protected submitCode(event?: Event): void {
    event?.preventDefault();
    if (this.loading()) {
      return;
    }

    this.error.set(null);
    this.notice.set(null);
    if (!/^\d{6}$/.test(this.code())) {
      this.error.set('Kode OTP terdiri dari 6 angka.');
      return;
    }

    this.loading.set(true);
    this.auth.verifyPasswordResetCode({ email: this.email(), code: this.code() }).subscribe({
      next: () => {
        this.loading.set(false);
        this.stopCooldown();
        this.step.set('password');
        window.scrollTo({ top: 0, left: 0 });
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.error.set(this.otpErrorMessage(error));
      },
    });
  }

  protected submitPassword(): void {
    if (this.loading()) {
      return;
    }

    this.error.set(null);
    this.notice.set(null);
    const passwordProblem = this.passwordProblem();
    if (passwordProblem) {
      this.error.set(passwordProblem);
      return;
    }

    this.loading.set(true);
    this.auth
      .resetPasswordWithCode({
        email: this.email(),
        code: this.code(),
        password: this.password(),
      })
      .subscribe({
        next: () => {
          this.loading.set(false);
          this.stopCooldown();
          this.auth.clearSession();
          this.password.set('');
          this.confirmation.set('');
          this.step.set('done');
          window.scrollTo({ top: 0, left: 0 });
          this.startRedirect();
        },
        error: (error: unknown) => {
          this.loading.set(false);
          this.error.set(this.resetErrorMessage(error));
        },
      });
  }

  protected resend(): void {
    if (this.loading() || this.resending() || this.cooldown() > 0) {
      return;
    }

    this.error.set(null);
    this.notice.set(null);
    this.resending.set(true);
    this.auth.requestPasswordReset(this.email()).subscribe({
      next: () => {
        this.resending.set(false);
        this.code.set('');
        this.notice.set('Kode baru sudah dikirim. Periksa kotak masuk dan folder spam.');
        this.startCooldown(60);
      },
      error: (error: unknown) => {
        this.resending.set(false);
        this.error.set(this.emailErrorMessage(error));
      },
    });
  }

  protected changeEmail(): void {
    this.stopCooldown();
    this.cooldown.set(0);
    this.code.set('');
    this.password.set('');
    this.confirmation.set('');
    this.error.set(null);
    this.notice.set(null);
    this.step.set('confirm');
    window.scrollTo({ top: 0, left: 0 });
  }

  protected backToCode(): void {
    this.password.set('');
    this.confirmation.set('');
    this.error.set(null);
    this.notice.set(null);
    this.step.set('otp');
    window.scrollTo({ top: 0, left: 0 });
  }

  protected togglePassword(): void {
    this.showPassword.update((visible) => !visible);
  }

  protected toggleConfirmation(): void {
    this.showConfirmation.update((visible) => !visible);
  }

  private passwordProblem(): string | null {
    const value = this.password();
    if (!value) {
      return 'Kata sandi baru wajib diisi.';
    }
    if (value.length < 8) {
      return 'Kata sandi minimal 8 karakter.';
    }
    if (value.length > 72) {
      return 'Kata sandi maksimal 72 karakter.';
    }
    if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) {
      return 'Kata sandi harus memuat huruf dan angka.';
    }
    if (value !== this.confirmation()) {
      return 'Konfirmasi kata sandi tidak cocok.';
    }
    return null;
  }

  private startCooldown(seconds: number): void {
    this.stopCooldown();
    this.cooldown.set(seconds);
    this.cooldownTimer = window.setInterval(() => {
      const next = this.cooldown() - 1;
      this.cooldown.set(next > 0 ? next : 0);
      if (next <= 0) {
        this.stopCooldown();
      }
    }, 1000);
  }

  private stopCooldown(): void {
    if (this.cooldownTimer !== null) {
      window.clearInterval(this.cooldownTimer);
      this.cooldownTimer = null;
    }
  }

  private startRedirect(): void {
    this.stopRedirect();
    this.redirectIn.set(5);
    this.redirectTimer = window.setInterval(() => {
      const next = this.redirectIn() - 1;
      this.redirectIn.set(next > 0 ? next : 0);
      if (next <= 0) {
        this.stopRedirect();
        this.router.navigateByUrl('/masuk');
      }
    }, 1000);
  }

  private stopRedirect(): void {
    if (this.redirectTimer !== null) {
      window.clearInterval(this.redirectTimer);
      this.redirectTimer = null;
    }
  }

  private emailErrorMessage(error: unknown): string {
    if (error instanceof ApiError) {
      if (error.status === 429) {
        return 'Tunggu sebentar sebelum meminta kode lagi.';
      }
      if (error.status === 422) {
        return 'Email tidak valid. Periksa kembali alamat emailmu.';
      }
      if (error.status === 503) {
        return 'Pengiriman email reset sedang tidak tersedia. Hubungi admin.';
      }
      if (error.status >= 500) {
        return 'Server sedang bermasalah. Coba lagi sebentar.';
      }
    }
    return 'Tidak dapat terhubung ke server. Periksa koneksimu.';
  }

  private otpErrorMessage(error: unknown): string {
    if (error instanceof ApiError) {
      if (error.status === 400) {
        return 'Kode OTP salah atau sudah kedaluwarsa.';
      }
      if (error.status === 429) {
        return 'Terlalu banyak percobaan. Minta kode baru lalu coba lagi.';
      }
      if (error.status === 422) {
        return 'Kode OTP harus terdiri dari 6 angka.';
      }
      if (error.status >= 500) {
        return 'Server sedang bermasalah. Coba lagi sebentar.';
      }
    }
    return 'Tidak dapat terhubung ke server. Periksa koneksimu.';
  }

  private resetErrorMessage(error: unknown): string {
    if (error instanceof ApiError) {
      if (error.status === 400) {
        return 'Kode OTP sudah tidak berlaku. Kembali ke langkah verifikasi dan minta kode baru.';
      }
      if (error.status === 422) {
        return 'Kata sandi belum memenuhi syarat. Gunakan minimal 8 karakter dengan huruf dan angka.';
      }
      if (error.status === 429) {
        return 'Terlalu banyak percobaan. Minta kode baru lalu coba lagi.';
      }
      if (error.status === 503) {
        return 'Layanan reset sedang bermasalah. Coba lagi nanti.';
      }
      if (error.status >= 500) {
        return 'Server sedang bermasalah. Coba lagi sebentar.';
      }
    }
    return 'Tidak dapat terhubung ke server. Periksa koneksimu.';
  }
}

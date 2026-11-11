import { Component, DestroyRef, ElementRef, inject, signal, viewChild } from '@angular/core';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../core/api/auth.service';
import { FirebaseAuthService, OAuthProviderName } from '../../core/api/firebase-auth.service';
import { ApiError } from '../../core/models/api-error.model';

function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const password = group.get('password')?.value;
  const confirmation = group.get('confirmPassword')?.value;
  return password === confirmation ? null : { passwordMismatch: true };
}

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink, LucideAngularModule],
  templateUrl: './register.html',
})
export class RegisterPage {
  private readonly auth = inject(AuthService);
  private readonly firebaseAuth = inject(FirebaseAuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly formBuilder = inject(NonNullableFormBuilder);

  protected readonly returnUrl = this.sanitizeReturnUrl(
    this.route.snapshot.queryParamMap.get('returnUrl'),
  );
  protected readonly loading = signal(false);
  protected readonly serverError = signal<string | null>(null);
  protected readonly oauthProvider = signal<OAuthProviderName | null>(null);
  protected readonly showPassword = signal(false);
  protected readonly showConfirmation = signal(false);

  protected readonly form = this.formBuilder.group(
    {
      name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
      email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
      phone: ['', [Validators.maxLength(32)]],
      password: [
        '',
        [
          Validators.required,
          Validators.minLength(8),
          Validators.maxLength(72),
          Validators.pattern(/^(?=.*[A-Za-z])(?=.*\d).*$/),
        ],
      ],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: passwordsMatch },
  );

  private readonly formElement = viewChild<ElementRef<HTMLFormElement>>('authForm');

  protected nameError(): string | null {
    const control = this.form.controls.name;
    if (!control.touched || control.valid) {
      return null;
    }
    if (control.hasError('required')) {
      return 'Nama wajib diisi.';
    }
    return control.hasError('minlength')
      ? 'Nama minimal 2 karakter.'
      : 'Nama maksimal 120 karakter.';
  }

  protected emailError(): string | null {
    const control = this.form.controls.email;
    if (!control.touched || control.valid) {
      return null;
    }
    return control.hasError('required') ? 'Email wajib diisi.' : 'Masukkan email yang valid.';
  }

  protected phoneError(): string | null {
    const control = this.form.controls.phone;
    if (!control.touched || control.valid) {
      return null;
    }
    return 'Nomor telepon maksimal 32 karakter.';
  }

  protected passwordError(): string | null {
    const control = this.form.controls.password;
    if (!control.touched || control.valid) {
      return null;
    }
    if (control.hasError('required')) {
      return 'Kata sandi wajib diisi.';
    }
    if (control.hasError('minlength')) {
      return 'Kata sandi minimal 8 karakter.';
    }
    if (control.hasError('maxlength')) {
      return 'Kata sandi maksimal 72 karakter.';
    }
    return 'Gunakan huruf dan angka.';
  }

  protected confirmationError(): string | null {
    const control = this.form.controls.confirmPassword;
    if (!control.touched) {
      return null;
    }
    if (control.hasError('required')) {
      return 'Konfirmasi kata sandi wajib diisi.';
    }
    return this.form.hasError('passwordMismatch') ? 'Kata sandi tidak cocok.' : null;
  }

  protected trim(field: 'name' | 'email' | 'phone'): void {
    const control = this.form.controls[field];
    control.setValue(control.value.trim());
  }

  protected togglePassword(): void {
    this.showPassword.update((visible) => !visible);
  }

  protected toggleConfirmation(): void {
    this.showConfirmation.update((visible) => !visible);
  }

  protected async oauth(provider: OAuthProviderName): Promise<void> {
    if (this.loading() || this.oauthProvider()) {
      return;
    }

    this.serverError.set(null);
    this.oauthProvider.set(provider);

    try {
      await this.firebaseAuth.signIn(provider, true);
      this.oauthProvider.set(null);
      this.router.navigateByUrl(this.returnUrl || '/');
    } catch (error) {
      this.oauthProvider.set(null);
      this.serverError.set(this.firebaseAuth.errorMessage(error, provider));
    }
  }

  protected submit(): void {
    if (this.loading() || this.oauthProvider()) {
      return;
    }

    this.serverError.set(null);
    this.trim('name');
    this.trim('email');
    this.trim('phone');

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.focusFirstInvalid();
      return;
    }

    const { name, email, phone, password } = this.form.getRawValue();
    this.loading.set(true);
    this.auth
      .register({ name, email, password, phone: phone || undefined })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.router.navigateByUrl(this.returnUrl || '/'),
        error: (error: unknown) => {
          this.loading.set(false);
          this.serverError.set(this.errorMessage(error));
        },
      });
  }

  private focusFirstInvalid(): void {
    const form = this.formElement()?.nativeElement;
    if (!form) {
      return;
    }

    const controls = this.form.controls;
    const field = controls.name.invalid
      ? 'name'
      : controls.email.invalid
        ? 'email'
        : controls.phone.invalid
          ? 'phone'
          : controls.password.invalid
            ? 'password'
            : 'confirmPassword';

    form.querySelector<HTMLInputElement>(`[formControlName="${field}"]`)?.focus();
  }

  private errorMessage(error: unknown): string {
    if (error instanceof ApiError) {
      if (error.status === 429) {
        return 'Terlalu banyak percobaan. Coba lagi nanti.';
      }
      if (error.status >= 500) {
        return 'Server sedang bermasalah. Coba lagi sebentar.';
      }
      return 'Pendaftaran tidak dapat diproses. Periksa data kamu lalu coba lagi.';
    }
    return 'Tidak dapat terhubung ke server. Periksa koneksimu.';
  }

  private sanitizeReturnUrl(raw: string | null): string {
    return raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : '';
  }
}

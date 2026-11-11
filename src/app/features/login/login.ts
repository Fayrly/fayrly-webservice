import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../core/api/auth.service';
import { FirebaseAuthService, OAuthProviderName } from '../../core/api/firebase-auth.service';
import { ApiError } from '../../core/models/api-error.model';

@Component({
  selector: 'app-login',
  imports: [RouterLink, FormsModule, LucideAngularModule],
  templateUrl: './login.html',
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly firebaseAuth = inject(FirebaseAuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly showPassword = signal(false);
  protected readonly remember = signal(false);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly oauthProvider = signal<OAuthProviderName | null>(null);
  protected readonly fieldErrors = signal<string[]>([]);
  protected readonly returnUrl = this.sanitizeReturnUrl(
    this.route.snapshot.queryParamMap.get('returnUrl'),
  );

  protected onEmailInput(event: Event): void {
    this.email.set((event.target as HTMLInputElement).value);
  }

  protected onPasswordInput(event: Event): void {
    this.password.set((event.target as HTMLInputElement).value);
  }

  protected onRememberChange(event: Event): void {
    this.remember.set((event.target as HTMLInputElement).checked);
  }

  protected async oauth(provider: OAuthProviderName): Promise<void> {
    if (this.loading() || this.oauthProvider()) {
      return;
    }

    this.error.set(null);
    this.fieldErrors.set([]);
    this.oauthProvider.set(provider);

    try {
      await this.firebaseAuth.signIn(provider, this.remember());
      this.oauthProvider.set(null);
      this.router.navigateByUrl(this.returnUrl || '/');
    } catch (error) {
      this.oauthProvider.set(null);
      this.error.set(this.firebaseAuth.errorMessage(error, provider));
    }
  }

  protected submit(event?: Event): void {
    event?.preventDefault();
    if (this.loading() || this.oauthProvider()) {
      return;
    }

    this.error.set(null);
    this.fieldErrors.set([]);

    if (!this.email().trim() || !this.password()) {
      this.error.set('Email dan password wajib diisi.');
      return;
    }

    this.loading.set(true);
    this.auth
      .login({ email: this.email().trim(), password: this.password() }, this.remember())
      .subscribe({
        next: () => {
          const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
          this.router.navigateByUrl(returnUrl && returnUrl.startsWith('/') ? returnUrl : '/');
        },
        error: (error: unknown) => {
          this.loading.set(false);
          if (error instanceof ApiError) {
            this.error.set(error.status === 401 ? 'Email atau password salah.' : error.message);
            this.fieldErrors.set(error.fieldMessages);
            return;
          }
          this.error.set('Tidak bisa masuk. Coba lagi.');
        },
      });
  }

  private sanitizeReturnUrl(raw: string | null): string {
    return raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : '';
  }
}

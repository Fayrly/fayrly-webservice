import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../api/auth.service';
import { ApiError, ApiErrorPayload } from '../models/api-error.model';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);

  return next(req).pipe(
    catchError((error: unknown) => {
      if (error instanceof ApiError) {
        return throwError(() => error);
      }
      if (error instanceof HttpErrorResponse) {
        if (error.status === 401 && !req.url.includes('/auth/')) {
          auth.clearSession();
        }
        if (error.status === 0) {
          return throwError(
            () =>
              new ApiError(
                0,
                'network_error',
                'Tidak bisa menghubungi server. Periksa koneksi atau pastikan backend berjalan.',
              ),
          );
        }
        if (error.status === 502 || error.status === 503 || error.status === 504) {
          return throwError(
            () =>
              new ApiError(
                error.status,
                'service_unavailable',
                'Server sedang tidak tersedia. Coba lagi beberapa saat.',
              ),
          );
        }
        const payload = error.error as ApiErrorPayload | null;
        const body = payload?.error;
        return throwError(
          () =>
            new ApiError(
              error.status,
              body?.code ?? 'unexpected_error',
              body?.message ?? 'Terjadi kesalahan yang tidak terduga.',
              body?.details,
              body?.request_id,
            ),
        );
      }
      return throwError(() => error);
    }),
  );
};

import { ApiError } from '../models/api-error.model';

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return 'Terjadi kesalahan saat memuat data.';
}

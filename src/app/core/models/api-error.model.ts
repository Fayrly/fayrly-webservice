export interface ApiErrorPayload {
  error: {
    code: string;
    message: string;
    details?: Record<string, string>;
    request_id?: string;
  };
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: Record<string, string>,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get fieldMessages(): string[] {
    return Object.entries(this.details ?? {}).map(([field, message]) => `${field}: ${message}`);
  }
}

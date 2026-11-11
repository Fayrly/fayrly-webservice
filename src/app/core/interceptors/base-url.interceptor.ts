import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export const baseUrlInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith('/') || req.url.startsWith('//')) {
    return next(req);
  }
  return next(req.clone({ url: `${environment.apiBaseUrl}${req.url}` }));
};

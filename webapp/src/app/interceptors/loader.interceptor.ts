import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs';
import { LoaderService } from '../services/loader.service';

export const loaderInterceptor: HttpInterceptorFn = (req, next) => {
  const loaderService = inject(LoaderService);
  
  // Don't show loader for background polls if any, or specific paths
  if (req.url.includes('/notifications') || req.headers.has('X-Skip-Loader')) {
    return next(req);
  }

  loaderService.show();
  return next(req).pipe(
    finalize(() => loaderService.hide())
  );
};

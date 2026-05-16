import { Injectable, signal, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from './api';
import { tap } from 'rxjs/operators';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private api    = inject(ApiService);
  private router = inject(Router);

  user = signal<any>(this.getStoredUser());
  token = signal<string | null>(localStorage.getItem('sello_token'));

  isLoggedIn = computed(() => !!this.token());
  isAdmin = computed(() => ['SUPER_ADMIN', 'MASTERBRAND_ADMIN'].includes(this.user()?.role));
  isMerchant = computed(() => this.user()?.role === 'MERCHANT_ADMIN');

  private getStoredUser() {
    try {
      const u = localStorage.getItem('sello_user');
      return u ? JSON.parse(u) : null;
    } catch (e) {
      localStorage.clear();
      return null;
    }
  }

  adminLogin(email: string, password: string): Observable<any> {
    return this.api.post<any>('/auth/admin/login', { email, password }).pipe(
      tap((res: any) => this.saveSession(res.data))
    );
  }

  merchantLogin(email: string, password: string): Observable<any> {
    return this.api.post<any>('/auth/merchant/login', { email, password }).pipe(
      tap((res: any) => this.saveSession(res.data))
    );
  }

  merchantSignup(data: any): Observable<any> {
    return this.api.post<any>('/auth/merchant/signup', data).pipe(
      tap((res: any) => this.saveSession(res.data))
    );
  }

  adminSignup(data: any): Observable<any> {
    return this.api.post<any>('/auth/admin/signup', data).pipe(
      tap((res: any) => this.saveSession(res.data))
    );
  }

  /**
   * Used after page refresh when the dashboard needs fresh scoped profile data.
   */
  loadProfile(): Observable<any> {
    return this.api.get<any>('/auth/profile').pipe(
      tap((res: any) => {
        const profile = res.data.profile;
        this.user.set(profile);
        localStorage.setItem('sello_user', JSON.stringify(profile));
      })
    );
  }

  saveSession(data: any) {
    this.token.set(data.token);
    this.user.set(data.user);
    localStorage.setItem('sello_token', data.token);
    localStorage.setItem('sello_user', JSON.stringify(data.user));
  }

  logout() {
    this.token.set(null);
    this.user.set(null);
    localStorage.clear();
    this.router.navigate(['/login']);
  }
}

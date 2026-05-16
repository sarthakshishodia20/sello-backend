import { Injectable, signal, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from './api';

@Injectable({
  providedIn: 'root'
})
export class CustomerAuthService {
  private api = inject(ApiService);
  private router = inject(Router);

  user = signal<any>(null);
  token = signal<string | null>(null);

  constructor() {
    this.hydrate();
  }

  private hydrate() {
    const saved = localStorage.getItem('sello_customer_session');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        this.token.set(data.token);
        this.user.set(data.user);
      } catch (e) {
        this.logout();
      }
    }
  }

  saveSession(data: any) {
    this.token.set(data.token);
    this.user.set(data.user);
    localStorage.setItem('sello_customer_session', JSON.stringify(data));
  }

  logout() {
    this.token.set(null);
    this.user.set(null);
    localStorage.removeItem('sello_customer_session');
    this.router.navigate(['/']);
  }

  isLoggedIn(): boolean {
    return !!this.token();
  }
}

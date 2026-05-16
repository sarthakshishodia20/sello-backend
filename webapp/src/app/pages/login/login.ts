import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MessageService } from 'primeng/api';
import { ApiService } from '../../services/api';
import { CustomerAuthService } from '../../services/customer-auth';

@Component({
  selector: 'app-customer-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ButtonModule, InputTextModule],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class CustomerLoginComponent {
  private api = inject(ApiService);
  private auth = inject(CustomerAuthService);
  private router = inject(Router);
  private messageService = inject(MessageService);

  mode = signal<'login' | 'signup'>('login');
  loading = signal(false);

  form = {
    email: '',
    password: '',
    name: '',
    phone: ''
  };

  toggleMode() {
    this.mode.set(this.mode() === 'login' ? 'signup' : 'login');
  }

  submit() {
    if (!this.form.email || !this.form.password) return;
    
    this.loading.set(true);
    const endpoint = this.mode() === 'login' ? '/auth/customer/login' : '/auth/customer/signup';
    
    this.api.post<any>(endpoint, this.form).subscribe({
      next: (res: any) => {
        this.auth.saveSession(res.data);
        this.messageService.add({ severity: 'success', summary: 'Welcome!', detail: 'Redirecting to your cart.' });
        this.router.navigate(['/checkout']);
      },
      error: (err: any) => {
        this.loading.set(false);
        this.messageService.add({ 
          severity: 'error', 
          summary: 'Auth Failed', 
          detail: err.error?.message || 'Login failed.' 
        });
      }
    });
  }
}

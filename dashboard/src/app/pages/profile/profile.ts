import { Component, inject, OnInit, signal } from '@angular/core';
import { NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { MessageService } from 'primeng/api';
import { TagModule } from 'primeng/tag';
import { DialogModule } from 'primeng/dialog';
import { SelectModule } from 'primeng/select';
import { ApiService } from '../../services/api';
import { AuthService } from '../../services/auth';
import { LoaderComponent } from '../../components/loader/loader.component';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [NgIf, FormsModule, ButtonModule, CardModule, InputTextModule, TextareaModule, TagModule, LoaderComponent, DialogModule, SelectModule],
  templateUrl: './profile.html',
  styleUrl: './profile.css'
})
export class ProfileComponent implements OnInit {
  api = inject(ApiService);
  auth = inject(AuthService);
  messageService = inject(MessageService);

  loading = signal(true);
  saving = signal(false);
  logoutVisible = signal(false);
  merchantProfile = signal<any | null>(null);

  cities = [
    { name: 'Delhi', code: 'Delhi' },
    { name: 'Mumbai', code: 'Mumbai' },
    { name: 'Bangalore', code: 'Bangalore' },
    { name: 'Hyderabad', code: 'Hyderabad' },
    { name: 'Chennai', code: 'Chennai' },
    { name: 'Kolkata', code: 'Kolkata' }
  ];

  // Form for either merchant or admin profile editing
  form: any = {
    name: '',
    email: '',
    phone: '',
    // Merchant specific
    description: '',
    address: '',
    city_name: '',
    delivery_time: '',
    delivery_mode: 'BOTH',
    theme_color: '#000000'
  };

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.auth.loadProfile().subscribe({
      next: () => {
        const user = this.auth.user();
        if (!user) {
          this.loading.set(false);
          return;
        }

        if (this.auth.isAdmin()) {
          // Admin profile editing
          this.form = {
            name: user.name || '',
            email: user.email || '',
            phone: user.phone || ''
          };
          this.loading.set(false);
          return;
        }
        this.api.get<any>('/merchants/profile').subscribe({
          next: (response) => {
            const merchant = response.data.merchant;
            this.merchantProfile.set(merchant);
            this.form = {
              name: merchant.merchant_name,
              description: merchant.description || '',
              email: merchant.contact_email || '',
              phone: merchant.phone || '',
              address: merchant.address || '',
              city_name: merchant.city_name || 'Delhi',
              delivery_time: merchant.delivery_time || '30 mins',
              delivery_mode: merchant.delivery_mode || 'BOTH',
              theme_color: merchant.theme_color || '#000000'
            };
            this.loading.set(false);
          },
          error: () => this.loading.set(false)
        });
      },
      error: () => this.loading.set(false)
    });
  }

  save() {
    this.saving.set(true);
    
    // Determine endpoint based on role
    const endpoint = this.auth.isAdmin() ? '/auth/profile' : '/merchants/profile';
    
    // Normalize payload
    const payload = this.auth.isAdmin() ? {
      name: this.form.name,
      email: this.form.email,
      phone: this.form.phone
    } : {
      merchant_name: this.form.name,
      description: this.form.description,
      contact_email: this.form.email,
      phone: this.form.phone,
      address: this.form.address,
      city_name: this.form.city_name,
      delivery_time: this.form.delivery_time,
      delivery_mode: this.form.delivery_mode,
      theme_color: this.form.theme_color
    };

    this.api.put(endpoint, payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.messageService.add({
          severity: 'success',
          summary: 'Profile Updated',
          detail: 'Your profile settings have been successfully saved.'
        });
        this.load();
      },
      error: (error) => {
        this.saving.set(false);
        this.messageService.add({
          severity: 'error',
          summary: 'Update Failed',
          detail: error.error?.message || 'Failed to update profile settings.'
        });
      }
    });
  }

  confirmLogout() {
    this.logoutVisible.set(true);
  }

  logout() {
    this.logoutVisible.set(false);
    this.auth.logout();
  }
}

import { Component, inject, OnInit, signal } from '@angular/core';
import { NgIf, NgFor } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DialogModule } from 'primeng/dialog';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { MessageService } from 'primeng/api';
import { ApiService } from '../../services/api';
import { AuthService } from '../../services/auth';
import { LoaderComponent } from '../../components/loader/loader.component';
import { MerchantSettingsService } from '../../services/merchant-settings';

@Component({
  selector: 'app-availability',
  standalone: true,
  imports: [NgIf, NgFor, FormsModule, ButtonModule, CardModule, DialogModule, ToggleSwitchModule, LoaderComponent],
  templateUrl: './availability.html',
  styleUrl: './availability.css'
})
export class AvailabilityComponent implements OnInit {
  api = inject(ApiService);
  auth = inject(AuthService);
  messageService = inject(MessageService);
  settingsService = inject(MerchantSettingsService);

  loading = signal(true);
  saving = signal(false);
  merchantData = signal<any | null>(null);

  scheduleEnabled = signal<boolean>(false);

  daysConfig = signal<any>({
    sunday: { enabled: false, openAllDay: true, start: '09:00', end: '18:00' },
    monday: { enabled: true, openAllDay: true, start: '09:00', end: '18:00' },
    tuesday: { enabled: true, openAllDay: true, start: '09:00', end: '18:00' },
    wednesday: { enabled: true, openAllDay: true, start: '09:00', end: '18:00' },
    thursday: { enabled: true, openAllDay: true, start: '09:00', end: '18:00' },
    friday: { enabled: true, openAllDay: true, start: '09:00', end: '18:00' },
    saturday: { enabled: false, openAllDay: true, start: '09:00', end: '18:00' }
  });

  weekdays = [
    { key: 'sunday', label: 'Sunday' },
    { key: 'monday', label: 'Monday' },
    { key: 'tuesday', label: 'Tuesday' },
    { key: 'wednesday', label: 'Wednesday' },
    { key: 'thursday', label: 'Thursday' },
    { key: 'friday', label: 'Friday' },
    { key: 'saturday', label: 'Saturday' }
  ];

  // Dialog state
  timeslotDialogVisible = signal(false);
  selectedDay = signal<string>('');
  selectedDayLabel = signal<string>('');
  tempStart = signal<string>('09:00');
  tempEnd = signal<string>('18:00');
  hasTimeslot = signal<boolean>(false);

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.api.get<any>('/merchants/profile').subscribe({
      next: (response) => {
        const merchant = response.data.merchant;
        this.merchantData.set(merchant);
        
        let mSettings: any = {};
        if (merchant.settings) {
          try {
            mSettings = typeof merchant.settings === 'string' ? JSON.parse(merchant.settings) : merchant.settings;
          } catch (e) {
            console.error('Error parsing settings:', e);
          }
        }
        
        if (mSettings.availability) {
          this.scheduleEnabled.set(mSettings.availability.enabled !== false);
          if (mSettings.availability.days) {
            this.daysConfig.set({
              ...this.daysConfig(),
              ...mSettings.availability.days
            });
          }
        }
        this.loading.set(false);
      },
      error: (err) => {
        this.messageService.add({
          severity: 'error',
          summary: 'Load Failed',
          detail: 'Failed to retrieve marketplace availability settings.'
        });
        this.loading.set(false);
      }
    });
  }

  openTimeslotDialog(day: any) {
    this.selectedDay.set(day.key);
    this.selectedDayLabel.set(day.label);
    
    const config = this.daysConfig()[day.key];
    this.tempStart.set(config.start || '09:00');
    this.tempEnd.set(config.end || '18:00');
    this.hasTimeslot.set(!!(config.start && config.end));
    
    this.timeslotDialogVisible.set(true);
  }

  addTimeslot() {
    this.hasTimeslot.set(true);
  }

  deleteTimeslot() {
    this.hasTimeslot.set(false);
  }

  saveTimeslot() {
    const config = { ...this.daysConfig() };
    const dayKey = this.selectedDay();
    
    if (this.hasTimeslot()) {
      config[dayKey] = {
        ...config[dayKey],
        start: this.tempStart(),
        end: this.tempEnd()
      };
    } else {
      config[dayKey] = {
        ...config[dayKey],
        start: null,
        end: null
      };
    }
    
    this.daysConfig.set(config);
    this.timeslotDialogVisible.set(false);
  }

  save() {
    const merchant = this.merchantData();
    if (!merchant) return;

    this.saving.set(true);

    let currentSettings: any = {};
    if (merchant.settings) {
      try {
        currentSettings = typeof merchant.settings === 'string' ? JSON.parse(merchant.settings) : merchant.settings;
      } catch (e) {}
    }

    const payload = {
      merchant_name: merchant.merchant_name,
      description: merchant.description || '',
      contact_email: merchant.contact_email || '',
      phone: merchant.phone || '',
      address: merchant.address || '',
      city_name: merchant.city_name || 'Delhi',
      delivery_time: merchant.delivery_time || '30 mins',
      delivery_mode: merchant.delivery_mode || 'BOTH',
      theme_color: merchant.theme_color || '#000000',
      settings: {
        ...currentSettings,
        availability: {
          enabled: this.scheduleEnabled(),
          days: this.daysConfig()
        }
      }
    };

    this.api.put('/merchants/profile', payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.messageService.add({
          severity: 'success',
          summary: 'Schedule Updated',
          detail: 'Your marketplace availability schedule has been successfully saved.'
        });
        this.load();
      },
      error: (error) => {
        this.saving.set(false);
        this.messageService.add({
          severity: 'error',
          summary: 'Save Failed',
          detail: error.error?.message || 'Failed to save availability schedule.'
        });
      }
    });
  }
}

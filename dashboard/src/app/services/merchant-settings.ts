import { Injectable, inject, signal } from '@angular/core';
import { ApiService } from './api';
import { AuthService } from './auth';

export interface MasterbrandSettings {
  outOfStock: boolean;
  brandCustom: boolean;
  codEnabled: boolean;
  floatingIcons: boolean;
  soundNotificationEnabled: boolean;
  availabilityEnabled: boolean;
  voiceAiEnabled: boolean;
  snoozeEnabled: boolean;
  topSellingEnabled: boolean;
  orderSettingsEnabled: boolean;
}


@Injectable({
  providedIn: 'root'
})
export class MerchantSettingsService {
  private api = inject(ApiService);
  private auth = inject(AuthService);

  settings = signal<MasterbrandSettings>({
    outOfStock: true,
    brandCustom: false,
    codEnabled: true,
    floatingIcons: true,
    soundNotificationEnabled: false,
    availabilityEnabled: false,
    voiceAiEnabled: false,
    snoozeEnabled: false,
    topSellingEnabled: false,
    orderSettingsEnabled: false
  });

  loadSettings() {
    this.api.get<any>('/merchants/settings').subscribe({
      next: (res) => {
        if (res.data.settings) {
          this.settings.set({
            outOfStock: res.data.settings.outOfStock !== false,
            brandCustom: res.data.settings.brandCustom === true,
            codEnabled: res.data.settings.codEnabled !== false,
            floatingIcons: res.data.settings.floatingIcons !== false,
            soundNotificationEnabled: res.data.settings.soundNotificationEnabled === true,
            availabilityEnabled: res.data.settings.availabilityEnabled === true,
            voiceAiEnabled: res.data.settings.voiceAiEnabled === true,
            snoozeEnabled: res.data.settings.snoozeEnabled === true,
            topSellingEnabled: res.data.settings.topSellingEnabled === true,
            orderSettingsEnabled: res.data.settings.orderSettingsEnabled === true
          });
        }
      }
    });
  }


  updateSettings(newSettings: Partial<MasterbrandSettings>) {
    if (!this.auth.isAdmin()) return;
    
    const current = this.settings();
    const updated = { ...current, ...newSettings };
    
    this.settings.set(updated);
    this.api.put('/merchants/settings', updated).subscribe();
  }
}

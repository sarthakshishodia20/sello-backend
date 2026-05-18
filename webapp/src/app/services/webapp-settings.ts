import { Injectable, signal } from '@angular/core';

export interface WebappSettings {
  floatingIcons: boolean;
  outOfStock: boolean;
  codEnabled: boolean;
  soundNotificationEnabled: boolean;
  soundNotification?: string;
}

@Injectable({ providedIn: 'root' })
export class WebappSettingsService {
  // Default to true so icons show immediately while loading settings
  settings = signal<WebappSettings>({
    floatingIcons: true,
    outOfStock: true,
    codEnabled: true,
    soundNotificationEnabled: false,
    soundNotification: 'chime'
  });

  updateSettings(newSettings: Partial<WebappSettings>) {
    this.settings.update(curr => ({ 
      ...curr, 
      ...newSettings 
    }));
  }
}

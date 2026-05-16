import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NgIf } from '@angular/common';
import { ToastModule } from 'primeng/toast';
import { NavbarComponent } from './components/navbar/navbar';
import { CartDrawerComponent } from './components/cart-drawer/cart-drawer';
import { LoaderComponent } from './components/loader/loader.component';
import { WebappSettingsService } from './services/webapp-settings';
import { ApiService } from './services/api';


@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ToastModule, NavbarComponent, CartDrawerComponent, LoaderComponent, NgIf],
  templateUrl: './app.html'
})
export class AppComponent {
  settingsService = inject(WebappSettingsService);
  api = inject(ApiService);

  ngOnInit() {
    // Initial fetch of settings from the webapp stores endpoint (which returns masterbrand settings)
    this.api.getStores('', '', 'ALL', 1, 0).subscribe({
      next: (res: any) => {
        if (res.data.settings) {
          this.settingsService.updateSettings({
            floatingIcons: res.data.settings.floatingIcons !== false,
            outOfStock: res.data.settings.outOfStock !== false,
            codEnabled: res.data.settings.codEnabled !== false
          });
        }
      }
    });
  }
}



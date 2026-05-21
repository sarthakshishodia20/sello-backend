import { Component, inject, signal, computed, HostListener, effect } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, NavigationEnd, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { filter, startWith } from 'rxjs/operators';

import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { AvatarModule } from 'primeng/avatar';
import { BadgeModule } from 'primeng/badge';
import { MenuModule } from 'primeng/menu';
import { TooltipModule } from 'primeng/tooltip';
import { RippleModule } from 'primeng/ripple';
import { DrawerModule } from 'primeng/drawer';
import { ToastModule } from 'primeng/toast';
import { DialogModule } from 'primeng/dialog';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { SelectButtonModule } from 'primeng/selectbutton';
import { MessageService } from 'primeng/api';
import { AuthService } from '../../../services/auth';
import { LanguageService, Language } from '../../../services/language.service';
import { SearchService } from '../../../services/search';
import { ApiService } from '../../../services/api';
import { environment } from '../../../../environments/environment';
import { LoaderComponent } from '../../loader/loader.component';
import { MerchantSettingsService } from '../../../services/merchant-settings';
import { AudioService } from '../../../services/audio.service';

interface NavItem {
  label: string;
  icon: string;
  route: string;
  key: string;
  badge?: string;
}

@Component({
  selector: 'app-dashboard-shell',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    ButtonModule,
    InputTextModule,
    AvatarModule,
    BadgeModule,
    MenuModule,
    TooltipModule,
    RippleModule,
    DrawerModule,
    ToastModule,
    DialogModule,
    ToggleSwitchModule,
    SelectButtonModule,
    LoaderComponent
  ],
  templateUrl: './dashboard-shell.html',
  styleUrl: './dashboard-shell.css'
})
export class DashboardShellComponent {
  public auth = inject(AuthService);
  private router = inject(Router);
  public langService = inject(LanguageService);
  private searchService = inject(SearchService);
  public settingsService = inject(MerchantSettingsService);
  private api = inject(ApiService);
  private messageService = inject(MessageService);
  private audioService = inject(AudioService);

  isSidebarCollapsed = signal(false);
  isDarkMode = signal(localStorage.getItem('theme') === 'dark');
  activePageLabel = signal('Overview');
  webappUrl = environment.webappUrl;

  sidebarOpen = signal(false);
  settingsOpen = signal(false);
  helpOpen = signal(false);
  helpWidth = signal('650px');
  logoutConfirmVisible = signal(false);
  extensionsOpen = signal(false);

  toggleExtOutOfStock(val: boolean) {
    this.settingsService.updateSettings({ outOfStock: val });
    this.showExtensionToast('Out of Stock', val);
  }

  toggleExtCustomBrand(val: boolean) {
    this.settingsService.updateSettings({ brandCustom: val });
    this.showExtensionToast('Custom Brand', val);
  }

  toggleExtCOD(val: boolean) {
    this.settingsService.updateSettings({ codEnabled: val });
    this.showExtensionToast('COD Available', val);
  }

  toggleExtFloatingIcons(val: boolean) {
    this.settingsService.updateSettings({ floatingIcons: val });
    this.showExtensionToast('Floating Icons', val);
  }

  toggleExtSoundNotification(val: boolean) {
    this.settingsService.updateSettings({ soundNotificationEnabled: val });
    this.showExtensionToast('Notification Sounds', val);
  }

  toggleExtAvailability(val: boolean) {
    this.settingsService.updateSettings({ availabilityEnabled: val });
    this.showExtensionToast('Marketplace Availability', val);
  }

  toggleExtVoiceAI(val: boolean) {
    this.settingsService.updateSettings({ voiceAiEnabled: val });
    this.showExtensionToast('AI & Voice Assistant', val);
  }

  toggleExtSnooze(val: boolean) {
    this.settingsService.updateSettings({ snoozeEnabled: val });
    this.showExtensionToast('Snooze & UnSnooze', val);
  }

  toggleExtTopSelling(val: boolean) {
    this.settingsService.updateSettings({ topSellingEnabled: val });
    this.showExtensionToast('Top Selling Products Slider', val);
  }

  toggleExtOrderSettings(val: boolean) {
    this.settingsService.updateSettings({ orderSettingsEnabled: val });
    this.showExtensionToast('Order Settings (Discount, GST, Delivery)', val);
  }

  private showExtensionToast(name: string, val: boolean) {
    if (val) {
      this.messageService.add({
        severity: 'success',
        summary: 'Extension Enabled',
        detail: `${name} has been activated successfully.`,
        life: 3000
      });
    } else {
      this.messageService.add({
        severity: 'warn',
        summary: 'Extension Disabled',
        detail: `${name} has been deactivated.`,
        life: 3000
      });
    }
  }



  // Language options for the picker
  langOptions = [
    { label: 'English', value: 'en' },
    { label: 'हिन्दी', value: 'hi' },
    { label: 'ਪੰਜਾਬੀ', value: 'pa' }
  ];

  toggleSidebar() {
    this.isSidebarCollapsed.set(!this.isSidebarCollapsed());
  }

  toggleDarkMode() {
    const nextMode = !this.isDarkMode();
    this.isDarkMode.set(nextMode);
    
    const themeStr = nextMode ? 'dark' : 'light';
    localStorage.setItem('theme', themeStr);
    if (nextMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }

    this.api.put('/auth/profile/theme', { theme: themeStr }).subscribe({
      next: () => {
        const currUser = this.auth.user();
        if (currUser) {
          currUser.themePreference = themeStr;
          this.auth.user.set({ ...currUser });
          localStorage.setItem('sello_user', JSON.stringify(currUser));
        }
      },
      error: (err) => console.error('Failed to sync theme preference to database:', err)
    });
  }

  changeLang(lang: string) {
    this.langService.setLanguage(lang as Language);
  }

  closeDrawer() {
    this.sidebarOpen.set(false);
  }

  logout() {
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    const isInsideExt = target.closest('.ext-btn-wrap');
    
    if (this.extensionsOpen() && !isInsideExt) {
      this.extensionsOpen.set(false);
    }
  }

  goToHome() {
    this.router.navigate(['/overview']);
  }

  constructor() {
    if (this.isDarkMode()) {
      document.body.classList.add('dark-mode');
    }

    effect(() => {
      const userProfile = this.auth.user();
      if (userProfile && userProfile.themePreference) {
        const dbTheme = userProfile.themePreference;
        const currentLocalTheme = localStorage.getItem('theme');
        if (dbTheme !== currentLocalTheme) {
          localStorage.setItem('theme', dbTheme);
          this.isDarkMode.set(dbTheme === 'dark');
          if (dbTheme === 'dark') {
            document.body.classList.add('dark-mode');
          } else {
            document.body.classList.remove('dark-mode');
          }
        }
      }
    });
    
    this.settingsService.loadSettings();

    // Populate localStorage with merchant's sound choice on boot
    if (this.auth.isMerchant()) {
      this.api.get<any>('/merchants/profile').subscribe({
        next: (res) => {
          const merchant = res.data.merchant;
          if (merchant && merchant.settings) {
            try {
              const parsed = typeof merchant.settings === 'string' ? JSON.parse(merchant.settings) : merchant.settings;
              localStorage.setItem('sello_soundNotification', parsed.soundNotification || 'chime');
            } catch (e) {}
          }
        }
      });
    }

    // Play chosen sound chime globally ONLY on order changes and deletions
    this.messageService.messageObserver.subscribe((msg: any) => {
      if (!msg || !this.settingsService.settings().soundNotificationEnabled) return;

      const msgs = Array.isArray(msg) ? msg : [msg];
      let shouldPlay = false;

      for (const m of msgs) {
        const summary = (m.summary || '').toLowerCase();
        const detail = (m.detail || '').toLowerCase();

        // 1. Order status changes (Summary is 'Updated' and detail contains 'order status')
        const isOrderStatus = summary === 'updated' && detail.includes('order status');

        // 2. Deletions or archives anywhere (Summary contains 'deleted', 'archived', or detail contains 'removed')
        const isDelete = summary === 'deleted' || summary === 'archived' || detail.includes('delete') || detail.includes('removed');

        if (isOrderStatus || isDelete) {
          shouldPlay = true;
          break;
        }
      }

      if (shouldPlay) {
        const soundKey = localStorage.getItem('sello_soundNotification') || 'chime';
        this.audioService.play(soundKey);
      }
    });

    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      startWith(null)
    ).subscribe(() => {
      const currentRoute = this.router.url.split('/')[1] || 'overview';
      const item = this.navItems().find(i => i.route.includes(currentRoute));
      this.activePageLabel.set(item ? item.label : 'Overview');
    });
  }

  get storeLink(): string {
    const slug = this.auth.user()?.merchantSlug;
    return slug ? `${this.webappUrl}/store/${slug}` : this.webappUrl;
  }

  onSearch(event: any) {
    this.searchService.setQuery(event.target.value);
  }

  navItems = computed<NavItem[]>(() => {
    const lang = this.langService.currentLang();
    
    if (this.auth.isAdmin()) {
      return [
        { label: this.langService.translate('nav.overview'), key: 'overview', icon: 'pi pi-home', route: '/overview' },
        { label: this.langService.translate('nav.analytics'), key: 'analytics', icon: 'pi pi-chart-bar', route: '/analytics' },
        { label: this.langService.translate('nav.products'), key: 'products', icon: 'pi pi-box', route: '/products' },
        { label: this.langService.translate('nav.merchants'), key: 'merchants', icon: 'pi pi-users', route: '/merchants' },
        { label: this.langService.translate('nav.customers'), key: 'customers', icon: 'pi pi-users', route: '/customers' },
        { label: this.langService.translate('nav.orders'), key: 'orders', icon: 'pi pi-shopping-cart', route: '/orders' },
        { label: 'Activity', key: 'activity', icon: 'pi pi-history', route: '/activity' },
        { label: 'Settings', key: 'settings', icon: 'pi pi-cog', route: '/settings' },
        { label: this.langService.translate('nav.profile'), key: 'profile', icon: 'pi pi-user', route: '/profile' }
      ];
    }

    const items = [
      { label: this.langService.translate('nav.overview'), key: 'overview', icon: 'pi pi-home', route: '/overview' },
      { label: this.langService.translate('nav.analytics'), key: 'analytics', icon: 'pi pi-chart-bar', route: '/analytics' },
      { label: this.langService.translate('nav.products'), key: 'products', icon: 'pi pi-box', route: '/products' },
      { label: this.langService.translate('nav.customers'), key: 'customers', icon: 'pi pi-users', route: '/customers' },
      { label: this.langService.translate('nav.orders'), key: 'orders', icon: 'pi pi-shopping-cart', route: '/orders' },
      { label: 'Activity', key: 'activity', icon: 'pi pi-history', route: '/activity' }
    ];

    if (this.settingsService.settings().availabilityEnabled) {
      items.push({ label: 'Availability', key: 'availability', icon: 'pi pi-calendar', route: '/availability' });
    }

    if (this.settingsService.settings().topSellingEnabled) {
      items.push({ label: 'Item Settings', key: 'item-settings', icon: 'pi pi-star-fill', route: '/item-settings' });
    }

    if (this.settingsService.settings().orderSettingsEnabled) {
      items.push({ label: 'Order Settings', key: 'order-settings', icon: 'pi pi-sliders-h', route: '/order-settings' });
    }

    items.push(
      { label: 'Settings', key: 'settings', icon: 'pi pi-cog', route: '/settings' },
      { label: this.langService.translate('nav.profile'), key: 'profile', icon: 'pi pi-user', route: '/profile' }
    );

    return items;
  });
}

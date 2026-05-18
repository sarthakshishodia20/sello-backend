import { Component, inject, signal, computed, HostListener } from '@angular/core';
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
  }

  toggleExtCustomBrand(val: boolean) {
    this.settingsService.updateSettings({ brandCustom: val });
  }

  toggleExtCOD(val: boolean) {
    this.settingsService.updateSettings({ codEnabled: val });
  }

  toggleExtFloatingIcons(val: boolean) {
    this.settingsService.updateSettings({ floatingIcons: val });
  }

  toggleExtSoundNotification(val: boolean) {
    this.settingsService.updateSettings({ soundNotificationEnabled: val });
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
    this.isDarkMode.set(!this.isDarkMode());
    if (this.isDarkMode()) {
      document.body.classList.add('dark-mode');
      localStorage.setItem('theme', 'dark');
    } else {
      document.body.classList.remove('dark-mode');
      localStorage.setItem('theme', 'light');
    }
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
    
    this.settingsService.loadSettings();

    // Play chosen sound chime globally on dashboard notifications
    this.messageService.messageObserver.subscribe((msg: any) => {
      if (this.settingsService.settings().soundNotificationEnabled) {
        const user = this.auth.user();
        let soundKey = 'chime';
        if (user && user.settings) {
          try {
            const mSettings = typeof user.settings === 'string' ? JSON.parse(user.settings) : user.settings;
            soundKey = mSettings.soundNotification || 'chime';
          } catch (e) {}
        }
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

    return [
      { label: this.langService.translate('nav.overview'), key: 'overview', icon: 'pi pi-home', route: '/overview' },
      { label: this.langService.translate('nav.analytics'), key: 'analytics', icon: 'pi pi-chart-bar', route: '/analytics' },
      { label: this.langService.translate('nav.products'), key: 'products', icon: 'pi pi-box', route: '/products' },
      { label: this.langService.translate('nav.customers'), key: 'customers', icon: 'pi pi-users', route: '/customers' },
      { label: this.langService.translate('nav.orders'), key: 'orders', icon: 'pi pi-shopping-cart', route: '/orders' },
      { label: 'Activity', key: 'activity', icon: 'pi pi-history', route: '/activity' },
      { label: 'Settings', key: 'settings', icon: 'pi pi-cog', route: '/settings' },
      { label: this.langService.translate('nav.profile'), key: 'profile', icon: 'pi pi-user', route: '/profile' }
    ];
  });
}

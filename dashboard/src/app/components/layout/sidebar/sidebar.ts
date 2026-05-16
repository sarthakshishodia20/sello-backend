import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../services/auth';
import { LanguageService } from '../../../services/language.service';
import { computed } from '@angular/core';

interface NavItem { path: string; icon: string; label: string; adminOnly?: boolean; }

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css'
})
export class SidebarComponent {
  @Input()  collapsed = false;
  @Output() toggleSidebar = new EventEmitter<void>();

  auth = inject(AuthService);
  lang = inject(LanguageService);

  navItems = computed<NavItem[]>(() => [
    { path: '/dashboard', icon: 'fa-solid fa-chart-line', label: this.lang.translate('nav.overview') },
    { path: '/dashboard/analytics', icon: 'fa-solid fa-chart-pie', label: this.lang.translate('nav.analytics') },
    { path: '/dashboard/products', icon: 'fa-solid fa-box', label: this.lang.translate('nav.products') },
    { path: '/dashboard/orders', icon: 'fa-solid fa-shopping-cart', label: this.lang.translate('nav.orders') },
    { path: '/dashboard/customers', icon: 'fa-solid fa-users', label: this.lang.translate('nav.customers') },
    { path: '/dashboard/merchants', icon: 'fa-solid fa-store', label: this.lang.translate('nav.merchants'), adminOnly: true },
    { path: '/dashboard/profile', icon: 'fa-solid fa-user-gear', label: this.lang.translate('nav.profile') }
  ]);

  filteredNavItems() {
    return this.navItems().filter((i: NavItem) => !i.adminOnly || this.auth.isAdmin());
  }

  logout() { this.auth.logout(); }
}

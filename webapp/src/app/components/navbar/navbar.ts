import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CartService } from '../../services/cart';
import { CustomerAuthService } from '../../services/customer-auth';
import { NgIf, NgFor, DecimalPipe } from '@angular/common';
import { BadgeModule } from 'primeng/badge';
import { ButtonModule } from 'primeng/button';
import { ChipModule } from 'primeng/chip';
import { LocationService } from '../../services/location';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, NgIf, NgFor, DecimalPipe, BadgeModule, ButtonModule, ChipModule],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css'
})
export class NavbarComponent {
  cart = inject(CartService);
  auth = inject(CustomerAuthService);
  location = inject(LocationService);

  isDark = signal(true);
  showCityMenu = signal(false);
  cities = ['Delhi', 'Mumbai', 'Bangalore', 'Hyderabad', 'Chennai', 'Kolkata'];

  toggleCityMenu() {
    this.showCityMenu.update(v => !v);
  }

  selectCity(city: string) {
    this.location.setCity(city);
    this.showCityMenu.set(false);
  }

  constructor() {
    const saved = localStorage.getItem('sello_theme') || 'dark';
    this.setTheme(saved === 'dark');
  }

  toggleTheme() {
    this.setTheme(!this.isDark());
  }

  private setTheme(dark: boolean) {
    this.isDark.set(dark);
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    localStorage.setItem('sello_theme', dark ? 'dark' : 'light');
  }

  cartBadge(): string | undefined {
    const n = this.cart.totalItems();
    return n > 0 ? String(n) : undefined;
  }
}

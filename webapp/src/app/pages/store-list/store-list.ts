import { Component, inject, OnInit, signal, effect } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { MessageService } from 'primeng/api';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { ApiService } from '../../services/api';
import { CustomerAuthService } from '../../services/customer-auth';
import { CartService } from '../../services/cart';
import { LocationService } from '../../services/location';
import { WebappSettingsService } from '../../services/webapp-settings';


@Component({
  selector: 'app-store-list',
  standalone: true,
  imports: [NgFor, NgIf, FormsModule, ProgressSpinnerModule],
  templateUrl: './store-list.html',
  styleUrl: './store-list.css'
})
export class StoreListComponent implements OnInit {
  api = inject(ApiService);
  auth = inject(CustomerAuthService);
  cart = inject(CartService);
  router = inject(Router);
  messageService = inject(MessageService);
  location = inject(LocationService);
  webappSettings = inject(WebappSettingsService);

  onCityChange(event: any) {
    this.location.setCity(event.target.value);
  }

  
  stores = signal<any[]>([]);
  loading = signal(true);
  loadingMore = signal(false);
  searchQuery = signal('');
  wishlisted = signal<Record<number, boolean>>({});

  limit = 12;
  offset = 0;
  hasMore = signal(true);

  private searchSubject = new Subject<string>();

  constructor() {
    // Automatically re-fetch when city changes globally
    effect(() => {
      this.location.currentCity();
      this.resetAndFetch();
    });
  }

  ngOnInit() {
    if (this.auth.isLoggedIn()) {
      this.api.getWishlist().subscribe({
        next: (res) => {
          const map: Record<number, boolean> = {};
          res.data.stores.forEach((s: any) => map[s.id] = true);
          this.wishlisted.set(map);
        }
      });
    } else {
      const saved = localStorage.getItem('sello_wishlist_stores');
      if (saved) {
        this.wishlisted.set(JSON.parse(saved));
      }
    }


    // React to city changes from navbar
    this.searchSubject.pipe(
      debounceTime(350),
      distinctUntilChanged()
    ).subscribe(query => {
      this.searchQuery.set(query);
      this.resetAndFetch();
    });

    // Initial load + watch city
    this.fetchStores();
  }

  selectedMode = signal<string>('ALL');

  setMode(mode: string) {
    this.selectedMode.set(mode);
    this.resetAndFetch();
  }

  resetAndFetch() {
    this.offset = 0;
    this.stores.set([]);
    this.hasMore.set(true);
    this.fetchStores();
  }

  fetchStores(append = false) {
    if (!append) this.loading.set(true);
    else this.loadingMore.set(true);

    const city = this.location.currentCity();
    
    this.api.getStores(this.searchQuery(), city === 'All Cities' ? '' : city, this.selectedMode(), this.limit, this.offset).subscribe({
      next: (res: any) => {
        const newStores = res.data.stores || [];
        
        // Update Masterbrand feature toggles
        if (res.data.settings) {
          this.webappSettings.updateSettings({
            floatingIcons: res.data.settings.floatingIcons !== false,
            outOfStock: res.data.settings.outOfStock !== false,
            codEnabled: res.data.settings.codEnabled !== false
          });
        }

        if (append) {
          this.stores.update(prev => [...prev, ...newStores]);
        } else {
          this.stores.set(newStores);
        }

        
        this.hasMore.set(newStores.length === this.limit);
        this.loading.set(false);
        this.loadingMore.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadingMore.set(false);
      }
    });
  }

  loadMore() {
    if (this.loading() || this.loadingMore() || !this.hasMore()) return;
    this.offset += this.limit;
    this.fetchStores(true);
  }

  onSearch(event: any) {
    this.searchSubject.next(event.target.value);
  }

  toggleLike(storeId: number, event: Event) {
    event.stopPropagation();
    
    if (this.auth.isLoggedIn()) {
      this.api.toggleWishlist('STORE', storeId).subscribe({
        next: (res) => {
          const current = this.wishlisted();
          this.wishlisted.set({ ...current, [storeId]: res.data.added });
          this.messageService.add({
            severity: 'success',
            summary: res.data.added ? 'Added to Wishlist' : 'Removed from Wishlist',
            detail: res.data.added ? 'Store saved!' : 'Store removed.'
          });
        }
      });
    } else {
      const current = this.wishlisted();
      const updated = { ...current, [storeId]: !current[storeId] };
      this.wishlisted.set(updated);
      localStorage.setItem('sello_wishlist_stores', JSON.stringify(updated));
      this.messageService.add({
        severity: 'info',
        summary: !current[storeId] ? 'Added (Guest)' : 'Removed (Guest)',
        detail: 'Log in to sync your wishlist across devices!'
      });
    }
  }


  onStoreClick(store: any) {
    if (!store.is_active) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Store Closed',
        detail: `Sorry, ${store.store_name} is currently closed. Please try again later.`,
        life: 3000
      });
      return;
    }
    this.router.navigate(['/store', store.store_slug]);
  }

  getInitials(name: string): string {
    return name?.substring(0, 2).toUpperCase() || 'ST';
  }
}

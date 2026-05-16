import { Component, inject, OnInit, signal } from '@angular/core';
import { NgFor, NgIf, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ChipModule } from 'primeng/chip';
import { InputTextModule } from 'primeng/inputtext';
import { MessageService } from 'primeng/api';
import { PaginatorModule } from 'primeng/paginator';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { ApiService } from '../../services/api';
import { CartService } from '../../services/cart';
import { CustomerAuthService } from '../../services/customer-auth';
import { LoaderService } from '../../services/loader.service';
import { WebappSettingsService } from '../../services/webapp-settings';

import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

@Component({
  selector: 'app-store',
  standalone: true,
  imports: [NgFor, NgIf, DecimalPipe, FormsModule, ButtonModule, CardModule, ChipModule, InputTextModule, PaginatorModule, ProgressSpinnerModule],
  templateUrl: './store.html',
  styleUrl: './store.css'
})
export class StoreComponent implements OnInit {
  route = inject(ActivatedRoute);
  api = inject(ApiService);
  cart = inject(CartService);
  auth = inject(CustomerAuthService);
  messageService = inject(MessageService);
  loader = inject(LoaderService);
  webappSettings = inject(WebappSettingsService);


  store = signal<any | null>(null);
  products = signal<any[]>([]);
  totalProducts = signal(0);
  categories = signal<any[]>([]);
  categoryTree = signal<any[]>([]);
  loading = signal(true);
  productsLoading = signal(false);
  
  // Lightbox
  selectedImage = signal<string | null>(null);

  // Wishlist
  wishlisted = signal<Record<number, boolean>>({});

  // Pagination & Filters
  limit = 12;
  offset = 0;
  selectedCategoryId = signal<number | null>(null);
  searchText = '';
  private searchSubject = new Subject<string>();

  ngOnInit() {
    if (this.auth.isLoggedIn()) {
      this.api.getWishlist().subscribe({
        next: (res) => {
          const map: Record<number, boolean> = {};
          res.data.products.forEach((p: any) => map[p.catalogue_id] = true);
          this.wishlisted.set(map);
        }
      });
    } else {
      const saved = localStorage.getItem('sello_wishlist_products');
      if (saved) {
        this.wishlisted.set(JSON.parse(saved));
      }
    }


    this.route.params.subscribe((params) => {
      if (params['slug']) {
        this.loadStore(params['slug']);
      }
    });

    this.searchSubject.pipe(
      debounceTime(400),
      distinctUntilChanged()
    ).subscribe(val => {
      this.searchText = val;
      this.offset = 0;
      this.loadProducts();
    });
  }

  loadStore(slug: string) {
    this.loading.set(true);
    this.loader.show();
    this.api.getStore(slug).subscribe({
      next: (response) => {
        if (!response.data.store) {
          this.loading.set(false);
          this.loader.hide();
          this.messageService.add({ severity: 'error', summary: 'Store not found', detail: 'Invalid store link.' });
          return;
        }

        // Update Masterbrand feature toggles
        if (response.data.settings) {
          this.webappSettings.updateSettings({
            floatingIcons: response.data.settings.floatingIcons !== false,
            outOfStock: response.data.settings.outOfStock !== false,
            codEnabled: response.data.settings.codEnabled !== false
          });
        }

        this.store.set(response.data.store);

        this.categories.set(response.data.categories || []);
        this.categoryTree.set(response.data.category_tree || []);
        this.loadProducts();
      },
      error: () => {
        this.loading.set(false);
        this.loader.hide();
        this.messageService.add({ severity: 'error', summary: 'Load failed', detail: 'Failed to load store data.' });
      }
    });
  }

  selectCategory(id: number | null) {
    this.selectedCategoryId.set(id);
    this.offset = 0;
    this.loadProducts();
  }

  onSearch(event: any) {
    this.searchSubject.next(event.target.value);
  }

  loadingMore = signal(false);
  hasMore = signal(true);

  loadProducts(append = false) {
    const store = this.store();
    if (!store) return;

    if (!append) {
      this.productsLoading.set(true);
      this.offset = 0;
      this.products.set([]);
    } else {
      this.loadingMore.set(true);
    }

    this.api.getStoreProducts(store.store_slug, this.selectedCategoryId(), this.searchText, this.limit, this.offset).subscribe({
      next: (response) => {
        const newProducts = response.data.products || [];
        if (append) {
          this.products.update(prev => [...prev, ...newProducts]);
        } else {
          this.products.set(newProducts);
        }

        this.totalProducts.set(response.data.total || 0);
        this.hasMore.set(this.products().length < this.totalProducts());
        
        this.loading.set(false);
        this.productsLoading.set(false);
        this.loadingMore.set(false);
        this.loader.hide();
      },
      error: () => {
        this.loading.set(false);
        this.productsLoading.set(false);
        this.loadingMore.set(false);
        this.loader.hide();
        this.messageService.add({ severity: 'error', summary: 'Load failed', detail: 'Failed to load products.' });
      }
    });
  }

  loadMore() {
    if (this.loading() || this.productsLoading() || this.loadingMore() || !this.hasMore()) return;
    this.offset += this.limit;
    this.loadProducts(true);
  }

  canAddToCart(p: any): boolean {
    if (p.is_out_of_stock) return false;
    if (p.stock_qty === -1 || p.stock_qty === null) return true;
    const inCart = this.cart.getItemQty(p.catalogue_id);
    return inCart < p.stock_qty;
  }

  addToCart(product: any) {
    if (!this.canAddToCart(product)) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Out of Stock',
        detail: 'This item is currently unavailable.'
      });
      return;
    }

    const store = this.store();
    if (!store) return;

    this.cart.addToCart(
      {
        id: store.id,
        slug: store.store_slug,
        name: store.store_name
      },
      product
    );

    this.messageService.add({
      severity: 'success',
      summary: 'Added to cart',
      detail: `${product.name} added to cart.`
    });
  }

  toggleWishlist(productId: number, event: Event) {
    event.stopPropagation();
    
    if (this.auth.isLoggedIn()) {
      this.api.toggleWishlist('PRODUCT', productId).subscribe({
        next: (res) => {
          const current = this.wishlisted();
          this.wishlisted.set({ ...current, [productId]: res.data.added });
          this.messageService.add({
            severity: 'success',
            summary: res.data.added ? 'Saved to Wishlist' : 'Removed',
            detail: res.data.added ? 'Product saved!' : 'Product removed.'
          });
        }
      });
    } else {
      const current = this.wishlisted();
      const updated = { ...current, [productId]: !current[productId] };
      this.wishlisted.set(updated);
      localStorage.setItem('sello_wishlist_products', JSON.stringify(updated));
      this.messageService.add({
        severity: 'info',
        summary: !current[productId] ? 'Saved (Guest)' : 'Removed (Guest)',
        detail: 'Sign in to keep your favorites forever!'
      });
    }
  }


  openLightbox(url: string | undefined) {
    if (url) this.selectedImage.set(url);
  }

  openCart() {
    this.cart.isOpen.set(true);
  }

  fmtPrice(value: number) {
    return `₹${Number(value || 0).toLocaleString('en-IN')}`;
  }
}

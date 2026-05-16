import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule, NgFor, NgIf, DecimalPipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { MessageService } from 'primeng/api';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { ApiService } from '../../services/api';
import { CartService } from '../../services/cart';
import { CustomerAuthService } from '../../services/customer-auth';
import { LoaderService } from '../../services/loader.service';


@Component({
  selector: 'app-wishlist',
  standalone: true,
  imports: [CommonModule, NgFor, NgIf, DecimalPipe, RouterLink, ButtonModule, CardModule, ProgressSpinnerModule],
  templateUrl: './wishlist.html',
  styleUrl: './wishlist.css'
})
export class WishlistComponent implements OnInit {
  api = inject(ApiService);
  cart = inject(CartService);
  router = inject(Router);
  messageService = inject(MessageService);
  loader = inject(LoaderService);

  auth = inject(CustomerAuthService);

  activeTab = signal<'stores' | 'products'>('stores');
  loading = signal(true);
  stores = signal<any[]>([]);
  products = signal<any[]>([]);

  ngOnInit() {
    this.loadWishlist();
  }

  loadWishlist() {
    this.loading.set(true);
    
    if (this.auth.isLoggedIn()) {
      // Fetch from DB
      this.api.getWishlist().subscribe({
        next: (res) => {
          this.stores.set(res.data.stores || []);
          this.products.set(res.data.products || []);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to load wishlist' });
        }
      });
    } else {
      // Fallback to localStorage for guests
      const storeWishlistRaw = localStorage.getItem('sello_wishlist_stores');
      const productWishlistRaw = localStorage.getItem('sello_wishlist_products');
      
      const storeWishlist = storeWishlistRaw ? JSON.parse(storeWishlistRaw) : {};
      const productWishlist = productWishlistRaw ? JSON.parse(productWishlistRaw) : {};
      
      const storeIds = Object.keys(storeWishlist).filter(id => storeWishlist[id]).map(Number);
      const productIds = Object.keys(productWishlist).filter(id => productWishlist[id]).map(Number);
      
      if (storeIds.length === 0 && productIds.length === 0) {
        this.stores.set([]);
        this.products.set([]);
        this.loading.set(false);
        return;
      }

      this.api.getWishlistBulk(storeIds, productIds).subscribe({
        next: (res) => {
          this.stores.set(res.data.stores || []);
          this.products.set(res.data.products || []);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to load guest wishlist' });
        }
      });
    }
  }


  setTab(tab: 'stores' | 'products') {
    this.activeTab.set(tab);
  }

  removeStore(storeId: number, event: Event) {
    event.stopPropagation();
    
    if (this.auth.isLoggedIn()) {
      this.api.toggleWishlist('STORE', storeId).subscribe({
        next: () => {
          this.stores.update(prev => prev.filter(s => s.id !== storeId));
          this.messageService.add({ severity: 'info', summary: 'Removed', detail: 'Store removed' });
        }
      });
    } else {
      const saved = localStorage.getItem('sello_wishlist_stores');
      if (saved) {
        const wishlist = JSON.parse(saved);
        delete wishlist[storeId];
        localStorage.setItem('sello_wishlist_stores', JSON.stringify(wishlist));
        this.stores.update(prev => prev.filter(s => s.id !== storeId));
        this.messageService.add({ severity: 'info', summary: 'Removed', detail: 'Store removed from wishlist' });
      }
    }
  }

  removeProduct(productId: number, event: Event) {
    event.stopPropagation();
    
    if (this.auth.isLoggedIn()) {
      this.api.toggleWishlist('PRODUCT', productId).subscribe({
        next: () => {
          this.products.update(prev => prev.filter(p => p.catalogue_id !== productId));
          this.messageService.add({ severity: 'info', summary: 'Removed', detail: 'Product removed' });
        }
      });
    } else {
      const saved = localStorage.getItem('sello_wishlist_products');
      if (saved) {
        const wishlist = JSON.parse(saved);
        delete wishlist[productId];
        localStorage.setItem('sello_wishlist_products', JSON.stringify(wishlist));
        this.products.update(prev => prev.filter(p => p.catalogue_id !== productId));
        this.messageService.add({ severity: 'info', summary: 'Removed', detail: 'Product removed from wishlist' });
      }
    }
  }


  addToCart(product: any, event: Event) {
    event.stopPropagation();
    this.cart.addToCart(
      { id: product.merchant_id, slug: product.store_slug, name: product.store_name },
      product
    );
    this.messageService.add({ severity: 'success', summary: 'Added', detail: 'Added to cart' });
  }

  fmtPrice(value: number) {
    return `₹${Number(value || 0).toLocaleString('en-IN')}`;
  }
}

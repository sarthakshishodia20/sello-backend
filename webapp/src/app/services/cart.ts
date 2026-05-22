import { Injectable, computed, signal } from '@angular/core';

export interface CartMerchant {
  id: number;
  slug: string;
  name: string;
}

export interface CartItem {
  catalogue_id: number;
  source_product_id: number;
  merchant_product_id?: number | null;
  sku: string;
  name: string;
  price: number;
  quantity: number;
  image_url?: string;
}

interface CartState {
  merchant: CartMerchant | null;
  items: CartItem[];
}

@Injectable({ providedIn: 'root' })
export class CartService {
  private state = signal<CartState>(this.loadCart());
  isOpen = signal(false);

  merchant = computed(() => this.state().merchant);
  items = computed(() => this.state().items);
  totalItems = computed(() => this.items().reduce((sum, item) => sum + item.quantity, 0));
  totalPrice = computed(() => this.items().reduce((sum, item) => sum + item.price * item.quantity, 0));

  private loadCart(): CartState {
    const raw = localStorage.getItem('selo_cart');
    return raw ? JSON.parse(raw) : { merchant: null, items: [] };
  }

  private saveCart() {
    localStorage.setItem('selo_cart', JSON.stringify(this.state()));
  }

  /**
   * Cart is locked to a single merchant so checkout remains simple in Phase 1.
   * If the user switches stores, the cart is replaced with the new merchant context.
   */
  addToCart(merchant: CartMerchant, product: any) {
    const current = this.state();
    const activeMerchant = current.merchant;
    let nextItems = current.items;

    if (!activeMerchant || activeMerchant.id !== merchant.id) {
      nextItems = [];
    }

    const existing = nextItems.find((item) => item.catalogue_id === product.catalogue_id);

    if (existing) {
      nextItems = nextItems.map((item) =>
        item.catalogue_id === product.catalogue_id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      );
    } else {
      nextItems = [
        ...nextItems,
        {
          catalogue_id: product.catalogue_id,
          source_product_id: product.source_product_id,
          merchant_product_id: product.merchant_product_id,
          sku: product.sku,
          name: product.name,
          price: Number(product.final_price ?? product.price),
          quantity: 1,
          image_url: product.image_url
        }
      ];
    }

    this.state.set({ merchant, items: nextItems });
    this.saveCart();
    this.isOpen.set(true);
  }

  updateQty(catalogueId: number, delta: number) {
    const updatedItems = this.items()
      .map((item) => {
        if (item.catalogue_id === catalogueId) {
          return { ...item, quantity: Math.max(0, item.quantity + delta) };
        }
        return item;
      })
      .filter((item) => item.quantity > 0);

    this.state.set({
      merchant: updatedItems.length ? this.merchant() : null,
      items: updatedItems
    });
    this.saveCart();
  }

  getItemQty(catalogueId: number): number {
    return this.items().find(i => i.catalogue_id === catalogueId)?.quantity || 0;
  }

  clear() {
    this.state.set({ merchant: null, items: [] });
    this.saveCart();
  }
}

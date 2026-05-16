import { Component, inject } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { ChipModule } from 'primeng/chip';
import { DrawerModule } from 'primeng/drawer';
import { CartService } from '../../services/cart';

@Component({
  selector: 'app-cart-drawer',
  standalone: true,
  imports: [NgFor, NgIf, RouterLink, ButtonModule, ChipModule, DrawerModule],
  templateUrl: './cart-drawer.html',
  styleUrl: './cart-drawer.css'
})
export class CartDrawerComponent {
  cart = inject(CartService);

  close() {
    this.cart.isOpen.set(false);
  }

  fmtPrice(value: number) {
    return `₹${Number(value || 0).toLocaleString('en-IN')}`;
  }
}

import { Component, inject, signal } from '@angular/core';
import { NgIf, NgFor } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { MessageService } from 'primeng/api';
import { CartService } from '../../services/cart';
import { ApiService } from '../../services/api';
import { CustomerAuthService } from '../../services/customer-auth';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [NgIf, NgFor, FormsModule, RouterLink, ButtonModule, CardModule],
  templateUrl: './checkout.html',
  styleUrl: './checkout.css'
})
export class CheckoutComponent {
  cart   = inject(CartService);
  api    = inject(ApiService);
  auth   = inject(CustomerAuthService);
  router = inject(Router);
  messageService = inject(MessageService);

  loading = signal(false);
  form: any = { 
    name: this.auth.user()?.name || '', 
    phone: this.auth.user()?.phone || '', 
    email: this.auth.user()?.email || '', 
    address: '', 
    notes: '' 
  };

  submit() {
    if (this.cart.items().length === 0 || !this.cart.merchant()) return;
    if (!this.form.name || !this.form.phone || !this.form.address) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Missing Details',
        detail: 'Please fill in your Name, Phone and Address to continue.'
      });
      return;
    }

    // Instead of placing order, go to review/payment page
    this.router.navigate(['/payment'], { 
      state: { 
        address: {
          customer_name: this.form.name,
          customer_phone: this.form.phone,
          customer_email: this.form.email,
          customer_address: this.form.address,
          notes: this.form.notes
        } 
      } 
    });
  }


  fmtPrice(v: number) {
    return '₹' + v.toLocaleString('en-IN');
  }
}

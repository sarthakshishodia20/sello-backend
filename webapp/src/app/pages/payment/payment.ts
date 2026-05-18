import { Component, inject, OnInit, signal } from '@angular/core';
import { NgIf, NgFor, DecimalPipe } from '@angular/common';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { MessageService } from 'primeng/api';
import { CartService } from '../../services/cart';
import { ApiService } from '../../services/api';
import { CustomerAuthService } from '../../services/customer-auth';
import { WebappSettingsService } from '../../services/webapp-settings';
import { AudioService } from '../../services/audio.service';

@Component({
  selector: 'app-payment',
  standalone: true,
  imports: [NgIf, NgFor, DecimalPipe, RouterLink, ButtonModule, CardModule],
  template: `
    <div class="payment-page container animate-fade">
      <div class="payment-card">
        <header class="payment-header">
          <h1>Payment Confirmation</h1>
          <p>Review your order and select payment method</p>
        </header>

        <div class="payment-content" *ngIf="!loadingBreakdown(); else loader">
          <div class="bill-section" *ngIf="breakdown()">
            <h3>Order Summary</h3>
            <div class="bill-row" *ngFor="let item of breakdown()?.items">
              <span class="item-info">{{ item.quantity }}x {{ item.product_name }}</span>
              <span class="item-price">₹{{ item.line_total | number:'1.0-0' }}</span>
            </div>
            
            <div class="bill-divider"></div>
            
            <div class="bill-row">
              <span>Subtotal</span>
              <span>₹{{ breakdown()?.subtotal | number:'1.0-0' }}</span>
            </div>
            <div class="bill-row">
              <span>Delivery Fee</span>
              <span class="free">FREE</span>
            </div>
            
            <div class="bill-total">
              <span>Total Amount</span>
              <span>₹{{ breakdown()?.total_amount | number:'1.0-0' }}</span>
            </div>
          </div>

          <div class="method-section">
            <h3>Payment Method</h3>
            <div class="method-card active">
              <div class="method-info">
                <i class="pi pi-money-bill"></i>
                <div>
                  <strong>Cash on Delivery (COD)</strong>
                  <p>Pay when you receive the order</p>
                </div>
              </div>
              <i class="pi pi-check-circle"></i>
            </div>
          </div>

          <div class="actions">
            <button class="confirm-btn" [disabled]="placing()" (click)="placeOrder()">
              <i class="pi pi-spin pi-spinner" *ngIf="placing()"></i>
              <span>{{ placing() ? 'Placing Order...' : 'Confirm & Place Order' }}</span>
            </button>
            <a routerLink="/checkout" class="back-link">Go back to Address</a>
          </div>
        </div>

        <ng-template #loader>
          <div class="payment-loading">
            <i class="pi pi-spin pi-spinner"></i>
            <p>Calculating final bill...</p>
          </div>
        </ng-template>
      </div>
    </div>
  `,
  styles: [`
    .payment-page {
      padding: 60px 0;
      min-height: 85vh;
      display: flex;
      justify-content: center;
      align-items: flex-start;
    }

    .payment-card {
      width: 100%;
      max-width: 500px;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 24px;
      padding: 32px;
      box-shadow: 0 20px 50px rgba(0,0,0,0.3);
    }

    .payment-header {
      margin-bottom: 30px;
    }

    .payment-header h1 {
      font-size: 1.75rem;
      font-weight: 800;
      margin-bottom: 8px;
    }

    .payment-header p {
      color: var(--text-muted);
    }

    .bill-section {
      background: rgba(255,255,255,0.02);
      border-radius: 16px;
      padding: 20px;
      margin-bottom: 24px;
    }

    .bill-section h3 {
      font-size: 1rem;
      margin-bottom: 16px;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .bill-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 12px;
      font-weight: 500;
    }

    .item-info {
      color: var(--text-main);
      max-width: 70%;
    }

    .free {
      color: #22c55e;
      font-weight: 700;
    }

    .bill-divider {
      height: 1px;
      background: var(--border);
      margin: 16px 0;
    }

    .bill-total {
      display: flex;
      justify-content: space-between;
      margin-top: 16px;
      font-size: 1.25rem;
      font-weight: 800;
      color: var(--primary);
    }

    .method-section h3 {
      font-size: 1rem;
      margin-bottom: 16px;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .method-card {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px;
      border: 2px solid var(--border);
      border-radius: 16px;
      cursor: pointer;
      transition: all 0.3s ease;
    }

    .method-card.active {
      border-color: var(--primary);
      background: rgba(253, 242, 0, 0.05);
    }

    .method-info {
      display: flex;
      gap: 16px;
      align-items: center;
    }

    .method-info i {
      font-size: 1.5rem;
      color: var(--primary);
    }

    .method-info p {
      font-size: 0.85rem;
      color: var(--text-muted);
      margin-top: 2px;
    }

    .method-card .pi-check-circle {
      color: var(--primary);
      font-size: 1.25rem;
    }

    .actions {
      margin-top: 32px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      align-items: center;
    }

    .confirm-btn {
      width: 100%;
      height: 56px;
      background: var(--primary);
      color: #000;
      border: none;
      border-radius: 16px;
      font-size: 1.1rem;
      font-weight: 800;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      cursor: pointer;
      transition: all 0.3s ease;
      box-shadow: 0 10px 30px rgba(253, 242, 0, 0.2);
    }

    .confirm-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 15px 40px rgba(253, 242, 0, 0.3);
    }

    .confirm-btn:disabled {
      opacity: 0.7;
      cursor: not-allowed;
      transform: none;
    }

    .back-link {
      color: var(--text-muted);
      text-decoration: none;
      font-size: 0.9rem;
      font-weight: 600;
      transition: color 0.3s ease;
    }

    .back-link:hover {
      color: #fff;
    }

    .payment-loading {
      text-align: center;
      padding: 40px 0;
    }

    .payment-loading i {
      font-size: 3rem;
      color: var(--primary);
      margin-bottom: 16px;
    }
  `]
})
export class PaymentComponent implements OnInit {
  cart   = inject(CartService);
  api    = inject(ApiService);
  auth   = inject(CustomerAuthService);
  router = inject(Router);
  route  = inject(ActivatedRoute);
  messageService = inject(MessageService);
  webappSettings = inject(WebappSettingsService);
  audio          = inject(AudioService);

  loadingBreakdown = signal(false);
  placing = signal(false);
  breakdown = signal<any>(null);
  addressData: any = null;

  ngOnInit() {
    // Check if we have cart items
    if (this.cart.items().length === 0) {
      this.router.navigate(['/']);
      return;
    }

    // Get address from state (passed from checkout)
    this.addressData = history.state.address;
    if (!this.addressData) {
      this.router.navigate(['/checkout']);
      return;
    }

    this.loadBreakdown();
  }

  loadBreakdown() {
    const merchant = this.cart.merchant();
    if (!merchant) return;

    this.loadingBreakdown.set(true);
    const items = this.cart.items().map(i => ({ catalogue_id: i.catalogue_id, quantity: i.quantity }));
    
    this.api.getBillBreakdown(merchant.id, items).subscribe({
      next: (res) => {
        this.breakdown.set(res.data);
        this.loadingBreakdown.set(false);
      },
      error: (err) => {
        this.loadingBreakdown.set(false);
        const msg = err.error?.message || 'Could not calculate bill.';
        this.messageService.add({ 
          severity: 'error', 
          summary: 'Order Issue', 
          detail: msg 
        });
        this.router.navigate(['/checkout']);
      }

    });
  }

  placeOrder() {
    if (this.placing()) return;
    this.placing.set(true);

    const payload = {
      ...this.addressData,
      merchant_id: this.cart.merchant()?.id,
      customer_id: this.auth.user()?.id,
      items: this.cart.items().map((item) => ({
        catalogue_id: item.catalogue_id,
        quantity: item.quantity
      }))
    };

    this.api.placeOrder(payload).subscribe({
      next: (res: any) => {
        this.placing.set(false);
        if (this.webappSettings.settings().soundNotificationEnabled) {
          this.audio.play(this.webappSettings.settings().soundNotification || 'chime');
        }
        this.cart.clear();
        this.router.navigate(['/order-success'], { queryParams: { order: res.data.order_no } });
      },
      error: (err) => {
        this.placing.set(false);
        this.messageService.add({
          severity: 'error',
          summary: 'Order Failed',
          detail: err.error?.message || 'Something went wrong.'
        });
      }
    });
  }
}

import { Component, inject, OnInit, signal } from '@angular/core';
import { NgFor, NgIf, DatePipe, DecimalPipe } from '@angular/common';
import { ApiService } from '../../services/api';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';

@Component({
  selector: 'app-my-orders',
  standalone: true,
  imports: [NgFor, NgIf, DatePipe, DecimalPipe, ButtonModule, TagModule],
  templateUrl: './my-orders.html',
  styleUrl: './my-orders.css'
})
export class MyOrdersComponent implements OnInit {
  private api = inject(ApiService);
  private messageService = inject(MessageService);

  orders = signal<any[]>([]);
  loading = signal(true);

  ngOnInit() {
    this.fetchOrders();
  }

  fetchOrders() {
    this.loading.set(true);
    this.api.getMyOrders().subscribe({
      next: (res: any) => {
        this.orders.set(res.data.orders || []);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to fetch orders.' });
      }
    });
  }

  getStatusSeverity(status: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    switch (status) {
      case 'DELIVERED': return 'success';
      case 'CANCELLED': return 'danger';
      case 'PLACED': return 'info';
      case 'OUT_FOR_DELIVERY': return 'warn';
      default: return 'secondary';
    }
  }

  showCancelDialog = signal(false);
  orderToCancel = signal<number | null>(null);

  openCancelDialog(id: number) {
    this.orderToCancel.set(id);
    this.showCancelDialog.set(true);
  }

  closeCancelDialog() {
    this.showCancelDialog.set(false);
    this.orderToCancel.set(null);
  }

  confirmCancel() {
    const id = this.orderToCancel();
    if (!id) return;

    this.api.cancelOrder(id).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Cancelled', detail: 'Order cancelled successfully.' });
        this.closeCancelDialog();
        this.fetchOrders();
      },
      error: (err: any) => {
        this.messageService.add({ 
          severity: 'error', 
          summary: 'Failed', 
          detail: err.error?.message || 'Cannot cancel order.' 
        });
        this.closeCancelDialog();
      }
    });
  }
}


import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { NgFor, NgIf, CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DialogModule } from 'primeng/dialog';
import { MessageService, ConfirmationService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { SelectModule } from 'primeng/select';
import { TooltipModule } from 'primeng/tooltip';
import { DatePickerModule } from 'primeng/datepicker';
import { CheckboxModule } from 'primeng/checkbox';
import { ApiService } from '../../services/api';
import { AuthService } from '../../services/auth';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [
    CommonModule, NgFor, NgIf, FormsModule, 
    ButtonModule, CardModule, DialogModule, ConfirmDialogModule,
    ProgressSpinnerModule, TableModule, TagModule, SelectModule, 
    TooltipModule, DatePickerModule, CheckboxModule
  ],
  providers: [ConfirmationService],
  templateUrl: './orders.html',
  styleUrl: './orders.css'
})
export class OrdersComponent implements OnInit {
  api = inject(ApiService);
  auth = inject(AuthService);
  messageService = inject(MessageService);
  confService = inject(ConfirmationService);
  langService = this.api.langService;

  orders = signal<any[]>([]);
  selectedOrders = signal<any[]>([]);
  detailOrder = signal<any | null>(null);
  stats = signal<any | null>(null);
  loading = signal(false);
  detailVisible = signal(false);

  readonly rainbowColors = [
    'var(--rb-odd)',
    'var(--rb-even)'
  ];

  // Filters
  searchQuery = signal('');
  filterDate = signal<Date | null>(null);
  activeTab = signal('all');
  
  private searchSubject = new Subject<string>();

  // Pagination
  totalRecords = signal(0);
  limit = 10;
  offset = 0;

  readonly tabs = [
    { label: 'All', value: 'all' },
    { label: 'New', value: 'PLACED' },
    { label: 'Confirmed', value: 'CONFIRMED' },
    { label: 'Preparing', value: 'PREPARING' },
    { label: 'Dispatched', value: 'OUT_FOR_DELIVERY' },
    { label: 'Completed', value: 'DELIVERED' },
    { label: 'Cancelled', value: 'CANCELLED' }
  ];

  readonly orderStatuses = [
    { label: 'Placed', value: 'PLACED' },
    { label: 'Confirmed', value: 'CONFIRMED' },
    { label: 'Preparing', value: 'PREPARING' },
    { label: 'Dispatched', value: 'OUT_FOR_DELIVERY' },
    { label: 'Delivered', value: 'DELIVERED' },
    { label: 'Cancelled', value: 'CANCELLED' }
  ];




  ngOnInit() {
    this.load();
    this.loadStats();

    this.searchSubject.pipe(
      debounceTime(400),
      distinctUntilChanged()
    ).subscribe(() => {
      this.offset = 0;
      this.load();
    });
  }

  loadStats() {
    this.api.get<any>('/orders/stats').subscribe({
      next: (response) => this.stats.set(response.data.stats)
    });
  }

  load() {
    this.loading.set(true);
    const params: any = {
      limit: this.limit,
      page: Math.floor(this.offset / this.limit) + 1,
      search: this.searchQuery(),
      status: this.activeTab() === 'all' ? '' : this.activeTab()
    };

    if (this.filterDate()) {
      const d = this.filterDate()!;
      params.date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    this.api.get<any>('/orders', params).subscribe({
      next: (response) => {
        this.orders.set(response.data.orders || []);
        this.totalRecords.set(response.data.total || 0);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.messageService.add({ severity: 'error', summary: 'Failed', detail: 'Could not load orders.' });
      }
    });
  }

  onSearch(event: any) {
    this.searchQuery.set(event.target.value);
    this.searchSubject.next(this.searchQuery());
  }

  onDateSelect() {
    this.offset = 0;
    this.load();
  }

  onPageChange(event: any) {
    this.offset = event.first;
    this.limit = event.rows;
    this.load();
  }

  openDetail(order: any) {
    this.api.get<any>(`/orders/${order.id}`).subscribe({
      next: (response) => {
        this.detailOrder.set(response.data.order);
        this.detailVisible.set(true);
      }
    });
  }

  deleteSelected() {
    if (!this.selectedOrders().length) return;

    this.confService.confirm({
      message: `Are you sure you want to delete ${this.selectedOrders().length} orders?`,
      header: 'Confirm Deletion',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        const ids = this.selectedOrders().map(o => o.id);
        this.api.delete('/orders', { ids }).subscribe({
          next: () => {
            this.messageService.add({ severity: 'success', summary: 'Deleted', detail: 'Orders removed successfully.' });
            this.selectedOrders.set([]);
            this.load();
          },
          error: (err) => {
            this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'Delete failed.' });
          }
        });
      }
    });
  }

  setStatus(order: any, status: string) {
    this.api.put(`/orders/${order.id}/status`, { status }).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Updated', detail: `Order status changed to ${status}.` });
        this.load();
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Failed', detail: err.error?.message || 'Update failed.' });
      }
    });
  }

  getRowColor(status: string): string {
    switch (status) {
      case 'PLACED': return '#fef2f2';    // Light Red
      case 'CONFIRMED': return '#fffbeb'; // Light Yellow
      case 'PREPARING': return '#f0f9ff'; // Light Blue
      case 'OUT_FOR_DELIVERY': return '#f5f3ff'; // Light Purple
      case 'DELIVERED': return '#f0fdf4'; // Light Green
      case 'CANCELLED': return '#f8fafc'; // Light Gray
      default: return 'transparent';
    }
  }

  severity(status: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    switch (status) {
      case 'DELIVERED': return 'success';
      case 'CANCELLED': return 'danger';
      case 'OUT_FOR_DELIVERY': return 'info';
      case 'CONFIRMED': return 'warn';
      default: return 'secondary';
    }
  }

  fmtCurrency(value: number) {
    return `₹${Number(value || 0).toLocaleString('en-IN')}`;
  }

  setTab(val: string) {
    this.activeTab.set(val);
    this.offset = 0;
    this.load();
  }

  fmtDate(date: string) {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  }
}

import { Component, OnInit, inject, signal, ViewChild } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { DialogModule } from 'primeng/dialog';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { MessageService, ConfirmationService } from 'primeng/api';
import { DatePickerModule } from 'primeng/datepicker';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';

@Component({
  selector: 'app-customers',
  standalone: true,
  imports: [
    CommonModule, FormsModule, TableModule, ButtonModule, 
    InputTextModule, TagModule, TooltipModule, DialogModule, 
    ConfirmDialogModule, DatePickerModule
  ],
  providers: [ConfirmationService],
  templateUrl: './customers.html',
  styleUrls: ['./customers.css']
})
export class CustomersComponent implements OnInit {
  api = inject(ApiService);
  private messageService = inject(MessageService);
  private confService = inject(ConfirmationService);

  customers = signal<any[]>([]);
  loading = signal(true);
  
  // Filters
  searchQuery = signal('');
  filterDate = signal<Date | null>(null);
  private searchSubject = new Subject<string>();

  // Dialogs
  selectedCustomer = signal<any | null>(null);
  viewVisible = signal(false);
  editVisible = signal(false);

  readonly rainbowColors = [
    'var(--rb-1)',
    'var(--rb-2)',
    'var(--rb-3)',
    'var(--rb-4)',
    'var(--rb-5)'
  ];

  ngOnInit() {
    this.loadCustomers();

    this.searchSubject.pipe(
      debounceTime(400),
      distinctUntilChanged()
    ).subscribe(() => {
      this.loadCustomers();
    });
  }

  loadCustomers() {
    this.loading.set(true);
    const params: any = {
      search: this.searchQuery()
    };

    if (this.filterDate()) {
      const d = this.filterDate()!;
      params.date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    this.api.get<any>('/auth/customers', params).subscribe({
      next: (response) => {
        this.customers.set(response.data.customers || []);
        this.loading.set(false);
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to load customers' });
        this.loading.set(false);
      }
    });
  }

  onSearch(event: any) {
    this.searchQuery.set(event.target.value);
    this.searchSubject.next(this.searchQuery());
  }

  onDateSelect() {
    this.loadCustomers();
  }

  openView(customer: any) {
    this.selectedCustomer.set({ ...customer });
    this.viewVisible.set(true);
  }

  openEdit(customer: any) {
    this.selectedCustomer.set({ ...customer });
    this.editVisible.set(true);
  }

  saveCustomer() {
    const cust = this.selectedCustomer();
    if (!cust) return;

    this.api.put(`/auth/customers/${cust.id}`, cust).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Customer updated' });
        this.editVisible.set(false);
        this.loadCustomers();
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to update customer' });
      }
    });
  }

  deleteCustomer(customer: any) {
    this.confService.confirm({
      message: `Are you sure you want to delete customer "${customer.name}"?`,
      header: 'Confirm Deletion',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.api.delete(`/auth/customers/${customer.id}`).subscribe({
          next: () => {
            this.messageService.add({ severity: 'success', summary: 'Deleted', detail: 'Customer removed' });
            this.loadCustomers();
          },
          error: () => {
            this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to delete customer' });
          }
        });
      }
    });
  }

  getPlatformSeverity(platform: string): 'success' | 'info' | 'warn' | 'secondary' {
    switch (platform?.toLowerCase()) {
      case 'web': return 'info';
      case 'mobile': return 'success';
      case 'app': return 'warn';
      default: return 'secondary';
    }
  }

  fmtDate(date: string) {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  }

  getRowColor(index: number): string {
    const colors = ['#fef2f2', '#fffbeb', '#f0f9ff', '#f5f3ff', '#f0fdf4'];
    return colors[index % colors.length];
  }
}

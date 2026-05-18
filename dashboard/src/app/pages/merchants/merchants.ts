import { Component, inject, OnInit, signal, effect } from '@angular/core';
import { NgFor, NgIf, CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { MessageService } from 'primeng/api';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { DrawerModule } from 'primeng/drawer';
import { TextareaModule } from 'primeng/textarea';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { SelectModule } from 'primeng/select';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TooltipModule } from 'primeng/tooltip';
import { ApiService } from '../../services/api';
import { SearchService } from '../../services/search';
import { AuthService } from '../../services/auth';
import { ConfirmationService } from 'primeng/api';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-merchants',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    ButtonModule,
    CardModule,
    DialogModule,
    InputTextModule,
    ProgressSpinnerModule,
    TableModule,
    TagModule,
    DrawerModule,
    TextareaModule,
    ToggleSwitchModule,
    SelectModule,
    ConfirmDialogModule,
    TooltipModule
  ],
  providers: [ConfirmationService],
  templateUrl: './merchants.html',
  styleUrl: './merchants.css'
})
export class MerchantsComponent implements OnInit {
  api = inject(ApiService);
  messageService = inject(MessageService);
  searchService = inject(SearchService);
  confirmationService = inject(ConfirmationService);

  merchants = signal<any[]>([]);
  loading = signal(false);
  previewVisible = signal(false);
  previewProducts = signal<any[]>([]);
  previewMerchant = signal<any | null>(null);

  // Pagination & Search
  totalRecords = signal(0);
  limit = 10;
  offset = 0;
  search = '';
  searchSubject = new Subject<string>();
  webappUrl = environment.webappUrl;

  selectedMerchants = signal<any[]>([]);

  selectedStatus = signal('all');
  statusOptions = [
    { label: 'All Merchants', value: 'all' },
    { label: 'Active Only', value: 'active' },
    { label: 'Inactive Only', value: 'inactive' }
  ];

  mobileStatusOptions = [
    { label: 'All', value: 'all' },
    { label: 'Active', value: 'active' },
    { label: 'Inactive', value: 'inactive' }
  ];

  constructor() {
    effect(() => {
      const q = this.searchService.query();
      // console.log('[Merchants] Search Effect triggered', { query: q });
      
      this.search = q;
      this.offset = 0;
      this.load();
    }, { allowSignalWrites: true });
  }

  ngOnInit() {
    this.searchSubject.pipe(
      debounceTime(400),
      distinctUntilChanged()
    ).subscribe(searchTerm => {
      this.search = searchTerm;
      this.offset = 0;
      this.load();
    });
  }

  onStatusChange(newStatus: string) {
    this.selectedStatus.set(newStatus);
    this.offset = 0;
    this.load();
  }

  load(silent = false) {
    if (!silent) this.loading.set(true);
    const params: any = {
      limit: this.limit,
      page: Math.floor(this.offset / this.limit) + 1,
      status: this.selectedStatus()
    };
    if (this.search) params.search = this.search;

    // console.log('[Merchants] Loading with params', params);

    this.api.get<any>('/merchants', params).subscribe({
      next: (response) => {
        this.merchants.set(response.data.merchants || []);
        this.totalRecords.set(response.data.total || 0);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.messageService.add({
          severity: 'error',
          summary: 'Load failed',
          detail: 'Failed to load merchant list.'
        });
      }
    });
  }

  toggle(merchant: any) {
    // The [(ngModel)] has already updated merchant.is_active
    const newState = merchant.is_active;

    this.api.put(`/merchants/${merchant.merchant_id}/status`, { is_active: newState }).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Merchant updated',
          detail: `Status updated for ${merchant.merchant_name}.`
        });
        // No need to call load() here, the signal object is already updated by ngModel
      },
      error: () => {
        // Rollback on error
        merchant.is_active = !newState;
        // Trigger a signal update to force UI refresh on rollback
        this.merchants.set([...this.merchants()]);
        this.messageService.add({ severity: 'error', summary: 'Failed', detail: 'Could not update merchant status.' });
      }
    });
  }

  onPageChange(event: any) {
    this.offset = event.first;
    this.limit = event.rows;
    this.load();
  }

  onSearch(event: any) {
    const value = event.target.value;
    this.search = value;
    if (value.length > 0) this.loading.set(true); 
    this.searchSubject.next(value);
  }

  toggleSelection(merchant: any) {
    const selected = this.selectedMerchants();
    const index = selected.findIndex(m => m.merchant_id === merchant.merchant_id);
    if (index > -1) {
      selected.splice(index, 1);
    } else {
      selected.push(merchant);
    }
    this.selectedMerchants.set([...selected]);
  }

  selectAll(event: any) {
    if (event.target.checked) {
      this.selectedMerchants.set([...this.merchants()]);
    } else {
      this.selectedMerchants.set([]);
    }
  }

  isSelected(merchant: any) {
    return this.selectedMerchants().some(m => m.merchant_id === merchant.merchant_id);
  }

  isAllSelected() {
    const current = this.merchants();
    return current.length > 0 && this.selectedMerchants().length === current.length;
  }

  deleteDialogVisible = signal(false);
  detailDialogVisible = signal(false);
  selectedMerchantDetail = signal<any>(null);
  detailDialogColor = signal<string>('#ffffff');

  rainbowColors = ['var(--rb-odd)', 'var(--rb-even)'];

  openDetail(merchant: any, index: number) {
    this.selectedMerchantDetail.set(merchant);
    const colorIndex = index % 5;
    this.detailDialogColor.set(this.rainbowColors[colorIndex]);
    this.detailDialogVisible.set(true);
  }

  confirmBulkDelete() {
    const selected = this.selectedMerchants();
    if (selected.length === 0) return;
    this.deleteDialogVisible.set(true);
  }

  proceedWithDelete() {
    const selected = this.selectedMerchants();
    if (selected.length === 0) return;
    
    this.loading.set(true);
    let completed = 0;
    let hasError = false;

    // Ideally backend should have a bulk delete API, but we'll loop for now
    selected.forEach(merchant => {
      this.api.delete(`/merchants/${merchant.merchant_id}`).subscribe({
        next: () => {
          completed++;
          if (completed === selected.length) this.finalizeDelete(hasError);
        },
        error: () => {
          hasError = true;
          completed++;
          if (completed === selected.length) this.finalizeDelete(hasError);
        }
      });
    });
  }

  finalizeDelete(hasError: boolean) {
    this.deleteDialogVisible.set(false);
    if (hasError) {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Some merchants could not be deleted.' });
    } else {
      this.messageService.add({ severity: 'success', summary: 'Deleted', detail: 'Selected merchants removed successfully.' });
    }
    this.selectedMerchants.set([]);
    this.load();
  }

  isAdmin() {
    return this.auth.user()?.role === 'SUPER_ADMIN' || this.auth.user()?.role === 'ADMIN';
  }

  auth = inject(AuthService);

  previewCatalogue(merchant: any) {
    this.previewMerchant.set(merchant);
    this.previewVisible.set(true);
    this.previewProducts.set([]);

    this.api.get<any>('/products/inherited', { merchant_id: merchant.merchant_id }).subscribe({
      next: (response) => this.previewProducts.set(response.data.products || [])
    });
  }

  createVisible = signal(false);
  saving = signal(false);
  createForm: any = { name: '', email: '', phone: '', address: '', password: '' };

  openCreate() {
    this.createForm = { name: '', email: '', phone: '', address: '', password: '' };
    this.createVisible.set(true);
  }

  saveMerchant() {
    if (!this.createForm.name || !this.createForm.email || !this.createForm.password) {
      this.messageService.add({ severity: 'warn', summary: 'Missing fields', detail: 'Name, Email and Password are required.' });
      return;
    }

    this.saving.set(true);
    this.api.post('/merchants', this.createForm).subscribe({
      next: () => {
        this.saving.set(false);
        this.createVisible.set(false);
        this.messageService.add({ severity: 'success', summary: 'Merchant created', detail: 'New merchant added successfully.' });
        this.load();
      },
      error: (err) => {
        this.saving.set(false);
        this.messageService.add({ severity: 'error', summary: 'Creation failed', detail: err?.error?.message || 'Failed to create merchant.' });
      }
    });
  }

  statusSeverity(isActive: boolean) {
    return isActive ? 'success' : 'contrast';
  }

  sourceSeverity(sourceType: string): 'info' | 'warn' {
    return sourceType === 'MERCHANT' ? 'warn' : 'info';
  }

  fmtCurrency(value: number) {
    return `₹${Number(value || 0).toLocaleString('en-IN')}`;
  }
}

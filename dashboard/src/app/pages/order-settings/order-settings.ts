import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api';
import { AuthService } from '../../services/auth';
import { MessageService } from 'primeng/api';
import { MerchantSettingsService } from '../../services/merchant-settings';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { TooltipModule } from 'primeng/tooltip';
import { DialogModule } from 'primeng/dialog';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

type ActiveDialog = 'discount' | 'gst' | 'delivery' | null;

@Component({
  selector: 'app-order-settings',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    TagModule,
    ButtonModule,
    InputTextModule,
    InputNumberModule,
    TooltipModule,
    DialogModule
  ],
  templateUrl: './order-settings.html',
  styleUrl: './order-settings.css'
})
export class OrderSettingsComponent implements OnInit, OnDestroy {
  api = inject(ApiService);
  auth = inject(AuthService);
  messageService = inject(MessageService);
  settingsService = inject(MerchantSettingsService);
  router = inject(Router);

  readonly LIMIT = 20;

  // ── Table State ──
  products = signal<any[]>([]);
  total = signal(0);
  loading = signal(false);
  search = '';
  offset = 0;
  selectedProducts = signal<any[]>([]);

  // ── Search ──
  suggestions = signal<string[]>([]);
  showSuggestions = signal(false);
  private searchSubject = new Subject<string>();
  private suggestionSubject = new Subject<string>();

  // ── Dialog ──
  activeDialog = signal<ActiveDialog>(null);
  confirmValue = signal(0);
  saving = signal(false);

  private clickListener = () => this.showSuggestions.set(false);

  ngOnInit() {
    if (!this.settingsService.settings().orderSettingsEnabled) {
      this.router.navigate(['/']);
      return;
    }

    document.addEventListener('click', this.clickListener);
    this.loadProducts();

    this.searchSubject.pipe(debounceTime(400), distinctUntilChanged()).subscribe(val => {
      this.search = val;
      this.offset = 0;
      this.loadProducts();
    });

    this.suggestionSubject.pipe(debounceTime(300), distinctUntilChanged()).subscribe(val => {
      if (!val || val.length < 2) {
        this.suggestions.set([]);
        this.showSuggestions.set(false);
        return;
      }
      this.fetchSuggestions(val);
    });
  }

  ngOnDestroy() {
    document.removeEventListener('click', this.clickListener);
    this.searchSubject.complete();
    this.suggestionSubject.complete();
  }

  loadProducts(event?: any) {
    this.loading.set(true);
    if (event) this.offset = event.first || 0;

    const params: any = { limit: this.LIMIT, offset: this.offset };
    if (this.search) params.search = this.search;

    this.api.get<any>('/products/inherited', params).subscribe({
      next: (res) => {
        this.products.set(res.data.products || []);
        this.total.set(res.data.total || 0);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.messageService.add({ severity: 'error', summary: 'Load Failed', detail: 'Failed to fetch products.' });
      }
    });
  }

  onSearch(event: any) {
    const val = event.target?.value || '';
    this.search = val;
    this.searchSubject.next(val);
    this.suggestionSubject.next(val);
  }

  fetchSuggestions(query: string) {
    this.api.get<any>('/products/suggestions', { search: query }).subscribe({
      next: (res) => {
        this.suggestions.set(res.data.suggestions || []);
        this.showSuggestions.set(this.suggestions().length > 0);
      },
      error: () => this.suggestions.set([])
    });
  }

  selectSuggestion(val: string) {
    this.search = val;
    this.showSuggestions.set(false);
    this.searchSubject.next(val);
  }

  // ── Dialog: open ──
  openDialog(type: ActiveDialog) {
    if (this.selectedProducts().length === 0) {
      this.messageService.add({ severity: 'warn', summary: 'No Selection', detail: 'Please select at least one product.' });
      return;
    }
    this.confirmValue.set(0);
    this.activeDialog.set(type);
  }

  closeDialog() {
    this.activeDialog.set(null);
  }

  // ── Apply bulk update ──
  applyBulkUpdate() {
    const type = this.activeDialog();
    if (!type) return;

    const catalogueIds = this.selectedProducts().map((p: any) => p.catalogue_id);
    this.saving.set(true);

    let endpoint = '';
    let body: any = { catalogueIds };
    let label = '';
    let unit = '';

    if (type === 'discount') {
      endpoint = '/products/bulk/discount';
      body.discountPercent = this.confirmValue();
      label = 'Discount';
      unit = `${this.confirmValue()}%`;
    } else if (type === 'gst') {
      endpoint = '/products/bulk/gst';
      body.gstPercent = this.confirmValue();
      label = 'GST';
      unit = `${this.confirmValue()}%`;
    } else {
      endpoint = '/products/bulk/delivery';
      body.deliveryCharge = this.confirmValue();
      label = 'Delivery Charge';
      unit = `₹${this.confirmValue()}`;
    }

    this.api.post(endpoint, body).subscribe({
      next: () => {
        this.saving.set(false);
        this.activeDialog.set(null);
        this.selectedProducts.set([]);
        this.messageService.add({
          severity: 'success',
          summary: `${label} Updated`,
          detail: `${unit} applied to ${catalogueIds.length} product(s).`
        });
        this.loadProducts();
      },
      error: () => {
        this.saving.set(false);
        this.messageService.add({ severity: 'error', summary: 'Update Failed', detail: 'Failed to apply changes.' });
      }
    });
  }

  // ── Final Price computation ──
  // Final = base_price × (1 - discount%/100) × (1 + gst%/100) + delivery_charge
  getFinalPrice(product: any): number {
    const base = parseFloat(product.effective_price) || 0;
    const disc = parseFloat(product.discount_percent) || 0;
    const gst = parseFloat(product.gst_percent) || 0;
    const delivery = parseFloat(product.delivery_charge) || 0;
    return (base * (1 - disc / 100) * (1 + gst / 100)) + delivery;
  }

  // ── Helper: dialog metadata ──
  get dialogConfig() {
    const type = this.activeDialog();
    if (type === 'discount') return { title: 'Apply Discount', icon: 'pi-percentage', label: 'Discount (%)', suffix: ' %', prefix: '', max: 100, color: '#16a34a', confirmClass: 'os-confirm-discount', btnLabel: 'Apply Discount' };
    if (type === 'gst')      return { title: 'Apply GST', icon: 'pi-receipt', label: 'GST (%)', suffix: ' %', prefix: '', max: 100, color: '#d97706', confirmClass: 'os-confirm-gst', btnLabel: 'Apply GST' };
    if (type === 'delivery') return { title: 'Set Delivery Charge', icon: 'pi-truck', label: 'Delivery Charge (₹)', suffix: '', prefix: '₹ ', max: 99999, color: '#6366f1', confirmClass: 'os-confirm-delivery', btnLabel: 'Set Delivery Charge' };
    return null;
  }
}

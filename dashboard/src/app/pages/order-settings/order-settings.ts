import { Component, inject, OnInit, OnDestroy, signal } from '@angular/core';
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

type SectionType = 'discount' | 'gst' | 'delivery';

interface SectionState {
  products: any[];
  total: number;
  loading: boolean;
  search: string;
  offset: number;
  searchSubject: Subject<string>;
  selectedProducts: any[];
  confirmVisible: boolean;
  confirmValue: number;
  saving: boolean;
  suggestions: string[];
  showSuggestions: boolean;
  suggestionSubject: Subject<string>;
}

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

  // ── Discount Section ──
  discount: SectionState = this.createState();
  // ── GST Section ──
  gst: SectionState = this.createState();
  // ── Delivery Section ──
  delivery: SectionState = this.createState();

  private createState(): SectionState {
    return {
      products: [],
      total: 0,
      loading: false,
      search: '',
      offset: 0,
      searchSubject: new Subject<string>(),
      selectedProducts: [],
      confirmVisible: false,
      confirmValue: 0,
      saving: false,
      suggestions: [],
      showSuggestions: false,
      suggestionSubject: new Subject<string>()
    };
  }

  private clickListener = () => {
    this.discount.showSuggestions = false;
    this.gst.showSuggestions = false;
    this.delivery.showSuggestions = false;
  };

  ngOnInit() {
    if (!this.settingsService.settings().orderSettingsEnabled) {
      this.router.navigate(['/']);
      return;
    }

    document.addEventListener('click', this.clickListener);
    this.initSection('discount');
    this.initSection('gst');
    this.initSection('delivery');
  }

  ngOnDestroy() {
    document.removeEventListener('click', this.clickListener);
    this.discount.searchSubject.complete();
    this.discount.suggestionSubject.complete();
    this.gst.searchSubject.complete();
    this.gst.suggestionSubject.complete();
    this.delivery.searchSubject.complete();
    this.delivery.suggestionSubject.complete();
  }

  private initSection(section: SectionType) {
    const s = this[section];
    this.loadProducts(section);

    s.searchSubject.pipe(debounceTime(400), distinctUntilChanged()).subscribe(value => {
      s.search = value;
      s.offset = 0;
      this.loadProducts(section);
    });

    s.suggestionSubject.pipe(debounceTime(300), distinctUntilChanged()).subscribe(value => {
      if (!value || value.length < 2) {
        s.suggestions = [];
        s.showSuggestions = false;
        return;
      }
      this.fetchSuggestions(section, value);
    });
  }

  loadProducts(section: SectionType, event?: any) {
    const s = this[section];
    s.loading = true;

    // Handle lazy load events (paginator)
    if (event) {
      s.offset = event.first || 0;
    }

    const params: any = { limit: this.LIMIT, offset: s.offset };
    if (s.search) params.search = s.search;

    this.api.get<any>('/products/inherited', params).subscribe({
      next: (response) => {
        s.products = response.data.products || [];
        s.total = response.data.total || 0;
        s.loading = false;
      },
      error: () => {
        s.loading = false;
        this.messageService.add({ severity: 'error', summary: 'Load Failed', detail: 'Failed to fetch products.' });
      }
    });
  }

  onSearch(section: SectionType, event: any) {
    const val = event.target?.value || '';
    const s = this[section];
    s.search = val;
    s.searchSubject.next(val);
    s.suggestionSubject.next(val);
  }

  fetchSuggestions(section: SectionType, query: string) {
    const s = this[section];
    this.api.get<any>('/products/suggestions', { search: query }).subscribe({
      next: (response) => {
        s.suggestions = response.data.suggestions || [];
        s.showSuggestions = s.suggestions.length > 0;
      },
      error: () => { s.suggestions = []; }
    });
  }

  selectSuggestion(section: SectionType, val: string) {
    const s = this[section];
    s.search = val;
    s.showSuggestions = false;
    s.searchSubject.next(val);
  }

  openConfirm(section: SectionType) {
    const s = this[section];
    if (s.selectedProducts.length === 0) {
      this.messageService.add({ severity: 'warn', summary: 'No Selection', detail: 'Please select at least one product.' });
      return;
    }
    s.confirmValue = 0;
    s.confirmVisible = true;
  }

  applyBulkUpdate(section: SectionType) {
    const s = this[section];
    const catalogueIds = s.selectedProducts.map((p: any) => p.catalogue_id);
    s.saving = true;

    let endpoint = '';
    let body: any = { catalogueIds };

    if (section === 'discount') {
      endpoint = '/products/bulk/discount';
      body.discountPercent = s.confirmValue;
    } else if (section === 'gst') {
      endpoint = '/products/bulk/gst';
      body.gstPercent = s.confirmValue;
    } else {
      endpoint = '/products/bulk/delivery';
      body.deliveryCharge = s.confirmValue;
    }

    this.api.post(endpoint, body).subscribe({
      next: (res: any) => {
        s.saving = false;
        s.confirmVisible = false;
        s.selectedProducts = [];
        const label = section === 'discount' ? 'Discount' : section === 'gst' ? 'GST' : 'Delivery Charge';
        const unit = section === 'delivery' ? `₹${s.confirmValue}` : `${s.confirmValue}%`;
        this.messageService.add({ severity: 'success', summary: `${label} Updated`, detail: `${unit} applied to ${catalogueIds.length} product(s).` });
        this.loadProducts(section);
      },
      error: () => {
        s.saving = false;
        this.messageService.add({ severity: 'error', summary: 'Update Failed', detail: 'Failed to apply changes.' });
      }
    });
  }

  // ── Display helpers ──

  getSectionLabel(section: SectionType): string {
    return { discount: 'Discount Management', gst: 'GST Management', delivery: 'Delivery Charge' }[section];
  }

  getSectionDesc(section: SectionType): string {
    return {
      discount: 'Set bulk discount percentage for selected products.',
      gst: 'Apply GST percentage to selected catalogue products.',
      delivery: 'Configure delivery charge (₹) per product.'
    }[section];
  }

  getSectionIcon(section: SectionType): string {
    return { discount: 'pi pi-percentage', gst: 'pi pi-receipt', delivery: 'pi pi-truck' }[section];
  }

  getConfirmLabel(section: SectionType): string {
    return { discount: 'Discount (%)', gst: 'GST (%)', delivery: 'Delivery Charge (₹)' }[section];
  }

  getApplyBtnLabel(section: SectionType): string {
    return { discount: 'Apply Discount', gst: 'Apply GST', delivery: 'Apply Charge' }[section];
  }

  getBadgeValue(product: any, section: SectionType): string {
    if (section === 'discount') return product.discount_percent > 0 ? `${product.discount_percent}% OFF` : 'No Discount';
    if (section === 'gst') return product.gst_percent > 0 ? `GST ${product.gst_percent}%` : 'No GST';
    return product.delivery_charge > 0 ? `₹${product.delivery_charge}` : 'Free Delivery';
  }

  getBadgeSeverity(product: any, section: SectionType): 'success' | 'warn' | 'info' | 'secondary' {
    if (section === 'discount') return product.discount_percent > 0 ? 'success' : 'secondary';
    if (section === 'gst') return product.gst_percent > 0 ? 'warn' : 'secondary';
    return product.delivery_charge > 0 ? 'info' : 'secondary';
  }
}

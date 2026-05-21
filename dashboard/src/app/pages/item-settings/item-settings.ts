import { Component, inject, OnInit, signal } from '@angular/core';
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
import { TooltipModule } from 'primeng/tooltip';
import { Router } from '@angular/router';

@Component({
  selector: 'app-item-settings',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    TagModule,
    ButtonModule,
    InputTextModule,
    TooltipModule
  ],
  templateUrl: './item-settings.html',
  styleUrl: './item-settings.css'
})
export class ItemSettingsComponent implements OnInit {
  api = inject(ApiService);
  auth = inject(AuthService);
  messageService = inject(MessageService);
  settingsService = inject(MerchantSettingsService);
  router = inject(Router);

  products = signal<any[]>([]);
  loading = signal(false);
  saving = signal(false);

  // Search & Selection
  search = '';
  selectedProducts = signal<any[]>([]);

  ngOnInit() {
    // Access Control: Redirect if not topSellingEnabled or if they are masterbrand admin
    if (!this.settingsService.settings().topSellingEnabled) {
      this.router.navigate(['/']);
      return;
    }
    this.loadProducts();
  }

  loadProducts() {
    this.loading.set(true);
    this.api.get<any>('/products/inherited', { limit: 20, offset: 0 }).subscribe({
      next: (response) => {
        this.products.set(response.data.products || []);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.messageService.add({
          severity: 'error',
          summary: 'Load failed',
          detail: 'Failed to fetch items.'
        });
      }
    });
  }

  onSearch(event: any) {
    this.search = event.target.value;
  }

  getFilteredProducts() {
    const q = this.search.toLowerCase().trim();
    if (!q) return this.products();
    return this.products().filter(p => 
      p.effective_name?.toLowerCase().includes(q) || 
      p.effective_short_description?.toLowerCase().includes(q) ||
      p.category_name?.toLowerCase().includes(q)
    );
  }

  toggleTopSellingStatus(status: boolean) {
    const selected = this.selectedProducts();
    if (selected.length === 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'No Selection',
        detail: 'Please select at least one item.'
      });
      return;
    }

    this.saving.set(true);
    const catalogueIds = selected.map(p => p.catalogue_id);

    this.api.post('/products/top-selling', {
      catalogueIds,
      isTopSelling: status
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.selectedProducts.set([]);
        this.messageService.add({
          severity: 'success',
          summary: 'Status Updated',
          detail: `Successfully ${status ? 'added to' : 'removed from'} Top Selling Products.`
        });
        this.loadProducts();
      },
      error: () => {
        this.saving.set(false);
        this.messageService.add({
          severity: 'error',
          summary: 'Update Failed',
          detail: 'Failed to update top-selling status.'
        });
      }
    });
  }
}

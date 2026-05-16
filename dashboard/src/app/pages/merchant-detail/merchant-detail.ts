import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { FormsModule } from '@angular/forms';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { ApiService } from '../../services/api';
import { ProductsComponent } from '../products/products';

@Component({
  selector: 'app-merchant-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, ButtonModule, CardModule, InputTextModule, FormsModule, ProductsComponent, ToggleSwitchModule],
  templateUrl: './merchant-detail.html',
  styleUrl: './merchant-detail.css'
})
export class MerchantDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private api = inject(ApiService);
  
  merchantId = signal<number | null>(null);
  merchant = signal<any | null>(null);
  activeTab = signal('merchant');

  tabs = [
    { label: 'Catalogue', id: 'catalogue' },
    { label: 'Merchant Profile', id: 'merchant' }
  ];

  form: any = {};

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.merchantId.set(Number(id));
      this.loadMerchant();
    }
  }

  loadMerchant() {
    this.api.get<any>(`/merchants/profile/${this.merchantId()}`).subscribe({
      next: (res) => {
        this.merchant.set(res.data.merchant);
        this.form = { ...res.data.merchant };
      }
    });
  }

  setTab(id: string) {
    this.activeTab.set(id);
  }

  saveMerchant() {
    // Save logic
  }
}

import { Component, computed, inject, OnInit, signal, effect } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ChipModule } from 'primeng/chip';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { ChartModule } from 'primeng/chart';
import { MessageService } from 'primeng/api';
import { ApiService } from '../../services/api';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-dashboard-home',
  standalone: true,
  imports: [
    CommonModule, 
    DatePipe, 
    ButtonModule, 
    CardModule, 
    ChipModule, 
    ProgressSpinnerModule, 
    TableModule, 
    TagModule,
    TooltipModule,
    ChartModule,
    RouterModule
  ],
  templateUrl: './dashboard-home.html',
  styleUrl: './dashboard-home.css'
})
export class DashboardHomeComponent implements OnInit {
  api = inject(ApiService);
  auth = inject(AuthService);
  messageService = inject(MessageService);

  loading = signal(true);
  overview = signal<any | null>(null);
  today = new Date();

  // Rainbow colors for table rows using CSS variables
  rainbowColors = [
    'var(--rb-odd)', 
    'var(--rb-even)'
  ];

  chartData = signal<any>(null);
  chartOptions = {
    maintainAspectRatio: false,
    aspectRatio: 0.8,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        backgroundColor: 'rgba(0,0,0,0.8)',
        titleFont: { size: 14, weight: 'bold' },
        bodyFont: { size: 13 },
        padding: 12,
        cornerRadius: 8,
        displayColors: false
      }
    },
    scales: {
      x: {
        ticks: {
          color: 'var(--text-muted)',
          font: { weight: '600' }
        },
        grid: {
          display: false,
          drawBorder: false
        }
      },
      y: {
        ticks: {
          color: 'var(--text-muted)',
          callback: (value: any) => '₹' + value
        },
        grid: {
          color: 'var(--border)',
          drawBorder: false
        }
      }
    }
  };

  statCards = computed(() => {
    const overview = this.overview();
    if (!overview) return [];

    const isAdmin = overview.mode === 'admin';
    
    if (isAdmin) {
      return [
        { 
          label: 'Active Merchants',
          value: overview.stats.activeMerchants, 
          accent: '#10b981',
          icon: 'pi pi-briefcase',
          bg: 'rgba(16, 185, 129, 0.1)'
        },
        { 
          label: 'Master Categories',
          value: overview.stats.totalCategories, 
          accent: '#3b82f6',
          icon: 'pi pi-th-large',
          bg: 'rgba(59, 130, 246, 0.1)'
        },
        { 
          label: 'Master Products',
          value: overview.stats.totalProducts, 
          accent: '#f59e0b',
          icon: 'pi pi-box',
          bg: 'rgba(245, 158, 11, 0.1)'
        },
        { 
          label: 'Delivered Revenue',
          value: this.fmtCurrency(overview.stats.deliveredRevenue), 
          accent: '#ef4444',
          icon: 'pi pi-chart-line',
          bg: 'rgba(239, 68, 68, 0.1)'
        }
      ];
    }

    return [
      { 
        label: 'Live Catalogue',
        value: overview.stats.liveCatalogue, 
        accent: '#10b981',
        icon: 'pi pi-list',
        bg: 'rgba(16, 185, 129, 0.1)'
      },
      { 
        label: 'Delinked Items',
        value: overview.stats.delinkedProducts, 
        accent: '#f59e0b',
        icon: 'pi pi-times-circle',
        bg: 'rgba(245, 158, 11, 0.1)'
      },
      { 
        label: 'Pending Orders',
        value: overview.stats.pendingOrders, 
        accent: '#3b82f6',
        icon: 'pi pi-clock',
        bg: 'rgba(59, 130, 246, 0.1)'
      },
      { 
        label: 'Delivered Revenue',
        value: this.fmtCurrency(overview.stats.deliveredRevenue), 
        accent: '#ef4444',
        icon: 'pi pi-chart-line',
        bg: 'rgba(239, 68, 68, 0.1)'
      }
    ];
  });

  constructor() {
    effect(() => {
      const ov = this.overview();
      if (ov && ov.analytics) {
        this.initChart(ov.analytics);
      }
    });
  }

  ngOnInit() {
    this.loadOverview();
  }

  loadOverview() {
    this.loading.set(true);
    this.api.get<any>('/merchants/overview').subscribe({
      next: (response) => {
        this.overview.set(response.data.overview);
        this.loading.set(false);
      },
      error: (error) => {
        this.loading.set(false);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to load dashboard overview.'
        });
      }
    });
  }

  initChart(analytics: any) {
    const documentStyle = getComputedStyle(document.documentElement);
    
    this.chartData.set({
      labels: analytics.labels.map((l: string) => {
        const d = new Date(l);
        return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
      }),
      datasets: [
        {
          label: 'Revenue',
          backgroundColor: '#facc15', // Use Yellow for bars to stand out in dark mode
          borderColor: '#facc15',
          data: analytics.data,
          borderRadius: 8,
          barThickness: 24,
          hoverBackgroundColor: '#eab308'
        }
      ]
    });
  }

  orderSeverity(status: string): 'success' | 'info' | 'warn' | 'danger' | undefined {
    switch (status?.toUpperCase()) {
      case 'DELIVERED':
      case 'COMPLETED':
        return 'success';
      case 'CANCELLED':
        return 'danger';
      case 'PLACED':
      case 'CONFIRMED':
      case 'PROCESSING':
        return 'warn';
      case 'PENDING':
        return 'info';
      default:
        return 'info';
    }
  }

  fmtDate(date: string) {
    try {
      return new Date(date).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return date;
    }
  }

  fmtCurrency(value: number) {
    return `₹${Number(value || 0).toLocaleString('en-IN')}`;
  }

  getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  }
}

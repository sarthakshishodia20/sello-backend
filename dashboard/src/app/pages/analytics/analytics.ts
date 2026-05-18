import { Component, OnInit, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api';
import { CardModule } from 'primeng/card';
import { SelectModule } from 'primeng/select';
import { SkeletonModule } from 'primeng/skeleton';
import { ChartModule } from 'primeng/chart';
import { TagModule } from 'primeng/tag';
import { LanguageService } from '../../services/language.service';

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    CardModule, 
    SelectModule, 
    SkeletonModule, 
    ChartModule,
    TagModule
  ],
  templateUrl: './analytics.html',
  styleUrl: './analytics.css'
})
export class AnalyticsComponent implements OnInit {
  private api = inject(ApiService);
  lang = inject(LanguageService);

  loading = signal(true);
  data = signal<any>({
    sales: 0, customers: 0, merchants_total: 0,
    orders: { cancelled: 0, pending: 0, dispatched: 0, completed: 0 },
    merchants: { active: 0, inactive: 0, open: 0, closed: 0 },
    chart: []
  });

  timeframeOptions = [
    { label: 'Weekly', value: 'weekly' },
    { label: 'Monthly', value: 'monthly' },
    { label: 'Yearly', value: 'yearly' }
  ];
  selectedTimeframe = 'monthly';

  chartData = signal<any>(null);
  chartOptions = {
    maintainAspectRatio: false,
    aspectRatio: 0.8,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1e293b',
        padding: 12,
        cornerRadius: 8
      }
    },
    scales: {
      x: {
        ticks: { color: '#64748b', font: { weight: '600' } },
        grid: { display: false }
      },
      y: {
        ticks: { color: '#64748b', callback: (val: any) => '₹' + val },
        grid: { color: '#f1f5f9' }
      }
    }
  };

  rainbowColors = ['#f1f5f9', '#eff6ff', '#f0fdf4', '#fff7ed', '#fdf2f8'];

  constructor() {
    effect(() => {
      const d = this.data();
      if (d.chart && d.chart.length > 0) {
        this.initChart(d.chart);
      }
    });
  }

  ngOnInit() {
    this.loadAnalytics();
  }

  loadAnalytics() {
    this.loading.set(true);
    this.api.get<any>('/orders/analytics', { timeframe: this.selectedTimeframe }).subscribe({
      next: (response) => {
        if (response.data && response.data.analytics) {
          this.data.set(response.data.analytics);
        }
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  initChart(chartPoints: any[]) {
    const isDark = document.body.classList.contains('dark-mode');
    
    // Update chart options for theme
    this.chartOptions.scales.x.ticks.color = isDark ? '#a1a1aa' : '#64748b';
    this.chartOptions.scales.y.ticks.color = isDark ? '#a1a1aa' : '#64748b';
    this.chartOptions.scales.y.grid.color = isDark ? '#27272a' : '#f1f5f9';

    this.chartData.set({
      labels: chartPoints.map(p => p.label),
      datasets: [
        {
          label: 'Revenue',
          backgroundColor: isDark ? '#ffffff' : '#000000',
          data: chartPoints.map(p => p.value),
          borderRadius: 6,
          barThickness: 30
        }
      ]
    });
  }


  fmtCurrency(val: number) {
    return `₹${Number(val || 0).toLocaleString('en-IN')}`;
  }
}

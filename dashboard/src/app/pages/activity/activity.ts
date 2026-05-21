import { Component, inject, signal, OnInit } from '@angular/core';
import { NgIf, NgFor, CommonModule } from '@angular/common';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { ApiService } from '../../services/api';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-activity',
  standalone: true,
  imports: [CommonModule, TableModule, TagModule, ButtonModule, DialogModule],
  templateUrl: './activity.html',
  styleUrl: './activity.css'
})
export class ActivityComponent implements OnInit {
  private api = inject(ApiService);
  public auth = inject(AuthService);

  activities = signal<any[]>([]);
  totalRecords = signal(0);
  loading = signal(false);
  rows = 10;

  // Details dialog
  detailsVisible = signal(false);
  selectedActivity = signal<any>(null);

  ngOnInit() {
    this.loadActivity({ first: 0, rows: this.rows });
  }

  loadActivity(event?: any) {
    this.loading.set(true);
    const first = event?.first || 0;
    const rows = event?.rows || this.rows;
    const page = (first / rows) + 1;
    const role = this.auth.isAdmin() ? 'admin' : 'merchant';
    
    this.api.get(`/activity/${role}?page=${page}&limit=${rows}`).subscribe({
      next: (res: any) => {
        this.activities.set(res.data?.data || []);
        this.totalRecords.set(res.data?.total || 0);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      }
    });
  }

  showDetails(activity: any) {
    this.selectedActivity.set(activity);
    this.detailsVisible.set(true);
    
    // Fetch request/response payload details securely on demand
    this.api.get(`/activity/detail/${activity.id}`).subscribe({
      next: (res: any) => {
        if (res && res.data) {
          this.selectedActivity.set(res.data);
        }
      },
      error: (err) => console.error('Failed to load activity details:', err)
    });
  }

  formatIP(ip: string): string {
    if (!ip) return 'N/A';
    // Clean up IPv6 mapped IPv4 addresses
    let cleanIp = ip.replace(/^::ffff:/, '');
    if (cleanIp === '::1' || cleanIp === '127.0.0.1') return 'Localhost';
    return cleanIp;
  }

  getSeverity(method: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    switch (method) {
      case 'POST': return 'success';
      case 'PUT': return 'warn';
      case 'DELETE': return 'danger';
      case 'GET': return 'info';
      default: return 'secondary';
    }
  }

  formatJson(data: any): string {
    if (!data) return 'No data';
    try {
      return JSON.stringify(data, null, 2);
    } catch (e) {
      return String(data);
    }
  }
}

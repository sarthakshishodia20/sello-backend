import { Routes } from '@angular/router';
import { authGuard } from './guards/auth-guard';
import { adminGuard } from './guards/admin-guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login').then((m) => m.LoginComponent)
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/layout/dashboard-shell/dashboard-shell').then(
        (m) => m.DashboardShellComponent
      ),
    children: [
      { path: '', redirectTo: 'overview', pathMatch: 'full' },
      {
        path: 'overview',
        loadComponent: () =>
          import('./pages/dashboard-home/dashboard-home').then((m) => m.DashboardHomeComponent)
      },
      {
        path: 'products',
        loadComponent: () => import('./pages/products/products').then((m) => m.ProductsComponent)
      },
      {
        path: 'analytics',
        loadComponent: () => import('./pages/analytics/analytics').then((m) => m.AnalyticsComponent)
      },
      {
        path: 'customers',
        loadComponent: () => import('./pages/customers/customers').then((m) => m.CustomersComponent)
      },
      {
        path: 'merchants',
        canActivate: [adminGuard],
        children: [
          {
            path: '',
            loadComponent: () => import('./pages/merchants/merchants').then((m) => m.MerchantsComponent)
          },
          {
            path: ':id',
            loadComponent: () => import('./pages/merchant-detail/merchant-detail').then((m) => m.MerchantDetailComponent)
          }
        ]
      },
      {
        path: 'orders',
        loadComponent: () => import('./pages/orders/orders').then((m) => m.OrdersComponent)
      },
      {
        path: 'activity',
        loadComponent: () => import('./pages/activity/activity').then((m) => m.ActivityComponent)
      },
      {
        path: 'settings',
        loadComponent: () => import('./pages/settings/settings').then((m) => m.SettingsComponent)
      },
      {
        path: 'profile',
        loadComponent: () => import('./pages/profile/profile').then((m) => m.ProfileComponent)
      }
    ]
  },
  { path: '**', redirectTo: '' }
];

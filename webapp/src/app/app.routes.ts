import { Routes, Router } from '@angular/router';

import { inject } from '@angular/core';
import { CustomerAuthService } from './services/customer-auth';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./pages/store-list/store-list').then(m => m.StoreListComponent) },
  { path: 'store/:slug', loadComponent: () => import('./pages/store/store').then(m => m.StoreComponent) },
  { path: 'login', loadComponent: () => import('./pages/login/login').then(m => m.CustomerLoginComponent) },
  { 
    path: 'checkout', 
    canActivate: [() => inject(CustomerAuthService).isLoggedIn() || inject(Router).createUrlTree(['/login'])],
    loadComponent: () => import('./pages/checkout/checkout').then(m => m.CheckoutComponent) 
  },
  { 
    path: 'payment', 
    canActivate: [() => inject(CustomerAuthService).isLoggedIn() || inject(Router).createUrlTree(['/login'])],
    loadComponent: () => import('./pages/payment/payment').then(m => m.PaymentComponent) 
  },

  { 
    path: 'orders', 
    canActivate: [() => inject(CustomerAuthService).isLoggedIn() || inject(Router).createUrlTree(['/login'])],
    loadComponent: () => import('./pages/my-orders/my-orders').then(m => m.MyOrdersComponent) 
  },
  { 
    path: 'wishlist', 
    loadComponent: () => import('./pages/wishlist/wishlist').then(m => m.WishlistComponent) 
  },

  { path: 'order-success', loadComponent: () => import('./pages/order-success/order-success').then(m => m.OrderSuccessComponent) },
  { path: '**', redirectTo: '' }
];

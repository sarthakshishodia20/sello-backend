import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private base = environment.apiBase;

  getStores(search = '', city = '', mode = 'ALL', limit = 12, offset = 0): Observable<any> {
    let url = `${this.base}/webapp/stores?search=${encodeURIComponent(search)}&limit=${limit}&offset=${offset}`;
    if (city) url += `&city=${encodeURIComponent(city)}`;
    if (mode !== 'ALL') url += `&mode=${encodeURIComponent(mode)}`;
    return this.http.get(url, { headers: { 'X-Skip-Loader': 'true' } });
  }

  getStore(slug: string): Observable<any> {
    return this.http.get(`${this.base}/webapp/stores/${slug}`);
  }

  getStoreProducts(slug: string, categoryId?: number | null, search = '', limit = 12, offset = 0): Observable<any> {
    let url = `${this.base}/webapp/stores/${slug}/products?limit=${limit}&offset=${offset}`;
    if (categoryId) url += `&category_id=${categoryId}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    return this.http.get(url);
  }

  placeOrder(payload: any): Observable<any> {
    return this.http.post(`${this.base}/orders/place`, payload);
  }

  get<T>(path: string, params: any = {}): Observable<T> {
    return this.http.get<T>(`${this.base}${path}`, { params });
  }

  post<T>(path: string, body: any): Observable<T> {
    return this.http.post<T>(`${this.base}${path}`, body);
  }

  put<T>(path: string, body: any): Observable<T> {
    return this.http.put<T>(`${this.base}${path}`, body);
  }

  getMyOrders(): Observable<any> {
    return this.get('/orders/customer/my-orders');
  }

  cancelOrder(id: number): Observable<any> {
    return this.put(`/orders/customer/${id}/cancel`, {});
  }

  getWishlistBulk(storeIds: number[], productIds: number[]): Observable<any> {
    return this.post('/webapp/wishlist/bulk', { storeIds, productIds });
  }

  toggleWishlist(type: 'STORE' | 'PRODUCT', itemId: number): Observable<any> {
    return this.post('/webapp/wishlist/toggle', { type, itemId });
  }

  getWishlist(): Observable<any> {
    return this.get('/webapp/wishlist');
  }

  getBillBreakdown(merchantId: number, items: { catalogue_id: number, quantity: number }[]): Observable<any> {
    return this.post('/orders/bill-breakdown', { merchant_id: merchantId, items });
  }
}




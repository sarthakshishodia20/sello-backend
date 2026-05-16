import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { LanguageService } from './language.service';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  langService = inject(LanguageService);
  private base = environment.apiBase;

  private get headers() {
    const token = localStorage.getItem('sello_token');
    return token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : new HttpHeaders();
  }

  get<T>(path: string, params?: Record<string, any>): Observable<T> {
    let httpParams = new HttpParams();
    if (params) Object.keys(params).forEach(k => { if (params[k] != null) httpParams = httpParams.set(k, params[k]); });
    return this.http.get<T>(`${this.base}${path}`, { headers: this.headers, params: httpParams });
  }

  post<T>(path: string, body: any, isFormData = false): Observable<T> {
    const headers = isFormData
      ? this.headers  // let browser set Content-Type with boundary for FormData
      : this.headers.set('Content-Type', 'application/json');
    return this.http.post<T>(`${this.base}${path}`, body, { headers });
  }

  put<T>(path: string, body: any, isFormData = false): Observable<T> {
    const headers = isFormData ? this.headers : this.headers.set('Content-Type', 'application/json');
    return this.http.put<T>(`${this.base}${path}`, body, { headers });
  }

  delete<T>(path: string, body?: any): Observable<T> {
    const options = {
      headers: this.headers,
      body: body
    };
    return this.http.delete<T>(`${this.base}${path}`, options);
  }
}

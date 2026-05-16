import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class SearchService {
  /** Global query signal for reactive filtering across components */
  query = signal<string>('');

  setQuery(val: string) {
    this.query.set(val);
  }

  clear() {
    this.query.set('');
  }
}

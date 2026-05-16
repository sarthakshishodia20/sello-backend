import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LocationService {
  currentCity = signal<string>(localStorage.getItem('sello_city') || 'Delhi');

  setCity(city: string) {
    this.currentCity.set(city);
    localStorage.setItem('sello_city', city);
  }
}

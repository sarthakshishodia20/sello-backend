import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LoaderService {
  private _count = 0;
  visible = signal(false);
  private _startTime = 0;
  private readonly MIN_DURATION = 1000; // Minimum 1 second duration

  show() {
    if (this._count === 0) {
      this._startTime = Date.now();
      this.visible.set(true);
    }
    this._count++;
  }

  hide() {
    this._count = Math.max(0, this._count - 1);
    
    if (this._count === 0) {
      const elapsed = Date.now() - this._startTime;
      const remaining = Math.max(0, this.MIN_DURATION - elapsed);
      
      // Ensure loader stays visible for at least MIN_DURATION
      setTimeout(() => {
        if (this._count === 0) {
          this.visible.set(false);
        }
      }, remaining);
    }
  }
}

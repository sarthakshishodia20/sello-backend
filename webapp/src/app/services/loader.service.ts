import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class LoaderService {
  visible = signal(false);

  show() {
    this.visible.set(true);
  }

  hide() {
    setTimeout(() => {
      this.visible.set(false);
    }, 800);
  }
}

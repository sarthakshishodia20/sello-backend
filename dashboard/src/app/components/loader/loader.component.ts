import { Component, inject, input } from '@angular/core';
import { NgIf } from '@angular/common';
import { LoaderService } from '../../services/loader';

@Component({
  selector: 'app-loader',
  standalone: true,
  imports: [NgIf],
  template: `
    <div 
      [class.global-loader-overlay]="!absolute()" 
      [class.absolute-loader-overlay]="absolute()" 
      *ngIf="loader.visible()"
    >
      <div class="loader-container">
        <!-- Circular Spinner -->
        <div class="circular-spinner">
          <div class="spinner-track"></div>
          <div class="spinner-head"></div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .global-loader-overlay, .absolute-loader-overlay {
      position: fixed;
      inset: 0;
      z-index: 999999;
      background: transparent;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    :host-context(body.dark-mode) .global-loader-overlay {
      background: rgba(0,0,0,0.7);
    }

    .absolute-loader-overlay {
      position: absolute;
    }

    .loader-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 1.5rem;
      background: rgba(255, 255, 255, 0.8);
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.1);
      backdrop-filter: blur(8px); /* Minimal blur only on the small box */
    }

    :host-context(body.dark-mode) .loader-container {
      background: var(--accent-yellow);
      box-shadow: 0 10px 40px rgba(0,0,0,0.8);
      border: none;
    }

    :host-context(body.dark-mode) .circular-spinner {
      border-top-color: #000;
      border-left-color: #000;
      border-bottom-color: rgba(0,0,0,0.1);
      border-right-color: rgba(0,0,0,0.1);
    }

    .circular-spinner {
      position: relative;
      width: 48px;
      height: 48px;
    }

    .spinner-track {
      position: absolute;
      inset: 0;
      border: 4px solid #f1f5f9;
      border-radius: 50%;
    }

    :host-context(body.dark-mode) .spinner-track {
      border-color: rgba(0,0,0,0.1);
    }

    .spinner-head {
      position: absolute;
      inset: 0;
      border: 4px solid transparent;
      border-top-color: #000;
      border-radius: 50%;
      animation: spin 0.8s cubic-bezier(0.4, 0, 0.2, 1) infinite;
    }



    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `]
})
export class LoaderComponent {
  loader = inject(LoaderService);
  absolute = input<boolean>(false);
}

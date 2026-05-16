import { Component, inject } from '@angular/core';
import { NgIf } from '@angular/common';
import { LoaderService } from '../../services/loader.service';

@Component({
  selector: 'app-loader',
  standalone: true,
  imports: [NgIf],
  template: `
    <div class="premium-loader-overlay" *ngIf="loader.visible()">
      <div class="loader-box">
        <div class="loader-visual">
          <div class="spinner-ring"></div>
          <div class="logo-text">S<span>.</span></div>
        </div>
      </div>
    </div>

  `,
  styles: [`
    .premium-loader-overlay {
      position: fixed;
      inset: 0;
      z-index: 100000;
      background: transparent;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
    }

    .loader-box {
      background: rgba(0, 0, 0, 0.8);
      padding: 2.5rem;
      border-radius: 30px;
      box-shadow: 0 25px 60px rgba(0,0,0,0.5);
      border: 1px solid rgba(255,255,255,0.1);
      backdrop-filter: blur(20px);
    }

    .loader-visual {
      position: relative;
      width: 80px;
      height: 80px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .spinner-ring {
      position: absolute;
      inset: 0;
      border: 3px solid rgba(255, 255, 255, 0.05);
      border-top: 3px solid var(--primary);
      border-radius: 50%;
      animation: spin 0.8s cubic-bezier(0.4, 0, 0.2, 1) infinite;
    }

    .logo-text {
      font-size: 2.2rem;
      font-weight: 900;
      color: #fff;
      font-family: 'Manrope', sans-serif;
    }

    .logo-text span {
      color: var(--primary);
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

  `]
})
export class LoaderComponent {
  loader = inject(LoaderService);
}

import { Component, inject, signal, AfterViewInit } from '@angular/core';
import { NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DividerModule } from 'primeng/divider';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { AuthService } from '../../services/auth';
import { ApiService } from '../../services/api';
import { gsap } from 'gsap';

import { SelectModule } from 'primeng/select';
import { PasswordModule } from 'primeng/password';
import { FloatLabelModule } from 'primeng/floatlabel';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    NgIf, 
    FormsModule,  
    ButtonModule, 
    CardModule, 
    DividerModule, 
    InputTextModule, 
    MessageModule,
    SelectModule,
    PasswordModule,
    FloatLabelModule
  ],
  templateUrl: './login.html',
  styleUrl: './login.css'
})

export class LoginComponent implements AfterViewInit {
  auth = inject(AuthService);
  api = inject(ApiService);
  router = inject(Router);

  mode = signal<'merchant' | 'admin'>('admin');
  tab = signal<'login' | 'signup'>('login');
  loading = signal(false);
  error = signal('');
  success = signal('');

  email = '';
  password = '';
  showPassword = false;
  
  // Signup fields
  owner_name = '';
  merchant_name = '';
  masterbrand_name = '';
  phone = '';
  address = '';
  masterbrand_id: number | null = null;
  masterbrands = signal<any[]>([]);

  // Loader icons (Grocery theme)
  loaderIcons = [
    { icon: 'pi-apple', color: '#ff4d4d' },
    { icon: 'pi-shopping-cart', color: '#2ecc71' },
    { icon: 'pi-truck', color: '#3498db' },
    { icon: 'pi-shopping-bag', color: '#f1c40f' },
    { icon: 'pi-box', color: '#e67e22' }
  ];
  currentIconIndex = signal(0);
  
  isFormValid() {
    if (this.tab() === 'login') {
      return this.email && this.password && this.password.length >= 6;
    }
    
    // Common signup fields
    if (!this.owner_name || !this.email || !this.password || this.password.length < 6) return false;
    
    if (this.mode() === 'admin') {
      return !!this.masterbrand_name;
    } else {
      return !!this.merchant_name && !!this.masterbrand_id;
    }
  }

  ngAfterViewInit() {
    this.animateEntrance();
  }

  animateEntrance() {
    const tl = gsap.timeline();
    
    tl.from('.visual-panel', {
      duration: 1.2,
      xPercent: -100,
      ease: 'power4.inOut'
    })
    .from('.auth-panel', {
      duration: 1.2,
      xPercent: 100,
      ease: 'power4.inOut'
    }, '<')
    .from('.content-box > *', {
      duration: 0.8,
      y: 30,
      opacity: 0,
      stagger: 0.2,
      ease: 'power3.out'
    }, '-=0.4')
    .from('.glass-card', {
      duration: 0.8,
      scale: 0.9,
      opacity: 0,
      ease: 'back.out(1.7)'
    }, '-=0.6')
    .from('.floating-scene div', {
      duration: 1.5,
      scale: 0,
      opacity: 0,
      stagger: 0.3,
      ease: 'elastic.out(1, 0.3)'
    }, '-=1');
  }

  setMode(mode: 'merchant' | 'admin') {
    this.mode.set(mode);
    this.tab.set('login');
    this.clearMessages();
    
    // Animate tab switch
    gsap.from('.auth-form', {
      duration: 0.4,
      y: 10,
      opacity: 0,
      ease: 'power2.out'
    });
  }

  setTab(tab: 'login' | 'signup') {
    this.tab.set(tab);
    this.clearMessages();
    this.owner_name = '';
    this.merchant_name = '';
    this.masterbrand_name = '';
    
    if (this.tab() === 'signup' && this.mode() === 'merchant') {
      this.loadMasterbrands();
    }
    
    gsap.from('.stagger-form > *', {
      duration: 0.4,
      y: 20,
      opacity: 0,
      stagger: 0.05,
      ease: 'power2.out'
    });
  }

  clearMessages() {
    this.error.set('');
    this.success.set('');
  }

  loadMasterbrands() {
    this.api.get<any>('/auth/masterbrands').subscribe({
      next: (res) => {
        this.masterbrands.set(res.data.masterbrands || []);
        if (this.masterbrands().length > 0 && !this.masterbrand_id) {
          this.masterbrand_id = this.masterbrands()[0].id;
        }
      }
    });
  }

  startLoaderAnimation() {
    const interval = setInterval(() => {
      if (!this.loading()) {
        clearInterval(interval);
        return;
      }
      this.currentIconIndex.update(idx => (idx + 1) % this.loaderIcons.length);
      
      gsap.fromTo('.icon-stack i', 
        { scale: 0.4, opacity: 0, rotate: -30 },
        { scale: 1, opacity: 1, rotate: 0, duration: 0.3, ease: 'back.out(2)' }
      );
    }, 450);
  }

  submit() {
    if (!this.isFormValid()) {
      this.error.set('Please fill all required fields correctly (Password min 6 chars)');
      return;
    }

    this.loading.set(true);
    this.clearMessages();
    this.startLoaderAnimation();

    if (this.tab() === 'login') {
      const request =
        this.mode() === 'admin'
          ? this.auth.adminLogin(this.email, this.password)
          : this.auth.merchantLogin(this.email, this.password);

      request.subscribe({
        next: () => {
          setTimeout(() => {
            this.loading.set(false);
            this.router.navigate(['/overview']);
          }, 2000); // Extra time for loader show-off
        },
        error: (error) => {
          this.loading.set(false);
          this.error.set(error.error?.message || 'Login failed');
        }
      });
      return;
    }

    // Signup flow
    const signupRequest =
      this.mode() === 'admin'
        ? this.auth.adminSignup({
            name: this.owner_name,
            email: this.email,
            password: this.password,
            phone: this.phone,
            masterbrand_name: this.masterbrand_name
          })
        : this.auth.merchantSignup({
            owner_name: this.owner_name,
            merchant_name: this.merchant_name,
            email: this.email,
            password: this.password,
            phone: this.phone,
            address: this.address,
            masterbrand_id: this.masterbrand_id
          });

    signupRequest.subscribe({
      next: () => {
        setTimeout(() => {
          this.loading.set(false);
          this.router.navigate(['/overview']);
        }, 2000);
      },
      error: (error) => {
        this.loading.set(false);
        this.error.set(error.error?.message || 'Signup failed');
      }
    });
  }
}

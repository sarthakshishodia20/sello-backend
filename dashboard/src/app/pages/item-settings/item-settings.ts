import { Component, inject, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api';
import { AuthService } from '../../services/auth';
import { MessageService } from 'primeng/api';
import { MerchantSettingsService } from '../../services/merchant-settings';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TooltipModule } from 'primeng/tooltip';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

@Component({
  selector: 'app-item-settings',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    TagModule,
    ButtonModule,
    InputTextModule,
    TooltipModule
  ],
  templateUrl: './item-settings.html',
  styleUrl: './item-settings.css'
})
export class ItemSettingsComponent implements OnInit, OnDestroy {
  api = inject(ApiService);
  auth = inject(AuthService);
  messageService = inject(MessageService);
  settingsService = inject(MerchantSettingsService);
  router = inject(Router);

  products = signal<any[]>([]);
  loading = signal(false);
  saving = signal(false);

  // Search & Suggestions
  search = '';
  selectedProducts = signal<any[]>([]);
  searchSubject = new Subject<string>();
  suggestionSubject = new Subject<string>();
  suggestions = signal<string[]>([]);
  showSuggestions = signal(false);

  // Voice Search
  recognition: any;
  isListening = signal(false);
  voiceInterimText = signal('');

  hasVoiceAiAccess = computed(() => {
    if (this.auth.isAdmin()) return true;
    return this.settingsService.settings().voiceAiEnabled === true;
  });

  private clickListener = () => {
    this.showSuggestions.set(false);
  };

  ngOnInit() {
    // Access Control: Redirect if not topSellingEnabled
    if (!this.settingsService.settings().topSellingEnabled) {
      this.router.navigate(['/']);
      return;
    }

    this.loadProducts();
    this.initVoiceSearch();

    // Document click to close suggestions
    document.addEventListener('click', this.clickListener);

    // Main search debounce
    this.searchSubject.pipe(
      debounceTime(400),
      distinctUntilChanged()
    ).subscribe(value => {
      this.search = value;
      this.loadProducts();
    });

    // Suggestions debounce
    this.suggestionSubject.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(value => {
      if (!value || value.length < 2) {
        this.suggestions.set([]);
        this.showSuggestions.set(false);
        return;
      }
      this.fetchSuggestions(value);
    });
  }

  ngOnDestroy() {
    document.removeEventListener('click', this.clickListener);
    this.searchSubject.complete();
    this.suggestionSubject.complete();
    if (this.recognition) {
      this.recognition.abort();
    }
  }

  loadProducts() {
    this.loading.set(true);
    const params: any = { limit: 20, offset: 0 };
    if (this.search) {
      params.search = this.search;
    }

    this.api.get<any>('/products/inherited', params).subscribe({
      next: (response) => {
        this.products.set(response.data.products || []);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.messageService.add({
          severity: 'error',
          summary: 'Load failed',
          detail: 'Failed to fetch items.'
        });
      }
    });
  }

  onSearch(event: any) {
    const val = event.target?.value || '';
    this.search = val;
    this.searchSubject.next(val);
    this.suggestionSubject.next(val);
  }

  fetchSuggestions(query: string) {
    this.api.get<any>('/products/suggestions', { search: query }).subscribe({
      next: (response) => {
        const names = response.data.suggestions || [];
        this.suggestions.set(names);
        this.showSuggestions.set(names.length > 0);
      },
      error: () => this.suggestions.set([])
    });
  }

  selectSuggestion(val: string) {
    this.search = val;
    this.showSuggestions.set(false);
    this.searchSubject.next(val);
  }

  /** Browser Web Speech API for voice search */
  initVoiceSearch() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    this.recognition = new SpeechRecognition();
    this.recognition.lang = 'en-IN';
    this.recognition.continuous = false;
    this.recognition.interimResults = true;

    this.recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      const text = finalTranscript || interimTranscript;
      this.voiceInterimText.set(text);

      if (finalTranscript) {
        this.search = finalTranscript;
        this.isListening.set(false);
        this.searchSubject.next(finalTranscript);
      }
    };

    this.recognition.onerror = () => {
      this.isListening.set(false);
      this.messageService.add({ severity: 'warn', summary: 'Voice Error', detail: 'Could not recognise speech. Try again.' });
    };

    this.recognition.onend = () => {
      this.isListening.set(false);
    };
  }

  startVoiceSearch() {
    if (!this.recognition) {
      this.messageService.add({ severity: 'warn', summary: 'Not Supported', detail: 'Voice search is not supported in this browser. Use Chrome or Edge.' });
      return;
    }
    if (this.isListening()) {
      this.recognition.stop();
      this.isListening.set(false);
      return;
    }
    this.voiceInterimText.set('');
    this.isListening.set(true);
    this.recognition.start();
  }

  toggleTopSellingStatus(status: boolean) {
    const selected = this.selectedProducts();
    if (selected.length === 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'No Selection',
        detail: 'Please select at least one item.'
      });
      return;
    }

    this.saving.set(true);
    const catalogueIds = selected.map(p => p.catalogue_id);

    this.api.post('/products/top-selling', {
      catalogueIds,
      isTopSelling: status
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.selectedProducts.set([]);
        this.messageService.add({
          severity: 'success',
          summary: 'Status Updated',
          detail: `Successfully ${status ? 'added to' : 'removed from'} Top Selling Products.`
        });
        this.loadProducts();
      },
      error: () => {
        this.saving.set(false);
        this.messageService.add({
          severity: 'error',
          summary: 'Update Failed',
          detail: 'Failed to update top-selling status.'
        });
      }
    });
  }
}

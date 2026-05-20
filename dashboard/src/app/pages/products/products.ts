import { Component, computed, inject, OnInit, signal, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ChipModule } from 'primeng/chip';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { MessageService } from 'primeng/api';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { DrawerModule } from 'primeng/drawer';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { SelectModule } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';
import { PaginatorModule } from 'primeng/paginator';
import { DatePickerModule } from 'primeng/datepicker';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { ApiService } from '../../services/api';
import { AuthService } from '../../services/auth';
import { DragDropModule, moveItemInArray, CdkDragDrop } from '@angular/cdk/drag-drop';
import { MerchantSettingsService } from '../../services/merchant-settings';
import { TooltipModule } from 'primeng/tooltip';

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    TooltipModule,
    CardModule,
    ChipModule,
    DialogModule,
    InputTextModule,
    InputNumberModule,
    TableModule,
    TagModule,
    DrawerModule,
    ToggleSwitchModule,
    SelectModule,
    TextareaModule,
    PaginatorModule,
    DragDropModule,
    DatePickerModule,
    ProgressSpinnerModule
  ],
  templateUrl: './products.html',
  styleUrl: './products.css'
})
export class ProductsComponent implements OnInit {
  api = inject(ApiService);
  auth = inject(AuthService);
  messageService = inject(MessageService);
  settingsService = inject(MerchantSettingsService);
  langService = this.api.langService;

  categories = signal<any[]>([]);
  loading = signal(false);
  saving = signal(false);

  // Pagination & Search
  products = signal<any[]>([]);
  totalRecords = signal(0);
  limit = 10;
  offset = 0;
  search = '';
  searchSubject = new Subject<string>();
  suggestionSubject = new Subject<string>();
  suggestions = signal<string[]>([]);
  showSuggestions = signal(false);
  searchInputValue = signal('');

  // Voice Search
  isListening = signal(false);
  private recognition: any = null;

  // Infinite Scroll
  loadingMore = signal(false);
  hasMore = signal(true);

  // Status Filter
  statusFilter = signal<string>('all');
  filterOptions = [
    { label: 'All Products', value: 'all' },
    { label: 'Enabled Only', value: 'enabled' },
    { label: 'Disabled Only', value: 'disabled' }
  ];
  // AI & Dialog states
  aiLoading = signal(false);
  catAiLoading = signal(false);
  aiImageLoading = signal(false);
  imageUploading = signal(false);
  showRawUrlInput = signal(false);
  dialogVisible = signal(false);
  catDialogVisible = signal(false);
  catSaving = signal(false);
  lightboxVisible = signal(false);
  lightboxImage = signal<string | null>(null);

  // Custom Confirmation Dialog
  confirmVisible = signal(false);
  confirmMessage = signal('');
  confirmTarget = signal<any>(null);
  confirmType = signal<'product' | 'category'>('product');

  // Category context menu
  catMenuVisible = signal(false);
  catMenuTarget = signal<any | null>(null);
  catMenuPos = signal({ x: 0, y: 0 });
  catToggleSaving = signal(false);

  // Product context menu
  prodMenuVisible = signal(false);
  prodMenuTarget = signal<any | null>(null);
  prodMenuPos = signal({ x: 0, y: 0 });

  selectedCategoryId = signal<number | null>(null);
  selectedProduct = signal<any | null>(null);
  merchantEditContext = signal<any | null>(null);

  form: any = {};
  catForm: any = { id: null, name: '', description: '', ai_description: '', parent_id: null };

  viewMode = computed(() => (this.auth.isAdmin() ? 'master' : 'merchant'));

  voiceInterimText = signal('');

  // Snooze Module States
  snoozeModalVisible = signal(false);
  snoozeConfirmVisible = signal(false);
  snoozeTab = signal<'snooze' | 'unsnooze'>('snooze');
  snoozeMode = signal<'products' | 'category'>('products');
  snoozeSearchQuery = '';
  snoozeSearchSubject = new Subject<string>();
  snoozeAllItems = signal<any[]>([]);
  snoozeFilteredItems = signal<any[]>([]);
  snoozeSelectedItems = new Set<number>();
  snoozeUntilDate = '';
  snoozeUntilTime = '';

  // Snooze Step 1 prompt
  snoozePromptVisible = signal(false);
  promptTab = signal<'snooze' | 'unsnooze'>('snooze');
  promptSnoozeDate: Date | null = null;
  promptSnoozeTime: Date | null = null;
  todayDate: Date = new Date();

  // Snooze Pagination
  snoozeOffset = 0;
  snoozeLimit = 10;
  snoozeTotalRecords = signal(0);


  hasVoiceAiAccess = computed(() => {
    if (this.auth.isAdmin()) return true;
    return this.settingsService.settings().voiceAiEnabled === true;
  });

  /** Merchant and admin can manage inventory/enable-disable. */
  canManage = computed(() => this.auth.isAdmin() || this.auth.isMerchant());

  selectedCategoryName = computed(() => {
    const id = this.selectedCategoryId();
    if (!id) return 'Product Catalogue';
    return this.categories().find(c => c.id === id)?.name || 'Collection';
  });

  ngOnInit() {
    this.loadCategories();
    this.loadProducts();

    // Main search with 400ms debounce
    this.searchSubject.pipe(
      debounceTime(400),
      distinctUntilChanged()
    ).subscribe(value => {
      this.search = value;
      this.offset = 0;
      this.hasMore.set(true);
      this.loadProducts();
    });

    // Suggestion fetch with 300ms debounce (faster)
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

    // Close suggestions on outside click
    document.addEventListener('click', () => {
      this.catMenuVisible.set(false);
      this.prodMenuVisible.set(false);
      this.catMenuTarget.set(null);
      this.prodMenuTarget.set(null);
      this.showSuggestions.set(false);
    });

    // Init voice recognition if available
    this.initVoiceSearch();
  }

  selectCategory(id: number | null) {
    this.selectedCategoryId.set(id);
    this.selectedProduct.set(null);
    this.offset = 0;
    this.hasMore.set(true);
    this.loadProducts();
  }

  openCatCreate() {
    if (!this.auth.isAdmin()) {
      this.messageService.add({ severity: 'warn', summary: 'Admin only', detail: 'Only masterbrand admins can create root categories.' });
      return;
    }
    this.catForm = { id: null, name: '', description: '', ai_description: '', parent_id: null };
    this.catDialogVisible.set(true);
  }

  openCatEdit(cat: any) {
    if (!this.auth.isAdmin()) return;
    this.catForm = { id: cat.id, name: cat.name, description: cat.description || '', ai_description: cat.ai_description || '', parent_id: cat.parent_id };
    this.catDialogVisible.set(true);
    this.catMenuVisible.set(false);
  }

  saveCategory() {
    if (!this.catForm.name) return;
    this.catSaving.set(true);
    
    // Use AI description as description if provided
    const payload = { ...this.catForm };
    if (payload.ai_description) payload.description = payload.ai_description;

    const request = this.catForm.id 
      ? this.api.put(`/catalog/categories/${this.catForm.id}`, payload)
      : this.api.post('/catalog/categories', payload);

    request.subscribe({
      next: () => {
        this.catSaving.set(false);
        this.catDialogVisible.set(false);
        this.messageService.add({ severity: 'success', summary: 'Category saved', detail: 'Changes applied successfully.' });
        this.loadCategories();
      },
      error: () => this.catSaving.set(false)
    });
  }

  /** Generate AI description for category */
  generateCatAiDescription() {
    if (!this.catForm.name) {
      this.messageService.add({ severity: 'warn', summary: 'Name required', detail: 'Please enter a category name first.' });
      return;
    }
    this.catAiLoading.set(true);
    this.api.post<any>('/catalog/categories/generate-description', { category_name: this.catForm.name }).subscribe({
      next: (response) => {
        this.catForm.ai_description = response.data.description;
        this.catForm.description = response.data.description;
        this.catAiLoading.set(false);
      },
      error: () => this.catAiLoading.set(false)
    });
  }

  /** Open the 3-dot context menu for a category */
  openCatMenu(event: MouseEvent, cat: any) {
    event.stopPropagation();
    this.catMenuTarget.set(cat);
    this.catMenuPos.set({ x: event.clientX, y: event.clientY });
    this.catMenuVisible.set(true);
    this.prodMenuVisible.set(false);
  }

  /** Open the 3-dot context menu for a product */
  openProdMenu(event: MouseEvent, product: any) {
    event.stopPropagation();
    this.prodMenuTarget.set(product);
    this.prodMenuPos.set({ x: event.clientX - 160, y: event.clientY }); // Offset slightly left for UI
    this.prodMenuVisible.set(true);
    this.catMenuVisible.set(false);
  }

  toggleCatMenu(event: MouseEvent, cat: any) {
    event.stopPropagation();
    if (this.catMenuTarget()?.id === cat.id) {
      this.catMenuTarget.set(null);
    } else {
      this.catMenuTarget.set(cat);
      this.prodMenuTarget.set(null);
    }
  }

  toggleProdMenu(event: MouseEvent, prod: any) {
    event.stopPropagation();
    if (this.prodMenuTarget()?.id === prod.id) {
      this.prodMenuTarget.set(null);
    } else {
      this.prodMenuTarget.set(prod);
      this.catMenuTarget.set(null);
    }
  }

  /** Toggle category active/inactive (admin only) */
  toggleCategoryStatus(cat: any) {
    if (!this.auth.isAdmin()) {
      this.messageService.add({ severity: 'warn', summary: 'Admin only', detail: 'Only admins can enable/disable categories.' });
      return;
    }
    this.catToggleSaving.set(true);
    const newState = !Boolean(cat.is_active);
    this.api.put(`/catalog/categories/${cat.id}`, { is_active: newState }).subscribe({
      next: () => {
        this.catToggleSaving.set(false);
        this.catMenuTarget.set(null);
        this.messageService.add({
          severity: 'success',
          summary: 'Category updated',
          detail: `${cat.name} ${newState ? 'enabled' : 'disabled'}.`
        });
        this.loadCategories();
      },
      error: () => {
        this.catToggleSaving.set(false);
        this.messageService.add({ severity: 'error', summary: 'Failed', detail: 'Could not update category status.' });
      }
    });
  }

  selectProduct(product: any) {
    this.selectedProduct.set(product);
  }

  loadCategories() {
    this.api.get<any>('/catalog/categories', { include_inactive: true }).subscribe({
      next: (response) => this.categories.set(response.data.categories || [])
    });
  }

  loadProducts() {
    this.loading.set(true);
    this.offset = 0;
    const params: any = {
      limit: this.limit,
      offset: 0
    };
    const catId = this.selectedCategoryId();
    if (catId) params.category_id = catId;
    if (this.search) params.search = this.search;
    const sf = this.statusFilter();
    if (sf !== 'all') params.status_filter = sf;

    const endpoint = this.viewMode() === 'master' ? '/products/master' : '/products/inherited';

    this.api.get<any>(endpoint, params).subscribe({
      next: (response) => {
        const fetched = response.data.products || [];
        const total = response.data.total || 0;
        this.products.set(fetched);
        this.totalRecords.set(total);
        this.hasMore.set(fetched.length < total);
        this.offset = fetched.length;
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.messageService.add({
          severity: 'error',
          summary: 'Load failed',
          detail: 'Failed to fetch products.'
        });
      }
    });
  }

  /** Load next batch and append to existing list */
  loadMore() {
    if (this.loadingMore() || !this.hasMore()) return;
    this.loadingMore.set(true);

    const params: any = {
      limit: this.limit,
      offset: this.offset
    };
    const catId = this.selectedCategoryId();
    if (catId) params.category_id = catId;
    if (this.search) params.search = this.search;
    const sf = this.statusFilter();
    if (sf !== 'all') params.status_filter = sf;

    const endpoint = this.viewMode() === 'master' ? '/products/master' : '/products/inherited';

    this.api.get<any>(endpoint, params).subscribe({
      next: (response) => {
        const fetched = response.data.products || [];
        const total = response.data.total || 0;
        this.products.set([...this.products(), ...fetched]);
        this.totalRecords.set(total);
        this.offset += fetched.length;
        this.hasMore.set(this.products().length < total);
        this.loadingMore.set(false);
      },
      error: () => {
        this.loadingMore.set(false);
      }
    });
  }

  /** Infinite scroll handler — fires when product list is scrolled */
  onListScroll(event: Event) {
    const el = event.target as HTMLElement;
    const threshold = 60; // px from bottom
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    if (atBottom) {
      this.loadMore();
    }
  }

  onFilterChange(value: string) {
    this.statusFilter.set(value);
    this.offset = 0;
    this.hasMore.set(true);
    this.loadProducts();
  }

  onSearch(event: any) {
    const val = (event.target as HTMLInputElement).value;
    this.searchInputValue.set(val);
    this.searchSubject.next(val);
    this.suggestionSubject.next(val);
    this.showSuggestions.set(true);
  }

  onSearchInputClick(event: Event) {
    event.stopPropagation();
    if (this.searchInputValue().length >= 2) {
      this.showSuggestions.set(true);
    }
  }

  selectSuggestion(name: string) {
    this.searchInputValue.set(name);
    this.search = name;
    this.showSuggestions.set(false);
    this.suggestions.set([]);
    this.offset = 0;
    this.hasMore.set(true);
    this.loadProducts();
  }

  /** Fetch product name suggestions from backend */
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

  /** Init browser Web Speech API for voice search */
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
        this.searchInputValue.set(finalTranscript);
        this.search = finalTranscript;
        this.isListening.set(false);
        this.offset = 0;
        this.hasMore.set(true);
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

  /** Convert base64 data URL to Blob for upload */
  private base64ToBlob(dataUrl: string): Blob {
    const arr = dataUrl.split(',');
    const mime = arr[0].match(/:(.*?);/)![1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) u8arr[n] = bstr.charCodeAt(n);
    return new Blob([u8arr], { type: mime });
  }

  /** Upload base64 image before saving, returns a promise of the upload URL */
  private async uploadBase64Image(dataUrl: string): Promise<string> {
    const blob = this.base64ToBlob(dataUrl);
    const ext = blob.type.split('/')[1] || 'jpg';
    const file = new File([blob], `image.${ext}`, { type: blob.type });
    const formData = new FormData();
    formData.append('image', file);

    return new Promise<string>((resolve, reject) => {
      this.api.post<any>('/products/upload', formData, true).subscribe({
        next: (res) => resolve(res.data.imageUrl),
        error: (err) => reject(err)
      });
    });
  }

  openMasterCreate() {
    this.merchantEditContext.set(null);
    this.form = {
      category_id: this.selectedCategoryId() || null,
      sku: '',
      name: '',
      short_description: '',
      description: '',
      ai_description: '',
      image_url: '',
      price: 0,
      stock_qty: -1,
      inventory_enabled: false,
      sort_order: 0,
      is_active: true
    };
    this.dialogVisible.set(true);
  }

  openMasterEdit(product: any) {
    this.merchantEditContext.set(null);
    this.form = {
      id: product.id,
      category_id: product.category_id,
      sku: product.sku,
      name: product.name,
      short_description: product.short_description || '',
      description: product.description || '',
      ai_description: product.ai_description || '',
      image_url: product.image_url || '',
      price: product.price,
      stock_qty: product.stock_qty ?? -1,
      inventory_enabled: (product.stock_qty !== null && product.stock_qty !== -1),
      sort_order: product.sort_order,
      is_active: Boolean(product.is_active)
    };
    this.dialogVisible.set(true);
    this.prodMenuVisible.set(false);
  }

  openMerchantCreate() {
    this.merchantEditContext.set(null);
    this.form = {
      category_id: this.selectedCategoryId() || null,
      name: '',
      short_description: '',
      description: '',
      ai_description: '',
      image_url: '',
      price: 0,
      stock_qty: -1,
      inventory_enabled: false,
      is_active: true
    };
    this.dialogVisible.set(true);
  }

  openMerchantEdit(product: any) {
    this.prodMenuVisible.set(false);
    if (product.merchant_product_id) {
      this.merchantEditContext.set(product);
      this.form = {
        id: product.merchant_product_id,
        category_id: product.effective_category_id,
        name: product.effective_name,
        short_description: product.effective_short_description || '',
        description: product.effective_description || '',
        ai_description: product.effective_ai_description || '',
        image_url: product.effective_image_url || '',
        price: product.effective_price,
        stock_qty: product.effective_stock_qty ?? -1,
        inventory_enabled: (product.effective_stock_qty !== null && product.effective_stock_qty !== -1),
        is_active: Boolean(product.effective_is_active)
      };
      this.dialogVisible.set(true);
      return;
    }

    this.api.post<any>(`/products/inherited/${product.catalogue_id}/delink`, {}).subscribe({
      next: (response) => {
        const merchantProduct = response.data.merchantProduct;
        this.messageService.add({
          severity: 'success',
          summary: 'Delink complete',
          detail: 'Now editing merchant-owned copy.'
        });
        this.merchantEditContext.set(product);
        this.form = {
          id: merchantProduct.id,
          category_id: merchantProduct.category_id,
          name: merchantProduct.name,
          short_description: merchantProduct.short_description || '',
          description: merchantProduct.description || '',
          ai_description: merchantProduct.ai_description || '',
          image_url: merchantProduct.image_url || '',
          price: merchantProduct.price,
          stock_qty: merchantProduct.stock_qty ?? -1,
          inventory_enabled: (merchantProduct.stock_qty !== null && merchantProduct.stock_qty !== -1),
          is_active: Boolean(merchantProduct.is_active)
        };
        this.dialogVisible.set(true);
        this.loadProducts();
      }
    });
  }

  onInventoryToggle() {
    if (!this.form.inventory_enabled) {
      // Turned off → unlimited (-1)
      this.form.stock_qty = -1;
    } else {
      // Turned on → default to 0 qty
      this.form.stock_qty = 0;
    }
  }

  generateAiDescription() {
    if (!this.form.name) return;
    const categoryName = this.categories().find((c) => c.id === Number(this.form.category_id))?.name || '';
    this.aiLoading.set(true);
    this.api.post<any>('/products/generate-description', {
      product_name: this.form.name,
      category_name: categoryName
    }).subscribe({
      next: (response) => {
        this.form.ai_description = response.data.description;
        this.form.description = response.data.description; // Replace main description too
        this.aiLoading.set(false);
      },
      error: () => this.aiLoading.set(false)
    });
  }



  async save() {
    this.saving.set(true);

    // Auto-convert base64 image to uploaded URL before saving
    if (this.form.image_url && this.form.image_url.startsWith('data:image')) {
      try {
        this.form.image_url = await this.uploadBase64Image(this.form.image_url);
      } catch {
        this.saving.set(false);
        this.messageService.add({ severity: 'error', summary: 'Image failed', detail: 'Could not upload embedded image. Try again.' });
        return;
      }
    }

    const stockQty = this.form.inventory_enabled ? Number(this.form.stock_qty ?? 0) : -1;

    const finalDescription = this.form.ai_description || this.form.description;

    if (this.viewMode() === 'master') {
      const payload = {
        category_id: Number(this.form.category_id),
        sku: this.form.sku,
        name: this.form.name,
        short_description: this.form.short_description,
        description: finalDescription,
        ai_description: this.form.ai_description,
        image_url: this.form.image_url,
        price: Number(this.form.price || 0),
        stock_qty: stockQty,
        sort_order: Number(this.form.sort_order || 0),
        is_active: Boolean(this.form.is_active)
      };

      const request = this.form.id
        ? this.api.put(`/products/master/${this.form.id}`, payload)
        : this.api.post('/products/master', payload);

      request.subscribe({
        next: () => this.handleSaveSuccess('Master product saved'),
        error: (error) => this.handleSaveError(error.error?.message)
      });
      return;
    }

    const merchantPayload = {
      category_id: Number(this.form.category_id),
      name: this.form.name,
      short_description: this.form.short_description,
      description: finalDescription,
      ai_description: this.form.ai_description,
      image_url: this.form.image_url,
      price: Number(this.form.price || 0),
      stock_qty: stockQty,
      is_active: Boolean(this.form.is_active)
    };

    const request = this.form.id
      ? this.api.put(`/products/merchant/${this.form.id}`, merchantPayload)
      : this.api.post('/products/merchant', merchantPayload);

    request.subscribe({
      next: () => this.handleSaveSuccess(this.form.id ? 'Merchant override saved' : 'Private product created'),
      error: (error) => this.handleSaveError(error.error?.message)
    });
  }

  handleSaveSuccess(summary: string) {
    this.saving.set(false);
    this.dialogVisible.set(false);
    this.messageService.add({ severity: 'success', summary, detail: 'Changes applied successfully.' });
    this.loadProducts();
  }

  handleSaveError(detail = 'Save failed') {
    this.saving.set(false);
    this.messageService.add({ severity: 'error', summary: 'Save failed', detail });
  }

  toggleControlMode(product: any) {
    if (!this.canManage()) return;
    
    // If it's already a merchant product, we offer to relink it to masterbrand
    if (product.merchant_product_id) {
      this.api.post<any>(`/products/inherited/${product.catalogue_id}/relink`, {}).subscribe({
        next: (response) => {
          this.messageService.add({
            severity: 'success',
            summary: 'Relinked to Brand',
            detail: 'Product is now following masterbrand rules.'
          });
          // Update local state without closing the pane
          product.merchant_product_id = null;
          if (this.selectedProduct()?.id === product.id) {
            this.selectedProduct.set({ ...product });
          }
        }
      });
      return;
    }

    // If it's a masterbrand product, we delink it to allow custom merchant overrides
    this.api.post<any>(`/products/inherited/${product.catalogue_id}/delink`, {}).subscribe({
      next: (response) => {
        const merchantProduct = response.data.merchantProduct;
        this.messageService.add({
          severity: 'success',
          summary: 'Custom Mode Active',
          detail: 'You can now set merchant-specific price and availability.'
        });
        // Update local state
        product.merchant_product_id = merchantProduct.id;
        if (this.selectedProduct()?.id === product.id) {
          this.selectedProduct.set({ ...product });
        }
      }
    });
  }

  toggleMasterStatus(product: any) {
    if (!this.canManage()) return;
    const newState = !Boolean(product.is_active);
    
    // Optimistic Update
    product.is_active = newState ? 1 : 0;
    if (this.selectedProduct()?.id === product.id) {
      this.selectedProduct.set({ ...product });
    }

    this.api.put(`/products/master/${product.id}`, { is_active: newState }).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Masterbrand Update',
          detail: `Master product successfully ${newState ? 'enabled' : 'disabled'}.`
        });
      },
      error: () => {
        product.is_active = !newState ? 1 : 0;
        this.messageService.add({ severity: 'error', summary: 'Failed', detail: 'Could not update master status.' });
      }
    });
  }

  toggleMerchantStatus(product: any) {
    if (!this.canManage()) return;
    const newState = !Boolean(product.effective_is_active);
    
    // Optimistic Update
    product.effective_is_active = newState ? 1 : 0;
    if (this.selectedProduct()?.id === product.id) {
       this.selectedProduct.set({ ...product });
    }

    if (!product.merchant_product_id) {
      this.api.post<any>(`/products/inherited/${product.catalogue_id}/delink`, {}).subscribe({
        next: (response) => {
          this.updateMerchantStatus(response.data.merchantProduct.id, newState);
        },
        error: () => {
          product.effective_is_active = !newState ? 1 : 0;
        }
      });
      return;
    }
    this.updateMerchantStatus(product.merchant_product_id, newState);
  }

  private updateMerchantStatus(id: number, isActive: boolean) {
    this.api.put(`/products/merchant/${id}`, { is_active: isActive }).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Merchant Update',
          detail: `Store-specific product successfully ${isActive ? 'enabled' : 'disabled'}.`
        });
      }
    });
  }

  /** Background refresh without showing loader/spinner */
  private loadProductsSilent() {
    const params: any = {
      limit: this.limit,
      offset: this.offset
    };
    const catId = this.selectedCategoryId();
    if (catId) params.category_id = catId;
    if (this.search) params.search = this.search;

    const endpoint = this.viewMode() === 'master' ? '/products/master' : '/products/inherited';

    // Directly call http to avoid loader interceptor if needed, or just let it be.
    // Actually, I'll just update the signals.
    this.api.get<any>(endpoint, params).subscribe({
      next: (response) => {
        this.products.set(response.data.products || []);
        this.totalRecords.set(response.data.total || 0);
      }
    });
  }

  sourceSeverity(sourceType: string): 'info' | 'warn' {
    return sourceType === 'MERCHANT' ? 'warn' : 'info';
  }

  toggleOutOfStock(product: any) {
    if (!this.canManage()) return;
    const newState = !Boolean(product.is_out_of_stock);
    
    // Optimistic Update
    product.is_out_of_stock = newState ? 1 : 0;
    if (this.selectedProduct()?.id === product.id) {
       this.selectedProduct.set({ ...product });
    }

    this.api.put(`/products/inherited/${product.catalogue_id}/stock-status`, { is_out_of_stock: newState }).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Stock Updated',
          detail: `Product marked as ${newState ? 'Out of Stock' : 'In Stock'}.`
        });
      },
      error: () => {
        product.is_out_of_stock = !newState ? 1 : 0;
        this.messageService.add({ severity: 'error', summary: 'Failed', detail: 'Could not update stock status.' });
      }
    });
  }

  statusSeverity(isActive: boolean) {
    return isActive ? 'success' : 'contrast';
  }

  asBoolean(val: any): boolean {
    return Boolean(val);
  }

  isUnlimited(qty: any): boolean {
    return qty === null || qty === -1;
  }

  fmtCurrency(value: number) {
    return `₹${Number(value || 0).toLocaleString('en-IN')}`;
  }

  /** Drag and Drop Categories */
  onCategoryDrop(event: CdkDragDrop<any[]>) {
    if (this.viewMode() !== 'merchant') return;
    if (event.previousIndex === event.currentIndex) return;

    const list = this.categories();
    const item1 = list[event.previousIndex];
    const item2 = list[event.currentIndex];

    // Optimistic local update
    moveItemInArray(list, event.previousIndex, event.currentIndex);
    this.categories.set([...list]);

    this.api.post('/catalog/categories/swap', { id1: item1.id, id2: item2.id }).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Sequence Saved',
          detail: 'Category order updated successfully.'
        });
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Swap failed', detail: 'Could not update category order.' });
        this.loadCategories(); // Revert
      }
    });
  }

  /** Drag and Drop Products */
  onProductDrop(event: CdkDragDrop<any[]>) {
    if (this.viewMode() !== 'merchant') return;
    if (event.previousIndex === event.currentIndex) return;

    const list = this.products();
    const item1 = list[event.previousIndex];
    const item2 = list[event.currentIndex];

    // Dynamically resolve product IDs: in merchant mode it is master_product_id, in master mode it is id
    const id1 = this.viewMode() === 'master' ? item1.id : item1.master_product_id;
    const id2 = this.viewMode() === 'master' ? item2.id : item2.master_product_id;

    // Optimistic local update
    moveItemInArray(list, event.previousIndex, event.currentIndex);
    this.products.set([...list]);

    this.api.post('/products/swap', { id1, id2 }).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Sequence Saved',
          detail: 'Product order updated successfully.'
        });
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Swap failed', detail: 'Could not update product order.' });
        this.loadProducts(); // Revert
      }
    });
  }

  openLightbox(url: string | null) {
    if (!url) return;
    this.lightboxImage.set(url);
    this.lightboxVisible.set(true);
  }

  duplicateProduct(product: any) {
    if (!this.auth.isAdmin()) return;
    this.api.post<any>(`/products/master/${product.id}/duplicate`, {}).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Duplicated', detail: 'Product copy created.' });
        this.loadProducts();
      }
    });
  }

  deleteProduct(product: any) {
    if (this.viewMode() === 'master') {
      if (!this.auth.isAdmin()) return;
      this.confirmTarget.set(product);
      this.confirmType.set('product');
      this.confirmMessage.set(`Are you sure you want to delete master product "${product.name}"? This will affect all merchants.`);
      this.confirmVisible.set(true);
    } else {
      // Merchant mode
      if (!product.merchant_product_id) {
        this.messageService.add({ severity: 'warn', summary: 'Restricted', detail: 'You can only delete products you have customized (delinked).' });
        return;
      }
      this.confirmTarget.set(product);
      this.confirmType.set('product');
      this.confirmMessage.set(`Are you sure you want to remove your custom version of "${product.effective_name}"?`);
      this.confirmVisible.set(true);
    }
  }

  deleteCategory(cat: any) {
    if (!this.auth.isAdmin()) {
      this.messageService.add({ severity: 'warn', summary: 'Restricted', detail: 'Only admins can delete categories.' });
      return;
    }
    this.confirmTarget.set(cat);
    this.confirmType.set('category');
    this.confirmMessage.set(`Are you sure you want to delete category "${cat.name}"? This will also delete all products inside it.`);
    this.confirmVisible.set(true);
  }

  confirmExecute() {
    const target = this.confirmTarget();
    const type = this.confirmType();
    const isMaster = this.viewMode() === 'master';
    this.confirmVisible.set(false);

    if (type === 'product') {
      if (isMaster) {
        this.api.delete(`/products/master/${target.id}`).subscribe({
          next: () => {
            this.messageService.add({ severity: 'success', summary: 'Deleted', detail: 'Master product removed.' });
            this.loadProducts();
          }
        });
      } else {
        this.api.delete(`/products/merchant/${target.merchant_product_id}`).subscribe({
          next: () => {
            this.messageService.add({ severity: 'success', summary: 'Deleted', detail: 'Custom version removed.' });
            this.loadProducts();
          }
        });
      }
    } else {
      this.api.delete(`/catalog/categories/${target.id}`).subscribe({
        next: () => {
          this.messageService.add({ severity: 'success', summary: 'Deleted', detail: 'Category and its products removed.' });
          if (this.selectedCategoryId() === target.id) this.selectedCategoryId.set(null);
          this.loadCategories();
        }
      });
    }
  }

  onFileSelected(event: any) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      this.messageService.add({ severity: 'error', summary: 'File too large', detail: 'Image must be less than 5MB.' });
      return;
    }

    this.imageUploading.set(true);

    const formData = new FormData();
    formData.append('image', file);

    this.api.post<any>('/products/upload', formData, true).subscribe({
      next: (response) => {
        this.form.image_url = response.data.imageUrl;
        this.imageUploading.set(false);
        this.messageService.add({ severity: 'success', summary: 'Uploaded', detail: 'Image uploaded successfully.' });
      },
      error: (error) => {
        this.imageUploading.set(false);
        this.messageService.add({ severity: 'error', summary: 'Upload failed', detail: error.error?.message || 'Could not upload image.' });
      }
    });
  }

  removeImage() {
    this.form.image_url = '';
  }

  // Snooze Actions

  switchSnoozeTab(tab: 'snooze' | 'unsnooze', source: 'prompt' | 'modal') {
    if (source === 'prompt') {
      this.promptTab.set(tab);
    } else {
      if (this.snoozeTab() === tab) return;
      this.snoozeTab.set(tab);
      this.snoozeSelectedItems.clear();
      this.snoozeOffset = 0;
      this.loading.set(true);
      this.loadSnoozeList();
    }
  }

  openSnoozePrompt() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    this.promptSnoozeDate = tomorrow;
    // Default time: now + 24h as separate Date for time-only picker
    const defaultTime = new Date();
    defaultTime.setDate(defaultTime.getDate() + 1);
    this.promptSnoozeTime = defaultTime;
    this.todayDate = new Date();
    this.promptTab.set('snooze');
    this.snoozePromptVisible.set(true);
  }

  confirmSnoozePromptDetails() {
    if (this.promptTab() === 'snooze') {
      if (!this.promptSnoozeDate || !this.promptSnoozeTime) {
        this.messageService.add({ severity: 'error', summary: 'Required', detail: 'Please select both date and time.' });
        return;
      }
      // Combine separate date + time pickers
      const d = this.promptSnoozeDate;
      const t = this.promptSnoozeTime;
      const combined = new Date(d.getFullYear(), d.getMonth(), d.getDate(), t.getHours(), t.getMinutes(), 0);
      const now = new Date();
      if (combined <= now) {
        this.messageService.add({ severity: 'error', summary: 'Choose Greater Time', detail: 'Snooze duration must be in the future.' });
        return;
      }
      this.snoozeUntilDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      this.snoozeUntilTime = `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
    }

    this.snoozeTab.set(this.promptTab());
    this.snoozeMode.set('products');
    this.snoozeSelectedItems.clear();
    this.snoozeSearchQuery = '';
    this.snoozeOffset = 0;

    this.loading.set(true);
    this.loadSnoozeList();
    this.snoozePromptVisible.set(false);
    this.snoozeModalVisible.set(true);
  }

  setSnoozeMode(mode: 'products' | 'category') {
    this.snoozeMode.set(mode);
    this.snoozeSelectedItems.clear();
    this.snoozeOffset = 0;
    this.loading.set(true);
    this.loadSnoozeList();
  }

  onSnoozeSearch(query: string) {
    this.snoozeSearchQuery = query;
    this.snoozeOffset = 0;
    this.loading.set(true);
    this.loadSnoozeList();
  }

  loadSnoozeList() {
    const search = (this.snoozeSearchQuery || '').trim();

    // Clear stale data immediately on fresh load so shimmer shows cleanly
    if (this.snoozeOffset === 0) {
      this.snoozeFilteredItems.set([]);
    }

    if (this.snoozeMode() === 'products') {
      const params: any = {
        include_unavailable: 'true',
        limit: 25,
        offset: this.snoozeOffset
      };
      if (search) params.search = search;
      if (this.snoozeTab() === 'unsnooze') {
        params.snooze_filter = 'active';
      }
      this.api.get<any>('/products/inherited', params).subscribe({
        next: (res) => {
          const list = (res.data.products || []).map((p: any) => ({
            id: p.catalogue_id,
            name: p.effective_name,
            snooze_until: p.snooze_until
          }));
          if (this.snoozeOffset === 0) {
            this.snoozeFilteredItems.set(list);
          } else {
            this.snoozeFilteredItems.set([...this.snoozeFilteredItems(), ...list]);
          }
          this.snoozeTotalRecords.set(res.data.total || list.length);
          this.loading.set(false);
        },
        error: () => { this.loading.set(false); }
      });
    } else {
      this.api.get<any>('/products/category-snooze').subscribe({
        next: (snoozeRes) => {
          const apiCategories: Array<{ category_id: number; snooze_until: string }> = snoozeRes.data.categories || [];

          if (this.snoozeTab() === 'unsnooze') {
            // UnSnooze: ONLY show categories that the API confirmed are actively snoozed
            // The API already filters snooze_until > NOW(), so just map names from local categories list
            const catNameMap: Record<number, string> = {};
            this.categories().forEach((c: any) => { catNameMap[c.id] = c.name; });
            let cats = apiCategories.map(ac => ({
              id: ac.category_id,
              name: catNameMap[ac.category_id] || `Category #${ac.category_id}`,
              snooze_until: ac.snooze_until
            }));
            if (search) cats = cats.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));
            this.snoozeTotalRecords.set(cats.length);
            const sliced = cats.slice(this.snoozeOffset, this.snoozeOffset + 25);
            this.snoozeFilteredItems.set(this.snoozeOffset === 0 ? sliced : [...this.snoozeFilteredItems(), ...sliced]);
          } else {
            // Snooze: show all categories, marking which ones are already snoozed (disabled)
            const snoozeMap: Record<number, string> = {};
            apiCategories.forEach((c: any) => { snoozeMap[c.category_id] = c.snooze_until; });
            let cats = this.categories().map((c: any) => ({
              id: c.id,
              name: c.name,
              snooze_until: snoozeMap[c.id] || null
            }));
            if (search) cats = cats.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));
            this.snoozeTotalRecords.set(cats.length);
            const sliced = cats.slice(this.snoozeOffset, this.snoozeOffset + 25);
            this.snoozeFilteredItems.set(this.snoozeOffset === 0 ? sliced : [...this.snoozeFilteredItems(), ...sliced]);
          }
          this.loading.set(false);
        },
        error: () => {
          if (this.snoozeTab() === 'unsnooze') {
            // On error in unsnooze mode: show empty (can't determine which are snoozed)
            this.snoozeFilteredItems.set([]);
            this.snoozeTotalRecords.set(0);
          } else {
            const cats = this.categories().map((c: any) => ({ id: c.id, name: c.name, snooze_until: null }));
            this.snoozeTotalRecords.set(cats.length);
            const sliced = cats.slice(this.snoozeOffset, this.snoozeOffset + 25);
            this.snoozeFilteredItems.set(this.snoozeOffset === 0 ? sliced : [...this.snoozeFilteredItems(), ...sliced]);
          }
          this.loading.set(false);
        }
      });
    }
  }

  onSnoozeScroll(event: any) {
    const el = event.target;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 5) {
      if (!this.loading() && this.snoozeFilteredItems().length < this.snoozeTotalRecords()) {
        this.snoozeOffset += 25;
        this.loading.set(true);
        this.loadSnoozeList();
      }
    }
  }


  toggleSnoozeItemSelection(item: any) {
    if (this.snoozeTab() === 'snooze' && item.snooze_until && this.isItemCurrentlySnoozed(item.snooze_until)) {
      return;
    }
    if (this.snoozeSelectedItems.has(item.id)) {
      this.snoozeSelectedItems.delete(item.id);
    } else {
      this.snoozeSelectedItems.add(item.id);
    }
  }

  isSnoozeItemSelected(id: number): boolean {
    return this.snoozeSelectedItems.has(id);
  }

  removeSnoozeItemSelection(id: number) {
    this.snoozeSelectedItems.delete(id);
  }

  getSelectedSnoozeItemsList(): any[] {
    return Array.from(this.snoozeSelectedItems).map(id => {
      const found = this.snoozeFilteredItems().find(i => i.id === id);
      return found || { id, name: '(item #' + id + ')' };
    });
  }

  isItemCurrentlySnoozed(dateStr: string | null): boolean {
    if (!dateStr) return false;
    return new Date(dateStr) > new Date();
  }

  getFormattedSnoozeUntil(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
  }


  triggerSnoozeConfirm() {
    if (this.snoozeSelectedItems.size === 0) return;
    this.snoozeConfirmVisible.set(true);
  }

  executeSnoozeAction() {
    this.snoozeConfirmVisible.set(false);
    this.loading.set(true);

    const type = this.snoozeMode();
    const ids = Array.from(this.snoozeSelectedItems);

    if (this.snoozeTab() === 'snooze') {
      const combinedDateTime = new Date(`${this.snoozeUntilDate}T${this.snoozeUntilTime}`);
      if (isNaN(combinedDateTime.getTime())) {
        this.loading.set(false);
        this.messageService.add({ severity: 'error', summary: 'Invalid Date/Time', detail: 'Select a valid date and time.' });
        return;
      }
      this.api.post('/products/snooze', { type, ids, snooze_until: combinedDateTime.toISOString() }).subscribe({
        next: () => {
          this.loading.set(false);
          this.snoozeModalVisible.set(false);
          this.snoozeSelectedItems.clear();
          this.messageService.add({ severity: 'success', summary: 'Snoozed', detail: `${ids.length} item(s) snoozed successfully.` });
          this.offset = 0;
          this.loadProducts();
        },
        error: (err) => {
          this.loading.set(false);
          this.messageService.add({ severity: 'error', summary: 'Failed', detail: err.error?.message || 'Could not snooze items.' });
        }
      });
    } else {
      this.api.post('/products/unsnooze', { type, ids }).subscribe({
        next: () => {
          this.loading.set(false);
          this.snoozeModalVisible.set(false);
          this.snoozeSelectedItems.clear();
          this.messageService.add({ severity: 'success', summary: 'UnSnoozed', detail: `${ids.length} item(s) restored successfully.` });
          this.offset = 0;
          this.loadProducts();
        },
        error: (err) => {
          this.loading.set(false);
          this.messageService.add({ severity: 'error', summary: 'Failed', detail: err.error?.message || 'Could not unsnooze items.' });
        }
      });
    }
  }
}

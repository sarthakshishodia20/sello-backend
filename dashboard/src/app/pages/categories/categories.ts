import { Component, inject, OnInit, signal } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { MessageService } from 'primeng/api';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ApiService } from '../../services/api';
import { LoaderComponent } from '../../components/loader/loader.component';

@Component({
  selector: 'app-categories',
  standalone: true,
  imports: [
    NgFor,
    NgIf,
    FormsModule,
    ButtonModule,
    CardModule,
    DialogModule,
    InputTextModule,
    LoaderComponent,
    TableModule,
    TagModule
  ],
  templateUrl: './categories.html',
  styleUrl: './categories.css'
})
export class CategoriesComponent implements OnInit {
  api = inject(ApiService);
  messageService = inject(MessageService);

  categories = signal<any[]>([]);
  tree = signal<any[]>([]);
  loading = signal(true);
  saving = signal(false);
  dialogVisible = signal(false);

  form: any = {
    parent_id: null,
    name: '',
    description: '',
    sort_order: 0,
    is_active: true
  };

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.api.get<any>('/catalog/categories', { include_inactive: true }).subscribe({
      next: (response) => {
        this.categories.set(response.data.categories || []);
        this.tree.set(response.data.tree || []);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.messageService.add({
          severity: 'error',
          summary: 'Load failed',
          detail: 'Categories fetch nahi ho payi.'
        });
      }
    });
  }

  /**
   * Dialog shared between root category and subcategory create/edit actions.
   */
  openCreate(parentId: number | null = null) {
    this.form = {
      parent_id: parentId,
      name: '',
      description: '',
      sort_order: 0,
      is_active: true
    };
    this.dialogVisible.set(true);
  }

  openEdit(category: any) {
    this.form = {
      id: category.id,
      parent_id: category.parent_id,
      name: category.name,
      description: category.description || '',
      sort_order: category.sort_order,
      is_active: Boolean(category.is_active)
    };
    this.dialogVisible.set(true);
  }

  save() {
    this.saving.set(true);

    const payload = {
      parent_id: this.form.parent_id || null,
      name: this.form.name,
      description: this.form.description,
      sort_order: Number(this.form.sort_order || 0),
      is_active: Boolean(this.form.is_active)
    };

    const request = this.form.id
      ? this.api.put(`/catalog/categories/${this.form.id}`, payload)
      : this.api.post('/catalog/categories', payload);

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.dialogVisible.set(false);
        this.messageService.add({
          severity: 'success',
          summary: 'Saved',
          detail: 'Category changes apply ho gaye.'
        });
        this.load();
      },
      error: (error) => {
        this.saving.set(false);
        this.messageService.add({
          severity: 'error',
          summary: 'Save failed',
          detail: error.error?.message || 'Category save nahi ho payi.'
        });
      }
    });
  }

  archive(category: any) {
    if (!confirm(`Archive "${category.name}"?`)) {
      return;
    }

    this.api.delete(`/catalog/categories/${category.id}`).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Archived',
          detail: `"${category.name}" inactive kar diya gaya.`
        });
        this.load();
      }
    });
  }

  statusSeverity(isActive: boolean) {
    return isActive ? 'success' : 'contrast';
  }
}

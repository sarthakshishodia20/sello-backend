import { Component, inject, signal, OnInit } from '@angular/core';
import { NgIf, NgFor, CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { DialogModule } from 'primeng/dialog';
import { TagModule } from 'primeng/tag';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { ApiService } from '../../services/api';
import { LanguageService } from '../../services/language.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    InputTextModule,
    TextareaModule,
    ToggleSwitchModule,
    DialogModule,
    TagModule,
    ToastModule,
    NgFor
  ],
  providers: [MessageService],
  templateUrl: './settings.html',
  styleUrl: './settings.css'
})
export class SettingsComponent implements OnInit {
  private api = inject(ApiService);
  private messageService = inject(MessageService);
  public langService = inject(LanguageService);

  langOptions = [
    { label: 'English', value: 'en' },
    { label: 'Hindi', value: 'hi' },
    { label: 'Punjabi', value: 'pa' }
  ];

  templates = signal<any[]>([]);
  loading = signal(false);
  editDialogVisible = false;
  selectedTemplate = signal<any>({});

  ngOnInit() {
    this.loadTemplates();
  }

  loadTemplates() {
    this.loading.set(true);
    this.api.get('/notifications/templates').subscribe({
      next: (res: any) => {
        this.templates.set(res.data?.data || []);
        this.loading.set(false);
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to load templates' });
        this.loading.set(false);
      }
    });
  }

  editTemplate(template: any) {
    this.selectedTemplate.set({ ...template });
    this.editDialogVisible = true;
  }

  saveTemplate() {
    const data = this.selectedTemplate();
    this.api.put(`/notifications/templates/${data.id}`, data).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Template updated' });
        this.editDialogVisible = false;
        this.loadTemplates();
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to update template' });
      }
    });
  }

  changeLang(lang: any) {
    this.langService.setLanguage(lang);
  }
}

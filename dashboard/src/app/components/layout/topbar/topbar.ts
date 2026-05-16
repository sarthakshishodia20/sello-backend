import { Component, Output, EventEmitter, inject } from '@angular/core';
import { AuthService } from '../../../services/auth';
import { LanguageService } from '../../../services/language.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-topbar',
  standalone: true,
  templateUrl: './topbar.html',
  styleUrl: './topbar.css'
})
export class TopbarComponent {
  auth = inject(AuthService);
  lang = inject(LanguageService);
  webappUrl = environment.webappUrl;

  @Output() toggleSidebar = new EventEmitter<void>();

  get storeLink(): string {
    const slug = this.auth.user()?.merchantSlug;
    return slug ? `${this.webappUrl}/store/${slug}` : this.webappUrl;
  }
}

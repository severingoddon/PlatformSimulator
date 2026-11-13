import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService, AppConfig } from './api.service';
import { Texts } from '../models/texts.model';

/** App configuration (texts, themes, return URL), loaded once before the app starts. */
@Injectable({ providedIn: 'root' })
export class ConfigService {
  private api = inject(ApiService);
  private config!: AppConfig;

  async load(): Promise<void> {
    this.config = await firstValueFrom(this.api.getConfig());
    document.documentElement.lang = this.config.texts.language;
  }

  get texts(): Texts {
    return this.config.texts;
  }

  get themes() {
    return this.config.themes;
  }

  get returnUrl(): string {
    return this.config.returnUrl;
  }
}

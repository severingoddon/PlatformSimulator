import { Injectable, signal } from '@angular/core';
import { Demographics } from '../models/demographics.model';

@Injectable({ providedIn: 'root' })
export class UserSessionService {
  private demographics = signal<Demographics | null>(null);

  setDemographics(data: Demographics): void {
    this.demographics.set(data);
  }

  getDemographics(): Demographics | null {
    return this.demographics();
  }

  isComplete(): boolean {
    return this.demographics() !== null;
  }
}

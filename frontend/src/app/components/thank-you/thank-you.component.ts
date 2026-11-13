import { Component, inject, signal } from '@angular/core';
import { ConfigService } from '../../services/config.service';

@Component({
  selector: 'app-thank-you',
  standalone: true,
  templateUrl: './thank-you.component.html',
  styleUrl: './thank-you.component.scss',
})
export class ThankYouComponent {
  private config = inject(ConfigService);
  texts = this.config.texts;
  code = this.config.completionCode;
  copied = signal(false);

  /**
   * The feed was opened in the same tab as the survey: the survey is one step back
   * in the browser history. If the feed was opened in a new tab there is no history,
   * so we show a hint to switch tabs instead of the button.
   */
  canGoBack = signal(window.history.length > 1);

  async copyCode() {
    try {
      await navigator.clipboard.writeText(this.code);
    } catch {
      // Older browsers / no permission: copy via a temporary text field
      const field = document.createElement('textarea');
      field.value = this.code;
      field.setAttribute('readonly', '');
      field.style.position = 'fixed';
      field.style.opacity = '0';
      document.body.appendChild(field);
      field.select();
      document.execCommand('copy');
      field.remove();
    }
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 2500);
  }

  backToSurvey() {
    window.history.back();
    // If the browser could not go back (should not happen), show the hint instead
    setTimeout(() => this.canGoBack.set(false), 1500);
  }
}

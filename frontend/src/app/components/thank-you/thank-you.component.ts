import { Component, inject, signal } from '@angular/core';
import { ConfigService } from '../../services/config.service';

@Component({
  selector: 'app-thank-you',
  standalone: true,
  templateUrl: './thank-you.component.html',
  styleUrl: './thank-you.component.scss',
})
export class ThankYouComponent {
  texts = inject(ConfigService).texts;

  /**
   * The feed was opened in the same tab as the survey: the survey is one step back
   * in the browser history. If the feed was opened in a new tab there is no history,
   * so we show a hint to switch tabs instead of the button.
   */
  canGoBack = signal(window.history.length > 1);

  backToSurvey() {
    window.history.back();
    // If the browser could not go back (should not happen), show the hint instead
    setTimeout(() => this.canGoBack.set(false), 1500);
  }
}

import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, retry, throwError, timer } from 'rxjs';
import { PostsResponse, EngagementEvent, BlockSurveyPayload } from '../models/post.model';
import { Texts } from '../models/texts.model';

export interface ThemeConfig {
  key: string;
  label: string;
}

export interface AppConfig {
  themes: ThemeConfig[];
  /** Where participants are sent after the last block (empty = show thank-you page). */
  returnUrl: string;
  /** Code shown on the end page, entered by participants in the survey. */
  completionCode: string;
  texts: Texts;
}

/**
 * Retry a failed request up to 5 times (after 0.5s, 1s, 2s, 4s, 8s) on network
 * problems or server errors. Requests the server rejected as invalid (4xx) are not
 * retried. Retries are safe: every request carries an ID and duplicates are ignored.
 */
function retryOnNetworkError<T>() {
  return retry<T>({
    count: 5,
    delay: (error: unknown, attempt: number) =>
      error instanceof HttpErrorResponse && error.status >= 400 && error.status < 500
        ? throwError(() => error)
        : timer(500 * 2 ** (attempt - 1)),
  });
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);

  getConfig(): Observable<AppConfig> {
    return this.http.get<AppConfig>('/api/config');
  }

  getPosts(): Observable<PostsResponse> {
    return this.http.get<PostsResponse>('/api/posts');
  }

  sendEngagement(event: EngagementEvent): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>('/api/engagement', event).pipe(retryOnNetworkError());
  }

  submitBlockSurvey(survey: BlockSurveyPayload): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>('/api/block-survey', survey).pipe(retryOnNetworkError());
  }
}

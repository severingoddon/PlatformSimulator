import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { PostsResponse, PostFeedback, BlockSurveyPayload } from '../models/post.model';

export interface ThemeConfig {
  key: string;
  label: string;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);

  getConfig(): Observable<{ themes: ThemeConfig[] }> {
    return this.http.get<{ themes: ThemeConfig[] }>('/api/config');
  }

  getPosts(): Observable<PostsResponse> {
    return this.http.get<PostsResponse>('/api/posts');
  }

  sendFeedback(feedback: PostFeedback): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>('/api/feedback', feedback);
  }

  submitBlockSurvey(survey: BlockSurveyPayload): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>('/api/block-survey', survey);
  }
}

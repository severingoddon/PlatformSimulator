import { Routes } from '@angular/router';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { UserSessionService } from './services/user-session.service';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./components/demographic-form/demographic-form.component').then(m => m.DemographicFormComponent),
  },
  {
    path: 'feed',
    loadComponent: () => import('./components/feed/feed.component').then(m => m.FeedComponent),
    canActivate: [() => {
      const session = inject(UserSessionService);
      const router = inject(Router);
      if (session.isComplete()) {
        return true;
      }
      return router.parseUrl('/');
    }],
  },
  {
    path: 'thank-you',
    loadComponent: () => import('./components/thank-you/thank-you.component').then(m => m.ThankYouComponent),
  },
  { path: '**', redirectTo: '' },
];

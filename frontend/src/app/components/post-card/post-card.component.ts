import { Component, input, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EngagementAction, PostData } from '../../models/post.model';
import { newRequestId } from '../../utils/id.util';
import { UserSessionService } from '../../services/user-session.service';
import { ApiService } from '../../services/api.service';
import { ConfigService } from '../../services/config.service';
import { fmt } from '../../models/texts.model';

@Component({
  selector: 'app-post-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './post-card.component.html',
  styleUrl: './post-card.component.scss',
})
export class PostCardComponent {
  post = input.required<PostData>();

  private session = inject(UserSessionService);
  private api = inject(ApiService);
  texts = inject(ConfigService).texts;
  fmt = fmt;

  liked = signal(false);
  followed = signal(false);
  saved = signal(false);
  shared = signal(false);
  imageLoaded = signal(false);

  getTimestamp(): string {
    const name = this.post().profileName;
    const timestamps = this.texts.post.timestamps;
    return timestamps[name.charCodeAt(0) % timestamps.length];
  }

  getProfileInitial(): string {
    return this.post().profileName.charAt(0).toUpperCase();
  }

  getProfileColor(): string {
    const colors = ['#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#00bcd4', '#009688', '#4caf50', '#ff9800', '#ff5722'];
    const name = this.post().profileName;
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  }

  getMockLikeCount(): number {
    const name = this.post().profileName;
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return 10 + Math.abs(hash) % 990;
  }

  toggleLike() {
    this.liked.update(v => !v);
    this.sendEvent(this.liked() ? 'like' : 'unlike');
  }

  toggleFollow() {
    this.followed.update(v => !v);
    this.sendEvent(this.followed() ? 'follow' : 'unfollow');
  }

  toggleSaved() {
    this.saved.update(v => !v);
    this.sendEvent(this.saved() ? 'save' : 'unsave');
  }

  toggleShared() {
    this.shared.update(v => !v);
    this.sendEvent(this.shared() ? 'share' : 'unshare');
  }

  private lastTap = 0;

  onTouchEnd(event: TouchEvent) {
    const now = Date.now();
    if (now - this.lastTap < 300) {
      event.preventDefault();
      this.onDoubleTap();
    }
    this.lastTap = now;
  }

  onDoubleTap() {
    if (!this.liked()) {
      this.liked.set(true);
      this.sendEvent('like');
    }
  }

  private sendEvent(action: EngagementAction) {
    const pid = this.session.getPid();
    if (!pid) return;

    this.api.sendEngagement({
      eventId: newRequestId(),
      pid,
      postId: this.post().postId,
      blockNumber: this.post().blockNumber,
      postPosition: this.post().postPosition,
      action,
    }).subscribe({
      error: err => console.error('Could not save engagement event', err),
    });
  }
}

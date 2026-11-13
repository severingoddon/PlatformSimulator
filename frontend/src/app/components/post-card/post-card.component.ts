import { Component, input, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PostData, PostFeedback } from '../../models/post.model';
import { UserSessionService } from '../../services/user-session.service';
import { ApiService } from '../../services/api.service';

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

  liked = signal(false);
  followed = signal(false);
  saved = signal(false);
  shared = signal(false);
  imageLoaded = signal(false);

  private mockTimestamps = ['1 Std.', '2 Std.', '3 Std.', '5 Std.', '8 Std.', '12 Std.', '1 T.', '2 T.', '3 T.'];

  getTimestamp(): string {
    const name = this.post().profileName;
    const index = name.charCodeAt(0) % this.mockTimestamps.length;
    return this.mockTimestamps[index];
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
    this.sendFeedback();
  }

  toggleFollow() {
    this.followed.update(v => !v);
    this.sendFeedback();
  }

  toggleSaved() {
    this.saved.update(v => !v);
    this.sendFeedback();
  }

  toggleShared() {
    this.shared.update(v => !v);
    this.sendFeedback();
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
      this.sendFeedback();
    }
  }

  private sendFeedback() {
    const pid = this.session.getPid();
    if (!pid) return;

    const feedback: PostFeedback = {
      postId: this.post().postId,
      blockNumber: this.post().blockNumber,
      postPosition: this.post().postPosition,
      liked: this.liked(),
      followed: this.followed(),
      saved: this.saved(),
      shared: this.shared(),
      pid,
    };

    this.api.sendFeedback(feedback).subscribe();
  }
}

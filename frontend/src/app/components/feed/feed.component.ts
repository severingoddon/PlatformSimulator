import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { forkJoin } from 'rxjs';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { ConfigService } from '../../services/config.service';
import { UserSessionService } from '../../services/user-session.service';
import { PostData, BlockSurveyPayload } from '../../models/post.model';
import { PostCardComponent } from '../post-card/post-card.component';
import { BlockSurveyComponent, BlockSurveyResult } from '../block-survey/block-survey.component';
import { newRequestId } from '../../utils/id.util';

type FeedState = 'loading' | 'intro' | 'viewing' | 'survey' | 'completed';

@Component({
  selector: 'app-feed',
  standalone: true,
  imports: [CommonModule, PostCardComponent, BlockSurveyComponent],
  templateUrl: './feed.component.html',
  styleUrl: './feed.component.scss',
})
export class FeedComponent implements OnInit {
  private api = inject(ApiService);
  private session = inject(UserSessionService);
  private router = inject(Router);
  private config = inject(ConfigService);

  texts = this.config.texts;
  themes = this.config.themes;

  allPosts = signal<PostData[]>([]);
  currentBlock = signal(1);
  feedState = signal<FeedState>('loading');
  totalBlocks = 0;

  currentBlockPosts = computed(() => {
    const block = this.currentBlock();
    return this.allPosts().filter(p => p.blockNumber === block);
  });

  showContinueButton = signal(false);
  saving = signal(false);
  saveFailed = signal(false);
  /** One ID per block survey; reused if the participant has to click "Next" again after an error. */
  private submissionId = '';

  ngOnInit() {
    const pid = this.session.getPid()!;
    // Load the posts and where this participant stands, then continue from there
    forkJoin({ posts: this.api.getPosts(), progress: this.api.getProgress(pid) }).subscribe({
      next: ({ posts, progress }) => {
        this.allPosts.set(posts.posts);
        this.totalBlocks = Math.max(...posts.posts.map(p => p.blockNumber), 0);
        const done = new Set(progress.completedBlocks);
        const nextBlock = Array.from({ length: this.totalBlocks }, (_, i) => i + 1).find(b => !done.has(b));

        if (nextBlock === undefined) {
          // Everything answered already: show the end page with the code again
          this.finishStudy(pid);
        } else if (nextBlock === 1 && progress.shownBlock === 0) {
          // Nothing started yet
          this.feedState.set('intro');
        } else {
          // Interrupted: show the posts of the first block whose questions are not answered yet
          this.currentBlock.set(nextBlock);
          this.showBlock();
        }
      },
      // Progress unknown (should not happen after the retries): start normally
      error: () => this.feedState.set('intro'),
    });
  }

  startFeed() {
    this.showBlock();
  }

  /** Show the feed of the current block and tell the server it has been shown. */
  private showBlock() {
    this.feedState.set('viewing');
    window.scrollTo({ top: 0 });
    const pid = this.session.getPid();
    if (pid) {
      this.api.reportBlockShown(pid, this.currentBlock()).subscribe({
        error: err => console.error('Could not save progress', err),
      });
    }
  }

  onBlockScrollEnd() {
    this.showContinueButton.set(true);
  }

  openSurvey() {
    this.showContinueButton.set(false);
    this.submissionId = newRequestId();
    this.saveFailed.set(false);
    this.feedState.set('survey');
  }

  onSurveyCompleted(result: BlockSurveyResult) {
    const pid = this.session.getPid();
    if (!pid || this.saving()) return;

    const payload: BlockSurveyPayload = {
      submissionId: this.submissionId,
      blockNumber: this.currentBlock(),
      pid,
      themes: result.themes,
      localizations: result.localizations,
    };

    this.saving.set(true);
    this.saveFailed.set(false);
    this.api.submitBlockSurvey(payload).subscribe({
      next: () => {
        this.saving.set(false);
        if (this.currentBlock() >= this.totalBlocks) {
          this.finishStudy(pid);
        } else {
          this.currentBlock.update(b => b + 1);
          this.showBlock();
        }
      },
      error: err => {
        // All retries failed: show a message, the participant can click "Next" again
        console.error('Could not save block survey', err);
        this.saving.set(false);
        this.saveFailed.set(true);
      },
    });
  }

  /** Send the participant back to the survey (with their pid) or show the thank-you page. */
  private finishStudy(pid: string) {
    const returnUrl = this.config.returnUrl;
    if (returnUrl) {
      try {
        const url = new URL(returnUrl);
        url.searchParams.set('pid', pid);
        window.location.href = url.toString();
        return;
      } catch {
        console.error('RETURN_URL is not a valid URL:', returnUrl);
      }
    }
    // replaceUrl: one click on the browser's Back button leads straight back to the survey
    this.router.navigate(['/thank-you'], { replaceUrl: true });
  }
}

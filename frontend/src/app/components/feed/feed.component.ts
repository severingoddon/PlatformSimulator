import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { ConfigService } from '../../services/config.service';
import { UserSessionService } from '../../services/user-session.service';
import { PostData, BlockSurveyPayload } from '../../models/post.model';
import { PostCardComponent } from '../post-card/post-card.component';
import { BlockSurveyComponent, BlockSurveyResult } from '../block-survey/block-survey.component';

type FeedState = 'viewing' | 'survey' | 'completed';

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
  feedState = signal<FeedState>('viewing');
  totalBlocks = 10;

  currentBlockPosts = computed(() => {
    const block = this.currentBlock();
    return this.allPosts().filter(p => p.blockNumber === block);
  });

  showContinueButton = signal(false);

  ngOnInit() {
    this.api.getPosts().subscribe(response => {
      this.allPosts.set(response.posts);
      const maxBlock = Math.max(...response.posts.map(p => p.blockNumber), 0);
      this.totalBlocks = maxBlock || 10;
    });
  }

  onBlockScrollEnd() {
    this.showContinueButton.set(true);
  }

  openSurvey() {
    this.showContinueButton.set(false);
    this.feedState.set('survey');
  }

  onSurveyCompleted(result: BlockSurveyResult) {
    const pid = this.session.getPid();
    if (!pid) return;

    const payload: BlockSurveyPayload = {
      blockNumber: this.currentBlock(),
      pid,
      themes: result.themes,
      localizations: result.localizations,
    };

    this.api.submitBlockSurvey(payload).subscribe(() => {
      if (this.currentBlock() >= this.totalBlocks) {
        this.finishStudy(pid);
      } else {
        this.currentBlock.update(b => b + 1);
        this.feedState.set('viewing');
        window.scrollTo({ top: 0 });
      }
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
    this.router.navigate(['/thank-you']);
  }
}

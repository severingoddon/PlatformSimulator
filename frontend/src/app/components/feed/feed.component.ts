import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ApiService, ThemeConfig } from '../../services/api.service';
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

  allPosts = signal<PostData[]>([]);
  themes = signal<ThemeConfig[]>([]);
  currentBlock = signal(1);
  feedState = signal<FeedState>('viewing');
  totalBlocks = 10;

  currentBlockPosts = computed(() => {
    const block = this.currentBlock();
    return this.allPosts().filter(p => p.blockNumber === block);
  });

  showContinueButton = signal(false);

  ngOnInit() {
    this.api.getConfig().subscribe(config => {
      this.themes.set(config.themes);
    });
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
    const demo = this.session.getDemographics();
    if (!demo) return;

    const payload: BlockSurveyPayload = {
      blockNumber: this.currentBlock(),
      userEmailHash: demo.userEmailHash,
      alter: demo.alter,
      religionsangehoerigkeit: demo.religionsangehoerigkeit,
      bildungsabschluss: demo.bildungsabschluss,
      herkunft: demo.herkunft,
      politischeEinstellung: demo.politischeEinstellung,
      themes: result.themes,
      localizations: result.localizations,
    };

    this.api.submitBlockSurvey(payload).subscribe(() => {
      if (this.currentBlock() >= this.totalBlocks) {
        this.router.navigate(['/thank-you']);
      } else {
        this.currentBlock.update(b => b + 1);
        this.feedState.set('viewing');
        window.scrollTo({ top: 0 });
      }
    });
  }
}

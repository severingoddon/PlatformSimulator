import { Component, input, output, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PostData, ThemeLocalizationEntry } from '../../models/post.model';

export interface ThemeOption {
  key: string;
  label: string;
}

export interface BlockSurveyResult {
  themes: Record<string, boolean>;
  localizations: ThemeLocalizationEntry[];
}

const NON_RELIGIOUS_KEYS = new Set([
  'lifestyle', 'health', 'motivation', 'politics',
  'relationships', 'belongingCommunity', 'other',
]);

@Component({
  selector: 'app-block-survey',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './block-survey.component.html',
  styleUrl: './block-survey.component.scss',
})
export class BlockSurveyComponent implements OnInit {
  blockPosts = input.required<PostData[]>();
  blockNumber = input.required<number>();
  themes = input.required<ThemeOption[]>();
  completed = output<BlockSurveyResult>();

  step = signal<1 | 2>(1);
  shuffledThemes = signal<ThemeOption[]>([]);
  selectedThemes = signal<Set<string>>(new Set());
  themesToLocalize = signal<ThemeOption[]>([]);
  localizationData = signal<Record<string, boolean[]>>({});

  hasSelection = computed(() => this.selectedThemes().size > 0);

  ngOnInit() {
    this.shuffledThemes.set([...this.themes()].sort(() => Math.random() - 0.5));
  }

  toggleTheme(key: string) {
    this.selectedThemes.update(set => {
      const next = new Set(set);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  isThemeSelected(key: string): boolean {
    return this.selectedThemes().has(key);
  }

  proceedToLocalization() {
    if (!this.hasSelection()) return;
    const selected = this.selectedThemes();
    const toLocalize = this.computeLocalizationThemes(selected);
    this.themesToLocalize.set(toLocalize);

    const data: Record<string, boolean[]> = {};
    for (const t of toLocalize) {
      data[t.key] = [false, false, false, false, false];
    }
    this.localizationData.set(data);
    this.step.set(2);
  }

  private computeLocalizationThemes(selected: Set<string>): ThemeOption[] {
    const allThemes = this.themes();
    const hasReligion = selected.has('religion');
    const hasSpirituality = selected.has('spirituality');
    const result: ThemeOption[] = [];

    if (hasReligion) {
      result.push(allThemes.find(t => t.key === 'religion')!);
    }
    if (hasSpirituality) {
      result.push(allThemes.find(t => t.key === 'spirituality')!);
    }

    const otherSelected = allThemes.filter(
      t => selected.has(t.key) && t.key !== 'religion' && t.key !== 'spirituality'
    );

    if (hasReligion || hasSpirituality) {
      if (otherSelected.length > 0) {
        const randomOther = otherSelected[Math.floor(Math.random() * otherSelected.length)];
        result.push(randomOther);
      }
    } else {
      const nonReligious = otherSelected.filter(t => NON_RELIGIOUS_KEYS.has(t.key));
      const shuffled = [...nonReligious].sort(() => Math.random() - 0.5);
      result.push(...shuffled.slice(0, 2));
    }

    return result;
  }

  toggleLocalization(themeKey: string, postIndex: number) {
    this.localizationData.update(data => {
      const updated = { ...data };
      updated[themeKey] = [...updated[themeKey]];
      updated[themeKey][postIndex] = !updated[themeKey][postIndex];
      return updated;
    });
  }

  isLocalized(themeKey: string, postIndex: number): boolean {
    return this.localizationData()[themeKey]?.[postIndex] ?? false;
  }

  submitSurvey() {
    const themes: Record<string, boolean> = {};
    for (const t of this.themes()) {
      themes[t.key] = this.selectedThemes().has(t.key);
    }

    const localizations: ThemeLocalizationEntry[] = [];
    const data = this.localizationData();
    for (const theme of this.themesToLocalize()) {
      const posts = data[theme.key] || [false, false, false, false, false];
      localizations.push({
        theme: theme.key,
        post1: posts[0],
        post2: posts[1],
        post3: posts[2],
        post4: posts[3],
        post5: posts[4],
      });
    }

    this.completed.emit({ themes, localizations });
  }
}

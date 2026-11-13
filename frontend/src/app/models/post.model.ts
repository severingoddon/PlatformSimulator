export interface PostData {
  postId: string;
  profileName: string;
  imageUrl: string;
  blockNumber: number;
  postPosition: number;
}

export interface PostsResponse {
  posts: PostData[];
}

export type EngagementAction =
  'like' | 'unlike' | 'follow' | 'unfollow' | 'save' | 'unsave' | 'share' | 'unshare';

/** One click on a post. Stored as one row in engagement.csv. */
export interface EngagementEvent {
  eventId: string;
  pid: string;
  postId: string;
  blockNumber: number;
  postPosition: number;
  action: EngagementAction;
}

export interface ThemeLocalizationEntry {
  theme: string;
  post1: boolean;
  post2: boolean;
  post3: boolean;
  post4: boolean;
  post5: boolean;
}

export interface BlockSurveyPayload {
  submissionId: string;
  blockNumber: number;
  pid: string;
  themes: Record<string, boolean>;
  localizations: ThemeLocalizationEntry[];
}

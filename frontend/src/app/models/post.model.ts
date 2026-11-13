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

export interface PostFeedback {
  postId: string;
  blockNumber: number;
  postPosition: number;
  liked: boolean;
  followed: boolean;
  saved: boolean;
  shared: boolean;
  pid: string;
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
  blockNumber: number;
  pid: string;
  themes: Record<string, boolean>;
  localizations: ThemeLocalizationEntry[];
}

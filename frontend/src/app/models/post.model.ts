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
  userEmailHash: string;
  alter: number;
  religionsangehoerigkeit: string;
  bildungsabschluss: string;
  herkunft: string;
  politischeEinstellung: number;
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
  userEmailHash: string;
  alter: number;
  religionsangehoerigkeit: string;
  bildungsabschluss: string;
  herkunft: string;
  politischeEinstellung: number;
  themes: Record<string, boolean>;
  localizations: ThemeLocalizationEntry[];
}

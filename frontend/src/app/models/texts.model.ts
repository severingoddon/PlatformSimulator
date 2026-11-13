/**
 * All participant-facing texts. Loaded at startup from the backend
 * (backend/texts/<LANGUAGE>.json) – do not hard-code texts in templates.
 */
export interface Texts {
  language: string;
  themes: Record<string, string>;
  intro: {
    title: string;
    message: string;
    subMessage: string;
    startButton: string;
  };
  feed: {
    continueButton: string;
    notifications: string;
    messenger: string;
    home: string;
    search: string;
    reels: string;
    create: string;
    profile: string;
  };
  post: {
    follow: string;
    following: string;
    moreOptions: string;
    like: string;
    unlike: string;
    comment: string;
    share: string;
    shared: string;
    save: string;
    unsave: string;
    likes: string;
    caption: string;
    imageAlt: string;
    timestamps: string[];
  };
  survey: {
    progress: string;
    recognitionTitle: string;
    recognitionSubtitle: string;
    localizationTitle: string;
    localizationSubtitle: string;
    postLabel: string;
    next: string;
    saveError: string;
  };
  invalidLink: { title: string; message: string };
  thankYou: { title: string; message: string; subMessage: string };
}

/** Replaces {placeholders} in a text, e.g. fmt('Block {block} of {total}', { block: 1, total: 10 }). */
export function fmt(text: string, params: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (match, key) => (key in params ? String(params[key]) : match));
}

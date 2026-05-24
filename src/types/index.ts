export interface ToneSpectrum {
  formalCasual: number;        // 1=Formal, 5=Casual
  educationalConversational: number;
  seriousLighthearted: number;
  directGentle: number;
  inspirationalPractical: number;
}

export interface SessionData {
  currentStep: number;
  completedSteps: number[];

  // Step 1 — Discovery
  fullName: string;
  email: string;
  bookTitle: string;
  gender: string;
  amazonLink: string;
  websiteUrl: string;
  transformation: string;
  whyWroteBook: string;
  idealAudience: string;
  audienceProblem: string;
  bookDescription: string;
  uniqueApproach: string;
  toneSpectrum: ToneSpectrum;
  additionalVoiceDescriptors: string;
  successGoals: string;
  platforms: string[];
  discoveryApproved: boolean;

  // Step 2 — Soundbites
  soundbitesOutput: string;
  soundbitesApproved: boolean;

  // Step 3 — Brand Personality
  brandPersonalityOutput: string;
  brandPersonalityApproved: boolean;

  // Step 4 — Style Guide (moved before color palette)
  stylePhotos: string[];
  dayToDay: string;
  mostConfident: string;
  typicalStyle: string;
  avoidWearing: string;
  comfortWithColor: string;
  fitPreference: string;
  styleGuideOutput: string;
  styleGuideApproved: boolean;

  // Step 5 — Color Palette (after style guide)
  favoriteColor: string;
  colorPaletteOutput: string;
  brandColors: { primary: string; secondary: string; accent: string };
  colorPaletteApproved: boolean;

  // Step 6 — Social Media Platforms
  platformsOutput: string;
  recommendedPlatforms: string[];
  platformsApproved: boolean;

  // Step 7 — LinkedIn (conditional)
  linkedInOutput: string;
  linkedInApproved: boolean;

  // Step 8 — Sample Posts
  samplePostsOutput: string;
  samplePostsApproved: boolean;

  // Step 9 — Hashtags
  hashtagsOutput: string;
  hashtagsApproved: boolean;

  // Outfit photos from Unsplash (set by Step9, used by Step10 PDF)
  outfitPhotoData: Array<{ url: string; credit: string } | null>;

  // Step 10
  finalEmail: string;

  // Legacy (kept for existing sessions)
  stylePhotoBase64: string | null;
}

export const defaultSession: SessionData = {
  currentStep: 1,
  completedSteps: [],
  fullName: '',
  email: '',
  bookTitle: '',
  gender: '',
  amazonLink: '',
  websiteUrl: '',
  transformation: '',
  whyWroteBook: '',
  idealAudience: '',
  audienceProblem: '',
  bookDescription: '',
  uniqueApproach: '',
  toneSpectrum: {
    formalCasual: 3,
    educationalConversational: 3,
    seriousLighthearted: 3,
    directGentle: 3,
    inspirationalPractical: 3,
  },
  additionalVoiceDescriptors: '',
  successGoals: '',
  platforms: [],
  discoveryApproved: false,
  soundbitesOutput: '',
  soundbitesApproved: false,
  brandPersonalityOutput: '',
  brandPersonalityApproved: false,
  stylePhotos: [],
  stylePhotoBase64: null,
  dayToDay: '',
  mostConfident: '',
  typicalStyle: '',
  avoidWearing: '',
  comfortWithColor: '',
  fitPreference: '',
  styleGuideOutput: '',
  styleGuideApproved: false,
  favoriteColor: '',
  colorPaletteOutput: '',
  brandColors: { primary: '#b4887a', secondary: '#faf7f5', accent: '#3F3F3F' },
  colorPaletteApproved: false,
  platformsOutput: '',
  recommendedPlatforms: [],
  platformsApproved: false,
  linkedInOutput: '',
  linkedInApproved: false,
  samplePostsOutput: '',
  samplePostsApproved: false,
  hashtagsOutput: '',
  hashtagsApproved: false,
  outfitPhotoData: [],
  finalEmail: '',
};

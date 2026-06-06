export type OpeningTemplateId =
  | 'calm-academic'
  | 'bold-explainer'
  | 'minimal-whiteboard'
  | 'mood-board'
  | 'dark-cinematic'
  | 'ad-cta-stinger'
  | 'sponsor-bumper';

export type EndingTemplateId =
  | 'simple-credits'
  | 'thank-you'
  | 'next-steps'
  | 'social-follow'
  | 'minimal-roll'
  | 'ad-cta-card'
  | 'sponsor-end-card';

export type TransitionStyle =
  | 'soft-fade'
  | 'cross-dissolve'
  | 'letterbox-reveal'
  | 'whip-pan'
  | 'zoom-through'
  | 'film-burn-flash'
  | 'ad-stinger';

export type BoundaryMode = 'raw' | 'padded' | 'silence-snapped';

export type LayerType = 'caption' | 'text' | 'keyword' | 'card' | 'arrow' | 'lower-third';

export type AnimationPreset = 'none' | 'fade-up' | 'pop' | 'slide-left';

export type SourceVideo = {
  id?: string;
  name?: string;
  src: string;
  duration: number;
  volume: number;
  muted: boolean;
};

export type OpeningScreen = {
  templateId: OpeningTemplateId;
  duration: number;
  enabled: boolean;
  props: {
    title: string;
    subtitle: string;
    mood: string;
    background: string;
  };
};

export type EndingScreen = {
  templateId: EndingTemplateId;
  duration: number;
  enabled: boolean;
  props: {
    title: string;
    subtitle: string;
    credits: string;
    mood: string;
    background: string;
  };
};

export type TimelineTransition = {
  id: string;
  fromClipId: string;
  toClipId: string;
  style: TransitionStyle;
  duration: number;
  enabled: boolean;
};

export type Clip = {
  id: string;
  sourceSrc?: string;
  sourceName?: string;
  rawStart: number;
  rawEnd: number;
  paddedStart?: number;
  paddedEnd?: number;
  safeStart: number;
  safeEnd: number;
  timelineStart?: number;
  boundaryMode?: BoundaryMode;
  volume: number;
  fadeIn: number;
  fadeOut: number;
  thoughtId?: string;
};

export type TimelineLayer = {
  id: string;
  clipId?: string;
  sourceStart?: number;
  sourceEnd?: number;
  segmentIds?: string[];
  type: LayerType;
  start: number;
  end: number;
  text: string;
  x: number;
  y: number;
  scale: number;
  opacity: number;
  rotation: number;
  zIndex: number;
  animation: AnimationPreset;
};

export type MusicVolumePoint = {
  id: string;
  time: number;
  volume: number;
};

export type MusicVolumeMode = 'smooth-gaps' | 'template-gaps' | 'flat-speech-bed';

export type MusicVolumeAutomation = {
  enabled: boolean;
  points: MusicVolumePoint[];
  focusVolume: number;
  backgroundVolume: number;
  rampDuration: number;
  mode?: MusicVolumeMode;
  liftGapThreshold?: number;
};

export type MusicTrack = {
  id: string;
  src: string;
  name: string;
  artist?: string;
  sourceUrl?: string;
  licenseType?: string;
  licenseUrl?: string;
  licenseStatus?: 'confirmed' | 'user-provided' | 'unknown';
  attributionRequired?: boolean;
  attribution?: string;
  style?: string;
  vocal?: 'instrumental' | 'lyrics' | 'either';
  energy?: 'low' | 'medium' | 'high';
  start: number;
  end: number;
  volume: number;
  muted?: boolean;
  fadeIn: number;
  fadeOut: number;
  duckUnderSpeech: boolean;
  volumeAutomation?: MusicVolumeAutomation;
};

export type TimelineProject = {
  projectId: string;
  sourceVideo: SourceVideo | null;
  sourceVideos?: SourceVideo[];
  openingScreen: OpeningScreen;
  endingScreen?: EndingScreen;
  transitions?: TimelineTransition[];
  clips: Clip[];
  layers: TimelineLayer[];
  music: MusicTrack[];
};

export type MusicManifestItem = {
  id: string;
  name: string;
  artist?: string;
  src: string;
  sourceUrl?: string;
  mood: string;
  bpm: number;
  licence: string;
  licenseType?: string;
  licenseUrl?: string;
  licenseStatus?: 'confirmed' | 'user-provided' | 'unknown';
  attributionRequired?: boolean;
  attribution: string;
  style?: string;
  vocal?: 'instrumental' | 'lyrics' | 'either';
  energy?: 'low' | 'medium' | 'high';
  tags?: string[];
};

export type TranscriptSegment = {
  id: string;
  start: number;
  end: number;
  text: string;
  source?: string;
  sourceSrc?: string;
};

export type TranscriptResult = {
  language: string;
  duration: number;
  provider?: string;
  model?: string;
  hardware?: {
    device: 'cuda' | 'cpu';
    computeType: 'float16' | 'int8' | string;
  };
  segments: TranscriptSegment[];
};

export type TranscriptThought = {
  id: string;
  rawStart: number;
  rawEnd: number;
  text: string;
  segmentIds: string[];
  source?: string;
  sourceSrc?: string;
  timelineStart?: number;
  timelineEnd?: number;
};

export type BoundaryRisk = {
  possibleAbruptStart: boolean;
  possibleEarlyEnding: boolean;
  boundaryRisk: boolean;
  startMaxVolumeDb?: number | null;
  endMaxVolumeDb?: number | null;
  notes: string[];
};

export type ClipCandidateVersion = Clip & {
  label: 'Raw Cut' | 'Padded Cut' | 'Silence-Snapped Cut';
  risk: BoundaryRisk;
};

export type ClipCandidate = {
  id: string;
  thought: TranscriptThought;
  versions: ClipCandidateVersion[];
  startsAbruptly?: boolean;
  cutsSpeechEarly?: boolean;
  bestVersionId?: string;
};

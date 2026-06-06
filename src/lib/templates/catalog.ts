import type {EndingTemplateId, OpeningTemplateId} from '@/types/timeline';

export type TemplateCategory = 'interview' | 'opener' | 'subtitle' | 'transition' | 'ending';

export type TemplatePreview = {
  variant: string;
  accent?: string;
  portraitUrl?: string;
  eyebrow?: string;
  title?: string;
  subtitle?: string;
};

export type TemplatePreset = {
  id: string;
  name: string;
  category: TemplateCategory;
  description: string;
  tags: string[];
  timelineJson: Record<string, unknown>;
  openerTemplateId?: OpeningTemplateId;
  endingTemplateId?: EndingTemplateId;
  preview?: TemplatePreview;
};

const portrait = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=900&q=82`;

export const templateCatalog: TemplatePreset[] = [
  {
    id: 'interview-documentary-lower-third',
    name: 'Documentary Lower Third',
    category: 'interview',
    description: 'Quiet talking-head treatment with restrained speaker ID, quote callout, and soft editorial pacing.',
    tags: ['talking-head', 'documentary', 'lower-third'],
    preview: {
      variant: 'documentary',
      accent: '#67e8f9',
      portraitUrl: portrait('photo-1507003211169-0a1dd7228f2d'),
      eyebrow: 'Speaker Name',
      title: 'Key reflection',
      subtitle: 'A calm, premium interview frame.',
    },
    timelineJson: {
      videoType: 'interview',
      opener: 'documentary',
      subtitleStyle: 'premium-documentary',
      transitionStyle: 'soft-fade',
      overlays: ['speaker-lower-third', 'quote-callout', 'subtle-push-in'],
    },
  },
  {
    id: 'interview-social-emphasis',
    name: 'Social Emphasis Clip',
    category: 'interview',
    description: 'Short-form pacing with dynamic zoom hints, top progress bar, and active-word caption emphasis.',
    tags: ['social', 'captions', 'progress'],
    preview: {
      variant: 'social',
      accent: '#facc15',
      portraitUrl: portrait('photo-1494790108377-be9c29b29330'),
      eyebrow: 'Highlight',
      title: 'This moment matters',
      subtitle: 'Punchy captions and motion.',
    },
    timelineJson: {
      videoType: 'interview',
      subtitleStyle: 'social-active-word',
      transitionStyle: 'zoom-through',
      overlays: ['top-progress-bar', 'emphasis-zoom', 'active-word-caption'],
    },
  },
  {
    id: 'interview-podcast-split',
    name: 'Podcast Split Screen',
    category: 'interview',
    description: 'Two-speaker layout with name straps, waveform footer, and clean podcast-style framing.',
    tags: ['podcast', 'split-screen', 'waveform'],
    preview: {
      variant: 'split',
      accent: '#a78bfa',
      portraitUrl: portrait('photo-1535713875002-d1d0cf377fde'),
      eyebrow: 'Episode clip',
      title: 'What changed?',
      subtitle: 'Balanced two-person layout.',
    },
    timelineJson: {
      videoType: 'interview',
      layout: 'podcast-split-screen',
      subtitleStyle: 'premium-documentary',
      overlays: ['speaker-name-straps', 'waveform-footer', 'chapter-marker'],
    },
  },
  {
    id: 'interview-educator-picture-in-picture',
    name: 'Educator Picture-in-Picture',
    category: 'interview',
    description: 'Teacher camera with side content panel, learning objective card, and clean caption safe area.',
    tags: ['education', 'pip', 'teaching'],
    preview: {
      variant: 'pip',
      accent: '#34d399',
      portraitUrl: portrait('photo-1544005313-94ddf0286df2'),
      eyebrow: 'Lesson clip',
      title: 'Key idea',
      subtitle: 'Camera plus visual aid.',
    },
    timelineJson: {
      videoType: 'interview',
      layout: 'educator-pip',
      subtitleStyle: 'classroom-clean',
      overlays: ['learning-objective-card', 'side-note-panel', 'teacher-name'],
    },
  },
  {
    id: 'interview-premium-quote-frame',
    name: 'Premium Quote Frame',
    category: 'interview',
    description: 'Magazine-style interview crop with large animated pull quote and cinematic side label.',
    tags: ['quote', 'premium', 'editorial'],
    preview: {
      variant: 'quote',
      accent: '#fb7185',
      portraitUrl: portrait('photo-1527980965255-d3b416303d12'),
      eyebrow: 'Pull quote',
      title: 'I learned to lead with clarity.',
      subtitle: 'Editorial quote treatment.',
    },
    timelineJson: {
      videoType: 'interview',
      layout: 'premium-quote-frame',
      subtitleStyle: 'documentary-lower-caption',
      overlays: ['animated-pull-quote', 'vertical-speaker-label', 'soft-vignette'],
    },
  },
  {
    id: 'opener-calm-academic',
    name: 'Calm Academic Opener',
    category: 'opener',
    description: 'Soft gradient, slow fade-in, and educational pacing for lesson introductions.',
    tags: ['opener', 'education', 'calm'],
    openerTemplateId: 'calm-academic',
    preview: {variant: 'remotion', title: 'Learning Goals', subtitle: 'Three ideas to watch for'},
    timelineJson: {
      openingScreen: {
        templateId: 'calm-academic',
        duration: 4,
        props: {title: 'Learning Goals', subtitle: 'Three ideas to watch for'},
      },
    },
  },
  {
    id: 'opener-bold-explainer',
    name: 'Bold Explainer Opener',
    category: 'opener',
    description: 'High-contrast title reveal for explainers, recaps, and fast highlight clips.',
    tags: ['opener', 'title', 'education'],
    openerTemplateId: 'bold-explainer',
    preview: {variant: 'remotion', title: 'Topic Title', subtitle: '30-second highlights'},
    timelineJson: {
      openingScreen: {
        templateId: 'bold-explainer',
        duration: 3,
        props: {title: 'Topic Title', subtitle: '30-second highlights'},
      },
    },
  },
  {
    id: 'opener-minimal-whiteboard',
    name: 'Minimal Whiteboard Opener',
    category: 'opener',
    description: 'Clean teaching frame with hand-drawn styling and classroom-friendly motion.',
    tags: ['opener', 'whiteboard', 'teaching'],
    openerTemplateId: 'minimal-whiteboard',
    preview: {variant: 'remotion', title: 'Today we explore', subtitle: 'Question, evidence, conclusion'},
    timelineJson: {
      openingScreen: {
        templateId: 'minimal-whiteboard',
        duration: 4,
        props: {title: 'Today we explore', subtitle: 'Question, evidence, conclusion'},
      },
    },
  },
  {
    id: 'opener-mood-board',
    name: 'Mood Board Opener',
    category: 'opener',
    description: 'Animated collage for concept previews, reflection reels, and event recaps.',
    tags: ['opener', 'collage', 'concept'],
    openerTemplateId: 'mood-board',
    preview: {variant: 'remotion', title: 'What stood out', subtitle: 'Moments, themes, reflections'},
    timelineJson: {
      openingScreen: {
        templateId: 'mood-board',
        duration: 4,
        props: {title: 'What stood out', subtitle: 'Moments, themes, reflections'},
      },
    },
  },
  {
    id: 'opener-dark-cinematic',
    name: 'Dark Cinematic Opener',
    category: 'opener',
    description: 'Slow title reveal with subtle zoom for reflective, dramatic, or documentary intros.',
    tags: ['opener', 'cinematic', 'documentary'],
    openerTemplateId: 'dark-cinematic',
    preview: {variant: 'remotion', title: 'Reflection', subtitle: 'A short documentary moment'},
    timelineJson: {
      openingScreen: {
        templateId: 'dark-cinematic',
        duration: 4,
        props: {title: 'Reflection', subtitle: 'A short documentary moment'},
      },
    },
  },
  {
    id: 'subtitle-classroom-clean',
    name: 'Classroom Clean Captions',
    category: 'subtitle',
    description: 'Readable sentence chunks with conservative fade-up animation for teaching videos.',
    tags: ['captions', 'education', 'readable'],
    preview: {variant: 'classroom', accent: '#67e8f9', title: 'Today we reflect on the key idea.'},
    timelineJson: {
      subtitleStyle: 'classroom-clean',
      maxWordsPerCue: 7,
      animation: 'fade-up',
      safeArea: 'lower-third',
    },
  },
  {
    id: 'subtitle-social-active-word',
    name: 'Social Active Word',
    category: 'subtitle',
    description: 'Word-highlight caption style for reels, shorts, and fast highlight edits.',
    tags: ['captions', 'social', 'active-word'],
    preview: {variant: 'active-word', accent: '#facc15', title: 'Today we learn something new'},
    timelineJson: {
      subtitleStyle: 'social-active-word',
      maxWordsPerCue: 3,
      activeWordHighlight: true,
      animation: 'pop',
    },
  },
  {
    id: 'subtitle-karaoke-highlight',
    name: 'Karaoke Highlight',
    category: 'subtitle',
    description: 'Left-to-right spoken-word fill for music-backed social clips and energetic recaps.',
    tags: ['captions', 'karaoke', 'highlight'],
    preview: {variant: 'karaoke', accent: '#34d399', title: 'Every word lands with rhythm'},
    timelineJson: {
      subtitleStyle: 'karaoke-highlight',
      maxWordsPerCue: 5,
      activeWordHighlight: true,
      fillAnimation: 'left-to-right',
    },
  },
  {
    id: 'subtitle-typewriter-note',
    name: 'Typewriter Note',
    category: 'subtitle',
    description: 'Typed caption card for reflective notes, explainers, and handwritten lesson moments.',
    tags: ['captions', 'typewriter', 'reflective'],
    preview: {variant: 'typewriter', accent: '#f8fafc', title: 'A useful way to remember this...'},
    timelineJson: {
      subtitleStyle: 'typewriter-note',
      maxWordsPerCue: 9,
      animation: 'typewriter',
      background: 'paper-card',
    },
  },
  {
    id: 'subtitle-neon-pop',
    name: 'Neon Pop Captions',
    category: 'subtitle',
    description: 'High-energy glow captions for TikTok-style clips, reactions, and punchy quotes.',
    tags: ['captions', 'neon', 'social'],
    preview: {variant: 'neon', accent: '#f472b6', title: 'This changed everything'},
    timelineJson: {
      subtitleStyle: 'neon-pop',
      maxWordsPerCue: 4,
      animation: 'bounce-glow',
      stroke: true,
    },
  },
  {
    id: 'transition-soft-fade',
    name: 'Soft Fade',
    category: 'transition',
    description: 'Clean opacity fade for interview cuts, classroom content, and gentle section changes.',
    tags: ['transition', 'fade', 'simple'],
    preview: {variant: 'soft-fade', accent: '#fb7185'},
    timelineJson: {
      transitionStyle: 'soft-fade',
      duration: 0.35,
      appliesTo: ['clip-boundaries', 'overlays'],
    },
  },
  {
    id: 'transition-letterbox-reveal',
    name: 'Letterbox Reveal',
    category: 'transition',
    description: 'Cinematic matte reveal for title cards, trailers, and reflective documentary sections.',
    tags: ['transition', 'cinematic', 'opener'],
    preview: {variant: 'letterbox', accent: '#fbbf24'},
    timelineJson: {
      transitionStyle: 'letterbox-reveal',
      duration: 0.7,
      easing: 'ease-out-cubic',
    },
  },
  {
    id: 'transition-whip-pan',
    name: 'Whip Pan',
    category: 'transition',
    description: 'Fast lateral motion blur for energetic social cuts and event recaps.',
    tags: ['transition', 'motion', 'social'],
    preview: {variant: 'whip-pan', accent: '#38bdf8'},
    timelineJson: {
      transitionStyle: 'whip-pan',
      duration: 0.42,
      motionBlur: true,
      direction: 'left',
    },
  },
  {
    id: 'transition-zoom-through',
    name: 'Zoom Through',
    category: 'transition',
    description: 'Push through the subject into the next scene for punchy explainers and reels.',
    tags: ['transition', 'zoom', 'reels'],
    preview: {variant: 'zoom-through', accent: '#a78bfa'},
    timelineJson: {
      transitionStyle: 'zoom-through',
      duration: 0.48,
      scaleFrom: 1,
      scaleTo: 1.32,
    },
  },
  {
    id: 'transition-film-burn',
    name: 'Film Burn Flash',
    category: 'transition',
    description: 'Warm flash transition for trailer beats, memory sequences, and event highlight reels.',
    tags: ['transition', 'film-burn', 'trailer'],
    preview: {variant: 'film-burn', accent: '#fb923c'},
    timelineJson: {
      transitionStyle: 'film-burn-flash',
      duration: 0.55,
      grain: true,
      flashColor: '#fb923c',
    },
  },
  {
    id: 'ending-thank-you',
    name: 'Warm Thank You',
    category: 'ending',
    description: 'Friendly closing card for student reflections, classroom recaps, and short social edits.',
    tags: ['ending', 'thank-you', 'social'],
    endingTemplateId: 'thank-you',
    preview: {variant: 'remotion-ending', title: 'Thank you', subtitle: 'Home Run reflections'},
    timelineJson: {
      endingScreen: {
        templateId: 'thank-you',
        duration: 3,
        enabled: true,
        props: {title: 'Thank you', subtitle: 'Home Run reflections', credits: 'Edited with Codex'},
      },
    },
  },
  {
    id: 'ending-simple-credits',
    name: 'Simple Credits',
    category: 'ending',
    description: 'Clean attribution and credit roll for public videos that need visible licensing notes.',
    tags: ['ending', 'credits', 'attribution'],
    endingTemplateId: 'simple-credits',
    preview: {variant: 'remotion-ending', title: 'Credits', subtitle: 'Music and editing'},
    timelineJson: {
      endingScreen: {
        templateId: 'simple-credits',
        duration: 4,
        enabled: true,
        props: {title: 'Credits', subtitle: 'Music and editing', credits: 'Music: Artist, Edit: Codex'},
      },
    },
  },
  {
    id: 'ending-next-steps',
    name: 'Next Steps Wrap-Up',
    category: 'ending',
    description: 'Educational closing screen for reflection prompts, follow-up tasks, or lesson conclusions.',
    tags: ['ending', 'education', 'cta'],
    endingTemplateId: 'next-steps',
    preview: {variant: 'remotion-ending', title: 'Keep reflecting', subtitle: 'What will you remember?'},
    timelineJson: {
      endingScreen: {
        templateId: 'next-steps',
        duration: 4,
        enabled: true,
        props: {title: 'Keep reflecting', subtitle: 'What will you remember?', credits: 'Reflect, Share, Try again'},
      },
    },
  },
  {
    id: 'ending-social-follow',
    name: 'Social Follow Card',
    category: 'ending',
    description: 'Clean follow/handle layout suited for Pinterest, Reels, Shorts, and school social channels.',
    tags: ['ending', 'social', 'pinterest'],
    endingTemplateId: 'social-follow',
    preview: {variant: 'remotion-ending', title: 'More reflections', subtitle: 'Follow for the next story'},
    timelineJson: {
      endingScreen: {
        templateId: 'social-follow',
        duration: 3,
        enabled: true,
        props: {title: 'More reflections', subtitle: 'Follow for the next story', credits: '@schoolchannel'},
      },
    },
  },
  {
    id: 'ending-minimal-roll',
    name: 'Minimal Credit Roll',
    category: 'ending',
    description: 'Quiet documentary-style ending for reflective interviews and premium education clips.',
    tags: ['ending', 'documentary', 'minimal'],
    endingTemplateId: 'minimal-roll',
    preview: {variant: 'remotion-ending', title: 'End of reflection', subtitle: 'Thank you for watching'},
    timelineJson: {
      endingScreen: {
        templateId: 'minimal-roll',
        duration: 5,
        enabled: true,
        props: {title: 'End of reflection', subtitle: 'Thank you for watching', credits: 'Produced with Codex'},
      },
    },
  },
];

export const templateCategories: Array<{id: TemplateCategory; label: string}> = [
  {id: 'interview', label: 'Interview'},
  {id: 'opener', label: 'Openers'},
  {id: 'subtitle', label: 'Subtitles'},
  {id: 'transition', label: 'Transitions'},
  {id: 'ending', label: 'Endings'},
];

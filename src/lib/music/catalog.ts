export type MusicSourceCard = {
  id: string;
  name: string;
  url: string;
  licenseFamily: string;
  bestFor: string;
  licenseNote: string;
  caution: string;
  searchIdeas: string[];
};

export type MusicBriefGuide = {
  id: string;
  title: string;
  tone: string;
  useWhen: string;
  searchPrompt: string;
  preferredSources: string[];
  vocal: 'instrumental' | 'lyrics' | 'either';
  energy: 'low' | 'medium' | 'high';
  bpmRange: string;
  defaultVolume: number;
  duckUnderSpeech: boolean;
  creditsHint: string;
  sampleTrackId: string;
};

export const musicSourceCards: MusicSourceCard[] = [
  {
    id: 'dig-ccmixter',
    name: 'dig.ccMixter',
    url: 'https://dig.ccmixter.org/',
    licenseFamily: 'Creative Commons',
    bestFor: 'Indie songs, vocals, remixes, creator music, upbeat social clips.',
    licenseNote: 'Creative Commons tracks. Many require attribution; some are cleared for commercial projects.',
    caution: 'Check the exact track license. Avoid NC tracks for commercial/public tool demos.',
    searchIdeas: ['upbeat vocals', 'indie pop', 'funky education recap', 'positive remix'],
  },
  {
    id: 'free-music-archive',
    name: 'Free Music Archive',
    url: 'https://freemusicarchive.org/',
    licenseFamily: 'Creative Commons / varies by track',
    bestFor: 'Genre browsing, indie, electronic, lo-fi, ambient, experimental, songs with lyrics.',
    licenseNote: 'Track licenses vary. Use the track page as the source of truth.',
    caution: 'Some CC licenses restrict commercial use or derivatives. Confirm before importing.',
    searchIdeas: ['lo-fi study', 'upbeat electronic', 'warm documentary', 'indie vocal'],
  },
  {
    id: 'openverse-audio',
    name: 'Openverse Audio',
    url: 'https://openverse.org/audio',
    licenseFamily: 'Creative Commons / public domain search',
    bestFor: 'Broad discovery across open audio collections when the user does not know where to start.',
    licenseNote: 'Indexes Creative Commons and public-domain audio from many sources.',
    caution: 'Always click through and verify the original source page before downloading.',
    searchIdeas: ['happy background music', 'creative commons lofi', 'public domain beat', 'upbeat instrumental'],
  },
  {
    id: 'incompetech',
    name: 'Incompetech',
    url: 'https://incompetech.com/music/royalty-free/music.html',
    licenseFamily: 'CC BY / paid no-attribution option',
    bestFor: 'Reliable background beds, education-safe instrumentals, corporate, comedy, cinematic cues.',
    licenseNote: 'Many tracks are available with Creative Commons attribution text.',
    caution: 'Use the exact attribution generated for the selected track.',
    searchIdeas: ['bright educational', 'quirky explainer', 'corporate upbeat', 'cinematic soft'],
  },
  {
    id: 'moonpurr',
    name: 'MoonPurr',
    url: 'https://www.moonpurr.com/',
    licenseFamily: 'CC BY 4.0 / optional paid license',
    bestFor: 'Modern creator-friendly instrumentals, upbeat background music, soft electronic.',
    licenseNote: 'Free with attribution under CC BY 4.0, with optional licensing if credit is not possible.',
    caution: 'Copy the attribution shown on the track page.',
    searchIdeas: ['upbeat creator', 'soft electronic', 'positive background', 'modern lofi'],
  },
  {
    id: 'anvil-island',
    name: 'Anvil Island Music House',
    url: 'https://www.anvilislandmusic.com/',
    licenseFamily: 'Creative Commons Attribution',
    bestFor: 'Straightforward CC attribution music for films, podcasts, games, and education clips.',
    licenseNote: 'Creative Commons Attribution license is positioned for broad reuse, including commercial reuse.',
    caution: 'Still keep the source URL and attribution in the project JSON.',
    searchIdeas: ['cinematic indie', 'warm background', 'creator soundtrack', 'reflective cue'],
  },
  {
    id: 'youtube-audio-library',
    name: 'YouTube Audio Library',
    url: 'https://www.youtube.com/audiolibrary',
    licenseFamily: 'YouTube Audio Library / Creative Commons filters',
    bestFor: 'YouTube-first videos, quick safe background music, sound effects.',
    licenseNote: 'Official YouTube Studio source. Preview tracks there, download MP3s there, and copy attribution when required.',
    caution: 'Manual import only. Do not scrape or rip from ordinary YouTube videos; keep title, artist, license, and attribution metadata.',
    searchIdeas: ['bright mood', 'happy genre', 'modern upbeat', 'lo-fi instrumental', 'attribution not required'],
  },
  {
    id: 'bensound',
    name: 'Bensound',
    url: 'https://www.bensound.com/free-music-for-videos',
    licenseFamily: 'Free with attribution / paid licenses',
    bestFor: 'Polished creator tracks, corporate, upbeat, cinematic, promo-style videos.',
    licenseNote: 'Free-with-attribution tracks exist in the free music section.',
    caution: 'Not an open-source catalog. Use only when the project fits the free license terms or a paid license is provided.',
    searchIdeas: ['corporate upbeat', 'cinematic trailer', 'positive vlog', 'acoustic warm'],
  },
];

export const musicBriefGuides: MusicBriefGuide[] = [
  {
    id: 'upbeat-shortform',
    title: 'Upbeat Short-Form',
    tone: 'bright, energetic, creator-friendly',
    useWhen: 'A 20-45 second highlights video needs momentum without drowning speech.',
    searchPrompt: 'upbeat instrumental creator music, 90-120 bpm, positive, no heavy vocals',
    preferredSources: ['youtube-audio-library', 'moonpurr', 'dig-ccmixter', 'free-music-archive'],
    vocal: 'instrumental',
    energy: 'high',
    bpmRange: '90-120',
    defaultVolume: 0.22,
    duckUnderSpeech: true,
    creditsHint: 'Use concise attribution in the video description or ending credits.',
    sampleTrackId: 'moonpurr-paper-airplane-parade',
  },
  {
    id: 'lofi-study',
    title: 'Lo-Fi Study Beat',
    tone: 'warm, steady, relaxed',
    useWhen: 'Education/reflection clips need calm background energy that does not compete with narration.',
    searchPrompt: 'lo-fi study beat, warm, mellow, 70-90 bpm, instrumental',
    preferredSources: ['youtube-audio-library', 'free-music-archive', 'openverse-audio', 'moonpurr'],
    vocal: 'instrumental',
    energy: 'medium',
    bpmRange: '70-90',
    defaultVolume: 0.18,
    duckUnderSpeech: true,
    creditsHint: 'Prefer CC BY or CC0 tracks and keep attribution in timeline JSON.',
    sampleTrackId: 'moonpurr-morning-pancakes',
  },
  {
    id: 'gen-z-pop',
    title: 'Gen Z Pop Energy',
    tone: 'playful, current, optimistic',
    useWhen: 'Social clips need a fresh feel, but the speech still matters.',
    searchPrompt: 'upbeat indie pop instrumental, playful, clap beat, 100-130 bpm',
    preferredSources: ['youtube-audio-library', 'moonpurr', 'dig-ccmixter', 'free-music-archive', 'bensound'],
    vocal: 'either',
    energy: 'high',
    bpmRange: '100-130',
    defaultVolume: 0.2,
    duckUnderSpeech: true,
    creditsHint: 'If using vocals, check that the license covers the final platform.',
    sampleTrackId: 'moonpurr-bubble-train',
  },
  {
    id: 'documentary-warm',
    title: 'Warm Documentary',
    tone: 'reflective, human, polished',
    useWhen: 'Interview or student reflection edits need emotional support, not hype.',
    searchPrompt: 'warm documentary background, soft piano, ambient guitar, 60-85 bpm',
    preferredSources: ['youtube-audio-library', 'moonpurr', 'anvil-island', 'openverse-audio'],
    vocal: 'instrumental',
    energy: 'low',
    bpmRange: '60-85',
    defaultVolume: 0.16,
    duckUnderSpeech: true,
    creditsHint: 'Ending-screen credits work well for reflective videos.',
    sampleTrackId: 'moonpurr-morning-pancakes',
  },
  {
    id: 'cinematic-opener',
    title: 'Cinematic Opener',
    tone: 'dramatic, premium, trailer-like',
    useWhen: 'The opener or end card needs a lift, but the main clip remains speech-led.',
    searchPrompt: 'cinematic intro cue, short trailer, soft rise, no drums overpowering speech',
    preferredSources: ['youtube-audio-library', 'bensound', 'free-music-archive', 'incompetech'],
    vocal: 'instrumental',
    energy: 'medium',
    bpmRange: '70-110',
    defaultVolume: 0.24,
    duckUnderSpeech: true,
    creditsHint: 'Use the music fade-out before or inside the ending screen.',
    sampleTrackId: 'moonpurr-system-override',
  },
  {
    id: 'retro-playful',
    title: 'Retro Playful',
    tone: 'light, fun, game-like',
    useWhen: 'A casual recap or youth-facing video needs charm without becoming too corporate.',
    searchPrompt: 'retro 8-bit playful background, positive, short loop, instrumental',
    preferredSources: ['youtube-audio-library', 'openverse-audio', 'free-music-archive', 'dig-ccmixter'],
    vocal: 'instrumental',
    energy: 'medium',
    bpmRange: '85-120',
    defaultVolume: 0.2,
    duckUnderSpeech: true,
    creditsHint: 'Keep the track title and source URL with the project for future export credits.',
    sampleTrackId: 'moonpurr-jellybeans-dancing',
  },
];

export const sourceName = (id: string) => musicSourceCards.find((source) => source.id === id)?.name ?? id;

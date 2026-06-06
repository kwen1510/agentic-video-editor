import React from 'react';
import {AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import type {EndingTemplateId, OpeningTemplateId} from '@/types/timeline';

export const openingTemplateOptions: Array<{
  id: OpeningTemplateId;
  name: string;
  description: string;
}> = [
  {
    id: 'calm-academic',
    name: 'Calm Academic',
    description: 'Soft gradient, slow fade-in, educational pacing.',
  },
  {
    id: 'bold-explainer',
    name: 'Bold Explainer',
    description: 'High-contrast title and animated underline.',
  },
  {
    id: 'minimal-whiteboard',
    name: 'Minimal Whiteboard',
    description: 'Clean white teaching frame with simple doodles.',
  },
  {
    id: 'mood-board',
    name: 'Mood Board',
    description: 'Animated grid for concept previews.',
  },
  {
    id: 'dark-cinematic',
    name: 'Dark Cinematic',
    description: 'Subtle zoom and centered title for dramatic intros.',
  },
];

export const endingTemplateOptions: Array<{
  id: EndingTemplateId;
  name: string;
  description: string;
}> = [
  {
    id: 'simple-credits',
    name: 'Simple Credits',
    description: 'Clean credit roll with title, subtitle, and attribution.',
  },
  {
    id: 'thank-you',
    name: 'Thank You',
    description: 'Warm closing card with a confident title reveal.',
  },
  {
    id: 'next-steps',
    name: 'Next Steps',
    description: 'Practical wrap-up with a short call to action.',
  },
  {
    id: 'social-follow',
    name: 'Social Follow',
    description: 'Pinterest/social-friendly ending card with handle-style layout.',
  },
  {
    id: 'minimal-roll',
    name: 'Minimal Roll',
    description: 'Quiet documentary ending with restrained moving credits.',
  },
];

type OpeningTemplateProps = {
  templateId: OpeningTemplateId;
  title: string;
  subtitle: string;
  mood?: string;
  background?: string;
};

type EndingTemplateProps = {
  templateId: EndingTemplateId;
  title: string;
  subtitle: string;
  credits: string;
  mood?: string;
  background?: string;
};

const easeIn = (frame: number, end = 35) =>
  interpolate(frame, [0, end], [0.14, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

const titleBase: React.CSSProperties = {
  fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
  letterSpacing: 0,
};

const CalmAcademic: React.FC<OpeningTemplateProps> = ({title, subtitle}) => {
  const frame = useCurrentFrame();
  const opacity = easeIn(frame, 50);
  const y = interpolate(frame, [0, 50], [26, 0], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        background:
          'linear-gradient(135deg, #e8f1ef 0%, #b6d7ce 44%, #f5efe4 100%)',
        justifyContent: 'center',
        padding: 96,
      }}
    >
      <div
        style={{
          ...titleBase,
          opacity,
          transform: `translateY(${y}px)`,
          color: '#18342d',
        }}
      >
        <div style={{fontSize: 38, fontWeight: 800, textTransform: 'uppercase'}}>Lesson preview</div>
        <div style={{fontSize: 106, lineHeight: 1, fontWeight: 900, maxWidth: 900, marginTop: 30}}>
          {title}
        </div>
        <div style={{fontSize: 46, lineHeight: 1.18, fontWeight: 700, marginTop: 30, color: '#315f55'}}>
          {subtitle}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const BoldExplainer: React.FC<OpeningTemplateProps> = ({title, subtitle}) => {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [0, 24], [0.72, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const underline = interpolate(frame, [0, 52], [0.18, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{background: '#101418', padding: 88, justifyContent: 'center'}}>
      <div
        style={{
          ...titleBase,
          transform: `translateX(${interpolate(progress, [0.72, 1], [-18, 0])}px)`,
          opacity: progress,
          color: '#f8fafc',
        }}
      >
        <div style={{fontSize: 44, fontWeight: 900, color: '#f7cf4c', textTransform: 'uppercase'}}>
          Event highlights
        </div>
        <div style={{fontSize: 116, lineHeight: 0.95, fontWeight: 950, maxWidth: 900, marginTop: 26}}>
          {title}
        </div>
        <div style={{height: 16, width: 580, background: '#f7cf4c', marginTop: 34, transform: `scaleX(${underline})`, transformOrigin: 'left'}} />
        <div style={{fontSize: 42, lineHeight: 1.18, fontWeight: 750, marginTop: 28, color: '#d7dee7'}}>
          {subtitle}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const MinimalWhiteboard: React.FC<OpeningTemplateProps> = ({title, subtitle}) => {
  const frame = useCurrentFrame();
  const opacity = easeIn(frame, 42);
  return (
    <AbsoluteFill style={{background: '#fbfaf5', padding: 92, justifyContent: 'center'}}>
      <div
        style={{
          position: 'absolute',
          inset: 56,
          border: '5px solid #1f2937',
          borderRadius: 18,
          opacity: 0.85,
        }}
      />
      <div style={{position: 'absolute', top: 170, right: 150, fontSize: 74, transform: 'rotate(11deg)'}}>+</div>
      <div style={{position: 'absolute', bottom: 250, left: 145, fontSize: 66, transform: 'rotate(-9deg)'}}>?</div>
      <div style={{...titleBase, opacity, color: '#18212f', textAlign: 'center'}}>
        <div style={{fontSize: 98, lineHeight: 1.02, fontWeight: 900, fontFamily: 'Comic Sans MS, Chalkboard SE, ui-sans-serif'}}>
          {title}
        </div>
        <div style={{fontSize: 42, lineHeight: 1.22, marginTop: 32, fontWeight: 700, color: '#54606f'}}>
          {subtitle}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const MoodBoard: React.FC<OpeningTemplateProps> = ({title, subtitle}) => {
  const frame = useCurrentFrame();
  const tiles = ['Concept', 'Example', 'Practice', 'Reflect', 'Apply', 'Review'];
  return (
    <AbsoluteFill style={{background: '#eef2f5', padding: 58}}>
      <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 22, height: '100%'}}>
        {tiles.map((tile, index) => {
          const opacity = interpolate(frame, [index * 6, index * 6 + 24], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          return (
            <div
              key={tile}
              style={{
                background: index % 2 === 0 ? '#193b3a' : '#fff6d9',
                color: index % 2 === 0 ? '#ecfeff' : '#25312d',
                borderRadius: 8,
                padding: 34,
                opacity,
                display: 'flex',
                alignItems: 'flex-end',
                fontFamily: 'Inter, ui-sans-serif',
                fontSize: 38,
                fontWeight: 900,
              }}
            >
              {tile}
            </div>
          );
        })}
      </div>
      <div
        style={{
          ...titleBase,
          position: 'absolute',
          left: 92,
          right: 92,
          top: 660,
          color: '#0f172a',
          textAlign: 'center',
          textShadow: '0 4px 20px rgba(238,242,245,0.95)',
        }}
      >
        <div style={{fontSize: 96, lineHeight: 1, fontWeight: 950}}>{title}</div>
        <div style={{fontSize: 40, lineHeight: 1.2, marginTop: 28, fontWeight: 780}}>{subtitle}</div>
      </div>
    </AbsoluteFill>
  );
};

const DarkCinematic: React.FC<OpeningTemplateProps> = ({title, subtitle}) => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const zoom = interpolate(frame, [0, durationInFrames], [1, 1.08], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const opacity = easeIn(frame, 55);

  return (
    <AbsoluteFill style={{background: '#090a0d', overflow: 'hidden'}}>
      <AbsoluteFill
        style={{
          transform: `scale(${zoom})`,
          background:
            'radial-gradient(circle at 50% 38%, rgba(84, 109, 148, 0.42), transparent 34%), linear-gradient(180deg, #090a0d 0%, #161a22 100%)',
        }}
      />
      <div
        style={{
          ...titleBase,
          opacity,
          color: '#f8fafc',
          textAlign: 'center',
          margin: 'auto',
          width: '84%',
        }}
      >
        <div style={{fontSize: 96, lineHeight: 1, fontWeight: 900}}>{title}</div>
        <div style={{fontSize: 38, lineHeight: 1.22, marginTop: 28, fontWeight: 680, color: '#b8c1ce'}}>
          {subtitle}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const OpeningTemplateComposition: React.FC<OpeningTemplateProps> = (props) => {
  switch (props.templateId) {
    case 'bold-explainer':
      return <BoldExplainer {...props} />;
    case 'minimal-whiteboard':
      return <MinimalWhiteboard {...props} />;
    case 'mood-board':
      return <MoodBoard {...props} />;
    case 'dark-cinematic':
      return <DarkCinematic {...props} />;
    case 'calm-academic':
    default:
      return <CalmAcademic {...props} />;
  }
};

const splitCredits = (credits: string) =>
  credits
    .split(/\n|,/)
    .map((line) => line.trim())
    .filter(Boolean);

const SimpleCredits: React.FC<EndingTemplateProps> = ({title, subtitle, credits}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 34], [0.72, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const lines = splitCredits(credits);
  const y = interpolate(frame, [0, 90], [32, -18], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{background: '#f8fafc', padding: 92, justifyContent: 'center'}}>
      <div style={{...titleBase, color: '#111827', opacity, transform: `translateY(${y}px)`}}>
        <div style={{fontSize: 88, lineHeight: 1, fontWeight: 950}}>{title}</div>
        <div style={{fontSize: 38, lineHeight: 1.25, marginTop: 24, fontWeight: 720, color: '#475569'}}>{subtitle}</div>
        <div style={{marginTop: 54, display: 'grid', gap: 16}}>
          {lines.slice(0, 5).map((line) => (
            <div key={line} style={{fontSize: 28, fontWeight: 760, color: '#334155'}}>
              {line}
            </div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const ThankYou: React.FC<EndingTemplateProps> = ({title, subtitle, credits}) => {
  const frame = useCurrentFrame();
  const scale = interpolate(frame, [0, 36], [0.94, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const opacity = interpolate(frame, [0, 30], [0.78, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        background: 'linear-gradient(145deg, #101418 0%, #163a44 54%, #facc15 160%)',
        padding: 84,
        justifyContent: 'center',
      }}
    >
      <div style={{...titleBase, color: '#f8fafc', opacity, transform: `scale(${scale})`}}>
        <div style={{fontSize: 110, lineHeight: 0.94, fontWeight: 950, maxWidth: 820}}>{title}</div>
        <div style={{height: 12, width: 260, background: '#67e8f9', marginTop: 34}} />
        <div style={{fontSize: 38, lineHeight: 1.25, marginTop: 34, fontWeight: 760, color: '#cbd5e1'}}>
          {subtitle}
        </div>
        <div style={{fontSize: 24, marginTop: 56, fontWeight: 700, color: '#fde68a'}}>{credits}</div>
      </div>
    </AbsoluteFill>
  );
};

const NextSteps: React.FC<EndingTemplateProps> = ({title, subtitle, credits}) => {
  const frame = useCurrentFrame();
  const steps = splitCredits(credits).slice(0, 3);

  return (
    <AbsoluteFill style={{background: '#eef7f4', padding: 76, justifyContent: 'center'}}>
      <div style={{...titleBase, color: '#12312b'}}>
        <div style={{fontSize: 42, fontWeight: 900, textTransform: 'uppercase', color: '#0f766e'}}>Next steps</div>
        <div style={{fontSize: 94, lineHeight: 0.98, fontWeight: 950, marginTop: 26}}>{title}</div>
        <div style={{fontSize: 36, lineHeight: 1.24, fontWeight: 720, marginTop: 28, color: '#315f55'}}>{subtitle}</div>
        <div style={{display: 'grid', gap: 18, marginTop: 58}}>
          {(steps.length ? steps : ['Reflect', 'Share', 'Keep going']).map((step, index) => {
            const x = interpolate(frame, [index * 8, index * 8 + 26], [34, 0], {
              easing: Easing.out(Easing.cubic),
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });
            const opacity = interpolate(frame, [index * 8, index * 8 + 26], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });
            return (
              <div
                key={step}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 20,
                  transform: `translateX(${x}px)`,
                  opacity,
                  fontSize: 32,
                  fontWeight: 860,
                }}
              >
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 48,
                    height: 48,
                    borderRadius: 999,
                    background: '#12312b',
                    color: '#ccfbf1',
                    fontSize: 24,
                  }}
                >
                  {index + 1}
                </span>
                {step}
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const SocialFollow: React.FC<EndingTemplateProps> = ({title, subtitle, credits}) => {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [0, 70], [0.12, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{background: '#0b1020', padding: 72, justifyContent: 'center', overflow: 'hidden'}}>
      <div
        style={{
          position: 'absolute',
          inset: 74,
          border: '4px solid rgba(103,232,249,0.55)',
          transform: `scale(${0.92 + progress * 0.08})`,
        }}
      />
      <div style={{...titleBase, color: '#f8fafc', textAlign: 'center', margin: 'auto', width: '88%'}}>
        <div style={{fontSize: 100, lineHeight: 0.94, fontWeight: 950}}>{title}</div>
        <div style={{fontSize: 36, lineHeight: 1.22, marginTop: 30, fontWeight: 760, color: '#cbd5e1'}}>{subtitle}</div>
        <div
          style={{
            display: 'inline-flex',
            marginTop: 58,
            padding: '18px 28px',
            background: '#67e8f9',
            color: '#0f172a',
            fontSize: 28,
            fontWeight: 900,
          }}
        >
          {credits}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const MinimalRoll: React.FC<EndingTemplateProps> = ({title, subtitle, credits}) => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const y = interpolate(frame, [0, durationInFrames], [110, -120], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{background: '#08090c', padding: 90, justifyContent: 'center'}}>
      <div style={{...titleBase, color: '#f8fafc', textAlign: 'center', transform: `translateY(${y}px)`}}>
        <div style={{fontSize: 76, lineHeight: 1, fontWeight: 900}}>{title}</div>
        <div style={{fontSize: 30, lineHeight: 1.25, marginTop: 26, fontWeight: 660, color: '#94a3b8'}}>{subtitle}</div>
        <div style={{height: 2, width: 240, margin: '48px auto', background: '#475569'}} />
        {splitCredits(credits).slice(0, 6).map((line) => (
          <div key={line} style={{fontSize: 26, lineHeight: 1.5, fontWeight: 680, color: '#cbd5e1'}}>
            {line}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

export const EndingTemplateComposition: React.FC<EndingTemplateProps> = (props) => {
  switch (props.templateId) {
    case 'simple-credits':
      return <SimpleCredits {...props} />;
    case 'next-steps':
      return <NextSteps {...props} />;
    case 'social-follow':
      return <SocialFollow {...props} />;
    case 'minimal-roll':
      return <MinimalRoll {...props} />;
    case 'thank-you':
    default:
      return <ThankYou {...props} />;
  }
};

'use client';

import React, {useMemo, useState} from 'react';
import Link from 'next/link';
import {Player} from '@remotion/player';
import {ArrowLeft, Captions, Clapperboard, Copy, Film, Scissors, Sparkles} from 'lucide-react';
import {EndingTemplateComposition, OpeningTemplateComposition} from '@/components/remotion/OpeningTemplates';
import {templateCatalog, templateCategories, type TemplateCategory, type TemplatePreset} from '@/lib/templates/catalog';

const categoryIcon: Record<TemplateCategory, React.ComponentType<{size?: number; className?: string}>> = {
  interview: Film,
  opener: Clapperboard,
  cta: Sparkles,
  subtitle: Captions,
  transition: Scissors,
  ending: Sparkles,
};

const categoryStyle: Record<TemplateCategory, string> = {
  interview: 'border-cyan-400/30 bg-cyan-400/10 text-cyan-100',
  opener: 'border-amber-300/30 bg-amber-300/10 text-amber-100',
  cta: 'border-fuchsia-300/30 bg-fuchsia-300/10 text-fuchsia-100',
  subtitle: 'border-emerald-300/30 bg-emerald-300/10 text-emerald-100',
  transition: 'border-rose-300/30 bg-rose-300/10 text-rose-100',
  ending: 'border-teal-300/30 bg-teal-300/10 text-teal-100',
};

const copyPreset = async (preset: TemplatePreset) => {
  await navigator.clipboard?.writeText(JSON.stringify(preset.timelineJson, null, 2));
};

const previewAccent = (preset: TemplatePreset) => preset.preview?.accent ?? '#67e8f9';

const portraitStyle = (preset: TemplatePreset, extra?: React.CSSProperties): React.CSSProperties => ({
  backgroundImage: `linear-gradient(180deg, rgba(15,23,42,0.04), rgba(15,23,42,0.28)), url(${preset.preview?.portraitUrl ?? ''})`,
  backgroundPosition: 'center',
  backgroundSize: 'cover',
  ...extra,
});

const InterviewPreview: React.FC<{preset: TemplatePreset}> = ({preset}) => {
  const accent = previewAccent(preset);
  const variant = preset.preview?.variant;

  if (variant === 'split') {
    return (
      <div className="relative h-full overflow-hidden bg-[#111827] p-5">
        <div className="grid h-full grid-cols-2 gap-3">
          <div className="relative overflow-hidden rounded" style={portraitStyle(preset)}>
            <div className="absolute bottom-3 left-3 rounded bg-black/75 px-3 py-2">
              <div className="text-[9px] font-black uppercase" style={{color: accent}}>Host</div>
              <div className="text-sm font-black text-white">Main point</div>
            </div>
          </div>
          <div className="relative overflow-hidden rounded bg-slate-800">
            <div className="absolute inset-0 opacity-90" style={portraitStyle(preset, {filter: 'hue-rotate(28deg)', transform: 'scaleX(-1)'})} />
            <div className="absolute bottom-3 left-3 rounded bg-black/75 px-3 py-2">
              <div className="text-[9px] font-black uppercase" style={{color: accent}}>Guest</div>
              <div className="text-sm font-black text-white">Response</div>
            </div>
          </div>
        </div>
        <div className="absolute inset-x-8 bottom-5 h-1.5 overflow-hidden rounded bg-white/10">
          <div className="template-pulse-track h-full rounded" style={{background: accent}} />
        </div>
      </div>
    );
  }

  if (variant === 'pip') {
    return (
      <div className="relative h-full overflow-hidden bg-[#e9f7f1] p-5 text-slate-950">
        <div className="absolute left-6 top-6 w-52 rounded bg-white/90 p-4 shadow-xl">
          <div className="text-[10px] font-black uppercase text-emerald-700">Learning objective</div>
          <div className="mt-2 text-lg font-black leading-tight">Connect the example to the key idea.</div>
        </div>
        <div className="absolute bottom-6 right-7 h-40 w-32 overflow-hidden rounded border-4 border-white shadow-2xl" style={portraitStyle(preset)} />
        <div className="absolute bottom-7 left-6 rounded bg-slate-950 px-4 py-3 text-white">
          <div className="text-[10px] font-black uppercase" style={{color: accent}}>Teacher cam</div>
          <div className="text-sm font-black">{preset.preview?.title}</div>
        </div>
      </div>
    );
  }

  if (variant === 'quote') {
    return (
      <div className="relative h-full overflow-hidden bg-[#101014]">
        <div className="absolute inset-y-0 right-0 w-1/2 opacity-85" style={portraitStyle(preset)} />
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-transparent" />
        <div className="absolute left-7 top-8 max-w-[58%]">
          <div className="text-[10px] font-black uppercase tracking-normal" style={{color: accent}}>{preset.preview?.eyebrow}</div>
          <div className="template-quote-pop mt-3 text-3xl font-black leading-[0.95] text-white">{preset.preview?.title}</div>
          <div className="mt-4 h-1 w-28 rounded" style={{background: accent}} />
        </div>
      </div>
    );
  }

  if (variant === 'social') {
    return (
      <div className="relative h-full overflow-hidden bg-[#151b24]">
        <div className="absolute inset-0 scale-110 opacity-75" style={portraitStyle(preset)} />
        <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/5 to-black/65" />
        <div className="absolute left-6 right-6 top-5 h-1.5 rounded bg-white/20">
          <div className="template-progress h-full rounded" style={{background: accent}} />
        </div>
        <div className="absolute bottom-7 left-1/2 w-[78%] -translate-x-1/2 rounded bg-black/78 px-4 py-3 text-center text-2xl font-black leading-none text-white shadow-2xl">
          This <span className="template-active-word rounded px-1 text-slate-950" style={{background: accent}}>moment</span> matters
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full overflow-hidden bg-[#151b24]">
      <div className="absolute inset-y-0 right-8 top-6 h-[82%] w-44 overflow-hidden rounded shadow-2xl" style={portraitStyle(preset)} />
      <div className="absolute left-6 top-6 h-1.5 w-52 rounded" style={{background: accent}} />
      <div className="absolute bottom-8 left-6 max-w-[54%] rounded bg-black/76 px-4 py-3 shadow-2xl">
        <div className="text-[10px] font-black uppercase" style={{color: accent}}>{preset.preview?.eyebrow}</div>
        <div className="mt-1 text-xl font-black leading-tight text-white">{preset.preview?.title}</div>
      </div>
    </div>
  );
};

const SubtitlePreview: React.FC<{preset: TemplatePreset}> = ({preset}) => {
  const accent = previewAccent(preset);
  const variant = preset.preview?.variant;
  const words = (preset.preview?.title ?? 'Today we reflect on the key idea').split(' ');

  if (variant === 'karaoke') {
    return (
      <div className="flex h-full items-end justify-center bg-[radial-gradient(circle_at_50%_30%,#243244,#111827_62%)] p-7">
        <div className="relative overflow-hidden rounded bg-black/75 px-5 py-4 text-center text-2xl font-black leading-tight text-white">
          <span className="relative z-10">Every word lands with rhythm</span>
          <span className="template-karaoke-fill absolute inset-y-0 left-0 opacity-80" style={{background: accent}} />
        </div>
      </div>
    );
  }

  if (variant === 'typewriter') {
    return (
      <div className="flex h-full items-center justify-center bg-[#f7f2e9] p-7 text-slate-950">
        <div className="rounded border-2 border-slate-900 bg-white px-5 py-4 shadow-xl">
          <div className="text-[10px] font-black uppercase text-slate-500">Note</div>
          <div className="template-typewriter mt-2 overflow-hidden whitespace-nowrap pr-1 text-xl font-black">{preset.preview?.title}</div>
        </div>
      </div>
    );
  }

  if (variant === 'neon') {
    return (
      <div className="flex h-full items-center justify-center bg-[#100b1f] p-7">
        <div className="template-neon text-center text-3xl font-black uppercase leading-none text-white" style={{textShadow: `0 0 18px ${accent}`}}>
          {preset.preview?.title}
        </div>
      </div>
    );
  }

  if (variant === 'active-word') {
    return (
      <div className="flex h-full items-center justify-center bg-[#111827] p-7">
        <div className="rounded bg-black/76 px-5 py-4 text-center text-2xl font-black leading-tight text-white">
          {words.map((word, index) => (
            <span
              key={`${word}-${index}`}
              className="template-word-pop mx-0.5 inline-block rounded px-1"
              style={{animationDelay: `${index * 0.22}s`, ['--accent' as string]: accent}}
            >
              {word}
            </span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full items-end justify-center bg-[#172033] p-7">
      <div className="template-caption-fade max-w-[82%] rounded bg-black/72 px-5 py-4 text-center text-2xl font-black leading-tight text-white">
        {preset.preview?.title}
      </div>
    </div>
  );
};

const TransitionPreview: React.FC<{preset: TemplatePreset}> = ({preset}) => {
  const accent = previewAccent(preset);
  const variant = preset.preview?.variant;

  return (
    <div className={`template-transition template-transition-${variant} relative h-full overflow-hidden bg-[#111827]`}>
      <div className="template-scene-a absolute inset-0" style={{background: `linear-gradient(135deg, #0f172a, ${accent})`}} />
      <div className="template-scene-b absolute inset-0" style={{background: 'linear-gradient(135deg, #f8fafc, #334155)'}} />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="rounded bg-black/70 px-5 py-3 text-xl font-black text-white shadow-2xl">{preset.name}</div>
      </div>
      {variant === 'letterbox' && (
        <>
          <div className="template-letterbox-top absolute inset-x-0 top-0 bg-black" />
          <div className="template-letterbox-bottom absolute inset-x-0 bottom-0 bg-black" />
        </>
      )}
      {variant === 'film-burn' && <div className="template-film-burn absolute inset-0" />}
      {variant === 'whip-pan' && <div className="template-speed-lines absolute inset-0" />}
      {variant === 'zoom-through' && <div className="template-zoom-ring absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white/80" />}
      {variant === 'ad-stinger' && (
        <>
          <div className="template-ad-swipe-a absolute inset-y-0 -left-1/4 w-2/3 bg-cyan-300" />
          <div className="template-ad-swipe-b absolute inset-y-0 -right-1/4 w-2/3 bg-amber-300" />
        </>
      )}
    </div>
  );
};

const CtaPreview: React.FC<{preset: TemplatePreset}> = ({preset}) => {
  const accent = previewAccent(preset);
  const variant = preset.preview?.variant;

  return (
    <div className="relative h-full overflow-hidden bg-[#111827] p-5">
      <div className="grid h-full grid-cols-[0.9fr_0.36fr_0.9fr] gap-3">
        <div className={`relative overflow-hidden rounded ${variant === 'sponsor-kit' ? 'bg-slate-100 text-slate-950' : 'bg-slate-950 text-white'} p-4`}>
          <div className="text-[9px] font-black uppercase" style={{color: variant === 'sponsor-kit' ? '#0369a1' : accent}}>
            Opening
          </div>
          <div className="mt-5 text-xl font-black leading-none">{preset.preview?.title}</div>
          <div className="mt-3 text-[11px] font-bold opacity-70">{preset.preview?.subtitle}</div>
          <div className="absolute bottom-4 left-4 h-1.5 w-24 rounded" style={{background: accent}} />
        </div>
        <div className="relative flex items-center justify-center overflow-hidden rounded bg-slate-900">
          <div className="template-ad-swipe-a absolute inset-y-0 -left-10 w-20 bg-cyan-300" />
          <div className="template-ad-swipe-b absolute inset-y-0 -right-10 w-20 bg-amber-300" />
          <Scissors className="relative z-10 text-white" size={22} />
        </div>
        <div className={`relative overflow-hidden rounded ${variant === 'soft-kit' ? 'bg-emerald-50 text-slate-950' : 'bg-[#0f172a] text-white'} p-4`}>
          <div className="text-[9px] font-black uppercase" style={{color: accent}}>
            Ending
          </div>
          <div className="mt-5 text-xl font-black leading-none">
            {variant === 'sponsor-kit' ? 'Thanks for watching' : variant === 'soft-kit' ? 'Your turn' : 'Ready to try it?'}
          </div>
          <div className="mt-3 text-[11px] font-bold opacity-70">{preset.preview?.eyebrow}</div>
          <div className="absolute bottom-4 left-4 right-4 h-1.5 rounded bg-white/20">
            <div className="template-progress h-full rounded" style={{background: accent}} />
          </div>
        </div>
      </div>
    </div>
  );
};

const StaticPreview: React.FC<{preset: TemplatePreset}> = ({preset}) => {
  if (preset.category === 'interview') {
    return <InterviewPreview preset={preset} />;
  }

  if (preset.category === 'cta') {
    return <CtaPreview preset={preset} />;
  }

  if (preset.category === 'subtitle') {
    return <SubtitlePreview preset={preset} />;
  }

  return <TransitionPreview preset={preset} />;
};

const PreviewCard: React.FC<{preset: TemplatePreset}> = ({preset}) => {
  const Icon = categoryIcon[preset.category];
  return (
    <article data-template-card className="overflow-hidden rounded border border-slate-800 bg-slate-950 shadow-[0_18px_60px_rgba(0,0,0,0.25)]">
      <div className="aspect-video border-b border-slate-800 bg-black">
        {preset.openerTemplateId ? (
          <Player
            acknowledgeRemotionLicense
            component={OpeningTemplateComposition}
            durationInFrames={120}
            fps={30}
            compositionWidth={1080}
            compositionHeight={1920}
            autoPlay
            loop
            controls
            inputProps={{
              templateId: preset.openerTemplateId,
              title: preset.preview?.title ?? preset.name.replace(' Opener', ''),
              subtitle: preset.preview?.subtitle ?? 'Template preview',
              mood: 'positive',
              background: 'gradient',
            }}
            style={{height: '100%', margin: '0 auto', width: '34%'}}
          />
        ) : preset.endingTemplateId ? (
          <Player
            acknowledgeRemotionLicense
            component={EndingTemplateComposition}
            durationInFrames={120}
            fps={30}
            compositionWidth={1080}
            compositionHeight={1920}
            autoPlay
            loop
            controls
            inputProps={{
              templateId: preset.endingTemplateId,
              title: preset.preview?.title ?? preset.name,
              subtitle: preset.preview?.subtitle ?? 'Ending preview',
              credits: typeof preset.timelineJson.endingScreen === 'object' ? 'Music: Artist, Edited with Codex' : 'Edited with Codex',
              mood: 'positive',
              background: 'gradient',
            }}
            style={{height: '100%', margin: '0 auto', width: '34%'}}
          />
        ) : (
          <StaticPreview preset={preset} />
        )}
      </div>
      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className={`inline-flex rounded border p-1 ${categoryStyle[preset.category]}`}>
                <Icon size={14} />
              </span>
              <h2 className="text-sm font-black text-slate-100">{preset.name}</h2>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-400">{preset.description}</p>
          </div>
          <button
            onClick={() => void copyPreset(preset)}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded border border-slate-700 text-slate-300 hover:bg-slate-800"
            title="Copy JSON preset"
          >
            <Copy size={14} />
          </button>
        </div>
        <div className="flex flex-wrap gap-1">
          {preset.tags.map((tag) => (
            <span key={tag} className="rounded bg-slate-800 px-2 py-1 text-[10px] font-bold uppercase text-slate-400">
              {tag}
            </span>
          ))}
        </div>
        <pre className="max-h-36 overflow-auto rounded bg-slate-900 p-3 text-[10px] leading-4 text-slate-300">
          {JSON.stringify(preset.timelineJson, null, 2)}
        </pre>
      </div>
    </article>
  );
};

export const TemplateGallery: React.FC = () => {
  const [category, setCategory] = useState<TemplateCategory>('interview');
  const presets = useMemo(() => templateCatalog.filter((preset) => preset.category === category), [category]);

  return (
    <main className="min-h-screen bg-[#0d1117] text-slate-100">
      <div className="border-b border-slate-800 px-5 py-4">
        <Link href="/" className="inline-flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-cyan-200">
          <ArrowLeft size={14} />
          Editor
        </Link>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-xl font-black tracking-normal text-slate-100">Remotion Template Workspace</h1>
            <p className="mt-1 text-sm text-slate-400">Preview starter looks and copy JSON presets for Codex-generated edits.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {templateCategories.map((item) => (
              <button
                key={item.id}
                onClick={() => setCategory(item.id)}
                className={`rounded px-3 py-2 text-xs font-black uppercase ${
                  category === item.id ? 'bg-cyan-400 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <section className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
        {presets.map((preset) => (
          <PreviewCard key={preset.id} preset={preset} />
        ))}
      </section>
      <style>{`
        @keyframes template-progress {
          0% { width: 8%; }
          100% { width: 100%; }
        }
        @keyframes template-pulse-track {
          0%, 100% { transform: scaleX(0.18); transform-origin: left; opacity: 0.55; }
          50% { transform: scaleX(0.92); transform-origin: left; opacity: 1; }
        }
        @keyframes template-active-word {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-4px) scale(1.06); }
        }
        @keyframes template-quote-pop {
          0%, 100% { transform: translateY(8px); opacity: 0.82; }
          45% { transform: translateY(0); opacity: 1; }
        }
        @keyframes template-caption-fade {
          0%, 100% { opacity: 0.45; transform: translateY(14px); }
          35%, 78% { opacity: 1; transform: translateY(0); }
        }
        @keyframes template-word-pop {
          0%, 100% { background: transparent; color: white; transform: translateY(0) scale(1); }
          48%, 68% { background: var(--accent); color: #0f172a; transform: translateY(-3px) scale(1.05); }
        }
        @keyframes template-karaoke-fill {
          0% { width: 0%; }
          100% { width: 100%; }
        }
        @keyframes template-typewriter {
          0%, 12% { width: 0; border-right-color: #0f172a; }
          72%, 100% { width: 24ch; border-right-color: transparent; }
        }
        @keyframes template-neon {
          0%, 100% { transform: scale(1); opacity: 0.72; }
          35% { transform: scale(1.04); opacity: 1; }
          60% { transform: scale(0.99); opacity: 0.9; }
        }
        @keyframes template-soft-a {
          0%, 42% { opacity: 1; }
          70%, 100% { opacity: 0; }
        }
        @keyframes template-soft-b {
          0%, 35% { opacity: 0; }
          72%, 100% { opacity: 1; }
        }
        @keyframes template-letter-top {
          0%, 100% { height: 32%; }
          42%, 72% { height: 12%; }
        }
        @keyframes template-letter-bottom {
          0%, 100% { height: 32%; }
          42%, 72% { height: 12%; }
        }
        @keyframes template-whip-a {
          0%, 35% { transform: translateX(0); opacity: 1; }
          55%, 100% { transform: translateX(-115%); opacity: 0; }
        }
        @keyframes template-whip-b {
          0%, 38% { transform: translateX(115%); opacity: 0; }
          62%, 100% { transform: translateX(0); opacity: 1; }
        }
        @keyframes template-zoom-a {
          0%, 42% { transform: scale(1); opacity: 1; }
          68%, 100% { transform: scale(1.42); opacity: 0; }
        }
        @keyframes template-zoom-b {
          0%, 44% { transform: scale(0.78); opacity: 0; }
          72%, 100% { transform: scale(1); opacity: 1; }
        }
        @keyframes template-ring {
          0%, 35% { transform: translate(-50%, -50%) scale(0.4); opacity: 0; }
          62% { transform: translate(-50%, -50%) scale(4.5); opacity: 0.8; }
          100% { transform: translate(-50%, -50%) scale(7); opacity: 0; }
        }
        @keyframes template-film-burn {
          0%, 45%, 100% { opacity: 0; transform: translateX(-30%); }
          58% { opacity: 0.95; transform: translateX(0); }
        }
        @keyframes template-speed-lines {
          0%, 40%, 100% { opacity: 0; transform: translateX(0); }
          54% { opacity: 0.7; transform: translateX(-18px); }
        }
        @keyframes template-ad-swipe-a {
          0%, 28% { transform: translateX(-82%) skewX(-16deg); opacity: 0; }
          48% { transform: translateX(45%) skewX(-16deg); opacity: 0.92; }
          100% { transform: translateX(190%) skewX(-16deg); opacity: 0; }
        }
        @keyframes template-ad-swipe-b {
          0%, 34% { transform: translateX(82%) skewX(-16deg); opacity: 0; }
          54% { transform: translateX(-45%) skewX(-16deg); opacity: 0.9; }
          100% { transform: translateX(-190%) skewX(-16deg); opacity: 0; }
        }
        .template-progress { animation: template-progress 3.6s linear infinite; }
        .template-pulse-track { animation: template-pulse-track 2.6s ease-in-out infinite; }
        .template-active-word { display: inline-block; animation: template-active-word 1.4s ease-in-out infinite; }
        .template-quote-pop { animation: template-quote-pop 2.6s ease-in-out infinite; }
        .template-caption-fade { animation: template-caption-fade 3s ease-in-out infinite; }
        .template-word-pop { animation: template-word-pop 2.8s ease-in-out infinite; }
        .template-karaoke-fill { animation: template-karaoke-fill 2.7s linear infinite; mix-blend-mode: multiply; }
        .template-typewriter { animation: template-typewriter 3.2s steps(24, end) infinite; border-right: 2px solid #0f172a; }
        .template-neon { animation: template-neon 1.8s ease-in-out infinite; }
        .template-transition-soft-fade .template-scene-a { animation: template-soft-a 2.8s ease-in-out infinite; }
        .template-transition-soft-fade .template-scene-b { animation: template-soft-b 2.8s ease-in-out infinite; }
        .template-transition-letterbox .template-scene-b { opacity: 0.72; }
        .template-letterbox-top { animation: template-letter-top 2.8s ease-in-out infinite; }
        .template-letterbox-bottom { animation: template-letter-bottom 2.8s ease-in-out infinite; }
        .template-transition-whip-pan .template-scene-a { animation: template-whip-a 2.4s ease-in-out infinite; }
        .template-transition-whip-pan .template-scene-b { animation: template-whip-b 2.4s ease-in-out infinite; }
        .template-speed-lines {
          animation: template-speed-lines 2.4s ease-in-out infinite;
          background: repeating-linear-gradient(90deg, rgba(255,255,255,0.42) 0 2px, transparent 2px 16px);
        }
        .template-transition-zoom-through .template-scene-a { animation: template-zoom-a 2.7s ease-in-out infinite; }
        .template-transition-zoom-through .template-scene-b { animation: template-zoom-b 2.7s ease-in-out infinite; }
        .template-zoom-ring { animation: template-ring 2.7s ease-in-out infinite; }
        .template-transition-film-burn .template-scene-a { animation: template-soft-a 3s ease-in-out infinite; }
        .template-transition-film-burn .template-scene-b { animation: template-soft-b 3s ease-in-out infinite; }
        .template-film-burn {
          animation: template-film-burn 3s ease-in-out infinite;
          background: radial-gradient(circle at 30% 50%, rgba(255,255,255,0.95), rgba(251,146,60,0.82) 22%, rgba(239,68,68,0.32) 42%, transparent 68%);
          mix-blend-mode: screen;
        }
        .template-ad-swipe-a { animation: template-ad-swipe-a 2.4s ease-in-out infinite; }
        .template-ad-swipe-b { animation: template-ad-swipe-b 2.4s ease-in-out infinite; }
      `}</style>
    </main>
  );
};

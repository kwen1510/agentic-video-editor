'use client';

import React, {useEffect, useRef} from 'react';
import {ControlPanel} from './ControlPanel';
import {PreviewPane} from './PreviewPane';
import {TimelinePanel} from './TimelinePanel';
import {useEditorStore} from '@/store/editorStore';
import type {TimelineProject, TranscriptResult, TranscriptThought} from '@/types/timeline';

export const EditorApp: React.FC = () => {
  const project = useEditorStore((state) => state.project);
  const setProject = useEditorStore((state) => state.setProject);
  const setSourceVideo = useEditorStore((state) => state.setSourceVideo);
  const setTranscript = useEditorStore((state) => state.setTranscript);
  const setThoughts = useEditorStore((state) => state.setThoughts);
  const didAutoLoad = useRef(false);

  useEffect(() => {
    if (project.sourceVideo || didAutoLoad.current) {
      return;
    }

    didAutoLoad.current = true;

    const loadFirstAvailableProject = async () => {
      try {
        const demoCheck = await fetch('/api/projects/home-run-seed?check=1').then((response) => response.json() as Promise<{available?: boolean}>);
        if (demoCheck.available) {
          const demo = await fetch('/api/projects/home-run-seed').then(
            (response) =>
              response.json() as Promise<{
                project?: TimelineProject;
                transcript?: TranscriptResult;
                thoughts?: TranscriptThought[];
              }>,
          );
          if (demo.project) {
            setProject(demo.project);
            setTranscript(demo.transcript ?? null);
            setThoughts(demo.thoughts ?? []);
            return;
          }
        }

        const data = await fetch('/api/uploads').then((response) => response.json() as Promise<{videos?: Array<{src: string; duration?: number; name?: string}>}>);
        const first = data.videos?.[0];
        if (first) {
          setSourceVideo({
            src: first.src,
            name: first.name,
            duration: first.duration ?? 0,
            volume: 1,
            muted: false,
          });
        }
      } catch {
        // Keep the editor empty if no local media is available.
      }
    };

    void loadFirstAvailableProject();
  }, [project.sourceVideo, setProject, setSourceVideo, setThoughts, setTranscript]);

  return (
    <main className="grid h-screen min-h-0 grid-cols-[minmax(0,1fr)_auto] bg-[#0d1117] text-slate-100">
      <div className="grid min-h-0 grid-rows-[minmax(0,1fr)_300px]">
        <PreviewPane />
        <TimelinePanel />
      </div>
      <ControlPanel />
    </main>
  );
};

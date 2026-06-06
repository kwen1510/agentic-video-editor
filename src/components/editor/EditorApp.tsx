'use client';

import React, {useEffect, useRef} from 'react';
import {ControlPanel} from './ControlPanel';
import {PreviewPane} from './PreviewPane';
import {TimelinePanel} from './TimelinePanel';
import {useEditorStore} from '@/store/editorStore';
import type {TimelineProject, TranscriptResult, TranscriptThought} from '@/types/timeline';

const localStateKey = 'agentic-video-editor:autosave:v1';

type SavedEditorState = {
  savedAt: string;
  project: TimelineProject;
  transcript: TranscriptResult | null;
  thoughts: TranscriptThought[];
};

const hasRestorableProject = (project: TimelineProject) =>
  Boolean(project.sourceVideo || project.sourceVideos?.length || project.clips.length || project.layers.length || project.music.length);

export const EditorApp: React.FC = () => {
  const project = useEditorStore((state) => state.project);
  const transcript = useEditorStore((state) => state.transcript);
  const thoughts = useEditorStore((state) => state.thoughts);
  const setProject = useEditorStore((state) => state.setProject);
  const setSourceVideo = useEditorStore((state) => state.setSourceVideo);
  const setTranscript = useEditorStore((state) => state.setTranscript);
  const setThoughts = useEditorStore((state) => state.setThoughts);
  const didAutoLoad = useRef(false);
  const didHydrateLocalState = useRef(false);
  const currentProjectJsonRef = useRef('');
  const lastWorkspaceWriteJsonRef = useRef<string | null>(null);
  const applyingWorkspaceProjectRef = useRef(false);
  const lastProjectChangeAtRef = useRef(0);

  useEffect(() => {
    if (didHydrateLocalState.current) {
      return;
    }
    didHydrateLocalState.current = true;

    try {
      const raw = window.localStorage.getItem(localStateKey);
      if (!raw) {
        return;
      }
      const saved = JSON.parse(raw) as SavedEditorState;
      if (saved.project?.projectId && hasRestorableProject(saved.project)) {
        didAutoLoad.current = true;
        setProject(saved.project);
        setTranscript(saved.transcript ?? null);
        setThoughts(saved.thoughts ?? []);
      }
    } catch {
      // Ignore invalid saved state and fall back to local media discovery.
    }
  }, [setProject, setThoughts, setTranscript]);

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

  useEffect(() => {
    if (!didHydrateLocalState.current || !hasRestorableProject(project)) {
      return;
    }

    const projectJson = JSON.stringify(project);
    currentProjectJsonRef.current = projectJson;
    lastProjectChangeAtRef.current = Date.now();

    try {
      const saved: SavedEditorState = {
        savedAt: new Date().toISOString(),
        project,
        transcript,
        thoughts,
      };
      window.localStorage.setItem(localStateKey, JSON.stringify(saved));
    } catch {
      // Local storage is a safety net; JSON file save/export still works if it is unavailable.
    }

    const writeTimer = window.setTimeout(() => {
      if (applyingWorkspaceProjectRef.current) {
        return;
      }

      void fetch(`/api/projects/${project.projectId}`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: projectJson,
      })
        .then((response) => {
          if (response.ok) {
            lastWorkspaceWriteJsonRef.current = projectJson;
          }
        })
        .catch(() => undefined);
    }, 700);

    return () => window.clearTimeout(writeTimer);
  }, [project, thoughts, transcript]);

  useEffect(() => {
    if (!project.projectId || !hasRestorableProject(project)) {
      return;
    }

    const syncTimer = window.setInterval(() => {
      if (Date.now() - lastProjectChangeAtRef.current < 1500) {
        return;
      }

      void fetch(`/api/projects/${project.projectId}?sync=${Date.now()}`)
        .then(async (response) => {
          if (!response.ok) {
            return;
          }

          const workspaceProject = (await response.json()) as TimelineProject;
          const workspaceJson = JSON.stringify(workspaceProject);
          if (
            workspaceJson === currentProjectJsonRef.current ||
            workspaceJson === lastWorkspaceWriteJsonRef.current ||
            !hasRestorableProject(workspaceProject)
          ) {
            return;
          }

          applyingWorkspaceProjectRef.current = true;
          setProject(workspaceProject);
          window.setTimeout(() => {
            applyingWorkspaceProjectRef.current = false;
          }, 0);
        })
        .catch(() => undefined);
    }, 3000);

    return () => window.clearInterval(syncTimer);
  }, [project, project.projectId, setProject]);

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

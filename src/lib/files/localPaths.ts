import path from 'node:path';

export const workspaceRoot = process.cwd();
export const publicDir = path.join(workspaceRoot, 'public');
export const uploadsDir = path.join(publicDir, 'uploads');
export const musicDir = path.join(publicDir, 'music');
export const musicImportsDir = path.join(musicDir, 'imports');
export const localMusicManifestPath = path.join(musicDir, 'music-manifest.local.json');
export const projectsDir = path.join(workspaceRoot, 'projects');
export const transcriptsDir = path.join(workspaceRoot, 'transcripts');
export const codexDir = path.join(workspaceRoot, 'codex');
export const publicDiagnosticsDir = path.join(publicDir, 'diagnostics');
export const scriptsDir = path.join(workspaceRoot, 'scripts');

export const publicPathToDisk = (publicPath: string) => {
  const normalized = publicPath.startsWith('/') ? publicPath.slice(1) : publicPath;
  const disk = path.resolve(publicDir, normalized);
  if (!disk.startsWith(publicDir)) {
    throw new Error('Path escapes public directory');
  }
  return disk;
};

export const sanitizeFileName = (name: string) =>
  name
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase();

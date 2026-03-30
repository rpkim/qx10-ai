import { createHash } from 'crypto';
import type { DriveManifest, DriveManifestEntry } from './drive-manifest';
import { emptyManifest, parseManifestJson } from './drive-manifest';

const MANIFEST_NAME = 'manifest.json';

export function workspaceBackupFileName(keyword: string): string {
  const slug = keyword
    .trim()
    .replace(/[^\p{L}\p{N}\s.\-_]+/gu, '')
    .replace(/\s+/g, '-')
    .slice(0, 80) || 'workspace';
  return `ws-${slug}.json`;
}

export function contentHash(snapshotJson: string): string {
  return createHash('sha256').update(snapshotJson, 'utf8').digest('hex').slice(0, 24);
}

export async function listAppDataFiles(
  accessToken: string
): Promise<Array<{ id: string; name: string }>> {
  const url =
    'https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&fields=files(id,name)&pageSize=200';
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(await res.text());
  const data = (await res.json()) as { files?: Array<{ id: string; name: string }> };
  return data.files ?? [];
}

export async function downloadFileMedia(accessToken: string, fileId: string): Promise<string> {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) throw new Error(await res.text());
  return res.text();
}

async function multipartCreateJsonFile(
  accessToken: string,
  name: string,
  body: string
): Promise<{ id: string }> {
  const boundary = `qx10_${Math.random().toString(16).slice(2)}_${Date.now()}`;
  const crlf = '\r\n';
  const meta = {
    name,
    parents: ['appDataFolder'],
  };
  const full =
    `--${boundary}${crlf}` +
    `Content-Type: application/json; charset=UTF-8${crlf}${crlf}` +
    JSON.stringify(meta) +
    `${crlf}--${boundary}${crlf}` +
    `Content-Type: application/json; charset=UTF-8${crlf}${crlf}` +
    body +
    `${crlf}--${boundary}--`;

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: full,
    }
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ id: string }>;
}

async function patchMedia(accessToken: string, fileId: string, body: string): Promise<void> {
  const res = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(fileId)}?uploadType=media`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body,
    }
  );
  if (!res.ok) throw new Error(await res.text());
}

async function ensureManifest(
  accessToken: string,
  files: Array<{ id: string; name: string }>
): Promise<{ manifestId: string; manifest: DriveManifest }> {
  const existing = files.find((f) => f.name === MANIFEST_NAME);
  if (existing) {
    const raw = await downloadFileMedia(accessToken, existing.id);
    return { manifestId: existing.id, manifest: parseManifestJson(raw) };
  }
  const m = emptyManifest();
  const created = await multipartCreateJsonFile(accessToken, MANIFEST_NAME, JSON.stringify(m));
  return { manifestId: created.id, manifest: m };
}

export async function upsertWorkspaceBackup(
  accessToken: string,
  snapshotJson: string
): Promise<{ fileId: string; fileName: string; hash: string }> {
  const parsed = JSON.parse(snapshotJson) as { keyword?: string; goal?: string };
  const keyword = typeof parsed.keyword === 'string' ? parsed.keyword : '';
  const goal = typeof parsed.goal === 'string' ? parsed.goal : '';
  if (!keyword.trim()) {
    throw new Error('Snapshot must include keyword');
  }

  const fileName = workspaceBackupFileName(keyword);
  const hash = contentHash(snapshotJson);
  const now = new Date().toISOString();

  const listed = await listAppDataFiles(accessToken);
  const { manifestId, manifest } = await ensureManifest(accessToken, listed);

  let wsFileId =
    manifest.workspaces.find((w) => w.keyword === keyword)?.driveFileId ??
    listed.find((f) => f.name === fileName)?.id;

  if (wsFileId) {
    await patchMedia(accessToken, wsFileId, snapshotJson);
  } else {
    const created = await multipartCreateJsonFile(accessToken, fileName, snapshotJson);
    wsFileId = created.id;
  }

  const nextList: DriveManifestEntry[] = manifest.workspaces.filter((w) => w.keyword !== keyword);
  nextList.push({
    keyword,
    goal,
    fileName,
    driveFileId: wsFileId,
    contentHash: hash,
    updatedAt: now,
  });

  const nextManifest: DriveManifest = {
    ...manifest,
    updatedAt: now,
    workspaces: nextList,
  };

  await patchMedia(accessToken, manifestId, JSON.stringify(nextManifest));

  return { fileId: wsFileId, fileName, hash };
}

export async function loadManifest(accessToken: string): Promise<DriveManifest> {
  const listed = await listAppDataFiles(accessToken);
  const { manifest } = await ensureManifest(accessToken, listed);
  return manifest;
}

export async function pullWorkspaceByKeyword(
  accessToken: string,
  keyword: string
): Promise<string | null> {
  const manifest = await loadManifest(accessToken);
  const entry = manifest.workspaces.find((w) => w.keyword === keyword);
  if (entry) {
    return downloadFileMedia(accessToken, entry.driveFileId);
  }
  const fileName = workspaceBackupFileName(keyword);
  const listed = await listAppDataFiles(accessToken);
  const f = listed.find((x) => x.name === fileName);
  if (!f) return null;
  return downloadFileMedia(accessToken, f.id);
}

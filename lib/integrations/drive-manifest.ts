import { z } from 'zod';

export const DRIVE_MANIFEST_FORMAT = 'qx10-drive-backup' as const;

export const driveManifestEntrySchema = z.object({
  keyword: z.string(),
  goal: z.string(),
  fileName: z.string(),
  driveFileId: z.string(),
  contentHash: z.string(),
  updatedAt: z.string(),
});

export const driveManifestSchema = z.object({
  format: z.literal(DRIVE_MANIFEST_FORMAT),
  version: z.literal(1),
  updatedAt: z.string(),
  workspaces: z.array(driveManifestEntrySchema),
});

export type DriveManifest = z.infer<typeof driveManifestSchema>;
export type DriveManifestEntry = z.infer<typeof driveManifestEntrySchema>;

export function emptyManifest(): DriveManifest {
  return {
    format: DRIVE_MANIFEST_FORMAT,
    version: 1,
    updatedAt: new Date().toISOString(),
    workspaces: [],
  };
}

export function parseManifestJson(raw: string): DriveManifest {
  const data = JSON.parse(raw) as unknown;
  const p = driveManifestSchema.safeParse(data);
  if (p.success) return p.data;
  return emptyManifest();
}

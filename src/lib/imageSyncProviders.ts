import type { ImageSyncProviderId } from "../interfaces";

// The cloud storage image sync can use, all through rclone. Adding one is an entry here: rclone's backend type
// (https://rclone.org/overview/) plus any options to set when the remote is created. The login itself is rclone's
export const IMAGE_SYNC_PROVIDERS: {
  id: ImageSyncProviderId;
  label: string;
  rcloneType: string;
  options: Record<string, string>;
  note: string;
}[] = [
  {
    id: "drive",
    label: "Google Drive",
    rcloneType: "drive",
    // drive.file: rclone can only see the files it created itself, not the rest of the Drive
    options: { scope: "drive.file" },
    note: "Uses your Google account's free storage (15 GB, shared with Gmail and Photos). The app can only see the files it puts there.",
  },
  {
    id: "pcloud",
    label: "pCloud",
    rcloneType: "pcloud",
    options: {},
    note: "Uses your pCloud storage (up to 10 GB on the free plan). Works with both US and EU accounts.",
  },
];

export const DEFAULT_IMAGE_FOLDER = "CompleteList/images";

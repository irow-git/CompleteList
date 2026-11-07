import type { GameDetails, SelectList } from "../../src/interfaces";

// What a sync needs from the cloud side. Firestore implements it (firestore.ts); tests use an in-memory fake.

// The cheap part of a remote game or DLC: enough to tell whether its details need fetching
export interface RemoteMetadata {
  id: string;
  parentId: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  // When the server stored this change, in ms. Pull checkpoints are these, never the local clock
  serverUpdatedAt: number;
}

// A game's details as stored in the cloud. series is missing on games uploaded by a version of the app from before
// series existed, which is different from null (no series): the local series is kept then
export type RemoteDetails = Omit<GameDetails, "series"> & { series?: string | null };

// One local game or DLC to upload. Tombstones (deletedAt set) carry no details
export interface PushRecord {
  id: string;
  parentId: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  details: GameDetails | null;
}

// One entry of a game's cover history (see the covers table). Tombstones have deletedAt set
export interface RemoteCover {
  id: string;
  gameId: string;
  image: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

// One added dropdown option (see the select_items table). Tombstones have deletedAt set
export interface RemoteSelectItem {
  id: string;
  list: SelectList;
  value: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface RemoteStore {
  // Metadata stored after the checkpoint (server time, ms), oldest first
  changedMetadataSince(checkpoint: number): Promise<RemoteMetadata[]>;
  // Details by id; ids that have none (deleted meanwhile) are missing from the result
  fetchDetails(ids: string[]): Promise<Map<string, RemoteDetails>>;
  push(records: PushRecord[]): Promise<void>;
  // Cover history entries stored after the checkpoint (server time, ms), oldest first
  changedCoversSince(checkpoint: number): Promise<(RemoteCover & { serverUpdatedAt: number })[]>;
  pushCovers(records: RemoteCover[]): Promise<void>;
  // Dropdown options stored after the checkpoint (server time, ms), oldest first
  changedSelectItemsSince(checkpoint: number): Promise<(RemoteSelectItem & { serverUpdatedAt: number })[]>;
  pushSelectItems(records: RemoteSelectItem[]): Promise<void>;
}

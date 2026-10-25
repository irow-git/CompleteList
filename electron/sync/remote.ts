import type { GameDetails } from "../../src/interfaces";

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

// One local game or DLC to upload. Tombstones (deletedAt set) carry no details
export interface PushRecord {
  id: string;
  parentId: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  details: GameDetails | null;
}

export interface RemoteStore {
  // Metadata stored after the checkpoint (server time, ms), oldest first
  changedMetadataSince(checkpoint: number): Promise<RemoteMetadata[]>;
  // Details by id; ids that have none (deleted meanwhile) are missing from the result
  fetchDetails(ids: string[]): Promise<Map<string, GameDetails>>;
  push(records: PushRecord[]): Promise<void>;
}

import { deleteApp, FirebaseError, initializeApp, type FirebaseApp } from "firebase/app";
import { createUserWithEmailAndPassword, getAuth, signInWithEmailAndPassword } from "firebase/auth";
import {
  collection,
  doc,
  documentId,
  getDocs,
  initializeFirestore,
  limit,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  Timestamp,
  where,
  writeBatch,
  type Firestore,
  type QueryDocumentSnapshot,
} from "firebase/firestore/lite";
import type { FirebaseConfig, GameDetails } from "../../src/interfaces";
import { isImageRef } from "../../src/lib/imageRef";
import { toScore } from "../../src/lib/score";
import { toHours } from "../../src/lib/hours";
import type { PushRecord, RemoteCover, RemoteMetadata, RemoteStore } from "./remote";

// Everything lives under users/{uid}, split in two so a sync reads the cheap part first:
//   gameMetadata/{id}  { parentId, createdAt, updatedAt, deletedAt, serverUpdatedAt }
//   games/{id}         { ...GameDetails, parentId }  (deleted along with the game; the metadata stays as a tombstone)
// Firestore lite talks REST, so the main process needs no gRPC. Dates are stored as Firestore Timestamps.

export interface FirebaseAccount {
  config: FirebaseConfig;
  email: string;
  password: string;
}

const METADATA_PAGE = 500;
const DETAILS_PER_QUERY = 30; // Firestore's limit for "in" queries
const RECORDS_PER_BATCH = 250; // two writes each, Firestore's batch limit is 500

const accountKey = (account: FirebaseAccount) => JSON.stringify([account.config, account.email, account.password]);

let connection: { key: string; app: FirebaseApp; firestore: Firestore } | null = null;
let verifications = 0;

const openApp = (account: FirebaseAccount, name: string) => {
  const app = initializeApp(account.config, name);
  return { app, firestore: initializeFirestore(app, { ignoreUndefinedProperties: true }) };
};

const signIn = async (app: FirebaseApp, account: FirebaseAccount, createAccount = false) => {
  const auth = getAuth(app);
  if (auth.currentUser?.email === account.email && !createAccount) return auth.currentUser.uid;
  const credential = createAccount
    ? await createUserWithEmailAndPassword(auth, account.email, account.password)
    : await signInWithEmailAndPassword(auth, account.email, account.password);
  return credential.user.uid;
};

// Plain sentences for the errors people actually hit while setting this up
export function describeFirebaseError(error: unknown): string {
  const code = error instanceof FirebaseError ? error.code : (error as { code?: string })?.code;
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
    case "auth/invalid-login-credentials":
      return "Wrong email or password. If this account doesn't exist yet, create it instead.";
    case "auth/email-already-in-use":
      return "An account with this email already exists. Sign in instead.";
    case "auth/weak-password":
      return "That password is too weak: Firebase needs at least 6 characters.";
    case "auth/invalid-email":
      return "That email address isn't valid.";
    case "auth/invalid-api-key":
    case "auth/api-key-not-valid.-please-pass-a-valid-api-key.":
      return "The API key isn't valid. Copy it again from the Firebase console.";
    case "auth/operation-not-allowed":
    case "auth/configuration-not-found":
      return "Email/password sign-in isn't enabled for this project. Turn it on in the Firebase console under Authentication → Sign-in method.";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a little and try again.";
    case "auth/network-request-failed":
    case "unavailable":
    case "deadline-exceeded":
      return "Couldn't reach Firebase. Check your internet connection.";
    case "permission-denied":
      return "Firebase refused access to your data. Check that the Firestore security rules let users read and write users/{their uid}.";
    case "not-found":
      return "This project has no Firestore database yet. Create one in the Firebase console under Firestore Database.";
    case "invalid-argument":
      return "Firebase rejected the project settings. Check the project ID and app ID.";
  }
  const message = error instanceof Error ? error.message : String(error);
  return `Firebase error: ${message}`;
}

const asFirebaseError = (error: unknown) => new Error(describeFirebaseError(error));

const toDate = (value: unknown) => (value instanceof Timestamp ? value.toDate() : null);

const toDetails = (data: Record<string, unknown>): GameDetails => ({
  title: String(data.title ?? ""),
  completion: String(data.completion ?? ""),
  release_date: toDate(data.release_date),
  last_completion: toDate(data.last_completion),
  platform: Array.isArray(data.platform) ? data.platform.map(String) : [],
  tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
  original_copy: Boolean(data.original_copy),
  free_to_play: Boolean(data.free_to_play),
  service: Boolean(data.service),
  comment: String(data.comment ?? ""),
  cover_image: isImageRef(data.cover_image) ? data.cover_image : null,
  // Missing on games pushed before these fields existed
  score: toScore(data.score),
  hours: toHours(data.hours),
});

function firestoreRemote(firestore: Firestore, uid: string): RemoteStore {
  const metadataCollection = collection(firestore, "users", uid, "gameMetadata");
  const gamesCollection = collection(firestore, "users", uid, "games");
  // users/{uid}/covers/{"<game id>:<image>"}: { gameId, image, createdAt, updatedAt, deletedAt, serverUpdatedAt }
  const coversCollection = collection(firestore, "users", uid, "covers");

  return {
    async changedMetadataSince(checkpoint) {
      const changed: RemoteMetadata[] = [];
      let cursor: QueryDocumentSnapshot | undefined;
      for (;;) {
        const page = await getDocs(
          query(
            metadataCollection,
            where("serverUpdatedAt", ">", Timestamp.fromMillis(checkpoint)),
            orderBy("serverUpdatedAt"),
            ...(cursor ? [startAfter(cursor)] : []),
            limit(METADATA_PAGE)
          )
        );
        for (const snapshot of page.docs) {
          const data = snapshot.data();
          changed.push({
            id: snapshot.id,
            parentId: typeof data.parentId === "string" ? data.parentId : null,
            createdAt: toDate(data.createdAt) ?? new Date(0),
            updatedAt: toDate(data.updatedAt) ?? new Date(0),
            deletedAt: toDate(data.deletedAt),
            serverUpdatedAt: (data.serverUpdatedAt as Timestamp).toMillis(),
          });
        }
        if (page.size < METADATA_PAGE) return changed;
        cursor = page.docs[page.docs.length - 1];
      }
    },

    async fetchDetails(ids) {
      const details = new Map<string, GameDetails>();
      for (let start = 0; start < ids.length; start += DETAILS_PER_QUERY) {
        const chunk = ids.slice(start, start + DETAILS_PER_QUERY);
        const page = await getDocs(query(gamesCollection, where(documentId(), "in", chunk)));
        for (const snapshot of page.docs) details.set(snapshot.id, toDetails(snapshot.data()));
      }
      return details;
    },

    async push(records: PushRecord[]) {
      for (let start = 0; start < records.length; start += RECORDS_PER_BATCH) {
        const batch = writeBatch(firestore);
        for (const record of records.slice(start, start + RECORDS_PER_BATCH)) {
          batch.set(doc(metadataCollection, record.id), {
            parentId: record.parentId,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
            deletedAt: record.deletedAt,
            serverUpdatedAt: serverTimestamp(),
          });
          const details = doc(gamesCollection, record.id);
          if (record.details) batch.set(details, { ...record.details, parentId: record.parentId });
          else batch.delete(details);
        }
        await batch.commit();
      }
    },

    async changedCoversSince(checkpoint) {
      const changed: (RemoteCover & { serverUpdatedAt: number })[] = [];
      let cursor: QueryDocumentSnapshot | undefined;
      for (;;) {
        const page = await getDocs(
          query(
            coversCollection,
            where("serverUpdatedAt", ">", Timestamp.fromMillis(checkpoint)),
            orderBy("serverUpdatedAt"),
            ...(cursor ? [startAfter(cursor)] : []),
            limit(METADATA_PAGE)
          )
        );
        for (const snapshot of page.docs) {
          const data = snapshot.data();
          changed.push({
            id: snapshot.id,
            gameId: String(data.gameId ?? ""),
            image: String(data.image ?? ""),
            createdAt: toDate(data.createdAt) ?? new Date(0),
            updatedAt: toDate(data.updatedAt) ?? new Date(0),
            deletedAt: toDate(data.deletedAt),
            serverUpdatedAt: (data.serverUpdatedAt as Timestamp).toMillis(),
          });
        }
        if (page.size < METADATA_PAGE) return changed;
        cursor = page.docs[page.docs.length - 1];
      }
    },

    async pushCovers(records) {
      for (let start = 0; start < records.length; start += RECORDS_PER_BATCH * 2) {
        const batch = writeBatch(firestore);
        for (const { id, ...cover } of records.slice(start, start + RECORDS_PER_BATCH * 2)) {
          batch.set(doc(coversCollection, id), { ...cover, serverUpdatedAt: serverTimestamp() });
        }
        await batch.commit();
      }
    },
  };
}

// The store a sync talks to. The signed-in app is kept between syncs and replaced when the account changes
export async function connectFirestore(account: FirebaseAccount): Promise<RemoteStore> {
  const key = accountKey(account);
  if (connection?.key !== key) {
    await disconnectFirestore();
    connection = { key, ...openApp(account, "sync") };
  }
  try {
    const uid = await signIn(connection.app, account);
    const remote = firestoreRemote(connection.firestore, uid);
    // Errors from the remote calls also come out as readable sentences
    return {
      changedMetadataSince: (checkpoint) => remote.changedMetadataSince(checkpoint).catch((error) => Promise.reject(asFirebaseError(error))),
      fetchDetails: (ids) => remote.fetchDetails(ids).catch((error) => Promise.reject(asFirebaseError(error))),
      push: (records) => remote.push(records).catch((error) => Promise.reject(asFirebaseError(error))),
      changedCoversSince: (checkpoint) => remote.changedCoversSince(checkpoint).catch((error) => Promise.reject(asFirebaseError(error))),
      pushCovers: (records) => remote.pushCovers(records).catch((error) => Promise.reject(asFirebaseError(error))),
    };
  } catch (error) {
    throw asFirebaseError(error);
  }
}

export async function disconnectFirestore() {
  const previous = connection;
  connection = null;
  if (previous) await deleteApp(previous.app);
}

// Checks an account before it's saved: signs in (or creates it), then reads from Firestore, which catches a
// missing database or rules that lock the user out. Uses its own throwaway app so a failed check can't break syncing
export async function verifyFirebaseAccount(account: FirebaseAccount, createAccount: boolean) {
  const { app, firestore } = openApp(account, `verify-${++verifications}`);
  try {
    const uid = await signIn(app, account, createAccount);
    await getDocs(query(collection(firestore, "users", uid, "gameMetadata"), limit(1)));
  } catch (error) {
    throw asFirebaseError(error);
  } finally {
    await deleteApp(app);
  }
}

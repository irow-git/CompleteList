import { app, safeStorage } from "electron";
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import type { FirebaseConfig, FirebaseSettings, FirebaseSettingsInput } from "../../src/interfaces";
import type { Db } from "../db";
import { resetSync } from "./engine";
import { disconnectFirestore, verifyFirebaseAccount, type FirebaseAccount } from "./firestore";

// The Firebase project and account, password included, encrypted with the OS keyring through safeStorage

const settingsFile = () => path.join(app.getPath("userData"), "firebase-settings.bin");

// Without a keyring on Linux, safeStorage falls back to a fixed key ("basic_text"), which is barely better than
// plain text. Saving still works then; the settings screen warns about it
async function hasSecureStorage() {
  if (!(await safeStorage.isAsyncEncryptionAvailable())) return false;
  return process.platform !== "linux" || safeStorage.getSelectedStorageBackend() !== "basic_text";
}

async function writeAccount(account: FirebaseAccount) {
  const encrypted = await safeStorage.encryptStringAsync(JSON.stringify(account));
  // Write then rename, so a crash mid-write can't leave a half-written file behind
  const temporary = `${settingsFile()}.tmp`;
  await fs.writeFile(temporary, encrypted);
  await fs.rename(temporary, settingsFile());
}

export const isSyncConfigured = () => existsSync(settingsFile());

// The stored account, or null when there's none or it can't be decrypted any more (e.g. the keyring was reset)
export async function readAccount(): Promise<FirebaseAccount | null> {
  let encrypted: Buffer;
  try {
    encrypted = await fs.readFile(settingsFile());
  } catch {
    return null;
  }
  try {
    const { result, shouldReEncrypt } = await safeStorage.decryptStringAsync(encrypted);
    const account = JSON.parse(result) as FirebaseAccount;
    if (shouldReEncrypt) await writeAccount(account);
    return account;
  } catch {
    return null;
  }
}

export async function getFirebaseSettings(): Promise<{ settings: FirebaseSettings | null; secureStorage: boolean }> {
  const account = await readAccount();
  return {
    settings: account && { config: account.config, email: account.email },
    secureStorage: await hasSecureStorage(),
  };
}

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const cleanConfig = (config: FirebaseConfig): FirebaseConfig => {
  const cleaned: FirebaseConfig = {
    apiKey: text(config?.apiKey),
    authDomain: text(config?.authDomain),
    projectId: text(config?.projectId),
    appId: text(config?.appId),
  };
  if (text(config?.storageBucket)) cleaned.storageBucket = text(config.storageBucket);
  if (text(config?.messagingSenderId)) cleaned.messagingSenderId = text(config.messagingSenderId);
  return cleaned;
};

export async function saveFirebaseSettings(db: Db, input: FirebaseSettingsInput) {
  if (!(await safeStorage.isAsyncEncryptionAvailable())) {
    throw new Error("This system can't encrypt the password, so the sync settings can't be stored.");
  }
  const config = cleanConfig(input.config);
  if (!config.apiKey || !config.authDomain || !config.projectId || !config.appId) {
    throw new Error("Fill in the API key, auth domain, project ID and app ID.");
  }
  const email = text(input.email);
  if (!email) throw new Error("Enter the email of the account to sync with.");

  // A left-out password means "keep the stored one", which only makes sense for the same account
  const stored = await readAccount();
  const password = input.password || (stored?.email === email ? stored.password : "");
  if (!password) throw new Error("Enter the password for this account.");

  const account = { config, email, password };
  await verifyFirebaseAccount(account, Boolean(input.createAccount));
  await writeAccount(account);
  await disconnectFirestore();

  // Another project or account is another copy of the data: start over, and upload everything to it
  if (stored?.config.projectId !== config.projectId || stored?.email !== email) resetSync(db);
}

export async function clearFirebaseSettings(db: Db) {
  await fs.rm(settingsFile(), { force: true });
  await disconnectFirestore();
  resetSync(db);
}

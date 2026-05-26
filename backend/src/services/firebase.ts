import * as admin from 'firebase-admin';
import { WhereFilterOp } from 'firebase-admin/firestore';
import serviceAccount from '../../firebase-service-account.json';

export const COLLECTIONS = {
  SLOTS: 'slots',
  LEADS: 'leads',
  INVITATIONS: 'invitations',
} as const;

// Initialise the Admin SDK once. Subsequent calls to getApps() prevent double-init
// if this module is imported multiple times (e.g. during hot-reload in dev).
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
    projectId: process.env.FIREBASE_PROJECT_ID,
  });
}

/** Firestore database instance — import this wherever you need raw access. */
export const db = admin.firestore();

/** Returns a typed CollectionReference for the given collection name. */
export function getCollection(name: string) {
  return db.collection(name);
}

/**
 * Creates a new document with an auto-generated ID.
 * Returns the new document's ID.
 */
export async function createDoc<T extends admin.firestore.DocumentData>(
  collection: string,
  data: T
): Promise<string> {
  await db.collection(collection).doc(data.id).set(data);
  return data.id;
}

/**
 * Fetches a single document by ID and returns it typed as T.
 * Throws a descriptive error if the document does not exist.
 */
export async function getDoc<T>(collection: string, id: string): Promise<T> {
  const snap = await db.collection(collection).doc(id).get();
  if (!snap.exists) {
    throw new Error(`Document ${id} not found in ${collection}`);
  }
  return snap.data() as T;
}

/**
 * Merges the supplied partial data into an existing document.
 * Uses { merge: true } so untouched fields are preserved.
 */
export async function updateDoc<T extends admin.firestore.DocumentData>(
  collection: string,
  id: string,
  data: Partial<T>
): Promise<void> {
  await db.collection(collection).doc(id).set(data, { merge: true });
}

/**
 * Queries a collection with a single where-clause and returns all matching
 * documents typed as T[].
 *
 * Example:
 *   queryCollection<Invitation>('invitations', 'slotId', '==', slotId)
 */
export async function queryCollection<T>(
  collection: string,
  field: string,
  operator: WhereFilterOp,
  value: unknown
): Promise<T[]> {
  const snap = await db.collection(collection).where(field, operator, value).get();
  return snap.docs.map((doc) => doc.data() as T);
}

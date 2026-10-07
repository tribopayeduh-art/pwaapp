/** Server-only Firestore access. Browser access is denied by firestore.rules. */
import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore as adminFirestore } from 'firebase-admin/firestore';
import type { Firestore, Transaction } from 'firebase-admin/firestore';

export function getFirestore(config: { projectId?: string; firestoreDatabaseId?: string }): Firestore {
  const app = getApps()[0] || initializeApp({
    projectId: process.env.FIREBASE_PROJECT_ID || config.projectId,
    credential: process.env.FIREBASE_SERVICE_ACCOUNT_JSON
      ? cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON))
      : applicationDefault()
  });
  const db = adminFirestore(app, config.firestoreDatabaseId || '(default)');
  db.settings({ ignoreUndefinedProperties: true });
  return db;
}
export const collection = (db: Firestore, name: string): any => db.collection(name);
export const doc = (db: Firestore, name: string, id: string): any => db.collection(name).doc(id);
export const where = (field: string, op: any, value: any) => ({ field, op, value });
export const query = (ref: any, ...filters: ReturnType<typeof where>[]): any =>
  filters.reduce((current, filter) => current.where(filter.field, filter.op, filter.value), ref);
export const getDocs = async (ref: any): Promise<any> => ref.get();
export const getDoc = async (ref: any): Promise<any> => {
  const snapshot = await ref.get();
  return { exists: () => snapshot.exists, data: () => snapshot.data(), id: snapshot.id };
};
export const setDoc = async (ref: any, data: any, options?: any): Promise<void> => {
  if (options) await ref.set(data, options); else await ref.set(data);
};
export const updateDoc = async (ref: any, data: any): Promise<void> => { await ref.update(data); };
export const deleteDoc = async (ref: any): Promise<void> => { await ref.delete(); };
export const runTransaction = async <T>(db: Firestore, callback: (transaction: any) => Promise<T>): Promise<T> =>
  db.runTransaction(async (transaction: Transaction) => callback({
    get: async (ref: any) => {
      const snapshot: any = await transaction.get(ref);
      return { exists: () => snapshot.exists, data: () => snapshot.data() };
    },
    update: (ref: any, data: any) => transaction.update(ref, data),
    set: (ref: any, data: any, options?: any) => options ? transaction.set(ref, data, options) : transaction.set(ref, data)
  }));

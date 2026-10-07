import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
process.env.JWT_SECRET = 'isolated-test-secret-with-no-live-integration';
process.env.ENABLE_DEMO_ADMIN = 'false';
const records = new Map();
let queue = Promise.resolve();
let failCommit = false;
const snapshot = data => ({ exists: () => data !== undefined, data: () => data });
const exports = {
  getFirestore: () => ({}),
  doc: (_db, collection, id) => `${collection}/${id}`,
  collection: (_db, collection) => collection,
  where: (field, op, value) => ({ field, op, value }),
  query: (collection, filter) => ({ collection, filter }),
  getDoc: async ref => snapshot(records.get(ref)),
  getDocs: async query => ({ empty: false, docs: [...records.entries()]
    .filter(([key, data]) => key.startsWith(`${query.collection}/`) && data[query.filter.field] === query.filter.value)
    .map(([, data]) => ({ data: () => data })) }),
  setDoc: async (ref, value) => { records.set(ref, value); },
  updateDoc: async (ref, value) => { if (failCommit) throw Error('offline'); records.set(ref, { ...records.get(ref), ...value }); },
  deleteDoc: async ref => { records.delete(ref); },
  runTransaction: async (_db, callback) => {
    const current = queue.then(async () => {
      const staged = new Map(structuredClone([...records]));
      const result = await callback({
        get: async ref => snapshot(staged.get(ref)),
        set: (ref, data, options) => staged.set(ref, options?.merge ? { ...staged.get(ref), ...data } : data),
        update: (ref, data) => { if (!staged.has(ref)) throw Error('missing'); staged.set(ref, { ...staged.get(ref), ...data }); }
      });
      if (failCommit) throw Error('offline');
      records.clear(); for (const [key, value] of staged) records.set(key, value);
      return result;
    });
    queue = current.catch(() => {});
    return current;
  }
};
mock.module('../server/firestoreAdapter.ts', { namedExports: exports });
const { FirestoreDB } = await import('../server/db.ts');
const { createSession, getSession, destroySession, verifyHmacSignature } = await import('../server/security.ts');
const db = new FirestoreDB();

function reset() { records.clear(); failCommit = false; records.set('users/player', { id: 'player', email: 'player@example.test', balance: 10 }); }
const charge = { id: 'c', chargeId: 'c', correlationID: 'c', userId: 'player', value: 2500, valueInReais: 25, status: 'PAID', description: 'Pix', createdAt: new Date().toISOString() };

test('concurrent deposit confirmations credit once, including another server instance', async () => {
  reset();
  const results = await Promise.all([db.creditChargeOnce(charge), new FirestoreDB().creditChargeOnce(charge)]);
  assert.equal(records.get('users/player').balance, 35);
  assert.equal(results.filter(Boolean).length, 1);
  assert.equal([...records.keys()].filter(key => key.startsWith('transactions/')).length, 1);
  assert.equal(await db.creditChargeOnce(charge), null);
});
test('failed commit neither credits wallet nor marks charge credited; retry succeeds', async () => {
  reset(); failCommit = true;
  await assert.rejects(db.creditChargeOnce(charge));
  assert.equal(records.get('users/player').balance, 10);
  assert.equal(records.has('charges/c'), false);
  failCommit = false; await db.creditChargeOnce(charge);
  assert.equal(records.get('users/player').balance, 35);
});
test('withdrawal rejection refunds once and cannot refund approved withdrawals', async () => {
  reset(); records.set('transactions/w', { id: 'w', type: 'withdrawal', status: 'pending', amount: 5, userId: 'player' });
  await db.rejectPlayerWithdrawal('w');
  assert.equal(records.get('users/player').balance, 15);
  await assert.rejects(db.rejectPlayerWithdrawal('w'));
  records.set('transactions/w', { id: 'w', type: 'withdrawal', status: 'approved', amount: 5, userId: 'player' });
  await assert.rejects(db.rejectPlayerWithdrawal('w'));
  assert.equal(records.get('users/player').balance, 15);
});
test('durable withdrawal reservation blocks concurrent and later submissions', async () => {
  reset(); records.set('transactions/w', { id: 'w', type: 'withdrawal', status: 'pending', amount: 5, userId: 'player' });
  const result = await Promise.allSettled([db.claimWithdrawal('w'), new FirestoreDB().claimWithdrawal('w')]);
  assert.equal(result.filter(x => x.status === 'fulfilled').length, 1);
  await assert.rejects(db.rejectPlayerWithdrawal('w'));
});
test('gateway failure refunds player wallet once and ignores duplicate/out-of-order events', async () => {
  reset(); records.set('transactions/w', { id: 'w', type: 'withdrawal', status: 'pending', amount: 5, userId: 'player', dotfyWithdrawalId: 'bank' });
  assert.equal(await db.settleGatewayWithdrawal('w', 'bank', false), true);
  assert.equal(await db.settleGatewayWithdrawal('w', 'bank', false), false);
  assert.equal(await db.settleGatewayWithdrawal('w', 'bank', true), false);
  assert.equal(records.get('users/player').balance, 15);
  assert.equal(records.get('transactions/w').status, 'rejected');
});
test('gateway failure refunds affiliate wallet without crediting game wallet', async () => {
  reset(); records.set('affiliates/a', { id: 'a', userId: 'player', affiliateBalance: 20 });
  records.set('transactions/tx_aff_wd_w', { id: 'tx_aff_wd_w', type: 'withdrawal', status: 'pending', amount: 5, userId: 'player', dotfyWithdrawalId: 'bank' });
  await db.settleGatewayWithdrawal('tx_aff_wd_w', 'bank', false);
  assert.equal(records.get('affiliates/a').affiliateBalance, 25);
  assert.equal(records.get('users/player').balance, 10);
});
test('invalid deposit amount and failed wallet write reject rather than report success', async () => {
  reset(); await assert.rejects(db.creditChargeOnce({ ...charge, valueInReais: Infinity }));
  failCommit = true; await assert.rejects(db.updateUserBalance('player', 50));
  assert.equal(records.get('users/player').balance, 10);
});
test('session requires signed token; forged legacy tokens fail; logout revokes current token', () => {
  const token = createSession('usr_admin_master');
  assert.equal(getSession(token)?.userId, 'usr_admin_master');
  assert.equal(getSession(token.slice(0, -1) + (token.endsWith('a') ? 'b' : 'a')), null);
  assert.equal(getSession('tok_usr_admin_master_anything'), null);
  destroySession(token); assert.equal(getSession(token), null);
});
test('webhook authentication rejects missing signature or secret', () => {
  assert.equal(verifyHmacSignature('{}', '', 'secret'), false);
  assert.equal(verifyHmacSignature('{}', 'abc', ''), false);
});

test('stale charge polling cannot erase confirmed credit marker', async () => {
  reset(); await db.creditChargeOnce(charge);
  await db.saveCharge({ ...charge, status: 'PENDING', credited: false });
  assert.equal(records.get('charges/c').credited, true);
  assert.equal(records.get('charges/c').status, 'PAID');
  assert.equal(await db.creditChargeOnce(charge), null);
});
test('concurrent game starts cannot spend the same balance twice', async () => {
  reset();
  const bet = { userId: 'player', gameId: 'g_block_puzzle', betAmount: 8, payoutAmount: 0, status: 'active' };
  const results = await Promise.allSettled([db.startGameBetAtomic({ ...bet, id: 'b1' }), db.startGameBetAtomic({ ...bet, id: 'b2' })]);
  assert.equal(results.filter(x => x.status === 'fulfilled').length, 1);
  assert.equal(records.get('users/player').balance, 2);
});
test('concurrent game settlement pays once and creates one game award entry', async () => {
  reset(); records.set('gameBets/b', { id: 'b', userId: 'player', betAmount: 5, status: 'active' });
  const results = await Promise.allSettled([db.settleGameBetAtomic('b', 'player', 15, 'cashed_out', 'BlockWin'), db.settleGameBetAtomic('b', 'player', 15, 'cashed_out', 'BlockWin')]);
  assert.equal(results.filter(x => x.status === 'fulfilled').length, 1);
  assert.equal(records.get('users/player').balance, 25);
  assert.equal(records.get('gameBets/b').status, 'cashed_out');
  assert.equal(records.get('transactions/game_b').amount, 15);
});
test('game settlement cannot pay a different player or commit a partial award', async () => {
  reset(); records.set('gameBets/b', { id: 'b', userId: 'other', betAmount: 5, status: 'active' });
  await assert.rejects(db.settleGameBetAtomic('b', 'player', 15, 'cashed_out', 'BlockWin'));
  records.set('gameBets/b', { id: 'b', userId: 'player', betAmount: 5, status: 'active' });
  failCommit = true;
  await assert.rejects(db.settleGameBetAtomic('b', 'player', 15, 'cashed_out', 'BlockWin'));
  assert.equal(records.get('users/player').balance, 10);
  assert.equal(records.get('gameBets/b').status, 'active');
  assert.equal(records.has('transactions/game_b'), false);
});
test('session revocation is persisted for another server instance', async () => {
  reset(); const token = createSession('player');
  assert.equal(await db.isSessionRevoked(token), false);
  await db.revokeSession(token);
  assert.equal(await new FirestoreDB().isSessionRevoked(token), true);
});

test('operation note saves one revision and prevents concurrent overwrite', async () => {
  reset();
  const note = { note: 'Conferir retorno do banco', priority: 'urgent', reviewed: false, updatedBy: 'admin', updatedByName: 'Operador' };
  const result = await Promise.allSettled([db.saveAdminOperationNote('withdrawal-note', note, 0), new FirestoreDB().saveAdminOperationNote('withdrawal-note', { ...note, note: 'Outra revisão' }, 0)]);
  assert.equal(result.filter(item => item.status === 'fulfilled').length, 1);
  assert.equal(records.get('admin_operation_notes/withdrawal-note').revision, 1);
  const conflict = result.find(item => item.status === 'rejected');
  assert.equal(conflict.reason.status, 409);
  const saved = await db.saveAdminOperationNote('withdrawal-note', { ...note, reviewed: true }, 1);
  assert.equal(saved.revision, 2);
  assert.equal(saved.reviewed, true);
});
test('operation note commit failure preserves previous review', async () => {
  reset(); records.set('admin_operation_notes/withdrawal-note', { note: 'Revisão anterior', revision: 2 }); failCommit = true;
  await assert.rejects(db.saveAdminOperationNote('withdrawal-note', { note: 'Novo texto' }, 2));
  assert.equal(records.get('admin_operation_notes/withdrawal-note').note, 'Revisão anterior');
  assert.equal(records.get('admin_operation_notes/withdrawal-note').revision, 2);
});

import assert from 'assert';
import crypto from 'crypto';
import { CredentialService } from '../src/server/security/credentialService';
import { kieAiProvider } from '../src/server/providers/kieAiProvider';
import { initDb, db } from '../src/server/db';
import { AuditService } from '../src/server/services/auditService';

async function runTests() {
  console.log('--- STARTING SUNOMAKER BYOK & SECURITY SUITE ---');

  // 1. Test Database Init
  await initDb();
  console.log('✓ Database initialized successfully.');

  // 2. Test Credential Encryption & Decryption
  const testKey = 'kie_test_live_secret_1234567890ABCDEF';
  const encrypted = CredentialService.encryptApiKey(testKey);

  assert(encrypted.startsWith('v1:'), 'Encrypted payload must follow versioned format v1:iv:tag:ciphertext');
  assert(!encrypted.includes(testKey), 'Encrypted payload must never contain plaintext key');

  const decrypted = CredentialService.decryptApiKey(encrypted);
  assert.strictEqual(decrypted, testKey, 'Decrypted key must match original test key');
  console.log('✓ AES-256-GCM authenticated encryption and decryption validated.');

  // 3. Test Masking
  const masked = CredentialService.maskApiKey(testKey);
  assert.strictEqual(masked, '****************CDEF', 'Key masking must only expose the last 4 characters');
  assert(!masked.includes('1234567890'), 'Masked key must not expose initial or middle characters');
  console.log('✓ API Key masking verified.');

  // 4. Test User Credential Storage & Isolation (USER A vs USER B)
  const userA_Id = 'test_user_a_' + Date.now();
  const userB_Id = 'test_user_b_' + Date.now();
  const userA_Key = 'kie_mock_user_A_key_99991111';
  const userB_Key = 'kie_mock_user_B_key_88882222';
  const now = new Date().toISOString();

  // Create test users in users table
  await db.execute({
    sql: 'INSERT INTO users (id, name, email, passwordHash, role, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    args: [userA_Id, 'User A', `usera_${Date.now()}@test.com`, 'hash', 'USER', 'ACTIVE', now, now],
  });
  await db.execute({
    sql: 'INSERT INTO users (id, name, email, passwordHash, role, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    args: [userB_Id, 'User B', `userb_${Date.now()}@test.com`, 'hash', 'USER', 'ACTIVE', now, now],
  });

  // Save User A credentials
  await CredentialService.saveCredential(userA_Id, userA_Key);
  const credA = await CredentialService.getCredential(userA_Id);
  assert(credA, 'User A credential must exist');
  assert.strictEqual(credA.maskedKey, '****************1111');
  assert.strictEqual(credA.keyLastFour, '1111');
  // Confirm getCredential does NOT have encryptedApiKey or raw key
  assert(!('encryptedApiKey' in credA), 'getCredential must not expose encryptedApiKey');
  assert(!('rawApiKey' in credA), 'getCredential must not expose rawApiKey');

  // Save User B credentials
  await CredentialService.saveCredential(userB_Id, userB_Key);
  const credB = await CredentialService.getCredential(userB_Id);
  assert(credB, 'User B credential must exist');
  assert.strictEqual(credB.maskedKey, '****************2222');

  // Verify memory decryption only yields the matching user's key
  const decA = await CredentialService.getDecryptedKey(userA_Id);
  const decB = await CredentialService.getDecryptedKey(userB_Id);
  assert.strictEqual(decA, userA_Key, 'User A decrypted key must belong to User A');
  assert.strictEqual(decB, userB_Key, 'User B decrypted key must belong to User B');
  assert.notStrictEqual(decA, decB, 'User A and User B must never share credentials');
  console.log('✓ Multi-user BYOK credential isolation verified.');

  // 5. Test Disconnect
  await CredentialService.deleteCredential(userA_Id);
  const credAAfter = await CredentialService.getCredential(userA_Id);
  assert.strictEqual(credAAfter, null, 'Deleted credential must return null');
  console.log('✓ Disconnect and credential deletion verified.');

  // 6. Test Provider Connection Testing (Valid vs Invalid)
  const validTest = await kieAiProvider.testConnection('kie_mock_test_key_ok');
  assert.strictEqual(validTest.success, true, 'Valid mock key should pass');

  const invalidTest = await kieAiProvider.testConnection('invalid_short');
  assert.strictEqual(invalidTest.success, false, 'Invalid format key should be rejected');
  console.log('✓ Kie.ai provider connection test validated.');

  // 7. Test Music Generation Lifecycle
  const genResult = await kieAiProvider.generateMusic(userB_Key, {
    title: 'Test Song',
    prompt: 'Synthwave test',
    model: 'suno-v4',
  });
  assert(genResult.taskId, 'Generation must return a taskId');

  // Check task status
  const taskStatus = await kieAiProvider.getTaskStatus(userB_Key, genResult.taskId);
  assert(['QUEUED', 'PROCESSING', 'COMPLETED'].includes(taskStatus.status), 'Task status must be valid enum');
  console.log('✓ Generation dispatch and task status polling validated.');

  // 8. Test Audit Logs Privacy
  await AuditService.log(userB_Id, 'TEST_EVENT', {
    apiKey: 'SHOULD_BE_STRIPPED',
    token: 'SHOULD_BE_STRIPPED',
    safeField: 'SAFE_METADATA',
  });
  const logs = await AuditService.getRecentLogs(5);
  const testLog = logs.find((l) => l.userId === userB_Id && l.action === 'TEST_EVENT');
  assert(testLog, 'Audit log must be created');
  const detailsStr = String(testLog.details || '');
  assert(!detailsStr.includes('SHOULD_BE_STRIPPED'), 'Audit log must strip sensitive keys');
  assert(detailsStr.includes('SAFE_METADATA'), 'Audit log must retain safe metadata');
  console.log('✓ Audit logging security & stripping verified.');

  console.log('==================================================');
  console.log('ALL SUNOMAKER BYOK TESTS PASSED SUCCESSFULLY! (100%)');
  console.log('==================================================');
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});

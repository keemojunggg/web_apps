import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { appendTaskEvent, captureTaskHistoryBaseline, loadSettings, loadTaskHistory, loadTasks, saveSettings, saveTasks, saveTasksWithEvents } from './taskStorage.js';
import { buildDailyReportData } from './reportData.js';

const DB_NAME = 'task-planner';
const SETTINGS_KEY = 'task-planner.settings.v1';
const LEGACY_TASK_KEY = 'task-planner.tasks.v1';

function installLocalStorage() {
  const values = new Map();
  globalThis.localStorage = {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    clear: () => values.clear(),
    _values: values,
  };
}

function openDatabase(name = DB_NAME, version) {
  return new Promise((resolve, reject) => {
    const request = version === undefined ? indexedDB.open(name) : indexedDB.open(name, version);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionComplete(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error || new Error('transaction aborted'));
  });
}

async function createVersionTwoDatabase({ tasks = [], files = [], metadata = [{ key: 'initialized', value: true }], metadataKeyPath = 'key' } = {}) {
  await new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2);
    request.onupgradeneeded = () => {
      const database = request.result;
      database.createObjectStore('tasks', { keyPath: 'id' });
      database.createObjectStore('attachments', { keyPath: 'id' });
      database.createObjectStore('metadata', { keyPath: metadataKeyPath });
      const transaction = request.transaction;
      tasks.forEach((task) => transaction.objectStore('tasks').put(task));
      files.forEach((file) => transaction.objectStore('attachments').put(file));
      metadata.forEach((record) => transaction.objectStore('metadata').put(record));
    };
    request.onsuccess = () => { request.result.close(); resolve(); };
    request.onerror = () => reject(request.error);
  });
}

async function readRecords(storeName) {
  const database = await openDatabase();
  const transaction = database.transaction(storeName, 'readonly');
  const done = transactionComplete(transaction);
  const request = transaction.objectStore(storeName).getAll();
  const records = await new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  await done;
  database.close();
  return records;
}

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  installLocalStorage();
});

test('increments an existing v2 database and preserves tasks, unknown fields, attachment bytes, settings, and reminder data', async () => {
  const bytes = new Uint8Array([0, 17, 32, 255]);
  const attachmentBlob = new Blob([bytes], { type: 'application/octet-stream' });
  const originalTask = {
    id: 'preserve-id-9', title: 'Keep every field', dateKey: '2026-10-18', hour: 13, minute: 25,
    priority: 'urgent', repeat: 'weekly', notify: true, done: false, createdAt: 12345,
    customFutureField: { keep: true },
    attachments: [{ id: 'file-1', name: 'data.bin', type: 'application/octet-stream', size: bytes.length }],
  };
  await createVersionTwoDatabase({ tasks: [originalTask], files: [{ id: 'file-1', taskId: originalTask.id, name: 'data.bin', type: attachmentBlob.type, size: bytes.length, blob: attachmentBlob }] });
  const settingsValue = JSON.stringify({ theme: 'dark', notifyDefault: false, leadMinutes: 30, profileName: 'ผู้ใช้เดิม', sentReminders: ['reminder-1', 'reminder-2'] });
  localStorage.setItem(SETTINGS_KEY, settingsValue);

  const loaded = await loadTasks();
  assert.equal(loaded.error, '');
  assert.equal(loaded.tasks.length, 1);
  assert.equal(loaded.tasks[0].id, originalTask.id);
  assert.deepEqual(loaded.tasks[0].customFutureField, originalTask.customFutureField);
  assert.equal(loaded.tasks[0].repeat, 'weekly');
  assert.equal(loaded.tasks[0].notify, true);
  assert.deepEqual(loaded.tasks[0].attachments.map(({ id, name, type, size }) => ({ id, name, type, size })), originalTask.attachments);
  const loadedBlob = loaded.tasks[0].attachments.find((file) => file.blob instanceof Blob)?.blob;
  assert.ok(loadedBlob instanceof Blob);
  assert.equal(loadedBlob.type, 'application/octet-stream');
  assert.equal(loadedBlob.size, bytes.length);
  assert.deepEqual(new Uint8Array(await loadedBlob.arrayBuffer()), bytes);
  const storedFiles = await readRecords('attachments');
  assert.equal(storedFiles.length, 1);
  assert.deepEqual(
    { id: storedFiles[0].id, taskId: storedFiles[0].taskId, name: storedFiles[0].name, type: storedFiles[0].type, size: storedFiles[0].size },
    { id: 'file-1', taskId: originalTask.id, name: 'data.bin', type: 'application/octet-stream', size: bytes.length },
  );
  assert.deepEqual(new Uint8Array(await storedFiles[0].blob.arrayBuffer()), bytes);

  const history = await loadTaskHistory();
  assert.ok(Number.isFinite(history.trackingStartedAt));
  assert.ok(history.trackingStartedAt > 0);
  assert.deepEqual(history.events, []);
  assert.equal(localStorage.getItem(SETTINGS_KEY), settingsValue);
  assert.deepEqual(loadSettings().sentReminders, ['reminder-1', 'reminder-2']);
});

test('imports legacy records with missing optional fields and unknown fields without changing their IDs', async () => {
  const legacy = [
    { id: 'legacy-id-1', title: 'Legacy task', dateKey: '2026-10-21', hour: 10, minute: 5, priority: 'scheduled', done: false, extra: 'preserve me' },
    { id: 'legacy-id-2', title: 'Unscheduled legacy' },
  ];
  localStorage.setItem(LEGACY_TASK_KEY, JSON.stringify(legacy));
  const loaded = await loadTasks();

  assert.equal(loaded.error, '');
  assert.deepEqual(loaded.tasks.map((task) => task.id), ['legacy-id-1', 'legacy-id-2']);
  assert.equal(loaded.tasks[0].extra, 'preserve me');
  assert.equal(loaded.tasks[0].description, '');
  assert.equal(loaded.tasks[0].repeat, 'none');
  assert.equal(loaded.tasks[0].notify, false);
  assert.equal(loaded.tasks[1].dateKey, '');
  assert.equal(loaded.tasks[1].hour, 9);
  assert.equal(localStorage.getItem(LEGACY_TASK_KEY), JSON.stringify(legacy));
  assert.ok(localStorage.getItem(`${LEGACY_TASK_KEY}.migrated`));
});

test('migration reruns do not duplicate legacy tasks or append-only history events', async () => {
  localStorage.setItem(LEGACY_TASK_KEY, JSON.stringify([{ id: 'once-only', title: 'Imported once' }]));
  const firstLoad = await loadTasks();
  const secondLoad = await loadTasks();
  assert.deepEqual(firstLoad.tasks.map((task) => task.id), ['once-only']);
  assert.deepEqual(secondLoad.tasks.map((task) => task.id), ['once-only']);
  assert.equal((await readRecords('tasks')).length, 1);

  const event = { id: 'event-stable-id', taskId: 'once-only', type: 'created', occurredAt: 1_800_000_000_000, payload: { source: 'test' } };
  assert.deepEqual(await appendTaskEvent(event), { written: true, duplicate: false });
  assert.deepEqual(await appendTaskEvent(event), { written: false, duplicate: true });
  const history = await loadTaskHistory({ taskId: 'once-only' });
  assert.deepEqual(history.events, [{ ...event, sequence: 1 }]);
});

test('failed schema migration leaves the prior database version and user records intact and returns an error', async () => {
  const originalTask = { id: 'must-survive', title: 'Do not overwrite me' };
  const originalBytes = new Uint8Array([4, 8, 15, 16, 23, 42]);
  const originalBlob = new Blob([originalBytes], { type: 'application/x-preserve-test' });
  const originalFile = { id: 'preserve-attachment', taskId: originalTask.id, name: 'preserve.bin', type: originalBlob.type, size: originalBlob.size, blob: originalBlob };
  await createVersionTwoDatabase({ tasks: [originalTask], files: [originalFile], metadata: [{ id: 'initialized', value: true }], metadataKeyPath: 'id' });
  const settingsValue = JSON.stringify({ theme: 'dark', sentReminders: ['keep-this-reminder'] });
  localStorage.setItem(SETTINGS_KEY, settingsValue);
  localStorage.setItem('task-planner.other-reminder-state', 'reminder-state-unchanged');

  const loaded = await loadTasks();
  assert.equal(loaded.tasks.length, 0);
  assert.equal(loaded.errorCode, 'MIGRATION_SCHEMA_UNSUPPORTED');
  assert.match(loaded.error, /ข้อมูลเดิมไม่ถูกลบ/);
  assert.equal(localStorage.getItem(SETTINGS_KEY), settingsValue);
  assert.equal(localStorage.getItem('task-planner.other-reminder-state'), 'reminder-state-unchanged');

  const database = await openDatabase();
  assert.equal(database.version, 2);
  assert.deepEqual(Array.from(database.objectStoreNames).sort(), ['attachments', 'metadata', 'tasks']);
  const transaction = database.transaction('tasks', 'readonly');
  const done = transactionComplete(transaction);
  const request = transaction.objectStore('tasks').get(originalTask.id);
  const stored = await new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  await done;
  database.close();
  assert.deepEqual(stored, originalTask);
  assert.deepEqual(await readRecords('attachments'), [originalFile]);
  const preservedBlob = (await readRecords('attachments'))[0].blob;
  assert.equal(preservedBlob.type, originalBlob.type);
  assert.equal(preservedBlob.size, originalBytes.length);
  assert.deepEqual(new Uint8Array(await preservedBlob.arrayBuffer()), originalBytes);
  assert.deepEqual((await readRecords('metadata')).sort((a, b) => a.id.localeCompare(b.id)), [{ id: 'initialized', value: true }]);
  assert.deepEqual(loadSettings(), {
    theme: 'dark', notifyDefault: true, leadMinutes: 15, profileName: 'ผู้ใช้งาน',
    sentReminders: ['keep-this-reminder'], morningBriefingEnabled: true, morningBriefingTime: '07:00', lastBriefingDate: '',
  });
});

test('fresh installation seeds once and marks tracking start without fabricating history', async () => {
  const first = await loadTasks();
  assert.equal(first.error, '');
  assert.ok(first.tasks.length > 0);
  const history = await loadTaskHistory();
  assert.ok(Number.isFinite(history.trackingStartedAt));
  assert.deepEqual(history.events, []);
  const second = await loadTasks();
  assert.deepEqual(second.tasks.map((task) => task.id), first.tasks.map((task) => task.id));
});

test('an initialized intentionally empty database remains empty and is not seeded', async () => {
  await createVersionTwoDatabase({ tasks: [], metadata: [{ key: 'initialized', value: true }] });
  const loaded = await loadTasks();
  assert.equal(loaded.error, '');
  assert.deepEqual(loaded.tasks, []);
  assert.deepEqual(await readRecords('tasks'), []);
});

test('malformed legacy records abort import and do not get replaced with seeds', async () => {
  const legacy = [{ id: 'valid', title: 'Keep me' }, { id: 'invalid', title: '   ' }];
  localStorage.setItem(LEGACY_TASK_KEY, JSON.stringify(legacy));
  const loaded = await loadTasks();
  assert.deepEqual(loaded.tasks, []);
  assert.match(loaded.error, /ไม่สมบูรณ์/);
  assert.equal(localStorage.getItem(LEGACY_TASK_KEY), JSON.stringify(legacy));
});

test('settings and reminder IDs continue to round-trip without a schema reset', () => {
  const settings = {
    theme: 'dark', notifyDefault: false, leadMinutes: 60, profileName: 'เดิม', sentReminders: ['r1', 'r2'],
    morningBriefingEnabled: true, morningBriefingTime: '07:00', lastBriefingDate: '',
  };
  assert.equal(saveSettings(settings), true);
  assert.deepEqual(loadSettings(), settings);
});

test('Phase 2 pin, snooze, archive, cancel, and recurrence anchor fields round-trip in the existing store', async () => {
  await loadTasks();
  const phaseTwoTask = {
    id: 'phase-two-state', title: 'Preserve recovery state', dateKey: '2026-10-18', hour: 13, minute: 10,
    priority: 'relaxed', repeat: 'monthly', done: false, notify: true, createdAt: 1234,
    pinned: true, snoozedUntil: 1_800_000_100_000, archived: true, cancelled: false,
    recurrenceAnchorDate: '2026-01-31', seriesId: 'series-31',
    description: 'unchanged', attachments: [{ id: 'metadata-only', name: 'reference.bin', type: 'application/octet-stream', size: 21 }],
  };
  assert.equal(await saveTasks([phaseTwoTask]), true);
  const reloaded = await loadTasks();
  assert.equal(reloaded.error, '');
  assert.deepEqual(reloaded.tasks, [{
    ...phaseTwoTask,
    attachments: [{ id: 'metadata-only', name: 'reference.bin', type: 'application/octet-stream', size: 21 }],
  }]);
});

test('saving attachment metadata without an in-memory Blob does not delete the existing stored file bytes', async () => {
  await loadTasks();
  const bytes = new Uint8Array([9, 8, 7, 6]);
  const blob = new Blob([bytes], { type: 'application/x-retained' });
  const task = {
    id: 'metadata-write-task', title: 'Retain file', dateKey: '', hour: 9, minute: 0,
    priority: 'scheduled', repeat: 'none', notify: false, done: false, createdAt: 321,
    attachments: [{ id: 'retained-file', name: 'keep.bin', type: blob.type, size: blob.size, blob }],
  };
  assert.equal(await saveTasks([task]), true);
  const metadataOnlyTask = { ...task, attachments: [{ id: 'retained-file', name: 'keep.bin', type: blob.type, size: blob.size }] };
  assert.equal(await saveTasks([metadataOnlyTask]), true);

  const fileRecords = await readRecords('attachments');
  assert.equal(fileRecords.length, 1);
  assert.equal(fileRecords[0].id, 'retained-file');
  assert.equal(fileRecords[0].taskId, task.id);
  assert.equal(fileRecords[0].blob.type, blob.type);
  assert.equal(fileRecords[0].blob.size, bytes.length);
  assert.deepEqual(new Uint8Array(await fileRecords[0].blob.arrayBuffer()), bytes);
  const reloaded = await loadTasks();
  assert.equal(reloaded.tasks[0].attachments[0].blob.size, bytes.length);
});

test('captures one explicit baseline without inventing creation or completion history', async () => {
  const task = {
    id: 'baseline-task', title: 'Observed state', dateKey: '2026-11-01', hour: 11, minute: 25,
    priority: 'urgent', repeat: 'weekly', done: false, archived: false, cancelled: false,
    createdAt: 123, seriesId: 'baseline-series', attachments: [{ id: 'file-ref', name: 'keep.bin' }],
  };
  await loadTasks();
  assert.equal(await saveTasks([task]), true);
  const first = await captureTaskHistoryBaseline([task]);
  const second = await captureTaskHistoryBaseline([]);
  assert.equal(first.captured, true);
  assert.equal(second.captured, false);
  assert.equal(second.capturedAt, first.capturedAt);
  const history = await loadTaskHistory();
  assert.equal(history.baselineCapturedAt, first.capturedAt);
  assert.equal(history.baselineSequence, history.events[0].sequence);
  assert.equal(history.historyComplete, true);
  assert.equal(history.events.length, 1);
  assert.equal(history.events[0].type, 'baseline-captured');
  assert.equal(history.events[0].eventVersion, 1);
  assert.equal(history.events[0].occurrenceId, task.id);
  assert.equal(history.events[0].seriesId, 'baseline-series');
  assert.deepEqual(history.events[0].snapshot, {
    dueDate: '2026-11-01', dueHour: 11, dueMinute: 25, priority: 'urgent', repeat: 'weekly',
    done: false, archived: false, cancelled: false, snoozedUntil: null, deleted: false,
  });

  test('settings add a local briefing time without breaking existing saved preferences', () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ theme: 'dark', notifyDefault: false, leadMinutes: 30, profileName: 'Existing user' }));
    assert.deepEqual(loadSettings(), {
      theme: 'dark',
      notifyDefault: false,
      leadMinutes: 30,
      profileName: 'Existing user',
      sentReminders: [],
      morningBriefingEnabled: true,
      morningBriefingTime: '07:00',
      lastBriefingDate: '',
    });
    assert.equal(saveSettings({
      ...loadSettings(),
      morningBriefingEnabled: false,
      morningBriefingTime: '08:15',
      lastBriefingDate: '2026-10-25',
    }), true);
    assert.equal(loadSettings().morningBriefingEnabled, false);
    assert.equal(loadSettings().morningBriefingTime, '08:15');
    assert.equal(loadSettings().lastBriefingDate, '2026-10-25');
  });

  test('reports recalculate after atomic completion and reopen persistence and survive reload', async () => {
    await loadTasks();
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 1);
    const dateKey = `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, '0')}-${String(dueDate.getDate()).padStart(2, '0')}`;
    const endOfReportDay = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate() + 1).getTime() - 1;
    const task = {
      id: 'report-progress-roundtrip',
      title: 'Report progress round trip',
      dateKey,
      hour: 9,
      minute: 0,
      priority: 'scheduled',
      repeat: 'none',
      done: false,
      attachments: [],
    };
    await saveTasks([task]);
    await captureTaskHistoryBaseline([task]);

    const before = await loadTaskHistory();
    assert.equal(buildDailyReportData({ date: dueDate, now: endOfReportDay, history: before }).metrics.completionRate.value, 0);

    const completedAt = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate(), 10).getTime();
    const completedTask = { ...task, done: true };
    assert.equal(await saveTasksWithEvents([completedTask], [{
      id: 'report-progress-completed',
      taskId: task.id,
      occurrenceId: task.id,
      type: 'completed',
      eventVersion: 1,
      occurredAt: completedAt,
      completedAt,
      snapshot: { dueDate: dateKey, dueHour: 9, dueMinute: 0, done: true, deleted: false },
    }]), true);
    const afterCompletion = await loadTaskHistory();
    assert.equal(buildDailyReportData({ date: dueDate, now: endOfReportDay, history: afterCompletion }).metrics.completionRate.value, 1);

    const reopenedAt = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate(), 11).getTime();
    assert.equal(await saveTasksWithEvents([task], [{
      id: 'report-progress-reopened',
      taskId: task.id,
      occurrenceId: task.id,
      type: 'reopened',
      eventVersion: 1,
      occurredAt: reopenedAt,
      snapshot: { dueDate: dateKey, dueHour: 9, dueMinute: 0, done: false, deleted: false },
    }]), true);
    const afterReopen = await loadTaskHistory();
    assert.equal(buildDailyReportData({ date: dueDate, now: endOfReportDay, history: afterReopen }).metrics.completionRate.value, 0);
    assert.equal((await loadTasks()).tasks.find((item) => item.id === task.id).done, false);
  });
  assert.equal(history.events[0].snapshot.createdAt, undefined);
  assert.equal(history.events[0].snapshot.attachments, undefined);
  assert.equal((await loadTaskHistory({ taskId: task.id })).historyComplete, false);
  const database = await openDatabase();
  assert.equal(database.version, 3);
  database.close();
});

test('saves task changes and ordered immutable history events in one transaction', async () => {
  await loadTasks();
  const original = {
    id: 'atomic-task', title: 'Original', dateKey: '2026-11-01', hour: 9, minute: 0,
    priority: 'scheduled', repeat: 'none', done: false, attachments: [],
  };
  const dueSnapshot = { dueDate: original.dateKey, dueHour: 9, dueMinute: 0, done: false, deleted: false };
  const events = [
    { id: 'atomic-created', taskId: original.id, occurrenceId: original.id, type: 'created', eventVersion: 1, occurredAt: 100, snapshot: dueSnapshot },
    { id: 'atomic-completed', taskId: original.id, occurrenceId: original.id, type: 'completed', eventVersion: 1, occurredAt: 100, completedAt: 100, snapshot: { ...dueSnapshot, done: true } },
  ];
  assert.equal(await saveTasksWithEvents([{ ...original, done: true }], events), true);
  const history = await loadTaskHistory({ taskId: original.id });
  assert.deepEqual(history.events.map(({ id, sequence }) => [id, sequence]), [
    ['atomic-created', 1],
    ['atomic-completed', 2],
  ]);
  assert.equal((await loadTasks()).tasks.find((task) => task.id === original.id).done, true);

  const invalidEvent = { id: '', taskId: original.id, type: 'invalid', occurredAt: 300 };
  assert.equal(await saveTasksWithEvents([{ ...original, title: 'Must not commit' }], [invalidEvent]), false);
  assert.equal((await loadTasks()).tasks.find((task) => task.id === original.id).title, 'Original');
  assert.equal((await loadTaskHistory({ taskId: original.id })).events.length, 2);
});

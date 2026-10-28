import { buildSeedTasks } from './seedData.js';

const DB_NAME = 'task-planner';
const DB_VERSION = 3;
const TASK_STORE = 'tasks';
const FILE_STORE = 'attachments';
const META_STORE = 'metadata';
const EVENT_STORE = 'taskEvents';
const TRACKING_STARTED_KEY = 'trackingStartedAt';
const HISTORY_BASELINE_KEY = 'historyBaselineCapturedAt';
const HISTORY_SEQUENCE_KEY = 'historyEventSequence';
const SETTINGS_KEY = 'task-planner.settings.v1';
const LEGACY_TASK_KEYS = ['task-planner.tasks.v1', 'task-planner.tasks'];
let saveQueue = Promise.resolve();

function storageError(code, message, cause) {
  const error = new Error(message, cause ? { cause } : undefined);
  error.code = code;
  return error;
}

function isValidDateKey(value) {
  if (!value) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function normalizeTask(task, index) {
  if (!task || typeof task !== 'object' || typeof task.title !== 'string' || !task.title.trim()) return null;
  const hour = Number.isInteger(task.hour) && task.hour >= 0 && task.hour <= 23 ? task.hour : 9;
  const minute = Number.isInteger(task.minute) && task.minute >= 0 && task.minute <= 59 ? task.minute : 0;
  const allowedRepeats = ['none', 'daily', 'weekly', 'monthly'];
  const allowedPriorities = ['urgent', 'scheduled', 'relaxed', 'slow'];
  const attachments = Array.isArray(task.attachments) ? task.attachments.flatMap((file, fileIndex) => {
    if (!file || typeof file.name !== 'string') return [];
    if (file.blob instanceof Blob) return [{ id: String(file.id || `${task.id || index}-file-${fileIndex}`), name: file.name, type: file.type || file.blob.type || 'application/octet-stream', size: file.size || file.blob.size, blob: file.blob }];
    if (typeof file.dataUrl === 'string') return [{ id: String(file.id || `${task.id || index}-file-${fileIndex}`), name: file.name, type: file.type || 'application/octet-stream', size: Number(file.size) || 0, legacyDataUrl: file.dataUrl }];
    return [{
      ...file,
      id: String(file.id || `${task.id || index}-file-${fileIndex}`),
      name: file.name,
      type: typeof file.type === 'string' ? file.type : 'application/octet-stream',
      size: Number.isFinite(file.size) && file.size >= 0 ? file.size : 0,
    }];
  }) : [];

  return {
    ...task,
    id: typeof task.id === 'string' && task.id ? task.id : `restored-${index}-${Date.now()}`,
    title: task.title.trim(),
    description: typeof task.description === 'string' ? task.description : '',
    dateKey: isValidDateKey(task.dateKey) ? (task.dateKey || '') : '',
    hour,
    minute,
    priority: allowedPriorities.includes(task.priority) ? task.priority : 'scheduled',
    repeat: allowedRepeats.includes(task.repeat) ? task.repeat : 'none',
    notify: task.notify === true,
    done: task.done === true,
    archived: task.archived === true,
    cancelled: task.cancelled === true,
    pinned: task.pinned === true,
    snoozedUntil: Number.isFinite(task.snoozedUntil) ? task.snoozedUntil : null,
    recurrenceAnchorDate: isValidDateKey(task.recurrenceAnchorDate) ? (task.recurrenceAnchorDate || '') : '',
    createdAt: Number.isFinite(task.createdAt) ? task.createdAt : Date.now(),
    seriesId: typeof task.seriesId === 'string' ? task.seriesId : undefined,
    attachments,
  };
}

function openDatabase() {
  if (!('indexedDB' in globalThis)) return Promise.reject(new Error('เบราว์เซอร์นี้ไม่รองรับ IndexedDB'));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    let upgradeFailure = null;
    request.onupgradeneeded = (event) => {
      const database = request.result;
      const transaction = request.transaction;
      if (!database.objectStoreNames.contains(TASK_STORE)) database.createObjectStore(TASK_STORE, { keyPath: 'id' });
      if (!database.objectStoreNames.contains(FILE_STORE)) database.createObjectStore(FILE_STORE, { keyPath: 'id' });
      if (!database.objectStoreNames.contains(META_STORE)) database.createObjectStore(META_STORE, { keyPath: 'key' });
      if (!database.objectStoreNames.contains(EVENT_STORE)) {
        const events = database.createObjectStore(EVENT_STORE, { keyPath: 'id' });
        events.createIndex('byTaskId', 'taskId', { unique: false });
        events.createIndex('byOccurredAt', 'occurredAt', { unique: false });
      }
      if (!transaction) return;
      try {
        const metadata = transaction.objectStore(META_STORE);
        if (metadata.keyPath !== 'key') {
          upgradeFailure = storageError('MIGRATION_SCHEMA_UNSUPPORTED', 'รูปแบบ metadata store ที่มีอยู่ไม่รองรับ จึงยกเลิก migration เพื่อป้องกันข้อมูลเดิม');
          transaction.abort();
          return;
        }
        const markerRequest = metadata.get(TRACKING_STARTED_KEY);
        markerRequest.onsuccess = () => {
          if (markerRequest.result) return;
          try {
            metadata.add({ key: TRACKING_STARTED_KEY, value: Date.now(), schemaVersion: DB_VERSION, fromVersion: event.oldVersion });
          } catch (error) {
            upgradeFailure = storageError('MIGRATION_METADATA_WRITE_FAILED', 'บันทึก tracking marker ไม่สำเร็จ จึงยกเลิก migration', error);
            try { transaction.abort(); } catch { /* the upgrade transaction has already aborted */ }
          }
        };
        markerRequest.onerror = (error) => {
          upgradeFailure = storageError('MIGRATION_METADATA_READ_FAILED', 'อ่าน metadata ระหว่าง migration ไม่สำเร็จ', markerRequest.error || error);
          try { transaction.abort(); } catch { /* the upgrade transaction has already aborted */ }
        };
      } catch (error) {
        upgradeFailure = storageError('MIGRATION_SCHEMA_UNSUPPORTED', 'ตรวจสอบ schema ระหว่าง migration ไม่สำเร็จ จึงยกเลิกเพื่อป้องกันข้อมูลเดิม', error);
        try { transaction.abort(); } catch { /* the upgrade transaction has already aborted */ }
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(upgradeFailure || storageError('DATABASE_OPEN_FAILED', 'เปิดฐานข้อมูลในเครื่องไม่สำเร็จ', request.error));
    request.onblocked = () => reject(new Error('ฐานข้อมูลถูกเปิดค้างในแท็บอื่น กรุณารีเฟรชแท็บอื่นก่อน'));
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('บันทึกฐานข้อมูลไม่สำเร็จ'));
    transaction.onabort = () => reject(transaction.error || new Error('ยกเลิกการบันทึกฐานข้อมูล'));
  });
}

function createEventId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') return `event-${globalThis.crypto.randomUUID()}`;
  return `event-${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

function historySnapshot(task) {
  return {
    dueDate: task.dateKey || '',
    dueHour: Number.isInteger(task.hour) ? task.hour : 9,
    dueMinute: Number.isInteger(task.minute) ? task.minute : 0,
    priority: task.priority || 'scheduled',
    repeat: task.repeat || 'none',
    done: task.done === true,
    archived: task.archived === true,
    cancelled: task.cancelled === true,
    snoozedUntil: Number.isFinite(task.snoozedUntil) ? task.snoozedUntil : null,
    deleted: false,
  };
}

function appendEventsToStore(store, metadata, events, onSequenced) {
  const sequenceRequest = metadata.get(HISTORY_SEQUENCE_KEY);
  sequenceRequest.onsuccess = () => {
    let sequence = Number.isSafeInteger(sequenceRequest.result?.value) ? sequenceRequest.result.value : 0;
    events.forEach((event) => {
      if (!event || typeof event.id !== 'string' || !event.id.trim()
        || typeof event.taskId !== 'string' || !event.taskId.trim()
        || typeof event.type !== 'string' || !event.type.trim()
        || !Number.isFinite(event.occurredAt)) {
        try { store.transaction.abort(); } catch { /* the transaction has already aborted */ }
        return;
      }
      const request = store.add({ ...event, sequence: ++sequence });
      request.onerror = (errorEvent) => {
        if (request.error?.name !== 'ConstraintError') return;
        errorEvent.preventDefault();
        errorEvent.stopPropagation();
      };
    });
    metadata.put({ key: HISTORY_SEQUENCE_KEY, value: sequence });
    onSequenced?.(sequence);
  };
  sequenceRequest.onerror = () => {
    try { store.transaction.abort(); } catch { /* the transaction has already aborted */ }
  };
}

function requestValue(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('อ่านฐานข้อมูลไม่สำเร็จ'));
  });
}

function fromDataUrl(dataUrl, type) {
  const comma = dataUrl.indexOf(',');
  const metadata = dataUrl.slice(0, comma);
  const payload = dataUrl.slice(comma + 1);
  if (comma < 0) throw new Error('ไฟล์แนบเดิมมีรูปแบบข้อมูลไม่ถูกต้อง');
  if (metadata.includes(';base64')) {
    const binary = atob(payload);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return new Blob([bytes], { type: type || 'application/octet-stream' });
  }
  return new Blob([decodeURIComponent(payload)], { type: type || 'application/octet-stream' });
}

async function readAllTasks(database) {
  const transaction = database.transaction(TASK_STORE, 'readonly');
  const done = transactionDone(transaction);
  const tasks = await requestValue(transaction.objectStore(TASK_STORE).getAll());
  await done;
  return tasks;
}

async function readAllFiles(database) {
  const transaction = database.transaction(FILE_STORE, 'readonly');
  const done = transactionDone(transaction);
  const files = await requestValue(transaction.objectStore(FILE_STORE).getAll());
  await done;
  return files;
}

async function isInitialized(database) {
  const transaction = database.transaction(META_STORE, 'readonly');
  const done = transactionDone(transaction);
  const record = await requestValue(transaction.objectStore(META_STORE).get('initialized'));
  await done;
  return record?.value === true;
}

async function markInitialized(database) {
  const transaction = database.transaction(META_STORE, 'readwrite');
  const done = transactionDone(transaction);
  transaction.objectStore(META_STORE).put({ key: 'initialized', value: true });
  await done;
}

async function migrateLegacyTasks(database) {
  if (await isInitialized(database)) return { tasks: null, error: '' };
  let legacyRaw = null;
  let legacyKey = '';
  try {
    for (const key of LEGACY_TASK_KEYS) {
      legacyRaw = localStorage.getItem(key);
      if (legacyRaw !== null) { legacyKey = key; break; }
    }
  } catch {
    return { tasks: null, error: 'อ่านข้อมูลเดิมในเบราว์เซอร์ไม่ได้ จึงไม่ได้เขียนทับหรือย้ายข้อมูลเดิม' };
  }
  if (legacyRaw === null) return { tasks: null, error: '' };

  let parsed;
  try {
    parsed = JSON.parse(legacyRaw);
    if (!Array.isArray(parsed)) throw new Error('ข้อมูลเดิมไม่ใช่รายการงาน');
  } catch {
    return { tasks: null, error: 'พบข้อมูลเดิมที่เสียหาย จึงเก็บข้อมูลเดิมไว้โดยไม่เขียนทับ' };
  }

  const existing = await readAllTasks(database);
  if (existing.length > 0) {
    await markInitialized(database);
    return { tasks: existing, error: '' };
  }

  const migrated = parsed.map(normalizeTask);
  if (migrated.some((task) => !task)) {
    return { tasks: null, error: 'พบรายการงานเดิมที่ไม่สมบูรณ์ จึงยกเลิกการย้ายและเก็บข้อมูลต้นฉบับไว้' };
  }
  const fileEntries = [];
  for (const task of migrated) {
    task.attachments = task.attachments.map((attachment) => {
      if (!attachment.legacyDataUrl) return attachment;
      const { legacyDataUrl, ...metadata } = attachment;
      fileEntries.push({ id: metadata.id, taskId: task.id, blob: fromDataUrl(legacyDataUrl, metadata.type), name: metadata.name, type: metadata.type, size: metadata.size });
      return metadata;
    });
  }
  const transaction = database.transaction([TASK_STORE, FILE_STORE, META_STORE], 'readwrite');
  const done = transactionDone(transaction);
  migrated.forEach((task) => transaction.objectStore(TASK_STORE).put(task));
  fileEntries.forEach((file) => transaction.objectStore(FILE_STORE).put(file));
  transaction.objectStore(META_STORE).put({ key: 'initialized', value: true });
  await done;
  // Keep the original key until successful migration is confirmed on a later start.
  try { localStorage.setItem(`${legacyKey}.migrated`, new Date().toISOString()); } catch { /* migration is already committed in IndexedDB */ }
  const filesById = new Map(fileEntries.map((file) => [file.id, file]));
  return {
    tasks: migrated.map((task) => ({
      ...task,
      attachments: task.attachments.map(({ legacyDataUrl, ...metadata }) => {
        const file = filesById.get(metadata.id);
        return file ? { ...metadata, blob: file.blob } : metadata;
      }),
    })),
    error: '',
  };
}

export async function loadTasks() {
  let database;
  try {
    database = await openDatabase();
    const migrated = await migrateLegacyTasks(database);
    if (migrated.error) return { tasks: [], error: migrated.error };
    const saved = migrated.tasks ?? await readAllTasks(database);
    if (saved.length || await isInitialized(database)) {
      const files = await readAllFiles(database);
      const filesByTask = new Map();
      files.forEach((file) => {
        const current = filesByTask.get(file.taskId) || [];
        current.push(file);
        filesByTask.set(file.taskId, current);
      });
      const normalizedTasks = saved.map((task, index) => {
          const normalized = normalizeTask(task, index);
          if (!normalized) return null;
          const persistedFiles = filesByTask.get(task.id) || [];
          const attachmentsById = new Map(normalized.attachments.map((file) => [file.id, file]));
          persistedFiles.forEach(({ blob, ...metadata }) => {
            attachmentsById.set(metadata.id, { ...attachmentsById.get(metadata.id), ...metadata, blob });
          });
          return {
            ...normalized,
            attachments: [...attachmentsById.values()],
          };
        });
      if (normalizedTasks.some((task) => !task)) {
        return { tasks: [], error: 'พบรายการงานในฐานข้อมูลที่อ่านไม่ได้ จึงหยุดการแก้ไขเพื่อป้องกันข้อมูลสูญหาย' };
      }
      return { tasks: normalizedTasks, error: '' };
    }
    const seeds = buildSeedTasks().map((task, index) => normalizeTask(task, index)).filter(Boolean);
    const transaction = database.transaction([TASK_STORE, META_STORE], 'readwrite');
    const done = transactionDone(transaction);
    seeds.forEach((task) => transaction.objectStore(TASK_STORE).put(task));
    transaction.objectStore(META_STORE).put({ key: 'initialized', value: true });
    await done;
    return { tasks: seeds, error: '' };
  } catch (error) {
    return {
      tasks: [],
      errorCode: typeof error?.code === 'string' ? error.code : 'TASK_DATA_LOAD_FAILED',
      error: error instanceof Error ? `${error.message} ข้อมูลเดิมไม่ถูกลบ` : 'เปิดข้อมูลในเครื่องไม่สำเร็จ ข้อมูลเดิมไม่ถูกลบ',
    };
  } finally {
    database?.close();
  }
}

async function writeTasks(tasks, events = []) {
  let database;
  try {
    database = await openDatabase();
    const previousFiles = await readAllFiles(database);
    const fileEntries = [];
    const taskRecords = tasks.map((source, index) => {
      const normalized = normalizeTask(source, index);
      if (!normalized) return null;
      normalized.attachments = normalized.attachments.map((attachment) => {
        if (attachment.blob instanceof Blob) {
          fileEntries.push({ id: attachment.id, taskId: normalized.id, blob: attachment.blob, name: attachment.name, type: attachment.type, size: attachment.size || attachment.blob.size });
          const { blob, legacyDataUrl, ...metadata } = attachment;
          return metadata;
        }
        if (attachment.legacyDataUrl) {
          const blob = fromDataUrl(attachment.legacyDataUrl, attachment.type);
          fileEntries.push({ id: attachment.id, taskId: normalized.id, blob, name: attachment.name, type: attachment.type, size: attachment.size || blob.size });
          const { legacyDataUrl, ...metadata } = attachment;
          return metadata;
        }
        return attachment;
      });
      return normalized;
    }).filter(Boolean);
    const existingTasks = await readAllTasks(database);
    const retainedTaskIds = new Set(taskRecords.map((task) => task.id));
    const retainedFileIds = new Set(taskRecords.flatMap((task) => task.attachments.map((attachment) => attachment.id)));
    const stores = events.length ? [TASK_STORE, FILE_STORE, META_STORE, EVENT_STORE] : [TASK_STORE, FILE_STORE, META_STORE];
    const transaction = database.transaction(stores, 'readwrite');
    const done = transactionDone(transaction);
    const taskStore = transaction.objectStore(TASK_STORE);
    const fileStore = transaction.objectStore(FILE_STORE);
    existingTasks.filter((task) => !retainedTaskIds.has(task.id)).forEach((task) => taskStore.delete(task.id));
    taskRecords.forEach((task) => taskStore.put(task));
    previousFiles.filter((file) => !retainedTaskIds.has(file.taskId) || !retainedFileIds.has(file.id)).forEach((file) => fileStore.delete(file.id));
    fileEntries.forEach((file) => fileStore.put(file));
    transaction.objectStore(META_STORE).put({ key: 'initialized', value: true });
    if (events.length) appendEventsToStore(transaction.objectStore(EVENT_STORE), transaction.objectStore(META_STORE), events);
    await done;
    return true;
  } catch {
    return false;
  } finally {
    database?.close();
  }
}

export function saveTasks(tasks) {
  const snapshot = tasks.slice();
  const operation = saveQueue.then(() => writeTasks(snapshot));
  saveQueue = operation.then(() => undefined, () => undefined);
  return operation;
}

export function saveTasksWithEvents(tasks, events) {
  const snapshot = tasks.slice();
  const pendingEvents = events.map((event) => ({ ...event }));
  const operation = saveQueue.then(() => writeTasks(snapshot, pendingEvents));
  saveQueue = operation.then(() => undefined, () => undefined);
  return operation;
}

export async function captureTaskHistoryBaseline(tasks) {
  let database;
  try {
    database = await openDatabase();
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction([EVENT_STORE, META_STORE], 'readwrite');
      const metadata = transaction.objectStore(META_STORE);
      const markerRequest = metadata.get(HISTORY_BASELINE_KEY);
      let result;
      markerRequest.onsuccess = () => {
        if (Number.isFinite(markerRequest.result?.value)) {
          result = { captured: false, capturedAt: markerRequest.result.value };
          return;
        }
        const capturedAt = Date.now();
        const events = tasks.map((task) => ({
          id: createEventId(),
          taskId: task.id,
          occurrenceId: task.id,
          ...(task.seriesId || (task.repeat !== 'none' && task.dateKey) ? { seriesId: task.seriesId || task.id } : {}),
          type: 'baseline-captured',
          eventVersion: 1,
          occurredAt: capturedAt,
          capturedAt,
          snapshot: historySnapshot(task),
        }));
        try {
          appendEventsToStore(
            transaction.objectStore(EVENT_STORE),
            metadata,
            events,
            (sequence) => metadata.put({ key: HISTORY_BASELINE_KEY, value: capturedAt, sequence, schemaVersion: DB_VERSION }),
          );
          result = { captured: true, capturedAt };
        } catch (error) {
          reject(error);
          try { transaction.abort(); } catch { /* the transaction has already completed or aborted */ }
        }
      };
      markerRequest.onerror = () => reject(markerRequest.error || new Error('อ่าน tracking baseline ไม่สำเร็จ'));
      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () => reject(transaction.error || new Error('บันทึก tracking baseline ไม่สำเร็จ'));
      transaction.onabort = () => reject(transaction.error || new Error('ยกเลิกการบันทึก tracking baseline'));
    });
  } finally {
    database?.close();
  }
}

/** Adds one immutable history event. Reusing an event ID is a safe no-op. */
export async function appendTaskEvent(event) {
  if (!event || typeof event.id !== 'string' || !event.id.trim()
    || typeof event.taskId !== 'string' || !event.taskId.trim()
    || typeof event.type !== 'string' || !event.type.trim()
    || !Number.isFinite(event.occurredAt)) {
    throw new TypeError('Task history event ต้องมี id, taskId, type และ occurredAt ที่ถูกต้อง');
  }
  let database;
  try {
    database = await openDatabase();
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction([EVENT_STORE, META_STORE], 'readwrite');
      const store = transaction.objectStore(EVENT_STORE);
      const metadata = transaction.objectStore(META_STORE);
      let duplicate = false;
      const existingRequest = store.get(event.id);
      existingRequest.onsuccess = () => {
        if (existingRequest.result) {
          duplicate = true;
          return;
        }
        appendEventsToStore(store, metadata, [event]);
      };
      existingRequest.onerror = () => {
        try { transaction.abort(); } catch { /* the transaction has already aborted */ }
      };
      transaction.oncomplete = () => resolve({ written: !duplicate, duplicate });
      transaction.onerror = () => reject(transaction.error || new Error('บันทึกประวัติงานไม่สำเร็จ'));
      transaction.onabort = () => reject(transaction.error || new Error('ยกเลิกการบันทึกประวัติงาน'));
    });
  } finally {
    database?.close();
  }
}

export async function loadTaskHistory({ taskId, from, to } = {}) {
  let database;
  try {
    database = await openDatabase();
    const transaction = database.transaction([EVENT_STORE, META_STORE], 'readonly');
    const done = transactionDone(transaction);
    const store = transaction.objectStore(EVENT_STORE);
    const metadata = transaction.objectStore(META_STORE);
    const [events, trackingStartedAt, baseline] = await Promise.all([
      requestValue(store.getAll()),
      getTrackingStartedAt(database),
      requestValue(metadata.get(HISTORY_BASELINE_KEY)),
    ]);
    await done;
    const filtered = events.filter((event) => {
      if (taskId && event.taskId !== taskId) return false;
      if (Number.isFinite(from) && event.occurredAt < from) return false;
      if (Number.isFinite(to) && event.occurredAt > to) return false;
      return true;
    }).sort((first, second) => first.occurredAt - second.occurredAt
      || (Number.isSafeInteger(first.sequence) && Number.isSafeInteger(second.sequence) ? first.sequence - second.sequence : 0)
      || first.id.localeCompare(second.id));
    return {
      events: filtered,
      trackingStartedAt,
      baselineCapturedAt: Number.isFinite(baseline?.value) ? baseline.value : null,
      baselineSequence: Number.isSafeInteger(baseline?.sequence) ? baseline.sequence : null,
      historyComplete: Number.isFinite(baseline?.value)
        && Number.isSafeInteger(baseline?.sequence)
        && !taskId
        && !Number.isFinite(from)
        && !Number.isFinite(to),
    };
  } finally {
    database?.close();
  }
}

async function getTrackingStartedAt(database) {
  const transaction = database.transaction(META_STORE, 'readonly');
  const done = transactionDone(transaction);
  const marker = await requestValue(transaction.objectStore(META_STORE).get(TRACKING_STARTED_KEY));
  await done;
  return Number.isFinite(marker?.value) ? marker.value : null;
}

export function loadSettings() {
  const defaults = {
    theme: 'light',
    notifyDefault: true,
    leadMinutes: 15,
    profileName: 'ผู้ใช้งาน',
    morningBriefingEnabled: true,
    morningBriefingTime: '07:00',
    lastBriefingDate: '',
  };
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    return {
      theme: saved.theme === 'dark' ? 'dark' : 'light',
      notifyDefault: saved.notifyDefault !== false,
      leadMinutes: [5, 10, 15, 30, 60].includes(Number(saved.leadMinutes)) ? Number(saved.leadMinutes) : defaults.leadMinutes,
      profileName: typeof saved.profileName === 'string' ? saved.profileName : defaults.profileName,
      sentReminders: Array.isArray(saved.sentReminders) ? saved.sentReminders.filter((id) => typeof id === 'string').slice(-500) : [],
      morningBriefingEnabled: saved.morningBriefingEnabled !== false,
      morningBriefingTime: typeof saved.morningBriefingTime === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(saved.morningBriefingTime)
        ? saved.morningBriefingTime
        : defaults.morningBriefingTime,
      lastBriefingDate: typeof saved.lastBriefingDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(saved.lastBriefingDate)
        ? saved.lastBriefingDate
        : defaults.lastBriefingDate,
    };
  } catch {
    return { ...defaults, sentReminders: [] };
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}

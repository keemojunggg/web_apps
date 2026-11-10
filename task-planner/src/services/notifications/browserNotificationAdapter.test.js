import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import {
  loadNotificationHistory,
  loadReminderState,
} from '../../utils/taskStorage.js';
import { createReminderFromTask } from './notificationEngine.js';
import {
  createBrowserNotificationAdapter,
  createNotificationDeliveryAdapter,
} from './browserNotificationAdapter.js';

function installLocalStorage() {
  globalThis.localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };
}

function makeTask(overrides = {}) {
  return {
    id: 'occurrence-2027-01-01',
    title: 'Review task',
    dateKey: '2027-01-01',
    hour: 9,
    minute: 30,
    notify: true,
    repeat: 'weekly',
    done: false,
    archived: false,
    cancelled: false,
    ...overrides,
  };
}

async function createPayload(overrides = {}) {
  const task = makeTask(overrides);
  const [year, month, day] = task.dateKey.split('-').map(Number);
  const scheduledAt = new Date(year, month - 1, day, task.hour, task.minute).getTime();
  const created = await createReminderFromTask(task, 15, { now: scheduledAt - 16 * 60_000 });
  return {
    reminder: created.reminder,
    payload: {
      ...created.reminder,
      title: task.title,
      body: 'Review task · 09:30',
    },
  };
}

function createMockNotification({ permission = 'granted', error = null } = {}) {
  const instances = [];
  class MockNotification {
    static permission = permission;
    static requestCount = 0;

    static async requestPermission() {
      this.requestCount += 1;
      this.permission = 'granted';
      return this.permission;
    }

    constructor(title, options) {
      if (error) throw error;
      this.title = title;
      this.options = options;
      instances.push(this);
    }
  }
  return { NotificationClass: MockNotification, instances };
}

function makeWindow() {
  return {
    focusCount: 0,
    opened: [],
    location: { href: 'https://planner.example/app' },
    focus() { this.focusCount += 1; },
    open(url, target) { this.opened.push({ url, target }); },
  };
}

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  installLocalStorage();
});

test('exposes an adapter delivery interface independent of scheduler implementation', async () => {
  const implementation = { async deliver(payload) { return payload.reminderKey; } };
  const adapter = createNotificationDeliveryAdapter(implementation);
  assert.equal(await adapter.deliver({ reminderKey: 'key-1' }), 'key-1');
  assert.throws(() => createNotificationDeliveryAdapter({}), /deliver/);
});

test('reports browser support and permission without requesting automatically', async () => {
  const unsupported = createBrowserNotificationAdapter({ NotificationClass: undefined });
  assert.equal(unsupported.getPermissionStatus(), 'unsupported');
  assert.equal(await unsupported.requestPermission(), 'unsupported');

  const mock = createMockNotification({ permission: 'default' });
  const adapter = createBrowserNotificationAdapter({ NotificationClass: mock.NotificationClass });
  assert.equal(adapter.getPermissionStatus(), 'default');
  assert.equal(mock.NotificationClass.requestCount, 0);
  assert.equal(await adapter.requestPermission(), 'granted');
  assert.equal(adapter.getPermissionStatus(), 'granted');
  assert.equal(mock.NotificationClass.requestCount, 1);
});

test('does not deliver or change Reminder state when permission is default or denied', async () => {
  const { reminder, payload } = await createPayload();
  const defaultMock = createMockNotification({ permission: 'default' });
  const defaultAdapter = createBrowserNotificationAdapter({ NotificationClass: defaultMock.NotificationClass });
  assert.deepEqual(await defaultAdapter.deliver(payload), {
    delivered: false, duplicate: false, reason: 'default',
  });
  assert.equal(defaultMock.NotificationClass.requestCount, 0);
  assert.equal((await loadReminderState(reminder.reminderKey)).status, 'pending');

  const deniedMock = createMockNotification({ permission: 'denied' });
  const deniedAdapter = createBrowserNotificationAdapter({ NotificationClass: deniedMock.NotificationClass });
  assert.equal((await deniedAdapter.deliver(payload)).reason, 'denied');
  assert.equal(deniedMock.instances.length, 0);
  assert.equal((await loadReminderState(reminder.reminderKey)).status, 'pending');
});

test('successfully creates a Browser Notification before atomically recording sent state and history', async () => {
  const { reminder, payload } = await createPayload();
  const mock = createMockNotification();
  const adapter = createBrowserNotificationAdapter({
    NotificationClass: mock.NotificationClass,
    now: () => reminder.nextReminderAt,
  });
  const result = await adapter.deliver(payload);

  assert.equal(result.delivered, true);
  assert.equal(result.notification.title, payload.title);
  assert.equal(result.notification.options.body, payload.body);
  assert.equal(result.notification.options.tag, reminder.reminderKey);
  assert.deepEqual(result.notification.options.data, {
    taskId: reminder.taskId,
    occurrenceId: reminder.occurrenceId,
    reminderKey: reminder.reminderKey,
  });
  assert.equal((await loadReminderState(reminder.reminderKey)).status, 'sent');
  const history = await loadNotificationHistory({ reminderKey: reminder.reminderKey });
  assert.deepEqual(history.map(({ eventType }) => eventType), ['sent', 'scheduled']);
});

test('records failed with error details when Browser Notification construction throws', async () => {
  const { reminder, payload } = await createPayload();
  const error = new Error('permission was revoked');
  const mock = createMockNotification({ error });
  const adapter = createBrowserNotificationAdapter({
    NotificationClass: mock.NotificationClass,
    now: () => reminder.nextReminderAt + 1,
  });
  const result = await adapter.deliver(payload);
  assert.equal(result.delivered, false);
  assert.equal(result.error, error);
  assert.deepEqual(result.errorInfo, { errorName: 'Error', errorMessage: 'permission was revoked' });
  assert.equal((await loadReminderState(reminder.reminderKey)).status, 'failed');
  const failedEvent = (await loadNotificationHistory({ reminderKey: reminder.reminderKey }))
    .find(({ eventType }) => eventType === 'failed');
  assert.equal(failedEvent.reason, 'permission was revoked');
});

test('prevents duplicate and concurrent deliveries for the same Reminder', async () => {
  const { reminder, payload } = await createPayload();
  const mock = createMockNotification();
  const adapter = createBrowserNotificationAdapter({ NotificationClass: mock.NotificationClass });
  const [first, second] = await Promise.all([adapter.deliver(payload), adapter.deliver(payload)]);
  assert.equal(first.delivered, true);
  assert.equal(second.duplicate, true);
  assert.equal(mock.instances.length, 1);

  const repeated = await adapter.deliver(payload);
  assert.equal(repeated.duplicate, true);
  assert.equal(mock.instances.length, 1);
  assert.equal((await loadNotificationHistory({ reminderKey: reminder.reminderKey }))
    .filter(({ eventType }) => eventType === 'sent').length, 1);
});

test('retries a failed Reminder and records the successful retry after delivery', async () => {
  const { reminder, payload } = await createPayload();
  const failingMock = createMockNotification({ error: new Error('temporary failure') });
  const firstAdapter = createBrowserNotificationAdapter({
    NotificationClass: failingMock.NotificationClass,
    now: () => reminder.nextReminderAt + 1,
  });
  await firstAdapter.deliver(payload);
  assert.equal((await loadReminderState(reminder.reminderKey)).status, 'failed');

  const successfulMock = createMockNotification();
  const retryAdapter = createBrowserNotificationAdapter({
    NotificationClass: successfulMock.NotificationClass,
    now: () => reminder.nextReminderAt + 2,
  });
  const retry = await retryAdapter.deliver(payload);
  assert.equal(retry.delivered, true);
  assert.equal((await loadReminderState(reminder.reminderKey)).status, 'sent');
  assert.equal((await loadNotificationHistory({ reminderKey: reminder.reminderKey }))
    .filter(({ eventType }) => eventType === 'failed').length, 1);
  assert.equal((await loadNotificationHistory({ reminderKey: reminder.reminderKey }))
    .filter(({ eventType }) => eventType === 'sent').length, 1);
});

test('routes Notification clicks to the related Task and Occurrence and opens the planner URL', async () => {
  const { reminder, payload } = await createPayload();
  const mock = createMockNotification();
  const windowTarget = makeWindow();
  const clicked = [];
  const adapter = createBrowserNotificationAdapter({
    NotificationClass: mock.NotificationClass,
    windowTarget,
    onClick: (context) => clicked.push(context),
  });
  await adapter.deliver(payload);
  mock.instances[0].onclick({ preventDefault() {} });
  assert.equal(windowTarget.focusCount, 1);
  assert.deepEqual(clicked, [{
    taskId: reminder.taskId,
    occurrenceId: reminder.occurrenceId,
    reminderKey: reminder.reminderKey,
  }]);

  const { reminder: defaultClickReminder, payload: defaultClickPayload } = await createPayload({
    id: 'occurrence-2027-01-02',
    dateKey: '2027-01-02',
  });
  const defaultClickMock = createMockNotification();
  const defaultWindow = makeWindow();
  const defaultAdapter = createBrowserNotificationAdapter({
    NotificationClass: defaultClickMock.NotificationClass,
    windowTarget: defaultWindow,
  });
  await defaultAdapter.deliver(defaultClickPayload);
  defaultClickMock.instances[0].onclick();
  assert.equal(defaultWindow.opened[0].target, '_blank');
  const openedUrl = new URL(defaultWindow.opened[0].url);
  assert.equal(openedUrl.searchParams.get('taskId'), defaultClickReminder.taskId);
  assert.equal(openedUrl.searchParams.get('occurrenceId'), defaultClickReminder.occurrenceId);
});

test('surfaces atomic state/history persistence errors without falsely marking sent', async () => {
  const { reminder, payload } = await createPayload();
  const realIndexedDB = globalThis.indexedDB;
  const mock = createMockNotification();
  class NotificationWithStorageFailure extends mock.NotificationClass {
    constructor(title, options) {
      super(title, options);
      globalThis.indexedDB = { open() { throw new Error('storage unavailable'); } };
    }
  }
  const adapter = createBrowserNotificationAdapter({
    NotificationClass: NotificationWithStorageFailure,
    now: () => reminder.nextReminderAt,
  });
  const result = await adapter.deliver(payload);
  assert.equal(result.delivered, true);
  assert.match(result.storageError.message, /storage unavailable/);
  globalThis.indexedDB = realIndexedDB;
  assert.equal((await loadReminderState(reminder.reminderKey)).status, 'pending');
  assert.equal((await loadNotificationHistory({ reminderKey: reminder.reminderKey }))
    .some(({ eventType }) => eventType === 'sent'), false);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { FOCUS_RECOMMENDATION_LIMIT, recommendFocusTasks } from './taskFocus.js';

const localTime = (dateKey, hour, minute = 0) => {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day, hour, minute).getTime();
};

const task = (id, fields = {}) => ({
  id, title: id, dateKey: '2026-10-18', hour: 12, minute: 0,
  priority: 'scheduled', done: false, ...fields,
});

test('recommends a capped set with readable reasons and user pins take precedence', () => {
  const now = localTime('2026-10-18', 9);
  const tasks = [
    task('urgent-far', { dateKey: '2026-11-01', priority: 'urgent' }),
    task('due-soon', { hour: 9, minute: 30, priority: 'relaxed' }),
    task('overdue', { dateKey: '2026-10-17', priority: 'slow' }),
    task('pinned-far', { dateKey: '2026-12-01', pinned: true, priority: 'slow' }),
    task('due-today', { hour: 17, priority: 'scheduled' }),
  ];
  const result = recommendFocusTasks(tasks, { now });
  assert.equal(result.length, FOCUS_RECOMMENDATION_LIMIT);
  assert.equal(result[0].task.id, 'pinned-far');
  assert.equal(result[0].reason.code, 'pinned');
  assert.equal(result[1].task.id, 'overdue');
  assert.equal(result[1].reason.code, 'overdue');
  assert.equal(result[2].task.id, 'due-soon');
  assert.equal(result[2].reason.code, 'due-soon');
});

test('excludes completed, archived, cancelled, actively snoozed, and distant unpinned tasks', () => {
  const now = localTime('2026-10-18', 10);
  const tasks = [
    task('done', { done: true, pinned: true }),
    task('archived', { archived: true, pinned: true }),
    task('cancelled', { cancelled: true, pinned: true }),
    task('snoozed', { snoozedUntil: now + 30_000, pinned: true }),
    task('far', { dateKey: '2026-12-01' }),
  ];
  assert.deepEqual(recommendFocusTasks(tasks, { now }), []);
});

test('does not recommend the highest priority alone over a more imminent deadline', () => {
  const now = localTime('2026-10-18', 9);
  const result = recommendFocusTasks([
    task('urgent-tomorrow', { dateKey: '2026-10-19', hour: 17, priority: 'urgent' }),
    task('medium-in-30-min', { hour: 9, minute: 30, priority: 'scheduled' }),
  ], { now });
  assert.equal(result[0].task.id, 'medium-in-30-min');
});

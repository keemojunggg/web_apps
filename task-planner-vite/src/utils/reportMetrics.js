const HISTORY_EVENT_TYPES = new Set([
  'baseline-captured',
  'created',
  'occurrence-created',
  'edited',
  'rescheduled',
  'completed',
  'reopened',
  'deleted',
  'delete-undone',
  'archived',
  'archive-restored',
  'cancelled',
  'cancel-restored',
  'snoozed',
  'snooze-cancelled',
  'pinned',
  'unpinned',
]);

function parseDateKey(key) {
  if (typeof key !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  const [year, month, day] = key.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}

function dateKey(date) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function localBoundary(key) {
  const date = parseDateKey(key);
  return date ? date.getTime() : null;
}

function periodBounds(startDate, endDate) {
  const start = localBoundary(startDate);
  const end = localBoundary(endDate);
  if (start === null || end === null || end <= start) {
    throw new RangeError('Report period requires valid local start and exclusive end dates');
  }
  return { start, end };
}

function dueTimestamp(snapshot) {
  if (!snapshot || !parseDateKey(snapshot.dueDate)) return null;
  const [year, month, day] = snapshot.dueDate.split('-').map(Number);
  const hour = snapshot.dueHour;
  const minute = snapshot.dueMinute;
  if (!Number.isInteger(hour) || hour < 0 || hour > 23 || !Number.isInteger(minute) || minute < 0 || minute > 59) return null;
  const due = new Date(year, month - 1, day, hour, minute, 0, 0);
  return due.getFullYear() === year && due.getMonth() === month - 1 && due.getDate() === day
    ? due.getTime()
    : null;
}

function compareEvents(first, second) {
  return (Number.isSafeInteger(first.sequence) && Number.isSafeInteger(second.sequence) ? first.sequence - second.sequence : 0)
    || first.occurredAt - second.occurredAt
    || String(first.id || '').localeCompare(String(second.id || ''));
}

function mergeState(previous, snapshot) {
  return {
    ...previous,
    ...snapshot,
    deleted: snapshot.deleted === true,
  };
}

function replayEvents(events, baselineCapturedAt, baselineSequence, cutoff) {
  const states = new Map();
  const firstCompletions = new Map();
  const createdOccurrences = new Map();
  let invalid = false;
  const byId = new Map();
  events.forEach((event) => {
    if (!event || typeof event.id !== 'string' || !event.id || !Number.isFinite(event.occurredAt)) {
      invalid = true;
      return;
    }
    if (byId.has(event.id)) {
      if (JSON.stringify(byId.get(event.id)) !== JSON.stringify(event)) invalid = true;
      return;
    }
    byId.set(event.id, event);
  });
  if (Number.isSafeInteger(baselineSequence)
    && [...byId.values()].some((event) => event.eventVersion === 1
      && Number.isSafeInteger(event.sequence)
      && event.sequence > baselineSequence
      && event.occurredAt < baselineCapturedAt)) invalid = true;

  const orderedEvents = [...byId.values()]
    .filter((event) => event.occurredAt >= baselineCapturedAt && event.occurredAt <= cutoff)
    .sort(compareEvents);
  const seenSequences = new Set();
  let previousTimestamp = -Infinity;
  orderedEvents.forEach((event) => {
    if (seenSequences.has(event.sequence) || event.occurredAt < previousTimestamp) invalid = true;
    seenSequences.add(event.sequence);
    previousTimestamp = event.occurredAt;
  });
  orderedEvents.forEach((event) => {
      if (event.eventVersion !== 1 || !HISTORY_EVENT_TYPES.has(event.type)
        || typeof event.taskId !== 'string' || event.occurrenceId !== event.taskId
        || !Number.isSafeInteger(event.sequence) || event.sequence < 1
        || !event.snapshot || typeof event.snapshot !== 'object'
        || (event.snapshot.dueDate && dueTimestamp(event.snapshot) === null)
        || (event.type === 'completed' && (!Number.isFinite(event.completedAt) || event.completedAt !== event.occurredAt))) {
        invalid = true;
        return;
      }
      const occurrenceId = event.occurrenceId;
      const previous = states.get(occurrenceId);
      const state = {
        ...mergeState(previous, event.snapshot),
        ...(event.seriesId || previous?.seriesId ? { seriesId: event.seriesId || previous.seriesId } : {}),
      };
      if (event.type === 'baseline-captured') {
        state.observedAt = event.capturedAt ?? event.occurredAt;
        if (state.cancelled) state.cancelledAt = state.observedAt;
      } else if (event.type === 'created' || event.type === 'occurrence-created') {
        state.createdAt = event.occurredAt;
        createdOccurrences.set(occurrenceId, event.occurredAt);
      } else if (event.type === 'completed') {
        const completedAt = Number.isFinite(event.completedAt) ? event.completedAt : event.occurredAt;
        if (!firstCompletions.has(occurrenceId)) {
          firstCompletions.set(occurrenceId, {
            occurredAt: completedAt,
            dueAt: dueTimestamp(event.snapshot),
          });
        }
        state.done = true;
      } else if (event.type === 'reopened') {
        state.done = false;
      } else if (event.type === 'deleted') {
        state.deleted = true;
        state.deletedAt = event.occurredAt;
      } else if (event.type === 'delete-undone') {
        state.deleted = false;
        state.deletedAt = null;
      } else if (event.type === 'archived') {
        state.archived = true;
      } else if (event.type === 'archive-restored') {
        state.archived = false;
      } else if (event.type === 'cancelled') {
        state.cancelled = true;
        state.cancelledAt = event.occurredAt;
      } else if (event.type === 'cancel-restored') {
        state.cancelled = false;
        state.cancelledAt = null;
      }
      states.set(occurrenceId, state);
    });
  return { states, firstCompletions, createdOccurrences, invalid };
}

function isInPeriod(timestamp, start, end) {
  return Number.isFinite(timestamp) && timestamp >= start && timestamp < end;
}

function countMetric(value, coverage) {
  return { value: coverage.status === 'complete' ? value : null, status: coverage.status };
}

export function calculatePeriodMetrics({
  events = [],
  startDate,
  endDate,
  asOf,
  baselineCapturedAt = null,
  baselineSequence = null,
  historyComplete = false,
}) {
  const { start, end } = periodBounds(startDate, endDate);
  if (!Number.isFinite(asOf)) throw new TypeError('Report asOf must be a finite timestamp');
  if (asOf < start) throw new RangeError('Report asOf cannot precede the selected period');
  const cutoff = Math.min(asOf, end - 1);
  const coverage = {
    status: 'complete',
    baselineCapturedAt: Number.isFinite(baselineCapturedAt) ? baselineCapturedAt : null,
    periodClosed: asOf >= end,
    reason: '',
  };
  if (!Number.isFinite(baselineCapturedAt)) {
    coverage.status = 'unavailable';
    coverage.reason = 'No history baseline is available.';
  } else if (end <= baselineCapturedAt) {
    coverage.status = 'unavailable';
    coverage.reason = 'The period ended before history capture began.';
  } else if (start < baselineCapturedAt) {
    coverage.status = 'partial';
    coverage.reason = 'The period overlaps the start of history capture.';
  } else if (!historyComplete) {
    coverage.status = 'incomplete';
    coverage.reason = 'History persistence has not been verified as complete.';
  }

  const replayed = Number.isFinite(baselineCapturedAt)
    ? replayEvents(events, baselineCapturedAt, baselineSequence, cutoff)
    : { states: new Map(), firstCompletions: new Map(), createdOccurrences: new Map(), invalid: false };
  if (coverage.status === 'complete' && replayed.invalid) {
    coverage.status = 'incomplete';
    coverage.reason = 'History contains an unsupported or invalid event.';
  }

  const dueOccurrences = [];
  replayed.states.forEach((state, occurrenceId) => {
    const dueAt = dueTimestamp(state);
    if (dueAt === null || !isInPeriod(dueAt, start, end)) return;
    const withdrawnBeforeDue = (state.cancelled || state.deleted) && (state.cancelledAt ?? state.deletedAt ?? cutoff) < dueAt;
    if (!withdrawnBeforeDue) dueOccurrences.push({ occurrenceId, state });
  });

  const planned = dueOccurrences.length;
  const completedByDueDate = dueOccurrences.filter(({ state }) => state.done).length;
  const overdueInCohort = dueOccurrences.filter(({ state }) => !state.done
    && !state.archived && !state.cancelled && !state.deleted
    && !(Number.isFinite(state.snoozedUntil) && state.snoozedUntil > cutoff)
    && (dueTimestamp(state) ?? Infinity) < cutoff).length;
  const notCompletedNotOverdue = planned - completedByDueDate - overdueInCohort;
  const completionRate = {
    numerator: coverage.status === 'complete' ? completedByDueDate : null,
    denominator: coverage.status === 'complete' ? planned : null,
    value: coverage.status === 'complete' && planned > 0 ? completedByDueDate / planned : null,
    status: coverage.status,
  };

  const completedInPeriod = [...replayed.firstCompletions.values()].filter((completion) => isInPeriod(completion.occurredAt, start, end));
  const onTimeDenominator = completedInPeriod.filter((completion) => completion.dueAt !== null).length;
  const onTimeNumerator = completedInPeriod.filter((completion) => completion.dueAt !== null && completion.occurredAt <= completion.dueAt).length;
  const onTimeRate = {
    numerator: coverage.status === 'complete' ? onTimeNumerator : null,
    denominator: coverage.status === 'complete' ? onTimeDenominator : null,
    value: coverage.status === 'complete' && onTimeDenominator > 0 ? onTimeNumerator / onTimeDenominator : null,
    status: coverage.status,
  };

  const overdueCount = [...replayed.states.values()].filter((state) => {
    if (state.done || state.archived || state.cancelled || state.deleted === true
      || (Number.isFinite(state.snoozedUntil) && state.snoozedUntil > cutoff)) return false;
    const dueAt = dueTimestamp(state);
    return dueAt !== null && dueAt < cutoff;
  }).length;
  const createdCount = [...replayed.createdOccurrences.values()].filter((createdAt) => isInPeriod(createdAt, start, end)).length;
  const completedCount = completedInPeriod.length;
  const plannedIds = new Set(dueOccurrences.map(({ occurrenceId }) => occurrenceId));
  const occurrences = [];
  replayed.states.forEach((state, occurrenceId) => {
    const dueAt = dueTimestamp(state);
    const firstCompletion = replayed.firstCompletions.get(occurrenceId);
    const createdAt = replayed.createdOccurrences.get(occurrenceId) ?? null;
    const createdInPeriod = isInPeriod(createdAt, start, end);
    const completedInPeriodForOccurrence = firstCompletion
      ? isInPeriod(firstCompletion.occurredAt, start, end)
      : false;
    const overdueAtCutoff = !state.done && !state.archived && !state.cancelled && !state.deleted
      && !(Number.isFinite(state.snoozedUntil) && state.snoozedUntil > cutoff)
      && dueAt !== null && dueAt < cutoff;
    const planned = plannedIds.has(occurrenceId);
    if (!planned && !createdInPeriod && !completedInPeriodForOccurrence && !overdueAtCutoff) return;
    occurrences.push({
      occurrenceId,
      seriesId: state.seriesId || null,
      dueAt,
      createdAt,
      completedAt: firstCompletion?.occurredAt ?? null,
      planned,
      createdInPeriod,
      completedInPeriod: completedInPeriodForOccurrence,
      doneAtCutoff: state.done === true,
      overdueAtCutoff,
      archived: state.archived === true,
      cancelled: state.cancelled === true,
      deleted: state.deleted === true,
    });
  });

  return {
    period: { startDate, endDate, asOf: cutoff, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone },
    coverage,
    occurrences,
    statusBreakdown: {
      completed: countMetric(completedByDueDate, coverage),
      notCompletedNotOverdue: countMetric(notCompletedNotOverdue, coverage),
      notCompletedOverdue: countMetric(overdueInCohort, coverage),
      total: countMetric(planned, coverage),
    },
    completionRate,
    onTimeRate,
    overdueTasks: countMetric(overdueCount, coverage),
    remainingTasks: countMetric(Math.max(0, planned - completedByDueDate), coverage),
    plannedVsCompleted: {
      planned: countMetric(planned, coverage),
      completed: countMetric(completedCount, coverage),
      attribution: { planned: 'due-date', completed: 'first-completion-date' },
    },
    completionTrend: countMetric(completedCount, coverage),
    tasksCreated: countMetric(createdCount, coverage),
  };
}

export function localReportDateRange(date = new Date(), period = 'day') {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) throw new TypeError('Report date must be valid');
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (period === 'week') {
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  } else if (period === 'month') {
    start.setDate(1);
  } else if (period === 'year') {
    start.setMonth(0, 1);
  } else if (period !== 'day') {
    throw new RangeError('Report period must be day, week, month, or year');
  }
  const end = new Date(start);
  if (period === 'week') end.setDate(end.getDate() + 7);
  else if (period === 'month') end.setMonth(end.getMonth() + 1);
  else if (period === 'year') end.setFullYear(end.getFullYear() + 1);
  else end.setDate(end.getDate() + 1);
  return { startDate: dateKey(start), endDate: dateKey(end) };
}

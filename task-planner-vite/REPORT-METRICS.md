# Progress Reports: History Audit, Metric Definitions, and Integrity Changes

**Phases:** 3A audit/definitions; 3A.1 historical integrity; 3B daily and weekly Reports UI; 3C monthly and yearly Reports UI  
**Status:** Local history capture, pure metrics, and daily, weekly, monthly, and yearly Reports views are implemented.

## 1. Pre-3A.1 history audit

### Storage and loading

- IndexedDB is named `task-planner`, currently schema version 3. The `taskEvents` object store is introduced with a key path of `id` and indexes on `taskId` and `occurredAt`.
- `appendTaskEvent` validates `id`, `taskId`, `type`, and finite `occurredAt`, then appends an immutable event. Reusing an ID is treated as a duplicate no-op.
- Before 3A.1, `loadTaskHistory({ taskId, from, to })` read all events, filtered inclusively by event timestamp and task ID, and sorted by `occurredAt`, then ID. It also returned `trackingStartedAt`.
- At the time of the 3A audit, the Home/report application path did not load history; Phase 3B adds an unfiltered history read on the Reports page only.
- Before 3A.1, the app generated a fallback event ID from task ID, type, timestamp, successor ID, date, and overdue-at-action. Two legitimate same-millisecond events with the same identity inputs could therefore collapse into one.

### Event types observed in source

| Event type | Produced by | Recorded information relevant to reports |
|---|---|---|
| `created` | Add task | Occurrence ID, event time, due date, priority, repeat rule |
| `edited` | Edit task | Event time, current due date and priority; not a before/after snapshot of all edited fields |
| `rescheduled` | Edit or recovery reschedule | Before/after dates and hour/minute for edit; recovery action also records due date, target schedule, and whether it was overdue at action time |
| `completed` | Complete occurrence | Completion timestamp, scheduled date, local completion date, priority, and optional successor ID/date |
| `reopened` | Reopen occurrence | Event time and scheduled date |
| `occurrence-created` | Recurring completion creates successor | Successor occurrence ID, series ID when available, event time, due date, priority |
| `deleted` | Delete task | Event time, due date, priority; task record is removed |
| `restored` | Legacy undo delete or restore archive | Event time, due date, priority; the type does not identify which restore action caused it |
| `delete-undone`, `archive-restored`, `cancel-restored` | New distinct restore events | Versioned snapshot identifies the exact occurrence state transition |
| `archived` | Archive task | Event time, due date, and overdue-at-action |
| `cancelled` | Cancel task | Event time, due date, and overdue-at-action |
| `uncancelled` | Legacy restore cancelled task | Event time, due date, and overdue-at-action |
| `cancel-restored` | New restore cancelled task | Versioned occurrence snapshot and exact state transition |
| `snoozed` | Snooze task | Event time, due date, overdue-at-action, snooze-until timestamp |
| `snooze-cancelled` | Wake task | Event time, due date, overdue-at-action, prior snooze-until timestamp |
| `pinned`, `unpinned` | Recovery actions | Event time, due date, and overdue-at-action |

This table audits the pre-3A.1 event paths. The list was based on event-producing code, not a separately enforced event-type schema. `appendTaskEvent` accepts any non-empty type.

### Action coverage and limits

- Create, edit, schedule changes, completion, reopen, archive, cancel, delete, delete undo, and recovery actions produce events in the current UI flows. An edit that changes the due date/time produces both `edited` and `rescheduled`.
- Before 3A.1, task state persistence and event append were separate asynchronous operations. Event write failures showed a notice, but there was no atomic commit linking the event to the task mutation.
- `edited` does not retain a full before/after task snapshot. Event details vary by action.
- Completion records the scheduled **date** and local completion date, but not the due **hour/minute**. The completion timestamp is an epoch value. As a result, strict deadline-time on-time calculations cannot be reconstructed reliably from historical events alone.
- Created events omit due time, title, and a stable event schema version. Occurrence-created events also omit due time and use the completion event timestamp as their event time.
- Delete is represented by an event, but the deleted task is physically removed from the task store. The event is not a complete task snapshot. A `restored` event is ambiguous between delete undo and archive restore.
- Before 3A.1, event writes were not guaranteed to be complete. Their presence must not be treated as proof that every action was captured.

### Recurrence and recovery

- A repeating task creates its successor when the current occurrence is completed; missed recurrence dates are skipped. The successor ID is stable (`seriesId@dateKey`), and the occurrence receives a `seriesId` and recurrence anchor.
- Completing an already completed task is a no-op. Reopening does not remove its successor; completing again reuses that successor rather than creating a duplicate.
- Each generated occurrence has its own task ID. Reports must count occurrence IDs, not count completion plus successor-creation events as two completions.
- Recovery code emits reschedule, snooze/wake, archive/restore, cancel/uncancel, and pin/unpin events. The recovery tests cover reversible state, validation, field preservation, and same-day rescheduling. Recurrence tests cover cadence, late completion, duplicate prevention, reopen, and stable successor IDs.
- These tests exercise domain behavior and event-shaped return values; they do not verify complete end-to-end event persistence for every UI action.

### Tracking start, migrations, and preserved data

- `trackingStartedAt` is stored in IndexedDB `metadata`. During a schema upgrade, if the marker is absent, the migration writes the current time plus schema/from-version metadata. History loading returns `null` if the marker is absent.
- The marker is a lower bound for event tracking, not proof of a complete history or a snapshot of all tasks. Existing tasks and seeded example tasks do not receive fabricated `created` events. Legacy task import does not backfill task history.
- The storage tests verify v2-to-v3 migration, marker creation, no fabricated events, event ID deduplication, legacy task import, and preservation of task IDs, unknown task fields, attachment bytes, settings, reminder IDs, and Phase 2 fields. Failed migration tests assert that existing database data remains intact.
- No database schema change is necessary for this Phase 3A audit or definitions. The existing object store can hold additional event properties, but that does not itself solve missing or non-atomic history.

## 2. Report period and shared rules

These definitions are implemented by the pure `calculatePeriodMetrics` utility for versioned event history. Pre-3A.1 history and periods that overlap the baseline do not support every calculation accurately and return explicit incomplete/unavailable coverage.

- Use the browser's local timezone and calendar for date keys, day/week/month/year boundaries, and display. Build boundaries from local calendar dates (including daylight-saving transitions), not by adding fixed 24-hour durations.
- A period is a half-open local interval `[start, end)`. Weekly periods use Monday through Sunday. Current periods are partial through the report's `asOf` time; future periods are not reported.
- Count a task occurrence by its stable task ID exactly once in a period metric. `created`, `completed`, `reopened`, and `occurrence-created` events for the same ID are lifecycle evidence, not separate tasks.
- Apply events only through the period's `asOf` cutoff. Later edits, reschedules, cancellation, deletion, or reopening must not rewrite a previously closed period. Keep completion-action trends distinct from due-date cohort rates.
- A task added during a period is eligible from its recorded creation time onward. It is never backfilled into a period that closed before creation. If it is due in its creation period, it can be part of that period's planned cohort.
- A reschedule made before the period closes moves that still-open occurrence to its new due-date cohort. Preserve both the old and new schedule in history. A reschedule after close affects later/as-of reports only; it must not retroactively alter the closed-period result.
- Cancellation before the occurrence is due withdraws it from the planned denominator. Cancellation on or after its due time does not erase an already-missed obligation. Archive does not erase an obligation. Deletion does not erase it from a denominator if the occurrence was due or already overdue at deletion; delete-before-due is treated as withdrawal. These rules require reliable event order and due-time snapshots.
- An occurrence reopened before a period's end is incomplete at that cutoff unless completed again before the same cutoff. Reopening after a period has closed does not change that earlier as-of result. A repeated completion of the same occurrence is not an additional occurrence.
- Recurring successors are distinct planned occurrences, identified by their stable occurrence IDs and series ID. Count each occurrence once; never count both the `completed` and `occurrence-created` events as completions.
- Zero denominator is **N/A**, not `0%`. An incomplete period is labeled incomplete and its percentage is withheld (or explicitly shown as a lower bound only if that is separately designed); missing history is never interpreted as zero activity.
- A period wholly before `trackingStartedAt` is **history unavailable**. A period that overlaps the marker is **partial history**. A period after the marker can still be incomplete because event writes may fail or pre-existing tasks may lack lifecycle events. The marker alone cannot certify completeness.

## 3. Metric definitions

| Metric | Numerator and denominator | Period and date attribution | Lifecycle, recurrence, and data-quality treatment |
|---|---|---|---|
| **Completion Rate** | Numerator: distinct eligible occurrences in the planned cohort completed by the period's end. Denominator: distinct eligible occurrences due in the period, as known at its close. Show as N/A when denominator is zero. | Cohort by the occurrence's local due date; evaluate completion state as of the period end. | Include tasks created during the period if they are created by its close and due in it. Apply pre-close reschedules to the due-date cohort. Exclude cancellation/deletion only when withdrawn before due; retain archived and due/overdue deleted or cancelled obligations. Reopened occurrences are incomplete at the cutoff unless completed again. Count generated recurrence occurrences by ID. Withhold the rate when event/schedule history is incomplete; current `done` or `dateKey` is not a historical substitute. |
| **On-time Rate** | Numerator: eligible occurrences whose first valid completion timestamp is at or before their recorded due timestamp. Denominator: distinct eligible occurrences first completed in the selected period whose due timestamp is known. N/A if zero. | Attribute to the first-completion local calendar period; compare the epoch completion timestamp with the recorded due timestamp. | Include occurrences created during the period. Use the latest schedule established before that first completion, including reschedules; do not use a later current due time. A later reopen does not erase the fact or timing of the first completion; recompletion does not add another occurrence or replace its first-completion result. Exclude cancelled/deleted completions only if lifecycle history establishes they were not valid completions; archive does not change whether a completion was on time. Existing `completed` events lack due hour/minute, so this metric is unavailable for historical records until those timestamps are captured. |
| **Overdue Tasks** | Numerator: distinct open occurrences overdue at the selected `asOf` instant. Denominator: not applicable (a count, not a rate); zero means no known overdue occurrences only in a complete period. | Snapshot at `asOf`, using local scheduled date/time interpreted in the user's timezone. A trend bucket, if added, is the count at that bucket's close, not a sum of overdue events. | Include created-during-period tasks only after creation. Use the schedule after reschedules up to `asOf`. Exclude completed, cancelled, archived, and actively snoozed tasks from the active overdue count; reopened tasks can become overdue again. Keep overdue deleted-task obligations only in historical due/cohort metrics, not the current open-task count. Count each recurring occurrence ID once. Historical status needs replayable state; `overdueAtAction` is only a fact at one action, not a period-end snapshot. |
| **Planned vs. Completed** | Planned series: distinct eligible occurrences due in the local bucket. Completed series: distinct occurrences whose **first** valid completion timestamp falls in that bucket. These are independent flows, not a same-bucket completion rate. | Planned by due-date bucket; completed by first-completion timestamp bucket. Display day, Monday-based week, calendar month, or calendar year using local boundaries. | Tasks created within a bucket enter a planned series only for their due-date bucket, not their creation bucket unless those coincide. Apply reschedules made before each close; do not rewrite a closed bucket with a later reschedule. Include valid archived completions and exclude withdrawn-before-due tasks from planned. A completed-and-reopened task remains in the historical first-completion flow; recompletion does not count it twice. A due occurrence can appear in planned and in a later completion bucket when completed late. Count recurring IDs once. Mark either series incomplete when its source history is incomplete. |
| **Daily / Weekly / Monthly / Yearly Completion Trends** | For each local bucket: number of distinct occurrence IDs with a first valid `completed` event in that bucket. Denominator: not applicable for a count trend. If a rate line is requested, use Completion Rate above and its explicit denominator. | Bucket by local completion timestamp, with Monday as week start and local calendar month/year boundaries. | A created-during-period task counts only if completed in that bucket. Reschedules do not move a completion event between buckets. Exclude duplicate event IDs and later completions of an already-counted occurrence. Reopen does not erase the historical first-completion action; it affects as-of Completion Rate instead. Archive/cancel/delete after completion do not remove the completion. Recurring occurrences are counted by their unique task IDs. Do not render zero for incomplete history. |

### Important distinction: period cohort vs. action trend

Completion Rate answers “of occurrences due in this period, how many were complete by its close?” Completion Trends answer “how many distinct occurrences had their first completion action in this period?” A late completion may therefore belong to an earlier due-date cohort but a later completion-time bucket. These measures must not be conflated.

## 4. Data gaps and risks

1. **No reliable historical denominator before tracking start.** Existing tasks, seeded tasks, and imported legacy tasks have no creation history. Do not infer past completion or plans from their current fields.
2. **Incomplete event delivery.** Task writes and history writes are not atomic, retries are absent, and a notice is not a machine-readable completeness ledger.
3. **Insufficient legacy schedule snapshots.** Pre-capture creation and completion events omit due hour/minute; edit and action event shapes are inconsistent. Strict On-time Rate and some historical overdue/cohort calculations for these periods remain unsupported.
4. **Deleted-task reconstruction is incomplete.** The event preserves only a few fields and the task record is removed. It cannot establish all historical task attributes or all lifecycle state.
5. **Ambiguous restore events.** `restored` is used for both delete undo and archive restore, complicating state reconstruction.
6. **Event ID collisions and ordering ties.** Fallback IDs can collapse same-millisecond similar events. Equal-time events sort lexically by ID, which is not guaranteed to represent mutation order.
7. **Tracking marker is only a boundary.** It can be absent (`null`); when present, it does not prove that history is complete or that all tasks at the boundary were inventoried.
8. **Local timezone changes.** `dateKey` is a local calendar date, while `occurredAt` is an epoch timestamp. If a user changes timezone, historical date attribution from the current browser zone can differ. The product should define reports as using the current device timezone unless a timezone identifier is persisted in a future design.
9. **No cross-device history.** IndexedDB and localStorage are local to the browser. Reports are per local installation and cannot imply a synchronized or account-wide record.

## 5. Phase 3B / 3C status

### Phase 3B — daily and weekly Reports (approved and implemented)

1. Daily and Monday-based weekly views use the tested metric API and local calendar boundaries, and display the browser's local timezone.
2. The Reports page includes an at-open Morning Briefing and a date-selectable Evening Review. The briefing uses current task state; historical metrics and task lists use recorded events only.
3. Historical coverage is explicit; unsupported periods and incomplete comparisons are withheld rather than shown as zero. The weekly previous-period comparison appears only when both closed weeks have complete coverage.
4. Monthly/yearly report views remain out of scope for this Phase 3B delivery.

### Phase 3C — future work (not started)

Any additional reports/reviews or scheduling behavior requires separate approval. No backend scheduling, push, integrations, authentication, or cross-device sync is implemented.

**Phase 3B is complete. Phase 3C remains unapproved and unimplemented.**

## 6. Implemented Phase 3A.1 event data

### Event envelope

The existing `taskEvents` store and key path are retained. New events add:

```text
eventVersion: 1
occurrenceId: task occurrence ID (same identity as taskId)
seriesId: recurrence series ID when known
snapshot: {
  createdAt (known for create actions; omitted for baseline observations),
  dueDate,
  dueHour,
  dueMinute,
  priority,
  repeat,
  done,
  archived,
  cancelled
}
```

Schedule-changing events retain `before` and `after` snapshots. Completion events record `completedAt` equal to `occurredAt` and the schedule snapshot that applied at completion. Deleted events retain the minimal snapshot above, so the removed task is still reportable. No title, description, attachment bytes, or reminder payload is copied into history because they are not needed for these metrics.

Use distinct new event types `delete-undone`, `archive-restored`, and `cancel-restored`, while retaining `deleted`, `archived`, `cancelled`, and `reopened`. Keep the old ambiguous `restored` type readable but classify affected historical state as incomplete. Generate independent event IDs for distinct actions and persist a monotonic sequence in the task-event transaction so equal-timestamp actions can be replayed in order.

At first launch after this change, append one `baseline-captured` event per current task and record its capture time and event-sequence watermark in metadata, in one transaction. This is an observation of the current state—not a claim about original creation, completion, or any earlier due-date history. It allows future planned cohorts to account for tasks already present at capture, while periods before capture remain unavailable and baseline tasks already done have no invented completion date. The baseline snapshot omits `createdAt`, which may have been defaulted while loading legacy tasks. The sequence watermark distinguishes valid pre-baseline records (which the baseline supersedes) from a post-baseline event timestamped before capture (which indicates a clock rollback and makes coverage incomplete).

### Migration decision and delivery guarantees

No IndexedDB schema migration is required: the existing event store is keyed by `id`, its indexes use existing fields, and IndexedDB records can contain additional structured-clone properties. The baseline timestamp fits the existing metadata store. This avoids changing the database version or touching tasks, attachment bytes, settings, reminders, or prior events.

The Phase 3A.1 implementation records events with the task snapshot and commits both in the same IndexedDB transaction. Pending event IDs are retained until that transaction succeeds; a failed transaction is surfaced through the existing error/status path. Event sequences and the baseline sequence watermark are assigned inside their respective transactions. The history-read API returns the baseline timestamp, sequence watermark, and a completeness flag with unfiltered events; filtered reads are not marked complete. Existing pre-change events remain untouched and are not upgraded by guessing. Pre-baseline events are superseded by the baseline observation; old periods and any post-baseline transition that cannot be unambiguously replayed stay marked incomplete/unavailable.

### Implemented formulas

- **Completion Rate** = distinct eligible occurrences due in the selected period that are done at the period cutoff ÷ distinct eligible occurrences due in the local period. A zero denominator returns N/A.
- **On-time Rate** = distinct occurrences whose first completion timestamp is at or before the due timestamp recorded at completion ÷ distinct occurrences first completed in the selected local period with a known due timestamp. A zero denominator returns N/A.
- **Overdue Tasks** = distinct occurrences open at the selected cutoff whose due timestamp is strictly earlier than the cutoff, excluding completed, archived, cancelled, deleted, and actively snoozed occurrences. This is a count, not a rate.
- **Planned vs. Completed** = due-cohort count attributed by due date versus distinct first-completion count attributed by completion date. They are independent flows, not a same-period rate.
- **Task status breakdown** partitions that same eligible due cohort at the selected cutoff into completed, not completed and not overdue, and not completed and overdue. The three counts are mutually exclusive and sum to planned occurrences; active overdue excludes archived, cancelled, deleted, and actively snoozed tasks. This is a presentation of the metric engine's replayed state, not a second task cohort.
- **Daily/weekly/monthly/yearly completion trend** = distinct occurrence IDs with a first completion in each local calendar bucket. Weekly buckets begin Monday.
- **Created in period** is the distinct count of `created` and `occurrence-created` events in the bucket; `baseline-captured` is never counted as creation.
- A metric value is withheld (`null`) when coverage is partial, unavailable, or invalid. For an incomplete rate, numerator and denominator are withheld too. A zero-denominator rate is N/A; a complete count metric may be zero.
- Periods use local half-open boundaries. The cutoff is the earlier of `asOf` and the final millisecond before the exclusive end boundary, so an event exactly at the next midnight belongs to the next period.
- Reschedules affect the due cohort only when captured before the cutoff. Reopen changes the as-of done state but does not erase the first-completion trend or on-time observation. Archived due tasks remain planned; cancellation/deletion before due withdraws them, while cancellation/deletion at or after due does not erase the obligation. Each recurring occurrence is counted once by ID.

### Incomplete-history communication

The Reports page shows a plain-language coverage label and withholds affected values instead of rendering zero. If an event write or integrity check fails, the affected metrics remain unavailable/incomplete. Reports are local to this browser and do not imply synchronization.

## 7. Implemented Phase 3B Reports UI

- A Reports navigation entry opens a separate page; Home remains focused on task execution.
- The at-a-glance dashboard leads with the selected period, a plain-language planned/completed summary, a labeled SVG status donut, supported positive/attention observations, and a short current action list. Donut categories partition the same eligible due cohort used by Completion Rate.
- The daily report shows Completion Rate, On-time Rate, remaining and overdue counts, planned versus first-completed counts, and task summaries for completed, remaining, and overdue occurrences when history is complete.
- The weekly report shows a seven-day planned/completed/overdue table with text labels and visual bars. Future days are labeled as upcoming instead of showing zero activity.
- Previous-week values are shown only after the selected week has ended and both periods have complete history. Partial or unavailable comparisons are explained.
- The Reports page retains its on-demand planning briefing from current tasks. The configurable Morning Briefing reviews the previous local day and is available in-app at the selected time while the app is open, or once on the next app open if that time was missed. Evening Review can be inspected for any past date and never changes a task automatically.
- Morning Briefing and Evening Review remain available as keyboard-operable disclosures so they do not push the selected-period summary below the fold.
- Historical task names are not stored in events; summary rows use a task's current title when it remains available and otherwise use a generic removed/unavailable label. Historical due times and metric attribution come from event snapshots, not current task schedules.
- No IndexedDB schema change or new dependency was introduced.

## 8. Phase 3B.2 progress and briefing behavior

- Home progress is the current-state ratio of completed tasks to non-archived, non-cancelled tasks scheduled on the selected local date. Empty days show no percentage rather than a misleading 0%. It is derived from React task state, so completion and reopening are reflected before the storage write finishes.
- Reports continue to use the historical metric definitions above. After a task/event transaction succeeds, the Reports page reloads the persisted event stream before recalculating; an unavailable or incomplete history remains unavailable rather than being replaced by current task fields or zero.
- The Morning Briefing setting is stored in the existing localStorage settings record. It defaults to enabled at 07:00 local time and records the last displayed report date to prevent repeating the same briefing. It summarizes the previous local calendar day only when history coverage supports the counts; otherwise it explains that historical figures are unavailable.
- The previous day can also be opened manually from Reports at any time. The briefing does not modify or reschedule tasks.
- This is in-app delivery only. A browser tab cannot reliably display a scheduled popup while the browser/app is closed. Reliable background delivery would require a separately approved Web Push/service-worker and backend scheduler design; this phase adds neither backend scheduling nor browser notifications.

## 9. Phase 3C monthly and yearly reports

- Monthly reports use local calendar months and show one bucket per day; yearly reports use local calendar years and show one bucket per month. Both use `calculatePeriodMetrics` for the whole period and every bucket, preserving occurrence IDs, local timezone boundaries, and the existing definitions for planned cohorts, completions, overdue status, rescheduling, reopening, deletion, archival, cancellation, and recurrence.
- Each trend row compares planned occurrences attributed by due date with distinct first completions in that bucket. Completion and on-time rates and overdue counts come directly from the metric engine. A metric that lacks complete coverage remains unavailable instead of being displayed as zero.
- Future days or months in the current period are marked as upcoming and have no calculated metrics. The selected period is explicitly labeled as current/incomplete or closed.
- Month-to-month and year-to-year comparisons are shown only for a closed selected period when both full periods have complete history coverage. Otherwise, the page explains why the comparison is withheld.
- The monthly and yearly views add calendar-period navigation and shortcuts to the current month or year. They introduce no new metric formulas, dependencies, persistence behavior, or IndexedDB schema changes.

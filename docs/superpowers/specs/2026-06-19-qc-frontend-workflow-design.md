# QC Frontend Workflow Improvements — Design

Date: 2026-06-19
Status: Approved (design)

## Goal

Reduce friction in the supervisor/stylist QC flow on the web app (`apps/web`):
remove repetitive data entry, make in-progress sessions always visible and
durable, route correctly after submit, and make history easier to scan.

## Requirements

1. After submitting a session for evaluation, navigate to the **History** page.
2. **Wig ID** is auto-generated; the user never types it.
3. **Stylist name** is set once (profile) and never re-entered per session or per wig.
4. **Session tabs** strip is a global, horizontally-scrollable bar at the top of
   every main screen, showing all sessions (including the active one).
5. A user can start a new session while another is mid-upload (not yet submitted)
   and still see all session tabs above.
6. **History** is grouped by day and offers quick date filters.
7. In-progress sessions survive a page refresh / app reopen.

## Decisions

- **Wig ID format:** `WIG-YYYYMMDD-NNN`, daily counter in localStorage
  (`wigCounter:<YYYYMMDD>`), resets each day. Per-device counter — cross-device
  same-day collisions are possible and accepted for now.
- **Stylist name:** set-once profile in localStorage (`stylist_name`). Auth user
  carries only `{ email, role }`, so the name is not derivable from auth.
- **Session bar:** global, rendered in `App.jsx`, includes the active session
  (highlighted). Hidden when zero sessions.
- **History:** quick-filter chips (Today / Yesterday / Last 7 days / Last 30 days
  / Custom) + day-group headers. Custom reveals existing from/to pickers.
- **Persistence:** SessionContext persisted to localStorage.

## Components & Changes

### New: `apps/web/src/lib/wigId.js`
`nextWigId()` → returns `WIG-YYYYMMDD-NNN`. Reads/increments
`localStorage["wigCounter:<YYYYMMDD>"]` (default 0 → 1), zero-pads to 3 digits.

### New: `apps/web/src/context/ProfileContext.jsx` (or `useProfile` hook)
- State: `stylistName` (string|null), backed by `localStorage["stylist_name"]`.
- `setStylistName(name)`, `hasProfile` boolean.
- Provider mounted alongside `SessionProvider` in `App.jsx`.

### New: `apps/web/src/components/SessionBar.jsx`
Replaces `SessionSwitcher.jsx`.
- Reads `sessions`, `activeSessionId`, `switchSession` from SessionContext.
- Renders all sessions, horizontally scrollable (`overflow-x-auto`).
- Active session visually highlighted; others tappable to switch.
- Status line: `n/7 photos` (uploading) / `Analysing…` (processing) / `Done` (completed).
- Tap behavior: switch active session, then navigate to `/upload` (in progress)
  or `/results` (completed); processing chip non-navigating.
- Returns null when `sessions.length === 0`.
- `SessionSwitcher.jsx` is deleted; its usage in `ResultsScreen` removed.

### Modified: `apps/web/src/App.jsx`
- Wrap with `ProfileProvider`.
- Render `<SessionBar />` once, above `<Routes>`, inside the SessionProvider shell
  so it appears on all screens. (Login screen renders before the provider shell,
  so it is unaffected.)

### Modified: `apps/web/src/context/SessionContext.jsx`
- Initialize `sessions` and `activeSessionId` from localStorage
  (`qc_sessions`, `qc_active_session_id`).
- Persist both on change via `useEffect`.
- Note: `uploads` may include data-URL previews; persisting large base64 could
  bloat localStorage. Persist session metadata + status + result, but **omit the
  `preview` data-URLs** from persisted uploads (keep `{ uploaded }` only). On
  reload, previews are gone but upload progress/status is intact.

### Modified: `apps/web/src/screens/NewSessionScreen.jsx`
- Remove the Wig ID input; assign `nextWigId()` on continue.
- Remove the Stylist Name input when a profile exists; use stored name.
  If no profile yet, show a one-field capture (name) and save to profile on continue.
- `canContinue` = `skuId && stylistName present`.

### Modified: `apps/web/src/screens/PhotoUploadScreen.jsx`
- After successful submit-for-evaluation, `navigate('/history')` instead of
  results/processing. Background polling in SessionContext continues.

### Modified: `apps/web/src/screens/HistoryScreen.jsx`
- Add quick-filter chips: Today / Yesterday / Last 7 days / Last 30 days / Custom.
  Chips set `fromDate`/`toDate`; Custom reveals the existing date pickers.
- Group fetched entries by calendar day; render a day header before each group
  (`Today`, `Yesterday`, else `EEE d MMM`). Groups and rows newest-first.

## Data Flow

- New session: profile name + `nextWigId()` → `apiCreateSession` → `createSession`
  (context) → persisted to localStorage → SessionBar updates everywhere.
- Upload + submit → `/history`; session polls to `completed` in background; bar
  reflects status; reopen via History or bar.

## Out of Scope (noted, not included)

- Overall verdict-feedback read-back and per-criterion rating persistence audit
  (separate prior finding). May be folded in only if explicitly requested.
- Server-side wig-ID sequencing (cross-device uniqueness).

## Testing

- `nextWigId` unit test: format, daily reset, increment.
- Profile hook: set/get/persist.
- SessionContext: persistence round-trip, preview omission.
- Manual: submit→history; concurrent sessions visible in bar; refresh keeps bar;
  history chips + day grouping.

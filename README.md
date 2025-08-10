<div align="center">

# Billy – The Task Manager

Rich drag & drop calendar scheduling + brain dump workflow. Normally the kind of interactive scheduling / resizing UX you only see locked inside paid SaaS products – open‑sourced here so you can learn, extend, and self‑host.

</div>

## ✨ Key Features

- Brain Dump Inbox: Create tasks quickly (title, description, tags, priority) without needing to schedule them immediately.
- Week Calendar (30‑min grid): 7‑day, 24h view sliced into 30‑minute slots (now with taller 40px rows for readability).
- Drag & Drop Scheduling: Drag from brain dump into any half‑hour slot; automatic assignment of date + start time.
- In‑Calendar Move: Grab any scheduled task block and drag vertically to a new start time (whole block is draggable).
- Resize Duration: Pull the bottom grip to extend/shrink a task; duration snaps to 30‑minute increments and updates the stored time estimate.
- Priority Color System: High / Medium / Low priorities propagate consistent border + background accents across cards and calendar blocks.
- Prevent Accidental Clicks: Resize interactions won’t open the edit modal on mouseup.
- Auto Scroll to Start Hour: Calendar auto‑positions to 9 AM on first load for faster context.
- Current Time Indicator: Red line + dot in today’s column for temporal orientation.
- Dark Themed Scrollbars & UI: Tailwind + subtle glassy backgrounds; custom scrollbar styling.
- Local Persistence: All tasks stored in `localStorage` (with cross‑tab sync) – no backend required.
- Safe Defaults: Initial sample tasks show structure; no external services needed.
- Tags Support: Displayed on cards & inside taller calendar blocks.
- Responsive-ish Layout: Horizontal scroll for full week + vertical scroll for hours.
- Open Source Friendly Stack: Lightweight, modern, no heavy state framework.

## 🧠 Why This Matters

Interactive calendar task blocks with true drag, drop, resize, and color semantics are usually gated inside proprietary productivity tools. This repo demonstrates how to build that UX with:

- Clear data model (tasks + week derivation)
- Predictable time math (30‑minute slot indexing)
- Simple persistence layer (can later swap to IndexedDB / server)
- Minimal but powerful drag engine (dnd‑kit)

Use it as a learning scaffold or the base for your own productivity app.

## 🏗️ Tech Stack

- React 18 + TypeScript
- Vite (fast dev + build)
- Tailwind CSS (utility styling + dark theme)
- dnd-kit (drag/drop + sortable + sensors)
- date-fns (date math & formatting)
- lucide-react (icons)
- uuid (ID generation)

## 📂 Project Structure (High Level)

```
src/
	components/
		CalendarView.tsx   // Week grid, droppables, TaskBlock rendering
		TaskCard.tsx       // Reusable task card (sortable / static modes)
		BrainDump.tsx      // (If extended) Inbox list (not yet elaborated here)
		WeeklyBoard.tsx    // Board / alt views (future extensibility)
	hooks/
		useTasks.ts        // Core task state + persistence + derived week days
	types/               // Task & calendar type definitions
	App.tsx              // DnD context + top-level wiring
```

## 🗃️ Data Model (Task)

```ts
interface Task {
	id: string;
	title: string;
	description?: string;
	timeEstimate: number;      // minutes
	priority: 'low' | 'medium' | 'high';
	status: 'pending' | 'in-progress' | 'completed';
	createdAt: Date;
	scheduledDate?: string;    // YYYY-MM-DD
	scheduledTime?: string;    // HH:mm (start)
	tags: string[];
}
```

Duration displayed in the calendar is derived from `timeEstimate` (mutable via resize). End time = start time + timeEstimate.

## 🔄 Persistence Layer

- Implemented via `localStorage` key `taskManager.tasks.v1`.
- On load: JSON parsed, `createdAt` rehydrated to `Date`.
- On every task mutation: state serialized.
- Cross‑tab Sync: `storage` event listener updates memory state if another tab writes changes.

To upgrade later: Replace persistence section inside `useTasks.ts` with IndexedDB or remote API fetch/patch calls.

## 🧮 Time & Slot Math

- 24h * 2 = 48 half‑hour slots.
- Index formula: `index = hour * 2 + (minute >= 30 ? 1 : 0)`.
- Pixel top: `index * slotHeight` (slotHeight = 40).
- Resize: Pointer deltaY → nearest slot delta → minutes = base + (deltaSlots * 30).

## 🧲 Drag & Drop Overview

- Brain dump tasks: Sortable / draggable sources (dnd‑kit `useSortable`).
- Calendar slots: Each slot is a droppable with ID pattern: `slot|<date>|<HH:mm>`.
- Calendar blocks: Draggable vertically (whole surface) using `useDraggable` to reposition.
- Drop handling (in `App.tsx`): Parse droppable ID, update `scheduledDate` + `scheduledTime`.

## 🚀 Getting Started

### Prerequisites
Node 18+ (recommended) & npm (or pnpm/yarn if you adapt commands).

### Install
```bash
npm install
```

Create a `.env` (or preferably `.env.local`) file with:
```
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY_HERE
```
Never commit service role keys; only the public anon key belongs here.

### Run Dev Server
```bash
npm run dev
```
Open the printed localhost URL (typically http://localhost:5173/).

### Lint
```bash
npm run lint
```

### Production Build
```bash
npm run build
```
Preview the build:
```bash
npm run preview
```

## 🖱️ Usage Tips

- Drag unscheduled task → calendar slot to schedule.
- Click a scheduled block to edit (future: modal editing can be extended).
- Resize from the bottom grip to change duration (snaps to 30m).
- Drag scheduled block vertically to move it; release over new slot.
- Tasks with longer height show more metadata (description, tags).

## 🔐 No Backend Yet

Everything is local. If you clear browser storage you lose tasks (export / import coming soon). For multi‑device sync you can bolt on a small API (Next.js / Express / Supabase, etc.).

## 🛣️ Roadmap / Ideas

- Overlapping task auto layout (multi‑column stacking)
- Horizontal drag to move between days directly
- Keyboard accessibility for move / resize
- IndexedDB persistence + export/import JSON
- Filter & search panel (priority, tag, status)
- Recurring task templates
- Focus / “Now” mode with countdown
- Offline-first + sync conflict resolution
- Theming (light / custom palettes)

## 🤝 Contributing

PRs welcome. Please keep patches focused and include a brief description. If you introduce new dependencies, justify them in the PR body.

## 📄 License

MIT – do whatever, just retain copyright & license notice.

## 💬 Attribution / Inspiration

Built to demonstrate that high‑quality calendar interaction patterns are achievable with a small, understandable codebase. Feel free to fork and evolve.

## 🧪 Quick Quality Checklist (Current State)

- TypeScript: passes basic build (Vite) & no TS errors in core modified files
- ESLint: configured (`npm run lint`)
- Runtime: localStorage persistence tested manually

## 🙌 Support

If this saves you time you can: star the repo, share it, or build something awesome on top and credit back.

Enjoy hacking!

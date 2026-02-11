# Karaoke Queue - AI Agent Guide

## Project Overview

A real-time karaoke queue management system with a dual-interface design. The TV interface (`/tv`) displays the current video and room code for large screens, while the mobile interface (`/mobile`) allows users to join rooms, search for songs via YouTube, and manage the queue. Communication between interfaces happens through WebSockets for instant synchronization.

**Key Features:**
- Create/join karaoke rooms with 6-character alphanumeric codes
- YouTube video search and playback
- Real-time queue management across all connected devices
- Voice search (mobile interface)
- QR code room sharing
- Bilingual support (Vietnamese and English)
- Scoring animation after each song ends

---

## Technology Stack

### Frontend
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight router)
- **State Management**: TanStack React Query for server state, React hooks for UI state
- **Styling**: Tailwind CSS 3.4 with custom HSL color variables
- **UI Components**: shadcn/ui (New York style) with Radix UI primitives
- **Icons**: Lucide React
- **Build Tool**: Vite 7 with React plugin

### Backend
- **Runtime**: Node.js with Express 5
- **Language**: TypeScript with ESM modules (`"type": "module"`)
- **WebSocket**: Native WebSocket server using `ws` library
- **Session**: Express sessions with `memorystore` (dev) or `connect-pg-simple` (prod)

### Database
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Migrations**: Drizzle Kit (`db:push` command)
- **Connection Pooling**: `pg` library with max 10 connections

### External APIs
- **YouTube IFrame API**: Video playback (client-side)
- **YouTube Data API v3**: Video search (server-side, requires API key)
- **Web Speech API**: Voice search on mobile (browser-native)

---

## Project Structure

```
.
├── client/                     # Frontend React application
│   ├── index.html             # HTML entry point
│   ├── public/                # Static assets (favicon)
│   └── src/
│       ├── main.tsx           # React app entry
│       ├── App.tsx            # Root component with routing
│       ├── index.css          # Tailwind + custom CSS variables
│       ├── pages/
│       │   ├── tv.tsx         # TV interface (dark mode)
│       │   ├── mobile.tsx     # Mobile interface (light mode)
│       │   └── not-found.tsx  # 404 page
│       ├── components/
│       │   ├── ErrorBoundary.tsx
│       │   └── ui/            # shadcn/ui components (50+ files)
│       ├── hooks/
│       │   ├── use-toast.ts
│       │   └── use-mobile.tsx
│       └── lib/
│           ├── utils.ts       # cn() helper for Tailwind
│           ├── queryClient.ts # React Query configuration
│           ├── translations.ts # VI/EN translations
│           └── useLanguage.ts # Language state hook
├── server/                     # Backend Express application
│   ├── index.ts               # Server entry, middleware setup
│   ├── routes.ts              # API routes + WebSocket handlers
│   ├── db.ts                  # Database pool + connection test
│   ├── storage.ts             # DatabaseStorage class (CRUD)
│   ├── vite.ts                # Vite dev server integration
│   └── static.ts              # Production static file serving
├── shared/                     # Shared code between client/server
│   └── schema.ts              # Drizzle schema + Zod types
├── script/
│   └── build.ts               # Production build script (esbuild + vite)
├── drizzle.config.ts          # Drizzle Kit configuration
├── vite.config.ts             # Vite configuration
├── tailwind.config.ts         # Tailwind with custom theme
├── tsconfig.json              # TypeScript paths: @/*, @shared/*
└── components.json            # shadcn/ui configuration
```

---

## Build and Development Commands

```bash
# Development - runs server with tsx, Vite HMR for client
npm run dev

# Production build - bundles client with Vite, server with esbuild
npm run build

# Production start - runs bundled server from dist/index.cjs
npm start

# Type check only (no emit)
npm run check

# Push database schema changes (Drizzle Kit)
npm run db:push
```

**Build Process Details:**
- Client builds to `dist/public/` via Vite
- Server bundles to `dist/index.cjs` via esbuild (CommonJS format)
- Selective dependency bundling: only specific deps are bundled (see `allowlist` in `script/build.ts`)
- Remaining deps are treated as externals

---

## Environment Variables

Required environment variables:

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `GOOGLE_API_KEY` | YouTube Data API v3 key | Yes (for search) |
| `GOOGLE_API_KEY_2` | Secondary API key (round-robin) | Optional |
| `GOOGLE_API_KEY_3` | Tertiary API key (round-robin) | Optional |
| `SESSION_SECRET` | Session encryption key | Yes |
| `PORT` | Server port (default: 5000) | Optional |
| `NODE_ENV` | Environment mode | Set by scripts |

---

## Database Schema

### Tables

**rooms** - Karaoke room state
- `id` (varchar, PK, UUID)
- `code` (varchar(6), unique) - 6-char room code
- `currentVideoId` (varchar) - YouTube video ID currently playing
- `currentVideoTitle` (text)
- `currentVideoThumbnail` (text)
- `isPlaying` (boolean, default: false)
- `createdAt` (timestamp, default: now())

**queueItems** - Songs in room queue
- `id` (varchar, PK, UUID)
- `roomId` (varchar, FK → rooms.id, cascade delete)
- `videoId` (varchar) - YouTube video ID
- `title` (text) - Song title
- `thumbnail` (text) - YouTube thumbnail URL
- `channelTitle` (text) - YouTube channel
- `duration` (varchar) - Formatted duration (e.g., "3:45")
- `position` (integer) - Queue order
- `status` (varchar(20), default: "waiting") - "waiting" | "playing"
- `addedAt` (timestamp, default: now())

### Relations
- Room has many QueueItems
- QueueItem belongs to Room

---

## WebSocket Protocol

WebSocket endpoint: `/ws`

### Client → Server Messages

| Type | Payload | Description |
|------|---------|-------------|
| `join_room` | `{ roomCode, deviceName?, deviceType? }` | Join a room |
| `play` | - | Resume playback |
| `pause` | - | Pause playback |
| `skip_song` | - | Skip current song, play next |

### Server → Client Messages

| Type | Payload | Description |
|------|---------|-------------|
| `room_state` | `{ room, queue, devices }` | Full room state on join |
| `queue_updated` | `{ queue }` | Queue has changed |
| `song_added` | `{ song }` | New song added notification |
| `song_removed` | `{ songId }` | Song removed notification |
| `playback_state` | `{ isPlaying }` | Play/pause state changed |
| `current_song` | `{ videoId, title, thumbnail }` | Now playing changed |
| `device_joined` | `{ device }` | New device connected |
| `device_left` | `{ deviceId, deviceName }` | Device disconnected |
| `error` | `{ message }` | Error notification |

---

## Dual Interface Design

### TV Interface (`/` and `/tv`)
- **Theme**: Dark mode (`.dark` class), black background
- **Purpose**: Large screen display showing video player
- **Features**:
  - YouTube IFrame API player (chromeless)
  - Room code display with QR code
  - Playback controls (play/pause/skip)
  - Connected devices list
  - Queue preview (horizontal scroll)
  - Auto-scoring animation after song ends

### Mobile Interface (`/mobile`)
- **Theme**: Light mode, white background
- **Purpose**: Phone/tablet for searching and queue management
- **Features**:
  - Room code entry (auto-filled from QR scan)
  - YouTube song search with voice input
  - Add/remove songs from queue
  - Real-time queue view
  - Tab-based navigation (Search / Queue)

---

## Development Conventions

### Code Style
- TypeScript with strict mode enabled
- ESM modules throughout (`import`/`export`)
- Path aliases: `@/` for client, `@shared/` for shared
- React functional components with hooks
- Custom hook pattern for reusable logic

### Component Patterns
- shadcn/ui components use Radix UI primitives
- Styling via `className` with Tailwind utilities
- `cn()` utility from `lib/utils.ts` for conditional classes
- `data-testid` attributes for testing hooks

### State Management
- Server state: React Query with `apiRequest()` helper
- Local UI state: `useState`, `useRef`
- WebSocket state: Managed via `useRef<WebSocket>`
- Language preference: `localStorage` persistence

### Styling Conventions
- Tailwind CSS with CSS custom properties (HSL)
- Color variables: `--background`, `--foreground`, `--primary`, etc.
- Custom utility classes: `hover-elevate`, `active-elevate`, `toggle-elevate`
- Responsive design with Tailwind breakpoints

### Error Handling
- ErrorBoundary component wraps routes
- Toast notifications via `useToast()` hook
- API errors logged to console with structured messages
- WebSocket auto-reconnect with 3s delay

---

## Testing Strategy

No automated test suite is currently configured. The codebase includes:
- `data-testid` attributes on key UI elements for E2E testing
- Error boundaries for graceful error handling
- TypeScript strict mode for compile-time checking

---

## Security Considerations

- CORS not explicitly configured (assumes same-origin)
- No authentication system - rooms are public by code
- YouTube API keys are server-side only
- Database uses parameterized queries via Drizzle ORM
- WebSocket messages are validated with Zod schemas

---

## Key Implementation Details

### YouTube API Key Rotation
Multiple API keys can be configured (`GOOGLE_API_KEY`, `GOOGLE_API_KEY_2`, `GOOGLE_API_KEY_3`). The server rotates through them to distribute quota usage.

### Room Code Generation
6-character alphanumeric codes (excluding 0, 1, I, O to avoid confusion). Codes are validated to be unique before room creation.

### Queue Management
- First song added starts playing immediately
- Subsequent songs queue with "waiting" status
- On skip/video end, next waiting song auto-plays
- Queue positions are sequential integers

### Scoring System
After a video ends (detected via YouTube player state), a random score (50-100) is displayed with star rating and applause sound effect.

---

## Deployment Notes

The application is designed for Replit deployment:
- Replit-specific Vite plugins (`@replit/vite-plugin-cartographer`, `@replit/vite-plugin-dev-banner`)
- Port defaults to 5000 (Replit's exposed port)
- Static file serving in production mode
- Database provisioning via Replit's PostgreSQL integration

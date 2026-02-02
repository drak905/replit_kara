# Karaoke Queue

## Overview

A real-time karaoke queue management system with a dual-interface design. The TV interface displays the current video and room code for large screens, while the mobile interface allows users to join rooms, search for songs, and manage the queue. Communication between interfaces happens through WebSockets for instant synchronization.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack React Query for server state, local React state for UI
- **Styling**: Tailwind CSS with shadcn/ui component library (New York style)
- **Build Tool**: Vite with custom plugins for Replit integration

### Dual Interface Design
- `/tv` route: Large screen display showing video player, room code, and queue
- `/mobile` route: Mobile-optimized interface for searching songs and managing queue
- Both interfaces connect via WebSocket for real-time synchronization

### Backend Architecture
- **Runtime**: Node.js with Express 5
- **Language**: TypeScript with ESM modules
- **Real-time**: Native WebSocket server (ws library) attached to HTTP server
- **API Pattern**: REST endpoints for CRUD operations, WebSocket for real-time updates

### Data Storage
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema Location**: `shared/schema.ts` (shared between client and server)
- **Migrations**: Drizzle Kit with `db:push` command for schema synchronization

### Database Schema
- **rooms**: Stores room state including code, current video, and playback status
- **queueItems**: Tracks songs in each room's queue with position ordering

### Real-time Communication
- WebSocket messages handle room joining, queue updates, and playback synchronization
- Room-based broadcasting ensures updates only go to relevant connected clients

## External Dependencies

### Database
- PostgreSQL via `DATABASE_URL` environment variable
- Connection pooling with `pg` library

### Third-party APIs
- YouTube IFrame API for video playback on TV interface
- YouTube Data API v3 for video search (server-side, requires GOOGLE_API_KEY)
- Web Speech API for voice search on mobile interface (browser-based)

### Environment Variables
- `DATABASE_URL` - PostgreSQL connection string
- `GOOGLE_API_KEY` - YouTube Data API v3 key for video search
- `SESSION_SECRET` - Session encryption key

### Design Specifications
- YouTube-inspired color palette: Red primary (#FF0000), Dark grey (#282828)
- TV interface: Dark mode with black background
- Mobile interface: Light mode with white background
- Success notifications: Green (#00C853)
- Room codes: 6-character uppercase alphanumeric

### UI Components
- Radix UI primitives for accessible components
- Lucide React for icons
- Class Variance Authority for component variants

### Build & Development
- Vite for frontend bundling
- esbuild for server bundling with selective dependency bundling
- tsx for development server with TypeScript execution
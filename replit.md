# YouTube Downloader

## Overview

This is a modern YouTube video downloader web application built with a full-stack TypeScript architecture. The application allows users to input YouTube URLs, preview video information, and download videos in various formats and qualities. It features a clean, responsive UI built with React and shadcn/ui components, with real-time download progress tracking and file management capabilities.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript in a Single Page Application (SPA) architecture
- **UI Library**: shadcn/ui components built on Radix UI primitives for accessibility and consistency
- **Styling**: Tailwind CSS with CSS custom properties for theming and dark mode support
- **State Management**: TanStack Query (React Query) for server state management and caching
- **Routing**: Wouter for lightweight client-side routing
- **Form Handling**: React Hook Form with Zod validation for type-safe form management
- **Build Tool**: Vite for fast development and optimized production builds

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **API Design**: RESTful API with JSON responses
- **Video Processing**: yt-dlp integration for YouTube video information extraction and downloading
- **File Management**: Local filesystem storage for downloaded videos with automatic directory creation
- **Error Handling**: Centralized error middleware with structured error responses

### Data Storage Solutions
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **Connection**: Neon Database serverless PostgreSQL for cloud deployment
- **Schema Management**: Drizzle Kit for migrations and schema versioning
- **Session Storage**: PostgreSQL-backed session storage using connect-pg-simple
- **Development Fallback**: In-memory storage implementation for development environments

### Authentication and Authorization
- **Session Management**: Express sessions with PostgreSQL storage
- **User Model**: Simple username/password authentication system
- **Storage Interface**: Abstracted storage layer supporting both database and in-memory implementations

### External Service Integrations
- **YouTube Data Extraction**: yt-dlp command-line tool for video metadata and download capabilities
- **Video Formats**: Support for multiple output formats (MP4, WebM, MP3, WAV)
- **Quality Options**: Multiple resolution options (360p, 480p, 720p, 1080p)
- **Real-time Updates**: Polling-based progress tracking for download status

### Development and Deployment
- **Development Server**: Vite dev server with Express API integration
- **Build Process**: esbuild for server bundling and Vite for client bundling
- **Environment**: Replit-optimized with specialized plugins and error handling
- **Hot Reload**: Full-stack hot reload support with Vite middleware integration

The application follows a modern full-stack TypeScript pattern with clear separation between client and server code, shared type definitions, and a robust component architecture that prioritizes user experience and maintainability.
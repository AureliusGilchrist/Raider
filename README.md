# Raider

## Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later)
- [Go](https://go.dev/) (v1.21 or later)

## Getting Started

### Client

```bash
cd client
npm install
npm run dev
```

The client dev server starts at `http://localhost:3000`.

Available scripts:

| Command           | Description                    |
| ----------------- | ------------------------------ |
| `npm run dev`     | Start the development server   |
| `npm run build`   | Build for production           |
| `npm run preview` | Preview the production build   |

> **Note:** Do not run `npx rsbuild` or `npm exec rsbuild` directly. The
> `rsbuild` CLI is provided by the `@rsbuild/core` dependency and is invoked
> through the npm scripts listed above.

### Server

```bash
cd server
go run .
```

The API server starts at `http://localhost:6423`.
# Snapchain Cast API

A Farcaster Cast API built with Bun, Elysia, and direct Snapchain gRPC integration.

## Project Structure

```
src/
├── types/          # TypeScript interfaces and types
│   ├── api.ts      # API response types  
│   └── grpc.ts     # gRPC message types
├── utils/          # Utility functions
│   ├── converters.ts # Data format converters
│   └── constants.ts  # App constants
├── services/       # Service layer
│   ├── grpc.ts     # gRPC client wrapper
│   └── cast.ts     # Cast business logic
├── transformers/   # Data transformation layer
│   ├── userProfile.ts # User profile transformers
│   └── cast.ts        # Cast data transformers
├── app.ts          # Elysia app setup
└── index.ts        # Application entry point
```

## Installation

Prerequisites:
- Snapchain node running on `localhost:3383`
- Bun runtime
- Docker access for gRPC calls

```bash
bun install
```

## Usage

```bash
# Development server with hot reload
bun dev

# Production server
bun start

# Direct execution
bun run src/index.ts
```

## API Endpoints

### GET /v1/cast

Parameters:
- `fid` (required) - Farcaster ID of cast author
- `hash` (required) - Cast hash (0x prefixed hex string)

Response:
```json
{
  "cast": {
    "object": "cast",
    "hash": "0x...",
    "author": {
      "fid": 3,
      "username": "user.eth",
      "display_name": "User Name",
      "pfp_url": "https://...",
      "follower_count": 1000,
      "following_count": 500,
      "verifications": ["0x..."],
      "verified_addresses": {...}
    },
    "text": "Cast content",
    "reactions": {
      "likes_count": 10,
      "recasts_count": 5
    },
    "replies": { "count": 3 },
    "mentioned_profiles": [...]
  }
}
```

### GET /health

Returns server status and timestamp.

## Architecture

### Service Layer
- `services/grpc.ts` - Low-level Snapchain gRPC operations
- `services/cast.ts` - High-level cast business logic

### Transformation Layer  
- `transformers/userProfile.ts` - User data transformation
- `transformers/cast.ts` - Cast response building

### Data Sources

The API uses these Snapchain gRPC methods:
- `GetCast` - Core cast data
- `GetUserDataByFid` - User profiles
- `GetVerificationsByFid` - Address verifications  
- `GetReactionsByCast` - Reaction counts
- `GetCastsByParent` - Reply counts
- `GetLinksByFid/Target` - Follow relationships
- `GetCurrentStorageLimitsByFid` - Subscription status

## Development

To add new features:
1. Add types in `src/types/`
2. Add gRPC methods in `src/services/grpc.ts`
3. Add transformers in `src/transformers/`
4. Add endpoints in `src/app.ts`

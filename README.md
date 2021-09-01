# Sputnik Radio

A Discord Music Bot

## Setup

Requires:

- NodeJS v16+
- NPM

To Install:

### 1. Install Dependencies

install npm packages

```
npm install
```

### 2. Build Source Files

Run this to build the typescript into JavaScript for NodeJS to run

```
npm run build
```

### 3. Add Environment Variables

Create a new file called `.env` and add the following

```
DISCORD_TOKEN=<your discord bot token>
DISCORD_APP_ID=<your discord bot app id>

SPOTIFY_CLIENT_ID=<your spotify client id here>
SPOTIFY_CLIENT_SECRET=<your spotify secret here>
```

Fill out the obvious placeholders. You will need to create a bot via the discord developer portal and get spotify api keys (both are free).

### 4. Run the Bot

Run the bot using the command:

```
npm start
```

Should be right.

## Commands

Sputnik Radio's Commands:

### `/play`

Follow with a youtube link, a spotify share link, a spotify playlist link or just search

### `/skip`

Skip the current track

### `/queue`

Show the current queue

### `/clear`

Clear the current queue

### `/leave`

Tell sputnik to clear the queue and leave the channel

### `/gui`

Coming soon...

### `/search`

Coming soon...

### `/api`

Returns you the URL for the REST API

### `/shuffle`

Shuffle the current queue

import { MusicQueue } from './music/Queue'
import { Track } from './music/Track'
import { spotifyPlaylistToYoutube } from './spotify/playlist'
import { spotifyToYoutube } from './spotify/search'
import { Enqueueable } from './types/queue'
import { youtubeSearch } from './youtube/search'

export const determineQueue = async (
  songQuery: string,
  channelId?: string,
  userId?: string
) => {
  let enqueue: null | Enqueueable | Enqueueable[] = null
  if (
    /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\/(watch\?v=)?.*$/.test(
      songQuery
    )
  ) {
    // Is a youtube link!
    enqueue = {
      origin: 'youtube',
      url: songQuery,
      channelId: channelId,
      queuedBy: userId,
    }
  } else if (/https?:\/\/open\.spotify\.com\/track\/.*$/.test(songQuery)) {
    // Is a spotify share link!
    enqueue = await spotifyToYoutube(songQuery, channelId, userId)
  } else if (/https?:\/\/open\.spotify\.com\/playlist\/.*$/.test(songQuery)) {
    // Is a spotify playlist link
    enqueue = await spotifyPlaylistToYoutube(songQuery, channelId, userId)
  } else {
    // We're going to need to google it!
    const searchResults = await youtubeSearch(songQuery)
    if (!searchResults.length) enqueue = null
    else
      enqueue = {
        origin: 'youtube-music',
        url: `https://www.youtube.com/watch?v=${searchResults[0].videoId}`,
        channelId: channelId,
        queuedBy: userId,
        metadata: {
          title: searchResults[0].name,
          artist: Array.isArray(searchResults[0].artist)
            ? searchResults[0].artist[0].name
            : searchResults[0].artist.name,
          album: searchResults[0].album.name,
          artwork_url: searchResults[0].thumbnails[0],
          duration: searchResults[0].duration / 1000,
        },
      }
  }

  return enqueue
}

interface EnqueueTrackResult {}

interface EnqueueTrackResultSuccess extends EnqueueTrackResult {
  status: true
  track: Track
}

interface EnqueueTrackResultFailure extends EnqueueTrackResult {
  status: false
}

interface EnqueueTrackParams {
  guildQueue: MusicQueue
  enqueueable: Enqueueable
  wait?: boolean
  priority?: boolean
}

export const enqueueTrack = async ({
  guildQueue,
  enqueueable,
  wait,
  priority,
}: EnqueueTrackParams): Promise<
  EnqueueTrackResultSuccess | EnqueueTrackResultFailure
> => {
  try {
    const track = await Track.from(enqueueable)

    guildQueue.enqueue(track, { wait, priority })

    return { status: true, track }
  } catch (error) {
    console.warn(error)
    return { status: false }
  }
}

type EnqueueResponse = 'error' | 'none' | 'single' | 'multi'

interface EnqueueItemResult {
  status: EnqueueResponse
}

interface EnqueueItemResultSingle extends EnqueueItemResult {
  status: 'single'
  trackName: string
}

interface EnqueueItemResultMulti extends EnqueueItemResult {
  status: 'multi'
  count: number
}

interface EnqueueItemResultNone extends EnqueueItemResult {
  status: 'none'
}

interface EnqueueItemResultError extends EnqueueItemResult {
  status: 'error'
}

type EnqueueItemResultOptions =
  | EnqueueItemResultSingle
  | EnqueueItemResultMulti
  | EnqueueItemResultNone
  | EnqueueItemResultError

export const enqueueItem = async (
  queue: MusicQueue,
  enqueueables: null | Enqueueable | Enqueueable[],
  priority?: boolean
): Promise<EnqueueItemResultOptions> => {
  if (!enqueueables) {
    return { status: 'none' }
  }

  if (!Array.isArray(enqueueables)) {
    const response = await enqueueTrack({
      guildQueue: queue,
      enqueueable: enqueueables,
      priority,
    })
    return response.status
      ? { status: 'single', trackName: response.track.getTitle() }
      : { status: 'error' }
  }

  let success = false
  let count = 0
  for (const enqueue of enqueueables) {
    const result = await enqueueTrack({
      guildQueue: queue,
      enqueueable: enqueue,
      priority,
    })
    if (result.status) {
      success = true
      count++
    }
  }

  return success ? { status: 'multi', count } : { status: 'error' }
}

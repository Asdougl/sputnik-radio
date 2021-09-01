export type QueueOrigin =
  | 'youtube'
  | 'spotify'
  | 'spotify-playlist'
  | 'youtube-music'

export interface Thumbnail {
  url: string
  height: number
  width: number
}

export interface TrackMetadata {
  title: string
  artist: string
  album: string
  artwork_url: Thumbnail
  duration: number
}

export interface ExtendedTrackMetadata extends TrackMetadata {
  origin: QueueOrigin
  url: string
}

export interface Enqueueable {
  origin: QueueOrigin
  url: string
  channelId: string
  queuedBy: string
  metadata?: TrackMetadata
}

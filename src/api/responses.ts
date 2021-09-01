import { AudioPlayerStatus } from '@discordjs/voice'
import { ExtendedTrackMetadata } from '../types/queue'

interface GuildInfo {
  name: string
  icon_url: string | null
  acronym: string
}

export interface TrackResponse {
  status: AudioPlayerStatus
  current?: ExtendedTrackMetadata
  queue: ExtendedTrackMetadata[]
  guild: GuildInfo
}

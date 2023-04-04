import {
  AudioResource,
  createAudioResource,
  demuxProbe,
} from '@discordjs/voice'
// import {  } from 'youtube-dl-exec'
import { getInfo, downloadFromInfo } from 'ytdl-core'
import { v4 as uuidv4 } from 'uuid'
import {
  Enqueueable,
  ExtendedTrackMetadata,
  QueueOrigin,
  TrackMetadata,
} from '../types/queue'

export interface TrackData {
  url: string
  origin: QueueOrigin
  metadata: TrackMetadata
  channelId: string | undefined
  queuedBy: string | undefined
}

export class Track implements TrackData {
  public readonly url: string
  public readonly origin: QueueOrigin
  public readonly metadata: TrackMetadata
  public readonly channelId: string | undefined
  public readonly queuedBy: string | undefined
  public readonly id: string

  private constructor({
    url,
    metadata,
    origin,
    channelId,
    queuedBy,
  }: TrackData) {
    this.url = url
    this.metadata = metadata
    this.origin = origin
    this.channelId = channelId
    this.queuedBy = queuedBy
    this.id = uuidv4()
  }

  public getTitle() {
    if (this.origin === 'youtube') {
      return this.metadata.title
    } else {
      return `${this.metadata.title} - ${this.metadata.artist}`
    }
  }

  /**
   * Creates an AudioResource from this Track
   * @returns Promise of an Audio Source
   */
  public createAudioResource(): Promise<AudioResource<Track>> {
    return new Promise((resolve, reject) => {
      const onError = (error: Error) => {
        reject(error)
      }

      getInfo(this.url)
        .then((info) => {
          const stream = downloadFromInfo(info, {
            filter: 'audioonly',
            quality: 'highestaudio',
          })

          demuxProbe(stream)
            .then((probe) => {
              resolve(
                createAudioResource(probe.stream, {
                  metadata: this,
                  inputType: probe.type,
                })
              )
            })
            .catch(onError)

          process.on('error', onError)
        })
        .catch(onError)
    })
  }

  public getExtMetadata = (): ExtendedTrackMetadata => ({
    origin: this.origin,
    url: this.url,
    id: this.id,
    ...this.metadata,
  })

  /**
   * Create a Trakc from a video URL and lifecycle callback methods
   * @param url The URL of the video
   * @param methods Lifecycle callbacks
   * @returns The created Track
   */
  public static async from(enqueueable: Enqueueable): Promise<Track> {
    let metadata = enqueueable.metadata
    if (!metadata) {
      const info = await getInfo(enqueueable.url)
      metadata = {
        title: info.videoDetails.title,
        artist: info.videoDetails.author.name,
        album: '',
        artwork_url: info.videoDetails.thumbnails[0],
        duration: parseInt(info.videoDetails.lengthSeconds),
      }
    }

    return new Track({
      metadata,
      url: enqueueable.url,
      origin: enqueueable.origin,
      channelId: enqueueable.channelId,
      queuedBy: enqueueable.queuedBy,
    })
  }
}

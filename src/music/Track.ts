import {
  AudioResource,
  createAudioResource,
  demuxProbe,
} from '@discordjs/voice'
import { raw as ytdl } from 'youtube-dl-exec'
import { getInfo, thumbnail } from 'ytdl-core'
import fs from 'fs'
import { Enqueueable, QueueOrigin, TrackMetadata } from '../types/queue'

export interface TrackData {
  url: string
  origin: QueueOrigin
  metadata: TrackMetadata
  channelId: string
  queuedBy: string
  onStart: () => void
  onFinish: () => void
  onError: (error: Error) => void
}

export class Track implements TrackData {
  public readonly url: string
  public readonly origin: QueueOrigin
  public readonly metadata: TrackMetadata
  public readonly channelId: string
  public readonly queuedBy: string
  public readonly onStart: () => void
  public readonly onFinish: () => void
  public readonly onError: (error: Error) => void

  private constructor({
    url,
    metadata,
    origin,
    channelId,
    queuedBy,
    onStart,
    onFinish,
    onError,
  }: TrackData) {
    this.url = url
    this.metadata = metadata
    this.origin = origin
    this.channelId = channelId
    this.queuedBy = queuedBy
    this.onStart = onStart
    this.onFinish = onFinish
    this.onError = onError
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
      const process = ytdl(
        this.url,
        {
          o: '-',
          q: '',
          f: 'bestaudio[ext=webm+acodec=opus+asr=48000]/bestaudio',
          r: '100K',
        },
        { stdio: ['ignore', 'pipe', 'ignore'] }
      )

      if (!process.stdout) {
        reject(new Error('No stdout'))
        return
      }

      const stream = process.stdout
      const onError = (error: Error) => {
        if (!process.killed) process.kill()
        stream.resume()
        reject(error)
      }

      process
        .once('spawn', () => {
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
        })
        .catch(onError)

      process.on('error', onError)
    })
  }

  /**
   * Create a Trakc from a video URL and lifecycle callback methods
   * @param url The URL of the video
   * @param methods Lifecycle callbacks
   * @returns The created Track
   */
  public static async from(
    enqueueable: Enqueueable,
    methods: Pick<Track, 'onStart' | 'onFinish' | 'onError'>
  ): Promise<Track> {
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

    const wrappedMethods = {
      onStart() {
        wrappedMethods.onStart = () => {}
        methods.onStart()
      },
      onFinish() {
        wrappedMethods.onFinish = () => {}
        methods.onFinish()
      },
      onError(error: Error) {
        wrappedMethods.onError = () => {}
        methods.onError(error)
      },
    }

    return new Track({
      metadata,
      url: enqueueable.url,
      origin: enqueueable.origin,
      channelId: enqueueable.channelId,
      queuedBy: enqueueable.queuedBy,
      ...wrappedMethods,
    })
  }
}

import {
  AudioResource,
  createAudioResource,
  demuxProbe,
} from '@discordjs/voice'
import { raw as ytdl } from 'youtube-dl-exec'
import { getInfo, thumbnail } from 'ytdl-core'

export interface TrackData {
  url: string
  title: string
  thumbnail: thumbnail
  duration: string
  onStart: () => void
  onFinish: () => void
  onError: (error: Error) => void
}

export class Track implements TrackData {
  public readonly url: string
  public readonly title: string
  public readonly thumbnail: thumbnail
  public readonly duration: string
  public readonly onStart: () => void
  public readonly onFinish: () => void
  public readonly onError: (error: Error) => void

  private constructor({
    url,
    title,
    thumbnail,
    duration,
    onStart,
    onFinish,
    onError,
  }: TrackData) {
    this.url = url
    this.title = title
    this.thumbnail = thumbnail
    this.duration = duration
    this.onStart = onStart
    this.onFinish = onFinish
    this.onError = onError
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
    url: string,
    methods: Pick<Track, 'onStart' | 'onFinish' | 'onError'>
  ): Promise<Track> {
    const info = await getInfo(url)

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
      title: info.videoDetails.title,
      thumbnail: info.videoDetails.thumbnails[0],
      duration: info.videoDetails.lengthSeconds,
      url,
      ...wrappedMethods,
    })
  }
}

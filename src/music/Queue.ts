import {
  AudioPlayer,
  AudioPlayerStatus,
  AudioResource,
  createAudioPlayer,
  entersState,
  VoiceConnection,
  VoiceConnectionDisconnectReason,
  VoiceConnectionStatus,
} from '@discordjs/voice'
import { Track } from './Track'
import { promisify } from 'util'
import {
  Message,
  MessageOptions,
  MessagePayload,
  TextBasedChannels,
} from 'discord.js'
import { createNowPlaying, createReply } from '../helpers/replies'
import { shuffle } from '../helpers/arrays'
import EventEmitter from 'events'
import { ExtendedTrackMetadata } from '../types/queue'

const wait = promisify(setTimeout)

type QueueEventMap = {
  next: string
  queue: ExtendedTrackMetadata
  clear: undefined
  pop: ExtendedTrackMetadata
}

interface QueueGuildInfo {
  name: string
  icon: string
  acronym: string
}

interface EnqueueOptions {
  wait?: boolean
  priority?: boolean
}

export class MusicQueue {
  public readonly voiceConnection: VoiceConnection
  public readonly audioPlayer: AudioPlayer
  public readonly guildInfo: QueueGuildInfo
  public readonly getChannel: (
    channelId: string
  ) => Promise<TextBasedChannels | null>
  public lastMessage: Message | null
  public queue: Track[]
  public queueLock = false
  public readyLock = false
  public readonly queueEmitter: EventEmitter

  private lastChannelId: string

  public constructor(
    voiceConnection: VoiceConnection,
    guildInfo: QueueGuildInfo,
    getChannel: (channelId: string) => Promise<TextBasedChannels | null>
  ) {
    this.voiceConnection = voiceConnection
    this.audioPlayer = createAudioPlayer()
    this.queue = []
    this.guildInfo = guildInfo
    this.lastMessage = null
    this.getChannel = getChannel
    this.lastChannelId = ''

    this.queueEmitter = new EventEmitter()

    this.voiceConnection.on('stateChange', async (oldState, newState) => {
      if (newState.status === VoiceConnectionStatus.Disconnected) {
        if (
          newState.reason === VoiceConnectionDisconnectReason.WebSocketClose &&
          newState.closeCode === 4014
        ) {
          /*
						If the WebSocket closed with a 4014 code, this means that we should not manually attempt to reconnect,
						but there is a chance the connection will recover itself if the reason of the disconnect was due to
						switching voice channels. This is also the same code for the bot being kicked from the voice channel,
						so we allow 5 seconds to figure out which scenario it is. If the bot has been kicked, we should destroy
						the voice connection.
					*/
          try {
            await entersState(
              this.voiceConnection,
              VoiceConnectionStatus.Connecting,
              5_000
            )
            // Probably moved voice channel
          } catch {
            this.voiceConnection.destroy()
            // Probably removed from voice channel
          }
        } else if (this.voiceConnection.rejoinAttempts < 5) {
          /*
						The disconnect in this case is recoverable, and we also have <5 repeated attempts so we will reconnect.
					*/
          await wait((this.voiceConnection.rejoinAttempts + 1) * 5_000)
          this.voiceConnection.rejoin()
        } else {
          /*
						The disconnect in this case may be recoverable, but we have no more remaining attempts - destroy.
					*/
          this.voiceConnection.destroy()
        }
      } else if (newState.status === VoiceConnectionStatus.Destroyed) {
        /*
					Once destroyed, stop the subscription
				*/
        this.stop()
      } else if (
        !this.readyLock &&
        (newState.status === VoiceConnectionStatus.Connecting ||
          newState.status === VoiceConnectionStatus.Signalling)
      ) {
        /*
					In the Signalling or Connecting states, we set a 20 second time limit for the connection to become ready
					before destroying the voice connection. This stops the voice connection permanently existing in one of these
					states.
				*/
        this.readyLock = true
        try {
          await entersState(
            this.voiceConnection,
            VoiceConnectionStatus.Ready,
            20_000
          )
        } catch {
          if (
            this.voiceConnection.state.status !==
            VoiceConnectionStatus.Destroyed
          )
            this.voiceConnection.destroy()
        } finally {
          this.readyLock = false
        }
      }
    })

    // Configure audio player
    this.audioPlayer.on('stateChange', (oldState, newState) => {
      if (
        newState.status === AudioPlayerStatus.Idle &&
        oldState.status !== AudioPlayerStatus.Idle
      ) {
        // If the Idle state is entered from a non-Idle state, it means that an audio resource has finished playing.
        // The queue is then processed to start playing the next track, if one is available.
        if (this.lastMessage) {
          this.lastMessage.delete().catch((err) => console.warn(err))
        } else {
          console.log('NO LAST MESSAGE?!')
        }
        void this.processQueue()
      } else if (newState.status === AudioPlayerStatus.Playing) {
        // If the Playing state has been entered, then a new track has started playback.
        const newTrack = (newState.resource as AudioResource<Track>).metadata
        this.emit('next', newTrack.id)
        this.sendMessage(
          createNowPlaying(newTrack.metadata, newTrack.queuedBy),
          newTrack
        )
      }
    })

    this.audioPlayer.on('error', (error) => {
      const metadata = (error.resource as AudioResource<Track>).metadata
      this.sendMessage(
        createReply(`Error Playing ${metadata.getTitle()}`, { status: 'warn' })
      )
    })

    voiceConnection.subscribe(this.audioPlayer)
  }

  public enqueue(track: Track, { wait, priority }: EnqueueOptions) {
    this.queue = [...this.queue, track]
    this.emit('queue', track.getExtMetadata())
    if (priority === true) {
      this.audioPlayer.stop()
      void this.processQueue()
    } else if (wait !== true) void this.processQueue()
  }

  public popQueue() {
    const poppedTrack = this.queue.pop()
    if (poppedTrack) {
      const metadata = poppedTrack.getExtMetadata()
      this.emit('pop', metadata)
      return metadata
    }
  }

  public stop() {
    this.queue = []
    this.audioPlayer.stop(true)
    this.emit('clear', undefined)
  }

  public start() {
    if (
      this.audioPlayer.state.status === AudioPlayerStatus.Idle &&
      this.queue.length &&
      this.queueLock === false
    )
      this.processQueue()
  }

  public shuffle() {
    if (this.queue.length) {
      this.queue = shuffle(this.queue)
    }
  }

  public purgeFrom(userId: string) {
    this.queue = this.queue.filter((track) => track.queuedBy !== userId)
  }

  public on<T extends keyof QueueEventMap>(
    event: T,
    fn: (param: QueueEventMap[T]) => void
  ) {
    this.queueEmitter.on(event, fn)
  }

  public off<T extends keyof QueueEventMap>(
    event: T,
    fn: (param: QueueEventMap[T]) => void
  ) {
    this.queueEmitter.off(event, fn)
  }

  private emit<T extends keyof QueueEventMap>(
    event: T,
    param: QueueEventMap[T]
  ) {
    this.queueEmitter.emit(event, param)
  }

  private async processQueue(): Promise<void> {
    if (
      this.queueLock ||
      this.audioPlayer.state.status !== AudioPlayerStatus.Idle ||
      this.queue.length === 0
    ) {
      return
    }

    this.queueLock = true

    const nextTrack = this.queue.shift()!

    try {
      const resource = await nextTrack.createAudioResource()
      this.audioPlayer.play(resource)
      this.queueLock = false
    } catch (error) {
      console.warn(error)
      this.sendMessage(
        createReply(`Error Playing ${nextTrack.getTitle()}`, { status: 'warn' })
      )
      this.queueLock = false
      return this.processQueue()
    }
  }

  private async sendMessage(
    messageContents: string | MessagePayload | MessageOptions,
    track?: Track
  ) {
    this.getChannel(
      track && track.channelId ? track.channelId : this.lastChannelId
    )
      .then((channel) => {
        if (channel) {
          channel
            .send(messageContents)
            .then((message) => {
              this.lastMessage = message
            })
            .catch((err) => console.warn(err))
        }
      })
      .catch((err) => console.warn(err))
  }
}

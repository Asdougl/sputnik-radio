import { CommandInteraction } from 'discord.js'
import { MusicQueue } from './Queue'
import { Track } from './Track'

interface EnqueueTrackResult {}

interface EnqueueTrackResultSuccess extends EnqueueTrackResult {
  status: true
  track: Track
}

interface EnqueueTrackResultFailure extends EnqueueTrackResult {
  status: false
}

export const enqueueTrack = async (
  guildQueue: MusicQueue,
  interaction: CommandInteraction,
  url: string
): Promise<EnqueueTrackResultSuccess | EnqueueTrackResultFailure> => {
  try {
    const track = await Track.from(url, {
      onStart() {
        interaction
          .followUp({ content: 'Now playing!', ephemeral: true })
          .catch(console.warn)
      },
      onFinish() {
        interaction
          .followUp({ content: 'Now finished!', ephemeral: true })
          .catch(console.warn)
      },
      onError(error) {
        console.warn(error)
        interaction
          .followUp({
            content: `Error: ${error.message}`,
            ephemeral: true,
          })
          .catch(console.warn)
      },
    })

    guildQueue.enqueue(track)

    return { status: true, track }
  } catch (error) {
    console.warn(error)
    return { status: false }
  }
}

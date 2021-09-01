import express from 'express'
import cors from 'cors'
import { musicQueues } from '../state'
import { AudioPlayerStatus, AudioResource } from '@discordjs/voice'
import { Track } from '../music/Track'
import { TrackResponse } from './responses'
import { ExtendedTrackMetadata } from '../types/queue'

export const app = express()
app.use(cors())

app.get('/', (req, res) => {
  res.send('Hello World')
})

app.get('/:guildId', (req, res) => {
  try {
    const guildId = req.params.guildId

    const guildQueue = musicQueues.get(guildId)

    if (!guildQueue) throw new Error('Invalid Queue ID')

    const responseJson: TrackResponse = {
      status: guildQueue.audioPlayer.state.status,
      queue: guildQueue.queue.map(({ url, origin, metadata }) => ({
        url,
        origin,
        ...metadata,
      })),
      guild: {
        name: guildQueue.guildInfo.name,
        icon_url: guildQueue.guildInfo.icon
          ? `https://cdn.discordapp.com/icons/${guildId}/${guildQueue.guildInfo.icon}.png?size=128`
          : null,
        acronym: guildQueue.guildInfo.acronym,
      },
    }

    if (guildQueue.audioPlayer.state.status !== AudioPlayerStatus.Idle) {
      const current = guildQueue.audioPlayer.state
        .resource as AudioResource<Track>
      responseJson.current = {
        url: current.metadata.url,
        origin: current.metadata.origin,
        ...current.metadata.metadata,
      }
    }

    res.json(responseJson)
  } catch (error) {
    res.status(400).send({ error: error.message })
  }
})

const PORT = process.env.PORT || 5000
app.listen(PORT, () => console.log(`[API] API is listening on port ${PORT}...`))

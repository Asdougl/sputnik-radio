import express from 'express'
import cors from 'cors'
import { musicQueues } from '../state'
import { AudioPlayerStatus, AudioResource } from '@discordjs/voice'
import { Track } from '../music/Track'

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

    if (guildQueue.audioPlayer.state.status === AudioPlayerStatus.Idle) {
      res.json({ status: 'idle' })
    } else {
      const currentTrack = (
        guildQueue.audioPlayer.state.resource as AudioResource<Track>
      ).metadata

      res.json({
        status: 'playing',
        current: {
          url: currentTrack.url,
          title: currentTrack.title,
          thumbnail: currentTrack.thumbnail,
          duration: currentTrack.duration,
        },
        queue: guildQueue.queue.map(({ url, title, thumbnail, duration }) => ({
          url,
          title,
          thumbnail,
          duration,
        })),
        guild: {
          name: guildQueue.guildInfo.name,
          icon_url: guildQueue.guildInfo.icon
            ? `https://cdn.discordapp.com/icons/${guildId}/${guildQueue.guildInfo.icon}.png?size=128`
            : null,
          acronym: guildQueue.guildInfo.acronym,
        },
      })
    }
  } catch (error) {
    res.status(400).send({ error: error.message })
  }
})

const PORT = process.env.PORT || 5000
app.listen(PORT, () => console.log(`[API] API is listening on port ${PORT}...`))

import { Client, GuildMember, Intents } from 'discord.js'
import {
  AudioPlayerStatus,
  AudioResource,
  entersState,
  joinVoiceChannel,
  VoiceConnectionStatus,
} from '@discordjs/voice'
import dotenv from 'dotenv'
import { MusicQueue } from './music/Queue'
import { Track } from './music/Track'
import { COMMANDS, SPECIAL_ARGS } from './constants/commands'
import { createReply } from './helpers/replies'
import './api'
import { createQueue, musicQueues } from './state'
import { secondsToDuration } from './helpers/time'
import { formatToWidth } from './helpers/formatting'
import { cannotDJ, cannotDJReason } from './helpers/roles'
import { determineQueue, enqueueItem } from './queue'

dotenv.config()

// Map of Guild IDs matched to a music queue

/*
  DISCORD BOT API
===================================================== */

// Initialise Client
const client = new Client({
  intents: [
    Intents.FLAGS.GUILDS,
    Intents.FLAGS.GUILD_MESSAGES,
    Intents.FLAGS.GUILD_VOICE_STATES,
  ],
})

const djrole = process.env.DJ_ROLE,
  djbanrole = process.env.DJ_BAN_ROLE

client.on('ready', () =>
  console.log(`Logged in as ${client.user ? client.user.tag : 'unknown'}`)
)

// Add commands to the guild
client.on('messageCreate', async (message) => {
  if (!message.guild) return
  if (!client.application?.owner) await client.application?.fetch()

  if (
    message.content.toLowerCase() === '!launch-sputnik' &&
    message?.member?.permissions.has('ADMINISTRATOR')
  ) {
    console.log('Deploying Commands')

    try {
      await message.guild.commands.set([
        {
          name: COMMANDS.PLAY,
          description: 'Plays a song',
          options: [
            {
              name: 'song',
              type: 'STRING' as const,
              description: 'The URL of the song to play',
              required: true,
            },
          ],
        },
        {
          name: COMMANDS.SKIP,
          description: 'Skip to the next song in the queue',
        },
        {
          name: COMMANDS.QUEUE,
          description: 'See the music queue',
        },
        {
          name: COMMANDS.CLEAR,
          description: 'Clear the music queue',
        },
        {
          name: COMMANDS.LEAVE,
          description: 'Leave the voice channel',
        },
        {
          name: COMMANDS.GUI,
          description: 'Shows a link to the queue manager',
        },
        {
          name: COMMANDS.SEARCH,
          description: 'Search for a song by name',
        },
        {
          name: COMMANDS.API,
          description: 'Returns the API url for your queue',
        },
        {
          name: COMMANDS.SHUFFLE,
          description: 'Shuffle the current queue',
        },
        {
          name: COMMANDS.UNDO,
          description: 'Undo your last addition to the queue',
        },
        {
          name: COMMANDS.SPECIAL,
          description: 'Special Actions',
          options: [
            {
              name: 'arg',
              type: 'STRING' as const,
              description: 'The special argument',
              required: true,
            },
          ],
        },
      ])

      await message.reply('Commands Deployed!')
    } catch (error) {
      console.warn(error)
      await message.reply('Error Deploying Commands! Please try again later')
    }
  }
})

// Handle Command
client.on('interactionCreate', async (interaction) => {
  // Catch invalid states
  if (!interaction.isCommand() || !interaction.guildId) return
  const badDJStatus = cannotDJ(djrole, djbanrole, interaction)
  if (badDJStatus) {
    await interaction.reply(
      `Sorry, ${cannotDJReason(badDJStatus, djrole, djbanrole)}`
    )
    return
  }

  // Get Queue
  let guildQueue = musicQueues.get(interaction.guildId)

  switch (interaction.commandName) {
    /**
     * Command to play a track given a youtube url, spotify url or search term
     */
    case COMMANDS.PLAY: {
      // Play a track
      await interaction.deferReply()

      const songQuery = interaction.options.get('song')!.value! as string

      if (!guildQueue) {
        guildQueue = createQueue(interaction, client)
      }

      if (!guildQueue) {
        await interaction.followUp(
          createReply('Join a voice channel and then try that again', {
            status: 'warn',
          })
        )
        return
      }

      try {
        await entersState(
          guildQueue.voiceConnection,
          VoiceConnectionStatus.Ready,
          20e3
        )
      } catch (error) {
        console.warn(error)
        await interaction.followUp(
          createReply(
            'Failed to join voice channel within 20 seconds, please try again later!',
            { status: 'warn' }
          )
        )
        return
      }

      const enqueue = await determineQueue(
        songQuery,
        interaction.channelId,
        interaction.user.id
      )

      const enqueueResult = await enqueueItem(guildQueue, enqueue)

      switch (enqueueResult.status) {
        case 'single': {
          await interaction.followUp(
            createReply(
              `Enqueued **${enqueueResult.trackName}** [<@${interaction.member?.user.id}>]`
            )
          )
          break
        }
        case 'multi': {
          guildQueue.start()
          await interaction.followUp(
            createReply(
              `Enqueued **${enqueueResult.count} Tracks** from playlist`
            )
          )
          break
        }
        case 'error': {
          await interaction.followUp(
            createReply('Failed to enqueue playlist, please try again later!', {
              status: 'warn',
            })
          )
        }
        default: {
          await interaction.followUp(
            createReply(
              "We're not sure what to do with your song request... Sorry!",
              { status: 'warn' }
            )
          )
        }
      }

      break
    }
    /**
     * Command to skip the current track (and a blame)
     */
    case COMMANDS.SKIP: {
      // Skip next song
      if (
        guildQueue &&
        guildQueue.audioPlayer.state.status !== AudioPlayerStatus.Idle
      ) {
        const currentTrackName = (
          guildQueue.audioPlayer.state.resource as AudioResource<Track>
        ).metadata.getTitle()
        guildQueue.audioPlayer.stop()
        await interaction.reply(
          createReply(
            `<@${interaction.member?.user.id}> skipped **${currentTrackName}**`
          )
        )
      } else {
        await interaction.reply('Not playing in this server!')
      }

      break
    }
    /**
     * Command to undo the last addition to the queue
     */
    case COMMANDS.UNDO: {
      if (guildQueue && guildQueue.queue.length) {
        const lastTrack = guildQueue.queue[guildQueue.queue.length - 1]
        if (lastTrack.queuedBy === interaction.user.id) {
          const poppedTrack = guildQueue.popQueue()
          if (poppedTrack) {
            await interaction.reply(
              createReply(
                `<@${interaction.member?.user.id}> undid **${poppedTrack.title}**`
              )
            )
          } else {
            await interaction.reply(
              createReply(
                `<@${interaction.member?.user.id}> could not undo **${
                  lastTrack.getExtMetadata().title
                }**`,
                { status: 'warn' }
              )
            )
          }
        } else {
          await interaction.reply(
            createReply(
              `<@${interaction.member?.user.id}> you can't undo someone else's track`,
              { status: 'warn' }
            )
          )
        }
      } else {
        await interaction.reply('Not playing in this server!')
      }

      break
    }
    /**
     * Command to display the current queue
     */
    case COMMANDS.QUEUE: {
      // Show current queue
      if (guildQueue) {
        if (guildQueue.audioPlayer.state.status === AudioPlayerStatus.Idle) {
          await interaction.reply(
            createReply('Noting is currently in the queue')
          )
        } else {
          const current = (
            guildQueue.audioPlayer.state.resource as AudioResource<Track>
          ).metadata

          const trackNameWidth = 40

          const nowPlaying = `**Now Playing:** \n\`\`\`nim\n-> ${formatToWidth(
            current.getTitle(),
            trackNameWidth
          )} (${secondsToDuration(current.metadata.duration)})\n\`\`\``
          const queue = guildQueue.queue
            .slice(0, 10)
            .map(
              (track, index) =>
                `${index + 1}) ${formatToWidth(
                  track.getTitle(),
                  trackNameWidth
                )} (${secondsToDuration(track.metadata.duration)})`
            )
            .join('\n')
          const remainingCount = guildQueue.queue.length - queue.length
          const remaining =
            remainingCount > 0 ? `\nand **${remainingCount}** more` : ''

          const queueStr =
            '```nim\n' + (queue.length ? queue : '*end of queue*') + '```'

          await interaction.reply(
            createReply(`${nowPlaying}\n**Queue:**\n${queueStr}${remaining}`)
          )
        }
      } else {
        await interaction.reply(
          createReply('Not playing in this server!', { status: 'warn' })
        )
      }

      break
    }
    /**
     * Command to clear out the current queue
     */
    case COMMANDS.CLEAR: {
      // Clear current queue
      if (guildQueue) {
        guildQueue.stop()
        await interaction.reply(createReply('Current queue cleared'))
      } else {
        await interaction.reply(
          createReply('Not playing in this server!', { status: 'warn' })
        )
      }
      break
    }
    /**
     * Command to provide link to GUI at sputnikradio.su/{token}
     */
    case COMMANDS.GUI: {
      // display a link to this queue's GUI
      await interaction.reply(
        createReply('```\nFunctionality coming soon!\n```')
      )
      break
    }
    /**
     * Command to leave the current voice channel and clear the queue
     */
    case COMMANDS.LEAVE: {
      // Leave the channel
      if (guildQueue) {
        guildQueue.voiceConnection.destroy()
        musicQueues.delete(interaction.guildId)
        await interaction.reply({ content: 'Left channel!', ephemeral: true })
      } else {
        await interaction.reply('Not playing in this server!')
      }
      break
    }
    /**
     * Command to Search for tracks and pick a result
     */
    case COMMANDS.SEARCH: {
      await interaction.reply(
        createReply('```\nFunctionality coming soon!\n```')
      )
      break
    }
    /**
     * Fetch the Guild ID -- temporary/debug
     */
    case COMMANDS.API: {
      await interaction.reply(`http://localhost:5000/${interaction.guildId}`)
      break
    }
    /**
     * Shuffle the current queue
     */
    case COMMANDS.SHUFFLE: {
      if (guildQueue) {
        guildQueue.shuffle()
        await interaction.reply(
          createReply(`[<@${interaction.user.id}>] just shuffled the queue`)
        )
      } else {
        await interaction.reply('Not playing in this server!')
      }
      break
    }
    /**
     * Execute a special command
     */
    case COMMANDS.SPECIAL: {
      if (!guildQueue) {
        guildQueue = createQueue(interaction, client)
      }

      if (!guildQueue) {
        await interaction.followUp(
          createReply('Join a voice channel and then try that again', {
            status: 'warn',
          })
        )
        return
      }

      try {
        await entersState(
          guildQueue.voiceConnection,
          VoiceConnectionStatus.Ready,
          20e3
        )
      } catch (error) {
        console.warn(error)
        await interaction.followUp(
          createReply(
            'Failed to join voice channel within 20 seconds, please try again later!',
            { status: 'warn' }
          )
        )
        return
      }
      if (guildQueue) {
        const arg = interaction.options.get('arg')!.value! as string

        if (SPECIAL_ARGS.SKIPWILL === arg) {
          guildQueue.purgeFrom('437138777585221632')

          await interaction.reply(createReply(`👍 All Good`))
        } else if (SPECIAL_ARGS.EDSHERE === arg) {
          const enqueue = await determineQueue(
            'https://www.youtube.com/watch?v=73vP02w3mwo',
            interaction.channelId,
            interaction.user.id
          )
          const enqueueResult = await enqueueItem(guildQueue, enqueue, true)

          switch (enqueueResult.status) {
            case 'single': {
              await interaction.reply(
                createReply(
                  `Enqueued **${enqueueResult.trackName}** [<@${interaction.member?.user.id}>]`
                )
              )
              break
            }
            case 'multi': {
              guildQueue.start()
              await interaction.reply(
                createReply(
                  `Enqueued **${enqueueResult.count} Tracks** from playlist`
                )
              )
              break
            }
            case 'error': {
              await interaction.reply(
                createReply(
                  'Failed to enqueue playlist, please try again later!',
                  {
                    status: 'warn',
                  }
                )
              )
            }
            default: {
              await interaction.reply(
                createReply(
                  "We're not sure what to do with your song request... Sorry!",
                  { status: 'warn' }
                )
              )
            }
          }
        } else {
          await interaction.reply(
            createReply("I don't know that command, sorry", {
              status: 'warn',
            })
          )
        }
      } else {
        await interaction.reply('Not playing in this server!')
      }
      break
    }
    /**
     * Somehow the user has used an unknown command -- handle it
     */
    default: {
      await interaction.reply('Unknown Command')
    }
  }
})

client.on('error', console.warn)

client.login(process.env.DISCORD_TOKEN)

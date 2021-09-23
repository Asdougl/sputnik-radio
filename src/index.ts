import { Client, Intents } from 'discord.js'
import {
  AudioPlayerStatus,
  AudioResource,
  entersState,
  VoiceConnectionStatus,
} from '@discordjs/voice'
import dotenv from 'dotenv'
import { Track } from './music/Track'
import { command, COMMANDS, SPECIAL_ARGS } from './constants/commands'
import { createReply } from './helpers/replies'
import './api'
import { musicQueues } from './queues/state'
import { secondsToDuration } from './helpers/time'
import { formatToWidth } from './helpers/formatting'
import { determineQueue, enqueueItem } from './queue'
import { DiscordBot, DiscordBotError } from './bot'

dotenv.config()

console.log('Initialising Sputnik Radio...')

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

client.on('ready', () =>
  console.log(
    `Sputnik Radio is Online as [${client.user ? client.user.tag : 'unknown'}]`
  )
)

const launchCommand = process.env.PREFIX
  ? `!launch-sputnik-${process.env.PREFIX}`
  : '!launch-sputnik'

// Add commands to the guild
client.on('messageCreate', async (message) => {
  if (!message.guild) return
  if (!client.application?.owner) await client.application?.fetch()

  if (
    message.content.toLowerCase() === launchCommand &&
    message?.member?.permissions.has('ADMINISTRATOR')
  ) {
    console.log('Deploying Commands')

    try {
      await message.guild.commands.set([
        {
          name: command(COMMANDS.PLAY),
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
          name: command(COMMANDS.SKIP),
          description: 'Skip to the next song in the queue',
        },
        {
          name: command(COMMANDS.QUEUE),
          description: 'See the music queue',
        },
        {
          name: command(COMMANDS.CLEAR),
          description: 'Clear the music queue',
        },
        {
          name: command(COMMANDS.LEAVE),
          description: 'Leave the voice channel',
        },
        {
          name: command(COMMANDS.GUI),
          description: 'Shows a link to the queue manager',
        },
        {
          name: command(COMMANDS.SEARCH),
          description: 'Search for a song by name',
        },
        {
          name: command(COMMANDS.API),
          description: 'Returns the API url for your queue',
        },
        {
          name: command(COMMANDS.SHUFFLE),
          description: 'Shuffle the current queue',
        },
        {
          name: command(COMMANDS.UNDO),
          description: 'Undo your last addition to the queue',
        },
        {
          name: command(COMMANDS.SPECIAL),
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

const bot = new DiscordBot(client)

/**
 * Command to play a track given a youtube url, spotify url or search term
 */
bot.on(COMMANDS.PLAY, async ({ interaction, getGuildQueue }) => {
  try {
    const guildQueue = getGuildQueue(true)

    await interaction.deferReply()

    const songQuery = interaction.options.get('song')!.value! as string

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
  } catch (error) {
    await interaction.reply('We had an error on our side, apologies comrade')
  }
})

/**
 * Command to skip the current track (and a blame)
 */
bot.on(COMMANDS.SKIP, async ({ interaction, getGuildQueue }) => {
  try {
    const guildQueue = getGuildQueue()
    // Skip next song
    if (guildQueue.audioPlayer.state.status !== AudioPlayerStatus.Idle) {
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
  } catch (error) {
    await interaction.reply('We had an error on our side, apologies comrade')
  }
})

/**
 * Command to undo the last addition to the queue
 */
bot.on(COMMANDS.UNDO, async ({ interaction, getGuildQueue }) => {
  try {
    const guildQueue = getGuildQueue()

    if (guildQueue.queue.length) {
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
  } catch (error) {
    await interaction.reply('We had an error on our side, apologies comrade')
  }
})

/**
 * Command to display the current queue
 */
bot.on(COMMANDS.QUEUE, async ({ interaction, getGuildQueue }) => {
  try {
    const guildQueue = getGuildQueue()

    if (guildQueue.audioPlayer.state.status === AudioPlayerStatus.Idle) {
      await interaction.reply(createReply('Noting is currently in the queue'))
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
  } catch (error) {
    if (error instanceof DiscordBotError) {
      await interaction.reply(createReply(error.message, { status: 'warn' }))
    } else {
      await interaction.reply('We had an error on our side, apologies comrade')
    }
  }
})

/**
 * Command to clear out the current queue
 */
bot.on(COMMANDS.CLEAR, async ({ interaction, getGuildQueue }) => {
  try {
    // Clear current queue

    const guildQueue = getGuildQueue()

    guildQueue.stop()
    await interaction.reply(createReply('Current queue cleared'))
  } catch (error) {
    if (error instanceof DiscordBotError) {
      await interaction.reply(createReply(error.message, { status: 'warn' }))
    } else {
      await interaction.reply('We had an error on our side, apologies comrade')
    }
  }
})

/**
 * Command to provide link to GUI at sputnikradio.su/{token}
 */
bot.on(COMMANDS.GUI, async ({ interaction }) => {
  try {
    // display a link to this queue's GUI
    await interaction.reply(createReply('```\nFunctionality coming soon!\n```'))
  } catch (error) {
    await interaction.reply('We had an error on our side, apologies comrade')
  }
})

/**
 * Command to leave the current voice channel and clear the queue
 */
bot.on(COMMANDS.LEAVE, async ({ interaction, getGuildQueue, guildId }) => {
  try {
    // Leave the channel
    const guildQueue = getGuildQueue()

    guildQueue.voiceConnection.destroy()
    musicQueues.delete(guildId)
    await interaction.reply({ content: 'Left channel!', ephemeral: true })
  } catch (error) {
    if (error instanceof DiscordBotError) {
      await interaction.reply(createReply(error.message, { status: 'warn' }))
    } else {
      await interaction.reply('We had an error on our side, apologies comrade')
    }
  }
})

/**
 * Command to Search for tracks and pick a result
 */
bot.on(COMMANDS.SEARCH, async ({ interaction }) => {
  try {
    await interaction.reply(createReply('```\nFunctionality coming soon!\n```'))
  } catch (error) {
    if (error instanceof DiscordBotError) {
      await interaction.reply(createReply(error.message, { status: 'warn' }))
    } else {
      await interaction.reply('We had an error on our side, apologies comrade')
    }
  }
})

/**
 * Fetch the Guild ID -- temporary/debug
 */
bot.on(COMMANDS.API, async ({ interaction }) => {
  try {
    await interaction.reply(`http://localhost:5000/${interaction.guildId}`)
  } catch (error) {
    if (error instanceof DiscordBotError) {
      await interaction.reply(createReply(error.message, { status: 'warn' }))
    } else {
      await interaction.reply('We had an error on our side, apologies comrade')
    }
  }
})

/**
 * Shuffle the current queue
 */
bot.on(COMMANDS.SHUFFLE, async ({ interaction, getGuildQueue }) => {
  try {
    const guildQueue = getGuildQueue()

    guildQueue.shuffle()
    await interaction.reply(
      createReply(`[<@${interaction.user.id}>] just shuffled the queue`)
    )
  } catch (error) {
    if (error instanceof DiscordBotError) {
      await interaction.reply(createReply(error.message, { status: 'warn' }))
    } else {
      await interaction.reply('We had an error on our side, apologies comrade')
    }
  }
})

/**
 * Execute a special command
 */
bot.on(COMMANDS.SPECIAL, async ({ interaction, getGuildQueue }) => {
  try {
    const guildQueue = getGuildQueue(true)

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
  } catch (error) {
    if (error instanceof DiscordBotError) {
      await interaction.reply(createReply(error.message, { status: 'warn' }))
    } else {
      await interaction.reply('We had an error on our side, apologies comrade')
    }
  }
})

client.on('error', console.warn)

client.login(process.env.DISCORD_TOKEN)

import { Client, GuildMember, Intents, Message, Snowflake } from 'discord.js'
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
import { COMMANDS } from './constants/commands'
import { createReply } from './helpers/replies'
import { youtubeSearch } from './youtube/search'
import { enqueueTrack } from './music/helpers'
import { spotifyToYoutube } from './spotify/search'
import './api'

dotenv.config()

// Map of Guild IDs matched to a music queue
import { musicQueues } from './state'
import { secondsToDuration } from './helpers/time'
import { spotifyPlaylistToYoutube } from './spotify/playlist'

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
  console.log(`Logged in as ${client.user ? client.user.tag : 'unknown'}`)
)

// Add commands to the guild
client.on('messageCreate', async (message) => {
  if (!message.guild) return
  if (!client.application?.owner) await client.application?.fetch()

  if (
    message.content.toLowerCase() === '!launch-sputnik' &&
    message.author.id === client.application?.owner?.id
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
        if (
          interaction.member instanceof GuildMember &&
          interaction.member.voice.channel
        ) {
          const channel = interaction.member.voice.channel
          guildQueue = new MusicQueue(
            joinVoiceChannel({
              channelId: channel.id,
              guildId: channel.guild.id,
              adapterCreator: channel.guild.voiceAdapterCreator,
            }),
            {
              name: interaction.guild?.name || '',
              icon: interaction.guild?.icon || '',
              acronym: interaction.guild?.nameAcronym || '',
            }
          )
          guildQueue.voiceConnection.on('error', console.warn)
          musicQueues.set(interaction.guildId, guildQueue)
        }
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

      let url: string | string[] = ''
      // Lets find out what kind of link we got...
      if (
        /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\/(watch\?v=)?.*$/.test(
          songQuery
        )
      ) {
        // Is a youtube link!
        url = songQuery
      } else if (/https?:\/\/open\.spotify\.com\/track\/.*$/.test(songQuery)) {
        // Is a spotify share link!
        console.log('Found a spotify')
        url = await spotifyToYoutube(songQuery)
      } else if (
        /https?:\/\/open\.spotify\.com\/playlist\/.*$/.test(songQuery)
      ) {
        // Is a spotify playlist link
        url = await spotifyPlaylistToYoutube(songQuery)
      } else {
        // We're going to need to google it!
        const searchResults = await youtubeSearch(songQuery)
        if (!searchResults.length) url = ''
        else
          url = `https://www.youtube.com/watch?v=${searchResults[0].id.videoId}`
      }

      if (!url) {
        await interaction.followUp(
          createReply(
            "We're not sure what to do with your song request... Sorry!",
            { status: 'warn' }
          )
        )
        return
      }

      if (typeof url === 'string') {
        const response = await enqueueTrack(guildQueue, interaction, url)

        if (response.status) {
          await interaction.followUp(
            createReply(
              `Enqueued **${response.track.title}** [<@${interaction.member?.user.id}>]`
            )
          )
        } else {
          await interaction.reply(
            createReply('Failed to play track, please try again later!', {
              status: 'warn',
            })
          )
        }
      } else {
        let success = false
        let count = 0
        for (const trackUrl of url) {
          const result = await enqueueTrack(guildQueue, interaction, trackUrl)
          if (result.status) {
            success = true
            count++
          }
        }

        if (success) {
          await interaction.followUp(
            createReply(`Enqueued **${count} Tracks** from playlist`)
          )
        } else {
          await interaction.followUp(
            createReply('Failed to enqueue playlist, please try again later!', {
              status: 'warn',
            })
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
        ).metadata.title
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

          const nowPlaying = `**Now Playing:** \n\`\`\`nim\n${
            current.title
          } (${secondsToDuration(current.duration)})\n\`\`\``
          const queue = guildQueue.queue
            .slice(0, 5)
            .map(
              (track, index) =>
                `${index + 1}) ${track.title} (${secondsToDuration(
                  track.duration
                )})`
            )
            .join('\n')

          const queueStr = '```nim\n' + queue + '```'

          await interaction.reply(
            createReply(`${nowPlaying}\n**Queue:**\n${queueStr}`)
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
     * Somehow the user has used an unknown command -- handle it
     */
    default: {
      await interaction.reply('Unknown Command')
    }
  }
})

client.on('error', console.warn)

client.login(process.env.TOKEN)

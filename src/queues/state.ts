import { joinVoiceChannel } from '@discordjs/voice'
import { Snowflake } from 'discord-api-types'
import { Client, CommandInteraction, GuildMember } from 'discord.js'
import { DiscordBotError } from '../bot'
import { MusicQueue } from '../music/Queue'

export const musicQueues = new Map<Snowflake, MusicQueue>()

export const getQueue = (
  interaction: CommandInteraction,
  client: Client<boolean>
): MusicQueue => {
  const guildId = interaction.guildId
  if (!guildId)
    throw new DiscordBotError('No Guild', 'You must be in a Server to use')

  let queue = musicQueues.get(guildId)
  if (queue) return queue

  queue = createQueue(interaction, client)
  if (!queue)
    throw new DiscordBotError('Create Error', 'Not playing in this server!')
  return queue
}

export const createQueue = (
  interaction: CommandInteraction,
  client: Client<boolean>
) => {
  if (
    interaction.member instanceof GuildMember &&
    interaction.member.voice.channel &&
    interaction.guildId
  ) {
    const channel = interaction.member.voice.channel
    const guildId = interaction.guildId
    let guildQueue = new MusicQueue(
      joinVoiceChannel({
        channelId: channel.id,
        guildId: channel.guild.id,
        adapterCreator: channel.guild.voiceAdapterCreator,
      }),
      {
        name: interaction.guild?.name || '',
        icon: interaction.guild?.icon || '',
        acronym: interaction.guild?.nameAcronym || '',
      },
      async (channelId) => {
        const channel = await client.channels.fetch(channelId)
        if (channel && channel.isText()) {
          return channel
        }
        return null
      },
      () => musicQueues.delete(guildId)
    )
    guildQueue.voiceConnection.on('error', console.warn)
    musicQueues.set(interaction.guildId, guildQueue)
    return guildQueue
  }
}

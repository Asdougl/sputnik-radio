import { InteractionReplyOptions, MessageEmbed } from 'discord.js'
import { COLORS } from '../constants/colours'
import { TrackMetadata } from '../types/queue'

export const createEmbedReply = (baseText: string) => {
  return new MessageEmbed().setColor('#cd0001').setDescription(baseText)
}

type ReplyType = 'log' | 'warn' | 'error'

export interface ReplyOptions {
  footer?: string
  status?: ReplyType
  image_url?: string
}

export const createReply = (
  baseText: string,
  options?: ReplyOptions
): InteractionReplyOptions => {
  const embed = new MessageEmbed().setDescription(baseText)

  if (options?.footer) {
    embed.setFooter(options.footer)
  }

  if (options?.image_url) {
    embed.setThumbnail(options.image_url)
  }

  if (options?.status && options.status !== 'log') {
    if (options.status === 'warn') {
      embed.setColor(COLORS.WARNING)
    } else {
      embed.setColor(COLORS.PRIMARY)
    }
  } else {
    embed.setColor(COLORS.PRIMARY)
  }

  return {
    embeds: [embed],
  }
}

export const createNowPlaying = (
  metadata: TrackMetadata,
  url: string,
  queuedBy?: string
): InteractionReplyOptions => {
  const embed = new MessageEmbed()
    .setAuthor('Now Playing...')
    .setTitle(metadata.title)
    .setDescription(
      queuedBy
        ? `${metadata.artist}\n\n[YouTube](${url})\n\n[<@${queuedBy}>]`
        : `${metadata.artist}\n\n`
    )
    .setThumbnail(metadata.artwork_url.url)
    .setColor(COLORS.PRIMARY)

  return {
    embeds: [embed],
  }
}

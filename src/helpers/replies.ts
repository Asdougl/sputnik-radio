import { InteractionReplyOptions, MessageEmbed } from 'discord.js'

export const createEmbedReply = (baseText: string) => {
  return new MessageEmbed().setColor('#cd0001').setDescription(baseText)
}

type ReplyType = 'log' | 'warn' | 'error'

export interface ReplyOptions {
  footer?: string
  status?: ReplyType
}

export const createReply = (
  baseText: string,
  options?: ReplyOptions
): InteractionReplyOptions => {
  const embed = new MessageEmbed().setDescription(baseText)

  if (options?.footer) {
    embed.setFooter(options.footer)
  }

  if (options?.status && options.status !== 'log') {
    if (options.status === 'warn') {
      embed.setColor('#cd0001')
    } else {
      embed.setColor('#580000')
    }
  } else {
    embed.setColor('#fbc812')
  }

  return {
    embeds: [embed],
  }
}

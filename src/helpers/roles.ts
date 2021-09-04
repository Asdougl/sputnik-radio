import { CommandInteraction } from 'discord.js'

type NoDJReason = 'not-dj' | 'dj-banned' | 'other'

export const cannotDJ = (
  djrole: string | undefined,
  djBanRole: string | undefined,
  interaction: CommandInteraction
): NoDJReason | null => {
  if (interaction.member) {
    let cannotPlay: NoDJReason | null = null

    if (djrole) {
      cannotPlay = (
        Array.isArray(interaction.member.roles)
          ? !interaction.member.roles.some((role) => role === djrole)
          : !interaction.member.roles.cache.some((role) => role.name === djrole)
      )
        ? 'not-dj'
        : null
    }

    if (djBanRole) {
      cannotPlay = (
        Array.isArray(interaction.member.roles)
          ? interaction.member.roles.some((role) => role === djBanRole)
          : interaction.member.roles.cache.some(
              (role) => role.name === djBanRole
            )
      )
        ? 'dj-banned'
        : cannotPlay
    }

    return cannotPlay
  } else {
    return 'other'
  }
}

export const cannotDJReason = (
  reason: NoDJReason,
  djRole: string | undefined,
  nodjrole: string | undefined
) => {
  switch (reason) {
    case 'not-dj':
      return `you lack the ${djRole} role that enables you to DJ. You have yet to prove yourself worthy.`
    case 'dj-banned':
      return `you have been banned from DJing with the ${nodjrole} role. You must have really bad taste.`
    default:
      return `there was an error checking your DJ permissions, try again later.`
  }
}

import { Client, CommandInteraction } from 'discord.js'
import { command, COMMANDS, isCOMMAND } from '../constants/commands'
import { cannotDJ, cannotDJReason } from '../helpers/roles'
import { MusicQueue } from '../music/Queue'
import { getQueue, musicQueues } from '../queues/state'

type GetMusicQueue = (autojoin?: boolean) => MusicQueue

interface CommandCallbackParams {
  interaction: CommandInteraction
  getGuildQueue: GetMusicQueue
  guildId: string
}

type CommandCallback = (params: CommandCallbackParams) => Promise<void>

interface EventMap {
  [commandName: string]: CommandCallback[]
}

export class DiscordBotError extends Error {
  constructor(name: string, message: string) {
    super()
    this.message = message
    this.name = name
  }
}

const djrole = process.env.DJ_ROLE,
  djbanrole = process.env.DJ_BAN_ROLE

export class DiscordBot {
  private client: Client<boolean>
  private events: EventMap

  constructor(client: Client<boolean>) {
    this.client = client
    this.events = {}

    client.on('interactionCreate', async (interaction) => {
      if (!interaction.isCommand() || !interaction.guildId) return
      const badDJStatus = cannotDJ(djrole, djbanrole, interaction)
      if (badDJStatus) {
        await interaction.reply(
          `Sorry, ${cannotDJReason(badDJStatus, djrole, djbanrole)}`
        )
        return
      }

      const guildId = interaction.guildId

      let guildQueue = musicQueues.get(guildId)

      const commandName = interaction.commandName

      if (!Object.keys(this.events).includes(commandName)) {
        await interaction.reply('Unknown Command')
      } else {
        const todo = this.events[commandName]
        if (todo && todo.length) {
          const getGuildQueue: GetMusicQueue = (autojoin) => {
            if (guildQueue) return guildQueue

            if (autojoin) return getQueue(interaction, client)

            throw new DiscordBotError('No Guild', 'Not playing in this server!')
          }

          await Promise.all(
            todo.map((todoItem) =>
              todoItem({
                interaction,
                getGuildQueue,
                guildId,
              })
            )
          )
        }
      }
    })
  }

  public on(commandName: COMMANDS, callback: CommandCallback) {
    const commandPrefixed = command(commandName)
    const commandEvents = this.events[commandPrefixed]
    if (commandEvents) {
      this.events[commandPrefixed] = [...commandEvents, callback]
    } else {
      this.events[commandPrefixed] = [callback]
    }
  }
}

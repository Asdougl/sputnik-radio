import { REST } from '@discordjs/rest'
import { Routes, Snowflake } from 'discord-api-types/v9'

const commands = [
  {
    name: 'play',
    description: 'Play a song with a youtube link',
    options: [
      {
        name: 'song',
        description: 'song to be played',
        required: true,
      },
    ],
  },
  {
    name: 'skip',
    description: 'Skip the current track',
  },
  {
    name: 'queue',
    description: 'Show the current queue',
  },
  {
    name: 'clear',
    description: 'Clear the current queue',
  },
  {
    name: 'disconnect',
    description: 'Disconnect from the current channel',
  },
]

const rest = new REST({ version: '9' }).setToken('token')

export const registerCommands = async (guildId: Snowflake) => {
  try {
    console.log('Attempting to refresh application (/) commands')

    await rest.put(
      Routes.applicationGuildCommands(process.env.APP_ID!, guildId),
      { body: commands }
    )

    console.log('Successfully refreshed application (/) commands')
  } catch (error) {
    console.error(error)
  }
}

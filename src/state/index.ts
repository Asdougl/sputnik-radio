import { Snowflake } from 'discord-api-types'
import { MusicQueue } from '../music/Queue'

export const musicQueues = new Map<Snowflake, MusicQueue>()

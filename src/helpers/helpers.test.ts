import { shuffle } from './arrays'
import { createReply, createNowPlaying } from './replies'
import { secondsToDuration } from './time'
import { formatToWidth } from './formatting'
import { EmbedBuilder } from 'discord.js'

describe('Shuffle Helper', () => {
  test('should shuffle an array', () => {
    const original = ['a', 'b', 'c', 'd', 'e', 'f', 'g']
    const shuffled = shuffle(original)
    expect(
      shuffled[0] !== original[0] || shuffled[1] !== original[1]
    ).toBeTruthy()
  })

  test('should return new array', () => {
    const original = ['a', 'b', 'c', 'd', 'e', 'f', 'g']
    const shuffled = shuffle(original)
    expect(shuffled !== original).toBeTruthy()
  })
})

describe('Replies Helper', () => {
  test('should create an embeds array', () => {
    const baseText = 'hello world'
    const reply = createReply(baseText)
    expect(typeof reply === 'object').toBeTruthy()
    expect(reply).toHaveProperty('embeds')
    expect(Array.isArray(reply?.embeds)).toBeTruthy()
    expect(reply?.embeds?.length).toBe(1)
    expect(reply?.embeds?.[0]).toBeInstanceOf(EmbedBuilder)
    console.log(reply?.embeds?.[0])
  })
})

describe('Time Helpers', () => {
  test('should turn two minutes into 2:00', () => {
    const seconds = 120
    const formatted = secondsToDuration(seconds)
    expect(formatted).toBe('2:00')
  })

  test('should turn 9321 seconds into hours', () => {
    const seconds = 9321
    const formatted = secondsToDuration(seconds)
    expect(formatted).toBe('2:35:21')
  })
})

describe('Formatting Helpers', () => {
  test('should apply correct padding', () => {
    const text = 'hello world'
    const desiredLength = 20
    const formatted = formatToWidth(text, desiredLength)
    expect(formatted.length).toBe(desiredLength)
    expect(formatted.split(text)[1].length).toBe(desiredLength - text.length)
  })

  test('should trim long text', () => {
    const text = 'hello world'
    const desiredLength = 8
    const formatted = formatToWidth(text, desiredLength)
    expect(formatted.length).toBe(desiredLength)
    expect(formatted).toBe('hello...')
  })
})

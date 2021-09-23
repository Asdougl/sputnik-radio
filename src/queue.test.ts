import { determineQueue } from './queue'
import { Enqueueable } from './types/queue'

describe('Queueing Songs', () => {
  test('should create enqueue for youtube link', async () => {
    const link = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
    const enqueue = (await determineQueue(link)) as Enqueueable

    expect(enqueue).not.toBeNull()
    expect(Array.isArray(enqueue)).not.toBeTruthy()
    expect(enqueue.origin).toBe('youtube')
  })

  // test('should create enqueue for spotify link', async () => {
  //   const link =
  //     'https://open.spotify.com/track/2fuCquhmrzHpu5xcA1ci9x?si=355f67e914e74503'
  //   const enqueue = (await determineQueue(link)) as Enqueueable

  //   expect(enqueue).not.toBeNull()
  //   expect(Array.isArray(enqueue)).not.toBeTruthy()
  //   expect(enqueue.origin).toBe('youtube-music')
  // })

  // test('should create list of enqueues from spotify playlist', async () => {
  //   const link =
  //     'https://open.spotify.com/playlist/4it0LKYz8PCPUYybqaPIPH?si=9744a86241d447e9'
  //   const enqueue = (await determineQueue(link)) as Enqueueable[]

  //   expect(enqueue).not.toBeNull()
  //   expect(Array.isArray(enqueue)).toBeTruthy()
  //   expect(enqueue.length).toBeGreaterThanOrEqual(1)
  //   expect(enqueue[0].origin).toBe('spotify-playlist')
  //   expect(enqueue[0].url).toBeTruthy()
  // })

  // test('should be able to search youtube', async () => {
  //   const search = 'under pressure'
  //   const enqueue = (await determineQueue(search)) as Enqueueable[]

  //   expect(enqueue).not.toBeNull()
  //   expect(Array.isArray(enqueue)).toBeTruthy()
  //   expect(enqueue.length).toBeGreaterThanOrEqual(1)
  //   expect(enqueue[0].origin).toBe('youtube-music')
  //   expect(enqueue[0].url).toBeTruthy()
  // })
})

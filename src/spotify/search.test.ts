import { getSpotifyInfo } from './search'

describe('Spotify Search', () => {
  test('should fetch "Under Pressure"', async () => {
    const content = await getSpotifyInfo(
      'https://open.spotify.com/track/2fuCquhmrzHpu5xcA1ci9x?si=9e604b35a37b4c11'
    )
    expect(content).not.toBeNull()
    expect(content?.name.toLowerCase()).toBe('under pressure - remastered 2011')
    expect(content?.duration_ms).toBeGreaterThan(0)
  })

  test('should fail on invalid spotify link', async () => {
    const content = await getSpotifyInfo(
      'https://close.spotify.com/track/2fuCquhmrzHpu5xcA1ci9x'
    )
    expect(content).toBeNull()
  })
})

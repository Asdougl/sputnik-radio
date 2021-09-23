import { getSpotifyPlaylist } from './playlist'

describe('Spotify Playlist', () => {
  test('should fetch "Absolute Bangers" playlist', async () => {
    const data = await getSpotifyPlaylist(
      'https://open.spotify.com/playlist/4it0LKYz8PCPUYybqaPIPH?si=7cb3df45a4704765'
    )

    expect(data).not.toBeNull()
    expect(Array.isArray(data)).toBeTruthy()
    expect(data?.length).toBeGreaterThanOrEqual(1)
  })

  test('should handle unknown spotify playlist', async () => {
    const data = await getSpotifyPlaylist(
      'https://open.spotify.com/playlist/abc123'
    )

    expect(data).toBeNull()
  })

  test('should handle invalid spotify link', async () => {
    const data = await getSpotifyPlaylist('abc123')

    expect(data).toBeNull()
  })
})

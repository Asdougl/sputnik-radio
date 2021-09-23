import axios from 'axios'
import { isSpotifyError, SpotifyError, SpotifyInfo } from '.'
import { Enqueueable } from '../types/queue'
import { youtubeSearch } from '../youtube/search'
import { getSpotifyApiKey } from './keys'

export const getSpotifyInfo = async (link: string) => {
  const match = link.match(
    /https?:\/\/open\.spotify\.com\/track\/([A-Za-z0-9]*)(?:\?si=.*)?$/
  )

  if (match) {
    const spotifyId = match[1]

    try {
      const spotifyApiKey = await getSpotifyApiKey()

      const { data } = await axios.get<SpotifyInfo | SpotifyError>(
        `https://api.spotify.com/v1/tracks/${spotifyId}?market=AU`,
        {
          headers: {
            Authorization: `Bearer ${spotifyApiKey}`,
          },
        }
      )

      if (isSpotifyError(data)) {
        throw new Error(
          data.error.message === 'invalid id'
            ? 'Invalid Spotify Link'
            : 'Unknown Spotify Error'
        )
      }

      return data
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.warn(error.response ? error.response.data : error.message)
      } else if (error instanceof Error) {
        console.warn(error.message)
      } else {
        console.warn(error)
      }
      return null
    }
  } else {
    return null
  }
}

export const spotifyToYoutube = async (
  link: string,
  channelId?: string,
  queuedBy?: string
): Promise<Enqueueable | null> => {
  const spotifyInfo = await getSpotifyInfo(link)
  if (spotifyInfo === null) return null

  const youtubeSearchResults = await youtubeSearch(
    `${spotifyInfo.name}, ${spotifyInfo.artists[0].name}`
  )

  if (!youtubeSearchResults.length) return null

  const track = youtubeSearchResults[0]

  return {
    origin: 'youtube-music',
    url: `https://www.youtube.com/watch?v=${track.videoId}`,
    channelId,
    queuedBy,
    metadata: {
      title: track.name,
      artist: Array.isArray(track.artist)
        ? track.artist[0].name
        : track.artist.name,
      album: track.album.name,
      artwork_url: track.thumbnails[0],
      duration: track.duration / 1000,
    },
  }
}

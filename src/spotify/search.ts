import axios from 'axios'
import { isSpotifyError, SpotifyError, SpotifyInfo } from '.'
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
      console.warn(error.response ? error.response.data : error.message)
      return null
    }
  } else {
    return null
  }
}

export const spotifyToYoutube = async (link: string) => {
  const spotifyInfo = await getSpotifyInfo(link)
  if (spotifyInfo === null) return ''

  const youtubeSearchResults = await youtubeSearch(
    `${spotifyInfo.name}, ${spotifyInfo.artists[0].name}`
  )

  if (!youtubeSearchResults.length) return ''

  return youtubeSearchResults[0].id.videoId
}

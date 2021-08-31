import axios from 'axios'
import { isSpotifyError, SpotifyError, SpotifyInfo } from '.'
import { youtubeSearch } from '../youtube/search'
import { getSpotifyApiKey } from './keys'

interface PlaylistTrackInfo {
  track: SpotifyInfo
}

interface PlaylistResponse {
  href: string
  items: PlaylistTrackInfo[]
}

export const getSpotifyPlaylist = async (link: string) => {
  const match = link.match(
    /https?:\/\/open\.spotify\.com\/playlist\/([A-Za-z0-9]*)(?:\?si=.*)?$/
  )

  if (match) {
    const playlistId = match[1]

    try {
      const spotifyApiKey = await getSpotifyApiKey()

      const { data } = await axios.get<PlaylistResponse | SpotifyError>(
        `https://api.spotify.com/v1/playlists/${playlistId}/tracks?market=AU`,
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

      // FYI spotify api returns max 100 items
      return data.items.map(({ track }) => track)
    } catch (error) {
      console.warn(error.response ? error.response.data : error.message)
      return null
    }
  }

  return null
}

export const spotifyPlaylistToYoutube = async (link: string) => {
  const spotifyInfoArr = await getSpotifyPlaylist(link)
  if (spotifyInfoArr === null || !spotifyInfoArr.length) return ''

  const searchPromises = spotifyInfoArr.map((info) =>
    youtubeSearch(`${info.name}, ${info.artists[0].name}`)
  )

  const searchResults = await Promise.all(searchPromises)

  let resultIds: string[] = []
  for (const result of searchResults) {
    if (result.length) {
      resultIds = [...resultIds, result[0].id.videoId]
    }
  }

  return resultIds.length ? resultIds : ''
}

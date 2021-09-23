import axios from 'axios'
import { isSpotifyError, SpotifyError, SpotifyInfo } from '.'
import { Enqueueable } from '../types/queue'
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
        return null
      }

      // FYI spotify api returns max 100 items
      return data.items.map(({ track }) => track)
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response && error.response.status === 404) return null
        console.log(error.response ? error.response.data : error.message)
      } else if (error instanceof Error) {
        console.log(error.message)
      } else {
        console.log(error)
      }
      return null
    }
  }

  return null
}

export const spotifyPlaylistToYoutube = async (
  link: string,
  channelId?: string,
  queuedBy?: string
) => {
  const spotifyInfoArr = await getSpotifyPlaylist(link)
  if (spotifyInfoArr === null || !spotifyInfoArr.length) return null

  const searchPromises = spotifyInfoArr.map((info) =>
    youtubeSearch(`${info.name}, ${info.artists[0].name}`)
  )

  const searchResults = await Promise.all(searchPromises)

  let results: Enqueueable[] = []
  searchResults.forEach((result, index) => {
    if (result.length) {
      results = [
        ...results,
        {
          origin: 'spotify-playlist',
          url: `http://www.youtube.com/watch?v=${result[0].videoId}`,
          channelId,
          queuedBy,
          metadata: {
            title: spotifyInfoArr[index].name,
            artist: spotifyInfoArr[index].artists[0].name,
            album: spotifyInfoArr[index].album.name,
            artwork_url: result[0].thumbnails[0],
            duration: Math.round(spotifyInfoArr[index].duration_ms / 1000),
          },
        },
      ]
    }
  })

  return results.length ? results : null
}

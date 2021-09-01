// @ts-ignore
import YoutubeMusicApi from 'youtube-music-api'
import { Thumbnail } from '../types/queue'

interface YoutubeSearchItem {
  kind: string
  etag: string
  id: {
    kind: string
    videoId: string
  }
  snippet: {
    publishedAt: string
    channelId: string
    title: string
  }
}

// export const youtubeSearch = async (query: string) => {
//   try {
//     const { data } = await axios.get(
//       `https://www.googleapis.com/youtube/v3/search?key=${process.env.YOUTUBE_API_KEY}&part=snippet&q=${query}`
//     )

//     // Get Top 5 items
//     const items = (data.items as YoutubeSearchItem[]).splice(0, 5)

//     if (!Array.isArray(items)) throw new Error('Invalid API Response')

//     return items
//   } catch (error) {
//     console.warn(error)
//     return []
//   }
// }

interface InnertubeArtist {
  name: string
  browseId: string
}

interface InnertubeAlbum {
  name: string
  browseId: string
}

interface InnertubeSearchResult {
  type: 'song'
  videoId: string
  playlistId: string
  name: string
  artist: InnertubeArtist | InnertubeArtist[]
  album: InnertubeAlbum
  duration: number
  thumbnails: Thumbnail[]
  params: string
}

interface InnertubeSearchResponse {
  content: InnertubeSearchResult[]
  continuation:
    | {
        continuation: string
        clickTrackingParams: string
      }
    | any[]
}

export const youtubeSearch = async (query: string) => {
  try {
    const api = new YoutubeMusicApi()

    await api.initalize()

    const result = (await api.search(query, 'song')) as InnertubeSearchResponse

    return result.content
  } catch (error) {
    console.warn(error)
    return []
  }
}

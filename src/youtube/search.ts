import axios from 'axios'

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

export const youtubeSearch = async (query: string) => {
  try {
    const { data } = await axios.get(
      `https://www.googleapis.com/youtube/v3/search?key=${process.env.YOUTUBE_API_KEY}&part=snippet&q=${query}`
    )

    // Get Top 5 items
    const items = (data.items as YoutubeSearchItem[]).splice(0, 5)

    if (!Array.isArray(items)) throw new Error('Invalid API Response')

    return items
  } catch (error) {
    console.warn(error)
    return []
  }
}

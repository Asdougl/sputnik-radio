import axios from 'axios'

let key = ''
let expiresAt = -1

interface SpotifyKeysData {
  access_token: string
  token_type: string
  expires_in: number
}

export const getSpotifyApiKey = async () => {
  if (expiresAt > Date.now()) return key

  try {
    const params = new URLSearchParams()
    params.append('grant_type', 'client_credentials')
    params.append('client_id', process.env.SPOTIFY_CLIENT_ID || '')
    params.append('client_secret', process.env.SPOTIFY_CLIENT_SECRET || '')

    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      body: params,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    })

    const data = (await response.json()) as SpotifyKeysData

    key = data.access_token
    expiresAt = Date.now() + data.expires_in * 1000

    return key
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
}

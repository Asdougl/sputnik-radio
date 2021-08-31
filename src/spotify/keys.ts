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

    const basicAuth = Buffer.from(
      `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
    ).toString('base64')

    const { data } = await axios.post<SpotifyKeysData>(
      'https://accounts.spotify.com/api/token',
      params,
      {
        headers: {
          Authorization: `Basic ${basicAuth}`,
        },
      }
    )

    key = data.access_token
    expiresAt = Date.now() + data.expires_in * 1000

    return key
  } catch (error) {
    console.warn(error)
    return null
  }
}

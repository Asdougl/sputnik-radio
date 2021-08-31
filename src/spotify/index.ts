export interface SpotifyAlbum {
  name: string
  href: string
  id: string
}

export interface SpotifyArtist {
  id: string
  name: string
}

export interface SpotifyInfo {
  album: SpotifyAlbum
  artists: SpotifyArtist[]
  name: string
  popularity: string
}

export interface SpotifyError {
  error: {
    status: number
    message: string
  }
}

export const isSpotifyError = (test: any): test is SpotifyError => {
  return typeof test === 'object' && test.hasOwnProperty('error')
}

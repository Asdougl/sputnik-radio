import dayjs from 'dayjs'
import duration from 'dayjs/plugin/duration'

dayjs.extend(duration)

export const secondsToDuration = (secondsStr: string) => {
  let seconds = parseInt(secondsStr)
  if (isNaN(seconds)) return '0:00'

  const time = dayjs.duration(seconds, 'seconds')
  return time.get('hours') > 0 ? time.format('H:mm:ss') : time.format('m:ss')
}

export const formatToWidth = (text: string, width: number) => {
  const rpadding = width - text.length

  if (rpadding >= 0) {
    return text + ' '.repeat(rpadding)
  } else {
    return text.substr(0, width - 3) + '...'
  }
}

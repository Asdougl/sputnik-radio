export const shuffle = (array: any[]) => {
  let arrayCopy = [...array]
  let currentIndex = arrayCopy.length,
    randomIndex
  while (currentIndex != 0) {
    randomIndex = Math.floor(Math.random() * currentIndex)
    currentIndex--
    ;[arrayCopy[currentIndex], arrayCopy[randomIndex]] = [
      arrayCopy[randomIndex],
      arrayCopy[currentIndex],
    ]
  }

  return arrayCopy
}

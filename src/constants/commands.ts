export enum COMMANDS {
  PLAY = `play`,
  SKIP = 'skip',
  QUEUE = 'queue',
  CLEAR = 'clear',
  LEAVE = 'leave',
  GUI = 'gui',
  SEARCH = 'search',
  API = 'api',
  SHUFFLE = 'shuffle',
  UNDO = 'undo',
  SPECIAL = 'special',
  JOIN = 'join',
}

export enum SPECIAL_ARGS {
  SKIPWILL = 'skip will',
  EDSHERE = 'eds here',
}

export const command = (commandName: COMMANDS) => {
  const prefix = process.env.PREFIX ? `${process.env.PREFIX}-` : ''
  return `${prefix}${commandName}`
}

export const isCOMMAND = (test: string): test is COMMANDS => {
  // @ts-ignore
  return Object.values(COMMANDS).includes(test)
}

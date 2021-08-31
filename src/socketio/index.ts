import http from 'http'
import { Server } from 'socket.io'
import { app } from '../api'

const server = http.createServer(app)

const io = new Server(server)

io.on('connection', (socket) => {
  console.log('[SERVER] User has connected')
})

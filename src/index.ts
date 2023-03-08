import fs from 'fs'

import { Server } from './Server.js'

const START_PORT = 3000
const NUMBER_OF_MACHINES = 3

const servers: Server[] = []
const initialisedAt = new Date()

// initialize log folders
if (!fs.existsSync('./logs')) fs.mkdirSync('./logs')

const folderPath = `./logs/${initialisedAt.toISOString()}`
fs.mkdirSync(folderPath)

// initialize servers
for (let i = 0; i < NUMBER_OF_MACHINES; i++) {
    const clockRate = Math.floor(Math.random() * 6) + 1
    // const clockRate = { 0: 1, 1: 3, 2: 6 }[i]
    const port = START_PORT + i

    const server = new Server({ clockRate, port, initialisedAt })

    servers.push(server)
}

// add siblings
servers.forEach((server, index) => {
    const connections = servers.filter((_, i) => i !== index).map((s) => s.port)
    server.addConnections(connections)
})

// start servers
servers.forEach((server) => server.start())

// stop servers after 60 seconds
await new Promise((resolve) => setTimeout(resolve, 60_000))

servers.forEach((server) => server.stop())

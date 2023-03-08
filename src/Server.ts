import fs from 'fs'
import http from 'http'

type Message = {
    logicalClockTime: number
    from: number
    to: number
}

export class Server {
    server: http.Server
    port: number
    interval: NodeJS.Timer
    clockRate: number
    queue: Message[] = []
    connections: number[]
    logicalClock = 0
    initialisedAt: Date

    constructor({ clockRate, port, initialisedAt }: { clockRate: number; port: number; initialisedAt: Date }) {
        this.clockRate = clockRate
        this.port = port
        this.initialisedAt = initialisedAt
        this.server = http.createServer(this.processRequest.bind(this))
    }

    log(text: string) {
        console.log(`🖥️ ${this.port} ⏰${this.logicalClock.toString().padStart(3, ' ')} ${text}`)
    }

    addConnections(connections: number[]) {
        this.connections = connections
    }

    processRequest(req: http.IncomingMessage, res: http.OutgoingMessage) {
        let body = ''
        req.on('data', (chunk) => (body += chunk))
        req.on('end', () => {
            res.end('OK')
            const message = JSON.parse(body) as Message
            this.queue.push(message)

            this.log(`⬇️  recieved  ${JSON.stringify(message)}`)
        })
    }

    writeLog({ event, to }: { event: 'send' | 'process' | 'internal'; to?: number }) {
        const logPath = `./logs/${this.initialisedAt.toISOString()}/server-${this.port}.csv`
        // const logPath = `./logs/${this.initialisedAt.toISOString()}.csv`
        // create log file if it doesn't exist
        if (!fs.existsSync(logPath)) {
            fs.writeFileSync(logPath, 'timestamp,logicalClock,event,queueLength,to\n')
        }
        const date = new Date()
        const logEntry = [
            date.toISOString(),
            this.logicalClock,
            event,
            this.queue.length,
            to ?? ''
        ].join(',')

        fs.appendFileSync(logPath, logEntry + '\n')

        return
    }

    async sendMessage({ to }: { to: number }) {
        const message: Message = {
            logicalClockTime: this.logicalClock,
            from: this.port,
            to: to
        }

        this.log(`⬆️  sent      ${JSON.stringify(message)}`)
        await fetch(`http://localhost:${to}`, {
            method: 'POST',
            body: JSON.stringify(message)
        })
    }

    start() {
        this.server.listen(this.port, () =>
            this.log(`🟢 started, connecting to ${this.connections.length} other 🖥️, running at ${this.clockRate} ops/s`)
        )

        // start processing at clock rate
        this.interval = setInterval(async () => {
            if (this.queue.length > 0) {
                const message = this.queue.shift()
                this.log(`⬅️  processed ${JSON.stringify(message)}`)

                this.logicalClock = Math.max(this.logicalClock, message.logicalClockTime) + 1
                this.writeLog({ event: 'process' })

                return
            }

            const number = Math.floor(Math.random() * 10) + 1
            //const number = Math.floor(Math.random() * 3) + 1

            // send a message to a random sibling
            if (number == 1 || number == 2) {
                const port = this.connections[number - 1]
                await this.sendMessage({ to: port })
                this.logicalClock++
                this.writeLog({ event: 'send', to: port })

                return
            }

            // send a message to all siblings
            if (number == 3) {
                this.connections.forEach(async (port) => {
                    await this.sendMessage({ to: port })
                    this.logicalClock++
                    this.writeLog({ event: 'send', to: port })
                })

                return
            }

            // internal event
            if (number >= 4) {
                this.logicalClock++
                this.writeLog({ event: 'internal' })

                return
            }
        }, 1000 / this.clockRate)
    }

    stop() {
        clearInterval(this.interval)
        this.server.close(() => this.log(`🛑 stopped with ${this.queue.length} messages in queue`))
    }
}

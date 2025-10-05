import { createServer } from './app.js'

const PORT = parseInt(process.env.PORT ?? '4000', 10)

const { app, close } = createServer()

const server = app.listen(PORT, () => {
  console.log(`Notes service listening on http://0.0.0.0:${PORT}`)
})

const shutdown = (signal) => {
  console.log(`\nReceived ${signal}, shutting down...`)
  server.close(() => {
    close()
    process.exit(0)
  })
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

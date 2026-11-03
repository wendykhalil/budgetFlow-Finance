require("dotenv").config()

const { validateEnvironment } = require("./config/environment")

const environment = validateEnvironment()

const { createServer } = require("node:http")

const app = require("./app")

const { connectDB } = require("./config/database")

const { attachSocketServer } = require("./socket")

async function startServer() {
  if (environment.nodeEnv === "production") {
    await connectDB()
  }

  const server = createServer(app)

  attachSocketServer(server, app)

  server.listen(environment.port, () => {
    console.log(`Server is running on port ${environment.port}`)
  })

  if (environment.nodeEnv !== "production") {
    connectDB().catch((error) => {
      console.error(error.message)
    })
  }
}

startServer().catch((error) => {
  console.error(error.message || "Server startup failed.")

  process.exitCode = 1
})

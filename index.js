const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '.env') })

const express  = require('express')
const cors     = require('cors')
const mongoose = require('mongoose')

const authRouter    = require('./routes/auth')
const animalsRouter = require('./routes/animals')
const milkRouter    = require('./routes/milk')
const healthRouter  = require('./routes/health')
const feedRouter    = require('./routes/feed')

const app  = express()
const PORT = process.env.PORT || 3001

app.use(cors({ origin: '*' }))
app.use(express.json())

app.use('/api/auth',    authRouter)
app.use('/api/animals', animalsRouter)
app.use('/api/milk',    milkRouter)
app.use('/api/health',  healthRouter)
app.use('/api/feed',    feedRouter)

app.get('/api/ping', (_req, res) => res.json({ ok: true, time: new Date() }))

const MONGO_URI = process.env.MONGODB_URI
if (!MONGO_URI) { console.error('❌  MONGODB_URI not set'); process.exit(1) }

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log('✅  MongoDB connected')
    app.listen(PORT, '0.0.0.0', () => console.log(`🚀  Server on port ${PORT}`))
  })
  .catch(err => { console.error('❌  MongoDB failed:', err.message); process.exit(1) })

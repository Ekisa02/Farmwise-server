const express  = require('express')
const router   = express.Router()
const multer   = require('multer')
const axios    = require('axios')
const Animal   = require('../models/Animal')
const HealthScan = require('../models/HealthScan')
const protect  = require('../middleware/auth')

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })

// OpenRouter call — supports vision models (free tier available)
async function callOpenRouter(messages, systemPrompt) {
  const response = await axios.post(
    'https://openrouter.ai/api/v1/chat/completions',
    {
      model: process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.2-11b-vision-instruct:free',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
      max_tokens: 900,
      temperature: 0.2,
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.APP_URL || 'https://farmwise-henna.vercel.app',
        'X-Title': 'FarmWise',
      },
    }
  )
  return response.data.choices[0].message.content
}

router.use(protect)

// POST /api/health/scan
router.post('/scan', upload.single('image'), async (req, res) => {
  try {
    const { animalId, scanType, location } = req.body
    const file = req.file

    if (!file)     return res.status(400).json({ message: 'No image uploaded' })
    if (!animalId) return res.status(400).json({ message: 'animalId required' })

    const animal = await Animal.findOne({ _id: animalId, userId: req.user._id })
    if (!animal) return res.status(404).json({ message: 'Animal not found' })

    const b64       = file.buffer.toString('base64')
    const mediaType = file.mimetype

    const systemPrompt = `You are a fast expert livestock vet AI for Kenyan smallholder farmers near ${location || 'Kenya'}.
Analyse the photo quickly and return ONLY valid JSON — no markdown, no extra text.
Schema:
{
  "status": "healthy|warning|critical",
  "condition": "disease/condition name or Normal",
  "finding": "1-2 plain English sentences",
  "severity": 0,
  "recommendations": ["action 1","action 2","action 3"],
  "food": {"remove":["item"],"add":["item with amount"]},
  "urgency": "monitor|vet_soon|vet_now",
  "prevention": "one prevention tip"
}`

    const userMessage = {
      role: 'user',
      content: [
        {
          type: 'image_url',
          image_url: { url: `data:${mediaType};base64,${b64}` },
        },
        {
          type: 'text',
          text: `${scanType} scan of ${animal.type} "${animal.name}" — ${animal.breed}, ${animal.age}, ${animal.sex === 'M' ? 'male' : 'female'}. Farm: ${location || 'Kenya'}. Give accurate health assessment.`,
        },
      ],
    }

    const raw    = await callOpenRouter([userMessage], systemPrompt)
    const clean  = raw.replace(/```json|```/g, '').trim()
    const result = JSON.parse(clean)

    const scan = await HealthScan.create({
      animalId,
      scanType,
      location: location || '',
      ...result,
    })

    if (result.status !== 'healthy') {
      await Animal.findByIdAndUpdate(animalId, { status: result.status })
    }

    res.json({ ...result, _id: scan._id })
  } catch (err) {
    console.error('Health scan error:', err.response?.data || err.message)
    res.status(500).json({ message: err.message })
  }
})

// GET /api/health/history/:animalId
router.get('/history/:animalId', async (req, res) => {
  try {
    const scans = await HealthScan.find({ animalId: req.params.animalId })
      .sort({ createdAt: -1 }).limit(20)
    res.json(scans)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// GET /api/health/recent
router.get('/recent', async (req, res) => {
  try {
    const scans = await HealthScan.find()
      .sort({ createdAt: -1 }).limit(10)
      .populate('animalId', 'name breed emoji')
    res.json(scans)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

module.exports = router

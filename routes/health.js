const express    = require('express')
const router     = express.Router()
const multer     = require('multer')
const axios      = require('axios')
const Animal     = require('../models/Animal')
const HealthScan = require('../models/HealthScan')
const protect    = require('../middleware/auth')

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024 },   // 10 MB max
})

// ── OpenRouter helper ────────────────────────────────────────
async function callOpenRouter(messages, systemPrompt, isVision = false) {
  // Vision scan → use vision-capable model
  // Text only   → use lighter text model
  const model = isVision
    ? (process.env.OPENROUTER_MODEL      || 'nvidia/nemotron-nano-12b-v2-vl:free')
    : (process.env.OPENROUTER_MODEL_TEXT || 'arcee-ai/trinity-large-preview:free')

  const response = await axios.post(
    'https://openrouter.ai/api/v1/chat/completions',
    {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
      max_tokens: 900,
      temperature: 0.2,
    },
    {
      headers: {
        Authorization:  `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer':  process.env.APP_URL || 'https://farmwise-henna.vercel.app',
        'X-Title':       'FarmWise',
      },
      timeout: 55000,
    }
  )

  // Some free reasoning models put the answer in .reasoning instead of .content
  const msg = response.data.choices[0].message
  return msg.content || msg.reasoning || ''
}

// ── Extract JSON safely ───────────────────────────────────────
function extractJSON(raw) {
  try { return JSON.parse(raw.trim()) } catch {}

  const fenced = raw.replace(/```json|```/g, '').trim()
  try { return JSON.parse(fenced) } catch {}

  const start = raw.indexOf('{')
  const end   = raw.lastIndexOf('}')
  if (start !== -1 && end !== -1) {
    try { return JSON.parse(raw.slice(start, end + 1)) } catch {}
  }

  throw new Error('Model did not return valid JSON. Please try again.')
}

// ── Fallback result when model fails ─────────────────────────
function fallbackResult(scanType, animalName) {
  return {
    status:          'warning',
    condition:       'Analysis incomplete',
    finding:         `Could not fully analyse the ${scanType} photo of ${animalName}. Please retake in bright daylight, 30–50 cm from the area.`,
    severity:        3,
    recommendations: [
      'Retake the photo in bright outdoor light',
      'Hold the camera steady and close to the area',
      'Consult a local vet if symptoms are visible',
    ],
    food:       { remove: ['Excess wet grass'], add: ['Fresh clean water', 'Quality dry hay'] },
    urgency:    'monitor',
    prevention: 'Regular fortnightly health checks catch problems early.',
  }
}

router.use(protect)

// POST /api/health/scan ────────────────────────────────────────
router.post('/scan', upload.single('image'), async (req, res) => {
  const { animalId, scanType, location } = req.body
  const file = req.file

  if (!file)     return res.status(400).json({ message: 'No image uploaded' })
  if (!animalId) return res.status(400).json({ message: 'animalId is required' })

  try {
    const animal = await Animal.findOne({ _id: animalId, userId: req.user._id })
    if (!animal) return res.status(404).json({ message: 'Animal not found' })

    const b64       = file.buffer.toString('base64')
    const mediaType = file.mimetype
    const farm      = location || 'Kenya'

    const systemPrompt = `You are a fast expert livestock vet AI for Kenyan smallholder farmers near ${farm}.
Analyse the photo and return ONLY valid JSON — no markdown, no preamble. Start with {
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
          type:      'image_url',
          image_url: { url: `data:${mediaType};base64,${b64}` },
        },
        {
          type: 'text',
          text: `${scanType} scan of ${animal.type} "${animal.name}" — ${animal.breed}, ${animal.age}, ${animal.sex === 'M' ? 'male' : 'female'}. Farm: ${farm}. Give accurate health assessment.`,
        },
      ],
    }

    let result
    try {
      const raw = await callOpenRouter([userMessage], systemPrompt, true)
      result    = extractJSON(raw)
    } catch (modelErr) {
      console.warn('Vision model failed, using fallback:', modelErr.message)
      result = fallbackResult(scanType, animal.name)
    }

    // Persist scan to DB
    const scan = await HealthScan.create({
      animalId,
      scanType,
      location: farm,
      ...result,
    })

    // Auto-update animal status if flagged
    if (result.status !== 'healthy') {
      await Animal.findByIdAndUpdate(animalId, { status: result.status })
    }

    res.json({ ...result, _id: scan._id })
  } catch (err) {
    console.error('Health scan error:', err.response?.data || err.message)
    res.status(500).json({ message: err.message })
  }
})

// GET /api/health/history/:animalId ───────────────────────────
router.get('/history/:animalId', async (req, res) => {
  try {
    const scans = await HealthScan
      .find({ animalId: req.params.animalId })
      .sort({ createdAt: -1 })
      .limit(20)
    res.json(scans)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// GET /api/health/recent ──────────────────────────────────────
router.get('/recent', async (req, res) => {
  try {
    const scans = await HealthScan
      .find()
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('animalId', 'name breed emoji')
    res.json(scans)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

module.exports = router
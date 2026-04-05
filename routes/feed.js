const express = require('express')
const router  = express.Router()
const axios   = require('axios')
const protect = require('../middleware/auth')

// ── OpenRouter helper — text models ──────────────────────────
async function callOpenRouter(userContent, systemPrompt) {
  const model = process.env.OPENROUTER_MODEL_TEXT || 'arcee-ai/trinity-large-preview:free'

  const response = await axios.post(
    'https://openrouter.ai/api/v1/chat/completions',
    {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userContent },
      ],
      max_tokens: 900,
      temperature: 0.3,
    },
    {
      headers: {
        Authorization:  `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer':  process.env.APP_URL || 'https://farmwise-henna.vercel.app',
        'X-Title':       'FarmWise',
      },
      timeout: 55000,   // 55s — just under the 60s client timeout
    }
  )

  // Some free models return content in reasoning field instead of content
  const msg = response.data.choices[0].message
  return msg.content || msg.reasoning || ''
}

// ── Extract JSON safely — handles markdown fences + reasoning preamble ──
function extractJSON(raw) {
  // Try direct parse first
  try { return JSON.parse(raw.trim()) } catch {}

  // Strip markdown fences
  const fenced = raw.replace(/```json|```/g, '').trim()
  try { return JSON.parse(fenced) } catch {}

  // Find first { ... } block
  const start = raw.indexOf('{')
  const end   = raw.lastIndexOf('}')
  if (start !== -1 && end !== -1) {
    try { return JSON.parse(raw.slice(start, end + 1)) } catch {}
  }

  throw new Error('Model did not return valid JSON. Please try again.')
}

router.use(protect)

// POST /api/feed/advice
router.post('/advice', async (req, res) => {
  const { concern, foods = [] } = req.body
  if (!concern) return res.status(400).json({ message: 'concern is required' })

  const systemPrompt = `You are a livestock nutrition expert for Kenyan smallholder dairy farmers.
Give practical, locally-relevant feeding advice.
Return ONLY valid JSON — no markdown, no explanation, no preamble. Start your response with {
Schema:
{
  "summary": "one sentence summary",
  "remove": [{ "food": "name", "reason": "why to reduce it" }],
  "add": [{ "food": "name", "amount": "how much per day", "reason": "why to add it" }],
  "water": "daily water intake tip",
  "local_tip": "one Kenya-specific farming tip"
}`

  const userContent = `Cow concern: "${concern}". Available feeds on this Kenyan farm: ${foods.join(', ') || 'not specified'}. Give specific feeding advice.`

  try {
    const raw    = await callOpenRouter(userContent, systemPrompt)
    const result = extractJSON(raw)
    res.json(result)
  } catch (err) {
    console.error('Feed advice error:', err.response?.data || err.message)
    res.status(500).json({ message: err.message })
  }
})

module.exports = router
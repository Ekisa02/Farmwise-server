const express = require('express')
const router  = express.Router()
const axios   = require('axios')
const protect = require('../middleware/auth')

async function callOpenRouter(userContent, systemPrompt) {
  const response = await axios.post(
    'https://openrouter.ai/api/v1/chat/completions',
    {
      model: process.env.OPENROUTER_MODEL_TEXT || 'meta-llama/llama-3.1-8b-instruct:free',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userContent },
      ],
      max_tokens: 800,
      temperature: 0.3,
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

// POST /api/feed/advice
router.post('/advice', async (req, res) => {
  const { concern, foods = [] } = req.body
  if (!concern) return res.status(400).json({ message: 'concern is required' })

  try {
    const systemPrompt = `You are a livestock nutrition expert for Kenyan smallholder dairy farmers.
Give practical, locally-relevant feeding advice.
Return ONLY valid JSON with this exact schema (no markdown):
{
  "summary": "one sentence summary",
  "remove": [{ "food": "name", "reason": "why" }],
  "add": [{ "food": "name", "amount": "how much per day", "reason": "why" }],
  "water": "daily water intake tip",
  "local_tip": "one Kenya-specific farming tip"
}`

    const userContent = `Cow concern: "${concern}". Available feeds: ${foods.join(', ') || 'not specified'}. Give feeding advice for a Kenyan dairy farmer.`

    const raw    = await callOpenRouter(userContent, systemPrompt)
    const clean  = raw.replace(/```json|```/g, '').trim()
    const result = JSON.parse(clean)

    res.json(result)
  } catch (err) {
    console.error('Feed advice error:', err.response?.data || err.message)
    res.status(500).json({ message: err.message })
  }
})

module.exports = router

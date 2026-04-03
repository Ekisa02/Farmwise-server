const express    = require('express')
const router     = express.Router()
const MilkRecord = require('../models/MilkRecord')
const protect    = require('../middleware/auth')

router.use(protect)

// GET /api/milk/:animalId — all records
router.get('/:animalId', async (req, res) => {
  try {
    const records = await MilkRecord.find({ animalId: req.params.animalId }).sort({ date: 1 })
    res.json(records)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// GET /api/milk/:animalId/last7
router.get('/:animalId/last7', async (req, res) => {
  try {
    const records = await MilkRecord
      .find({ animalId: req.params.animalId })
      .sort({ date: -1 })
      .limit(7)
    res.json(records.reverse())
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// POST /api/milk — upsert by animalId + date
router.post('/', async (req, res) => {
  const { animalId, date, am, pm } = req.body
  try {
    const record = await MilkRecord.findOneAndUpdate(
      { animalId, date },
      { animalId, date, am, pm },
      { upsert: true, new: true, runValidators: true }
    )
    res.status(201).json(record)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
})

// DELETE /api/milk/:id
router.delete('/:id', async (req, res) => {
  try {
    await MilkRecord.findByIdAndDelete(req.params.id)
    res.json({ message: 'Deleted' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

module.exports = router

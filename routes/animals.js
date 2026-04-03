const express  = require('express')
const router   = express.Router()
const Animal   = require('../models/Animal')
const protect  = require('../middleware/auth')

// All routes protected — user must be logged in
router.use(protect)

// GET /api/animals — only this user's animals
router.get('/', async (req, res) => {
  try {
    const animals = await Animal.find({ userId: req.user._id }).sort({ type: 1, name: 1 })
    res.json(animals)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// GET /api/animals/:id
router.get('/:id', async (req, res) => {
  try {
    const animal = await Animal.findOne({ _id: req.params.id, userId: req.user._id })
    if (!animal) return res.status(404).json({ message: 'Animal not found' })
    res.json(animal)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// POST /api/animals — add new animal
router.post('/', async (req, res) => {
  try {
    // auto-set emoji based on type
    const emojiMap = { cow: '🐄', bull: '🐂', calf: '🐮' }
    const emoji = emojiMap[req.body.type] || '🐄'
    const animal = await Animal.create({ ...req.body, userId: req.user._id, emoji })
    res.status(201).json(animal)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
})

// PUT /api/animals/:id
router.put('/:id', async (req, res) => {
  try {
    const animal = await Animal.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $set: req.body },
      { new: true, runValidators: true }
    )
    if (!animal) return res.status(404).json({ message: 'Animal not found' })
    res.json(animal)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
})

// DELETE /api/animals/:id
router.delete('/:id', async (req, res) => {
  try {
    const animal = await Animal.findOneAndDelete({ _id: req.params.id, userId: req.user._id })
    if (!animal) return res.status(404).json({ message: 'Animal not found' })
    res.json({ message: 'Deleted', id: req.params.id })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

module.exports = router

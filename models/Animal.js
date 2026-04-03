const mongoose = require('mongoose')

const animalSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name:   { type: String, required: true, trim: true },
    type:   { type: String, enum: ['cow', 'bull', 'calf'], required: true },
    breed:  { type: String, required: true },
    age:    { type: String, required: true },
    sex:    { type: String, enum: ['M', 'F'], required: true },
    emoji:  { type: String, default: '🐄' },
    status: { type: String, enum: ['healthy', 'warning', 'critical'], default: 'healthy' },
    notes:  { type: String, default: '' },
  },
  { timestamps: true }
)

module.exports = mongoose.model('Animal', animalSchema)

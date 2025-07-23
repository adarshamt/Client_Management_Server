// clientSchema.js
const mongoose = require('mongoose');

delete mongoose.connection.models['Client'];

const clientSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
});

module.exports = mongoose.models.Client || mongoose.model('Client', clientSchema);

const mongoose = require('mongoose');


const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email:  { type: String, required: true },
  phone: { type: String, required: true },
  password:{ type: String, required: true },
  clients: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Client' }]

});

module.exports = mongoose.model('User', userSchema);
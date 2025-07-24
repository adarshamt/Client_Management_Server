// clientSchema.js
const mongoose = require("mongoose");

delete mongoose.connection.models["Client"];

const clientSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    packageName: { type: String, required: true },
    packageDuration: { type: Number, required: true },
    packageStatus: {
      isActive: { type: Boolean, default: true },
      daysRemaining: { type: Number, default: 0 },
      expiryDate: { type: Date },
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.Client || mongoose.model("Client", clientSchema);

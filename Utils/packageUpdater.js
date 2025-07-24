// utils/packageUpdater.js
const Client = require('../Model/clientSchema');

// For individual client updates
async function updateClientPackage(client) {
  const expiryDate = new Date(client.createdAt);
  expiryDate.setDate(expiryDate.getDate() + client.packageDuration);
  
  const now = new Date();
  const isActive = now < expiryDate;
  const daysRemaining = isActive 
    ? Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24))
    : 0;

  // Only update if status changed
  if (!client.packageStatus || 
      client.packageStatus.daysRemaining !== daysRemaining || 
      client.packageStatus.isActive !== isActive) {
    
    const updated = await Client.findByIdAndUpdate(
      client._id,
      {
        $set: {
          'packageStatus.isActive': isActive,
          'packageStatus.daysRemaining': daysRemaining,
          'packageStatus.expiryDate': expiryDate
        }
      },
      { new: true, lean: true }
    );
    return updated || client;
  }
  return client;
}

// For batch updates (used by cron job)
async function updateClientPackages() {
  const clients = await Client.find({}).lean();
  const results = await Promise.all(clients.map(client => 
    updateClientPackage(client)
  ));
  return results.filter(updated => updated).length;
}

module.exports = { 
  updateClientPackage,  // for single client updates
  updateClientPackages  // for batch updates
};
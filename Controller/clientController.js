const Client = require('../Model/clientSchema');
const User = require('../Model/userSchema');
const { updateClientPackage } = require('../Utils/packageUpdater'); // Note singular name

const addClient = async (req, res) => {
  try {
    const { name, email, phone, packageName, packageDuration } = req.body;
    const userId = req.user.id;

    // Check for existing client
    const existingClient = await Client.findOne({ email, createdBy: userId });
    if (existingClient) {
      return res.status(409).json({
        status: "fail",
        message: "Client with this email already exists",
      });
    }

    // Create new client
    const client = new Client({
      name,
      email,
      phone,
      packageName,
      packageDuration,
      createdBy: userId,
      packageStatus: {
        isActive: true,
        daysRemaining: packageDuration,
        expiryDate: new Date(Date.now() + packageDuration * 24 * 60 * 60 * 1000)
      }
    });

    await client.save();

    // Update user's client list
    await User.findByIdAndUpdate(
      userId,
      { $push: { clients: client._id } },
      { new: true }
    );

    res.status(201).json({
      status: "success",
      message: "Client added successfully",
      client: client.toObject()
    });

  } catch (error) {
    console.error("Add client error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to add client"
    });
  }
};

const getClients = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get clients
    let clients = await Client.find({ createdBy: userId }).lean();
    
    // Update and return fresh data
    clients = await Promise.all(
      clients.map(async client => {
        const updated = await updateClientPackage(client);
        return {
          ...updated,
          isActive: updated.packageStatus.isActive,
          daysRemaining: updated.packageStatus.daysRemaining,
          expiryDate: updated.packageStatus.expiryDate
        };
      })
    );

    res.status(200).json({
      status: "success",
      results: clients.length,
      clients
    });

  } catch (error) {
    console.error("Get clients error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to get clients"
    });
  }
};

const getClientsByStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status } = req.params;

    // Get clients
    let clients = await Client.find({ createdBy: userId }).lean();
    
    // Update all clients
    clients = await Promise.all(
      clients.map(client => updateClientPackage(client))
    );

    // Filter by status
    const filteredClients = clients.filter(client => 
      status === 'active' 
        ? client.packageStatus.isActive 
        : !client.packageStatus.isActive
    );

    res.status(200).json({
      status: "success",
      results: filteredClients.length,
      clients: filteredClients
    });

  } catch (error) {
    console.error("Get clients by status error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to filter clients by status"
    });
  }
};

module.exports = { 
  addClient, 
  getClients,
  getClientsByStatus
};
const Client = require('../Model/clientSchema');
const User = require('../Model/userSchema');
const { updateClientPackage } = require('../Utils/packageUpdater');

// Helper function to format date as YYYY-MM-DD
const formatDate = (date) => {
  return new Date(date).toISOString().split('T')[0];
};

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

    // Create new client with date-only expiry
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + packageDuration);
    expiryDate.setHours(0, 0, 0, 0); // Set time to midnight

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
        expiryDate: expiryDate
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
      client: {
        ...client.toObject(),
        packageStatus: {
          ...client.packageStatus,
          expiryDate: formatDate(client.packageStatus.expiryDate) // Date only
        }
      }
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
    
    // Update and return fresh data with formatted dates
    clients = await Promise.all(
      clients.map(async client => {
        const updated = await updateClientPackage(client);
        return {
          ...updated,
          packageStatus: {
            isActive: updated.packageStatus.isActive,
            daysRemaining: updated.packageStatus.daysRemaining,
            expiryDate: formatDate(updated.packageStatus.expiryDate) // Date only
          }
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
    
    // Update all clients with formatted dates
    clients = await Promise.all(
      clients.map(async client => {
        const updated = await updateClientPackage(client);
        return {
          ...updated,
          packageStatus: {
            isActive: updated.packageStatus.isActive,
            daysRemaining: updated.packageStatus.daysRemaining,
            expiryDate: formatDate(updated.packageStatus.expiryDate) // Date only
          }
        };
      })
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
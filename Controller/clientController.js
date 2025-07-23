// clientController.js
const Client = require('../Model/clientSchema');
const User = require('../Model/userSchema');

const addClient = async (req, res) => {
console.log("Client body received:", req.body);
    console.log("client add controller hit !!");
    
  try {
    const { name, email, phone } = req.body;
    const userId = req.user.id; // From JWT token

    console.log("userid from add client controller",userId);
    



    // Check if client with this email already exists for this user
    const existingClient = await Client.findOne({ email, createdBy: userId });
    console.log("find the user using the id client add controller ", existingClient);
    
    if (existingClient) {
      return res.status(409).json({
        status: "fail",
        message: "Client with this email already exists",
      });
    }

    // Create new client (no password needed)
    const client = new Client({
      name,
      email,
      phone,
      createdBy: userId
    });

    await client.save();

    // Add client to user's clients array
    await User.findByIdAndUpdate(
      userId,
      { $push: { clients: client._id } },
      { new: true }
    );

    res.status(201).json({
      status: "success",
      message: "Client added successfully",
      client: {
        id: client._id,
        name: client.name,
        email: client.email,
        phone: client.phone
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

    console.log(" hit the et client controller " );
    
  try {
    const userId = req.user.id; // From JWT token

    // Get all clients for this user
    const clients = await Client.find({ createdBy: userId });

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

module.exports = { addClient, getClients };
const Client = require('../Model/clientSchema');
const User = require('../Model/userSchema');
const { updateClientPackage } = require('../Utils/packageUpdater');

const { generateClientPDF } = require('../Utils/pdfGenerator');
const { sendEmailWithAttachment } = require('../services/emailService');
const fs = require('fs');

// Helper function to format date as YYYY-MM-DD
const formatDate = (date) => {
  return new Date(date).toISOString().split('T')[0];
};


    const addClient = async (req, res) => {
  try {
    const { name, email, phone, packageName, packageDuration } = req.body;
    const userId = req.user.id;

    // Validation
    if (!packageName || !packageDuration) {
      return res.status(400).json({
        status: "fail",
        message: "Package name and duration are required"
      });
    }

    // Check for existing client
    const existingClient = await Client.findOne({ email, createdBy: userId });
    if (existingClient) {
      return res.status(409).json({
        status: "fail",
        message: "Client with this email already exists",
      });
    }

    // Calculate dates
    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);
    const expiryDate = new Date(currentDate);
    expiryDate.setDate(currentDate.getDate() + Number(packageDuration) + 1);

    // Create client
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

    // Generate PDF
    let pdfResponse;
    try {
      pdfResponse = await generateClientPDF(client, {
        packageName,
        packageDuration
      });

      // Update client with PDF info
      client.registrationPdf = {
        path: pdfResponse.pdfPath,
        fileName: pdfResponse.fileName,
        generatedAt: new Date()
      };
      await client.save();
    } catch (pdfError) {
      console.error('PDF generation failed:', pdfError);
      // Continue even if PDF fails - don't fail the whole operation
    }

    // Update user's client list
    await User.findByIdAndUpdate(
      userId,
      { $push: { clients: client._id } },
      { new: true }
    );

    // Email the PDF if generation was successful
    if (pdfResponse && client.email) {
      try {
        await sendEmailWithAttachment({
          to: client.email,
          subject: `Your ${packageName} Registration Confirmation`,
          text: `Dear ${client.name},\n\nAttached is your registration confirmation.`,
          attachments: [{
            filename: `Registration_${client.name}.pdf`,
            path: pdfResponse.fullPath
          }]
        });
      } catch (emailError) {
        console.error('Failed to send email:', emailError);
      }
    }

    // Prepare response
    const response = {
      status: "success",
      message: "Client added successfully",
      client: {
        ...client.toObject(),
        createdAt: formatDate(client.createdAt),
        packageStatus: {
          ...client.packageStatus,
          expiryDate: formatDate(client.packageStatus.expiryDate)
        }
      }
    };

    if (pdfResponse) {
      response.pdfUrl = pdfResponse.pdfPath;
      response.pdfDownload = `/api/clients/${client._id}/download-pdf`;
    }

    res.status(201).json(response);

  } catch (error) {
    console.error("Add client error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to add client",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Add this to your exports
const downloadClientPDF = async (req, res) => {
  try {
    const { clientId } = req.params;
    const client = await Client.findById(clientId);


    console.log("pdf download controller find cient : ", client);
    
    if (!client || !client.registrationPdf) {
      return res.status(404).json({
        status: "fail",
        message: "PDF not found for this client"
      });
    }
    
    const filePath = path.join(__dirname, `../public${client.registrationPdf.path}`);
    
    console.log("pdf download controller file path : ", filePath);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        status: "fail",
        message: "PDF file not found"
      });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=${client.registrationPdf.fileName}`
    );

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error("PDF download error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to download PDF"
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
           createdAt: formatDate(updated.createdAt),
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
           createdAt: formatDate(updated.createdAt),
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

const deleteClient = async (req, res) => {
  try {
    const { clientId } = req.params;
    const userId = req.user.id;

    // 1. Check if client exists at all
    const clientExists = await Client.exists({ _id: clientId });
    if (!clientExists) {
      return res.status(404).json({
        status: "fail",
        message: "Client not found"
      });
    }

    // 2. Check if client belongs to this user
    const client = await Client.findOne({
      _id: clientId,
      createdBy: userId
    });

    if (!client) {
      return res.status(403).json({
        status: "fail",
        message: "You don't have permission to delete this client"
      });
    }

    // 3. Remove client from User's clients array
    await User.findByIdAndUpdate(
      userId,
      { $pull: { clients: clientId } },
      { new: true }
    );

    // 4. Delete the client document
    await Client.findByIdAndDelete(clientId);

    res.status(200).json({
      status: "success",
      message: "Client deleted successfully",
      deletedClient: {
        id: client._id,
        name: client.name,
        email: client.email
      }
    });

  } catch (error) {
    console.error("Delete client error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to delete client"
    });
  }
};

module.exports = { 
  addClient, 
  getClients,
  getClientsByStatus,
  deleteClient,
  downloadClientPDF
};
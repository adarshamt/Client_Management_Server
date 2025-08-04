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

  console.log("delte client check");
  try {
    const { clientId } = req.params;
    console.log("delte client check client id", clientId)
    const userId = req.user.id;
    console.log("delte client check user id", userId)



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
const updateClient = async (req, res) => {
  console.log("updated client controller !!!!!!!!!!!!");
  
  try {
    const { clientId } = req.params;
    const userId = req.user.id;
    const { name, email, phone, packageName, packageDuration } = req.body;

    // 1. Find the client and verify ownership
    const client = await Client.findOne({
      _id: clientId,
      createdBy: userId
    });

    if (!client) {
      return res.status(404).json({
        status: "fail",
        message: "Client not found or you don't have permission to edit"
      });
    }

    // 2. Validate input
    if (!name || !email || !phone) {
      return res.status(400).json({
        status: "fail",
        message: "Name, email and phone are required fields"
      });
    }

    // 3. Check if email is being changed to one that already exists
    if (email !== client.email) {
      const emailExists = await Client.findOne({ 
        email, 
        createdBy: userId,
        _id: { $ne: clientId } // Exclude current client
      });
      
      if (emailExists) {
        return res.status(409).json({
          status: "fail",
          message: "Another client with this email already exists"
        });
      }
    }

    // 4. Prepare update data
    const updateData = {
      name,
      email,
      phone,
      updatedAt: new Date()
    };

    // 5. Handle package changes if provided
    if (packageName || packageDuration) {
      const currentPackageStatus = client.packageStatus;
      let isPackageChanged = false;

      // If package name changed
      if (packageName && packageName !== client.packageName) {
        updateData.packageName = packageName;
        isPackageChanged = true;
      }

      // If duration changed
      if (packageDuration && packageDuration !== client.packageDuration) {
        updateData.packageDuration = packageDuration;
        isPackageChanged = true;

        // Recalculate expiry date if duration changed
        const currentDate = new Date();
        currentDate.setHours(0, 0, 0, 0);
        const expiryDate = new Date(currentDate);
        expiryDate.setDate(currentDate.getDate() + Number(packageDuration) + 1);

        updateData.packageStatus = {
          isActive: true,
          daysRemaining: packageDuration,
          expiryDate
        };
      }

      // If package changed, generate new PDF
      if (isPackageChanged) {
        try {
          const pdfResponse = await generateClientPDF(
            { ...client.toObject(), ...updateData },
            { packageName: packageName || client.packageName, packageDuration: packageDuration || client.packageDuration }
          );

          updateData.registrationPdf = {
            path: pdfResponse.pdfPath,
            fileName: pdfResponse.fileName,
            generatedAt: new Date()
          };

          // Send email with updated PDF if generation was successful
          if (pdfResponse && client.email) {
            try {
              await sendEmailWithAttachment({
                to: client.email,
                subject: `Updated ${packageName || client.packageName} Registration`,
                text: `Dear ${name},\n\nAttached is your updated registration confirmation.`,
                attachments: [{
                  filename: `Updated_Registration_${name}.pdf`,
                  path: pdfResponse.fullPath
                }]
              });
            } catch (emailError) {
              console.error('Failed to send update email:', emailError);
            }
          }
        } catch (pdfError) {
          console.error('PDF generation failed during update:', pdfError);
          // Continue without failing the operation
        }
      }
    }

    // 6. Apply updates
    const updatedClient = await Client.findByIdAndUpdate(
      clientId,
      updateData,
      { new: true, runValidators: true }
    );

    // 7. Format response
    const response = {
      status: "success",
      message: "Client updated successfully",
      client: {
        ...updatedClient.toObject(),
        createdAt: formatDate(updatedClient.createdAt),
        updatedAt: formatDate(updatedClient.updatedAt),
        packageStatus: {
          ...updatedClient.packageStatus,
          expiryDate: formatDate(updatedClient.packageStatus.expiryDate)
        }
      }
    };

    if (updateData.registrationPdf) {
      response.pdfUrl = updateData.registrationPdf.path;
      response.pdfDownload = `/api/clients/${clientId}/download-pdf`;
    }

    res.status(200).json(response);

  } catch (error) {
    console.error("Update client error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to update client",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = { 
  addClient, 
  getClients,
  getClientsByStatus,
  deleteClient,
  downloadClientPDF,
  updateClient
};
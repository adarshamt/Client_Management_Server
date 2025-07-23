// middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const User = require('../Model/userSchema');
const Client = require('../Model/clientSchema');

const JWT_SECRET = process.env.JWT_SECRET;

// 1. Authentication Middleware (Verify JWT)
exports.authenticate = async (req, res, next) => {

  console.log(" hit the middleware !!!");
  console.log(" hit the middleware headder !!!", req.header('Authorization'));
  
  try {
    // Get token from header
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ 
        status: "fail",
        message: "No token provided" 
      });
    }

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({ 
        status: "fail",
        message: "User not found" 
      });
    }

    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    console.error("Authentication error:", error);
    res.status(401).json({ 
      status: "fail",
      message: "Not authorized" 
    });
  }
};

// 2. Authorization Middleware (Check Client Ownership)
exports.authorizeClientAccess = async (req, res, next) => {
  try {
    const clientId = req.params.clientId || req.body.clientId;
    const client = await Client.findById(clientId);

    if (!client) {
      return res.status(404).json({
        status: "fail",
        message: "Client not found"
      });
    }

    // Check if client belongs to requesting user
    if (client.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        status: "fail",
        message: "Not authorized to access this client"
      });
    }

    req.client = client;
    next();
  } catch (error) {
    console.error("Authorization error:", error);
    res.status(500).json({
      status: "error",
      message: "Authorization check failed"
    });
  }
};

// 3. Admin Middleware (Optional)
exports.requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      status: "fail",
      message: "Admin access required"
    });
  }
  next();
};
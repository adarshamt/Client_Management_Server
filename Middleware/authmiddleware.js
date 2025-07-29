// middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const User = require('../Model/userSchema');
const Client = require('../Model/clientSchema');

const JWT_SECRET = process.env.JWT_SECRET;





if (!JWT_SECRET) {
  console.error('FATAL ERROR: JWT_SECRET is not defined.');
  process.exit(1);
}

// 1. Authentication Middleware (Verify JWT)
exports.authenticate = async (req, res, next) => {
  console.log("--------------- hit auth middleware -----------");
  
  try {
    // Get token from header (multiple possible locations)
    let token;
    const authHeader = req.header('Authorization');
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
      console.log("Extracted token from Authorization header:", token);
    } else if (req.cookies?.token) {
      token = req.cookies.token;
      console.log("Extracted token from cookies");
    }

    if (!token) {
      console.warn("No token provided in request");
      return res.status(401).json({ 
        status: "fail",
        message: "Authentication required. Please log in." 
      });
    }

    // Verify token with explicit algorithm and full error handling
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    console.log("Decoded token payload:", decoded);

    // Verify token structure
    if (!decoded.id || !decoded.iat) {
      console.error("Malformed token payload:", decoded);
      throw new jwt.JsonWebTokenError("Invalid token structure");
    }

    // Check user exists
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      console.error("User not found for ID:", decoded.id);
      return res.status(401).json({ 
        status: "fail",
        message: "User account not found" 
      });
    }

    // Attach user to request
    req.user = user;
    console.log("Authentication successful for user:", user.email);
    next();
  } catch (error) {
    console.error("Authentication error details:", {
      name: error.name,
      message: error.message,
      stack: error.stack
    });

    let status = 401;
    let message = "Authentication failed";

    if (error instanceof jwt.JsonWebTokenError) {
      if (error.message.includes('signature')) {
        message = "Invalid token signature. Possible secret mismatch or tampering.";
        console.error("JWT Secret used:", JWT_SECRET);
      } else if (error.message.includes('malformed')) {
        message = "Malformed token format";
      }
    } else if (error instanceof jwt.TokenExpiredError) {
      status = 403;
      message = "Session expired. Please log in again.";
    }

    res.status(status).json({ 
      status: "fail",
      message,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 2. Authorization Middleware (Check Client Ownership)
exports.authorizeClientAccess = async (req, res, next) => {
  try {
    console.log("--------------- hit authorization middleware -----------");
    
    const clientId = req.params.clientId || req.body.clientId;
    if (!clientId) {
      return res.status(400).json({
        status: "fail",
        message: "Client ID not provided"
      });
    }

    const client = await Client.findById(clientId);
    if (!client) {
      return res.status(404).json({
        status: "fail",
        message: "Client not found"
      });
    }

    // Verify ownership
    if (client.createdBy.toString() !== req.user._id.toString()) {
      console.warn(`User ${req.user._id} attempted to access client ${clientId} owned by ${client.createdBy}`);
      return res.status(403).json({
        status: "fail",
        message: "Not authorized to access this client"
      });
    }

    req.client = client;
    next();
  } catch (error) {
    console.error("Authorization error:", {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      status: "error",
      message: "Authorization check failed",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 3. Admin Middleware (Enhanced)
exports.requireAdmin = (req, res, next) => {
  console.log("--------------- hit admin check middleware -----------");
  
  if (!req.user.role || req.user.role !== 'admin') {
    console.warn(`Non-admin user ${req.user._id} attempted admin access`);
    return res.status(403).json({
      status: "fail",
      message: "Administrator privileges required",
      requiredRole: "admin",
      yourRole: req.user.role || "none"
    });
  }
  next();
};
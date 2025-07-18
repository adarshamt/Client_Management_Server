

const userModel = require ("../Model/userSchema");

const bcrypt = require ('bcryptjs')
const jwt = require("jsonwebtoken")
require('dotenv').config();


const JWT_Secret = process.env.JWT_SECRET
// const JWT_Secret = process.env.MONGO_URI
const JWT_Expiers = process.env.JWT_EXPIRES_IN
console.log("jwt ", JWT_Expiers,JWT_Secret)
 const userRegister = async (req,res)=>{

    console.log("user register controller")

    try {

        const {name , phone , email , password} = req.body

          const existingUser = await userModel.findOne({ email });

    if (existingUser) {
      return res.status(409).json({
        status: "fail",
        message: "User already registered with this email",
      });
    }
 // Hash the password before saving
    const salt = await bcrypt.genSalt(10); // Generate salt
    // console.log("salted passwod :", salt)
    const hashedPassword = await bcrypt.hash(password, salt); // Hash password


        const user =new userModel({
            name:name,
            phone : phone,
            email : email,
            password : hashedPassword
        })

        await user.save();

        // Generate JWT token
        const JWT_token = jwt.sign(
            { id: user._id, email: user.email },
            JWT_Secret,
            { expiresIn: JWT_Expiers }
        );


        console.log(user._id,"user id from mongodb ")
         res.status(200).json({
      status: "success",
      message: " user registred successfully",
       Token:JWT_token,
         user: {
        name: user.name,
        email: user.email,
        phone: user.phone,
      },

    });
        
    } catch (error) {

        console.error("Registration error:", error);
        res.status(500).json({
            message:"User registarion failed "
        })
    }
}


const userSignin = async (req, res) => {

    console.log("controll sign in")

  try {
    const { username, password } = req.body;

    console.log("controll sign in username",username)
  
    const user = await userModel.findOne({
      $or: [{ email: username }, { phone: username }],
    });

    if (!user) {
      return res.status(404).json({
        status: "fail",
        message: "User not found",
      });
    }
   const checkPassword = await bcrypt.compare(password,user.password)

    if (!checkPassword) {
      return res.status(401).json({
        status: "fail",
        message: "Incorrect password",
      });
    }


    res.status(200).json({
      status: "success",
      message: "User signed in successfully",
      Token:JWT_token,
      user: {
        name: user.name,
        email: user.email,
        phone: user.phone,
      },
    });
  } catch (error) {

    console.error("Signin error:", error);
    res.status(500).json({
      status: "error",
      message: "User signin failed",
    });
  }
};





module.exports = {userRegister,userSignin};


const userModel = require ("../Model/userSchema")

 const userRegister =(req,res)=>{

    console.log("user register controller")

    try {

        const {name , phone , email , password} = req.body


        const user =new userModel({
            name:name,
            phone : phone,
            email : email,
            password : password
        })
        
    } catch (error) {
        res.status(500).json({
            message:"User registarion failed"
        })
    }
}







module.exports = {userRegister}
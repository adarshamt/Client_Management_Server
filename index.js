const express = require('express')
const app = express()
const port = 4000
const mongoose = require('mongoose');
const cors = require('cors');
const { userRegister,userSignin } = require('./Controller/userController');
require('dotenv').config();

const {authenticate } = require('./Middleware/authmiddleware');
const { addClient,getClients } = require('./Controller/clientController');

app.use(express.json());
app.use(cors());

app.get('/', (req, res) => {
  res.send('Hello World! ')
})

app.post("/usersignup",userRegister);
app.post("/userlogin",userSignin);
app.post("/addclient",authenticate,addClient);
app.get("/getclients",authenticate,getClients);

const MONGO_URI = process.env.MONGO_URI;

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB Connected');
  } catch (err) {
    console.error('❌ MongoDB Connection Error:', err);
    process.exit(1);
  }
}

connectDB();




app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})

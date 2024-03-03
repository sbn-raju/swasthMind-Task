//NPM PACKAGES
const express = require('express');
const app = express();
const ejs = require('ejs');
const path = require('path');
// const bcrypt = require('bcrypt');
const validationResult  = require('express-validator');
const sanitizeHtml = require('sanitize-html');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const  Pool  = require('pg').Pool;
const dotenv = require('dotenv')
require('dotenv').config()




// Rate limiting middleware
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later'
});




//MIDDLEWARE
// Apply the rate limiter to all requests
app.use(limiter);
app.set("views engine" ,"ejs");
app.set("views", path.join(__dirname,"views"));
app.use(express.urlencoded({extended:true}));

//VALIDATING AND SANITIZINIG
const validateAndSanitize = (req, res, next) => {
    // Validate inputs
    body('username').trim().isLength({ min: 1 }).escape(),
    body('password').trim().isLength({ min: 1 }).escape(),
    // Sanitize inputs
    body('username').trim().escape(),
    body('password').trim().escape(),
    // Check for validation errors
        errors = validationResult(req);
        if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
        }
  
    next();
  };

// Database connection
const pool = new Pool({
    user:"postgres",
    host:"localhost",
    database:process.env.PSQL_DB,
    password:process.env.PSQL_PASS,
    port:5432,
});
pool.connect()
  .then(() => {
    console.log("Connected to Student database");
  })
  .catch((err) => {
    console.error("Error connecting to  database:", err.message);
  });

// const createTableQuery = `
// CREATE TABLE IF NOT EXISTS users (
//   id SERIAL PRIMARY KEY,
//   username VARCHAR(255) UNIQUE NOT NULL,
//   password VARCHAR(255) NOT NULL,
//   role VARCHAR(50) NOT NULL
// );
// `;
// pool.query(createTableQuery);
//This command to run only once to create the DataBAse TAble

// Helper function to generate JWT
const generateToken = (user) => {
  return jwt.sign({ username: user.username, role: user.role }, process.env.JWT_SECRET);
};

// Routes

//INDEX ROUTE
app.get('/',(req,res)=>{
    res.render('index.ejs');
});

//REGISTER ROUTE
app.get('/register',(req,res)=>{
    res.render("register.ejs");
});
app.post('/register',validateAndSanitize, async (req, res) => {
  const { username, password, role } = req.body;
  // Hash password
//const hashedPassword = await bcrypt.hash(password, 10);
  // Insert user into database
  const insertQuery = 'INSERT INTO users (username, password, role) VALUES ($1, $2, $3) RETURNING *';
  const values = [username, password, role];

  try {
    const result = await pool.query(insertQuery, values);
    const user = result.rows[0];
    const token = generateToken(user);
    res.status(201).json({ 
        message: 'User created successfully please logout and login again', 
        token 
    });
  } catch (err) {
    res.status(500).json({ 
        message: 'Internal server error' 
    });
  }
});
// LOGIN ROUTES
app.get('/login',(req,res)=>{
    res.render("login.ejs");
});
app.post('/login', validateAndSanitize,async (req, res) => {
    const { username, password,role } = req.body;
  
    // Check if the user exists in the database
    const userQuery = 'SELECT * FROM users WHERE username = $1';
    const userValues = [username];
  
    try {
      const result = await pool.query(userQuery, userValues);
      const user = result.rows[0];
  
      if (!user) {
        return res.status(401).json({ message: 'Invalid username or password' });
      }
  
      // Verify the password
      const validPassword = ()=>{if(password === user.password){
            return true;
      }};
  
      if (!validPassword) {
        return res.status(401).json({ message: 'Invalid username or password' });
      }
      // Generate JWT token
      const token = generateToken(user);
    //Authization
      if(role === "admin"){
        res.render("indexadmin.ejs");
      }
      else if(role === "user"){
        res.render("indexuser.ejs");
      }
    } catch (err) {
      res.status(500).json({
         message: 'Internal server error'
         });
    }
  });
  // Logout endpoint (optional)
  app.post('/logout', (req, res) => {
    res.status(200).json({ message: 'Logout successful' });
  });


//CRUD Operations
app.post('/operation',(req,res)=>{
    let{ops} = req.body;
    // console.log(ops);
    if(ops==="Read"){
        res.redirect('/getStudents');
    }
    else if(ops==="Create"){
        res.redirect("/setStudent");
    }
    else if(ops==="Update"){
        res.redirect("/updateStudent");
    }
    else if(ops==="Delete"){
        res.redirect("/deleteStudent");
    }

});


//Read route
app.get('/getStudents',(req,res)=>{
    pool.query("select * from student", (err, result) => {
        if (err) {
            console.error(err);
        } else {
            let singleStudent = result.rows;
            res.render("getStudents.ejs", { singleStudent });
        }
    });
});


//Create Route
app.get("/setStudent",(req,res)=>{
    res.render("setStudent.ejs");
});

app.post("/setStudent",async(req,res)=>{
    let{name, age} = req.body;
    try {
        const client = await pool.connect();
        const query = 'INSERT INTO student (name, age) VALUES ($1, $2)';
        const values = [name, age];
        await client.query(query, values);
        client.release();
        res.send("Data Updated to Database"); 
    } catch (err) {
        console.error('Error executing query', err);
        res.status(500).send('Error inserting data');
    }
});


//Delete Route
app.get("/deleteStudent",(req,res)=>{
    pool.query("select * from student", (err, result) => {
        if (err) {
            console.error(err);
        } else {
            let singleStudent = result.rows;
            res.render("deleteStudent.ejs",{ singleStudent });
        }
    });
});
app.get("/deleteStudent/:id",async(req,res)=>{
        const studentId = req.params.id;
        const client = await pool.connect();
        try {
        await client.query('DELETE FROM student WHERE id = $1', [studentId]);
        res.send('Student deleted successfully');
        } finally {
        client.release();
        }
});


//Update Route
app.get("/updateStudent",(req,res)=>{
    pool.query("select * from student", (err, result) => {
        if (err) {
            console.error(err);
        } else {
            let singleStudent = result.rows;
            res.render("updateStudent.ejs",{ singleStudent });
        }
    });
});

app.get("/updateStudent/:id",(req,res)=>{
    let studentId = req.params.id;
    pool.query("select * from student WHERE id = $1",[studentId], (err, result) => {
        if (err) {
            console.error(err);
        } else {
            let singleStudent = result.rows[0];
            res.render("update.ejs",{ singleStudent });
        }
    });
});

app.post("/update",async(req,res)=>{
    let{id ,name, age} = req.body;
    const client = await pool.connect();
  try {
    const result = await client.query('UPDATE student SET name = $1, age = $2 WHERE id = $3 RETURNING *', [name, age, id]);
    return result.rows[0]; 
  } finally {
    client.release();
    res.redirect("/updateStudent");
  }
});

app.listen(process.env.PORT, () => {
    console.log(`Server running on port`);
  });
  




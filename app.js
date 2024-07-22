const express = require('express')
const path = require('path')
const userModel = require('./models/user')
const postModel = require('./models/post')
const cookieParser = require('cookie-parser')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcrypt')
const app = express()

app.use(cookieParser())
app.use(express.json())
app.use(express.urlencoded({ extended:true }))
app.use(express.static(path.join(__dirname,'public')))

app.set('view engine','ejs')

app.get('/', (req , res)=>{
    res.send('hey')
})

// rendering signup page
app.get('/signup', (req, res)=>{
    res.render('signup')
})

// rendering login page
app.get('/login', (req, res)=>{
    res.render('login' , { wrongPW : false , wrongEmail : false })
})

// creating a new user in DB when user sign's up and also saving a JWT token as cookie in their browser
app.post('/createUser' ,async (req , res)=>{
    
    const { name , age , email , username , password } = req.body

    let user = await userModel.findOne({email})           // to check whether any other user exist with the same email
    if( user ){
        res.status(500).send('User already exist')
    }else{

        bcrypt.genSalt( 10 , (err, salt)=>{
            bcrypt.hash( password , salt , async (err, hash)=>{

                let newUser = await userModel.create({
                    name ,
                    age , 
                    email ,
                    username ,
                    password : hash
                })

                console.log('new user created : ', newUser)
                let token = jwt.sign( {email : email , userId : newUser._id} , 'secretCode')
                res.cookie('token', token)
                res.send('account created')
            })
        })
    }
})

// logging in the user by saving a jwt token as a cookie in their browser
app.post('/loginUser' , async (req, res)=>{

    const { email , password } = req.body

    let user = await userModel.findOne({email})
    if( !user ){
        res.render('login' ,{ wrongPW : false , wrongEmail : true } )
    }else{

        bcrypt.compare( password , user.password , ( err, result)=>{       //checking the password

            if( result ){

                console.log('logged In user : ', user)
                let token = jwt.sign( {email : user.email , userId : user._id} , 'secretCode')
                res.cookie('token', token)
                res.status(200).redirect('/profile')

            }else{
                res.render('login' ,{ wrongPW : true , wrongEmail : false })
            }
        })
    }
})

// by logging out, we remove the jwt token saved in their browser and redirects to login page.
app.get('/logout', (req, res)=>{
    res.cookie('token','')
    res.redirect('/login')
})

// rendering profile page after logging in. ( it is protected by a middleware function (isLoggedIn) 
// to check for a valid user loggedIn or not by verify jwt token saved as cookie )

app.get('/profile', isLoggedIn , async (req,res)=>{
    
    const user = await userModel.findOne({ _id : req.user.userId })
    res.render('profile',{ user })
})

// middleware to check whether user have their JWT token
function isLoggedIn( req , res , next ){
    
    if(req.cookies.token === ''){
        res.redirect('/login')
        next()
    }
    else{
        let cookieData = jwt.verify(req.cookies.token , 'secretCode')
        req.user = cookieData
        next()
    }
}


//server listenning in port 3000
app.listen( 3000, (err)=>{
    console.log('Server listenning on port 3000 ...')
})
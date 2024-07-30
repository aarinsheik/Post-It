const express = require('express')
const path = require('path')
const userModel = require('./models/user')
const postModel = require('./models/post')
const cookieParser = require('cookie-parser')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcrypt')
const multer = require('multer')
const fs = require('fs');
const app = express()

app.use(cookieParser())
app.use(express.json())
app.use(express.urlencoded({ extended:true }))
app.use(express.static(path.join(__dirname,'public')))

app.set('view engine','ejs')


app.get('/', (req , res)=>{
    try{
        res.render('homepage')
    }
    catch (err){
        console.log('error in uploading post',err)
        res.redirect('/error')
    }
    // res.send('hey. This is Post it')
})

app.get('/error', (req , res)=>{
    res.render('error')
})

//handling multer to upload images:

const Storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, './public/uploads')
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
      const ext = path.extname(file.originalname);                                   // Extract file extension
      cb(null, file.fieldname + '-' + uniqueSuffix + ext);                           // Append extension
    }
  })
  
  const upload = multer({ 
    storage: Storage,
    fileFilter: function (req, file, cb) {
        const allowedTypes = /jpeg|jpg|png|heic/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = ['image/jpeg', 'image/jpg', 'image/png', 'image/heic', 'application/octet-stream'].includes(file.mimetype);
    
        if (extname && mimetype) {
          return cb(null, true);
        } else {
          console.log(extname , mimetype , file )
          cb(new Error('Error: Images only!'));
        }
      }
    
   })

// Uploads user post by saving it in post-model and updates the post ID in user-model's post-array
app.post('/createPost', isLoggedIn , upload.single('image'), async (req, res, next)=>{
    
    try{
        // req.file is the `avatar` file
        // req.body will hold the text fields, if there were any
        const uploaderId = req.user.userId
        // create a document of post in post-model
        const createdPost = new postModel({
            user : uploaderId,
            caption : req.body.caption,
            image : { data:req.file.filename, contentType : 'image/jpg'}
        })
        await createdPost.save()

        // Update the user's posts array
        const postUploadedUser = await userModel.findByIdAndUpdate(
            {_id : uploaderId },
            { $push: { post : createdPost._id } },              // Add the new post's ID to the user's posts array
            { new: true }                                       // Return the updated user document
        );

        res.status(200).redirect('/profile')
    }
    catch (err){
        console.log('error in uploading post',err)
        res.redirect('/error')
    }
  })


// rendering signup page
app.get('/signup', (req, res)=>{
    try{
        res.render('signup')
    }
    catch (err){
        console.log(err)
        res.redirect('/error')
    }
})

// rendering login page
app.get('/login', (req, res)=>{
    try{
        res.render('login' , { wrongPW : false , wrongEmail : false })
    }
    catch (err){
        console.log(err)
        res.redirect('/error')
    }
})

// creating a new user in DB when user sign's up and also saving a JWT token as cookie in their browser
app.post('/createUser' ,async (req , res)=>{
    
    try{
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
                    res.status(200).redirect('/profile')
                })
            })
        }
        
    }
    catch (err){
        console.log(err)
        res.redirect('/error')
    }
})

// logging in the user by saving a jwt token as a cookie in their browser
app.post('/loginUser' , async (req, res)=>{

    try{
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
    }
    catch (err){
        console.log(err)
        res.redirect('/error')
    }
})

// by logging out, we remove the jwt token saved in their browser and redirects to login page.
app.get('/logout', (req, res)=>{
    try{
        res.cookie('token','')
        res.redirect('/login')
    }
    catch (err){
        console.log(err)
        res.redirect('/error')
    }
})

// rendering profile page after logging in. ( it is protected by a middleware function (isLoggedIn) 
// to check for a valid user loggedIn or not by verify jwt token saved as cookie )

app.get('/profile', isLoggedIn , async (req,res)=>{
    
    try{
        const user = await userModel.findOne({ _id : req.user.userId })          
        const otherUser = await userModel.find({ _id: { $ne: req.user.userId } })
        const userPosts = await postModel.find({ user:  req.user.userId });
        res.render('profile',{ user , otherUser, userPosts })
    }
    catch (err){
        console.log(err)
        res.redirect('/error')
    }
})

// rendering update page to edit user Details :
app.get('/editUserProfile', isLoggedIn , async (req, res)=>{

    try{
        const editUserId = req.user.userId
        const user = await userModel.findOne({_id : editUserId})
        res.render('edit', {user})
    }
    catch (err){
        console.log(err)
        res.redirect('/error')
    }
})

// to update the user edit details in user-model and redirect to profile page
app.post('/editUser', isLoggedIn , async (req, res)=>{  
    
    try{
        const editUserId = req.user.userId
        const { name , age , username } = req.body
        console.log( req.body )
    
        const editedUser = await userModel.findOneAndUpdate(
            { _id : editUserId },
            {
                name ,
                age ,
                username
            },
            { new:true }
        )
    
        res.redirect('/profile')
    }
    catch (err){
        console.log(err)
        res.redirect('/error')
    }
})

// to delete the users account 
app.get('/deleteUserProfile', isLoggedIn , async (req, res)=>{

    try{
        const deleteUserId = req.user.userId
        const deletedUser = await userModel.findOneAndDelete({_id : deleteUserId} , {new:true})
        console.log('Deleted User : ', deletedUser)
        res.cookie.token = ''
        res.redirect('/signup')
    }
    catch (err){
        console.log(err)
        res.redirect('/error')
    }
})

// delete posts and redirects profile page :
app.get('/deletePost/:postId', async (req, res)=>{
    try{
        const post = await postModel.findOne({_id : req.params.postId })

        await userModel.findByIdAndUpdate(post.user, {
            $pull: { post: post._id }                             // Remove post ID from user's post array
        });

        const deletedPost = await postModel.findOneAndDelete({_id : req.params.postId} , {new:true})
        console.log('deleted post', deletedPost )

        // Delete the image file associated with the post
        if (post.image && post.image.data) {
            
            const imagePath = path.join(__dirname, 'public/uploads', `${post.image.data}`);
            fs.unlink(imagePath, (err) => {
                if (err) console.error('Failed to delete image:', err);
            });
        }

        res.redirect('/profile')
    }
    catch(err){
        console.log(err)
        res.redirect('/error')
    }
})

//like the post and update in post model's likes array
app.get('/likePost/:postId' , isLoggedIn , async (req, res)=>{

    try{
        const likerId = req.user.userId                  // gets the likerId from the isLoggedIn middleware function
        const postId = req.params.postId
    
        const likedPost = await postModel.findByIdAndUpdate(
            {_id : postId },
            { $push: { likes : likerId } },             
            { new: true }                                       
        ); 

        console.log('liked post :' , likedPost)

        const referer = req.get('referer');            // this will get the route from which the request arrived. hence, we can route to same page.
        res.redirect(referer)
    }
    catch(err){
        console.log(err)
        res.redirect('/error')
    }
})

// unliking the post 
app.get('/unLikePost/:postId' , isLoggedIn , async (req, res)=>{

    try{
        const likerId = req.user.userId
        const postId = req.params.postId
    
        const likedPost = await postModel.findByIdAndUpdate(
            {_id : postId },
            { $pull: { likes : likerId } },             
            { new: true }                                       
        ); 

        console.log('unliked post :' , likedPost)

        const referer = req.get('referer');            // this will get the route from which the request arrived. hence, we can route to same page.
        res.redirect(referer)
    }
    catch(err){
        console.log(err)
        res.redirect('/error')
    }
})

//View Others Profile
app.get('/othersProfile/:otherUserId' , isLoggedIn ,  async (req, res)=>{
    try{
        const othersProfileId = req.params.otherUserId 
        const userId = req.user.userId 
        
        console.log('other Id ; ',othersProfileId)
        
        const otherUserPosts = await postModel.find({ user : othersProfileId });
        const othersProfile = await userModel.findOne({_id : othersProfileId })
        const otherUser = await userModel.find({ _id: { $nin: [userId, othersProfileId] } });   // this will send only those users which are none other than user itself and user who's profile is been viewed

        res.render( 'othersProfile', { othersProfile , otherUserPosts , otherUser , userId } )

    } 
    catch(err){
        console.log('err in others profile page : \n', err)
        res.redirect('/error')
    }
}) 

// middleware to check whether user have their JWT token
function isLoggedIn( req , res , next ){
    
    if( !req.cookies.token ){
        res.redirect('/login')
    }
    else{
        let cookieData = jwt.verify(req.cookies.token , 'secretCode')
        req.user = cookieData                                              // req.user will contain : {email : user.email , userId : user._id}
        next()
    }
}

const PORT = process.env.PORT || 9001

//server listenning in port 3000
app.listen( PORT, (err)=>{
    console.log(`Server listenning on port ${PORT} ...\n\
        homepage - http://localhost:${PORT} \n\
        signup - http://localhost:${PORT}/signup \n\
        login - http://localhost:${PORT}/login `)
})
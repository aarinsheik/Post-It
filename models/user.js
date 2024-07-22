const mongoose = require('mongoose')

mongoose.connect('mongodb://localhost:27017/post-it')

const userSchema = mongoose.Schema({
    name : String,
    age : Number,
    email : String,
    username : String,
    password : String,
    post : [
        { 
            type : mongoose.Schema.Types.ObjectId ,
            ref : 'post'
        }
    ]
})

module.exports = mongoose.model('user', userSchema )
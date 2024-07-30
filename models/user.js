const mongoose = require('mongoose');

const uri = 'mongodb+srv://aarinsheikm:9148530299Aar%23@aarinsheik.tila8ez.mongodb.net/Post-It?retryWrites=true&w=majority&appName=aarinsheik';

const options = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 30000, // 30 seconds
    socketTimeoutMS: 45000           // 45 seconds
};

mongoose.connect(uri, options)
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error('MongoDB connection error:', err));

const userSchema = new mongoose.Schema({
    name: String,
    age: Number,
    email: String,
    username: String,
    password: String,
    post: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'post'
        }
    ]
});

module.exports = mongoose.model('user', userSchema);

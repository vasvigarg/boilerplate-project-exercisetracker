require('dotenv').config();
const express = require('express');
const mongo = require('mongodb');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors')
const app = express()

app.use(cors())
app.use(express.json());
app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});
app.use(bodyParser.urlencoded({extended: false}));

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})

const URI = process.env.MONGO_URI;

mongoose.connect(URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000
})

const connection = mongoose.connection;
connection.on('error', console.error.bind(console, "connection error: "));
connection.once('open', () => {
  console.log("database connection established successfully");
})

const Schema = mongoose.Schema;

const exerciseSchema = new Schema({
  userId: { type: String, required: true },
  description: { type: String, required: true },
  duration: { type: Number, min: 1, required: true },
  date: { type: Date, default: Date.now }
})

const userSchema = new Schema({
  username: { type: String, unique: true, required: true }
})

let Exercise = mongoose.model('Exercise', exerciseSchema);
let User = mongoose.model('User', userSchema);

app.post("/api/users", (req, res) => {
  if (req.body.username === '') {
    return res.json({error: 'username is required'});
  }
  
  let username = req.body.username;
  
  User.findOne({username: username}, (err, data) => {
      if (!err & data === null) {
        let newUser = new User({ username: username});
        newUser.save(function (err, data) {
          if (!err) {
            let _id = data['_id'];
            return res.json({
              username: username,
              _id: _id
            });
          }
        });
      } else {
        res.json("username already exists");
      } 
  });
});


app.get('/api/users', function (req, res) {
  User.find({}, function (err, data) {
      if (!err) {
        return res.json(data);
      }
  })
})


app.post('/api/users/:_id/exercises', async function (req, res) {
  
  if (req.params._id === '0') {
    return res.json({ error: '_id is required' });
  }

  if (req.body.description === '') {
    return res.json({ error: 'description is required' });
  }

  if (req.body.duration === '') {
    return res.json({ error: 'duration is required' });
  }

  let userId = req.params._id;
  let description = req.body.description;
  let duration = req.body.duration;

  let date;
  
  if (req.body.date) {
    const str = req.body.date.split("-");
    date =new Date(str[0], str[1] - 1, str[2])
  } else {
    date = new Date()
  }
  
  if (isNaN(duration)) {
    return res.json({error: 'duration is not a number'});
  }

  if (date == "Invalid Date") {
    return res.json({error: 'Invalid date'});
  }  

  const findOne = await User.findById(userId);
  
  User.findById(userId, async function (err, data) {
    if (!err && data !== null) {
      let newExercise = new Exercise({
        userId: userId,
        description: description,
        duration: duration,
        date: date
      })

      await newExercise.save();
      
    } else {
      return res.json({error: 'username not found'});
    }
  })
        
  res.send({
    _id: findOne._id,
    username: findOne.username,
    description: description,
    duration: +duration,
    date: date.toDateString()           
  }) 
}) 

app.get('/api/users/:_id/exercises', function (req, res) {
  res.redirect('/api/users/' + req.params._id + '/logs');
})


app.get('/api/users/:_id/logs', async (req, res) => {
  let userId = req.params._id;
  let user = await User.findById(userId);
  
  if (user == null) {
    return res.json({ error: "username not found" })
  }

  let [fromDate, toDate, limit] = [req.query.from, req.query.to, req.query.limit];

  let findConditions = { userId: userId };

  if ((fromDate !== undefined && fromDate !== '') || (toDate !== undefined && toDate !== '')) {

    findConditions.date = {};

    if (fromDate !== undefined && fromDate !== '') {
      findConditions.date.$gte = new Date(fromDate);
    }

    if (findConditions.date.$gte === 'Invalid Date') {
      return res.json({ error: "from date is not valid" })
    }

    if (toDate !== undefined && toDate !== '') {
      findConditions.date.$lte = new Date(toDate);
    }

    if (findConditions.date.$lte === 'Invalid Date') {
      return res.json({ error: "to date is not valid" })
    } 
    
  }
  
  let exercises;
  
  if (limit) {
    exercises = Exercise.find( findConditions ).limit(parseInt(limit));
  } else {
    exercises = Exercise.find( { userId: userId })
  }
  
  exercises = await exercises.exec();
  
  exercises = exercises.map((obj) => {
    return ({
      description: obj.description,
      duration: obj.duration,
      date: new Date(obj.date).toDateString()
    })  
  })

  res.send({
    username: user.username,
    count: exercises.length,
    _id: userId,
    log: exercises
  })
})


app.use((req, res, next) => {
  return next({ status: 404, message: 'not found'})
})


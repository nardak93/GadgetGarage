const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');

const app = express();
const SECRET_KEY = 'your_secret_key';

// Middleware
app.use(express.json());
app.use(cors());
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // Serve static files

// MongoDB connection
mongoose.connect('mongodb://localhost:27017/blog', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log('MongoDB connected'))
  .catch(err => console.log(err));

// Blog Schema and Model
const blogSchema = new mongoose.Schema({
  title: String,
  content: String,
  photo: String,
  createdAt: { type: Date, default: Date.now },
});

const Blog = mongoose.model('Blog', blogSchema);

// User Schema and Model
const userSchema = new mongoose.Schema({
  username: String,
  password: String,
});

const User = mongoose.model('User', userSchema);

// Authentication Middleware
const authMiddleware = (req, res, next) => {
  const token = req.header('Authorization');
  if (!token) return res.status(401).send('Access Denied');

  try {
    const verified = jwt.verify(token, SECRET_KEY);
    req.user = verified;
    next();
  } catch (err) {
    res.status(400).send('Invalid Token');
  }
};

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); // Appending extension
  },
});

const upload = multer({ storage: storage });

// Routes
app.get('/blogs', async (req, res) => {
  const blogs = await Blog.find();
  res.json(blogs);
});

app.post('/blogs', authMiddleware, upload.single('photo'), async (req, res) => {
  const newBlog = new Blog({
    title: req.body.title,
    content: req.body.content,
    photo: req.file ? `/uploads/${req.file.filename}` : null,
  });
  await newBlog.save();
  res.json(newBlog);
});


app.use(express.static(path.join(__dirname, '../blog-app-frontend/build')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../blog-app-frontend/build', 'index.html'));
});

app.put('/blogs/:id', authMiddleware, upload.single('photo'), async (req, res) => {
  const updatedBlog = await Blog.findByIdAndUpdate(req.params.id, {
    title: req.body.title,
    content: req.body.content,
    photo: req.file ? `/uploads/${req.file.filename}` : req.body.photo,
  }, { new: true });
  res.json(updatedBlog);
});

app.delete('/blogs/:id', authMiddleware, async (req, res) => {
  await Blog.findByIdAndDelete(req.params.id);
  res.json({ message: 'Blog deleted' });
});

// Authentication Routes
app.post('/register', async (req, res) => {
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(req.body.password, salt);

  const user = new User({
    username: req.body.username,
    password: hashedPassword,
  });

  try {
    const savedUser = await user.save();
    res.send(savedUser);
  } catch (err) {
    res.status(400).send(err);
  }
});

app.post('/login', async (req, res) => {
  const user = await User.findOne({ username: req.body.username });
  if (!user) return res.status(400).send('Username or password is wrong');

  const validPass = await bcrypt.compare(req.body.password, user.password);
  if (!validPass) return res.status(400).send('Invalid password');

  const token = jwt.sign({ _id: user._id }, SECRET_KEY);
  res.header('Authorization', token).send(token);
});

// Start server
app.listen(5000, () => {
  console.log('Server is running on port 5000');
});

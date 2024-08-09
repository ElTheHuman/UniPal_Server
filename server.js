import express from 'express';
import SpeechToTextService from './API/SpeechToText/SpeechToTextService.js';
import GenAIService from './API/GenAI/GenAI.js';
import cors from 'cors';
import multer from 'multer';
import jwt from 'jsonwebtoken';
import ELTextToSpeech from './API/ELTextToSpeech/ELTextToSpeech.js';
import {} from 'dotenv/config';

const SECRET_KEY = 'your_secret_key';

const app = express();
const port = 3000;

app.use(express.json());
app.use(cors());

// const ttsService = new TextToSpeechService(process.env.);
const stsService = new SpeechToTextService(process.env.SPEECH_TO_TEXT_API_KEY);
const eltts = new ELTextToSpeech(process.env.EL_TEXT_TO_SPEECH_API_KEY);
const aiService = new GenAIService();
await aiService.initialize(process.env.GEN_AI_API_KEY);

const upload = multer();

const findUser = (email) => {

  let low = 0;
  let high = users.length - 1;
  let mid;
  let key;

  while (low <= high) {
    mid = low + Math.floor((high - low) / 2);
    key = Object.keys(users[mid])[0];

    if (key.localeCompare(email) == 0)
        return mid;

    if (key.localeCompare(email) > 0)
        high = mid - 1;

    else
        low = mid + 1;
  }

  return mid;

}

// Generative AI
app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    console.log('Received message:', message);

    if (!message) {
      return res.status(400).send('Message is required');
    }

    const response = await aiService.send(message);
    console.log('Response:', response);
    res.send({ response });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).send('Internal Server Error');
  }

});

//  Text to Speech
// Google Text to Speech
app.post('/api/generate', async (req, res) => {
  try {
    console.log('Generating speech...');
    const { text } = req.body;
    console.log('Received text:', text);

    if (!text) {
      return res.status(400).send('Text is required');
    }

    const audioContent = await ttsService.generate(text);
    res.set({
      'Content-Type': 'audio/wav',
      'Content-Disposition': 'inline; filename="output.wav"',
    });
    res.send(audioContent);
  } catch (error) {
    console.error('Error generating speech:', error);
    res.status(500).send('Internal Server Error');
  }
});

// ElevenLabs Text to Speech
app.post('/api/elgenerate', async (req, res) => {
  try {
    console.log('Generating ElevenLabs Speech...');
    const { text } = req.body;
    console.log('Received Text:', text);

    if (!text) {
      return res.status(400).send('Text is required');
    }

    const audioContent = await eltts.generate(text);
    res.set({
      'Content-Type': 'audio/wav',
      'Content-Disposition': 'inline; filename="output.wav"'
    })
    res.send(audioContent);
    console.log('Finished Generating ElevenLabs Speech...');
  } catch (error) {
    console.error('Error generating speech:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Speech to Text
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send('Audio file is required');
    }
    console.log('Transcribing speech...');
    const audioBuffer = req.file.buffer;
    const transcription = await stsService.transcribe(audioBuffer);
    console.log('Transcription:', transcription);
    res.send({ transcription });
  } catch (error) {
    console.error('Error transcribing speech:', error);
    res.status(500).send('Internal Server Error');
  }
});

// User Authentication

// Login
app.post('/login', (req, res) => {
  const { email, password } = req.body;

  console.log('Received login request:', email, password);

  if (!password || !email) {
      return res.status(400).json({ message: "Missing email or password" });
  }

  const user = users[findUser(email)][email];

  if (user) {
    if (user.password === password) {
      const token = jwt.sign({ username: user.username, profilePicture: user.profilePicture, email }, SECRET_KEY, { expiresIn: '1h' });
      console.log('Login successful:', email);
      return res.status(200).json({ message: "Login successful", token }); 
    } else if (user.password !== password) {
      return res.status(401).json({ message: "Invalid Password" });
    }
  } else {
      return res.status(401).json({ message: "Invalid credentials" });
  }
});

// Register
app.post('/register', async (req, res) => {
  try {
    const { email, username, gender, password } = req.body;

    console.log('Received register request:', email, username);

    let userIdx = findUser(email);

    if (users[userIdx] && Object.keys(users[userIdx])[0] == email) {
      console.log('Email already registered');
      return res.status(401).json({ message: "Email already registered" });
    }

    const newUser = {
      [email]: {
        username: username,
        gender: gender,
        password: password,
        profilePicture: 'default'
      }
    }

    while (users[userIdx] && Object.keys(users[userIdx])[0].localeCompare(email) < 0) {
        userIdx++;
    }

    users.splice(userIdx, 0, newUser);

    // writeFileSync(dataPath, JSON.stringify(users));

    return res.status(200).json({ message: "Register successful, automatically redirecting" });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Internal Server Error');
  }
});

// ONLY USE WITH CAUTION SINCE THIS METHOD IS USED TO DELETE ALL USER DATA!
app.post('/cleardata', (req, res) => {
  // writeFileSync(dataPath, JSON.stringify([]));
  users.splice(0, users.length);
  console.log('ALL DATA HAS BEEN DELETED');
  return res.status(200).json({ message: "All data have been deleted!" });
});

app.post('/verify', (req, res) => {
  const token = req.headers['authorization'].split(' ')[1]; // GET THE TOKEN
  
  if (!token) {
    return res.status(400).json({ message: "Token is required" });
  }
  
  jwt.verify(token, SECRET_KEY, (err, decoded) => {
      if (err) {
          return res.status(401).json({ message: "Invalid token" });
      }
      return res.status(200).json({ message: "Token is valid", username: decoded.username, email: decoded.email, profilePicture: decoded.profilePicture });
  });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

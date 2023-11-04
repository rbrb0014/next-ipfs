import pg from 'pg';
import express from 'express';
import { create } from 'kubo-rpc-client';
import multer from 'multer';
import {
  decrypt,
  encrypt,
  fragging,
  ipfsRead,
  ipfsWrite,
} from './src/service.js';
import { dataInsert, dataSelectOne } from './src/dbQuery.js';

const app = express();
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });
export const dbClient = new pg.Client({
  host: 'localhost',
  port: '5432',
  user: 'postgres',
  password: '1234',
  database: 'postgres',
});
dbClient.connect((error) => {
  if (error) console.error('connection error', error.stack);
  else console.log('connect success!');
});
export const ipfs = create({ url: 'http://127.0.0.1:5001/api/v0' });

const split_count = 5;

app.get('/', async (req, res) => {
  res.send(await ipfs.id());
});

app.post('/contents', upload.single('file'), async (req, res) => {
  const { originalname: path, mimetype, buffer } = req.file;

  const fragments = fragging(buffer, split_count);
  const { encryptedFragments, keys } = encrypt(
    fragments,
    path,
    'passwordpassword'
  );
  const cids = await ipfsWrite(encryptedFragments, path);

  const result = await dataInsert(mimetype, path, cids, keys);

  res.json(result.context);
});

app.get('/contents', async (req, res) => {
  const { path } = req.query;
  const { cids, keys, mimetype } = await dataSelectOne(path);
  const bufferStrings = await ipfsRead(path, cids);

  const result = await decrypt(bufferStrings, keys, 'passwordpassword');

  res.set('Content-Type', mimetype).send(result);
});

app.listen(3000);

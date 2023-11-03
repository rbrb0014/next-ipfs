import pg from 'pg';
import express from 'express'; //express를 설치했기 때문에 가져올 수 있다.
import { create } from 'kubo-rpc-client';
import multer from 'multer';
import { promisify } from 'util';
import { fragging } from './src/service.js';
import { createCipheriv, createDecipheriv, scrypt } from 'crypto';

const app = express();
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });
const dbClient = new pg.Client({
  host: 'localhost',
  port: '5432',
  user: 'postgres',
  password: '1234',
  database: 'postgres',
});
const ipfs = create({ url: 'http://127.0.0.1:5001/api/v0' });

dbClient.connect((error) => {
  if (error) console.error('connection error', error.stack);
  else console.log('connect success!');
});

const split_count = 5;

app.get('/', async (req, res) => {
  res.send(await ipfs.id());
});

app.get('/data', (req, res) => {
  dbClient.query('SELECT * FROM your_table', (error, results) => {
    if (error) {
      console.error('Error executing query:', error);
      res.status(500).send('Error executing query');
    } else {
      res.json(results.rows);
    }
  });
});

app.post('/contents', upload.single('image'), async (req, res) => {
  const image = req.file;
  const path = image.originalname;
  const mimetype = image.mimetype;
  const buffer = image.buffer;

  const fragments = fragging(buffer, split_count);
  const cids = [];
  const keys = [];

  const iv = Buffer.from('passwordpassword').subarray(0, 16);

  for (let i = 0; i < split_count; i++) {
    const frag = fragments[i];
    const key = await promisify(scrypt)(path, 'salt', 32);
    // console.log(key);
    const cipher = createCipheriv('aes-256-ctr', key, iv);
    const encrypted = Buffer.concat([
      cipher.update(frag, 'utf8'),
      cipher.final(),
    ]);

    cids.push(encrypted.toString('hex'));
    keys.push(key.toString('hex'));
  }

  dbClient.query(
    'INSERT INTO ipfsdb.data (mimetype, path, cids, keys) VALUES ($1, $2, $3::varchar[], $4::varchar[]) RETURNING *',
    [mimetype, path, cids, keys],
    (error, results, fields) => {
      console.log(fields);
      if (error) res.json({ text: 'error occurred', error });
      else {
        console.log(results.rows[0]);
        res.json({ results: 'contents successfully saved' });
      }
    }
  );
});

app.get('/contents', async (req, res) => {
  const { path } = req.query;
  const decrypts = [];
  const data = await dbClient.query(
    'SELECT * FROM ipfsdb.data WHERE path = $1 LIMIT 1',
    [path]
  );
  const { cids, keys, mimetype } = data.rows[0];

  for (let i = 0; i < split_count; i++) {
    const key = Buffer.from(keys[i], 'hex');
    const decipher = createDecipheriv(
      'aes-256-ctr',
      key,
      Buffer.from('passwordpassword').subarray(0, 16)
    );
    const encryptedText = Buffer.from(cids[i], 'hex');
    const decryptedText = Buffer.concat([
      decipher.update(encryptedText),
      decipher.final(),
    ]);
    // console.log(decryptedText);
    decrypts.push(decryptedText);
  }
  const result = decrypts.reduce((prev, curr) => Buffer.concat([prev, curr]));

  res.set('Content-Type', mimetype).send(result);
});

app.listen(3000);

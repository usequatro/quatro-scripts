import dotenv from 'dotenv';

dotenv.config();

console.log(`Hello ${process.env.HELLO_WORD_ENV_VAR || 'there'}`);

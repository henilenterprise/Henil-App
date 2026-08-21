import 'dotenv/config';
import app from './app.js';
import { config, logConfigWarnings } from './config/env.js';

logConfigWarnings();

app.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(`Henil Enterprise backend running on http://localhost:${config.port}`);
});

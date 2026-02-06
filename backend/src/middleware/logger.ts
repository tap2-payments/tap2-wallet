import fs from 'fs';
import path from 'path';

const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

export const logger = fs.createWriteStream(path.join(logsDir, 'access.log'), {
  flags: 'a',
});

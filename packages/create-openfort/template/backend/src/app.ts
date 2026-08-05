import os from 'node:os';
import Openfort from '@openfort/openfort-node';
import cors from 'cors';
import express, { type Request, type Response } from 'express';

process.loadEnvFile();

// Create an express application
const app = express();
app.use(express.json());

// Only your own front-end may call this server. Without an explicit origin an
// open `cors()` lets any page on the internet mint encryption sessions from a
// visitor's browser.
// `||`, not `??`: an ALLOWED_ORIGINS set to an empty string is what a `.env`
// copied from the example and then blanked looks like, and `??` passes that
// through — leaving the allowlist empty so the server blocks its own front end.
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({ origin: allowedOrigins }));

// Ensure Openfort is only initialized once
if (!process.env.OPENFORT_SECRET_KEY) {
  throw new Error('Openfort secret key is not set');
}

const openfort = new Openfort(process.env.OPENFORT_SECRET_KEY, { basePath: process.env.OPENFORT_BASE_PATH });

/**
 * Rejects callers that cannot prove they are the signed-in user.
 *
 * An encryption session is the credential the SDK exchanges for the embedded
 * wallet's key share, so this endpoint must never answer an anonymous request.
 * The front end sends the access token it already holds; Openfort verifies it.
 */
async function requireOpenfortUser(req: Request, res: Response): Promise<boolean> {
  const accessToken = req.headers.authorization?.replace(/^Bearer /i, '');
  if (!accessToken) {
    res.status(401).send({ error: 'Missing access token' });
    return false;
  }

  try {
    await openfort.iam.getSession({ accessToken });
    return true;
  } catch {
    res.status(401).send({ error: 'Invalid access token' });
    return false;
  }
}

async function createEncryptionSession(req: Request, res: Response) {
  const uaHead = String(req.headers['user-agent']?.split(' ')[0] || 'unknown').replace(/[\[\]]/g, ''); // Remove brackets to prevent log injection
  console.log('[%s] Creating encryption session...', uaHead);

  if (!(await requireOpenfortUser(req, res))) return;

  try {
    const shieldApiKey = process.env.SHIELD_PUBLISHABLE_KEY;
    const shieldSecretKey = process.env.SHIELD_SECRET_KEY;
    const shieldEncryptionShare = process.env.SHIELD_ENCRYPTION_KEY;

    if (!shieldApiKey || !shieldSecretKey || !shieldEncryptionShare) {
      throw new Error('Shield environment variables are not set');
    }

    const session = await openfort.createEncryptionSession(
      shieldApiKey,
      shieldSecretKey,
      shieldEncryptionShare,
      process.env.SHIELD_BASE_PATH,
    );

    res.status(200).send({
      session: session,
    });
  } catch (e) {
    console.error(e);
    res.status(500).send({
      error: 'Internal server error',
    });
  }
}

app.post('/api/protected-create-encryption-session', createEncryptionSession);

// Function to get local IP address
function getLocalIP() {
  const networkInterfaces = os.networkInterfaces();
  for (const interfaceName in networkInterfaces) {
    const interfaces = networkInterfaces[interfaceName];
    if (interfaces) {
      for (const networkInterface of interfaces) {
        if (networkInterface.family === 'IPv4' && !networkInterface.internal) {
          return networkInterface.address;
        }
      }
    }
  }
  return 'localhost'; // Fallback to localhost if no local IP found
}

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  const localIP = getLocalIP();
  console.log(`Server is running on port ${PORT}`);
  console.log(`  - http://localhost:${PORT}`);
  console.log(`  - http://${localIP}:${PORT}`);
});

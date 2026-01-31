import * as functions from "firebase-functions/v2";
import next from "next";
import {Request, Response} from "express"; // ✅ fixed spacing

// Limit the number of concurrent instances
functions.setGlobalOptions({maxInstances: 10});

// Detect dev vs production
const dev = process.env.NODE_ENV !== "production";

// Initialize Next.js
const app = next({dev, conf: {distDir: ".next"}});
const handle = app.getRequestHandler();

// Prepare Next.js once at startup
const appPrepare = app.prepare();

// Export SSR function
export const nextjsServer = functions.https.onRequest(
  async (req: Request, res: Response) => {
    await appPrepare; // wait for preparation to finish
    return handle(req, res);
  }
);

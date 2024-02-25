import 'dotenv/config';
import * as Sentry from '@sentry/node';
import { ProfilingIntegration } from "@sentry/profiling-node";
import express from "express";
import twilio from 'twilio';

const app = express();
app.use(express.json());

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  integrations: [
    // enable HTTP calls tracing
    new Sentry.Integrations.Http({ tracing: true }),
    // enable Express.js middleware tracing
    new Sentry.Integrations.Express({ app }),
    new ProfilingIntegration(),
  ],
  // Performance Monitoring
  tracesSampleRate: 1.0, //  Capture 100% of the transactions
  // Set sampling rate for profiling - this is relative to tracesSampleRate
  profilesSampleRate: 1.0,
});

const PORT = process.env.PORT || 1337;

// The request handler must be the first middleware on the app
app.use(Sentry.Handlers.requestHandler());

// TracingHandler creates a trace for every incoming request
app.use(Sentry.Handlers.tracingHandler());

// All your controllers should live here
app.get("/", function rootHandler(req, res) {
  res.end("Hello world!");
});

// The error handler must be registered before any other error middleware and after all controllers
app.use(Sentry.Handlers.errorHandler());

// Optional fallthrough error handler
app.use(function onError(err, req, res, next) {
  // The error id is attached to `res.sentry` to be returned
  // and optionally displayed to the user for support.
  res.statusCode = 500;
  res.end(res.sentry + "\n");
});

app.get("/debug-sentry", function mainHandler(req, res) {
  throw new Error("My first Sentry error!");
});

const twilioClient = new twilio(process.env.TWILIO_API_KEY, process.env.TWILIO_API_KEY_SECRET, {
  accountSid: process.env.TWILIO_ACCOUNT_SID
});

/** 
 * This request takes in the following 
 * {
 *  "phoneNumber": "+1555555555"
 * }
 * 
 * and it returns back the results
 */
app.post(`/lookup`, async (req, res) => {
  const { phoneNumber } = req.body;

  console.log(phoneNumber);

  res.json({ phoneNumber });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
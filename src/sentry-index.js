import 'dotenv/config';
import * as Sentry from '@sentry/node'; // for error tracking 
import { ProfilingIntegration } from "@sentry/profiling-node";
import express from "express";
import twilio from 'twilio';

const app = express();
app.use(express.json());

Sentry.init({
  dsn: process.env.SENTRY_DSN, // connects app to Sentry account 
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

const PORT = process.env.PORT || 1337; // port on which express server will run 

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

// twilioClient used to authenticate app with twilio services
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
  try {
    const { phoneNumber } = req.body;
    
    const callerIdResult = await getCallerName([phoneNumber]); 
    const typeResults = await getPhoneNumberType([phoneNumber]); 

    res.json({
      'callerId' : callerIdResult[0], 
      'lineType' : typeResults[0]
    });
  } catch(e) {
    console.error(e);
    res.json(e);
  }
});


app.post(`/lookups`, async (req, res) => {
  const { phoneNumbers } = req.body; 
  // phoneNumbers returns [ '+15706200103', '+18024791999' ]
  const callerIdResults = await getCallerName(phoneNumbers); 
  const typeResults = await getPhoneNumberType(phoneNumbers); 
  const results = []; 

  for (let i = 0; i < phoneNumbers.length; i++) { 
    results.push({
      'callerId': callerIdResults[i],
      'lineType': typeResults[i]
    });
  }

  res.json(results);

}); 

// helper functions 

async function getCallerName(phoneNumbers) {
  const results = []

  for (const phoneNumber of phoneNumbers) {
    const result = await twilioClient.lookups.v2
    .phoneNumbers(phoneNumber)
    .fetch({fields: 'caller_name'});

    results.push(result.callerName); 
  }; 
  return results; 
}

async function getPhoneNumberType(phoneNumbers) {
  const results = []

  for (const phoneNumber of phoneNumbers) {
    const result = await twilioClient.lookups.v2
    .phoneNumbers(phoneNumber)
    .fetch({fields: 'line_type_intelligence'});

    results.push(result.lineTypeIntelligence); 
  }; 
  return results; 
}  

// SMS

/**
 * This request takes in the following 
 * {
 *  "firstName": "John",
 * "lastName": "Smith",
 *  "phoneNumber": "+1555555555",
 * "message": "Hello John"
 * }
 * 
 * and it returns back the results
 */
app.post(`/sms`, async (req, res) => {
  try {
    const { firstName, lastName, phoneNumber, message } = req.body;
    const {TWILIO_PHONE_NUMBER} = process.env; 
      // imports twilio phone number 

    const result = await twilioClient.messages
      .create({ 
        body: message, 
        from: TWILIO_PHONE_NUMBER, 
        to: phoneNumber
      }); 

    res.json(result);
  } catch(e) {
    console.error(e);
  }
});

/**
 * This request takes in the following 
 * {
 * "people": [{
 *  "firstName": "John",
 *  "lastName": "Smith",
 *  "phoneNumber": "+1555555555"
 * }], 
 * "message": "Hello ${firstName}"
 * }
 * 
 * and it returns back the results
 */
app.post(`/broadcastSMS`, async(req, res) => {
  try {
    const { people, message } = req.body;
    const {TWILIO_PHONE_NUMBER} = process.env; 
    const results = []; 

    for (const person of people) { 
      const keys = Object.keys(person);
      let finalMessage = message;

      for (const key of keys) { 
        if (finalMessage.includes(key)) { 
          console.log(key); 
          finalMessage = message.replace(key, person[key]);
        }
      }

      const result = await twilioClient.messages
      .create({ 
        body: finalMessage, 
        from: TWILIO_PHONE_NUMBER, 
        to: person.phoneNumber
      }); 
      
      results.push(result)
    }

    res.json(results);
  } catch(e) {
    console.error(e);
  }
});

// phone calls 

app.post(`/call`, async(req, res) => {
  try { 
    const {TWILIO_PHONE_NUMBER} = process.env; 
    const { firstName, lastName, phoneNumber, message } = req.body;


    const result = await twilioClient.calls
      .create({
        to: phoneNumber, 
        from: TWILIO_PHONE_NUMBER,
        twiml: `<Response><Pause length="10"/><Say>${message}</Say></Response>`
      });

    console.log(result); 
    res.json(result);
  } catch(e) { 
    console.error(e); 
  }
}) 

app.post(`/calls`, async(req, res) => {
  try { 
    const {TWILIO_PHONE_NUMBER} = process.env; 
    const { people, message } = req.body;
    const results = []; 

    for (const person of people) { 
      const keys = Object.keys(person);
      let finalMessage = message;

      for (const key of keys) { 
        if (finalMessage.includes(key)) {
          finalMessage = message.replace(key, person[key]);
        }
      }

      console.log(`finalMessage: ${finalMessage}`);

      const result = await twilioClient.calls
      .create({
        to: person.phoneNumber, 
        from: TWILIO_PHONE_NUMBER,
        twiml: `<Response><Pause length="10"/><Say>${finalMessage}</Say></Response>`
      });
      results.push(result); 
    }

    res.json(results); 

  } catch(e) { 
    console.error(e); 
  }
}); 

app.post(`/conference`, async(req, res) => {
  try { 
    const {TWILIO_PHONE_NUMBER} = process.env; 
    const { people, message } = req.body;
    const results = []; 

    for (const person of people) { 
      const keys = Object.keys(person);
      let finalMessage = message;

      for (const key of keys) { 
        if (finalMessage.includes(key)) {
          finalMessage = message.replace(key, person[key]);
        }
      }

      console.log(`finalMessage: ${finalMessage}`);

      const result = await twilioClient.calls
      .create({
        to: person.phoneNumber, 
        from: TWILIO_PHONE_NUMBER,
        twiml: 
        `<Response>
          <Pause length="10"/>
          <Say>${finalMessage}</Say>
          <Dial>
              <Conference>MyConferenceRoom</Conference>
          </Dial>
        </Response>`
      });
      results.push(result); 
    }

    res.json(results); 

  } catch(e) { 
    console.error(e); 
  }
}); 






app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
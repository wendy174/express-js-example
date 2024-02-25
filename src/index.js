import 'dotenv/config';
import express from 'express';
import twilio from 'twilio';

const twilioClient = new twilio(process.env.TWILIO_API_KEY, process.env.TWILIO_API_KEY_SECRET, {
  accountSid: process.env.TWILIO_ACCOUNT_SID
});

const app = express();
const PORT = process.env.PORT || 1337;

app.use(express.json());


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
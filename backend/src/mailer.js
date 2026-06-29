const axios = require("axios");

async function sendOtpEmail(email, otp) {
  try {
    await axios.post(
      "https://api.brevo.com/v3/smtp/email",
      {
        sender: {
          name: "ArenaHub",
          email: process.env.EMAIL_FROM,
        },
        to: [
          {
            email: email,
          },
        ],
        subject: "Your BGMI Tournament Verification OTP",
        htmlContent: `
          <div style="font-family: Arial, sans-serif;">
            <h2>BGMI ArenaHub</h2>
            <p>Your OTP is:</p>
            <h1>${otp}</h1>
            <p>This OTP is valid for 10 minutes.</p>
          </div>
        `,
        textContent: `Your OTP is ${otp}. It is valid for 10 minutes.`,
      },
      {
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "api-key": process.env.BREVO_API_KEY,
        },
      }
    );

    console.log("OTP email sent successfully.");
    return null;
  } catch (err) {
    console.error(
      "BREVO ERROR:",
      err.response?.data || err.message
    );
    throw err;
  }
}

module.exports = { sendOtpEmail };
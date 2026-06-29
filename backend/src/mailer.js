const brevo = require("@getbrevo/brevo");

const apiInstance = new brevo.TransactionalEmailsApi();

apiInstance.setApiKey(
  brevo.TransactionalEmailsApiApiKeys.apiKey,
  process.env.BREVO_API_KEY
);

async function sendOtpEmail(email, otp) {
  const sendSmtpEmail = new brevo.SendSmtpEmail();

  sendSmtpEmail.sender = {
    name: "ArenaHub",
    email: process.env.EMAIL_FROM,
  };

  sendSmtpEmail.to = [
    {
      email,
    },
  ];

  sendSmtpEmail.subject = "Your BGMI Tournament Verification OTP";

  sendSmtpEmail.htmlContent = `
    <div style="font-family:Arial,sans-serif">
      <h2>BGMI Tournament Verification</h2>
      <p>Your OTP is:</p>
      <h1>${otp}</h1>
      <p>This OTP is valid for 10 minutes.</p>
    </div>
  `;

  sendSmtpEmail.textContent = `Your OTP is ${otp}. It is valid for 10 minutes.`;

  try {
    await apiInstance.sendTransacEmail(sendSmtpEmail);
    return null;
  } catch (err) {
    console.error("BREVO ERROR:", err);
    throw err;
  }
}

module.exports = { sendOtpEmail };
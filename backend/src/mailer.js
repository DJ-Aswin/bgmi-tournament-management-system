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
    email: process.env.EMAIL_FROM || "aswin.d.ciet@gmail.com",
  };

  sendSmtpEmail.to = [
    {
      email: email,
    },
  ];

  sendSmtpEmail.subject = "Your BGMI Tournament Verification OTP";

  sendSmtpEmail.htmlContent = `
    <div style="font-family:Arial,sans-serif;line-height:1.6">
      <h2>BGMI Tournament Verification</h2>
      <p>Your one-time password is:</p>
      <h1>${otp}</h1>
      <p>This OTP is valid for 10 minutes.</p>
    </div>
  `;

  sendSmtpEmail.textContent = `Your OTP is ${otp}. It is valid for 10 minutes.`;

  try {
    await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log("OTP email sent successfully.");
  } catch (error) {
    console.error("BREVO API ERROR:", error);
    throw error;
  }
}

module.exports = { sendOtpEmail };
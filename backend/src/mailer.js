const nodemailer = require("nodemailer");

let transporterPromise;

async function getTransporter() {
  if (transporterPromise) return transporterPromise;

  const emailUser = (process.env.EMAIL_USER || "").trim();
  const emailPass = (process.env.EMAIL_PASS || "").trim();

  transporterPromise = Promise.resolve(
    nodemailer.createTransport({
      host: "smtp-relay.brevo.com",
      port: 587,
      secure: false,
      auth: {
        user: emailUser,
        pass: emailPass,
      },
    })
  );

  return transporterPromise;
}

async function sendOtpEmail(email, otp) {
  const mailOptions = {
    from:
      process.env.EMAIL_FROM ||
      `ArenaHub <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Your BGMI Tournament Verification OTP",
    text: `Your OTP is ${otp}. It is valid for 10 minutes.`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6">
        <h2>BGMI Tournament Verification</h2>
        <p>Your one-time password is:</p>
        <p style="font-size:28px;font-weight:700;letter-spacing:4px">${otp}</p>
        <p>This OTP is valid for 10 minutes.</p>
      </div>
    `,
  };

  try {
    const transporter = await getTransporter();
    await transporter.sendMail(mailOptions);
    return null;
  } catch (error) {
    console.error("EMAIL ERROR:", error);
    throw error;
  }
}

module.exports = { sendOtpEmail };
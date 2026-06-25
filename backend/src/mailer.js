const nodemailer = require("nodemailer");

let transporterPromise;
let fallbackTransporterPromise;

function hasRealGmailCredentials() {
  const emailUser = (process.env.EMAIL_USER || "").trim();
  const emailPass = (process.env.EMAIL_PASS || "").trim();

  if (!emailUser || !emailPass) return false;
  if (emailUser.includes("your-gmail")) return false;
  if (emailPass.includes("your-app-password")) return false;
  return true;
}

async function getTransporter() {
  if (transporterPromise) return transporterPromise;

  if (hasRealGmailCredentials()) {
    const emailUser = process.env.EMAIL_USER.trim();
    const emailPass = process.env.EMAIL_PASS.trim();
    transporterPromise = Promise.resolve(
      nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: emailUser,
    pass: emailPass,
  },
})
    );
    return transporterPromise;
  }

  return getFallbackTransporter();
}

async function getFallbackTransporter() {
  if (fallbackTransporterPromise) return fallbackTransporterPromise;
  fallbackTransporterPromise = nodemailer.createTestAccount().then((testAccount) =>
    nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    })
  );
  return fallbackTransporterPromise;
}

async function sendOtpEmail(email, otp) {
  const mailOptions = {
    from: process.env.EMAIL_FROM || "Krafton India Esports <no-reply@krafton-esports.local>",
    to: email,
    subject: "Your BGMI Tournament Verification OTP",
    text: `Your OTP is ${otp}. It is valid for 10 minutes.`,
    html: `<div style="font-family:Arial,sans-serif;line-height:1.6">
      <h2>BGMI Tournament Verification</h2>
      <p>Your one-time password is:</p>
      <p style="font-size:28px;font-weight:700;letter-spacing:4px">${otp}</p>
      <p>This OTP is valid for 10 minutes.</p>
    </div>`,
  };

  let info;
  try {
    const transporter = await getTransporter();
    info = await transporter.sendMail(mailOptions);
  } catch (primaryError) {
  console.error("PRIMARY EMAIL ERROR:", primaryError);

  try {
    const fallbackTransporter = await getFallbackTransporter();
    info = await fallbackTransporter.sendMail(mailOptions);
  } catch (fallbackError) {
    console.error("FALLBACK EMAIL ERROR:", fallbackError);
    throw fallbackError;
  }
}

  const preview = nodemailer.getTestMessageUrl(info);
  return preview || null;
}

module.exports = { sendOtpEmail };

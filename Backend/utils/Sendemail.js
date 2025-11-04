// 📄 utils/Sendemail.js (Make sure this code is deployed)

const nodemailer = require("nodemailer");
require("dotenv").config();

// The function now correctly expects a single object (mailOptions)
const sendEmail = async (to, subject, text, html) => { 
  if (!to) {
    throw new Error("No recipient email provided to sendEmail()");
  }

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.FROM_EMAIL || user;

  if (!host || !port || !user || !pass) {
    throw new Error("SMTP config missing (SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS)");
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // true for 465
    auth: { user, pass },
  });

  const mailOptions = { from, to, subject, text, html };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("✅ Email sent:", info.messageId, "to:", to);
    return info;
  } catch (err) {
    console.error("❌ Email send failed!", err && err.message);
    throw err;
  }
};

module.exports = sendEmail;
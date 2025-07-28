const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');

// Create reusable transporter object
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  },
  tls: {
    rejectUnauthorized: false // For self-signed certificates
  }
});

const sendEmailWithAttachment = async ({ to, subject, text, html, attachments }) => {
  try {
    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM_ADDRESS}>`,
      to,
      subject,
      text,
      html: html || text, // Fallback to text if no HTML provided
      attachments: attachments.map(attachment => ({
        filename: attachment.filename,
        content: attachment.content || fs.createReadStream(attachment.path),
        contentType: attachment.contentType || 'application/pdf'
      }))
    };

    const info = await transporter.sendMail(mailOptions);
    return info;
  } catch (error) {
    console.error('Email sending error:', error);
    throw error;
  }
};

module.exports = { sendEmailWithAttachment };
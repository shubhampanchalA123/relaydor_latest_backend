import nodemailer from "nodemailer";

const sendEmail = async ({ to, subject, message }) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.SMTP_EMAIL,
      pass: process.env.SMTP_PASSWORD,
    },
  });

  const mailOptions = {
    from: process.env.SMTP_EMAIL,
    to,
    subject,
    text: message,
  };

  await transporter.sendMail(mailOptions);
};

export default sendEmail;

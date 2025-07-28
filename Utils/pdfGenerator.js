const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const moment = require('moment'); // For better date handling

const generateClientPDF = async (clientData, packageDetails, options = {}) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        bufferPages: true
      });

      // File paths setup
      const directory = path.join(__dirname, '../public/client-pdfs');
      const fileName = `client_${clientData._id}_${moment().format('YYYYMMDD')}.pdf`;
      const filePath = path.join(directory, fileName);

      // Ensure directory exists
      if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, { recursive: true });
      }

      // Pipe to file
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      // ===== HEADER SECTION =====
      doc.image(path.join(__dirname, '../assets/logo.png'), 50, 45, { width: 50 });
      doc
        .font('Helvetica-Bold')
        .fontSize(20)
        .text('V TRAKER ', 110, 57)
        .font('Helvetica')
        .fontSize(10)
        .text(`Generated: ${moment().format('MMMM Do YYYY, h:mm:ss a')}`, 50, 100, {
          align: 'right'
        });

      // Horizontal line
      doc.moveTo(50, 120).lineTo(550, 120).stroke();

      // ===== CLIENT DETAILS SECTION =====
      doc.font('Helvetica-Bold').fontSize(14).text('CLIENT INFORMATION', 50, 140);
      generateDetailRow(doc, 170, 'Full Name:', clientData.name);
      generateDetailRow(doc, 195, 'Email Address:', clientData.email);
      generateDetailRow(doc, 220, 'Phone Number:', clientData.phone);
      generateDetailRow(doc, 245, 'Registration Date:', moment(clientData.createdAt).format('LL'));

      // ===== PACKAGE DETAILS SECTION =====
      doc.font('Helvetica-Bold').fontSize(14).text('PACKAGE DETAILS', 50, 285);
      generateDetailRow(doc, 315, 'Package Name:', packageDetails.packageName);
      generateDetailRow(doc, 340, 'Duration:', `${packageDetails.packageDuration} days`);
      generateDetailRow(doc, 365, 'Start Date:', moment().format('LL'));
      generateDetailRow(doc, 390, 'Expiry Date:', moment(clientData.packageStatus.expiryDate).format('LL'));
      
      // Status badge
      doc
        .roundedRect(450, 380, 100, 30, 5)
        .fill(clientData.packageStatus.isActive ? '#4CAF50' : '#F44336');
      doc
        .fillColor('white')
        .font('Helvetica-Bold')
        .fontSize(12)
        .text(
          clientData.packageStatus.isActive ? 'ACTIVE' : 'EXPIRED',
          480,
          388,
          { align: 'center' }
        );

      // ===== TERMS AND CONDITIONS =====
      doc.addPage();
      doc.font('Helvetica-Bold').fontSize(16).text('TERMS AND CONDITIONS', 50, 50);
      doc.font('Helvetica').fontSize(10);
      
      const terms = [
        '1. This agreement constitutes the entire understanding between the parties.',
        '2. All packages are non-transferable and non-refundable.',
        '3. The client must notify the provider of any changes to contact information.',
        '4. The provider reserves the right to modify terms with 30 days notice.',
        '5. Disputes shall be resolved through mediation in the first instance.'
      ];
      
      terms.forEach((term, i) => {
        doc.text(term, 50, 100 + (i * 25));
      });

      // ===== SIGNATURE SECTION =====
      doc.moveTo(50, 300).lineTo(250, 300).stroke();
      doc.fontSize(10).text('Client Signature', 50, 310);
      
      doc.moveTo(350, 300).lineTo(550, 300).stroke();
      doc.fontSize(10).text('Authorized Representative', 350, 310);
      
      // ===== FOOTER =====
      doc
        .fontSize(8)
        .text(
          `Confidential Document - ${clientData.name} - ${moment().format('YYYY')}`,
          50,
          800,
          { align: 'center' }
        );

      doc.end();

      stream.on('finish', () => resolve({
        pdfPath: `/client-pdfs/${fileName}`,
        fileName,
        fullPath: filePath
      }));

      stream.on('error', reject);
    } catch (error) {
      reject(error);
    }
  });
};

// Helper function for consistent detail rows
function generateDetailRow(doc, y, label, value) {
  doc
    .font('Helvetica-Bold')
    .fontSize(10)
    .text(label, 50, y)
    .font('Helvetica')
    .text(value, 150, y);
}

module.exports = { generateClientPDF };
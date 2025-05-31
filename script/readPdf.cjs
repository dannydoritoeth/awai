const fs = require('fs');
const pdfParse = require('pdf-parse');
const path = require('path');

const pdfPath = path.join(__dirname, '__tests__', 'resources', 'RD_Digital-Solutions-Analyst.pdf');

console.log('Reading PDF from:', pdfPath);

async function readPdf() {
  try {
    const buffer = await fs.promises.readFile(pdfPath);
    console.log('Successfully read PDF file');
    
    const data = await pdfParse(buffer);
    console.log('Successfully parsed PDF');
    
    console.log('\nPDF Data:', {
      numPages: data.numpages,
      info: data.info,
      metadata: data.metadata,
      version: data.version
    });
    
    console.log('\nPDF Text Content:');
    console.log('----------------------------------------');
    console.log(data.text);
    console.log('----------------------------------------');
  } catch (error) {
    console.error('Error reading PDF:', error);
  }
}

readPdf(); 
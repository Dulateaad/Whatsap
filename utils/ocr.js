const Tesseract = require('tesseract.js');
const fs = require('fs');

async function recognizeTextFromImage(buffer) {
  fs.writeFileSync('./temp.jpg', buffer);
  const result = await Tesseract.recognize('./temp.jpg', 'rus+eng');
  return result.data.text;
}

module.exports = { recognizeTextFromImage };

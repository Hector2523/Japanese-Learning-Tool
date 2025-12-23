function serveFile(filePath) {
    console.log(`Reading file: ${filePath}`);
  if (!filePath) {
    return 'Bad Request: File path is required';
  }
  import('fs/promises').then(fs => {
    fs.readFile(filePath, 'utf-8')
      .then(data => {
        return data;
      })
      .catch(err => {
        console.error(`Error reading file ${filePath}:`, err);
        return 'Internal Server Error';
      });
  });
}

module.exports = { serveFile };
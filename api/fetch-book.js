// api/fetch-book.js
export default async function handler(req, res) {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'Missing book URL' });
  }

  try {
    // The server fetches from Gutenberg and follows all redirects automatically
    const response = await fetch(url);
    
    if (!response.ok) {
      return res.status(response.status).json({ error: 'Failed to fetch book from source' });
    }

    // Forward the correct content type (e.g., application/epub+zip)
    const contentType = response.headers.get('content-type');
    if (contentType) {
      res.setHeader('Content-Type', contentType);
    }

    // Set CORS headers so your frontend can read it safely
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Convert the file to a buffer and send it back
    const arrayBuffer = await response.arrayBuffer();
    return res.status(200).send(Buffer.from(arrayBuffer));
    
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

// Proxy service to fetch webpage content
const fetchWebpageContent = async (url) => {
  try {
    const response = await fetch(url);
    const html = await response.text();
    
    // Basic HTML cleaning
    const cleanText = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove scripts
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '') // Remove styles
      .replace(/<[^>]+>/g, ' ') // Remove HTML tags
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .replace(/&nbsp;/g, ' ') // Replace &nbsp; with space
      .replace(/&amp;/g, '&') // Replace &amp; with &
      .replace(/&lt;/g, '<') // Replace &lt; with <
      .replace(/&gt;/g, '>') // Replace &gt; with >
      .replace(/&quot;/g, '"') // Replace &quot; with "
      .replace(/&#39;/g, "'") // Replace &#39; with '
      .trim();
    
    return cleanText;
  } catch (error) {
    console.error(`Error fetching content from ${url}:`, error.message);
    return `Error fetching content: ${error.message}`;
  }
};

export default fetchWebpageContent; 
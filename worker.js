export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Route: Backend API (We will build this next)
    if (url.pathname === '/api/scan' && request.method === 'POST') {
      return new Response(JSON.stringify({ error: "Backend not yet implemented" }), { 
        status: 501,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Route: Serve the Frontend HTML
    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Route Scanner</title>
      <style>
        body { font-family: system-ui, sans-serif; text-align: center; padding: 2rem; background: #f4f4f9; }
        h1 { color: #333; }
        .btn {
          display: inline-block; background: #007bff; color: white;
          padding: 15px 30px; font-size: 1.2rem; border-radius: 8px;
          cursor: pointer; font-weight: bold; margin-top: 20px;
        }
        /* Hide the ugly default file input */
        #cameraInput { display: none; }
        #status { margin-top: 20px; font-size: 1rem; color: #555; }
        .loader { display: none; margin: 20px auto; border: 4px solid #f3f3f3; border-top: 4px solid #007bff; border-radius: 50%; width: 30px; height: 30px; animation: spin 1s linear infinite; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      </style>
    </head>
    <body>

      <h1>Scan Addresses</h1>
      <p>Take a photo of your ordered address list to generate a route.</p>

      <label for="cameraInput" class="btn">📸 Open Camera</label>
      <input type="file" accept="image/*" capture="environment" id="cameraInput">

      <div class="loader" id="loader"></div>
      <div id="status"></div>

      <script>
        const cameraInput = document.getElementById('cameraInput');
        const statusDiv = document.getElementById('status');
        const loader = document.getElementById('loader');

        cameraInput.addEventListener('change', async (event) => {
          const file = event.target.files[0];
          if (!file) return;

          // Update UI
          statusDiv.innerText = "Reading image...";
          loader.style.display = "block";

          // Convert image to Base64 to send to our Worker API
          const reader = new FileReader();
          reader.readAsDataURL(file);
          
          reader.onload = async () => {
            const base64Image = reader.result.split(',')[1]; // Strip the data URL prefix

            try {
              statusDiv.innerText = "Analyzing addresses... this takes a few seconds.";
              
              // Send to our Cloudflare Worker backend
              const response = await fetch('/api/scan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: base64Image })
              });

              const data = await response.json();

              if (!response.ok) {
                throw new Error(data.error || 'Failed to process image');
              }

              statusDiv.innerText = "Success! Opening Google Maps...";
              
              // Map Generation Logic (Assuming the API returns an array of strings)
              const addresses = data.addresses;
              if (addresses && addresses.length >= 2) {
                const origin = encodeURIComponent(addresses[0]);
                const destination = encodeURIComponent(addresses[addresses.length - 1]);
                const waypoints = addresses.slice(1, -1).map(encodeURIComponent).join('|');
                
                const mapsUrl = \`https://www.google.com/maps/dir/?api=1&origin=\${origin}&destination=\${destination}&waypoints=\${waypoints}\`;
                
                // Redirect to Google Maps
                window.location.href = mapsUrl;
              } else {
                statusDiv.innerText = "Could not find enough addresses on the page.";
                loader.style.display = "none";
              }

            } catch (error) {
              console.error(error);
              statusDiv.innerText = "Error: " + error.message;
              loader.style.display = "none";
            }
          };
        });
      </script>
    </body>
    </html>
    `;

    return new Response(html, {
      headers: { 'content-type': 'text/html;charset=UTF-8' },
    });
  },
};
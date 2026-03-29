export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Route: Backend API
    if (url.pathname === '/api/scan' && request.method === 'POST') {
      try {
        const body = await request.json();
        const base64Image = body.image;

        if (!base64Image) {
          return new Response(JSON.stringify({ error: "No image provided" }), { 
            status: 400, headers: { 'Content-Type': 'application/json' } 
          });
        }

        // 1. Prepare the payload for Google Vision API
        const visionUrl = `https://vision.googleapis.com/v1/images:annotate?key=${env.GOOGLE_VISION_API_KEY}`;
        const visionPayload = {
          requests: [{
            image: { content: base64Image },
            features: [{ type: "DOCUMENT_TEXT_DETECTION" }]
          }]
        };

        // 2. Send the image to Google
        const visionResponse = await fetch(visionUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(visionPayload)
        });

        if (!visionResponse.ok) {
          const errorDetails = await visionResponse.text();
          console.error("Google Vision API Error:", errorDetails); // Logs to your terminal
          throw new Error(`Google API Error (${visionResponse.status}): ${errorDetails}`);
        }

        const visionData = await visionResponse.json();
        
        // 3. Extract the raw text
        const rawText = visionData.responses[0]?.fullTextAnnotation?.text || "";

        if (!rawText) {
          return new Response(JSON.stringify({ error: "No text found in the image" }), { 
            status: 400, headers: { 'Content-Type': 'application/json' } 
          });
        }

        // 4. Intelligent Address Parsing (Google Gemini 2.5 Flash)
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${env.GEMINI_API_KEY}`;
        
        const geminiPayload = {
          system_instruction: {
            parts: [{ 
              text: 'You are a strict data extractor. Extract all real-world street addresses from the provided OCR text. Ignore headers, stray marks, and non-address text. Return a JSON array of strings representing the addresses in the exact order they appear. If no addresses are found, return [].' 
            }]
          },
          contents: [{
            parts: [{ text: rawText }]
          }],
          generationConfig: {
            response_mime_type: "application/json", // This guarantees clean JSON output
            temperature: 0.1
          }
        };

        const aiResponse = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(geminiPayload)
        });

        if (!aiResponse.ok) {
          const errText = await aiResponse.text();
          throw new Error(`Gemini API Error: ${errText}`);
        }

        const aiData = await aiResponse.json();
        let addresses = [];
        
        try {
          // Extract the guaranteed JSON string from the response
          const content = aiData.candidates[0].content.parts[0].text;
          
          // Parse directly into a JavaScript array
          addresses = JSON.parse(content);

          if (!Array.isArray(addresses) || addresses.length === 0) {
             throw new Error("No addresses found in the parsed output.");
          }

        } catch (e) {
          console.error("Failed to parse Gemini response:", e);
          return new Response(JSON.stringify({ error: "Could not cleanly extract addresses from the image." }), { 
            status: 400, headers: { 'Content-Type': 'application/json' } 
          });
        }

        // 5. Return the array to the frontend
        return new Response(JSON.stringify({ addresses }), { 
          status: 200, headers: { 'Content-Type': 'application/json' } 
        });

      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { 
          status: 500, headers: { 'Content-Type': 'application/json' } 
        });
      }
    }

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
        #routes { margin-top: 16px; max-width: 720px; margin-left: auto; margin-right: auto; text-align: center; }
        #routes a { display: inline-block; margin: 8px; color: #0a58ca; text-decoration: none; font-weight: 600; }
        #routes a:hover { text-decoration: underline; }
        .loader { display: none; margin: 20px auto; border: 4px solid #f3f3f3; border-top: 4px solid #007bff; border-radius: 50%; width: 30px; height: 30px; animation: spin 1s linear infinite; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      </style>
    </head>
    <body>

      <h1>🍏🍎🍏Öpfelchasper Route Planner🍎🍏🍎</h1>
      <p>Take a photo of your ordered address list to generate a route.</p>

      <label for="cameraInput" class="btn">📸 Open Camera</label>
      <input type="file" accept="image/*" capture="environment" id="cameraInput">

      <div class="loader" id="loader"></div>
      <div id="status"></div>
      <div id="routes"></div>

      <script>
        const cameraInput = document.getElementById('cameraInput');
        const statusDiv = document.getElementById('status');
        const loader = document.getElementById('loader');
        const routesDiv = document.getElementById('routes');

        const MAX_STOPS_PER_ROUTE = 10;

        function chunkAddresses(addresses, chunkSize) {
          const chunks = [];
          for (let i = 0; i < addresses.length; i += chunkSize) {
            chunks.push(addresses.slice(i, i + chunkSize));
          }
          return chunks;
        }

        function createMapsUrl(routeAddresses) {
          const origin = encodeURIComponent(routeAddresses[0]);
          const destination = encodeURIComponent(routeAddresses[routeAddresses.length - 1]);
          const waypoints = routeAddresses.slice(1, -1).map(encodeURIComponent).join('|');
          return \`https://www.google.com/maps/dir/?api=1&origin=\${origin}&destination=\${destination}&waypoints=\${waypoints}\`;
        }

        cameraInput.addEventListener('change', async (event) => {
          const file = event.target.files[0];
          if (!file) return;

          // Update UI
          statusDiv.innerText = "Reading image...";
          routesDiv.innerHTML = "";
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
              
              // Split into route chunks so each route has at most MAX_STOPS_PER_ROUTE stops.
              const addresses = data.addresses;
              if (addresses && addresses.length >= 2) {
                const routeChunks = chunkAddresses(addresses, MAX_STOPS_PER_ROUTE);
                const routeUrls = routeChunks
                  .filter((chunk) => chunk.length >= 2)
                  .map((chunk) => createMapsUrl(chunk));

                if (routeUrls.length === 0) {
                  statusDiv.innerText = "Could not build valid routes from extracted addresses.";
                  loader.style.display = "none";
                  return;
                }

                if (routeUrls.length === 1) {
                  statusDiv.innerText = "Success! Opening Google Maps...";
                  window.location.href = routeUrls[0];
                  return;
                }

                statusDiv.innerText = \`Found \${addresses.length} addresses. Split into \${routeUrls.length} routes (max \${MAX_STOPS_PER_ROUTE} stops each). Open each route below.\`;
                routesDiv.innerHTML = routeUrls
                  .map((url, index) => \`<a href="\${url}" target="_blank" rel="noopener noreferrer">Open Route \${index + 1}</a>\`)
                  .join('');
                loader.style.display = "none";
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
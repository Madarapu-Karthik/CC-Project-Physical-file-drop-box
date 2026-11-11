FILE CONVERTER PHYSICAL DROP BOX
=================================

FILES
- index.html : dashboard structure
- style.css  : dashboard design and responsive layout
- script.js  : CSV-to-JSON conversion, virtual button, LED, preview, download and history

RUN THE PROJECT
1. Keep all three files in the same folder.
2. Open the folder in VS Code.
3. Open index.html with Live Server, or double-click index.html.
4. Choose a CSV file or click "Use sample CSV".
5. Click "PRESS TO CONVERT".
6. View the JSON preview, LED confirmation and conversion history.
7. Click "Download JSON" to save the result.

IMPORTANT ABOUT AWS
The dashboard runs in DEMO MODE by default. In this mode the browser performs the CSV-to-JSON conversion locally. It does not upload files to AWS S3 and does not trigger a real ESP32 LED.

To connect the AWS backend:
- Open script.js.
- Set CONFIG.API_BASE_URL to your deployed API Gateway base URL.
- The current example sends POST /upload with JSON: { filename, content, contentType }.
- Make sure your API Gateway/Lambda accepts this request format and returns JSON. Adjust convertWithAWS() if your backend contract is different.
- For a real ESP32, connect the physical button through AWS IoT Core/MQTT and publish the completion message to the web dashboard or an IoT subscriber.

The PPT specifies API Gateway POST /upload and GET /files, S3 input/ and output/ folders, Lambda conversion, and an LED/done message. The exact request and response JSON format is not specified in the PPT, so it must match your actual Lambda/API implementation.

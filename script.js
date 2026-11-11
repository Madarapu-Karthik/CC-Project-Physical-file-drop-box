/*
  File Converter Physical Drop Box
  Demo mode works without AWS. To connect AWS, set API_BASE_URL below.
  Expected demo integration request: POST {API_BASE_URL}/upload
  with JSON body { filename, content, contentType }.
  Adapt the request/response section if your Lambda/API uses a different contract.
*/

const CONFIG = {
  API_BASE_URL: "", // Example: "https://your-api-id.execute-api.us-east-1.amazonaws.com"
  USE_DEMO_WHEN_API_EMPTY: true
};

const SAMPLE_CSV = `id,name,marks
1,Asha,87
2,Ravi,92
3,Meena,78
4,Arjun,85`;

const $ = id => document.getElementById(id);
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

let selectedFile = null;
let currentJson = null;
let historyItems = [];
let isConverting = false;

function setMessage(message, type = "") {
  $("statusMessage").textContent = message;
  $("statusMessage").className = "status-message " + type;
}

function parseCSV(text) {
  const rows = text.trim().split(/\r?\n/).filter(Boolean);
  if (rows.length < 2) throw new Error("The CSV file must contain a header and at least one data row.");

  // Handles simple CSV files, including quoted values and commas inside quotes.
  const parseRow = row => {
    const values = [];
    let value = "", quoted = false;
    for (let i = 0; i < row.length; i++) {
      const char = row[i];
      if (char === '"' && row[i + 1] === '"' && quoted) { value += '"'; i++; }
      else if (char === '"') quoted = !quoted;
      else if (char === "," && !quoted) { values.push(value.trim()); value = ""; }
      else value += char;
    }
    values.push(value.trim());
    return values;
  };

  const headers = parseRow(rows[0]).map(h => h.replace(/^"|"$/g, ""));
  if (headers.some(h => !h)) throw new Error("Column names cannot be empty.");

  return rows.slice(1).map((row, index) => {
    const values = parseRow(row);
    if (values.length !== headers.length) {
      throw new Error(`Row ${index + 2} has ${values.length} values; expected ${headers.length}.`);
    }
    return Object.fromEntries(headers.map((header, i) => [header, values[i]]));
  });
}

function setStage(id, state) {
  const element = $(id);
  element.className = "process-step" + (state ? " " + state : "");
}

function resetStages() {
  ["stepButton", "stepLambda", "stepS3"].forEach(id => setStage(id, ""));
}

function updateStats() {
  $("totalFiles").textContent = historyItems.length;
  $("successJobs").textContent = historyItems.filter(item => item.status === "SUCCESS").length;
  $("lastTime").textContent = historyItems.length ? historyItems[0].time : "—";
}

function renderHistory() {
  const body = $("historyBody");
  if (!historyItems.length) {
    body.innerHTML = '<tr><td colspan="5" class="empty">No converted files yet.</td></tr>';
    updateStats();
    return;
  }

  body.innerHTML = historyItems.map(item => `
    <tr>
      <td><b>${escapeHTML(item.name)}</b></td>
      <td><span class="format-tag">JSON</span></td>
      <td><span class="table-status">SUCCESS</span></td>
      <td>${escapeHTML(item.time)}</td>
      <td><button class="download-link" data-id="${item.id}">Download</button></td>
    </tr>`).join("");

  body.querySelectorAll(".download-link").forEach(button => {
    button.addEventListener("click", () => {
      const item = historyItems.find(entry => entry.id === button.dataset.id);
      if (item) downloadJSON(item.json, item.name);
    });
  });
  updateStats();
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}

function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.toLowerCase().endsWith(".json") ? filename : filename.replace(/\.csv$/i, "") + ".json";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function convertWithAWS(fileName, csvText) {
  const response = await fetch(`${CONFIG.API_BASE_URL.replace(/\/$/, "")}/upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: fileName,
      content: csvText,
      contentType: "text/csv"
    })
  });

  if (!response.ok) throw new Error(`AWS API returned HTTP ${response.status}.`);
  return await response.json();
}

async function runConversion() {
  if (isConverting) return;
  isConverting = true;
  $("convertBtn").disabled = true;
  $("pressBtn").disabled = true;
  $("jobStatus").textContent = "RUNNING";
  $("jobStatus").className = "status-badge running";
  $("led").classList.remove("on");
  $("ledTitle").textContent = "LED is OFF";
  $("ledMessage").textContent = "Conversion is in progress.";
  $("downloadCurrent").disabled = true;
  resetStages();

  try {
    let fileName = selectedFile ? selectedFile.name : "sample-data.csv";
    let csvText = selectedFile ? await selectedFile.text() : SAMPLE_CSV;
    if (!fileName.toLowerCase().endsWith(".csv")) throw new Error("Please select a CSV file.");

    setMessage("Button pressed. Sending the conversion request...");
    setStage("stepButton", "active");
    await wait(650);
    setStage("stepButton", "done");

    setMessage("Lambda is converting the CSV data into JSON...");
    setStage("stepLambda", "active");
    let converted;

    if (CONFIG.API_BASE_URL) {
      const apiResult = await convertWithAWS(fileName, csvText);
      // If the API returns converted data, display it. Otherwise use the local
      // conversion result while showing that the API request completed.
      converted = apiResult.json || apiResult.data || parseCSV(csvText);
    } else {
      if (!CONFIG.USE_DEMO_WHEN_API_EMPTY) {
        throw new Error("Add your API Gateway URL in CONFIG.API_BASE_URL in script.js.");
      }
      await wait(900);
      converted = parseCSV(csvText);
    }

    await wait(250);
    setStage("stepLambda", "done");
    setMessage("Conversion complete. Saving the JSON output...");
    setStage("stepS3", "active");
    await wait(650);
    setStage("stepS3", "done");

    currentJson = converted;
    $("jsonPreview").textContent = JSON.stringify(converted, null, 2);
    $("downloadCurrent").disabled = false;
    $("led").classList.add("on");
    $("ledTitle").textContent = "LED is ON";
    $("ledMessage").textContent = "Done message received. Conversion successful!";
    $("jobStatus").textContent = "SUCCESS";
    $("jobStatus").className = "status-badge success";
    setMessage(CONFIG.API_BASE_URL
      ? "Success! The API request completed. Check your S3 output/ folder for the stored file."
      : "Success! Demo conversion finished in the browser. Download the JSON result below.", "success");

    const outputName = fileName.replace(/\.csv$/i, "") + ".json";
    historyItems.unshift({
      id: String(Date.now()),
      name: outputName,
      json: converted,
      status: "SUCCESS",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    });
    renderHistory();
  } catch (error) {
    $("jobStatus").textContent = "FAILED";
    $("jobStatus").className = "status-badge failed";
    $("led").classList.remove("on");
    $("ledTitle").textContent = "LED is OFF";
    $("ledMessage").textContent = "The conversion did not complete.";
    setMessage(error.message || "Something went wrong during conversion.", "error");
  } finally {
    isConverting = false;
    $("convertBtn").disabled = false;
    $("pressBtn").disabled = false;
  }
}

function selectFile(file) {
  if (!file) return;
  if (!file.name.toLowerCase().endsWith(".csv")) {
    setMessage("Only CSV files are supported in this project demo.", "error");
    return;
  }
  selectedFile = file;
  $("fileLabel").textContent = file.name;
  $("fileInfo").textContent = `${(file.size / 1024).toFixed(1)} KB selected`;
  setMessage("CSV file selected. Press the button to start conversion.");
}

$("csvInput").addEventListener("change", event => selectFile(event.target.files[0]));
$("sampleBtn").addEventListener("click", () => {
  selectedFile = null;
  $("csvInput").value = "";
  $("fileLabel").textContent = "Built-in sample CSV selected";
  $("fileInfo").textContent = "sample-data.csv • 4 records";
  setMessage("Sample CSV is ready. Press the button to start conversion.");
});

["dragenter", "dragover"].forEach(eventName => {
  $("dropZone").addEventListener(eventName, event => {
    event.preventDefault();
    $("dropZone").classList.add("drag-over");
  });
});
["dragleave", "drop"].forEach(eventName => {
  $("dropZone").addEventListener(eventName, event => {
    event.preventDefault();
    $("dropZone").classList.remove("drag-over");
  });
});
$("dropZone").addEventListener("drop", event => selectFile(event.dataTransfer.files[0]));

$("convertBtn").addEventListener("click", runConversion);
$("pressBtn").addEventListener("click", runConversion);
$("downloadCurrent").addEventListener("click", () => {
  if (currentJson) downloadJSON(currentJson, selectedFile ? selectedFile.name : "sample-data.csv");
});
$("clearHistory").addEventListener("click", () => {
  historyItems = [];
  renderHistory();
});

$("connectionText").textContent = CONFIG.API_BASE_URL ? "AWS API configured" : "Demo mode ready";
if (CONFIG.API_BASE_URL) $("connectionPill").classList.add("connected");
renderHistory();

import { h, html, useState, useEffect, useRef } from "../../bundle.js";
import { Icons, Button } from "../Components.js";

const CONFIG = {
  MAX_LOG_LINES: 1000,
  HEX_PATTERN: /^(0x[0-9A-Fa-f]{2}\s*)*$/,
  API_TIMEOUT: 10000, // 10 seconds
  DEFAULT_WS_PORT: 9000,
};

function Logs() {
  const [message, setMessage] = useState({ type: "", text: "" });
  const [isLoggingEnabled, setIsLoggingEnabled] = useState(false);
  const [logs, setLogs] = useState([]);
  const [wsConnection, setWsConnection] = useState(null);
  const [inputData, setInputData] = useState("");
  const [isHexValid, setIsHexValid] = useState(true);
  const [wsPort, setWsPort] = useState(CONFIG.DEFAULT_WS_PORT);
  const [logMethod, setLogMethod] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const logTextAreaRef = useRef(null);

  // Fetch system configuration to get WebSocket port
  const fetchSystemConfig = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch("/api/system/get", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch system configuration");
      }

      const data = await response.json();
      setWsPort(data.wport || CONFIG.DEFAULT_WS_PORT);
      setLogMethod(data.logMethod || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const getWebSocketUrl = () => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${window.location.hostname}:${wsPort}/ws`;
  };

  const connectWebSocket = () => {
    if (wsConnection) return;

    const wsUrl = getWebSocketUrl();
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log("WebSocket connected to:", wsUrl);
      setMessage({
        type: "success",
        text: "WebSocket connected successfully",
      });
    };

    ws.onmessage = (event) => {
      setLogs((prevLogs) => {
        const newMessage = prevLogs.length > 0 ? `\n${event.data}` : event.data;
        const newLogs = [newMessage, ...prevLogs];
        if (newLogs.length > CONFIG.MAX_LOG_LINES) {
          return newLogs.slice(0, CONFIG.MAX_LOG_LINES);
        }
        return newLogs;
      });

      if (logTextAreaRef.current) {
        logTextAreaRef.current.scrollTop = 0;
      }
    };

    ws.onclose = () => {
      console.log("WebSocket disconnected");
      setWsConnection(null);
      setMessage({
        type: "error",
        text: "WebSocket disconnected. Attempting to reconnect...",
      });
      if (isLoggingEnabled) {
        setTimeout(connectWebSocket, 3000);
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      setMessage({
        type: "error",
        text: "WebSocket connection error",
      });
      ws.close();
    };

    setWsConnection(ws);
  };

  const disconnectWebSocket = () => {
    if (wsConnection) {
      wsConnection.close();
      setWsConnection(null);
    }
  };

  const handleLoggingToggle = (enabled) => {
    setIsLoggingEnabled(enabled);
    if (enabled && !isLoading) {
      connectWebSocket();
    } else {
      disconnectWebSocket();
      setLogs([]);
    }
  };

  const sendAsciiData = () => {
    if (!wsConnection || !inputData.trim()) return;

    try {
      wsConnection.send(inputData);
      setInputData("");
    } catch (error) {
      console.error("Error sending ASCII data:", error);
      setMessage({
        type: "error",
        text: "Failed to send ASCII data",
      });
    }
  };

  const sendHexData = () => {
    if (!wsConnection || !inputData.trim()) return;

    try {
      const hexValues = inputData.trim().split(/\s+/);
      const isValid = hexValues.every((hex) => {
        if (hex.toLowerCase().startsWith("0x")) {
          return /^0x[0-9A-Fa-f]{2}$/.test(hex.toLowerCase());
        }
        return /^[0-9A-Fa-f]{2}$/.test(hex);
      });

      if (!isValid) {
        throw new Error(
          "Invalid HEX format. Use format: 0x01 0x02 or 01 02 (2 digits per byte)"
        );
      }

      const bytes = new Uint8Array(
        hexValues.map((hex) => {
          const value = hex.toLowerCase().startsWith("0x")
            ? parseInt(hex.slice(2), 16)
            : parseInt(hex, 16);

          if (isNaN(value) || value < 0 || value > 255) {
            throw new Error(`Invalid hex value: ${hex}`);
          }

          return value;
        })
      );

      wsConnection.send(bytes);
      setInputData("");
      setIsHexValid(true);
      setMessage({ type: "", text: "" });
    } catch (error) {
      console.error("Error sending HEX data:", error);
      setIsHexValid(false);
      setMessage({
        type: "error",
        text: error.message,
      });
    }
  };

  const handleInputChange = (value) => {
    setInputData(value);
    if (!isHexValid) {
      setIsHexValid(true);
      setMessage({ type: "", text: "" });
    }
  };

  const clearAll = () => {
    setInputData("");
    setLogs([]);
    setIsHexValid(true);
    setMessage({ type: "", text: "" });
  };

  // Load initial configuration and setup
  useEffect(() => {
    document.title = "SBIOT-Logs";
    fetchSystemConfig();
    return () => {
      disconnectWebSocket();
    };
  }, []);

  // Connect WebSocket when configuration is loaded and logging is enabled
  useEffect(() => {
    if (!isLoading && isLoggingEnabled) {
      connectWebSocket();
    }
  }, [isLoading, isLoggingEnabled]);

  const renderMessage = () => {
    if (!message.text) return null;
    const bgColor = message.type === "success" ? "bg-green-100" : "bg-red-100";
    const textColor =
      message.type === "success" ? "text-green-800" : "text-red-800";
    return html`
      <div class="mb-4 p-4 rounded-lg ${bgColor} ${textColor}">
        ${message.text}
      </div>
    `;
  };

  if (isLoading) {
    return html`
      <div class="p-6">
        <h1 class="text-2xl font-bold mb-6">System Logs</h1>
        <div class="flex items-center justify-center h-full">
          <${Icons.SpinnerIcon} className="h-8 w-8 text-blue-600" />
        </div>
      </div>
    `;
  }

  return html`
    <div class="p-6">
      <h1 class="text-2xl font-bold mb-6">System Logs</h1>

      ${error &&
      html`
        <div
          class="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded flex items-center justify-between"
        >
          <div>${error}</div>
          <button
            onClick=${fetchSystemConfig}
            class="px-3 py-1 bg-red-200 hover:bg-red-300 rounded-md text-red-800 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            Retry
          </button>
        </div>
      `}
      ${renderMessage()}
      <div class="max-w-[60%] mx-auto">
        <div class="bg-white rounded-lg shadow-md p-6">
          <div class="space-y-6">
            <div class="flex items-center justify-between">
              <h2 class="text-lg font-medium text-gray-900">System Logs</h2>
              <div class="flex items-center space-x-2">
                <label class="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked=${isLoggingEnabled}
                    onChange=${(e) => handleLoggingToggle(e.target.checked)}
                    class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span class="ml-2 text-sm text-gray-700">Enable Logging</span>
                </label>
                ${isLoggingEnabled &&
                html`
                  <${Button}
                    onClick=${clearAll}
                    variant="warning"
                    icon="TrashIcon"
                  >
                    Clear All
                  <//>
                `}
              </div>
            </div>

            <div class="bg-gray-50 rounded-lg p-4">
              <textarea
                ref=${logTextAreaRef}
                class="w-full h-96 font-mono text-sm bg-gray-900 text-gray-100 p-4 rounded-lg"
                readonly
                value=${logs.join("")}
                placeholder=${isLoggingEnabled
                  ? "Waiting for logs..."
                  : "Enable logging to view system logs"}
                style="direction: ltr;"
              ></textarea>
            </div>

            ${isLoggingEnabled &&
            logMethod > 2 &&
            html`
              <div class="space-y-4">
                <div class="flex flex-col space-y-2">
                  <label class="block text-sm font-medium text-gray-700">
                    Data Input
                  </label>
                  <div class="flex space-x-2">
                    <input
                      type="text"
                      value=${inputData}
                      onInput=${(e) => handleInputChange(e.target.value)}
                      class=${`flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        !isHexValid ? "border-red-500" : "border-gray-300"
                      }`}
                      placeholder="Enter ASCII or HEX data (e.g., 0x01 0x02 or plain text)"
                    />
                    <${Button}
                      onClick=${sendAsciiData}
                      disabled=${!wsConnection}
                      variant="primary"
                    >
                      Send ASCII
                    <//>
                    <${Button}
                      onClick=${sendHexData}
                      disabled=${!wsConnection}
                      variant="secondary"
                    >
                      Send HEX
                    <//>
                  </div>
                  ${!isHexValid &&
                  html` <p class="text-sm text-red-500">${message.text}</p> `}
                </div>
              </div>
            `}
            ${!isLoggingEnabled &&
            html`
              <div class="text-sm text-gray-500">
                Enable logging to view real-time system logs and send data. The
                logs will be cleared when logging is disabled.
              </div>
            `}
          </div>
        </div>
      </div>
    </div>
  `;
}

export default Logs;

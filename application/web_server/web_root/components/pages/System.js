"use strict";
import { h, html, useState, useEffect, useRef } from "../../bundle.js";
import { Icons, Button, Tabs } from "../Components.js";

// Constants and configuration
const CONFIG = {
  DEFAULT_PORT: 8000,
  DEFAULT_TIMEZONE: 21, // UTC+07:00 (Indochina)
  DEFAULT_NTP_SERVERS: {
    primary: "pool.ntp.org",
    secondary: "time.google.com",
    tertiary: "time.windows.com",
  },
  PASSWORD_REQUIREMENTS: {
    minLength: 8,
    hasUpperCase: /[A-Z]/,
    hasLowerCase: /[a-z]/,
    hasNumbers: /\d/,
    hasSpecialChar: /[!@#$%^&*(),.?":{}|<>]/,
  },
  API_TIMEOUT: 10000, // 10 seconds
  REBOOT_DELAY: 3000, // 3 seconds
  PORT_RANGE: {
    min: 1,
    max: 65535,
  },
  MAX_LOG_LINES: 1000,
  HEX_PATTERN: /^(0x[0-9A-Fa-f]{2}\s*)*$/, // Updated pattern to match "0x" prefix format
};

// Timezone mapping array
const TIMEZONE_OPTIONS = [
  [1, "UTC-12:00 (Baker Island)"],
  [2, "UTC-11:00 (American Samoa)"],
  [3, "UTC-10:00 (Hawaii)"],
  [4, "UTC-09:00 (Alaska)"],
  [5, "UTC-08:00 (Pacific Time)"],
  [6, "UTC-07:00 (Mountain Time)"],
  [7, "UTC-06:00 (Central Time)"],
  [8, "UTC-05:00 (Eastern Time)"],
  [9, "UTC-04:00 (Atlantic Time)"],
  [10, "UTC-03:00 (Brasilia)"],
  [11, "UTC-02:00 (South Georgia)"],
  [12, "UTC-01:00 (Azores)"],
  [13, "UTC+00:00 (GMT)"],
  [14, "UTC+01:00 (Central European Time)"],
  [15, "UTC+02:00 (Eastern European Time)"],
  [16, "UTC+03:00 (Moscow)"],
  [17, "UTC+04:00 (Gulf Standard Time)"],
  [18, "UTC+05:00 (Pakistan)"],
  [19, "UTC+05:30 (India)"],
  [20, "UTC+06:00 (Bangladesh)"],
  [21, "UTC+07:00 (Indochina)"],
  [22, "UTC+08:00 (China)"],
  [23, "UTC+09:00 (Japan)"],
  [24, "UTC+10:00 (Eastern Australia)"],
  [25, "UTC+11:00 (Solomon Islands)"],
  [26, "UTC+12:00 (New Zealand)"],
];

function System() {
  // State management
  const [activeTab, setActiveTab] = useState("user");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  // System configuration state
  const [systemConfig, setSystemConfig] = useState({
    username: "admin",
    password: "",
    server1: CONFIG.DEFAULT_NTP_SERVERS.primary,
    server2: CONFIG.DEFAULT_NTP_SERVERS.secondary,
    server3: CONFIG.DEFAULT_NTP_SERVERS.tertiary,
    timezone: CONFIG.DEFAULT_TIMEZONE,
    enabled: true,
    port: CONFIG.DEFAULT_PORT,
    time: null,
  });

  // Track original config for comparison
  const [originalConfig, setOriginalConfig] = useState(null);

  // Add new state for logs
  const [isLoggingEnabled, setIsLoggingEnabled] = useState(false);
  const [logs, setLogs] = useState([]);
  const [wsConnection, setWsConnection] = useState(null);
  const logTextAreaRef = useRef(null);

  // Add new state for data input
  const [inputData, setInputData] = useState("");
  const [isHexValid, setIsHexValid] = useState(true);

  const tabs = [
    { id: "user", label: "User Config" },
    { id: "time", label: "Time Settings" },
    { id: "websocket", label: "Web Server Settings" },
    { id: "factory", label: "Factory Reset" },
    { id: "logs", label: "System Logs" },
  ];

  // Fetch all system configuration
  const fetchSystemConfig = async () => {
    setIsLoading(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        CONFIG.API_TIMEOUT
      );

      const response = await fetch("/api/system/get", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(
          `Failed to fetch system configuration: ${response.statusText}`
        );
      }

      const data = await response.json();

      // Store original config for comparison
      setOriginalConfig(data);

      // Update all configurations from single response
      setSystemConfig({
        username: data.username || "admin",
        password: "", // Don't set password from server
        server1: data.server1 || CONFIG.DEFAULT_NTP_SERVERS.primary,
        server2: data.server2 || CONFIG.DEFAULT_NTP_SERVERS.secondary,
        server3: data.server3 || CONFIG.DEFAULT_NTP_SERVERS.tertiary,
        timezone: data.timezone || CONFIG.DEFAULT_TIMEZONE,
        enabled: data.enabled ?? true,
        port: data.port || CONFIG.DEFAULT_PORT,
        time: data.time ? new Date(data.time) : null,
      });
    } catch (error) {
      console.error("Error fetching system configuration:", error);
      setMessage({
        type: "error",
        text:
          error.name === "AbortError"
            ? "Request timed out. Please try again."
            : "Failed to load system configuration",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Add password validation function
  const validatePassword = (password) => {
    if (!password) return true; // Empty password is valid (no change)

    const requirements = [
      {
        met: password.length >= CONFIG.PASSWORD_REQUIREMENTS.minLength,
        message: `Password must be at least ${CONFIG.PASSWORD_REQUIREMENTS.minLength} characters long`,
      },
      {
        met: CONFIG.PASSWORD_REQUIREMENTS.hasUpperCase.test(password),
        message: "Password must contain at least one uppercase letter",
      },
      {
        met: CONFIG.PASSWORD_REQUIREMENTS.hasLowerCase.test(password),
        message: "Password must contain at least one lowercase letter",
      },
      {
        met: CONFIG.PASSWORD_REQUIREMENTS.hasNumbers.test(password),
        message: "Password must contain at least one number",
      },
      {
        met: CONFIG.PASSWORD_REQUIREMENTS.hasSpecialChar.test(password),
        message: "Password must contain at least one special character",
      },
    ];

    const failedRequirements = requirements.filter((req) => !req.met);
    return {
      isValid: failedRequirements.length === 0,
      errors: failedRequirements.map((req) => req.message),
    };
  };

  // Add port validation function
  const validatePort = (port) => {
    const portNum = parseInt(port);
    if (
      isNaN(portNum) ||
      portNum < CONFIG.PORT_RANGE.min ||
      portNum > CONFIG.PORT_RANGE.max
    ) {
      return `Port must be between ${CONFIG.PORT_RANGE.min} and ${CONFIG.PORT_RANGE.max}`;
    }
    return null;
  };

  // Add username validation function
  const validateUsername = (username) => {
    if (!username || username.trim().length === 0) {
      return "Username cannot be empty";
    }
    if (username.length < 3 || username.length > 20) {
      return "Username must be between 3 and 20 characters";
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      return "Username can only contain letters, numbers, underscores, and hyphens";
    }
    return null;
  };

  // Add NTP server validation function
  const validateNTPServer = (server) => {
    if (!server || server.trim().length === 0) {
      return "NTP server cannot be empty";
    }
    if (!/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(server)) {
      return "Invalid NTP server format";
    }
    return null;
  };

  // Save all modified configurations
  const handleSaveConfig = async () => {
    // Validate password if it's being changed
    if (systemConfig.password) {
      const passwordValidation = validatePassword(systemConfig.password);
      if (!passwordValidation.isValid) {
        setMessage({
          type: "error",
          text: passwordValidation.errors.join(", "),
        });
        return;
      }
    }

    setIsSaving(true);
    try {
      // Prepare the complete configuration update
      const updatedConfig = {
        ...originalConfig,
        username: systemConfig.username,
        ...(systemConfig.password && { password: systemConfig.password }),
        server1: systemConfig.server1,
        server2: systemConfig.server2,
        server3: systemConfig.server3,
        timezone: systemConfig.timezone,
        enabled: systemConfig.enabled,
        port: systemConfig.port,
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        CONFIG.API_TIMEOUT
      );

      const response = await fetch("/api/system/set", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updatedConfig),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Failed to save configuration: ${response.statusText}`);
      }

      setMessage({
        type: "success",
        text: "Settings updated successfully. System will reboot to apply changes...",
      });

      // Clear password field and refresh configuration
      setSystemConfig((prev) => ({
        ...prev,
        password: "",
      }));

      // Trigger server reboot after successful save
      const rebootController = new AbortController();
      const rebootTimeoutId = setTimeout(
        () => rebootController.abort(),
        CONFIG.API_TIMEOUT
      );

      const rebootResponse = await fetch("/api/reboot/set", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        signal: rebootController.signal,
      });

      clearTimeout(rebootTimeoutId);

      if (!rebootResponse.ok) {
        throw new Error("Failed to reboot server");
      }

      // Refresh the page after a short delay
      setTimeout(() => {
        window.location.reload();
      }, CONFIG.REBOOT_DELAY);
    } catch (error) {
      console.error("Error saving system configuration:", error);
      setMessage({
        type: "error",
        text:
          error.name === "AbortError"
            ? "Request timed out. Please try again."
            : `Failed to update settings: ${error.message}`,
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Handle all configuration changes
  const handleConfigChange = (field, value) => {
    // Clear error message when user starts typing
    if (message.type === "error") {
      setMessage({ type: "", text: "" });
    }

    let error = null;

    // Validate input based on field type
    switch (field) {
      case "username":
        error = validateUsername(value);
        break;
      case "password":
        // Password validation is handled in handleSaveConfig
        break;
      case "port":
        error = validatePort(value);
        break;
      case "server1":
      case "server2":
      case "server3":
        error = validateNTPServer(value);
        break;
      default:
        break;
    }

    if (error) {
      setMessage({
        type: "error",
        text: error,
      });
      return;
    }

    setSystemConfig((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Add function to get WebSocket URL
  const getWebSocketUrl = () => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    return `${protocol}//${host}/websocket`;
  };

  // Update WebSocket connection handling
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
        // Add newline before new message if logs not empty
        const newMessage = prevLogs.length > 0 ? `\n${event.data}` : event.data;
        const newLogs = [newMessage, ...prevLogs];
        // Keep only the last MAX_LOG_LINES lines
        if (newLogs.length > CONFIG.MAX_LOG_LINES) {
          return newLogs.slice(0, CONFIG.MAX_LOG_LINES);
        }
        return newLogs;
      });

      // Auto-scroll to top since newest logs are at the top
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
      // Attempt to reconnect if logging is still enabled
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

  // Handle logging toggle
  const handleLoggingToggle = (enabled) => {
    setIsLoggingEnabled(enabled);
    if (enabled) {
      connectWebSocket();
    } else {
      disconnectWebSocket();
      setLogs([]); // Clear logs when disabled
    }
  };

  // Cleanup WebSocket on unmount
  useEffect(() => {
    return () => {
      disconnectWebSocket();
    };
  }, []);

  // Load initial configuration
  useEffect(() => {
    document.title = "SBIOT-System";
    fetchSystemConfig();
  }, []);

  // Format time for display
  const formatTime = (date) => {
    if (!date) return "N/A";
    return date.toLocaleString();
  };

  // Handle factory reset
  const handleFactoryReset = async () => {
    if (
      !confirm(
        "Are you sure you want to reset to factory settings? This action cannot be undone."
      )
    ) {
      return;
    }

    setIsRestoring(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        CONFIG.API_TIMEOUT
      );

      const response = await fetch("/api/factory/set", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(
          `Failed to perform factory reset: ${response.statusText}`
        );
      }

      setMessage({
        type: "success",
        text: "Factory reset successful. The system will restart...",
      });

      // Refresh the page after a short delay
      setTimeout(() => {
        window.location.reload();
      }, CONFIG.REBOOT_DELAY);
    } catch (error) {
      console.error("Error performing factory reset:", error);
      setMessage({
        type: "error",
        text:
          error.name === "AbortError"
            ? "Request timed out. Please try again."
            : "Failed to perform factory reset",
      });
    } finally {
      setIsRestoring(false);
    }
  };

  // Handle server reboot
  const handleReboot = async () => {
    if (!confirm("Are you sure you want to reboot the server?")) {
      return;
    }

    setIsRestoring(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        CONFIG.API_TIMEOUT
      );

      const response = await fetch("/api/reboot/set", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Failed to reboot server: ${response.statusText}`);
      }

      setMessage({
        type: "success",
        text: "Server is rebooting. Please wait...",
      });

      // Refresh the page after a short delay
      setTimeout(() => {
        window.location.reload();
      }, CONFIG.REBOOT_DELAY);
    } catch (error) {
      console.error("Error rebooting server:", error);
      setMessage({
        type: "error",
        text:
          error.name === "AbortError"
            ? "Request timed out. Please try again."
            : "Failed to reboot server",
      });
    } finally {
      setIsRestoring(false);
    }
  };

  // Add data sending functions
  const sendAsciiData = () => {
    if (!wsConnection || !inputData.trim()) return;

    try {
      wsConnection.send(inputData);
      setInputData(""); // Clear input after sending
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
      // Split the input by spaces and process each hex value
      const hexValues = inputData.trim().split(/\s+/);

      // Validate each hex value
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

      // Convert each "0x" prefixed value to a number
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
      setInputData(""); // Clear input after sending
      setIsHexValid(true); // Reset validation state
      setMessage({ type: "", text: "" }); // Clear any error messages
    } catch (error) {
      console.error("Error sending HEX data:", error);
      setIsHexValid(false);
      setMessage({
        type: "error",
        text: error.message,
      });
    }
  };

  // Remove validation from input change handler
  const handleInputChange = (value) => {
    setInputData(value);
    // Clear error messages when user types
    if (!isHexValid) {
      setIsHexValid(true);
      setMessage({ type: "", text: "" });
    }
  };

  // Add clear all function
  const clearAll = () => {
    setInputData(""); // Clear input field
    setLogs([]); // Clear logs
    setIsHexValid(true); // Reset validation
    setMessage({ type: "", text: "" }); // Clear any messages
  };

  // Render message component
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

  return html`
    <div class="p-6">
      <h1 class="text-2xl font-bold mb-6">System Settings</h1>

      ${renderMessage()}

      <${Tabs}
        tabs=${tabs}
        activeTab=${activeTab}
        onTabChange=${setActiveTab}
      />

      <div class="bg-white rounded-lg shadow-md p-6">
        ${activeTab === "user" &&
        html`
          <div class="space-y-6">
            <!-- User Profile Section -->
            <div class="bg-white border rounded-lg p-6">
              <h2 class="text-lg font-medium text-gray-900 mb-4">
                User Profile
              </h2>
              <div class="space-y-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    Username
                  </label>
                  <div class="flex items-center space-x-2">
                    <input
                      type="text"
                      value=${systemConfig.username}
                      onChange=${(e) =>
                        handleConfigChange("username", e.target.value)}
                      class="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                    <span class="text-sm text-gray-500">(3-20 characters)</span>
                  </div>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    value=${systemConfig.password}
                    onChange=${(e) =>
                      handleConfigChange("password", e.target.value)}
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Leave blank to keep current password"
                  />
                </div>
              </div>
            </div>

            <!-- Password Requirements -->
            <div class="bg-gray-50 rounded-lg p-4">
              <h3 class="text-sm font-medium text-gray-700 mb-2">
                Password Requirements
              </h3>
              <ul class="text-sm text-gray-600 space-y-1">
                <li>• Minimum 8 characters long</li>
                <li>• Must contain at least one uppercase letter</li>
                <li>• Must contain at least one lowercase letter</li>
                <li>• Must contain at least one number</li>
                <li>• Must contain at least one special character</li>
              </ul>
            </div>

            <!-- Save Button -->
            <div class="flex justify-end pt-4 border-t">
              <${Button}
                onClick=${handleSaveConfig}
                disabled=${isSaving}
                loading=${isSaving}
                icon="SaveIcon"
              >
                ${isSaving ? "Saving..." : "Save Changes"}
              <//>
            </div>
          </div>
        `}
        ${activeTab === "time" &&
        html`
          <div class="space-y-6">
            <!-- NTP Settings -->
            <div class="bg-white border rounded-lg p-6">
              <h2 class="text-lg font-medium text-gray-900 mb-4">
                NTP Configuration
              </h2>
              <div class="space-y-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    Primary NTP Server
                  </label>
                  <input
                    type="text"
                    value=${systemConfig.server1}
                    onChange=${(e) =>
                      handleConfigChange("server1", e.target.value)}
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    Secondary NTP Server
                  </label>
                  <input
                    type="text"
                    value=${systemConfig.server2}
                    onChange=${(e) =>
                      handleConfigChange("server2", e.target.value)}
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    Tertiary NTP Server
                  </label>
                  <input
                    type="text"
                    value=${systemConfig.server3}
                    onChange=${(e) =>
                      handleConfigChange("server3", e.target.value)}
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    Timezone
                  </label>
                  <select
                    value=${systemConfig.timezone}
                    onChange=${(e) =>
                      handleConfigChange("timezone", parseInt(e.target.value))}
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    ${TIMEZONE_OPTIONS.map(
                      (tz) => html` <option value=${tz[0]}>${tz[1]}</option> `
                    )}
                  </select>
                </div>
                <div class="flex items-center">
                  <input
                    type="checkbox"
                    checked=${systemConfig.enabled}
                    onChange=${(e) =>
                      handleConfigChange("enabled", e.target.checked)}
                    class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label class="ml-2 block text-sm text-gray-700">
                    Enable NTP Synchronization
                  </label>
                </div>
              </div>
            </div>

            <!-- Save Button -->
            <div class="flex justify-end pt-4 border-t">
              <${Button}
                onClick=${handleSaveConfig}
                disabled=${isSaving}
                loading=${isSaving}
                icon="SaveIcon"
              >
                ${isSaving ? "Saving..." : "Save Changes"}
              <//>
            </div>
          </div>
        `}
        ${activeTab === "websocket" &&
        html`
          <div class="space-y-6">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Web Server Port
              </label>
              <div class="flex items-center space-x-2">
                <input
                  type="number"
                  value=${systemConfig.port}
                  onChange=${(e) =>
                    handleConfigChange("port", parseInt(e.target.value))}
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min=${CONFIG.PORT_RANGE.min}
                  max=${CONFIG.PORT_RANGE.max}
                  required
                />
                <span class="text-sm text-gray-500">(1-65535)</span>
              </div>
              <p class="mt-1 text-sm text-gray-500">
                The port number for the web server interface. Default is 8000.
              </p>
            </div>

            <!-- Warning Message -->
            <div class="bg-yellow-50 border-l-4 border-yellow-400 p-4">
              <div class="flex">
                <div class="flex-shrink-0">
                  <svg
                    class="h-5 w-5 text-yellow-400"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fill-rule="evenodd"
                      d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                      clip-rule="evenodd"
                    />
                  </svg>
                </div>
                <div class="ml-3">
                  <p class="text-sm text-yellow-700">
                    Note: Changing the web server port will require you to
                    reconnect using the new port number.
                  </p>
                </div>
              </div>
            </div>

            <!-- Save Button -->
            <div class="flex justify-end pt-4 border-t">
              <${Button}
                onClick=${handleSaveConfig}
                disabled=${isSaving}
                loading=${isSaving}
                icon="SaveIcon"
              >
                ${isSaving ? "Saving..." : "Save Changes"}
              <//>
            </div>
          </div>
        `}
        ${activeTab === "factory" &&
        html`
          <div class="space-y-6">
            <!-- Warning Message -->
            <div class="bg-yellow-50 border-l-4 border-yellow-400 p-4">
              <div class="flex">
                <div class="flex-shrink-0">
                  <svg
                    class="h-5 w-5 text-yellow-400"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fill-rule="evenodd"
                      d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                      clip-rule="evenodd"
                    />
                  </svg>
                </div>
                <div class="ml-3">
                  <p class="text-sm text-yellow-700">
                    Warning: Restoring factory settings will erase all
                    configurations and cannot be undone. This action will:
                  </p>
                  <ul
                    class="mt-2 text-sm text-yellow-700 list-disc list-inside"
                  >
                    <li>Reset all device settings to default values</li>
                    <li>Clear all user configurations</li>
                    <li>Restart the device</li>
                  </ul>
                </div>
              </div>
            </div>

            <!-- Action Buttons -->
            <div class="flex justify-end space-x-4">
              <${Button}
                onClick=${handleReboot}
                disabled=${isRestoring}
                loading=${isRestoring}
                variant="warning"
                icon="RefreshIcon"
              >
                ${isRestoring ? "Rebooting..." : "Reboot Server"}
              <//>
              <${Button}
                onClick=${handleFactoryReset}
                disabled=${isRestoring}
                loading=${isRestoring}
                variant="danger"
                icon="ResetIcon"
              >
                ${isRestoring ? "Restoring..." : "Restore Factory Settings"}
              <//>
            </div>
          </div>
        `}
        ${activeTab === "logs" &&
        html`
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
                      onChange=${(e) => handleInputChange(e.target.value)}
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
        `}
      </div>
    </div>
  `;
}

export default System;

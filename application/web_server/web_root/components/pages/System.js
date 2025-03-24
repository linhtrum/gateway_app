"use strict";
import { h, html, useState, useEffect, useRef } from "../../bundle.js";
import { Icons, Button, Tabs } from "../Components.js";

// Constants and configuration
const CONFIG = {
  DEFAULT_PORT: 8000,
  DEFAULT_WS_PORT: 9000, // Default WebSocket port
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
  DEFAULT_LOG_METHOD: 1, // Default to SERIAL
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

// Log method options array
const LOG_METHOD_OPTIONS = [
  [0, "DISABLE"],
  [1, "SERIAL"],
  [2, "SYSTEM"],
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
    hport: CONFIG.DEFAULT_PORT,
    wport: CONFIG.DEFAULT_WS_PORT,
    time: null,
    logMethod: CONFIG.DEFAULT_LOG_METHOD,
  });

  // Track original config for comparison
  const [originalConfig, setOriginalConfig] = useState(null);

  const tabs = [
    { id: "user", label: "User Config" },
    { id: "time", label: "Time Settings" },
    { id: "websocket", label: "Web Server Settings" },
    { id: "factory", label: "Factory Reset" },
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
        hport: data.hport || CONFIG.DEFAULT_PORT,
        wport: data.wport || CONFIG.DEFAULT_WS_PORT,
        time: data.time ? new Date(data.time) : null,
        logMethod: data.logMethod || CONFIG.DEFAULT_LOG_METHOD,
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

    // Validate required fields
    const requiredFields = {
      username: validateUsername(systemConfig.username),
      hport: validatePort(systemConfig.hport),
      wport: validatePort(systemConfig.wport),
      server1: validateNTPServer(systemConfig.server1),
      server2: validateNTPServer(systemConfig.server2),
      server3: validateNTPServer(systemConfig.server3),
    };

    const errors = Object.entries(requiredFields)
      .filter(([_, error]) => error !== null)
      .map(([field, error]) => `${field}: ${error}`);

    if (errors.length > 0) {
      setMessage({
        type: "error",
        text: `Validation errors: ${errors.join(", ")}`,
      });
      return;
    }

    setIsSaving(true);
    try {
      // Prepare the complete configuration update
      const updatedConfig = {
        username: systemConfig.username,
        ...(systemConfig.password && { password: systemConfig.password }),
        server1: systemConfig.server1,
        server2: systemConfig.server2,
        server3: systemConfig.server3,
        timezone: systemConfig.timezone,
        enabled: systemConfig.enabled,
        hport: systemConfig.hport,
        wport: systemConfig.wport,
        logMethod: systemConfig.logMethod,
      };

      console.log("Saving configuration:", updatedConfig);

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
        const errorText = await response.text();
        throw new Error(
          `Failed to save configuration: ${response.statusText}. ${errorText}`
        );
      }

      setMessage({
        type: "success",
        text: "Settings updated successfully. System will reboot to apply changes...",
      });

      // Clear password field
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
        const errorText = await rebootResponse.text();
        throw new Error(`Failed to reboot server: ${errorText}`);
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
      case "hport":
        error = validatePort(value);
        break;
      case "server1":
      case "server2":
      case "server3":
        error = validateNTPServer(value);
        break;
      case "logMethod":
        // Log method validation is handled in handleSaveConfig
        break;
      case "wport":
        error = validatePort(value);
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

  if (isLoading) {
    return html`
      <div class="p-6">
        <h1 class="text-2xl font-bold">System Settings</h1>
        <div
          class="mt-6 bg-white rounded-lg shadow-md p-6 flex items-center justify-center"
        >
          <div class="flex items-center space-x-2">
            <${Icons.SpinnerIcon} className="h-5 w-5 text-blue-600" />
            <span class="text-gray-600">Loading system settings...</span>
          </div>
        </div>
      </div>
    `;
  }

  return html`
    <div class="p-6">
      <h1 class="text-2xl font-bold mb-6">System Settings</h1>
      ${renderMessage()}

      <div class="space-y-8">
        <!-- User Profile Section -->
        <div class="bg-white rounded-lg shadow-md p-6">
          <h2 class="text-lg font-medium text-gray-900 mb-4">User Profile</h2>
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1"
                >Username</label
              >
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
              <label class="block text-sm font-medium text-gray-700 mb-1"
                >Password</label
              >
              <input
                type="password"
                value=${systemConfig.password}
                onChange=${(e) =>
                  handleConfigChange("password", e.target.value)}
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Leave blank to keep current password"
              />
            </div>
            <div class="bg-gray-50 rounded-lg p-4 mt-2">
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
          </div>
        </div>

        <!-- Time Settings Section -->
        <div class="bg-white rounded-lg shadow-md p-6">
          <h2 class="text-lg font-medium text-gray-900 mb-4">Time Settings</h2>
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1"
                >Primary NTP Server</label
              >
              <input
                type="text"
                value=${systemConfig.server1}
                onChange=${(e) => handleConfigChange("server1", e.target.value)}
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1"
                >Secondary NTP Server</label
              >
              <input
                type="text"
                value=${systemConfig.server2}
                onChange=${(e) => handleConfigChange("server2", e.target.value)}
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1"
                >Tertiary NTP Server</label
              >
              <input
                type="text"
                value=${systemConfig.server3}
                onChange=${(e) => handleConfigChange("server3", e.target.value)}
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1"
                >Timezone</label
              >
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
              <label class="ml-2 block text-sm text-gray-700"
                >Enable NTP Synchronization</label
              >
            </div>
          </div>
        </div>

        <!-- Web Server Settings Section -->
        <div class="bg-white rounded-lg shadow-md p-6">
          <h2 class="text-lg font-medium text-gray-900 mb-4">
            Web Server Settings
          </h2>
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1"
                >HTTP Server Port</label
              >
              <div class="flex items-center space-x-2">
                <input
                  type="number"
                  value=${systemConfig.hport}
                  onChange=${(e) =>
                    handleConfigChange("hport", parseInt(e.target.value))}
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min=${CONFIG.PORT_RANGE.min}
                  max=${CONFIG.PORT_RANGE.max}
                  required
                />
                <span class="text-sm text-gray-500">(1-65535)</span>
              </div>
              <p class="mt-1 text-sm text-gray-500">
                The port number for the HTTP server interface. Default is 8000.
              </p>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1"
                >WebSocket Server Port</label
              >
              <div class="flex items-center space-x-2">
                <input
                  type="number"
                  value=${systemConfig.wport}
                  onChange=${(e) =>
                    handleConfigChange("wport", parseInt(e.target.value))}
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min=${CONFIG.PORT_RANGE.min}
                  max=${CONFIG.PORT_RANGE.max}
                  required
                />
                <span class="text-sm text-gray-500">(1-65535)</span>
              </div>
              <p class="mt-1 text-sm text-gray-500">
                The port number for the WebSocket server interface. Default is
                9000.
              </p>
            </div>

            <!-- Add Log Method Selection -->
            <div class="mt-4">
              <label class="block text-sm font-medium text-gray-700 mb-1"
                >Log Method</label
              >
              <div class="mt-2">
                <select
                  value=${systemConfig.logMethod}
                  onChange=${(e) =>
                    handleConfigChange("logMethod", parseInt(e.target.value))}
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  ${LOG_METHOD_OPTIONS.map(
                    ([value, label]) =>
                      html`<option value=${value}>${label}</option>`
                  )}
                </select>
                <p class="mt-1 text-sm text-gray-500">
                  Choose where to output log messages. SERIAL for debugging via
                  UART, SYSTEM for system-level logging, or DISABLE to turn off
                  logging.
                </p>
              </div>
            </div>

            <div class="bg-yellow-50 border-l-4 border-yellow-400 p-4 mt-4">
              <div class="flex">
                <div class="flex-shrink-0">
                  <${Icons.WarningIcon} className="h-5 w-5 text-yellow-400" />
                </div>
                <div class="ml-3">
                  <p class="text-sm text-yellow-700">
                    Note: Changing either the HTTP or WebSocket port will
                    require you to reconnect using the new port numbers.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Factory Reset Section -->
        <div class="bg-white rounded-lg shadow-md p-6">
          <h2 class="text-lg font-medium text-gray-900 mb-4">
            System Maintenance
          </h2>
          <div class="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
            <div class="flex">
              <div class="flex-shrink-0">
                <${Icons.WarningIcon} className="h-5 w-5 text-yellow-400" />
              </div>
              <div class="ml-3">
                <p class="text-sm text-yellow-700">
                  Warning: Restoring factory settings will erase all
                  configurations and cannot be undone. This action will:
                </p>
                <ul class="mt-2 text-sm text-yellow-700 list-disc list-inside">
                  <li>Reset all device settings to default values</li>
                  <li>Clear all user configurations</li>
                  <li>Restart the device</li>
                </ul>
              </div>
            </div>
          </div>
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

        <!-- Save Changes Button -->
        <div class="flex justify-end pt-4">
          <${Button}
            onClick=${() => handleSaveConfig()}
            disabled=${isSaving}
            loading=${isSaving}
            variant="primary"
            icon="SaveIcon"
            type="button"
          >
            ${isSaving ? "Saving..." : "Save All Changes"}
          <//>
        </div>
      </div>
    </div>
  `;
}

export default System;

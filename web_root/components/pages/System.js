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
  const [message, setMessage] = useState({ type: "", text: "" });

  // System configuration state
  const [systemConfig, setSystemConfig] = useState({});

  const tabs = [
    { id: "user", label: "User Config" },
    { id: "websocket", label: "Web Server Settings" },
  ];

  // Fetch all system configuration
  const fetchSystemConfig = async () => {
    setIsLoading(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CONFIG.API_TIMEOUT);

      const response = await fetch("/api/system/get", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Failed to fetch system configuration: ${response.statusText}`);
      }

      const data = await response.json();
      console.log("Received configuration:", data);

      // Update system configuration state
      setSystemConfig({
        username: data.username,
        password: "", // Don't set password from server
        hport: data.hport,
        wport: data.wport,
        logMethod: data.logMethod,
      });
    } catch (error) {
      console.error("Error fetching system configuration:", error);
      setMessage({
        type: "error",
        text: error.name === "AbortError" 
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
      // Prepare configuration update
      const updatedConfig = {
        username: systemConfig.username,
        ...(systemConfig.password && { password: systemConfig.password }),
        hport: systemConfig.hport,
        wport: systemConfig.wport,
        logMethod: systemConfig.logMethod,
      };

      console.log("Saving configuration:", updatedConfig);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CONFIG.API_TIMEOUT);

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
        throw new Error(`Failed to save configuration: ${response.statusText}. ${errorText}`);
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
      const rebootTimeoutId = setTimeout(() => rebootController.abort(), CONFIG.API_TIMEOUT);

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
        text: error.name === "AbortError" 
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
      case "wport":
        error = validatePort(value);
        break;
      case "logMethod":
        // Log method validation is handled in handleSaveConfig
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
        <div class="mt-6 bg-white rounded-lg shadow-md p-6 flex items-center justify-center">
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

      <div class="max-w-2xl mx-auto">
        <div class="space-y-6">
          <!-- User Profile Section -->
          <div class="bg-white rounded-lg shadow-md p-6">
            <h2 class="text-lg font-medium text-gray-900 mb-4">User Profile</h2>
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Username<span class="text-red-500">*</span></label>
                <div class="flex items-center space-x-2">
                  <input
                    type="text"
                    value=${systemConfig.username}
                    onChange=${(e) => handleConfigChange("username", e.target.value)}
                    class="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                  <span class="text-sm text-gray-500">(3-20 characters)</span>
                </div>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Password<span class="text-red-500">*</span></label>
                <input
                  type="password"
                  value=${systemConfig.password}
                  onChange=${(e) => handleConfigChange("password", e.target.value)}
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Leave blank to keep current password"
                />
              </div>
              <div class="bg-gray-50 rounded-lg p-4 mt-2">
                <h3 class="text-sm font-medium text-gray-700 mb-2">Password Requirements</h3>
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

          <!-- Web Server Settings Section -->
          <div class="bg-white rounded-lg shadow-md p-6">
            <h2 class="text-lg font-medium text-gray-900 mb-4">Web Server Settings</h2>
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">HTTP Server Port<span class="text-red-500">*</span>
                <span class="text-sm text-gray-500"> (0-65535)</span>
                </label>
                <div class="flex items-center space-x-2">
                  <input
                    type="number"
                    value=${systemConfig.hport}
                    onChange=${(e) => handleConfigChange("hport", parseInt(e.target.value))}
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min=${CONFIG.PORT_RANGE.min}
                    max=${CONFIG.PORT_RANGE.max}
                    required
                  />
                </div>
                <p class="mt-1 text-sm text-gray-500">
                  The port number for the HTTP server interface. Default is 8000.
                </p>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">WebSocket Server Port<span class="text-red-500">*</span>
                <span class="text-sm text-gray-500"> (0-65535)</span>
                </label>
                <div class="flex items-center space-x-2">
                  <input
                    type="number"
                    value=${systemConfig.wport}
                    onChange=${(e) => handleConfigChange("wport", parseInt(e.target.value))}
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min=${CONFIG.PORT_RANGE.min}
                    max=${CONFIG.PORT_RANGE.max}
                    required
                  />
                </div>
                <p class="mt-1 text-sm text-gray-500">
                  The port number for the WebSocket server interface. Default is 9000.
                </p>
              </div>

              <!-- Add Log Method Selection -->
              <div class="mt-4">
                <label class="block text-sm font-medium text-gray-700 mb-1">Log Method</label>
                <div class="mt-2">
                  <select
                    value=${systemConfig.logMethod}
                    onChange=${(e) => handleConfigChange("logMethod", parseInt(e.target.value))}
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    ${LOG_METHOD_OPTIONS.map(
                      ([value, label]) => html`<option value=${value}>${label}</option>`
                    )}
                  </select>
                  <p class="mt-1 text-sm text-gray-500">
                    Choose where to output log messages. SERIAL for debugging via UART, SYSTEM for system-level logging, or DISABLE to turn off logging.
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
                      Note: Changing either the HTTP or WebSocket port will require you to reconnect using the new port numbers.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Save and Cancel Changes Button -->
          <div
            class="mt-8 border-t border-gray-200 pt-6 pb-4 flex justify-end gap-4"
          >
        <${Button}
          onClick=${() => {
            if (confirm("Are you sure you want to discard all changes?")) {
              fetchSystemConfig();
            }
          }}
          variant="secondary"
          icon="CloseIcon"
          disabled=${isSaving}
        >
          Cancel
        <//>
        <${Button}
          onClick=${handleSaveConfig}
          disabled=${isSaving}
          loading=${isSaving}
          icon="SaveIcon"
        >
          ${isSaving ? "Saving..." : "Save"}
        <//>
      </div>

        </div>
      </div>
    </div>
  `;
}

export default System;

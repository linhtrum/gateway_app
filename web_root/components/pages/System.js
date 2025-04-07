"use strict";
import { h, html, useState, useEffect, useRef } from "../../bundle.js";
import { Icons, Button, Tabs, Input, Checkbox, Select } from "../Components.js";

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
  [1, "SERIAL1"],
  [2, "SERIAL2"],
  [3, "SYSTEM"],
];

function System() {
  // State management
  const [activeTab, setActiveTab] = useState("user");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // System configuration state
  const [systemConfig, setSystemConfig] = useState({});

  const tabs = [
    { id: "user", label: "User Config" },
    { id: "time", label: "Time Settings" },
    { id: "websocket", label: "Web Server Settings" },
    { id: "factory", label: "Factory Reset" },
  ];

  // Fetch all system configuration
  const fetchConfig = async () => {
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
      setSystemConfig(data || {});
    } catch (err) {
      setError(err.message);
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
  const saveConfig = async () => {
    try {
      setIsSaving(true);
      setError(null);
      setSuccess(false);

      const [systemResponse, rebootResponse] = await Promise.all([
        fetch("/api/system/set", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(systemConfig),
        }),
        fetch("/api/reboot/set", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        }),
      ]);

      if (!systemResponse.ok || !rebootResponse.ok) {
        throw new Error("Failed to save configuration");
      }

      setSuccess(true);
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err) {
      setError(err.message);
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
    fetchConfig();
  }, []);

  // Format time for display
  const formatTime = (date) => {
    if (!date) return "N/A";
    return date.toLocaleString();
  };

  // Handle factory reset
  const factoryReset = async () => {
    try {
      setIsSaving(true);
      setError(null);
      setSuccess(false);

      const [factoryResponse, rebootResponse] = await Promise.all([
        fetch("/api/factory/set", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        }),
        fetch("/api/reboot/set", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        }),
      ]);

      if (!factoryResponse.ok || !rebootResponse.ok) {
        throw new Error("Failed to perform factory reset");
      }

      setSuccess(true);
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSaving(false);
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
        <h1 class="text-2xl font-bold mb-6">System Configuration</h1>
        <div class="flex items-center justify-center h-full">
          <${Icons.SpinnerIcon} className="h-8 w-8 text-blue-600" />
        </div>
      </div>
    `;
  }

  return html`
    <div class="p-6">
      ${renderMessage()}
      <div class="max-w-2xl mx-auto">
        <div class="space-y-4">
          <!-- User Profile Section -->
          <div class="bg-white rounded-lg shadow-md p-6">
            <div className="grid grid-cols-2 gap-4">
              <div class="space-y-4">
                <h2 class="text-lg font-medium text-gray-900 mb-4">
                  User Profile
                </h2>
                ${Input({
                  type: "text",
                  name: "username",
                  label: "Username",
                  value: systemConfig.username,
                  onChange: (e) =>
                    handleConfigChange("username", e.target.value),
                  required: true,
                  placeholder: "Enter your username",
                })}
                ${Input({
                  type: "password",
                  name: "password",
                  label: "Password",
                  value: systemConfig.password,
                  onChange: (e) =>
                    handleConfigChange("password", e.target.value),
                  placeholder: "Leave blank to keep current password",
                })}
              </div>
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
            </div>
          </div>
          <!-- Time Settings Section -->
          <div class="bg-white rounded-lg shadow-md p-6">
            <h2 class="text-lg font-medium text-gray-900 mb-4">
              Time Settings
            </h2>
            <div class="space-y-4">
              ${Checkbox({
                label: "Enable NTP Synchronization",
                name: "enabled",
                value: systemConfig.enabled,
                onChange: (e) =>
                  handleConfigChange("enabled", e.target.checked),
              })}
              ${systemConfig.enabled &&
              html`
                ${Input({
                  type: "text",
                  name: "server1",
                  label: "NTP Server",
                  value: systemConfig.server1,
                  onChange: (e) =>
                    handleConfigChange("server1", e.target.value),
                  required: true,
                  placeholder: "Enter NTP server",
                })}
                ${Select({
                  label: "Timezone",
                  name: "timezone",
                  value: systemConfig.timezone,
                  onChange: (e) =>
                    handleConfigChange("timezone", parseInt(e.target.value)),
                  options: TIMEZONE_OPTIONS,
                })}
              `}
            </div>
          </div>

          <!-- Web Server Settings Section -->
          <div class="bg-white rounded-lg shadow-md p-6">
            <h2 class="text-lg font-medium text-gray-900 mb-4">
              Web Server Settings
            </h2>

            <div class="space-y-4">
              ${Input({
                type: "number",
                name: "hport",
                label: "Webserver Port",
                extra: "(0~65535)",
                value: systemConfig.hport,
                onChange: (e) =>
                  handleConfigChange("hport", parseInt(e.target.value)),
                min: CONFIG.PORT_RANGE.min,
                max: CONFIG.PORT_RANGE.max,
                required: true,
              })}
              ${Input({
                type: "number",
                name: "wport",
                label: "WebSocket Port",
                extra: "(1~65535)",
                value: systemConfig.wport,
                onChange: (e) =>
                  handleConfigChange("wport", parseInt(e.target.value)),
                min: CONFIG.PORT_RANGE.min,
                max: CONFIG.PORT_RANGE.max,
                required: true,
              })}

              <!-- Add Log Method Selection -->
              <div class="mt-4">
                ${Select({
                  label: "Log Method",
                  name: "logMethod",
                  value: systemConfig.logMethod,
                  onChange: (e) =>
                    handleConfigChange("logMethod", parseInt(e.target.value)),
                  options: LOG_METHOD_OPTIONS,
                  required: true,
                })}
              </div>

              <div class="bg-yellow-50 border-l-4 border-yellow-400 p-4 mt-4">
                <div class="flex">
                  <div class="flex-shrink-0">
                    <${Icons.WarningIcon} className="h-5 w-5 text-yellow-400" />
                  </div>
                  <div class="ml-3">
                    <p class="text-sm text-yellow-700">
                      Note: Changing either the Webserver or WebSocket port will
                      require you to reconnect using the new port numbers.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <!-- Save Changes Button -->
      <div
        class="mt-8 border-t border-gray-200 pt-6 pb-4 flex justify-end gap-4 w-full"
      >
        <${Button}
          onClick=${() => {
            if (confirm("Are you sure you want to discard all changes?")) {
              fetchConfig();
            }
          }}
          variant="secondary"
          icon="CloseIcon"
          disabled=${isSaving}
        >
          Cancel
        <//>
        <${Button}
          onClick=${() => saveConfig()}
          disabled=${isSaving}
          loading=${isSaving}
          variant="primary"
          icon="SaveIcon"
          type="button"
        >
          ${isSaving ? "Saving..." : "Save"}
        <//>
      </div>
    </div>
  `;
}

export default System;

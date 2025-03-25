"use strict";
import { h, html, useState, useEffect, useMemo } from "../../bundle.js";
import { Icons, Button } from "../Components.js";

// Constants and configuration
const CONFIG = {
  DEFAULT_NETWORK: {
    ip: "192.168.1.100",
    sm: "255.255.255.0",
    gw: "192.168.1.1",
    d1: "8.8.8.8",
    d2: "8.8.4.4",
    dh: false,
  },
  API_TIMEOUT: 10000, // 10 seconds
  REBOOT_DELAY: 5000, // 5 seconds
  SUCCESS_MESSAGE_DURATION: 3000, // 3 seconds
  IP_PATTERN: /^(\d{1,3}\.){3}\d{1,3}$/,
  IP_RANGE: {
    min: 0,
    max: 255,
  },
};

function Network() {
  // State management
  const [networkConfig, setNetworkConfig] = useState({});
  const [isEditing, setIsEditing] = useState(false);
  const [editConfig, setEditConfig] = useState({});
  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  // Memoized validation functions
  const validateIpAddress = useMemo(
    () => (ip) => {
      if (!CONFIG.IP_PATTERN.test(ip)) return false;
      return ip.split(".").every((num) => {
        const value = parseInt(num);
        return value >= CONFIG.IP_RANGE.min && value <= CONFIG.IP_RANGE.max;
      });
    },
    []
  );

  const validateSubnetMask = useMemo(
    () => (mask) => {
      if (!CONFIG.IP_PATTERN.test(mask)) return false;

      // Convert to binary
      const binary = mask
        .split(".")
        .map((num) => parseInt(num).toString(2).padStart(8, "0"))
        .join("");

      // Check if it's a valid subnet mask (all 1s followed by all 0s)
      return /^1*0*$/.test(binary);
    },
    []
  );

  // Memoized error messages
  const errorMessages = useMemo(
    () => ({
      ip: "Please enter a valid IP address (e.g., 192.168.1.100)",
      sm: "Please enter a valid subnet mask (e.g., 255.255.255.0)",
      gw: "Please enter a valid gateway IP address",
      d1: "Please enter a valid primary DNS IP address",
      d2: "Please enter a valid secondary DNS IP address",
    }),
    []
  );

  const fetchNetworkConfig = async () => {
    try {
      setIsLoading(true);
      setLoadError("");

      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        CONFIG.API_TIMEOUT
      );

      const response = await fetch("/api/network/get", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(
          `Failed to fetch network configuration: ${response.statusText}`
        );
      }

      const data = await response.json();
      setNetworkConfig(data);
      setEditConfig(data);
    } catch (error) {
      console.error("Error fetching network configuration:", error);
      setLoadError(
        error.name === "AbortError"
          ? "Request timed out. Please try again."
          : error.message || "Failed to load network configuration"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = useMemo(
    () => (e) => {
      const { name, value, type, checked } = e.target;
      setEditConfig((prev) => ({
        ...prev,
        [name]: type === "checkbox" ? checked : value,
      }));
      // Clear error when user starts typing
      if (errors[name]) {
        setErrors((prev) => ({ ...prev, [name]: "" }));
      }
    },
    [errors]
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = {};

    // Validate IP Address
    if (!validateIpAddress(editConfig.ip)) {
      newErrors.ip = errorMessages.ip;
    }

    // Validate Subnet Mask
    if (!validateSubnetMask(editConfig.sm)) {
      newErrors.sm = errorMessages.sm;
    }

    // Validate Gateway
    if (!validateIpAddress(editConfig.gw)) {
      newErrors.gw = errorMessages.gw;
    }

    // Validate DNS servers
    if (!validateIpAddress(editConfig.d1)) {
      newErrors.d1 = errorMessages.d1;
    }
    if (!validateIpAddress(editConfig.d2)) {
      newErrors.d2 = errorMessages.d2;
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSaving(true);
    setSaveError("");
    setSaveSuccess(false);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        CONFIG.API_TIMEOUT
      );

      const response = await fetch("/api/network/set", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(editConfig),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(
          `Failed to save network configuration: ${response.statusText}`
        );
      }

      // Call reboot API after successful save
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

      const data = await response.json();
      setNetworkConfig(editConfig);
      setIsEditing(false);
      setErrors({});
      setSaveSuccess(true);

      // Show success message and update UI
      setTimeout(() => {
        setSaveSuccess(false);
      }, CONFIG.SUCCESS_MESSAGE_DURATION);

      // Refresh page after a delay to allow server to reboot
      setTimeout(() => {
        window.location.reload();
      }, CONFIG.REBOOT_DELAY);
    } catch (error) {
      console.error("Error saving network configuration:", error);
      setSaveError(
        error.name === "AbortError"
          ? "Request timed out. Please try again."
          : error.message || "Failed to save network configuration"
      );
      setIsSaving(false);
    }
  };

  // Memoized handlers
  const handleCancel = useMemo(
    () => () => {
      setIsEditing(false);
      setErrors({});
      setSaveError("");
    },
    []
  );

  const handleEdit = useMemo(
    () => () => {
      setEditConfig(networkConfig);
      setIsEditing(true);
    },
    [networkConfig]
  );

  // Load initial configuration
  useEffect(() => {
    document.title = "SBIOT-Network";
    fetchNetworkConfig();
  }, []);

  // Memoized UI components
  const LoadingSpinner = useMemo(
    () => html`
      <div class="flex items-center space-x-2">
        <svg
          class="animate-spin h-5 w-5 text-blue-600"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            class="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            stroke-width="4"
          ></circle>
          <path
            class="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
        <span class="text-gray-600">Loading network configuration...</span>
      </div>
    `,
    []
  );

  const ErrorMessage = useMemo(
    () => (message, onRetry) =>
      html`
        <div
          class="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded flex items-center justify-between"
        >
          <div>${message}</div>
          ${onRetry &&
          html`
            <button
              onClick=${onRetry}
              class="px-3 py-1 bg-red-200 hover:bg-red-300 rounded-md text-red-800 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              Retry
            </button>
          `}
        </div>
      `,
    []
  );

  const SuccessMessage = useMemo(
    () => (message) =>
      html`
        <div
          class="mb-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded"
        >
          ${message}
        </div>
      `,
    []
  );

  const NetworkField = useMemo(
    () =>
      ({ label, name, value, onChange, error, disabled, placeholder }) =>
        html`
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              ${label}
            </label>
            <input
              type="text"
              name=${name}
              value=${value}
              onChange=${onChange}
              disabled=${disabled}
              class="w-full px-3 py-2 border ${error
                ? "border-red-500"
                : "border-gray-300"} rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              placeholder=${placeholder}
            />
            ${error && html`<p class="mt-1 text-sm text-red-500">${error}</p>`}
          </div>
        `,
    []
  );

  const NetworkInfo = useMemo(
    () =>
      ({ label, value }) =>
        html`
          <div>
            <div class="text-sm font-medium text-gray-500">${label}</div>
            <div class="mt-1">${value}</div>
          </div>
        `,
    []
  );

  if (isLoading) {
    return html`
      <div class="p-6">
        <h1 class="text-2xl font-bold mb-6">Network Configuration</h1>
        <div
          class="bg-white rounded-lg shadow-md p-6 flex items-center justify-center"
        >
          ${LoadingSpinner}
        </div>
      </div>
    `;
  }

  return html`
    <div class="p-6">
      <h1 class="text-2xl font-bold mb-6">Network Configuration</h1>

      ${loadError && ErrorMessage(loadError, fetchNetworkConfig)}
      ${saveError && ErrorMessage(saveError)}
      ${saveSuccess &&
      SuccessMessage(
        "Network configuration saved successfully! System will reboot to apply changes..."
      )}

      <div class="bg-white rounded-lg shadow-md p-6">
        ${isEditing
          ? html`
              <form onSubmit=${handleSubmit} class="space-y-4">
                <div class="flex items-center mb-4">
                  <label class="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      name="dh"
                      checked=${editConfig.dh}
                      onChange=${handleInputChange}
                      class="form-checkbox h-5 w-5 text-blue-600"
                    />
                    <span class="ml-2 text-gray-700">Enable DHCP</span>
                  </label>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <${NetworkField}
                    label="IP Address"
                    name="ip"
                    value=${editConfig.ip}
                    onChange=${handleInputChange}
                    error=${errors.ip}
                    disabled=${editConfig.dh}
                    placeholder="192.168.1.100"
                  />
                  <${NetworkField}
                    label="Subnet Mask"
                    name="sm"
                    value=${editConfig.sm}
                    onChange=${handleInputChange}
                    error=${errors.sm}
                    disabled=${editConfig.dh}
                    placeholder="255.255.255.0"
                  />
                  <${NetworkField}
                    label="Gateway"
                    name="gw"
                    value=${editConfig.gw}
                    onChange=${handleInputChange}
                    error=${errors.gw}
                    disabled=${editConfig.dh}
                    placeholder="192.168.1.1"
                  />
                  <${NetworkField}
                    label="Primary DNS"
                    name="d1"
                    value=${editConfig.d1}
                    onChange=${handleInputChange}
                    error=${errors.d1}
                    disabled=${editConfig.dh}
                    placeholder="8.8.8.8"
                  />
                  <${NetworkField}
                    label="Secondary DNS"
                    name="d2"
                    value=${editConfig.d2}
                    onChange=${handleInputChange}
                    error=${errors.d2}
                    disabled=${editConfig.dh}
                    placeholder="8.8.4.4"
                  />
                </div>

                <div class="flex justify-end space-x-3 mt-6">
                  <button
                    type="button"
                    onClick=${handleCancel}
                    class="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    disabled=${isSaving}
                  >
                    Cancel
                  </button>
                  <${Button}
                    onClick=${handleSubmit}
                    disabled=${isSaving}
                    loading=${isSaving}
                    icon="SaveIcon"
                  >
                    ${isSaving ? "Saving..." : "Save Changes"}
                  <//>
                </div>
              </form>
            `
          : html`
              <div class="space-y-4">
                <div class="flex justify-between items-center mb-6">
                  <div class="text-xl font-semibold">Network Settings</div>
                  <button
                    onClick=${handleEdit}
                    class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Edit Settings
                  </button>
                </div>

                <div class="grid grid-cols-2 gap-4">
                  <${NetworkInfo}
                    label="DHCP Status"
                    value=${networkConfig.dh ? "Enabled" : "Disabled"}
                  />
                  <${NetworkInfo}
                    label="IP Address"
                    value=${networkConfig.ip}
                  />
                  <${NetworkInfo}
                    label="Subnet Mask"
                    value=${networkConfig.sm}
                  />
                  <${NetworkInfo} label="Gateway" value=${networkConfig.gw} />
                  <${NetworkInfo}
                    label="Primary DNS"
                    value=${networkConfig.d1}
                  />
                  <${NetworkInfo}
                    label="Secondary DNS"
                    value=${networkConfig.d2}
                  />
                </div>
              </div>
            `}
      </div>
    </div>
  `;
}

export default Network;

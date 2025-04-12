"use strict";
import { h, html, useState, useEffect, useMemo } from "../../bundle.js";
import { Icons, Button, Tabs, Input, Select, Checkbox } from "../Components.js";
import { useLanguage } from "../LanguageContext.js";

function Network() {
  const { t } = useLanguage();
  // State management
  const [networkConfig, setNetworkConfig] = useState({
    np: 0,
  });
  const [isEditing, setIsEditing] = useState(true);
  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("priority");

  // Constants and configuration
  const CONFIG = {
    DEFAULT_NETWORK: {
      ip: "192.168.0.100",
      sm: "255.255.255.0",
      gw: "192.168.0.1",
      d1: "8.8.8.8",
      d2: "8.8.4.4",
      dh: false,
    },
    NETWORK_PRIORITY: [
      [0, t("ethernetOnly")],
      [1, t("ethernet")],
      [2, t("lte")],
    ],
    SIM_SWITCH: [
      [0, t("externalSIM")],
      [1, t("internalSIM")],
      [2, t("dualCardBackup")],
    ],
    AUTH_TYPES: [
      [0, "NONE"],
      [1, "PAP"],
      [2, "CHAP"],
    ],
    API_TIMEOUT: 10000, // 10 seconds
    REBOOT_DELAY: 5000, // 5 seconds
    SUCCESS_MESSAGE_DURATION: 3000, // 3 seconds
    IP_PATTERN: /^(\d{1,3}\.){3}\d{1,3}$/,
    IP_RANGE: {
      min: 0,
      max: 255,
    },
  };

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

  const validateApnName = (apn) => {
    if (!apn) return "APN name is required";
    if (apn.length > 32) return "APN name must not exceed 32 characters";
    return null;
  };

  const validateUsername = (username) => {
    if (username && username.length > 32) {
      return "Username must not exceed 32 characters";
    }
    return null;
  };

  const validatePassword = (password) => {
    if (password && password.length > 32) {
      return "Password must not exceed 32 characters";
    }
    return null;
  };

  const fetchConfig = async () => {
    try {
      setIsLoading(true);
      setError(null);
      setLoadError("");

      const response = await fetch("/api/network/get", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch network configuration");
      }

      const data = await response.json();
      setNetworkConfig(data || {});
    } catch (err) {
      setError(err.message);
      setLoadError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = useMemo(
    () => (e) => {
      const { name, value, type, checked } = e.target;
      setNetworkConfig((prev) => ({
        ...prev,
        [name]:
          type === "checkbox"
            ? checked
            : type === "select-one"
            ? parseInt(value)
            : value,
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

    // Validate based on active tab
    if (activeTab === "ethernet") {
      if (!validateIpAddress(networkConfig.ip)) {
        newErrors.ip = errorMessages.ip;
      }
      if (!validateSubnetMask(networkConfig.sm)) {
        newErrors.sm = errorMessages.sm;
      }
      if (!validateIpAddress(networkConfig.gw)) {
        newErrors.gw = errorMessages.gw;
      }
      if (!validateIpAddress(networkConfig.d1)) {
        newErrors.d1 = errorMessages.d1;
      }
      if (!validateIpAddress(networkConfig.d2)) {
        newErrors.d2 = errorMessages.d2;
      }
    } else if (activeTab === "lte") {
      if (validateApnName(networkConfig.apn)) {
        newErrors.apn = validateApnName(networkConfig.apn);
      }
      if (validateUsername(networkConfig.lteUsername)) {
        newErrors.lteUsername = validateUsername(networkConfig.lteUsername);
      }
      if (validatePassword(networkConfig.ltePassword)) {
        newErrors.ltePassword = validatePassword(networkConfig.ltePassword);
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSaving(true);
    setSaveError("");
    setSaveSuccess(false);

    try {
      const response = await fetch("/api/network/set", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(networkConfig),
      });

      if (!response.ok) {
        throw new Error(
          `Failed to save network configuration: ${response.statusText}`
        );
      }

      // Call reboot API after successful save
      const rebootResponse = await fetch("/api/reboot/set", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!rebootResponse.ok) {
        throw new Error("Failed to reboot server");
      }

      const data = await response.json();
      setNetworkConfig(networkConfig);
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
      setNetworkConfig(networkConfig);
      setIsEditing(true);
    },
    [networkConfig]
  );

  // Load initial configuration
  useEffect(() => {
    document.title = "SBIOT-Network";
    fetchConfig();
  }, []);

  // console.table(networkConfig);

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
              ${t("retry")}
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

  const tabs = [
    { id: "priority", label: t("networkPriority") },
    { id: "ethernet", label: t("ethernet") },
    { id: "lte", label: t("lte"), disabled: networkConfig.np === 0 },
  ];

  if (isLoading) {
    return html`
      <div class="p-6">
        <h1 class="text-2xl font-bold mb-6">${t("networkConfig")}</h1>
        <div class="flex items-center justify-center h-full">
          <${Icons.SpinnerIcon} className="h-8 w-8 text-blue-600" />
        </div>
      </div>
    `;
  }

  return html`
    <div class="p-6">
      <h1 class="text-2xl font-bold mb-6">${t("networkConfig")}</h1>

      ${loadError && ErrorMessage(loadError, fetchConfig)}
      ${saveError && ErrorMessage(saveError)}
      ${saveSuccess &&
      SuccessMessage(
        "Network configuration saved successfully! System will reboot to apply changes..."
      )}

      <${Tabs}
        tabs=${tabs}
        activeTab=${activeTab}
        onTabChange=${setActiveTab}
      />
      <div class="max-w-2xl mx-auto">
        <div class="space-y-6">
          <div class="bg-white rounded-lg shadow-md p-6">
            <div class="text-xl font-semibold mb-6">
              ${t("networkSettings")}
            </div>
            <form onSubmit=${handleSubmit} class="space-y-4">
              ${activeTab === "priority"
                ? html`
                    ${Select({
                      name: "np",
                      label: t("networkPriority"),
                      value: networkConfig.np || 0,
                      onChange: handleInputChange,
                      options: CONFIG.NETWORK_PRIORITY,
                    })}
                  `
                : activeTab === "ethernet"
                ? html`
                    ${Checkbox({
                      name: "dh",
                      label: t("enableDHCP"),
                      value: networkConfig.dh,
                      onChange: handleInputChange,
                    })}
                    <${NetworkField}
                      label=${t("ipAddress")}
                      name="ip"
                      value=${networkConfig.ip}
                      onChange=${handleInputChange}
                      error=${errors.ip}
                      disabled=${networkConfig.dh}
                      placeholder="192.168.1.100"
                    />
                    <${NetworkField}
                      label=${t("subnetMask")}
                      name="sm"
                      value=${networkConfig.sm}
                      onChange=${handleInputChange}
                      error=${errors.sm}
                      disabled=${networkConfig.dh}
                      placeholder="255.255.255.0"
                    />
                    <${NetworkField}
                      label=${t("gateway")}
                      name="gw"
                      value=${networkConfig.gw}
                      onChange=${handleInputChange}
                      error=${errors.gw}
                      disabled=${networkConfig.dh}
                      placeholder="192.168.1.1"
                    />
                    <${NetworkField}
                      label=${t("primaryDNS")}
                      name="d1"
                      value=${networkConfig.d1}
                      onChange=${handleInputChange}
                      error=${errors.d1}
                      disabled=${networkConfig.dh}
                      placeholder="8.8.8.8"
                    />
                    <${NetworkField}
                      label=${t("secondaryDNS")}
                      name="d2"
                      value=${networkConfig.d2}
                      onChange=${handleInputChange}
                      error=${errors.d2}
                      disabled=${networkConfig.dh}
                      placeholder="8.8.4.4"
                    />
                  `
                : html`
                    <div class="space-y-4">
                      ${Select({
                        name: "mo",
                        label: t("simSwitch"),
                        value: networkConfig.mo || 0,
                        onChange: handleInputChange,
                        options: CONFIG.SIM_SWITCH,
                      })}
                      ${Input({
                        name: "apn",
                        label: t("apnName"),
                        value: networkConfig.apn || "",
                        onChange: handleInputChange,
                        maxlength: 32,
                        placeholder: "Enter APN name",
                        required: true,
                      })}
                      ${Input({
                        name: "au",
                        label: t("username"),
                        value: networkConfig.au || "",
                        onChange: handleInputChange,
                        maxlength: 32,
                        placeholder: "Enter username",
                        required: true,
                      })}
                      ${Input({
                        name: "ap",
                        label: t("password"),
                        value: networkConfig.ap || "",
                        onChange: handleInputChange,
                        maxlength: 32,
                        placeholder: "Enter password",
                        required: true,
                      })}
                      ${Select({
                        name: "at",
                        label: t("authType"),
                        value: networkConfig.at || 0,
                        onChange: handleInputChange,
                        options: CONFIG.AUTH_TYPES,
                      })}
                    </div>
                  `}
            </form>
          </div>
          <div class="flex justify-end gap-4">
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
              ${t("cancel")}
            <//>
            <${Button}
              onClick=${handleSubmit}
              disabled=${isSaving}
              loading=${isSaving}
              icon="SaveIcon"
            >
              ${isSaving ? t("saving") : t("save")}
            <//>
          </div>
        </div>
      </div>
    </div>
  `;
}

export default Network;

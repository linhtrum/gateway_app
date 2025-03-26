"use strict";
import { h, html, useState, useEffect } from "../../bundle.js";
import { Icons, Button } from "../Components.js";

// Constants and configuration
const CONFIG = {
  BAUD_RATES: [
    [9600, "9600"],
    [19200, "19200"],
    [38400, "38400"],
    [57600, "57600"],
    [115200, "115200"],
    [128000, "128000"],
    [256000, "256000"],
    [512000, "512000"],
    [921600, "921600"],
    [1000000, "1000000"],
    [2000000, "2000000"],
    [3000000, "3000000"],
    [4000000, "4000000"],
    [5000000, "5000000"],
    [6000000, "6000000"],
    [7000000, "7000000"],
    [8000000, "8000000"],
  ],
  DATA_BITS: [
    [5, "5"],
    [6, "6"],
    [7, "7"],
    [8, "8"],
  ],
  STOP_BITS: [
    [1, "1"],
    [1.5, "1.5"],
    [2, "2"],
  ],
  PARITY: [
    [0, "None"],
    [1, "Odd"],
    [2, "Even"],
    [3, "Mark"],
    [4, "Space"],
  ],
  FLOW_CONTROL: [
    [0, "None"],
    [1, "Hardware (RTS/CTS)"],
    [2, "Software (XON/XOFF)"],
  ],
};

function Serial() {
  // State management
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Serial configuration state
  const [serialConfig, setSerialConfig] = useState({
    enabled: false,
    port: "",
    baudRate: 115200,
    dataBits: 8,
    stopBits: 1,
    parity: 0,
    flowControl: 0,
    timeout: 1000,
    bufferSize: 1024,
  });

  // Fetch serial configuration
  const fetchSerialConfig = async () => {
    try {
      setIsLoading(true);
      setLoadError("");

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch("/api/serial/get", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(
          `Failed to fetch serial configuration: ${response.statusText}`
        );
      }

      const data = await response.json();
      setSerialConfig(data || serialConfig);
    } catch (error) {
      console.error("Error fetching serial configuration:", error);
      setLoadError(
        error.name === "AbortError"
          ? "Request timed out. Please try again."
          : error.message || "Failed to load serial configuration"
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Save serial configuration
  const saveSerialConfig = async () => {
    try {
      setIsSaving(true);
      setSaveError("");
      setSaveSuccess(false);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch("/api/serial/set", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(serialConfig),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(
          `Failed to save serial configuration: ${response.statusText}`
        );
      }

      setSaveSuccess(true);
      setIsSaving(false);

      // Show success message for 3 seconds
      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);

      // Refresh page after a delay to allow server to apply changes
      setTimeout(() => {
        window.location.reload();
      }, 5000);
    } catch (error) {
      console.error("Error saving serial configuration:", error);
      setSaveError(
        error.name === "AbortError"
          ? "Request timed out. Please try again."
          : error.message || "Failed to save serial configuration"
      );
      setIsSaving(false);
    }
  };

  // Handle configuration changes
  const handleConfigChange = (e) => {
    const { name, value, type, checked } = e.target;

    if (type === "checkbox") {
      setSerialConfig((prev) => ({
        ...prev,
        [name]: checked,
      }));
      return;
    }

    if (type === "number") {
      setSerialConfig((prev) => ({
        ...prev,
        [name]: parseInt(value) || 0,
      }));
      return;
    }

    setSerialConfig((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Load configuration on component mount
  useEffect(() => {
    document.title = "SBIOT-Serial";
    fetchSerialConfig();
  }, []);

  if (isLoading) {
    return html`
      <div class="p-6">
        <h1 class="text-2xl font-bold mb-6">Serial Port Configuration</h1>
        <div
          class="bg-white rounded-lg shadow-md p-6 flex items-center justify-center"
        >
          <div class="flex items-center space-x-2">
            <${Icons.SpinnerIcon} className="h-5 w-5 text-blue-600" />
            <span class="text-gray-600">Loading configuration...</span>
          </div>
        </div>
      </div>
    `;
  }

  return html`
    <div class="p-6">
      <h1 class="text-2xl font-bold mb-6">Serial Port Configuration</h1>

      ${loadError &&
      html`
        <div
          class="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded flex items-center justify-between"
        >
          <div>${loadError}</div>
          <button
            onClick=${fetchSerialConfig}
            class="px-3 py-1 bg-red-200 hover:bg-red-300 rounded-md text-red-800 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            Retry
          </button>
        </div>
      `}
      ${saveError &&
      html`
        <div
          class="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded"
        >
          ${saveError}
        </div>
      `}
      ${saveSuccess &&
      html`
        <div
          class="mb-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded"
        >
          Serial configuration saved successfully! System will reload to apply
          changes...
        </div>
      `}

      <div class="bg-white rounded-lg shadow-md p-6">
        <div class="space-y-6">
          <!-- Enable/Disable -->
          <div class="mb-6">
            <label class="flex items-center cursor-pointer">
              <input
                type="checkbox"
                name="enabled"
                checked=${serialConfig.enabled}
                onChange=${handleConfigChange}
                class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span class="ml-2 text-sm text-gray-700">Enable Serial Port</span>
            </label>
          </div>

          <!-- Port Selection -->
          <div class="mb-6">
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Serial Port
            </label>
            <input
              type="text"
              name="port"
              value=${serialConfig.port}
              onChange=${handleConfigChange}
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled=${!serialConfig.enabled}
              placeholder="Enter serial port (e.g., /dev/ttyUSB0)"
            />
          </div>

          <!-- Baud Rate -->
          <div class="mb-6">
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Baud Rate
            </label>
            <select
              name="baudRate"
              value=${serialConfig.baudRate}
              onChange=${handleConfigChange}
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled=${!serialConfig.enabled}
            >
              ${CONFIG.BAUD_RATES.map(
                ([value, label]) => html`
                  <option value=${value}>${label}</option>
                `
              )}
            </select>
          </div>

          <!-- Data Bits -->
          <div class="mb-6">
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Data Bits
            </label>
            <select
              name="dataBits"
              value=${serialConfig.dataBits}
              onChange=${handleConfigChange}
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled=${!serialConfig.enabled}
            >
              ${CONFIG.DATA_BITS.map(
                ([value, label]) => html`
                  <option value=${value}>${label}</option>
                `
              )}
            </select>
          </div>

          <!-- Stop Bits -->
          <div class="mb-6">
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Stop Bits
            </label>
            <select
              name="stopBits"
              value=${serialConfig.stopBits}
              onChange=${handleConfigChange}
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled=${!serialConfig.enabled}
            >
              ${CONFIG.STOP_BITS.map(
                ([value, label]) => html`
                  <option value=${value}>${label}</option>
                `
              )}
            </select>
          </div>

          <!-- Parity -->
          <div class="mb-6">
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Parity
            </label>
            <select
              name="parity"
              value=${serialConfig.parity}
              onChange=${handleConfigChange}
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled=${!serialConfig.enabled}
            >
              ${CONFIG.PARITY.map(
                ([value, label]) => html`
                  <option value=${value}>${label}</option>
                `
              )}
            </select>
          </div>

          <!-- Flow Control -->
          <div class="mb-6">
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Flow Control
            </label>
            <select
              name="flowControl"
              value=${serialConfig.flowControl}
              onChange=${handleConfigChange}
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled=${!serialConfig.enabled}
            >
              ${CONFIG.FLOW_CONTROL.map(
                ([value, label]) => html`
                  <option value=${value}>${label}</option>
                `
              )}
            </select>
          </div>

          <!-- Timeout -->
          <div class="mb-6">
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Timeout (ms)
            </label>
            <input
              type="number"
              name="timeout"
              value=${serialConfig.timeout}
              onChange=${handleConfigChange}
              min="0"
              max="10000"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled=${!serialConfig.enabled}
            />
          </div>

          <!-- Buffer Size -->
          <div class="mb-6">
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Buffer Size (bytes)
            </label>
            <input
              type="number"
              name="bufferSize"
              value=${serialConfig.bufferSize}
              onChange=${handleConfigChange}
              min="64"
              max="4096"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled=${!serialConfig.enabled}
            />
          </div>
        </div>
      </div>

      <!-- Save and Cancel Buttons -->
      <div
        class="mt-8 border-t border-gray-200 pt-6 pb-4 flex justify-end gap-4"
      >
        <${Button}
          onClick=${() => {
            if (confirm("Are you sure you want to discard all changes?")) {
              fetchSerialConfig();
            }
          }}
          variant="secondary"
          icon="CloseIcon"
          disabled=${isSaving}
        >
          Cancel
        <//>
        <${Button}
          onClick=${saveSerialConfig}
          disabled=${isSaving}
          loading=${isSaving}
          icon="SaveIcon"
        >
          Save Configuration
        <//>
      </div>
    </div>
  `;
}

export default Serial;

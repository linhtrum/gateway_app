"use strict";
import { h, html, useState, useEffect } from "../../bundle.js";
import { Icons, Button } from "../Components.js";

function Serial() {
  const [serialConfig, setSerialConfig] = useState({
    port: "",
    baudRate: 9600,
    dataBits: 8,
    parity: 0,
    stopBits: 1,
    flowControl: 0,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Available options for serial configuration
  const BAUD_RATES = [300, 600, 1200, 2400, 4800, 9600, 14400, 19200, 28800, 38400, 57600, 115200];
  const DATA_BITS = [7, 8];
  const PARITY_OPTIONS = [
    { value: 0, label: "None" },
    { value: 1, label: "Odd" },
    { value: 2, label: "Even" },
  ];
  const STOP_BITS = [1, 2];
  const FLOW_CONTROL_OPTIONS = [
    { value: 0, label: "None" },
    { value: 1, label: "Hardware" },
    { value: 2, label: "Software" },
  ];

  const fetchSerialConfig = async () => {
    try {
      setIsLoading(true);
      setLoadError("");

      const response = await fetch("/api/serial/get", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch serial configuration: ${response.statusText}`);
      }

      const data = await response.json();
      setSerialConfig(data || {
        port: "",
        baudRate: 9600,
        dataBits: 8,
        parity: 0,
        stopBits: 1,
        flowControl: 0,
      });
    } catch (error) {
      console.error("Error fetching serial configuration:", error);
      setLoadError(error.message || "Failed to load serial configuration");
    } finally {
      setIsLoading(false);
    }
  };

  const saveSerialConfig = async () => {
    try {
      setIsSaving(true);
      setSaveError("");
      setSaveSuccess(false);

      // Validate configuration
      if (!serialConfig.port) {
        throw new Error("Serial port is required");
      }

      const response = await fetch("/api/serial/set", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(serialConfig),
      });

      if (!response.ok) {
        throw new Error(`Failed to save serial configuration: ${response.statusText}`);
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

      setSaveSuccess(true);
      setIsSaving(false);

      // Show success message for 3 seconds
      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);

      // Refresh page after a delay to allow server to reboot
      setTimeout(() => {
        window.location.reload();
      }, 5000);
    } catch (error) {
      console.error("Error saving serial configuration:", error);
      setSaveError(error.message || "Failed to save serial configuration");
      setIsSaving(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type } = e.target;
    if (type === "number") {
      setSerialConfig((prev) => ({
        ...prev,
        [name]: parseInt(value),
      }));
      return;
    }

    if (type === "select-one") {
      setSerialConfig((prev) => ({
        ...prev,
        [name]: parseInt(value),
      }));
      return;
    }
    
    setSerialConfig((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  useEffect(() => {
    document.title = "SBIOT-Serial";
    fetchSerialConfig();
  }, []);

  console.log(JSON.stringify(serialConfig));

  if (isLoading) {
    return html`
      <div class="p-6">
        <h1 class="text-2xl font-bold mb-6">Serial Configuration</h1>
        <div class="bg-white rounded-lg shadow-md p-6 flex items-center justify-center">
          <div class="flex items-center space-x-2">
            <${Icons.SpinnerIcon} className="h-5 w-5 text-blue-600" />
            <span class="text-gray-600">Loading serial configuration...</span>
          </div>
        </div>
      </div>
    `;
  }

  return html`
    <div class="p-6">
      <h1 class="text-2xl font-bold mb-6">Serial Configuration</h1>

      ${loadError &&
      html`
        <div class="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded flex items-center justify-between">
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
        <div class="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          ${saveError}
        </div>
      `}
      ${saveSuccess &&
      html`
        <div class="mb-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded">
          Serial configuration saved successfully! System will reboot to apply changes...
        </div>
      `}

      <div class="max-w-2xl mx-auto">
          <div class="bg-white rounded-lg shadow-md p-6">
            <form class="space-y-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">
                    Serial Port
                  </label>
                  <input
                    type="text"
                    name="port"
                    value=${serialConfig.port}
                    onChange=${handleInputChange}
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., /dev/ttyUSB0"
                    required
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">
                    Baud Rate
                  </label>
                  <select
                    name="baudRate"
                    value=${serialConfig.baudRate}
                    onChange=${handleInputChange}
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    ${BAUD_RATES.map(
                      (rate) => html`
                        <option value=${rate}>${rate}</option>
                      `
                    )}
                  </select>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">
                    Data Bits
                  </label>
                  <select
                    name="dataBits"
                    value=${serialConfig.dataBits}
                    onChange=${handleInputChange}
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    ${DATA_BITS.map(
                      (bits) => html`
                        <option value=${bits}>${bits}</option>
                      `
                    )}
                  </select>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">
                    Parity
                  </label>
                  <select
                    name="parity"
                    value=${serialConfig.parity}
                    onChange=${handleInputChange}
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    ${PARITY_OPTIONS.map(
                      (option) => html`
                        <option value=${option.value}>${option.label}</option>
                      `
                    )}
                  </select>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">
                    Stop Bits
                  </label>
                  <select
                    name="stopBits"
                    value=${serialConfig.stopBits}
                    onChange=${handleInputChange}
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    ${STOP_BITS.map(
                      (bits) => html`
                        <option value=${bits}>${bits}</option>
                      `
                    )}
                  </select>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">
                    Flow Control
                  </label>
                  <select
                    name="flowControl"
                    value=${serialConfig.flowControl}
                    onChange=${handleInputChange}
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    ${FLOW_CONTROL_OPTIONS.map(
                      (option) => html`
                        <option value=${option.value}>${option.label}</option>
                      `
                    )}
                  </select>
                </div>
                <div class="flex justify-end space-x-3">
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
                  ${isSaving ? "Saving..." : "Save"}
                <//>
              </div>
            </form>
          </div>
      </div>
    </div>
  `;
}

export default Serial; 
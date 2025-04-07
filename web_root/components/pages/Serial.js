"use strict";
import { h, html, useState, useEffect } from "../../bundle.js";
import { Icons, Button, Tabs, Input, Select, Checkbox } from "../Components.js";

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
  WORKING_MODES: [
    [0, "UDP Client"],
    [1, "TCP Client"],
    [2, "UDP Server"],
    [3, "TCP Server"],
    [4, "HTTP Client"],
  ],
};

function Serial() {
  // State management
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState("port");

  // Serial configuration state
  const [serialConfig, setSerialConfig] = useState({
    port: "/dev/ttymxc1",
    baudRate: 115200,
    dataBits: 8,
    stopBits: 1,
    parity: 0,
    flowControl: 0,
    timeout: 0,
    bufferSize: 0,
  });

  // Socket configuration state
  const [socketConfig, setSocketConfig] = useState({
    enabled: false,
    workingMode: 0,
    remoteServerAddr: "",
    localPort: 0,
    remotePort: 1,
  });

  // Fetch configurations
  const fetchConfigs = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [serialResponse, socketResponse] = await Promise.all([
        fetch("/api/serial/get", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }),
        fetch("/api/socket/get", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }),
      ]);

      if (!serialResponse.ok || !socketResponse.ok) {
        throw new Error("Failed to fetch configurations");
      }

      const [serialData, socketData] = await Promise.all([
        serialResponse.json(),
        socketResponse.json(),
      ]);

      setSerialConfig(serialData || {});
      setSocketConfig(socketData || {});
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Save configurations
  const saveConfigs = async () => {
    try {
      setIsSaving(true);
      setError(null);
      setSuccess(false);

      const [serialResponse, socketResponse] = await Promise.all([
        fetch("/api/serial/set", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(serialConfig),
        }),
        fetch("/api/socket/set", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(socketConfig),
        }),
      ]);

      if (!serialResponse.ok || !socketResponse.ok) {
        throw new Error("Failed to save configurations");
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

  // Handle configuration changes
  const handleConfigChange = (e, configType) => {
    const { name, value, type, checked } = e.target;
    const config = configType === "serial" ? serialConfig : socketConfig;
    const setConfig =
      configType === "serial" ? setSerialConfig : setSocketConfig;

    if (type === "checkbox") {
      setConfig((prev) => ({
        ...prev,
        [name]: checked,
      }));
      return;
    }

    if (type === "number") {
      setConfig((prev) => ({
        ...prev,
        [name]: parseInt(value) || 0,
      }));
      return;
    }

    setConfig((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Load configuration on component mount
  useEffect(() => {
    document.title = "SBIOT-Serial";
    fetchConfigs();
  }, []);

  if (isLoading) {
    return html`
      <div class="p-6">
        <h1 class="text-2xl font-bold mb-6">Serial Configuration</h1>
        <div class="flex items-center justify-center h-full">
          <${Icons.SpinnerIcon} className="h-8 w-8 text-blue-600" />
        </div>
      </div>
    `;
  }

  const tabs = [
    { id: "port", label: "PORT" },
    { id: "socket", label: "SOCKET" },
  ];

  return html`
    <div class="p-6">
      <h1 class="text-2xl font-bold mb-6">Serial Port Configuration</h1>

      ${error &&
      html`
        <div
          class="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded flex items-center justify-between"
        >
          <div>${error}</div>
          <button
            onClick=${fetchConfigs}
            class="px-3 py-1 bg-red-200 hover:bg-red-300 rounded-md text-red-800 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            Retry
          </button>
        </div>
      `}
      ${success &&
      html`
        <div
          class="mb-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded"
        >
          Configuration saved successfully! System will reload to apply
          changes...
        </div>
      `}

      <${Tabs}
        tabs=${tabs}
        activeTab=${activeTab}
        onTabChange=${setActiveTab}
      />

      <div class="max-w-2xl mx-auto">
        <div class="bg-white rounded-lg shadow-md p-6">
          ${activeTab === "port"
            ? html`
                <div class="space-y-2">
                  <!-- Port Selection -->
                  ${Input({
                    type: "text",
                    name: "port",
                    label: "Serial Port",
                    value: serialConfig.port,
                    onChange: (e) => handleConfigChange(e, "serial"),
                    placeholder: "Enter serial port (e.g., /dev/ttyUSB0)",
                    disabled: true,
                  })}

                  <!-- Baud Rate -->
                  ${Select({
                    name: "baudRate",
                    label: "Baud Rate",
                    value: serialConfig.baudRate,
                    onChange: (e) => handleConfigChange(e, "serial"),
                    options: CONFIG.BAUD_RATES,
                  })}

                  <!-- Data Bits -->
                  ${Select({
                    name: "dataBits",
                    label: "Data Bits",
                    value: serialConfig.dataBits,
                    onChange: (e) => handleConfigChange(e, "serial"),
                    options: CONFIG.DATA_BITS,
                  })}

                  <!-- Stop Bits -->
                  ${Select({
                    name: "stopBits",
                    label: "Stop Bits",
                    value: serialConfig.stopBits,
                    onChange: (e) => handleConfigChange(e, "serial"),
                    options: CONFIG.STOP_BITS,
                  })}

                  <!-- Parity -->
                  ${Select({
                    name: "parity",
                    label: "Parity",
                    value: serialConfig.parity,
                    onChange: (e) => handleConfigChange(e, "serial"),
                    options: CONFIG.PARITY,
                  })}

                  <!-- Flow Control -->
                  ${Select({
                    name: "flowControl",
                    label: "Flow Control",
                    value: serialConfig.flowControl,
                    onChange: (e) => handleConfigChange(e, "serial"),
                    options: CONFIG.FLOW_CONTROL,
                  })}

                  <!-- Timeout -->
                  ${Input({
                    type: "number",
                    name: "timeout",
                    label: "Timeout",
                    value: serialConfig.timeout,
                    onChange: (e) => handleConfigChange(e, "serial"),
                    min: 0,
                    max: 255,
                    required: true,
                  })}

                  <!-- Buffer Size -->
                  ${Input({
                    type: "number",
                    name: "bufferSize",
                    label: "Buffer Size",
                    value: serialConfig.bufferSize,
                    onChange: (e) => handleConfigChange(e, "serial"),
                    min: 0,
                    max: 1460,
                    required: true,
                  })}
                </div>
              `
            : html`
                <div class="space-y-2">
                  <!-- Enable/Disable -->
                  ${Checkbox({
                    name: "enabled",
                    label: "Enable Socket",
                    value: socketConfig.enabled,
                    onChange: (e) => handleConfigChange(e, "socket"),
                  })}
                  ${socketConfig.enabled &&
                  html`
                    <!-- Working Mode -->
                    ${Select({
                      name: "workingMode",
                      label: "Working Mode",
                      value: socketConfig.workingMode,
                      onChange: (e) => handleConfigChange(e, "socket"),
                      options: CONFIG.WORKING_MODES,
                    })}

                    <!-- Remote Server Address -->
                    ${Input({
                      type: "text",
                      name: "remoteServerAddr",
                      label: "Remote Server Address",
                      value: socketConfig.remoteServerAddr,
                      onChange: (e) => handleConfigChange(e, "socket"),
                      maxlength: 64,
                      placeholder: "Enter remote server address",
                    })}

                    <!-- Local Port -->
                    ${Input({
                      type: "number",
                      name: "localPort",
                      label: "Local Port",
                      extra: "(0~65535)",
                      value: socketConfig.localPort,
                      onChange: (e) => handleConfigChange(e, "socket"),
                      min: 0,
                      max: 65535,
                      required: true,
                    })}

                    <!-- Remote Port -->
                    ${Input({
                      type: "number",
                      name: "remotePort",
                      label: "Remote Port",
                      extra: "(1~65535)",
                      value: socketConfig.remotePort,
                      onChange: (e) => handleConfigChange(e, "socket"),
                      min: 1,
                      max: 65535,
                      required: true,
                    })}
                  `}
                </div>
              `}
        </div>
      </div>

      <!-- Save and Cancel Buttons -->
      <div
        class="mt-8 border-t border-gray-200 pt-6 pb-4 flex justify-end gap-4 w-full"
      >
        <${Button}
          onClick=${() => {
            if (confirm("Are you sure you want to discard all changes?")) {
              fetchConfigs();
            }
          }}
          variant="secondary"
          icon="CloseIcon"
          disabled=${isSaving}
        >
          Cancel
        <//>
        <${Button}
          onClick=${saveConfigs}
          disabled=${isSaving}
          loading=${isSaving}
          icon="SaveIcon"
        >
          ${isSaving ? "Saving..." : "Save"}
        <//>
      </div>
    </div>
  `;
}

export default Serial;

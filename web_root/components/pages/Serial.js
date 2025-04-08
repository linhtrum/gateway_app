"use strict";
import { h, html, useState, useEffect } from "../../bundle.js";
import {
  Icons,
  Button,
  Tabs,
  Input,
  Select,
  Checkbox,
  FileInput,
} from "../Components.js";

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
  MAX_SOCKETS: [
    [0, "1"],
    [1, "2"],
    [2, "3"],
    [3, "4"],
    [4, "5"],
    [5, "6"],
    [6, "7"],
    [7, "8"],
    [8, "9"],
    [9, "10"],
    [10, "11"],
    [11, "12"],
    [12, "13"],
    [13, "14"],
    [14, "15"],
    [15, "16"],
  ],
  EXEED_MODES: [
    [0, "KICK"],
    [1, "KEEP"],
  ],
  SOCK_MODES: [
    [0, "None", [0, 1, 2, 3, 4]],
    [1, "Multicast", [0]],
    [2, "ModbusTCP", [1, 3]],
    [3, "Short Connection", [1]],
    [4, "Both are supported", [1]],
  ],
  HEARTBEAT_TYPES: [
    [0, "None"],
    [1, "User defined"],
    [2, "Device IMEI"],
    [3, "Device SN"],
    [4, "Device ICCID"],
    [5, "MAC Address"],
  ],
  HEARTBEAT_PACKET_TYPES: [
    [0, "ASCII"],
    [1, "HEX"],
  ],
  REGISTRATION_TYPES: [
    [0, "None"],
    [1, "User defined"],
    [2, "Device IMEI"],
    [3, "Device SN"],
    [4, "Device ICCID"],
    [5, "MAC Address"],
  ],
  REGISTRATION_PACKET_TYPES: [
    [0, "ASCII"],
    [1, "HEX"],
  ],
  REGISTRATION_PACKET_LOCATION: [
    [0, "Once connecting"],
    [1, "Prefix of Data"],
    [2, "Both are supported"],
  ],
  HTTP_METHODS: [
    [0, "GET"],
    [1, "POST"],
  ],
  MAX_HTTP_HEADER_BYTES: 181,
  SSL_PROTOCOLS: [
    [0, "Disable SSL"],
    [1, "TLS1.0"],
    [2, "TLS1.2"],
  ],
  SSL_VERIFY_OPTIONS: [
    [0, "None"],
    [1, "Verify Server Certificate"],
    [2, "Verify all"],
  ],
};

// Add conversion functions
const convertToHex = (str) => {
  return str
    .split("")
    .map((char) => char.charCodeAt(0).toString(16))
    .join("");
};

const convertFromHex = (hex) => {
  return hex
    .match(/.{1,2}/g)
    .map((byte) => String.fromCharCode(parseInt(byte, 16)))
    .join("");
};

const validateHexInput = (input) => {
  if (!input) return true; // Empty input is valid
  const cleanInput = input.replace(/\s/g, "").toUpperCase();
  return /^[0-9A-F]+$/.test(cleanInput);
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
    enabled: false, // Enable Socket
    workingMode: 0, // Working Mode
    remoteServerAddr: "192.168.1.100", // Remote Server Address
    localPort: 0, // Local Port
    remotePort: 23, // Remote Port
    sockMode: 0, // Socket Mode
    maxSockets: 8, // Maximum Sockets supported
    heartbeatType: 0, // Heartbeat Type
    heartbeatPacketType: 0, // Heartbeat Packet Type
    heartbeatPacket: "www.sbiot.com", // Heartbeat Packet
    registrationType: 0, // Registration Type
    registrationPacketType: 0, // Registration Packet Type
    registrationPacket: "www.sbiot.com", // Registration Packet
    registrationPacketLocation: 0, // Registration Packet Location
    httpMethod: 0, // HTTP Method
    sslProtocol: 0, // SSL Protocol
    sslVerifyOption: 0, // SSL Verify Option
    serverCA: "", // Server CA
    clientCertificate: "", // Client Cert
    clientKey: "", // Client Key
    httpUrl: "/api/data", // HTTP URL
    httpHeader: "Content-Type: application/json", // HTTP Header
    removeHeader: false, // Remove Header
    modbusPoll: false, // Modbus Poll
    udpCheckPort: false, // UDP check port
    modbusTcpException: false, // Modbus TCP Exception
    shortConnectionDuration: 0, // Short Connection Duration
    reconnectionPeriod: 0, // Reconnection Period
    responseTimeout: 0, // Response Timeout
    execeedMode: 0, // Exceed Mode
    heartbeatInterval: 0, // Heartbeat Interval
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

    if (type === "number" || type === "select-one") {
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

  const getStringBytes = (str) => {
    return new TextEncoder().encode(str).length;
  };

  const handlePacketTypeChange = (e, configType, fieldName) => {
    const { name, value } = e.target;
    const config = configType === "serial" ? serialConfig : socketConfig;
    const setConfig =
      configType === "serial" ? setSerialConfig : setSocketConfig;

    // Get the current packet value
    const currentPacket = config[fieldName] || "";

    // Convert based on the new type
    const convertedPacket =
      parseInt(value) === 1
        ? convertToHex(currentPacket)
        : convertFromHex(currentPacket);

    setConfig((prev) => ({
      ...prev,
      [fieldName]: convertedPacket,
      [name]: parseInt(value),
    }));
  };

  const handlePacketInput = (e, configType, fieldName, packetType) => {
    const { value } = e.target;
    const config = configType === "serial" ? serialConfig : socketConfig;
    const setConfig =
      configType === "serial" ? setSerialConfig : setSocketConfig;

    // If packet type is HEX (1), validate the input
    if (parseInt(packetType) === 1) {
      if (!validateHexInput(value)) {
        setError(
          `Invalid hex format in ${fieldName}. Only 0-9 and A-F are allowed.`
        );
        return;
      }
      setError(null);
    }

    setConfig((prev) => ({
      ...prev,
      [fieldName]: value,
    }));
  };

  // Load configuration on component mount
  useEffect(() => {
    document.title = "SBIOT-Serial";
    fetchConfigs();
  }, []);

  // console.log(JSON.stringify(socketConfig));

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
        <div class="space-y-6">
          <div class="bg-white rounded-lg shadow-md p-6">
            ${activeTab === "port"
              ? html`
                  <div class="space-y-4">
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
                      label: "Serial Packet Time",
                      extra: "(0~255)ms",
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
                      label: "Serial Packet Length",
                      extra: "(0~1460)bytes",
                      value: serialConfig.bufferSize,
                      onChange: (e) => handleConfigChange(e, "serial"),
                      min: 0,
                      max: 1460,
                      required: true,
                    })}
                  </div>
                `
              : html`
                  <div class="space-y-4">
                    <!-- Enable/Disable -->
                    ${Checkbox({
                      name: "enabled",
                      label_extra: "Enable Socket",
                      value: socketConfig.enabled,
                      onChange: (e) => handleConfigChange(e, "socket"),
                    })}
                    ${socketConfig.enabled &&
                    html`
                      <!-- Working Mode -->

                      <div class="grid grid-cols-2 gap-4">
                        ${Select({
                          name: "workingMode",
                          label: "Working Mode",
                          value: socketConfig.workingMode,
                          onChange: (e) => {
                            setSocketConfig({
                              ...socketConfig,
                              workingMode: parseInt(e.target.value),
                              sockMode: 0,
                            });
                          },
                          options: CONFIG.WORKING_MODES,
                        })}
                        <!-- Socket Mode -->
                        <div>
                          <label
                            class="block text-sm font-medium text-gray-700 mb-1"
                          >
                            Socket Mode
                          </label>
                          <select
                            name="sockMode"
                            value=${socketConfig.sockMode}
                            onChange=${(e) => handleConfigChange(e, "socket")}
                            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            ${CONFIG.SOCK_MODES.map(
                              (mode) =>
                                html`<option
                                  value=${mode[0]}
                                  hidden=${!mode[2].includes(
                                    socketConfig.workingMode
                                  )}
                                >
                                  ${mode[1]}
                                </option>`
                            )}
                          </select>
                        </div>
                      </div>
                      ${socketConfig.workingMode === 4 &&
                      html`
                        <div class="grid grid-cols-2 gap-4">
                          ${Select({
                            name: "httpMethod",
                            label: "HTTP Method",
                            value: socketConfig.httpMethod,
                            onChange: (e) => handleConfigChange(e, "socket"),
                            options: CONFIG.HTTP_METHODS,
                          })}
                          ${Checkbox({
                            name: "removeHeader",
                            label: "Remove Httpd Header",
                            value: socketConfig.removeHeader,
                            onChange: (e) => handleConfigChange(e, "socket"),
                          })}
                        </div>
                        ${Input({
                          type: "text",
                          name: "httpUrl",
                          label: "HTTP URL",
                          extra: "(1~101)",
                          value: socketConfig.httpUrl,
                          onChange: (e) => handleConfigChange(e, "socket"),
                          maxlength: "101",
                          placeholder: "Enter http url",
                          required: socketConfig.workingMode === 4,
                        })}
                        <div class="relative">
                          <label
                            class="block text-sm font-medium text-gray-700 mb-1"
                          >
                            HTTP Header
                          </label>
                          <textarea
                            name="httpHeader"
                            value=${socketConfig.httpHeader}
                            onChange=${(e) => handleConfigChange(e, "socket")}
                            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            maxlength="181"
                            placeholder="Enter http header"
                            rows="3"
                          ></textarea>
                          <div
                            class="absolute right-2 bottom-2 text-xs text-gray-500"
                          >
                            ${getStringBytes(
                              socketConfig.httpHeader
                            )}/${CONFIG.MAX_HTTP_HEADER_BYTES}
                            bytes
                          </div>
                        </div>
                      `}
                      ${socketConfig.workingMode === 3 &&
                      html`
                        <div class="grid grid-cols-2 gap-4">
                          ${Select({
                            name: "maxSockets",
                            label: "Maximum Sockets supported",
                            value: socketConfig.maxSockets,
                            onChange: (e) => handleConfigChange(e, "socket"),
                            options: CONFIG.MAX_SOCKETS,
                          })}
                          ${Select({
                            name: "execeedMode",
                            label: "Exceeding Maximum",
                            value: socketConfig.execeedMode,
                            onChange: (e) => handleConfigChange(e, "socket"),
                            options: CONFIG.EXEED_MODES,
                          })}
                        </div>
                      `}
                      ${socketConfig.workingMode != 3 &&
                      html`
                        <div class="grid grid-cols-2 gap-4">
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
                        </div>
                      `}

                      <div class="grid grid-cols-2 gap-4">
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
                        ${socketConfig.workingMode != 3 &&
                        html` <!-- Remote Port -->
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
                          })}`}
                      </div>
                      ${socketConfig.workingMode === 1 &&
                      html`
                        <div class="grid grid-cols-2 gap-4">
                          ${Input({
                            type: "number",
                            name: "reconnectionPeriod",
                            label: "Reconnection period",
                            extra: "(0~99999)s",
                            value: socketConfig.reconnectionPeriod,
                            onChange: (e) => handleConfigChange(e, "socket"),
                            min: 0,
                            max: 99999,
                            required: socketConfig.workingMode === 1,
                          })}
                          ${socketConfig.sockMode > 2 &&
                          html`
                            ${Input({
                              type: "number",
                              name: "shortConnectionDuration",
                              label: "Duration of short connection",
                              extra: "(3~225)s",
                              value: socketConfig.shortConnectionDuration,
                              onChange: (e) => handleConfigChange(e, "socket"),
                              min: 3,
                              max: 225,
                              required: socketConfig.workingMode === 1,
                            })}
                          `}
                        </div>
                      `}
                      ${(socketConfig.workingMode === 1 ||
                        socketConfig.workingMode === 3) &&
                      html`
                        <div class="grid grid-cols-2 gap-4">
                          ${Checkbox({
                            name: "modbusPoll",
                            label: "Modbus Poll",
                            value: socketConfig.modbusPoll,
                            onChange: (e) => handleConfigChange(e, "socket"),
                          })}
                          ${Input({
                            type: "number",
                            name: "responseTimeout",
                            label: "Response Timeout",
                            extra: "(10~9999)ms",
                            value: socketConfig.responseTimeout,
                            onChange: (e) => handleConfigChange(e, "socket"),
                            min: 10,
                            max: 9999,
                            required: socketConfig.modbusPoll,
                            disabled: !socketConfig.modbusPoll,
                          })}
                        </div>
                      `}
                      ${(socketConfig.sockMode === 2 ||
                        socketConfig.sockMode === 4) &&
                      html`
                        <div class="grid grid-cols-2 gap-4">
                          ${Checkbox({
                            name: "modbusTcpException",
                            label: "Modbus TCP Exception",
                            value: socketConfig.modbusTcpException,
                            onChange: (e) => handleConfigChange(e, "socket"),
                          })}
                        </div>
                      `}
                      ${socketConfig.workingMode === 0 &&
                      html`
                        ${Checkbox({
                          name: "udpCheckPort",
                          label: "UDP Check Port",
                          value: socketConfig.udpCheckPort,
                          onChange: (e) => handleConfigChange(e, "socket"),
                        })}
                      `}
                      ${socketConfig.workingMode < 3 &&
                      html`
                        <div class="grid grid-cols-2 gap-4">
                          ${Select({
                            name: "heartbeatType",
                            label: "Net Heartbeat Type",
                            value: socketConfig.heartbeatType,
                            onChange: (e) => handleConfigChange(e, "socket"),
                            options: CONFIG.HEARTBEAT_TYPES,
                          })}
                          ${Input({
                            type: "number",
                            name: "heartbeatInterval",
                            extra: "(1~65535)s",
                            label: "Net Heartbeat Interval",
                            value: socketConfig.heartbeatInterval,
                            onChange: (e) => handleConfigChange(e, "socket"),
                            min: 1,
                            max: 65535,
                            required: socketConfig.heartbeatType !== 0,
                            disabled: socketConfig.heartbeatType === 0,
                          })}
                        </div>

                        ${socketConfig.heartbeatType === 1 &&
                        html`
                          <div class="grid grid-cols-2 gap-4">
                            ${Input({
                              type: "text",
                              name: "heartbeatPacket",
                              label: "Net Heartbeat Packet",
                              extra: "(1~100) bytes",
                              value: socketConfig.heartbeatPacket,
                              onChange: (e) =>
                                handlePacketInput(
                                  e,
                                  "socket",
                                  "heartbeatPacket",
                                  socketConfig.heartbeatPacketType
                                ),
                              required: socketConfig.heartbeatType === 1,
                              maxlength: 100,
                            })}
                            ${Select({
                              name: "heartbeatPacketType",
                              label: "Net Heartbeat Packet Type",
                              value: socketConfig.heartbeatPacketType,
                              onChange: (e) =>
                                handlePacketTypeChange(
                                  e,
                                  "socket",
                                  "heartbeatPacket"
                                ),
                              options: CONFIG.HEARTBEAT_PACKET_TYPES,
                            })}
                          </div>
                        `}
                      `}
                      ${socketConfig.workingMode < 2 &&
                      html`
                        <div class="grid grid-cols-2 gap-4">
                          ${Select({
                            name: "registrationType",
                            label: "Registration Type",
                            value: socketConfig.registrationType,
                            onChange: (e) => handleConfigChange(e, "socket"),
                            options: CONFIG.REGISTRATION_TYPES,
                          })}
                          ${Select({
                            name: "registrationPacketLocation",
                            label: "Registration Packet Location",
                            value: socketConfig.registrationPacketLocation,
                            onChange: (e) => handleConfigChange(e, "socket"),
                            options: CONFIG.REGISTRATION_PACKET_LOCATION,
                            disabled: socketConfig.registrationType === 0,
                          })}
                        </div>

                        ${socketConfig.registrationType === 1 &&
                        html`
                          <div class="grid grid-cols-2 gap-4">
                            ${Input({
                              type: "text",
                              name: "registrationPacket",
                              label: "Registration Packet",
                              extra: "(1~100) bytes",
                              value: socketConfig.registrationPacket,
                              onChange: (e) =>
                                handlePacketInput(
                                  e,
                                  "socket",
                                  "registrationPacket",
                                  socketConfig.registrationPacketType
                                ),
                              required: socketConfig.registrationType === 1,
                              maxlength: 100,
                            })}
                            ${Select({
                              name: "registrationPacketType",
                              label: "Registration Packet Type",
                              value: socketConfig.registrationPacketType,
                              onChange: (e) =>
                                handlePacketTypeChange(
                                  e,
                                  "socket",
                                  "registrationPacket"
                                ),
                              options: CONFIG.REGISTRATION_PACKET_TYPES,
                            })}
                          </div>
                        `}
                      `}
                      ${socketConfig.workingMode === 4 &&
                      html`
                        <div class="grid grid-cols-2 gap-4">
                          ${Select({
                            name: "sslProtocol",
                            label: "SSL Protocol",
                            value: socketConfig.sslProtocol,
                            onChange: (e) => {
                              setSocketConfig({
                                ...socketConfig,
                                sslProtocol: parseInt(e.target.value),
                                sslVerifyOption: 0,
                              });
                            },
                            options: CONFIG.SSL_PROTOCOLS,
                          })}
                          ${Select({
                            name: "sslVerifyOption",
                            label: "SSL Verify Option",
                            value: socketConfig.sslVerifyOption,
                            onChange: (e) => handleConfigChange(e, "socket"),
                            options: CONFIG.SSL_VERIFY_OPTIONS,
                            disabled: socketConfig.sslProtocol === 0,
                          })}
                        </div>
                        ${socketConfig.sslVerifyOption >= 1 &&
                        html`
                          ${FileInput({
                            name: "serverCA",
                            label: "Server CA Certificate",
                            value: socketConfig.serverCA,
                            note:
                              socketConfig.serverCA ||
                              "Upload the server CA certificate",
                            onUpload: (file) =>
                              handleFileUpload(file, "serverCA"),
                            accept: ".pem,.crt,.cer",
                          })}
                        `}
                        ${socketConfig.sslVerifyOption >= 2 &&
                        html`
                          ${FileInput({
                            name: "clientCertificate",
                            label: "Client Certificate",
                            value: socketConfig.clientCertificate,
                            note:
                              socketConfig.clientCertificate ||
                              "Upload the client certificate",
                            onUpload: (file) =>
                              handleFileUpload(file, "clientCertificate"),
                            accept: ".pem,.crt,.cer",
                          })}
                          ${FileInput({
                            name: "clientKey",
                            label: "Client Key",
                            value: socketConfig.clientKey,
                            note:
                              socketConfig.clientKey || "Upload the client key",
                            onUpload: (file) =>
                              handleFileUpload(file, "clientKey"),
                            accept: ".pem,.crt,.cer",
                          })}
                        `}
                      `}
                    `}
                  </div>
                `}
          </div>
          <!-- Save and Cancel Buttons -->
          <div class="flex justify-end gap-4">
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
      </div>
    </div>
  `;
}

export default Serial;

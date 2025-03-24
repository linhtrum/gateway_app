"use strict";
import { h, html, useState, useEffect, useMemo } from "../../bundle.js";
import { Icons, Button } from "../Components.js";

// Constants and configuration
const CONFIG = {
  MAX_DEVICES: 128,
  MAX_TOTAL_NODES: 300,
  MAX_NAME_LENGTH: 20,
  MIN_POLLING_INTERVAL: 10,
  MAX_POLLING_INTERVAL: 65535,
  MIN_TIMEOUT: 10,
  MAX_TIMEOUT: 65535,
  DATA_TYPES: [
    [1, "Boolean"],
    [2, "Int8"],
    [3, "UInt8"],
    [4, "Int16"],
    [5, "UInt16"],
    [6, "Int32 (ABCD)"],
    [7, "Int32 (CDAB)"],
    [8, "UInt32 (ABCD)"],
    [9, "UInt32 (CDAB)"],
    [10, "Float (ABCD)"],
    [11, "Float (CDAB)"],
    [12, "Double"],
  ],
  FUNCTION_CODES: [
    [1, "01 - Read Coils"],
    [2, "02 - Read Discrete Inputs"],
    [3, "03 - Read Holding Registers"],
    [4, "04 - Read Input Registers"],
  ],
};

function Devices() {
  // State management
  const [activeTab, setActiveTab] = useState("device-config");
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isAddingDevice, setIsAddingDevice] = useState(false);
  const [isAddingNode, setIsAddingNode] = useState(false);

  // Form states
  const [newDevice, setNewDevice] = useState({
    n: "",
    da: 1,
    pi: 1000,
    g: false,
  });
  const [newNode, setNewNode] = useState({
    n: "",
    a: 1,
    f: 1,
    dt: 1,
    t: 1000,
  });

  // Edit states
  const [editingIndex, setEditingIndex] = useState(null);
  const [editingDevice, setEditingDevice] = useState(null);
  const [editingNodeIndex, setEditingNodeIndex] = useState(null);
  const [editingNode, setEditingNode] = useState(null);

  // Memoized values
  const totalNodes = useMemo(
    () =>
      devices.reduce((total, device) => total + (device.ns?.length || 0), 0),
    [devices]
  );

  const selectedDeviceNodes = useMemo(
    () => (selectedDevice !== null ? devices[selectedDevice]?.ns || [] : []),
    [devices, selectedDevice]
  );

  const fetchDeviceConfig = async () => {
    try {
      setIsLoading(true);
      setLoadError("");

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch("/api/devices/get", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(
          `Failed to fetch device configuration: ${response.statusText}`
        );
      }

      const data = await response.json();
      setDevices(data || []);
      setSelectedDevice(data.length > 0 ? 0 : null);
    } catch (error) {
      console.error("Error fetching device configuration:", error);
      setLoadError(
        error.name === "AbortError"
          ? "Request timed out. Please try again."
          : error.message || "Failed to load device configuration"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const saveDeviceConfig = async () => {
    try {
      setIsSaving(true);
      setSaveError("");
      setSaveSuccess(false);

      // Validate configurations before saving
      const invalidDevices = devices.filter(
        (device) =>
          !device.n || !device.da || !device.pi || !Array.isArray(device.ns)
      );

      if (invalidDevices.length > 0) {
        throw new Error("Some devices have invalid configurations");
      }

      const config = devices.map((device) => ({
        n: device.n,
        da: device.da,
        pi: device.pi,
        g: device.g,
        ns: device.ns.map((node) => ({
          n: node.n,
          a: node.a,
          f: node.f,
          dt: node.dt,
          t: node.t,
        })),
      }));

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch("/api/devices/set", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(config),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(
          `Failed to save device configuration: ${response.statusText}`
        );
      }

      // Call reboot API after successful save
      const rebootController = new AbortController();
      const rebootTimeoutId = setTimeout(() => rebootController.abort(), 10000);

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
      console.error("Error saving device configuration:", error);
      setSaveError(
        error.name === "AbortError"
          ? "Request timed out. Please try again."
          : error.message || "Failed to save device configuration"
      );
      setIsSaving(false);
    }
  };

  const Th = (props) =>
    html`<th
      class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
    >
      ${props.children}
    </th>`;
  const Td = (props) =>
    html`<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
      ${props.children}
    </td>`;

  const isDeviceNameUnique = (name, excludeIndex = -1) => {
    return !devices.some(
      (device, index) =>
        index !== excludeIndex && device.n.toLowerCase() === name.toLowerCase()
    );
  };

  const isNodeNameUnique = (name, deviceIndex, excludeNodeIndex = -1) => {
    if (!devices[deviceIndex] || !devices[deviceIndex].ns) return true;
    return !devices[deviceIndex].ns.some(
      (node, index) =>
        index !== excludeNodeIndex &&
        node.n.toLowerCase() === name.toLowerCase()
    );
  };

  // Add new function to check node name uniqueness across all devices
  const isNodeNameUniqueAcrossDevices = (
    name,
    excludeDeviceIndex = -1,
    excludeNodeIndex = -1
  ) => {
    return !devices.some((device, deviceIndex) => {
      // Skip the excluded device
      if (deviceIndex === excludeDeviceIndex) return false;

      // Check nodes in current device
      return device.ns?.some((node, nodeIndex) => {
        // Skip the excluded node
        if (
          deviceIndex === excludeDeviceIndex &&
          nodeIndex === excludeNodeIndex
        )
          return false;
        return node.n.toLowerCase() === name.toLowerCase();
      });
    });
  };

  // Validation functions
  const validateDeviceName = (name) => {
    if (!name || name.trim().length === 0) {
      return "Device name cannot be empty";
    }
    if (name.length > CONFIG.MAX_NAME_LENGTH) {
      return `Device name cannot exceed ${CONFIG.MAX_NAME_LENGTH} characters`;
    }
    return null;
  };

  const validateSlaveAddress = (address) => {
    const numValue = parseInt(address);
    if (isNaN(numValue) || numValue < 1 || numValue > 247) {
      return "Slave address must be between 1 and 247";
    }
    return null;
  };

  const validatePollingInterval = (interval) => {
    const numValue = parseInt(interval);
    if (
      isNaN(numValue) ||
      numValue < CONFIG.MIN_POLLING_INTERVAL ||
      numValue > CONFIG.MAX_POLLING_INTERVAL
    ) {
      return `Polling interval must be between ${CONFIG.MIN_POLLING_INTERVAL} and ${CONFIG.MAX_POLLING_INTERVAL} ms`;
    }
    return null;
  };

  const validateNodeName = (name) => {
    if (!name || name.trim().length === 0) {
      return "Node name cannot be empty";
    }
    if (name.length > CONFIG.MAX_NAME_LENGTH) {
      return `Node name cannot exceed ${CONFIG.MAX_NAME_LENGTH} characters`;
    }
    return null;
  };

  const validateTimeout = (timeout) => {
    const numValue = parseInt(timeout);
    if (
      isNaN(numValue) ||
      numValue < CONFIG.MIN_TIMEOUT ||
      numValue > CONFIG.MAX_TIMEOUT
    ) {
      return `Timeout must be between ${CONFIG.MIN_TIMEOUT} and ${CONFIG.MAX_TIMEOUT} ms`;
    }
    return null;
  };

  // Form handlers
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    let error = null;

    switch (name) {
      case "n":
        error = validateDeviceName(value);
        break;
      case "da":
        error = validateSlaveAddress(value);
        break;
      case "pi":
        error = validatePollingInterval(value);
        break;
      default:
        break;
    }

    if (error) {
      alert(error);
      return;
    }

    setNewDevice((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleNodeInputChange = (e) => {
    const { name, value } = e.target;
    let error = null;

    switch (name) {
      case "n":
        error = validateNodeName(value);
        if (!error && value && !isNodeNameUniqueAcrossDevices(value)) {
          error =
            "A node with this name already exists in any device. Please use a unique name.";
        }
        break;
      case "t":
        error = validateTimeout(value);
        break;
      case "f":
        // When function code changes to 1 or 2, force data type to 1 (Boolean)
        if (value === "1" || value === "2") {
          setNewNode((prev) => ({
            ...prev,
            [name]: parseInt(value),
            dt: 1, // Force Boolean data type
          }));
          return;
        }
        break;
      default:
        break;
    }

    if (error) {
      alert(error);
      return;
    }

    // Convert numeric fields to integers
    if (["a", "f", "dt", "t"].includes(name)) {
      setNewNode((prev) => ({
        ...prev,
        [name]: parseInt(value) || 1, // Provide default value of 1 if parsing fails
      }));
    } else {
      setNewNode((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // Validate all fields
    const nameError = validateDeviceName(newDevice.n);
    const addressError = validateSlaveAddress(newDevice.da);
    const intervalError = validatePollingInterval(newDevice.pi);

    if (nameError || addressError || intervalError) {
      alert(nameError || addressError || intervalError);
      return;
    }

    if (devices.length >= CONFIG.MAX_DEVICES) {
      alert(
        `Maximum number of devices (${CONFIG.MAX_DEVICES}) reached. Cannot add more devices.`
      );
      return;
    }

    if (!isDeviceNameUnique(newDevice.n)) {
      alert(
        "A device with this name already exists. Please use a unique name."
      );
      return;
    }

    setDevices((prev) => [...prev, { ...newDevice, ns: [] }]);
    setNewDevice({
      n: "",
      da: 1,
      pi: 1000,
      g: false,
    });
    setIsAddingDevice(false);
  };

  const handleNodeSubmit = (e) => {
    e.preventDefault();
    if (selectedDevice === null) return;

    // Validate all fields
    const nameError = validateNodeName(newNode.n);
    const timeoutError = validateTimeout(newNode.t);

    if (nameError || timeoutError) {
      alert(nameError || timeoutError);
      return;
    }

    // Check if node name is unique across all devices
    if (!isNodeNameUniqueAcrossDevices(newNode.n)) {
      alert(
        "A node with this name already exists in any device. Please use a unique name."
      );
      return;
    }

    if (totalNodes >= CONFIG.MAX_TOTAL_NODES) {
      alert(
        `Maximum total number of nodes (${CONFIG.MAX_TOTAL_NODES}) reached across all devices. Cannot add more nodes.`
      );
      return;
    }

    const updatedDevices = devices.map((device, index) => {
      if (index === selectedDevice) {
        return {
          ...device,
          ns: [
            ...(device.ns || []),
            {
              ...newNode,
              dt: parseInt(newNode.dt), // Ensure dt is numeric
              a: parseInt(newNode.a),
              f: parseInt(newNode.f),
              t: parseInt(newNode.t),
            },
          ],
        };
      }
      return device;
    });

    setDevices(updatedDevices);
    setNewNode({
      n: "",
      a: 1,
      f: 1,
      dt: 1, // Reset to default numeric value
      t: 1000,
    });
    setIsAddingNode(false);
  };

  const deleteDevice = (index) => {
    const deviceName = devices[index].n;
    if (
      confirm(
        `Are you sure you want to delete device "${deviceName}"? This will also delete all its nodes.`
      )
    ) {
      const newDevices = devices.filter((_, i) => i !== index);
      setDevices(newDevices);
      if (selectedDevice === index) {
        setSelectedDevice(null);
      }
    }
  };

  const deleteNode = (nodeIndex) => {
    const nodeName = devices[selectedDevice].ns[nodeIndex].n;
    if (confirm(`Are you sure you want to delete node "${nodeName}"?`)) {
      const updatedDevices = devices.map((device, index) => {
        if (index === selectedDevice) {
          const updatedNodes = device.ns.filter((_, i) => i !== nodeIndex);
          return { ...device, ns: updatedNodes };
        }
        return device;
      });
      setDevices(updatedDevices);
    }
  };

  const startEditing = (index) => {
    setEditingIndex(index);
    // Create a deep copy of the device to avoid modifying the original
    const deviceToEdit = {
      n: devices[index].n,
      da: parseInt(devices[index].da),
      pi: parseInt(devices[index].pi),
      g: Boolean(devices[index].g),
      ns: [...(devices[index].ns || [])],
    };
    setEditingDevice(deviceToEdit);
  };

  const saveEdit = (index) => {
    if (!editingDevice.n || !editingDevice.da || !editingDevice.pi) {
      alert("Please fill in all fields");
      return;
    }

    if (!isDeviceNameUnique(editingDevice.n, index)) {
      alert(
        "A device with this name already exists. Please use a unique name."
      );
      return;
    }

    const newDevices = [...devices];
    newDevices[index] = { ...editingDevice, ns: devices[index].ns || [] };
    setDevices(newDevices);
    setEditingIndex(null);
    setEditingDevice(null);
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setEditingDevice(null);
  };

  const startEditingNode = (nodeIndex) => {
    setEditingNodeIndex(nodeIndex);
    // Create a deep copy of the node to avoid modifying the original
    const nodeToEdit = {
      n: devices[selectedDevice].ns[nodeIndex].n,
      a: parseInt(devices[selectedDevice].ns[nodeIndex].a),
      f: parseInt(devices[selectedDevice].ns[nodeIndex].f),
      dt: parseInt(devices[selectedDevice].ns[nodeIndex].dt),
      t: parseInt(devices[selectedDevice].ns[nodeIndex].t),
    };
    setEditingNode(nodeToEdit);
  };

  const handleEditInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    let error = null;

    // Handle checkbox inputs
    if (type === "checkbox") {
      setEditingDevice((prev) => ({
        ...prev,
        [name]: checked,
      }));
      return;
    }

    // Handle numeric inputs
    if (["da", "pi"].includes(name)) {
      const numValue = parseInt(value);
      if (value !== "") {
        if (
          name === "da" &&
          (isNaN(numValue) || numValue < 1 || numValue > 247)
        ) {
          error = "Slave address must be between 1 and 247";
        } else if (
          name === "pi" &&
          (isNaN(numValue) ||
            numValue < CONFIG.MIN_POLLING_INTERVAL ||
            numValue > CONFIG.MAX_POLLING_INTERVAL)
        ) {
          error = `Polling interval must be between ${CONFIG.MIN_POLLING_INTERVAL} and ${CONFIG.MAX_POLLING_INTERVAL} ms`;
        }
      }
      // Update the value as a number
      setEditingDevice((prev) => ({
        ...prev,
        [name]: value === "" ? "" : numValue,
      }));
      return;
    }

    // Validate device name
    if (name === "n") {
      if (!value || value.trim().length === 0) {
        error = "Device name cannot be empty";
      } else if (value.length > CONFIG.MAX_NAME_LENGTH) {
        error = `Device name cannot exceed ${CONFIG.MAX_NAME_LENGTH} characters`;
      }
    }

    if (error) {
      alert(error);
      return;
    }

    setEditingDevice((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleEditNodeInputChange = (e) => {
    const { name, value } = e.target;

    // Add validation for name length and uniqueness
    if (name === "n") {
      if (value.length > CONFIG.MAX_NAME_LENGTH) {
        alert(`Node name cannot exceed ${CONFIG.MAX_NAME_LENGTH} characters`);
        return;
      }
      if (
        value &&
        !isNodeNameUniqueAcrossDevices(value, selectedDevice, editingNodeIndex)
      ) {
        alert(
          "A node with this name already exists in any device. Please use a unique name."
        );
        return;
      }
    }

    // Handle function code changes
    if (name === "f") {
      const numValue = parseInt(value) || 1;
      // When function code changes to 1 or 2, force data type to 1 (Boolean)
      if (numValue === 1 || numValue === 2) {
        setEditingNode((prev) => ({
          ...prev,
          [name]: numValue,
          dt: 1, // Force Boolean data type
        }));
        return;
      }
    }

    // Handle all numeric fields
    if (["a", "f", "dt", "t"].includes(name)) {
      const numValue = parseInt(value) || 1; // Provide default value of 1 if parsing fails

      if (
        name === "t" &&
        (isNaN(numValue) ||
          numValue < CONFIG.MIN_TIMEOUT ||
          numValue > CONFIG.MAX_TIMEOUT)
      ) {
        alert(
          `Timeout must be between ${CONFIG.MIN_TIMEOUT} and ${CONFIG.MAX_TIMEOUT} ms`
        );
        return;
      }

      setEditingNode((prev) => ({
        ...prev,
        [name]: numValue,
      }));
      return;
    }

    setEditingNode((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const saveNodeEdit = (nodeIndex) => {
    if (
      !editingNode.n ||
      !editingNode.a ||
      !editingNode.f ||
      !editingNode.dt ||
      !editingNode.t
    ) {
      alert("Please fill in all node fields");
      return;
    }

    // Check if node name is unique across all devices (excluding current node)
    if (
      !isNodeNameUniqueAcrossDevices(editingNode.n, selectedDevice, nodeIndex)
    ) {
      alert(
        "A node with this name already exists in any device. Please use a unique name."
      );
      return;
    }

    const updatedDevices = devices.map((device, index) => {
      if (index === selectedDevice) {
        const updatedNodes = [...device.ns];
        updatedNodes[nodeIndex] = editingNode;
        return { ...device, ns: updatedNodes };
      }
      return device;
    });

    setDevices(updatedDevices);
    setEditingNodeIndex(null);
    setEditingNode(null);
  };

  const cancelNodeEdit = () => {
    setEditingNodeIndex(null);
    setEditingNode(null);
  };

  // Add new function to generate unique device name
  const generateUniqueDeviceName = () => {
    let baseName = "Device";
    let counter = 1;
    let newName = `${baseName}${counter}`;

    while (!isDeviceNameUnique(newName)) {
      counter++;
      newName = `${baseName}${counter}`;
    }

    return newName;
  };

  // Add new function to generate unique node name
  const generateUniqueNodeName = (deviceIndex) => {
    let baseName = "Node";
    let counter = 1;
    let newName = `${baseName}${counter}`;

    while (!isNodeNameUnique(newName, deviceIndex)) {
      counter++;
      newName = `${baseName}${counter}`;
    }

    return newName;
  };

  // Update handleAddDevice to use unique name
  const handleAddDevice = () => {
    if (devices.length >= CONFIG.MAX_DEVICES) {
      alert(
        `Maximum number of devices (${CONFIG.MAX_DEVICES}) reached. Cannot add more devices.`
      );
      return;
    }

    const uniqueName = generateUniqueDeviceName();
    setNewDevice({
      n: uniqueName,
      da: 1,
      pi: 1000,
      g: false,
    });
    setIsAddingDevice(true);
  };

  // Update handleAddNode to use unique name
  const handleAddNode = () => {
    if (selectedDevice === null) {
      alert("Please select a device first");
      return;
    }

    if (totalNodes >= CONFIG.MAX_TOTAL_NODES) {
      alert(
        `Maximum total number of nodes (${CONFIG.MAX_TOTAL_NODES}) reached across all devices. Cannot add more nodes.`
      );
      return;
    }

    const uniqueName = generateUniqueNodeName(selectedDevice);
    setNewNode({
      n: uniqueName,
      a: 1,
      f: 1,
      dt: 1,
      t: 1000,
    });
    setIsAddingNode(true);
  };

  // Add new function to handle cancel add device
  const handleCancelAddDevice = () => {
    setIsAddingDevice(false);
    setNewDevice({
      n: "",
      da: 1,
      pi: 1000,
      g: false,
    });
  };

  // Add new function to handle cancel add node
  const handleCancelAddNode = () => {
    setIsAddingNode(false);
    setNewNode({
      n: "",
      a: 1,
      f: 1,
      dt: 1,
      t: 1000,
    });
  };

  useEffect(() => {
    document.title = "SBIOT-Devices";
    fetchDeviceConfig();
  }, []);

  if (isLoading) {
    return html`
      <div class="p-6">
        <h1 class="text-2xl font-bold mb-6">Devices Management</h1>
        <div
          class="bg-white rounded-lg shadow-md p-6 flex items-center justify-center"
        >
          <div class="flex items-center space-x-2">
            <${Icons.SpinnerIcon} className="h-5 w-5 text-blue-600" />
            <span class="text-gray-600">Loading device configuration...</span>
          </div>
        </div>
      </div>
    `;
  }

  return html`
    <div class="p-6">
      <h1 class="text-2xl font-bold mb-6">Devices Management</h1>

      ${loadError &&
      html`
        <div
          class="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded flex items-center justify-between"
        >
          <div>${loadError}</div>
          <button
            onClick=${fetchDeviceConfig}
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
          Device configuration saved successfully! System will reboot to apply
          changes...
        </div>
      `}

      <!-- Tabs -->
      <div class="mb-6">
        <div class="border-b border-gray-200">
          <nav class="-mb-px flex space-x-8">
            <button
              onClick=${() => setActiveTab("device-config")}
              class=${`py-4 px-1 inline-flex items-center border-b-2 font-medium text-sm
                ${
                  activeTab === "device-config"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
            >
              <!-- <${Icons.SettingsIcon} className="mr-2" /> -->
              Device Configuration
            </button>
            <button
              onClick=${() => setActiveTab("linkage-control")}
              class=${`py-4 px-1 inline-flex items-center border-b-2 font-medium text-sm
                ${
                  activeTab === "linkage-control"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
            >
              <!-- <${Icons.LinkIcon} className="mr-2" /> -->
              Linkage Control
            </button>
          </nav>
        </div>
      </div>

      ${activeTab === "device-config"
        ? html`
            <!-- Device Configuration Tab Content -->
            <div>
              <!-- Add New Device Button -->
              <div class="mb-8 flex justify-between items-center">
                <h2 class="text-xl font-semibold">
                  Device Configuration
                  <span class="text-sm text-gray-500 font-normal">
                    (${devices.length}/${CONFIG.MAX_DEVICES} devices)
                  </span>
                </h2>
                <${Button}
                  onClick=${handleAddDevice}
                  disabled=${isAddingDevice ||
                  devices.length >= CONFIG.MAX_DEVICES}
                  variant="primary"
                  icon="PlusIcon"
                >
                  Add New Device
                <//>
              </div>

              <!-- Add New Device Form -->
              ${isAddingDevice &&
              html`
                <div class="mb-8 bg-white p-6 rounded-lg shadow-md">
                  <h3 class="text-lg font-semibold mb-4">Add New Device</h3>
                  <form onSubmit=${handleSubmit}>
                    <div class="flex items-end gap-4">
                      <div class="flex-1">
                        <label
                          class="block text-sm font-medium text-gray-700 mb-2"
                        >
                          Name
                          <span class="text-xs text-gray-500 ml-1"
                            >(max ${CONFIG.MAX_NAME_LENGTH} chars)</span
                          >
                        </label>
                        <input
                          type="text"
                          name="n"
                          value=${newDevice.n}
                          onChange=${handleInputChange}
                          maxlength=${CONFIG.MAX_NAME_LENGTH}
                          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Enter unique device name"
                          required
                        />
                      </div>
                      <div class="flex-1">
                        <label
                          class="block text-sm font-medium text-gray-700 mb-2"
                        >
                          Slave Address
                          <span class="text-xs text-gray-500 ml-1"
                            >(1-247)</span
                          >
                        </label>
                        <input
                          type="number"
                          name="da"
                          value=${newDevice.da}
                          onChange=${handleInputChange}
                          min="1"
                          max="247"
                          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Enter slave address"
                          required
                        />
                      </div>
                      <div class="flex-1">
                        <label
                          class="block text-sm font-medium text-gray-700 mb-2"
                        >
                          Polling Interval
                          <span class="text-xs text-gray-500 ml-1"
                            >(${CONFIG.MIN_POLLING_INTERVAL}-${CONFIG.MAX_POLLING_INTERVAL}
                            ms)</span
                          >
                        </label>
                        <input
                          type="number"
                          name="pi"
                          value=${newDevice.pi}
                          onChange=${handleInputChange}
                          min=${CONFIG.MIN_POLLING_INTERVAL}
                          max=${CONFIG.MAX_POLLING_INTERVAL}
                          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Enter polling interval"
                          required
                        />
                      </div>
                      <div class="flex-1">
                        <label
                          class="block text-sm font-medium text-gray-700 mb-2"
                        >
                          Merge Collection
                        </label>
                        <div
                          class="w-full px-3 py-2 border border-gray-300 rounded-md flex items-center min-h-[42px]"
                        >
                          <label class="flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              id="g"
                              name="g"
                              checked=${newDevice.g}
                              onChange=${(e) =>
                                setNewDevice({
                                  ...newDevice,
                                  g: e.target.checked,
                                })}
                              class="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                            />
                            <span class="ml-2 text-gray-700">Yes</span>
                          </label>
                        </div>
                      </div>
                    </div>
                    <div class="flex justify-end space-x-3 mt-4">
                      <button
                        type="button"
                        onClick=${handleCancelAddDevice}
                        class="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        Save
                      </button>
                    </div>
                  </form>
                </div>
              `}

              <!-- Devices Table -->
              <div class="bg-white rounded-lg shadow-md overflow-hidden mb-8">
                <table class="min-w-full divide-y divide-gray-200 table-fixed">
                  <thead class="bg-gray-50">
                    <tr>
                      <${Th}>No.<//>
                      <${Th}>Name<//>
                      <${Th}>Slave Address<//>
                      <${Th}>Polling Interval<//>
                      <${Th}>Merge Collection<//>
                      <${Th}>Actions<//>
                    </tr>
                  </thead>
                  <tbody class="bg-white divide-y divide-gray-200">
                    ${devices.map(
                      (device, index) => html`
                        <tr
                          key=${index}
                          class=${selectedDevice === index ? "bg-blue-50" : ""}
                          onClick=${() => setSelectedDevice(index)}
                          style="cursor: pointer;"
                        >
                          <td
                            class="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                          >
                            ${index + 1}
                          </td>
                          <td class="px-6 py-4 whitespace-nowrap">
                            ${editingIndex === index
                              ? html`
                                  <input
                                    type="text"
                                    name="n"
                                    value=${editingDevice.n}
                                    onChange=${handleEditInputChange}
                                    maxlength=${CONFIG.MAX_NAME_LENGTH}
                                    class="w-full px-2 py-1 border border-gray-300 rounded"
                                  />
                                `
                              : device.n}
                          </td>
                          <td class="px-6 py-4 whitespace-nowrap">
                            ${editingIndex === index
                              ? html`
                                  <input
                                    type="number"
                                    name="da"
                                    value=${editingDevice.da}
                                    onChange=${handleEditInputChange}
                                    min="1"
                                    max="247"
                                    class="w-full px-2 py-1 border border-gray-300 rounded"
                                  />
                                `
                              : device.da}
                          </td>
                          <td class="px-6 py-4 whitespace-nowrap">
                            ${editingIndex === index
                              ? html`
                                  <input
                                    type="number"
                                    name="pi"
                                    value=${editingDevice.pi}
                                    onChange=${handleEditInputChange}
                                    min=${CONFIG.MIN_POLLING_INTERVAL}
                                    max=${CONFIG.MAX_POLLING_INTERVAL}
                                    class="w-full px-2 py-1 border border-gray-300 rounded"
                                  />
                                `
                              : `${device.pi} ms`}
                          </td>
                          <td class="px-6 py-4 whitespace-nowrap">
                            ${editingIndex === index
                              ? html`
                                  <input
                                    type="checkbox"
                                    name="g"
                                    checked=${editingDevice.g}
                                    onChange=${handleEditInputChange}
                                    class="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                  />
                                `
                              : html`
                                  <input
                                    type="checkbox"
                                    checked=${device.g}
                                    disabled
                                    class="h-4 w-4 text-blue-600 rounded border-gray-300"
                                  />
                                `}
                          </td>
                          <td class="px-6 py-4 whitespace-nowrap space-x-2">
                            ${editingIndex === index
                              ? html`
                                  <button
                                    onClick=${(e) => {
                                      e.stopPropagation();
                                      saveEdit(index);
                                    }}
                                    class="text-green-600 hover:text-green-900"
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick=${(e) => {
                                      e.stopPropagation();
                                      cancelEdit();
                                    }}
                                    class="text-gray-600 hover:text-gray-900"
                                  >
                                    Cancel
                                  </button>
                                `
                              : html`
                                  <button
                                    onClick=${(e) => {
                                      e.stopPropagation();
                                      startEditing(index);
                                    }}
                                    class="text-blue-600 hover:text-blue-900 mr-2"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick=${(e) => {
                                      e.stopPropagation();
                                      deleteDevice(index);
                                    }}
                                    class="text-red-600 hover:text-red-900"
                                  >
                                    Delete
                                  </button>
                                `}
                          </td>
                        </tr>
                      `
                    )}
                  </tbody>
                </table>
              </div>

              ${selectedDevice !== null &&
              html`
                <div class="mt-8">
                  <div class="flex justify-between items-center mb-4">
                    <h2 class="text-2xl font-bold">
                      Node Details for ${devices[selectedDevice].n}
                      <span class="text-sm text-gray-500 font-normal">
                        (Device Nodes: ${selectedDeviceNodes.length}, Total
                        Nodes: ${totalNodes}/${CONFIG.MAX_TOTAL_NODES})
                      </span>
                    </h2>
                    <${Button}
                      onClick=${handleAddNode}
                      disabled=${isAddingNode ||
                      totalNodes >= CONFIG.MAX_TOTAL_NODES}
                      variant="primary"
                      icon="PlusIcon"
                    >
                      Add New Node
                    <//>
                  </div>

                  <!-- Add Node Form -->
                  ${isAddingNode &&
                  html`
                    <form
                      onSubmit=${handleNodeSubmit}
                      class="mb-8 bg-white p-6 rounded-lg shadow-md"
                    >
                      <h3 class="text-lg font-semibold mb-4">
                        Add New Node
                        ${totalNodes >= CONFIG.MAX_TOTAL_NODES
                          ? html`<span
                              class="text-red-500 text-sm font-normal ml-2"
                            >
                              (Maximum nodes limit reached)
                            </span>`
                          : html`<span
                              class="text-gray-500 text-sm font-normal ml-2"
                            >
                              (${CONFIG.MAX_TOTAL_NODES - totalNodes} nodes
                              remaining)
                            </span>`}
                      </h3>
                      <div class="grid grid-cols-5 gap-4">
                        <div>
                          <label
                            class="block text-sm font-medium text-gray-700 mb-2"
                          >
                            Name
                            <span class="text-xs text-gray-500 ml-1"
                              >(max ${CONFIG.MAX_NAME_LENGTH} chars)</span
                            >
                          </label>
                          <input
                            type="text"
                            name="n"
                            value=${newNode.n}
                            onChange=${handleNodeInputChange}
                            maxlength=${CONFIG.MAX_NAME_LENGTH}
                            class="w-full px-3 py-2 border border-gray-300 rounded-md"
                            placeholder="Node name"
                            required
                          />
                        </div>
                        <div>
                          <label
                            class="block text-sm font-medium text-gray-700 mb-2"
                          >
                            Register Address
                          </label>
                          <input
                            type="text"
                            name="a"
                            value=${newNode.a}
                            onChange=${handleNodeInputChange}
                            class="w-full px-3 py-2 border border-gray-300 rounded-md"
                            placeholder="Register address"
                          />
                        </div>
                        <div>
                          <label
                            class="block text-sm font-medium text-gray-700 mb-2"
                          >
                            Function code
                          </label>
                          <select
                            name="f"
                            value=${newNode.f}
                            onChange=${handleNodeInputChange}
                            class="w-full px-3 py-2 border border-gray-300 rounded-md"
                          >
                            ${CONFIG.FUNCTION_CODES.map(
                              ([value, label]) => html`
                                <option value=${value}>${label}</option>
                              `
                            )}
                          </select>
                        </div>
                        <div>
                          <label
                            class="block text-sm font-medium text-gray-700 mb-2"
                          >
                            Data type
                          </label>
                          <select
                            name="dt"
                            value=${newNode.dt}
                            onChange=${handleNodeInputChange}
                            class="w-full px-3 py-2 border border-gray-300 rounded-md"
                            disabled=${newNode.f === 1 || newNode.f === 2}
                          >
                            ${CONFIG.DATA_TYPES.map(
                              ([value, label]) => html`
                                <option value=${value}>${label}</option>
                              `
                            )}
                          </select>
                        </div>
                        <div>
                          <label
                            class="block text-sm font-medium text-gray-700 mb-2"
                          >
                            Timeout
                            <span class="text-xs text-gray-500 ml-1"
                              >(${CONFIG.MIN_TIMEOUT}-${CONFIG.MAX_TIMEOUT}
                              ms)</span
                            >
                          </label>
                          <input
                            type="number"
                            name="t"
                            value=${newNode.t}
                            onChange=${handleNodeInputChange}
                            min=${CONFIG.MIN_TIMEOUT}
                            max=${CONFIG.MAX_TIMEOUT}
                            class="w-full px-3 py-2 border border-gray-300 rounded-md"
                            placeholder="Timeout"
                          />
                        </div>
                      </div>
                      <div class="flex justify-end space-x-3 mt-4">
                        <button
                          type="button"
                          onClick=${handleCancelAddNode}
                          class="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                          Save
                        </button>
                      </div>
                    </form>
                  `}

                  <!-- Nodes Table -->
                  <div class="bg-white rounded-lg shadow-md overflow-hidden">
                    <table
                      class="min-w-full divide-y divide-gray-200 table-fixed"
                    >
                      <thead class="bg-gray-50">
                        <tr>
                          <${Th}>No.<//>
                          <${Th}>Name<//>
                          <${Th}>Register Address<//>
                          <${Th}>Function code<//>
                          <${Th}>Data type<//>
                          <${Th}>Timeout<//>
                          <${Th}>Actions<//>
                        </tr>
                      </thead>
                      <tbody class="bg-white divide-y divide-gray-200">
                        ${selectedDeviceNodes.map(
                          (node, nodeIndex) => html`
                            <tr key=${nodeIndex}>
                              <td
                                class="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                              >
                                ${nodeIndex + 1}
                              </td>
                              <td class="px-6 py-4 whitespace-nowrap">
                                ${editingNodeIndex === nodeIndex
                                  ? html`
                                      <input
                                        type="text"
                                        name="n"
                                        value=${editingNode.n}
                                        onChange=${handleEditNodeInputChange}
                                        maxlength=${CONFIG.MAX_NAME_LENGTH}
                                        class="w-full px-2 py-1 border border-gray-300 rounded"
                                      />
                                    `
                                  : node.n}
                              </td>
                              <td class="px-6 py-4 whitespace-nowrap">
                                ${editingNodeIndex === nodeIndex
                                  ? html`
                                      <input
                                        type="text"
                                        name="a"
                                        value=${editingNode.a}
                                        onChange=${handleEditNodeInputChange}
                                        class="w-full px-2 py-1 border border-gray-300 rounded"
                                      />
                                    `
                                  : node.a}
                              </td>
                              <td class="px-6 py-4 whitespace-nowrap">
                                ${editingNodeIndex === nodeIndex
                                  ? html`
                                      <select
                                        name="f"
                                        value=${editingNode.f}
                                        onChange=${handleEditNodeInputChange}
                                        class="w-full px-2 py-1 border border-gray-300 rounded"
                                      >
                                        ${CONFIG.FUNCTION_CODES.map(
                                          ([value, label]) => html`
                                            <option value=${value}>
                                              ${label}
                                            </option>
                                          `
                                        )}
                                      </select>
                                    `
                                  : CONFIG.FUNCTION_CODES.find(
                                      ([value]) => value === node.f
                                    )?.[1]}
                              </td>
                              <td class="px-6 py-4 whitespace-nowrap">
                                ${editingNodeIndex === nodeIndex
                                  ? html`
                                      <select
                                        name="dt"
                                        value=${editingNode.dt}
                                        onChange=${handleEditNodeInputChange}
                                        class="w-full px-2 py-1 border border-gray-300 rounded"
                                        disabled=${editingNode.f === 1 ||
                                        editingNode.f === 2}
                                      >
                                        ${CONFIG.DATA_TYPES.map(
                                          ([value, label]) => html`
                                            <option value=${value}>
                                              ${label}
                                            </option>
                                          `
                                        )}
                                      </select>
                                    `
                                  : CONFIG.DATA_TYPES.find(
                                      ([value]) => value === parseInt(node.dt)
                                    )?.[1]}
                              </td>
                              <td class="px-6 py-4 whitespace-nowrap">
                                ${editingNodeIndex === nodeIndex
                                  ? html`
                                      <input
                                        type="number"
                                        name="t"
                                        value=${editingNode.t}
                                        onChange=${handleEditNodeInputChange}
                                        min=${CONFIG.MIN_TIMEOUT}
                                        max=${CONFIG.MAX_TIMEOUT}
                                        class="w-full px-2 py-1 border border-gray-300 rounded"
                                      />
                                    `
                                  : `${node.t} ms`}
                              </td>
                              <td class="px-6 py-4 whitespace-nowrap">
                                ${editingNodeIndex === nodeIndex
                                  ? html`
                                      <button
                                        onClick=${() => saveNodeEdit(nodeIndex)}
                                        class="text-green-600 hover:text-green-900 mr-2"
                                      >
                                        Save
                                      </button>
                                      <button
                                        onClick=${cancelNodeEdit}
                                        class="text-gray-600 hover:text-gray-900 mr-2"
                                      >
                                        Cancel
                                      </button>
                                    `
                                  : html`
                                      <button
                                        onClick=${() =>
                                          startEditingNode(nodeIndex)}
                                        class="text-blue-600 hover:text-blue-900 mr-2"
                                      >
                                        Edit
                                      </button>
                                      <button
                                        onClick=${() => deleteNode(nodeIndex)}
                                        class="text-red-600 hover:text-red-900"
                                      >
                                        Delete
                                      </button>
                                    `}
                              </td>
                            </tr>
                          `
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              `}
            </div>
          `
        : html`
            <!-- Linkage Control Tab Content -->
            <div class="bg-white rounded-lg shadow-md p-6">
              <h2 class="text-xl font-semibold mb-6">
                Device Linkage Settings
              </h2>

              <div class="space-y-6">
                <!-- Linkage Rules Section -->
                <div>
                  <h3 class="text-lg font-medium mb-4">Linkage Rules</h3>
                  <div class="bg-gray-50 p-4 rounded-lg">
                    <div class="flex items-center justify-between mb-4">
                      <span class="text-sm font-medium text-gray-700"
                        >Active Rules</span
                      >
                      <button
                        class="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                        onClick=${() => {
                          // Add new rule logic here
                        }}
                      >
                        Add Rule
                      </button>
                    </div>

                    <div class="border rounded-lg bg-white">
                      <div class="px-4 py-3 border-b">
                        <div
                          class="grid grid-cols-6 gap-4 text-sm font-medium text-gray-500"
                        >
                          <div>Source Device</div>
                          <div>Source Node</div>
                          <div>Condition</div>
                          <div>Target Device</div>
                          <div>Target Node</div>
                          <div>Action</div>
                        </div>
                      </div>

                      <div class="p-4 text-sm text-gray-500">
                        No linkage rules configured yet.
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Device Dependencies Section -->
                <div>
                  <h3 class="text-lg font-medium mb-4">Device Dependencies</h3>
                  <div class="bg-gray-50 p-4 rounded-lg">
                    <div class="grid grid-cols-2 gap-4">
                      <div>
                        <h4 class="text-sm font-medium text-gray-700 mb-2">
                          Source Devices
                        </h4>
                        <select
                          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Select source device</option>
                          ${devices.map(
                            (device) => html`
                              <option value=${device.n}>${device.n}</option>
                            `
                          )}
                        </select>
                      </div>
                      <div>
                        <h4 class="text-sm font-medium text-gray-700 mb-2">
                          Target Devices
                        </h4>
                        <select
                          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Select target device</option>
                          ${devices.map(
                            (device) => html`
                              <option value=${device.n}>${device.n}</option>
                            `
                          )}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          `}

      <!-- Save and Cancel Buttons -->
      <div
        class="mt-8 border-t border-gray-200 pt-6 pb-4 flex justify-end gap-4"
      >
        <${Button}
          onClick=${() => {
            if (confirm("Are you sure you want to discard all changes?")) {
              fetchDeviceConfig();
            }
          }}
          variant="secondary"
          icon="CloseIcon"
          disabled=${isSaving}
        >
          Cancel
        <//>
        <${Button}
          onClick=${saveDeviceConfig}
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

export default Devices;

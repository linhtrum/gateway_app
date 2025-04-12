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
  MIN_REGISTER_ADDRESS: 0,
  MAX_REGISTER_ADDRESS: 65535,
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

// Add new DeviceModal component
function DeviceModal({ isOpen, onClose, onSubmit, device = null, isEditing = false, devices = [] }) {
  const [formData, setFormData] = useState({
    n: device?.n || "",
    da: device?.da || 1,
    pi: device?.pi || 1000,
    g: device?.g || false,
  });

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      if (isEditing && device) {
        setFormData({
          n: device.n || "",
          da: device.da || 1,
          pi: device.pi || 1000,
          g: device.g || false,
        });
      } else {
        // Generate unique name for new device
        const nextName = getNextName(0, devices);
        setFormData({
          n: nextName || "",
          da: 1,
          pi: 1000,
          g: false,
        });
      }
    }
  }, [isOpen, device, isEditing, devices]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;

    // Handle checkbox inputs
    if (type === "checkbox") {
      setFormData((prev) => ({
        ...prev,
        [name]: checked,
      }));
      return;
    }

    if (type === "select-one") {
      setFormData((prev) => ({
        ...prev,
        [name]: parseInt(value),
      }));
      return;
    }

    if (type === "number") {
      setFormData((prev) => ({
        ...prev,
        [name]: parseInt(value),
      }));
      return;
    }

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  if (!isOpen) return null;

  return html`
    <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
      <div class="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] flex flex-col">
        <div class="px-6 py-4 border-b border-gray-200">
          <h3 class="text-lg font-medium text-gray-900">
            ${isEditing ? "Edit Device" : "Add New Device"}
          </h3>
        </div>
        <form onSubmit=${handleSubmit} class="flex-1 overflow-y-auto">
          <div class="px-6 py-4 space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Name<span class="text-red-500">*</span>
                <span class="text-xs text-gray-500 ml-1"
                  >(max ${CONFIG.MAX_NAME_LENGTH} chars)</span
                >
              </label>
              <input
                type="text"
                name="n"
                value=${formData.n}
                onChange=${handleInputChange}
                maxlength=${CONFIG.MAX_NAME_LENGTH}
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter unique device name"
                required
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Slave Address<span class="text-red-500">*</span>
                <span class="text-xs text-gray-500 ml-1">(1-247)</span>
              </label>
              <input
                type="number"
                name="da"
                value=${formData.da}
                onChange=${handleInputChange}
                min="1"
                max="247"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter slave address"
                required
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Polling Interval<span class="text-red-500">*</span>
                <span class="text-xs text-gray-500 ml-1"
                  >(${CONFIG.MIN_POLLING_INTERVAL}-${CONFIG.MAX_POLLING_INTERVAL}
                  ms)</span
                >
              </label>
              <input
                type="number"
                name="pi"
                value=${formData.pi}
                onChange=${handleInputChange}
                min=${CONFIG.MIN_POLLING_INTERVAL}
                max=${CONFIG.MAX_POLLING_INTERVAL}
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter polling interval"
                required
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Merge Collection
              </label>
              <div class="flex items-center">
                <input
                  type="checkbox"
                  name="g"
                  checked=${formData.g}
                  onChange=${handleInputChange}
                  class="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                />
                <span class="ml-2 text-gray-700">Yes</span>
              </div>
            </div>
          </div>
          <div class="px-6 py-4 bg-gray-50 flex justify-end space-x-3">
            <button
              type="button"
              onClick=${onClose}
              class="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              ${isEditing ? "Save Changes" : "Add Device"}
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
}

// Add new NodeModal component
function NodeModal({ isOpen, onClose, onSubmit, node = null, isEditing = false, selectedDevice, devices }) {
  const [formData, setFormData] = useState({
    n: "",
    a: 1,
    f: 1,
    dt: 1,
    t: 1000,
  });

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      if (isEditing && node) {
        setFormData({
          n: node.n || "",
          a: node.a || 1,
          f: node.f || 1,
          dt: node.dt || 1,
          t: node.t || 1000,
        });
      } else {
        // Generate unique name for new node
        const nextName = getNextName(1, devices, selectedDevice);
        setFormData({
          n: nextName || "",
          a: 1,
          f: 1,
          dt: 1,
          t: 1000,
        });
      }
    }
  }, [isOpen, node, isEditing, selectedDevice, devices]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;

    if (type === "number") {
      setFormData((prev) => ({
        ...prev,
        [name]: parseInt(value),
      }));
      return;
    }

    if (type === "select-one") {
      setFormData((prev) => ({
        ...prev,
        [name]: parseInt(value),
      }));
      return;
    }

    if (type === "checkbox") {
      setFormData((prev) => ({
        ...prev,
        [name]: checked,
      }));
      return;
    }

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  if (!isOpen) return null;

  return html`
    <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
      <div class="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] flex flex-col">
        <div class="px-6 py-4 border-b border-gray-200">
          <h3 class="text-lg font-medium text-gray-900">
            ${isEditing ? "Edit Node" : "Add New Node"}
          </h3>
        </div>
        <form onSubmit=${handleSubmit} class="flex-1 overflow-y-auto">
          <div class="px-6 py-4 space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Name<span class="text-red-500">*</span>
                <span class="text-xs text-gray-500 ml-1"
                  >(max ${CONFIG.MAX_NAME_LENGTH} chars)</span
                >
              </label>
              <input
                type="text"
                name="n"
                value=${formData.n}
                onChange=${handleInputChange}
                maxlength=${CONFIG.MAX_NAME_LENGTH}
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter unique node name"
                required
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Register Address<span class="text-red-500">*</span>
                <span class="text-xs text-gray-500 ml-1"
                  >(${CONFIG.MIN_REGISTER_ADDRESS}-${CONFIG.MAX_REGISTER_ADDRESS})</span
                >
              </label>
              <input
                type="number"
                name="a"
                value=${formData.a}
                onChange=${handleInputChange}
                min=${CONFIG.MIN_REGISTER_ADDRESS}
                max=${CONFIG.MAX_REGISTER_ADDRESS}
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter register address"
                required
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Function Code<span class="text-red-500">*</span>
              </label>
              <select
                name="f"
                value=${formData.f}
                onChange=${handleInputChange}
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                ${CONFIG.FUNCTION_CODES.map(
                  ([value, label]) => html`
                    <option value=${value}>${label}</option>
                  `
                )}
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Data Type<span class="text-red-500">*</span>
              </label>
              <select
                name="dt"
                value=${formData.dt}
                onChange=${handleInputChange}
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled=${formData.f === 1 || formData.f === 2}
              >
                ${CONFIG.DATA_TYPES.map(
                  ([value, label]) => html`
                    <option value=${value}>${label}</option>
                  `
                )}
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Timeout<span class="text-red-500">*</span>
                <span class="text-xs text-gray-500 ml-1"
                  >(${CONFIG.MIN_TIMEOUT}-${CONFIG.MAX_TIMEOUT} ms)</span
                >
              </label>
              <input
                type="number"
                name="t"
                value=${formData.t}
                onChange=${handleInputChange}
                min=${CONFIG.MIN_TIMEOUT}
                max=${CONFIG.MAX_TIMEOUT}
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter timeout"
                required
              />
            </div>
          </div>
          <div class="px-6 py-4 bg-gray-50 flex justify-end space-x-3">
            <button
              type="button"
              onClick=${onClose}
              class="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              ${isEditing ? "Save Changes" : "Add Node"}
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
}

// Add this function before the Devices component
function getNextName(type, devices, selectedDeviceIndex = -1) {
  if (type === 0) { // Device name
    const maxNum = devices.length + 1;
    for (let i = 1; i < maxNum + 1; i++) {
      let flag = 0;
      const nextDeviceName = "device" + (i < 10 ? "0" + i : i);
      
      // Check if name exists in any device
      for (let j = 0; j < devices.length; j++) {
        if (nextDeviceName === devices[j].n) {
          flag = 1;
          break;
        }
      }
      
      if (flag === 0) {
        return nextDeviceName;
      }
    }
  } else if (type === 1) { // Node name
    if (selectedDeviceIndex === -1 || !devices[selectedDeviceIndex]) {
      return null;
    }
    
    const deviceNum = selectedDeviceIndex + 1;
    const maxNum = (devices[selectedDeviceIndex].ns?.length || 0) + 1;
    
    for (let i = 1; i < maxNum + 1; i++) {
      let flag = 0;
      const nextNodeName = "node" + 
        (deviceNum < 10 ? "0" + deviceNum : deviceNum) + 
        (i < 10 ? "0" + i : i);
      
      // Check if name exists in current device's nodes
      if (devices[selectedDeviceIndex].ns) {
        for (let j = 0; j < devices[selectedDeviceIndex].ns.length; j++) {
          if (nextNodeName === devices[selectedDeviceIndex].ns[j].n) {
            flag = 1;
            break;
          }
        }
      }
      
      if (flag === 0) {
        return nextNodeName;
      }
    }
  }
  
  return null; // Return null if no unique name found
}

function Devices() {
  // State management
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isDeviceModalOpen, setIsDeviceModalOpen] = useState(false);
  const [editingDeviceIndex, setEditingDeviceIndex] = useState(null);
  const [isNodeModalOpen, setIsNodeModalOpen] = useState(false);
  const [editingNodeIndex, setEditingNodeIndex] = useState(null);

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
      if(devices.length === 0) {
        alert("No devices found");
        return;
      }

      setIsSaving(true);
      setSaveError("");
      setSaveSuccess(false);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch("/api/devices/set", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(devices),
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

  const isNodeNameUniqueAcrossDevices = (
    name,
    excludeDeviceIndex = -1,
    excludeNodeIndex = -1
  ) => {
    return !devices.some((device, deviceIndex) => {
      // Skip the excluded device
      // if (deviceIndex === excludeDeviceIndex) return false;

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


  const handleNodeSubmit = (formData) => {
    if (editingNodeIndex !== null) {
      // Editing existing node
      if (!isNodeNameUniqueAcrossDevices(formData.n, selectedDevice, editingNodeIndex)) {
        alert("A node with this name already exists in any device. Please use a unique name.");
        return;
      }
      const updatedDevices = devices.map((device, index) => {
        if (index === selectedDevice) {
          const updatedNodes = [...device.ns];
          updatedNodes[editingNodeIndex] = formData;
          return { ...device, ns: updatedNodes };
        }
        return device;
      });
      setDevices(updatedDevices);
    } else {
      // Adding new node
      if (!isNodeNameUniqueAcrossDevices(formData.n, selectedDevice)) {
        alert("A node with this name already exists in any device. Please use a unique name.");
        return;
      }
      const updatedDevices = devices.map((device, index) => {
        if (index === selectedDevice) {
          return {
            ...device,
            ns: [...(device.ns || []), formData],
          };
        }
        return device;
      });
      setDevices(updatedDevices);
    }
    setIsNodeModalOpen(false);
    setEditingNodeIndex(null);
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
    setEditingDeviceIndex(index);
    setIsDeviceModalOpen(true);
  };

  const handleDeviceSubmit = (formData) => {
    if (editingDeviceIndex !== null) {
      // Editing existing device
      if (!isDeviceNameUnique(formData.n, editingDeviceIndex)) {
        alert("A device with this name already exists. Please use a unique name.");
        return;
      }
      const newDevices = [...devices];
      newDevices[editingDeviceIndex] = { ...formData, ns: devices[editingDeviceIndex].ns || [] };
      setDevices(newDevices);
    } else {
      // Adding new device
      if (!isDeviceNameUnique(formData.n)) {
        alert("A device with this name already exists. Please use a unique name.");
        return;
      }
      setDevices((prev) => [...prev, { ...formData, ns: [] }]);
    }
    setIsDeviceModalOpen(false);
    setEditingDeviceIndex(null);
  };

  const handleAddDevice = () => {
    if (devices.length >= CONFIG.MAX_DEVICES) {
      alert(
        `Maximum number of devices (${CONFIG.MAX_DEVICES}) reached. Cannot add more devices.`
      );
      return;
    }
    setEditingDeviceIndex(null);
    setIsDeviceModalOpen(true);
  };

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

    setEditingNodeIndex(null);
    setIsNodeModalOpen(true);
  };

  const startEditingNode = (nodeIndex) => {
    if (selectedDevice === null || !devices[selectedDevice]?.ns?.[nodeIndex]) {
      alert("Invalid node selection");
      return;
    }
    setEditingNodeIndex(nodeIndex);
    setIsNodeModalOpen(true);
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

      <!-- Device Configuration Content -->
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
            disabled=${devices.length >= CONFIG.MAX_DEVICES}
            variant="primary"
            icon="PlusIcon"
          >
            Add New Device
          <//>
        </div>

        <!-- Devices Table -->
        <div class="bg-white rounded-lg shadow-md overflow-hidden mb-8">
          <div class="max-h-[60vh] overflow-y-auto">
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
                      <td class="px-6 py-4 whitespace-nowrap">${device.n}</td>
                      <td class="px-6 py-4 whitespace-nowrap">${device.da}</td>
                      <td class="px-6 py-4 whitespace-nowrap">${device.pi} ms</td>
                      <td class="px-6 py-4 whitespace-nowrap">
                        ${device.g ? "Yes" : "No"}
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap space-x-2">
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
                      </td>
                    </tr>
                  `
                )}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Device Modal -->
        <${DeviceModal}
          isOpen=${isDeviceModalOpen}
          onClose=${() => {
            setIsDeviceModalOpen(false);
            setEditingDeviceIndex(null);
          }}
          onSubmit=${handleDeviceSubmit}
          device=${editingDeviceIndex !== null ? devices[editingDeviceIndex] : null}
          isEditing=${editingDeviceIndex !== null}
          devices=${devices}
        />

        ${selectedDevice !== null &&
        html`
          <div class="mt-8">
            <div class="flex justify-between items-center mb-4">
              <h2 class="text-xl font-semibold">
                Node Details for ${devices[selectedDevice].n}
                <span class="text-sm text-gray-500 font-normal">
                  (Device Nodes: ${selectedDeviceNodes.length}, Total
                  Nodes: ${totalNodes}/${CONFIG.MAX_TOTAL_NODES})
                </span>
              </h2>
              <${Button}
                onClick=${handleAddNode}
                disabled=${totalNodes >= CONFIG.MAX_TOTAL_NODES}
                variant="primary"
                icon="PlusIcon"
              >
                Add New Node
              <//>
            </div>

            <!-- Nodes Table -->
            <div class="bg-white rounded-lg shadow-md overflow-hidden">
              <div class="max-h-[60vh] overflow-y-auto">
                <table class="min-w-full divide-y divide-gray-200 table-fixed">
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
                          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            ${nodeIndex + 1}
                          </td>
                          <td class="px-6 py-4 whitespace-nowrap">${node.n}</td>
                          <td class="px-6 py-4 whitespace-nowrap">${node.a}</td>
                          <td class="px-6 py-4 whitespace-nowrap">
                            ${CONFIG.FUNCTION_CODES.find(
                              ([value]) => value === node.f
                            )?.[1]}
                          </td>
                          <td class="px-6 py-4 whitespace-nowrap">
                            ${CONFIG.DATA_TYPES.find(
                              ([value]) => value === parseInt(node.dt)
                            )?.[1]}
                          </td>
                          <td class="px-6 py-4 whitespace-nowrap">${node.t} ms</td>
                          <td class="px-6 py-4 whitespace-nowrap">
                            <button
                              onClick=${() => startEditingNode(nodeIndex)}
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
                          </td>
                        </tr>
                      `
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        `}
      </div>

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
          ${isSaving ? "Saving..." : "Save"}
        <//>
      </div>

      <!-- Node Modal -->
      <${NodeModal}
        isOpen=${isNodeModalOpen}
        onClose=${() => {
          setIsNodeModalOpen(false);
          setEditingNodeIndex(null);
        }}
        onSubmit=${handleNodeSubmit}
        node=${editingNodeIndex !== null && selectedDevice !== null && devices[selectedDevice]?.ns?.[editingNodeIndex] 
          ? devices[selectedDevice].ns[editingNodeIndex] 
          : null}
        isEditing=${editingNodeIndex !== null}
        selectedDevice=${selectedDevice}
        devices=${devices}
      />
    </div>
  `;
}

export default Devices;

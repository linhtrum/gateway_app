import { h, html, useState, useEffect } from "../../bundle.js";
import { Button, Icons } from "../Components.js";

const CONFIG = {
  MQTT_VERSIONS: [
    [1, "MQTT-3.0"],
    [2, "MQTT-3.1.1"],
  ],
};

function MQTT() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [mqttConfig, setMqttConfig] = useState({
    enabled: false,
    version: 2,
    clientId: "",
    serverAddress: "",
    port: 1883,
    keepAlive: 60,
    reconnectNoData: 60,
    reconnectInterval: 5,
    cleanSession: true,
    useCredentials: false,
    username: "",
    password: "",
    enableLastWill: false,
  });

  const validateClientId = (id) => {
    if (!id) return "Client ID is required";
    if (id.length > 32) return "Client ID must not exceed 32 characters";
    return null;
  };

  const validateServerAddress = (address) => {
    if (!address) return "Server address is required";
    if (address.length > 64)
      return "Server address must not exceed 64 characters";
    return null;
  };

  const validatePort = (port) => {
    const portNum = parseInt(port);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      return "Port must be between 1 and 65535";
    }
    return null;
  };

  const validateKeepAlive = (keepAlive) => {
    const value = parseInt(keepAlive);
    if (isNaN(value) || value < 0 || value > 65535) {
      return "Keep Alive must be between 0 and 65535 seconds";
    }
    return null;
  };

  const validateReconnectNoData = (value) => {
    const num = parseInt(value);
    if (isNaN(num) || num < 0 || num > 65535) {
      return "Reconnecting without Data must be between 0 and 65535 seconds";
    }
    return null;
  };

  const validateReconnectInterval = (interval) => {
    const value = parseInt(interval);
    if (isNaN(value) || value < 1 || value > 65535) {
      return "Reconnect interval must be between 1 and 65535 seconds";
    }
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

  const fetchMQTTConfig = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/mqtt/get");
      if (!response.ok) {
        throw new Error("Failed to fetch MQTT configuration");
      }
      const data = await response.json();
      setMqttConfig(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const saveMQTTConfig = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      // Validate all fields
      const errors = {
        clientId: validateClientId(mqttConfig.clientId),
        serverAddress: validateServerAddress(mqttConfig.serverAddress),
        port: validatePort(mqttConfig.port),
        keepAlive: validateKeepAlive(mqttConfig.keepAlive),
        reconnectNoData: validateReconnectNoData(mqttConfig.reconnectNoData),
        reconnectInterval: validateReconnectInterval(
          mqttConfig.reconnectInterval
        ),
        username: validateUsername(mqttConfig.username),
        password: validatePassword(mqttConfig.password),
      };

      const hasErrors = Object.values(errors).some((error) => error !== null);
      if (hasErrors) {
        setError("Please fix the validation errors before saving");
        return;
      }

      const response = await fetch("/api/mqtt/set", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(mqttConfig),
      });

      if (!response.ok) {
        throw new Error("Failed to save MQTT configuration");
      }

      setSuccess(true);
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;

    if (type === "checkbox") {
      setMqttConfig((prev) => ({
        ...prev,
        [name]: checked,
      }));
      return;
    }

    if (type === "number") {
      setMqttConfig((prev) => ({
        ...prev,
        [name]: parseInt(value) || 0,
      }));
      return;
    }

    setMqttConfig((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  useEffect(() => {
    fetchMQTTConfig();
  }, []);

  if (loading) {
    return html`
      <div class="flex items-center justify-center h-full">
        <${Icons.SpinnerIcon} className="h-8 w-8 text-blue-600" />
      </div>
    `;
  }

  return html`
    <div class="p-6">
      <h1 class="text-2xl font-bold mb-6">MQTT Configuration</h1>

      ${error &&
      html`
        <div
          class="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded flex items-center justify-between"
        >
          <div>${error}</div>
          <button
            onClick=${fetchMQTTConfig}
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
          MQTT configuration saved successfully! System will reload to apply
          changes...
        </div>
      `}

      <div class="max-w-[70%] mx-auto">
        <div class="bg-white shadow rounded-lg p-6">
          <div class="space-y-6">
            <div class="flex items-center">
              <input
                type="checkbox"
                name="enabled"
                checked=${mqttConfig.enabled}
                onChange=${handleInputChange}
                class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label class="ml-2 block text-sm text-gray-900"
                >Enable MQTT</label
              >
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2"
                >MQTT Version</label
              >
              <select
                name="version"
                value=${mqttConfig.version}
                onChange=${handleInputChange}
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled=${!mqttConfig.enabled}
              >
                ${CONFIG.MQTT_VERSIONS.map(
                  ([value, label]) => html`
                    <option value=${value}>${label}</option>
                  `
                )}
              </select>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2"
                >Client ID</label
              >
              <input
                type="text"
                name="clientId"
                value=${mqttConfig.clientId}
                onChange=${handleInputChange}
                maxlength="32"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled=${!mqttConfig.enabled}
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2"
                >Server Address</label
              >
              <input
                type="text"
                name="serverAddress"
                value=${mqttConfig.serverAddress}
                onChange=${handleInputChange}
                maxlength="64"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled=${!mqttConfig.enabled}
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2"
                >Port</label
              >
              <input
                type="number"
                name="port"
                value=${mqttConfig.port}
                onChange=${handleInputChange}
                min="1"
                max="65535"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled=${!mqttConfig.enabled}
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2"
                >Keep Alive (seconds)</label
              >
              <input
                type="number"
                name="keepAlive"
                value=${mqttConfig.keepAlive}
                onChange=${handleInputChange}
                min="0"
                max="65535"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled=${!mqttConfig.enabled}
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2"
                >Reconnecting without Data (seconds)</label
              >
              <input
                type="number"
                name="reconnectNoData"
                value=${mqttConfig.reconnectNoData}
                onChange=${handleInputChange}
                min="0"
                max="65535"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled=${!mqttConfig.enabled}
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2"
                >Reconnect Interval (seconds)</label
              >
              <input
                type="number"
                name="reconnectInterval"
                value=${mqttConfig.reconnectInterval}
                onChange=${handleInputChange}
                min="1"
                max="65535"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled=${!mqttConfig.enabled}
              />
            </div>

            <div class="flex items-center">
              <input
                type="checkbox"
                name="cleanSession"
                checked=${mqttConfig.cleanSession}
                onChange=${handleInputChange}
                class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                disabled=${!mqttConfig.enabled}
              />
              <label class="ml-2 text-sm text-gray-700">Clean Session</label>
            </div>

            <div class="flex items-center">
              <input
                type="checkbox"
                name="useCredentials"
                checked=${mqttConfig.useCredentials}
                onChange=${handleInputChange}
                class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                disabled=${!mqttConfig.enabled}
              />
              <label class="ml-2 text-sm text-gray-700">User Credentials</label>
            </div>

            ${mqttConfig.useCredentials &&
            html`
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2"
                  >Username</label
                >
                <input
                  type="text"
                  name="username"
                  value=${mqttConfig.username}
                  onChange=${handleInputChange}
                  maxlength="32"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled=${!mqttConfig.enabled}
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2"
                  >Password</label
                >
                <input
                  type="password"
                  name="password"
                  value=${mqttConfig.password}
                  onChange=${handleInputChange}
                  maxlength="32"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled=${!mqttConfig.enabled}
                />
              </div>
            `}

            <div class="flex items-center">
              <input
                type="checkbox"
                name="enableLastWill"
                checked=${mqttConfig.enableLastWill}
                onChange=${handleInputChange}
                class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                disabled=${!mqttConfig.enabled}
              />
              <label class="ml-2 text-sm text-gray-700">Enable Last Will</label>
            </div>
          </div>
        </div>
      </div>

      <!-- Save and Cancel Buttons -->
      <div
        class="mt-8 border-t border-gray-200 pt-6 pb-4 flex justify-end gap-4 max-w-[70%] mx-auto"
      >
        <${Button}
          onClick=${() => {
            if (confirm("Are you sure you want to discard all changes?")) {
              fetchMQTTConfig();
            }
          }}
          variant="secondary"
          icon="CloseIcon"
          disabled=${saving}
        >
          Cancel
        <//>
        <${Button}
          onClick=${saveMQTTConfig}
          disabled=${saving}
          loading=${saving}
          icon="SaveIcon"
        >
          Save Configuration
        <//>
      </div>
    </div>
  `;
}

export default MQTT;

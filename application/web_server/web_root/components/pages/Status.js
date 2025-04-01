"use strict";
import { html, useState, useEffect } from "../../bundle.js";

function Status() {
  const [status, setStatus] = useState({
    system: {
      modalName: "",
      firmwareVersion: "",
      runTime: "",
      macAddress: "",
      imei: "",
      serialNumber: "",
      currentNetworkCard: "",
      systemTime: "",
    },
    ethernet: {
      ipAddress: "",
      preferredDns: "",
      alternateDns: "",
    },
    cellularNetwork: {
      iccid: "",
      ipAddress: "",
      preferredDns: "",
      alternateDns: "",
      signalValue: "",
      networkType: "",
      connectionStatus: "",
    },
    port: {
      selectedSocketConnection: "",
      connectionStatus: "",
      txCount: 0,
      rxCount: 0,
    },
    mqttGateway: {
      enabled: false,
      connectionStatus: "",
    },
    edgeComputing: {
      enabled: false,
      connectionStatus: "",
    },
    location: {
      latitude: "",
      longitude: "",
    },
  });

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchStatus();
    // Set up polling every 5 seconds
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchStatus = async () => {
    try {
      const response = await fetch("/api/status");
      const data = await response.json();
      setStatus(data);
    } catch (error) {
      console.error("Error fetching status:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const StatusCard = ({ title, children }) => html`
    <div class="bg-white shadow rounded-lg p-6 mb-6">
      <h2 class="text-lg font-semibold text-gray-900 mb-4">${title}</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">${children}</div>
    </div>
  `;

  const StatusItem = ({ label, value }) => html`
    <div class="flex flex-col">
      <span class="text-sm font-medium text-gray-500">${label}</span>
      <span class="text-base text-gray-900">${value}</span>
    </div>
  `;

  if (isLoading) {
    return html`
      <div class="flex justify-center items-center h-full">
        <div
          class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"
        ></div>
      </div>
    `;
  }

  return html`
    <div class="container mx-auto px-4 py-8">
      <h1 class="text-2xl font-bold text-gray-900 mb-8">System Status</h1>
      
      <${StatusCard} title="System Information">
        <${StatusItem} label="Modal Name" value=${status.system.modalName} />
        <${StatusItem} label="Firmware Version" value=${
    status.system.firmwareVersion
  } />
        <${StatusItem} label="Run Time" value=${status.system.runTime} />
        <${StatusItem} label="MAC Address" value=${status.system.macAddress} />
        <${StatusItem} label="IMEI" value=${status.system.imei} />
        <${StatusItem} label="Serial Number" value=${
    status.system.serialNumber
  } />
        <${StatusItem} label="Current Network Card" value=${
    status.system.currentNetworkCard
  } />
        <${StatusItem} label="System Time" value=${status.system.systemTime} />
      </${StatusCard}>

      <${StatusCard} title="Ethernet">
        <${StatusItem} label="IP Address" value=${status.ethernet.ipAddress} />
        <${StatusItem} label="Preferred DNS" value=${
    status.ethernet.preferredDns
  } />
        <${StatusItem} label="Alternate DNS" value=${
    status.ethernet.alternateDns
  } />
      </${StatusCard}>

      <${StatusCard} title="Cellular Network">
        <${StatusItem} label="ICCID" value=${status.cellularNetwork.iccid} />
        <${StatusItem} label="IP Address" value=${
    status.cellularNetwork.ipAddress
  } />
        <${StatusItem} label="Preferred DNS" value=${
    status.cellularNetwork.preferredDns
  } />
        <${StatusItem} label="Alternate DNS" value=${
    status.cellularNetwork.alternateDns
  } />
        <${StatusItem} label="Signal Value" value=${
    status.cellularNetwork.signalValue
  } />
        <${StatusItem} label="Network Type" value=${
    status.cellularNetwork.networkType
  } />
        <${StatusItem} label="Connection Status" value=${
    status.cellularNetwork.connectionStatus
  } />
      </${StatusCard}>

      <${StatusCard} title="Port">
        <${StatusItem} label="Selected Socket Connection" value=${
    status.port.selectedSocketConnection
  } />
        <${StatusItem} label="Connection Status" value=${
    status.port.connectionStatus
  } />
        <${StatusItem} label="TX Count" value=${status.port.txCount} />
        <${StatusItem} label="RX Count" value=${status.port.rxCount} />
      </${StatusCard}>

      <${StatusCard} title="MQTT Gateway">
        <${StatusItem} label="Enabled" value=${
    status.mqttGateway.enabled ? "Yes" : "No"
  } />
        <${StatusItem} label="Connection Status" value=${
    status.mqttGateway.connectionStatus
  } />
      </${StatusCard}>

      <${StatusCard} title="Edge Computing">
        <${StatusItem} label="Enabled" value=${
    status.edgeComputing.enabled ? "Yes" : "No"
  } />
        <${StatusItem} label="Connection Status" value=${
    status.edgeComputing.connectionStatus
  } />
      </${StatusCard}>

      <${StatusCard} title="Location">
        <${StatusItem} label="Latitude" value=${status.location.latitude} />
        <${StatusItem} label="Longitude" value=${status.location.longitude} />
      </${StatusCard}>
    </div>
  `;
}

export default Status;

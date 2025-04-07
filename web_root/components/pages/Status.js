"use strict";
import { html, useState, useEffect } from "../../bundle.js";

function Status() {
  const [status, setStatus] = useState({
    system: {
      modalName: "SBIOT",
      firmwareVersion: "1.0.0",
      runTime: "00:00:00",
      macAddress: "00:00:00:00:00:00",
      imei: "000000000000000",
      serialNumber: "000000000000000",
      currentNetworkCard: "Ethernet",
      systemTime: "2025-03-31 12:00:00",
    },
    ethernet: {
      ipAddress: "192.168.1.1",
      preferredDns: "8.8.8.8",
      alternateDns: "8.8.4.4",
    },
    cellularNetwork: {
      iccid: "000000000000000",
      ipAddress: "192.168.1.1",
      preferredDns: "8.8.8.8",
      alternateDns: "8.8.4.4",
      signalValue: "100",
      networkType: "LTE",
      connectionStatus: "Connected",
    },
    port: [
      {
        connectionStatus: "Connected",
        txCount: 100,
        rxCount: 100,
      },
      {
        connectionStatus: "Connected",
        txCount: 100,
        rxCount: 100,
      },
    ],
    mqttGateway: {
      enabled: true,
      connectionStatus: "Connected",
    },
    edgeComputing: {
      enabled: true,
      connectionStatus: "Connected",
    },
    location: {
      latitude: "37.774929",
      longitude: "-122.419418",
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

  const StatusSection = ({ title, items }) => html`
    <div class="bg-white shadow rounded-lg mb-6">
      <div class="px-4 py-3 border-b border-gray-200 bg-gray-100">
        <h2 class="text-lg font-semibold text-gray-900">${title}</h2>
      </div>
      <div class="divide-y divide-gray-200">
        ${items.map(
          ([label, value]) => html`
            <div class="px-4 py-3 grid grid-cols-2 gap-4">
              <div class="text-sm font-medium text-gray-500">${label}</div>
              <div class="text-sm text-gray-900 text-left">${value}</div>
            </div>
          `
        )}
      </div>
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
      <div class="max-w-4xl mx-auto">
        <${StatusSection}
          title="System Information"
          items=${[
            ["Modal Name", status.system.modalName],
            ["Firmware Version", status.system.firmwareVersion],
            ["Run Time", status.system.runTime],
            ["MAC Address", status.system.macAddress],
            ["IMEI", status.system.imei],
            ["Serial Number", status.system.serialNumber],
            ["Current Network Card", status.system.currentNetworkCard],
            ["System Time", status.system.systemTime],
          ]}
        />

        <${StatusSection}
          title="Ethernet"
          items=${[
            ["IP Address", status.ethernet.ipAddress],
            ["Preferred DNS", status.ethernet.preferredDns],
            ["Alternate DNS", status.ethernet.alternateDns],
          ]}
        />

        <${StatusSection}
          title="Cellular Network"
          items=${[
            ["ICCID", status.cellularNetwork.iccid],
            ["IP Address", status.cellularNetwork.ipAddress],
            ["Preferred DNS", status.cellularNetwork.preferredDns],
            ["Alternate DNS", status.cellularNetwork.alternateDns],
            ["Signal Value", status.cellularNetwork.signalValue],
            ["Network Type", status.cellularNetwork.networkType],
            ["Connection Status", status.cellularNetwork.connectionStatus],
          ]}
        />

        <${StatusSection}
          title="Port1"
          items=${[
            ["Connection Status", status.port[0].connectionStatus],
            ["TX Count", status.port[0].txCount],
            ["RX Count", status.port[0].rxCount],
          ]}
        />

        <${StatusSection}
          title="Port2"
          items=${[
            ["Connection Status", status.port[1].connectionStatus],
            ["TX Count", status.port[1].txCount],
            ["RX Count", status.port[1].rxCount],
          ]}
        />

        <${StatusSection}
          title="MQTT Gateway"
          items=${[
            ["Enabled", status.mqttGateway.enabled ? "Yes" : "No"],
            ["Connection Status", status.mqttGateway.connectionStatus],
          ]}
        />

        <${StatusSection}
          title="Edge Computing"
          items=${[
            ["Enabled", status.edgeComputing.enabled ? "Yes" : "No"],
            ["Connection Status", status.edgeComputing.connectionStatus],
          ]}
        />

        <${StatusSection}
          title="Location"
          items=${[
            ["Latitude", status.location.latitude],
            ["Longitude", status.location.longitude],
          ]}
        />
      </div>
    </div>
  `;
}

export default Status;

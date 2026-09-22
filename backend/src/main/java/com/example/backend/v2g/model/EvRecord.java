package com.example.backend.v2g.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EvRecord {
    private String evId;
    private String timestamp;
    private String date;
    private int hour;
    private int arrivalHour;
    private int departureHour;
    private boolean connectedToGrid;
    private double batteryCapacityKwh;
    private double socStartPct;
    private double socRequiredPct;
    private double socCurrentPct;
    private double chargingPowerKw;
    private double dischargingPowerKw;
    private boolean v2gEnabled;
    private boolean availableForV2g;
    private boolean chargingAvailable;
    private double energyAvailableKwh;
    private double maxV2gPowerKw;
    private double chargingEnergyKwh;
    private double dischargingEnergyKwh;
    private double travelEnergyRequiredKwh;
}

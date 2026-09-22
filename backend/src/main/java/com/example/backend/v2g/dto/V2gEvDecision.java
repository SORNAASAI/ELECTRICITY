package com.example.backend.v2g.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class V2gEvDecision {
    private String evId;
    private int hour;
    private String timestamp;
    private boolean connected;
    private boolean v2gEnabled;
    private double initialSoc;
    private double finalSoc;
    private String action; // "CHARGE", "DISCHARGE", "IDLE"
    private double powerKw;
    private double energyKwh;
    private double batteryCapacityKwh;
    private double socRequiredPct;
    private int arrivalHour;
    private int departureHour;
}

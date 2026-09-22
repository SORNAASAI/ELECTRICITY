package com.example.backend.v2g.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class V2gOptimizeResponse {
    private String date;
    private String modelUsed;
    private double efficiency;
    private int fleetMultiplier;

    // Peak metrics
    private double peakBeforeV2gMw;
    private double peakAfterV2gMw;
    private double peakReductionMw;
    private double peakReductionPct;

    // Energy metrics
    private double totalChargingEnergyKwh;
    private double totalDischargingEnergyKwh;
    private double totalChargingEnergyMwh;
    private double totalDischargingEnergyMwh;

    // EV counts & statistics
    private int participatingEvCount;
    private int chargingEvCount;
    private int dischargingEvCount;
    private int idleEvCount;
    private double averageSoc;
    private double minSoc;
    private int failedDepartureSocCount;

    // Hourly and EV level details
    private List<V2gHourlySummary> hourlyResults;
    private List<V2gEvDecision> evDecisions;
}

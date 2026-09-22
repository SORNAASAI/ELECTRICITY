package com.example.backend.v2g.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class V2gHourlySummary {
    private int hour;
    private String timestamp;
    private double forecastedDemandMw;
    private double evChargingPowerKw;
    private double evDischargingPowerKw;
    private double evChargingPowerMw;
    private double evDischargingPowerMw;
    private double gridDemandAfterV2gMw;
    private int numberOfChargingEVs;
    private int numberOfDischargingEVs;
    private int numberOfIdleEVs;
    private double averageSoc;
    private boolean isPeakHour;
}

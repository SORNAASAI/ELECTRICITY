package com.example.backend.v2g.service;

import com.example.backend.controller.PredictController;
import com.example.backend.v2g.dto.*;
import com.example.backend.v2g.model.EvRecord;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class V2gOptimizationService {

    private final EvDatasetService evDatasetService;
    private final PredictController predictController;

    private static final double MIN_SAFE_SOC = 20.0;
    private static final double MAX_SAFE_SOC = 100.0;

    public V2gOptimizeResponse optimize(V2gOptimizeRequest request) {
        String date = (request.getDate() != null && !request.getDate().isBlank())
                ? request.getDate()
                : "2026-08-10";
        String modelName = (request.getModelName() != null && !request.getModelName().isBlank())
                ? request.getModelName()
                : "xgboost";
        double efficiency = (request.getEfficiency() != null && request.getEfficiency() > 0 && request.getEfficiency() <= 1.0)
                ? request.getEfficiency()
                : 0.90;
        int fleetMultiplier = (request.getFleetMultiplier() != null && request.getFleetMultiplier() >= 1)
                ? request.getFleetMultiplier()
                : 1;

        log.info("Running V2G Optimization for date={}, model={}, efficiency={}, multiplier={}",
                date, modelName, efficiency, fleetMultiplier);

        // 1. Obtain 24-hour demand forecast
        double[] forecastedDemandMw = get24HourForecast(date, modelName);

        // 2. Load EV records for the date
        List<EvRecord> evRecords = evDatasetService.getRecordsForDate(date);
        if (evRecords.isEmpty()) {
            throw new IllegalArgumentException("No EV records found in dataset for date: " + date);
        }

        // Group records by EV_ID
        Map<String, List<EvRecord>> recordsByEv = evRecords.stream()
                .collect(Collectors.groupingBy(EvRecord::getEvId));

        // Group records by Hour (0 to 23)
        Map<Integer, List<EvRecord>> recordsByHour = evRecords.stream()
                .collect(Collectors.groupingBy(EvRecord::getHour));

        // 3. Determine peak demand threshold for the 24-hour profile
        double maxForecast = Arrays.stream(forecastedDemandMw).max().orElse(5000.0);
        double minForecast = Arrays.stream(forecastedDemandMw).min().orElse(3000.0);
        double avgForecast = Arrays.stream(forecastedDemandMw).average().orElse(4000.0);

        // Thresholds: Top 30% of demand range is PEAK, bottom 40% is VALLEY
        double peakThreshold = avgForecast + (maxForecast - avgForecast) * 0.35;
        double valleyThreshold = minForecast + (avgForecast - minForecast) * 0.65;

        boolean[] isPeakHour = new boolean[24];
        boolean[] isValleyHour = new boolean[24];
        for (int h = 0; h < 24; h++) {
            if (forecastedDemandMw[h] >= peakThreshold) {
                isPeakHour[h] = true;
            } else if (forecastedDemandMw[h] <= valleyThreshold) {
                isValleyHour[h] = true;
            }
        }

        // 4. Initialize EV continuous state tracking
        // Map: evId -> current battery energy in kWh
        Map<String, Double> evEnergyMap = new HashMap<>();
        Map<String, Double> evSocMap = new HashMap<>();
        Map<String, Double> evCapacityMap = new HashMap<>();
        Map<String, Double> evRequiredSocMap = new HashMap<>();
        Map<String, Integer> evDepartureMap = new HashMap<>();
        Map<String, Integer> evArrivalMap = new HashMap<>();

        for (Map.Entry<String, List<EvRecord>> entry : recordsByEv.entrySet()) {
            String evId = entry.getKey();
            List<EvRecord> list = entry.getValue();
            list.sort(Comparator.comparingInt(EvRecord::getHour));
            EvRecord first = list.get(0);

            double capacity = first.getBatteryCapacityKwh();
            double initialSoc = first.getSocStartPct() > 0 ? first.getSocStartPct() : first.getSocCurrentPct();
            initialSoc = Math.max(MIN_SAFE_SOC, Math.min(MAX_SAFE_SOC, initialSoc));

            evCapacityMap.put(evId, capacity);
            evSocMap.put(evId, initialSoc);
            evEnergyMap.put(evId, (initialSoc / 100.0) * capacity);
            evRequiredSocMap.put(evId, first.getSocRequiredPct());
            evDepartureMap.put(evId, first.getDepartureHour());
            evArrivalMap.put(evId, first.getArrivalHour());
        }

        // 5. Hourly simulation and optimization
        List<V2gHourlySummary> hourlySummaries = new ArrayList<>();
        List<V2gEvDecision> allDecisions = new ArrayList<>();

        Set<String> participatedEvs = new HashSet<>();
        Set<String> chargedEvs = new HashSet<>();
        Set<String> dischargedEvs = new HashSet<>();

        double totalChargingKwh = 0.0;
        double totalDischargingKwh = 0.0;

        for (int h = 0; h < 24; h++) {
            List<EvRecord> hourlyEvs = recordsByHour.getOrDefault(h, Collections.emptyList());

            double hourChargingKw = 0.0;
            double hourDischargingKw = 0.0;
            int countCharging = 0;
            int countDischarging = 0;
            int countIdle = 0;
            double sumSoc = 0.0;

            String timestampStr = String.format("%s %02d:00:00", date, h);

            for (EvRecord ev : hourlyEvs) {
                String evId = ev.getEvId();
                double capacity = evCapacityMap.getOrDefault(evId, ev.getBatteryCapacityKwh());
                double currentSoc = evSocMap.getOrDefault(evId, ev.getSocCurrentPct());
                double currentEnergy = evEnergyMap.getOrDefault(evId, (currentSoc / 100.0) * capacity);
                double requiredSoc = evRequiredSocMap.getOrDefault(evId, ev.getSocRequiredPct());
                int depHour = evDepartureMap.getOrDefault(evId, ev.getDepartureHour());

                double initialSoc = currentSoc;
                String action = "IDLE";
                double powerKw = 0.0;
                double energyKwh = 0.0;

                boolean connected = ev.isConnectedToGrid();
                boolean v2gEnabled = ev.isV2gEnabled();

                if (!connected) {
                    action = "IDLE";
                    countIdle++;
                } else {
                    // EV is connected to grid.
                    // Calculate hours until departure
                    int hoursToDep = (depHour >= h) ? (depHour - h) : (24 - h + depHour);
                    if (hoursToDep == 0) hoursToDep = 24;

                    double neededEnergyToTarget = Math.max(0.0, (requiredSoc - currentSoc) / 100.0 * capacity);
                    double hoursNeededToCharge = (neededEnergyToTarget > 0 && ev.getChargingPowerKw() > 0)
                            ? neededEnergyToTarget / (ev.getChargingPowerKw() * efficiency)
                            : 0.0;

                    // Absolute safe floor: never discharge below required departure SoC or minimum safe SoC
                    double safeFloorSoc = Math.max(MIN_SAFE_SOC, requiredSoc);

                    // Condition 1: Critical Departure Charging Priority
                    // If remaining hours are just enough or less than needed to reach required departure SoC -> MUST CHARGE
                    if (currentSoc < requiredSoc && hoursToDep <= Math.ceil(hoursNeededToCharge) + 1) {
                        action = "CHARGE";
                        double maxChargePower = ev.getChargingPowerKw();
                        double maxPossibleEnergy = (MAX_SAFE_SOC - currentSoc) / 100.0 * capacity / efficiency;
                        powerKw = Math.min(maxChargePower, maxPossibleEnergy);
                    }
                    // Condition 2: Peak Demand Hour -> Prioritize V2G Discharge (ONLY from surplus above required departure SoC)
                    else if (isPeakHour[h] && v2gEnabled && currentSoc > safeFloorSoc) {
                        double surplusEnergy = (currentSoc - safeFloorSoc) / 100.0 * capacity;
                        double maxDischargePower = Math.min(ev.getDischargingPowerKw(), surplusEnergy * efficiency);

                        if (maxDischargePower >= 0.5) {
                            action = "DISCHARGE";
                            powerKw = maxDischargePower;
                        } else {
                            action = "IDLE";
                        }
                    }
                    // Condition 3: Valley / Low Demand Hour -> Valley Filling Charge
                    else if (isValleyHour[h]) {
                        if (currentSoc < requiredSoc) {
                            action = "CHARGE";
                            double maxChargePower = ev.getChargingPowerKw();
                            double maxEnergyRoom = (MAX_SAFE_SOC - currentSoc) / 100.0 * capacity / efficiency;
                            powerKw = Math.min(maxChargePower, maxEnergyRoom);
                        } else if (currentSoc < 90.0) {
                            // Opportunistic charging during cheap low demand to prepare for next peak
                            action = "CHARGE";
                            double maxChargePower = ev.getChargingPowerKw() * 0.75;
                            double maxEnergyRoom = (90.0 - currentSoc) / 100.0 * capacity / efficiency;
                            powerKw = Math.min(maxChargePower, maxEnergyRoom);
                        } else {
                            action = "IDLE";
                        }
                    }
                    // Condition 4: Normal Demand Hour
                    else {
                        if (currentSoc < requiredSoc && hoursToDep <= hoursNeededToCharge * 1.5) {
                            action = "CHARGE";
                            double maxChargePower = ev.getChargingPowerKw();
                            double maxEnergyRoom = (MAX_SAFE_SOC - currentSoc) / 100.0 * capacity / efficiency;
                            powerKw = Math.min(maxChargePower, maxEnergyRoom);
                        } else {
                            action = "IDLE";
                        }
                    }

                    // Update battery energy and SoC
                    if ("CHARGE".equals(action)) {
                        energyKwh = powerKw * 1.0 * efficiency;
                        currentEnergy = Math.min(capacity, currentEnergy + energyKwh);
                        currentSoc = (currentEnergy / capacity) * 100.0;
                        currentSoc = Math.min(MAX_SAFE_SOC, currentSoc);

                        hourChargingKw += powerKw;
                        countCharging++;
                        participatedEvs.add(evId);
                        chargedEvs.add(evId);
                    } else if ("DISCHARGE".equals(action)) {
                        energyKwh = powerKw * 1.0 / efficiency;
                        currentEnergy = Math.max((MIN_SAFE_SOC / 100.0) * capacity, currentEnergy - energyKwh);
                        currentSoc = (currentEnergy / capacity) * 100.0;
                        currentSoc = Math.max(MIN_SAFE_SOC, currentSoc);

                        hourDischargingKw += powerKw;
                        countDischarging++;
                        participatedEvs.add(evId);
                        dischargedEvs.add(evId);
                    } else {
                        action = "IDLE";
                        powerKw = 0.0;
                        energyKwh = 0.0;
                        countIdle++;
                    }
                }

                // Update maps for next hour
                evSocMap.put(evId, currentSoc);
                evEnergyMap.put(evId, currentEnergy);
                sumSoc += currentSoc;

                allDecisions.add(V2gEvDecision.builder()
                        .evId(evId)
                        .hour(h)
                        .timestamp(timestampStr)
                        .connected(connected)
                        .v2gEnabled(v2gEnabled)
                        .initialSoc(Math.round(initialSoc * 100.0) / 100.0)
                        .finalSoc(Math.round(currentSoc * 100.0) / 100.0)
                        .action(action)
                        .powerKw(Math.round(powerKw * 100.0) / 100.0)
                        .energyKwh(Math.round(energyKwh * 100.0) / 100.0)
                        .batteryCapacityKwh(capacity)
                        .socRequiredPct(requiredSoc)
                        .arrivalHour(ev.getArrivalHour())
                        .departureHour(depHour)
                        .build());
            }

            totalChargingKwh += hourChargingKw * 1.0;
            totalDischargingKwh += hourDischargingKw * 1.0;

            // Convert to MW applying fleetMultiplier for grid demand calculation
            double evChargingMw = (hourChargingKw * fleetMultiplier) / 1000.0;
            double evDischargingMw = (hourDischargingKw * fleetMultiplier) / 1000.0;

            // Phase 7: Grid Demand After V2G = Forecasted Demand + EV Charging - EV Discharge
            double gridDemandAfterV2g = forecastedDemandMw[h] + evChargingMw - evDischargingMw;

            double avgSocHour = hourlyEvs.isEmpty() ? 0.0 : sumSoc / hourlyEvs.size();

            hourlySummaries.add(V2gHourlySummary.builder()
                    .hour(h)
                    .timestamp(timestampStr)
                    .forecastedDemandMw(Math.round(forecastedDemandMw[h] * 100.0) / 100.0)
                    .evChargingPowerKw(Math.round(hourChargingKw * 10.0) / 10.0)
                    .evDischargingPowerKw(Math.round(hourDischargingKw * 10.0) / 10.0)
                    .evChargingPowerMw(Math.round(evChargingMw * 100.0) / 100.0)
                    .evDischargingPowerMw(Math.round(evDischargingMw * 100.0) / 100.0)
                    .gridDemandAfterV2gMw(Math.round(gridDemandAfterV2g * 100.0) / 100.0)
                    .numberOfChargingEVs(countCharging)
                    .numberOfDischargingEVs(countDischarging)
                    .numberOfIdleEVs(countIdle)
                    .averageSoc(Math.round(avgSocHour * 10.0) / 10.0)
                    .isPeakHour(isPeakHour[h])
                    .build());
        }

        // 6. Compute overall metrics (Phase 8)
        double peakBeforeV2g = Arrays.stream(forecastedDemandMw).max().orElse(0.0);
        double peakAfterV2g = hourlySummaries.stream()
                .mapToDouble(V2gHourlySummary::getGridDemandAfterV2gMw)
                .max()
                .orElse(0.0);

        double peakReductionMw = Math.max(0.0, peakBeforeV2g - peakAfterV2g);
        double peakReductionPct = peakBeforeV2g > 0 ? (peakReductionMw / peakBeforeV2g) * 100.0 : 0.0;

        // Check how many EVs met their departure required SoC
        int failedDepartureCount = 0;
        for (Map.Entry<String, Double> entry : evSocMap.entrySet()) {
            String evId = entry.getKey();
            double finalSoc = entry.getValue();
            double reqSoc = evRequiredSocMap.getOrDefault(evId, 60.0);
            if (finalSoc < reqSoc - 0.5) {
                failedDepartureCount++;
            }
        }

        double avgFinalSoc = evSocMap.values().stream().mapToDouble(Double::doubleValue).average().orElse(55.0);
        double minFinalSoc = evSocMap.values().stream().mapToDouble(Double::doubleValue).min().orElse(20.0);

        return V2gOptimizeResponse.builder()
                .date(date)
                .modelUsed(modelName)
                .efficiency(efficiency)
                .fleetMultiplier(fleetMultiplier)
                .peakBeforeV2gMw(Math.round(peakBeforeV2g * 100.0) / 100.0)
                .peakAfterV2gMw(Math.round(peakAfterV2g * 100.0) / 100.0)
                .peakReductionMw(Math.round(peakReductionMw * 100.0) / 100.0)
                .peakReductionPct(Math.round(peakReductionPct * 100.0) / 100.0)
                .totalChargingEnergyKwh(Math.round(totalChargingKwh * 10.0) / 10.0)
                .totalDischargingEnergyKwh(Math.round(totalDischargingKwh * 10.0) / 10.0)
                .totalChargingEnergyMwh(Math.round((totalChargingKwh * fleetMultiplier / 1000.0) * 100.0) / 100.0)
                .totalDischargingEnergyMwh(Math.round((totalDischargingKwh * fleetMultiplier / 1000.0) * 100.0) / 100.0)
                .participatingEvCount(participatedEvs.size())
                .chargingEvCount(chargedEvs.size())
                .dischargingEvCount(dischargedEvs.size())
                .idleEvCount(recordsByEv.size() - participatedEvs.size())
                .averageSoc(Math.round(avgFinalSoc * 10.0) / 10.0)
                .minSoc(Math.round(minFinalSoc * 10.0) / 10.0)
                .failedDepartureSocCount(failedDepartureCount)
                .hourlyResults(hourlySummaries)
                .evDecisions(allDecisions)
                .build();
    }

    /**
     * Obtains the 24-hour demand forecast using the existing forecasting endpoint.
     * If the ML service is unreachable, falls back to a realistic seasonal Delhi demand curve
     * to guarantee robust system availability without crashing.
     */
    private double[] get24HourForecast(String date, String modelName) {
        double[] forecast = new double[24];
        boolean success = false;

        try {
            Map<String, Object> req = Map.of(
                    "start_datetime", date + "T00:00",
                    "hours", 24,
                    "model_name", modelName
            );

            ResponseEntity<?> resp = predictController.forecast(req);
            if (resp.getStatusCode().is2xxSuccessful() && resp.getBody() instanceof Map) {
                @SuppressWarnings("unchecked")
                Map<String, Object> body = (Map<String, Object>) resp.getBody();
                Object dataObj = body.get("data");
                if (dataObj instanceof List) {
                    @SuppressWarnings("unchecked")
                    List<Map<String, Object>> dataList = (List<Map<String, Object>>) dataObj;
                    for (int i = 0; i < Math.min(24, dataList.size()); i++) {
                        Object predObj = dataList.get(i).get("predicted");
                        if (predObj instanceof Number) {
                            forecast[i] = ((Number) predObj).doubleValue();
                        }
                    }
                    success = true;
                    log.info("Successfully fetched 24h forecast from ML model: {}", modelName);
                }
            }
        } catch (Exception e) {
            log.warn("Could not fetch forecast from ML service: {}. Using baseline profile.", e.getMessage());
        }

        if (!success || forecast[0] == 0.0) {
            // Realistic Delhi hourly demand profile (MW)
            // Typical peak in afternoon (14:00 - 16:00) and night (21:00 - 23:00)
            double[] baselineDelhiProfile = {
                    4200.0, 3950.0, 3800.0, 3750.0, 3850.0, 4100.0,
                    4600.0, 5100.0, 5500.0, 5800.0, 6100.0, 6350.0,
                    6500.0, 6700.0, 6850.0, 6600.0, 6300.0, 6100.0,
                    5900.0, 6200.0, 6600.0, 6750.0, 6200.0, 5200.0
            };
            System.arraycopy(baselineDelhiProfile, 0, forecast, 0, 24);
        }

        return forecast;
    }
}

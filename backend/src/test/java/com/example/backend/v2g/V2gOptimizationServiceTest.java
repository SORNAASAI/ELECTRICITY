package com.example.backend.v2g;

import com.example.backend.controller.PredictController;
import com.example.backend.v2g.dto.V2gEvDecision;
import com.example.backend.v2g.dto.V2gOptimizeRequest;
import com.example.backend.v2g.dto.V2gOptimizeResponse;
import com.example.backend.v2g.model.EvRecord;
import com.example.backend.v2g.service.EvDatasetService;
import com.example.backend.v2g.service.V2gOptimizationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class V2gOptimizationServiceTest {

    @Mock
    private EvDatasetService evDatasetService;

    @Mock
    private PredictController predictController;

    private V2gOptimizationService v2gOptimizationService;

    @BeforeEach
    void setUp() {
        v2gOptimizationService = new V2gOptimizationService(evDatasetService, predictController);
    }

    private List<EvRecord> createMockRecordsForSingleEv(
            String evId, boolean connected, boolean v2gEnabled,
            double startSoc, double reqSoc, double capacityKwh,
            double chgPower, double disPower, int arrHour, int depHour) {

        List<EvRecord> records = new ArrayList<>();
        for (int h = 0; h < 24; h++) {
            boolean isPlugged = connected;
            if (connected && (arrHour != 0 || depHour != 23)) {
                if (arrHour <= depHour) {
                    isPlugged = (h >= arrHour && h <= depHour);
                } else {
                    isPlugged = (h >= arrHour || h <= depHour);
                }
            }
            records.add(EvRecord.builder()
                    .evId(evId)
                    .timestamp("2026-08-10 " + String.format("%02d:00:00", h))
                    .date("2026-08-10")
                    .hour(h)
                    .arrivalHour(arrHour)
                    .departureHour(depHour)
                    .connectedToGrid(isPlugged)
                    .batteryCapacityKwh(capacityKwh)
                    .socStartPct(startSoc)
                    .socRequiredPct(reqSoc)
                    .socCurrentPct(startSoc)
                    .chargingPowerKw(chgPower)
                    .dischargingPowerKw(disPower)
                    .v2gEnabled(v2gEnabled)
                    .availableForV2g(v2gEnabled && isPlugged)
                    .chargingAvailable(isPlugged)
                    .energyAvailableKwh(10.0)
                    .maxV2gPowerKw(disPower)
                    .chargingEnergyKwh(chgPower)
                    .dischargingEnergyKwh(0.0)
                    .travelEnergyRequiredKwh(20.0)
                    .build());
        }
        return records;
    }

    private void mockForecast(double peakDemandMw, double valleyDemandMw) {
        List<Map<String, Object>> data = new ArrayList<>();
        for (int h = 0; h < 24; h++) {
            // Peak at hours 14-16, valley at hours 2-4
            double pred = (h >= 14 && h <= 16) ? peakDemandMw : (h >= 2 && h <= 4 ? valleyDemandMw : (peakDemandMw + valleyDemandMw) / 2.0);
            data.add(Map.of("predicted", pred, "time", "10 Aug " + String.format("%02d:00", h)));
        }
        org.mockito.Mockito.doReturn(ResponseEntity.ok(Map.of("data", data)))
                .when(predictController).forecast(any());
    }

    @Test
    @DisplayName("Case 1: High grid demand -> Eligible EV discharges")
    void testHighGridDemandEligibleEvDischarges() {
        mockForecast(7000.0, 3000.0);
        // EV with high SoC (80%), V2G enabled, connected
        List<EvRecord> records = createMockRecordsForSingleEv(
                "EV_001", true, true, 80.0, 60.0, 60.0, 7.4, 5.0, 10, 20);
        when(evDatasetService.getRecordsForDate("2026-08-10")).thenReturn(records);

        V2gOptimizeResponse response = v2gOptimizationService.optimize(
                V2gOptimizeRequest.builder().date("2026-08-10").build());

        assertNotNull(response);
        assertTrue(response.getDischargingEvCount() > 0);
        assertTrue(response.getTotalDischargingEnergyKwh() > 0);

        // Verify that discharge occurred during peak hours (14, 15, or 16)
        boolean dischargedInPeak = response.getEvDecisions().stream()
                .anyMatch(d -> (d.getHour() >= 14 && d.getHour() <= 16) && "DISCHARGE".equals(d.getAction()));
        assertTrue(dischargedInPeak, "EV should discharge during peak demand");
    }

    @Test
    @DisplayName("Case 2: Low grid demand -> EV can charge")
    void testLowGridDemandEvCharges() {
        mockForecast(7000.0, 2500.0);
        // EV with lower SoC (40%), required 70%
        List<EvRecord> records = createMockRecordsForSingleEv(
                "EV_002", true, true, 40.0, 70.0, 60.0, 7.4, 5.0, 0, 8);
        when(evDatasetService.getRecordsForDate("2026-08-10")).thenReturn(records);

        V2gOptimizeResponse response = v2gOptimizationService.optimize(
                V2gOptimizeRequest.builder().date("2026-08-10").build());

        assertNotNull(response);
        assertTrue(response.getChargingEvCount() > 0);
        assertTrue(response.getTotalChargingEnergyKwh() > 0);

        // Verify charging happened in valley hours (2, 3, or 4)
        boolean chargedInValley = response.getEvDecisions().stream()
                .anyMatch(d -> (d.getHour() >= 2 && d.getHour() <= 4) && "CHARGE".equals(d.getAction()));
        assertTrue(chargedInValley, "EV should charge during valley hours");
    }

    @Test
    @DisplayName("Case 3: EV SoC too low -> EV must NOT discharge")
    void testLowSocEvMustNotDischarge() {
        mockForecast(7000.0, 3000.0);
        // EV with critically low SoC (20% = MIN_SAFE_SOC), V2G enabled
        List<EvRecord> records = createMockRecordsForSingleEv(
                "EV_003", true, true, 20.0, 60.0, 60.0, 7.4, 5.0, 10, 22);
        when(evDatasetService.getRecordsForDate("2026-08-10")).thenReturn(records);

        V2gOptimizeResponse response = v2gOptimizationService.optimize(
                V2gOptimizeRequest.builder().date("2026-08-10").build());

        // Under no circumstances should EV with 20% SoC discharge
        boolean anyDischarge = response.getEvDecisions().stream()
                .anyMatch(d -> "DISCHARGE".equals(d.getAction()));
        assertFalse(anyDischarge, "Low SoC EV must not discharge");
    }

    @Test
    @DisplayName("Case 4: EV departure soon -> Charging prioritized")
    void testDepartureSoonPrioritizesCharging() {
        mockForecast(7000.0, 3000.0);
        // EV at hour 14 with SoC 50%, required 75%, but departs at hour 16 (only 2h left)
        List<EvRecord> records = createMockRecordsForSingleEv(
                "EV_004", true, true, 50.0, 75.0, 60.0, 7.4, 5.0, 12, 16);
        when(evDatasetService.getRecordsForDate("2026-08-10")).thenReturn(records);

        V2gOptimizeResponse response = v2gOptimizationService.optimize(
                V2gOptimizeRequest.builder().date("2026-08-10").build());

        // Even though hour 14 is peak, EV needs to reach required departure SoC
        V2gEvDecision hour14Decision = response.getEvDecisions().stream()
                .filter(d -> d.getHour() == 14)
                .findFirst().orElseThrow();

        assertEquals("CHARGE", hour14Decision.getAction(),
                "EV near departure needing charge must CHARGE even during peak");
    }

    @Test
    @DisplayName("Case 5: V2G disabled -> EV cannot discharge")
    void testV2gDisabledCannotDischarge() {
        mockForecast(7000.0, 3000.0);
        // EV with 90% SoC, but v2gEnabled = FALSE
        List<EvRecord> records = createMockRecordsForSingleEv(
                "EV_005", true, false, 90.0, 50.0, 60.0, 7.4, 5.0, 10, 22);
        when(evDatasetService.getRecordsForDate("2026-08-10")).thenReturn(records);

        V2gOptimizeResponse response = v2gOptimizationService.optimize(
                V2gOptimizeRequest.builder().date("2026-08-10").build());

        boolean anyDischarge = response.getEvDecisions().stream()
                .anyMatch(d -> "DISCHARGE".equals(d.getAction()));
        assertFalse(anyDischarge, "V2G-disabled EV cannot discharge");
    }

    @Test
    @DisplayName("Case 6: EV not connected -> EV remains IDLE")
    void testDisconnectedEvRemainsIdle() {
        mockForecast(7000.0, 3000.0);
        // EV connected = FALSE
        List<EvRecord> records = createMockRecordsForSingleEv(
                "EV_006", false, true, 80.0, 60.0, 60.0, 7.4, 5.0, 10, 22);
        when(evDatasetService.getRecordsForDate("2026-08-10")).thenReturn(records);

        V2gOptimizeResponse response = v2gOptimizationService.optimize(
                V2gOptimizeRequest.builder().date("2026-08-10").build());

        boolean allIdle = response.getEvDecisions().stream()
                .allMatch(d -> "IDLE".equals(d.getAction()) && d.getPowerKw() == 0.0);
        assertTrue(allIdle, "Disconnected EV must remain idle with 0 power");
    }

    @Test
    @DisplayName("Case 7: Battery reaches 100% -> No further charging")
    void testBatteryFullNoFurtherCharging() {
        mockForecast(7000.0, 2000.0);
        // EV starting at 100% SoC
        List<EvRecord> records = createMockRecordsForSingleEv(
                "EV_007", true, true, 100.0, 70.0, 50.0, 11.0, 5.0, 0, 23);
        when(evDatasetService.getRecordsForDate("2026-08-10")).thenReturn(records);

        V2gOptimizeResponse response = v2gOptimizationService.optimize(
                V2gOptimizeRequest.builder().date("2026-08-10").build());

        // During valley hours, EV already at 100% must not charge further
        boolean chargedAt100 = response.getEvDecisions().stream()
                .anyMatch(d -> d.getInitialSoc() >= 100.0 && "CHARGE".equals(d.getAction()));
        assertFalse(chargedAt100, "EV at 100% SoC must not charge");
    }

    @Test
    @DisplayName("Case 8: Battery reaches minimum SoC -> No further discharging")
    void testBatteryReachesMinimumSocNoFurtherDischarge() {
        mockForecast(7000.0, 3000.0);
        // EV with 25% SoC, discharging 5kW from 50kWh battery drops it to 20%
        List<EvRecord> records = createMockRecordsForSingleEv(
                "EV_008", true, true, 25.0, 20.0, 50.0, 7.4, 5.0, 10, 23);
        when(evDatasetService.getRecordsForDate("2026-08-10")).thenReturn(records);

        V2gOptimizeResponse response = v2gOptimizationService.optimize(
                V2gOptimizeRequest.builder().date("2026-08-10").build());

        // Check that final SoC across all hours is >= 20.0%
        double minSoc = response.getEvDecisions().stream()
                .mapToDouble(V2gEvDecision::getFinalSoc)
                .min().orElse(0.0);
        assertTrue(minSoc >= 20.0, "SoC must never fall below minimum safe SoC (20%)");
    }

    @Test
    @DisplayName("Case 9: No eligible EVs -> Grid demand remains unchanged")
    void testNoEligibleEvsGridDemandUnchanged() {
        mockForecast(6000.0, 4000.0);
        // All EVs disconnected
        List<EvRecord> records = createMockRecordsForSingleEv(
                "EV_009", false, false, 50.0, 50.0, 50.0, 7.4, 5.0, 0, 23);
        when(evDatasetService.getRecordsForDate("2026-08-10")).thenReturn(records);

        V2gOptimizeResponse response = v2gOptimizationService.optimize(
                V2gOptimizeRequest.builder().date("2026-08-10").build());

        for (var hourly : response.getHourlyResults()) {
            assertEquals(hourly.getForecastedDemandMw(), hourly.getGridDemandAfterV2gMw(), 0.01,
                    "Demand after V2G should equal forecasted demand when no EVs are active");
        }
    }

    @Test
    @DisplayName("Case 10: Discharge energy does not exceed available EV energy")
    void testDischargeEnergyDoesNotExceedAvailableEnergy() {
        mockForecast(8000.0, 3000.0);
        // 50 kWh battery, 30% start SoC = 15 kWh total energy. Min safe is 20% (10 kWh).
        // Max surplus = 5 kWh.
        List<EvRecord> records = createMockRecordsForSingleEv(
                "EV_010", true, true, 30.0, 20.0, 50.0, 7.4, 10.0, 10, 22);
        when(evDatasetService.getRecordsForDate("2026-08-10")).thenReturn(records);

        V2gOptimizeResponse response = v2gOptimizationService.optimize(
                V2gOptimizeRequest.builder().date("2026-08-10").build());

        // Total energy discharged must not exceed 5.5 kWh
        assertTrue(response.getTotalDischargingEnergyKwh() <= 6.0,
                "Discharge energy must not exceed available energy above minimum safe SoC");
    }

    @Test
    @DisplayName("Case 11: End-to-end optimization with real synthetic_ev_v2g_dataset_2026_100EV.csv")
    void testEndToEndWithRealCsv() {
        EvDatasetService realService = new EvDatasetService();
        V2gOptimizationService serviceWithRealCsv = new V2gOptimizationService(realService, predictController);

        // Realistic Delhi evening residential peak at 21:00-23:00 when EVs are connected at home
        List<Map<String, Object>> data = new ArrayList<>();
        for (int h = 0; h < 24; h++) {
            double pred = (h >= 21 && h <= 23) ? 6850.0 : (h >= 11 && h <= 13 ? 3800.0 : 5200.0);
            data.add(Map.of("predicted", pred, "time", "10 Aug " + String.format("%02d:00", h)));
        }
        org.mockito.Mockito.doReturn(ResponseEntity.ok(Map.of("data", data)))
                .when(predictController).forecast(any());

        V2gOptimizeResponse response = serviceWithRealCsv.optimize(
                V2gOptimizeRequest.builder()
                        .date("2026-08-10")
                        .modelName("xgboost")
                        .efficiency(0.90)
                        .fleetMultiplier(1)
                        .build());

        assertNotNull(response);
        assertEquals(24, response.getHourlyResults().size(), "Must contain exactly 24 hourly summaries");
        assertEquals(2400, response.getEvDecisions().size(), "Must contain 2400 individual EV decisions (100 EVs * 24h)");
        assertTrue(response.getParticipatingEvCount() > 0, "At least some EVs must participate in V2G");
        assertTrue(response.getDischargingEvCount() > 0, "Eligible EVs must discharge during peak hours");
        assertTrue(response.getChargingEvCount() > 0, "EVs must charge during low demand hours");
        assertTrue(response.getPeakReductionMw() > 0, "Peak reduction should be positive");
        assertTrue(response.getMinSoc() >= 20.0, "Minimum SoC must never drop below 20%");
        assertEquals(0, response.getFailedDepartureSocCount(), "Zero EVs should fail departure target");
    }
}

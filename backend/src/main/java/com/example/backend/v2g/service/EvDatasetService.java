package com.example.backend.v2g.service;

import com.example.backend.v2g.model.EvRecord;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.io.IOException;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Service
public class EvDatasetService {

    private static final String CSV_FILENAME = "synthetic_ev_v2g_dataset_2026_100EV.csv";
    private final Map<String, List<EvRecord>> dateCache = new ConcurrentHashMap<>();
    private File resolvedCsvFile = null;

    public File getCsvFile() {
        if (resolvedCsvFile != null && resolvedCsvFile.exists()) {
            return resolvedCsvFile;
        }

        String[] candidatePaths = {
            "../" + CSV_FILENAME,
            CSV_FILENAME,
            "c:/Users/DELL/Desktop/Electricity/" + CSV_FILENAME,
            System.getProperty("user.dir") + "/../" + CSV_FILENAME,
            System.getProperty("user.dir") + "/" + CSV_FILENAME
        };

        for (String path : candidatePaths) {
            File f = new File(path);
            if (f.exists() && f.isFile()) {
                resolvedCsvFile = f;
                log.info("Found EV dataset at: {}", f.getAbsolutePath());
                return f;
            }
        }

        throw new IllegalStateException("EV dataset not found: " + CSV_FILENAME + ". Please verify file location.");
    }

    public List<EvRecord> getRecordsForDate(String targetDate) {
        if (dateCache.containsKey(targetDate)) {
            return dateCache.get(targetDate);
        }

        File file = getCsvFile();
        List<EvRecord> records = new ArrayList<>();

        try (BufferedReader reader = new BufferedReader(new FileReader(file))) {
            String headerLine = reader.readLine();
            if (headerLine == null) {
                return Collections.emptyList();
            }

            String line;
            while ((line = reader.readLine()) != null) {
                // Quick check before splitting: line must contain targetDate
                if (!line.contains(targetDate)) {
                    continue;
                }

                String[] parts = line.split(",");
                if (parts.length < 21) {
                    continue;
                }

                String rowDate = parts[2].trim();
                if (!rowDate.equals(targetDate)) {
                    continue;
                }

                try {
                    EvRecord record = EvRecord.builder()
                            .evId(parts[0].trim())
                            .timestamp(parts[1].trim())
                            .date(rowDate)
                            .hour(Integer.parseInt(parts[3].trim()))
                            .arrivalHour(Integer.parseInt(parts[4].trim()))
                            .departureHour(Integer.parseInt(parts[5].trim()))
                            .connectedToGrid(Boolean.parseBoolean(parts[6].trim()))
                            .batteryCapacityKwh(Double.parseDouble(parts[7].trim()))
                            .socStartPct(Double.parseDouble(parts[8].trim()))
                            .socRequiredPct(Double.parseDouble(parts[9].trim()))
                            .socCurrentPct(Double.parseDouble(parts[10].trim()))
                            .chargingPowerKw(Double.parseDouble(parts[11].trim()))
                            .dischargingPowerKw(Double.parseDouble(parts[12].trim()))
                            .v2gEnabled(Boolean.parseBoolean(parts[13].trim()))
                            .availableForV2g(Boolean.parseBoolean(parts[14].trim()))
                            .chargingAvailable(Boolean.parseBoolean(parts[15].trim()))
                            .energyAvailableKwh(Double.parseDouble(parts[16].trim()))
                            .maxV2gPowerKw(Double.parseDouble(parts[17].trim()))
                            .chargingEnergyKwh(Double.parseDouble(parts[18].trim()))
                            .dischargingEnergyKwh(Double.parseDouble(parts[19].trim()))
                            .travelEnergyRequiredKwh(Double.parseDouble(parts[20].trim()))
                            .build();

                    records.add(record);
                } catch (Exception e) {
                    log.warn("Failed to parse row in EV CSV: {}", line, e);
                }
            }

            // Sort by EV_ID and hour
            records.sort(Comparator.comparing(EvRecord::getEvId).thenComparingInt(EvRecord::getHour));

            if (!records.isEmpty()) {
                dateCache.put(targetDate, records);
            }
            log.info("Loaded {} EV records for date {}", records.size(), targetDate);
            return records;

        } catch (IOException e) {
            log.error("Error reading EV dataset CSV", e);
            throw new RuntimeException("Failed to read EV dataset: " + e.getMessage(), e);
        }
    }

    public List<String> getSampleDates() {
        return List.of(
            "2026-08-10",
            "2026-06-15",
            "2026-07-20",
            "2026-01-15",
            "2026-05-10",
            "2026-10-05",
            "2026-12-25"
        );
    }
}

package com.example.backend.v2g.controller;

import com.example.backend.v2g.dto.V2gOptimizeRequest;
import com.example.backend.v2g.dto.V2gOptimizeResponse;
import com.example.backend.v2g.service.EvDatasetService;
import com.example.backend.v2g.service.V2gOptimizationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/v2g")
@CrossOrigin(origins = {"http://localhost:3000", "http://localhost:3001"})
@RequiredArgsConstructor
public class V2gController {

    private final V2gOptimizationService v2gOptimizationService;
    private final EvDatasetService evDatasetService;

    @PostMapping("/optimize")
    public ResponseEntity<?> optimize(@RequestBody(required = false) V2gOptimizeRequest request) {
        try {
            if (request == null) {
                request = new V2gOptimizeRequest();
            }
            V2gOptimizeResponse response = v2gOptimizationService.optimize(request);
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            log.warn("Invalid V2G request: {}", e.getMessage());
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("V2G optimization failed", e);
            return ResponseEntity.internalServerError().body(Map.of("error", "V2G optimization error: " + e.getMessage()));
        }
    }

    @GetMapping("/dates")
    public ResponseEntity<?> getAvailableDates() {
        try {
            return ResponseEntity.ok(Map.of(
                "datasetDateRange", "2026-01-01 to 2026-12-31",
                "sampleDates", evDatasetService.getSampleDates(),
                "totalEvCount", 100,
                "v2gEnabledEvCount", 65
            ));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/health")
    public ResponseEntity<?> health() {
        try {
            boolean csvFound = evDatasetService.getCsvFile().exists();
            return ResponseEntity.ok(Map.of(
                "status", "UP",
                "module", "V2G Optimization",
                "datasetAvailable", csvFound
            ));
        } catch (Exception e) {
            return ResponseEntity.ok(Map.of(
                "status", "DEGRADED",
                "module", "V2G Optimization",
                "error", e.getMessage()
            ));
        }
    }
}

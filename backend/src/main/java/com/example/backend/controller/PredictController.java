package com.example.backend.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

@RestController
@RequestMapping("/api/predict")
@CrossOrigin(origins = "http://localhost:3000")
@RequiredArgsConstructor
public class PredictController {

    private static final String ML_BASE = "http://localhost:8000";
    private final RestTemplate restTemplate;

    @PostMapping
    public ResponseEntity<?> predict(@RequestBody Map<String, Object> body) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);
            ResponseEntity<Map> response = restTemplate.postForEntity(ML_BASE + "/predict", request, Map.class);
            return ResponseEntity.ok(response.getBody());
        } catch (Exception e) {
            return ResponseEntity.status(502).body(
                Map.of("error", "ML service unavailable: " + e.getMessage())
            );
        }
    }

    @GetMapping("/models")
    public ResponseEntity<?> getModels() {
        try {
            Map response = restTemplate.getForObject(ML_BASE + "/models", Map.class);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(502).body(Map.of("error", "ML service unavailable"));
        }
    }

    @GetMapping("/metrics")
    public ResponseEntity<?> getMetrics() {
        try {
            Object response = restTemplate.getForObject(ML_BASE + "/metrics", Object.class);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(502).body(Map.of("error", "ML service unavailable"));
        }
    }

    @GetMapping("/shap")
    public ResponseEntity<?> getShap() {
        try {
            Object response = restTemplate.getForObject(ML_BASE + "/shap", Object.class);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(502).body(Map.of("error", "ML service unavailable"));
        }
    }

    @PostMapping("/forecast")
    public ResponseEntity<?> forecast(@RequestBody Map<String, Object> body) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);
            ResponseEntity<Map> response = restTemplate.postForEntity(ML_BASE + "/forecast", request, Map.class);
            return ResponseEntity.ok(response.getBody());
        } catch (Exception e) {
            return ResponseEntity.status(502).body(Map.of("error", "ML service unavailable: " + e.getMessage()));
        }
    }

    @GetMapping("/recent-demand")
    public ResponseEntity<?> getRecentDemand() {
        try {
            Object response = restTemplate.getForObject(ML_BASE + "/recent-demand", Object.class);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(502).body(Map.of("error", "ML service unavailable"));
        }
    }

    @GetMapping("/dataset-stats")
    public ResponseEntity<?> getDatasetStats() {
        try {
            Object response = restTemplate.getForObject(ML_BASE + "/dataset-stats", Object.class);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(502).body(Map.of("error", "ML service unavailable"));
        }
    }

    @GetMapping("/forecast/peak")
    public ResponseEntity<?> forecastPeak(
            @RequestParam(defaultValue = "xgboost") String model_name,
            @RequestParam(defaultValue = "3") int days) {
        try {
            Object response = restTemplate.getForObject(
                ML_BASE + "/forecast/peak?model_name=" + model_name + "&days=" + days, Object.class);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(502).body(Map.of("error", "ML service unavailable: " + e.getMessage()));
        }
    }

    @GetMapping("/health")
    public ResponseEntity<?> health() {
        try {
            Object response = restTemplate.getForObject(ML_BASE + "/health", Object.class);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(502).body(Map.of("status", "ML service unavailable"));
        }
    }
}

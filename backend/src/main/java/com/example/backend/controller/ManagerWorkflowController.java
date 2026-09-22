package com.example.backend.controller;

import com.example.backend.dto.ManagerRequestDto;
import com.example.backend.dto.RejectRequestDto;
import com.example.backend.dto.SendAlertRequest;
import com.example.backend.model.Manager;
import com.example.backend.model.ManagerAlert;
import com.example.backend.model.ManagerRequest;
import com.example.backend.service.ManagerWorkflowService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = {"http://localhost:3000", "http://localhost:3001"})
@RequiredArgsConstructor
@Slf4j
public class ManagerWorkflowController {

    private final ManagerWorkflowService managerWorkflowService;

    // ── Public endpoint for station managers to submit access requests ───────
    @PostMapping("/manager-requests")
    public ResponseEntity<?> submitRequest(@Valid @RequestBody ManagerRequestDto dto) {
        try {
            ManagerRequest request = managerWorkflowService.submitRequest(dto);
            return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(
                    "message", "Request submitted successfully. Your request is now PENDING review by the Grid Operator.",
                    "request", request
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        } catch (Exception e) {
            log.error("Error submitting manager request: ", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "Failed to submit request. Please try again later."));
        }
    }

    // ── Grid Operator: Get all or filtered requests ──────────────────────────
    @GetMapping("/manager-requests")
    public ResponseEntity<List<ManagerRequest>> getRequests(@RequestParam(required = false) String status) {
        if ("PENDING".equalsIgnoreCase(status)) {
            return ResponseEntity.ok(managerWorkflowService.getPendingRequests());
        }
        return ResponseEntity.ok(managerWorkflowService.getAllRequests());
    }

    // ── Grid Operator: Get pending requests ──────────────────────────────────
    @GetMapping("/manager-requests/pending")
    public ResponseEntity<List<ManagerRequest>> getPendingRequests() {
        return ResponseEntity.ok(managerWorkflowService.getPendingRequests());
    }

    // ── Grid Operator: Accept request and add to manager table ───────────────
    @PutMapping("/manager-requests/{id}/accept")
    public ResponseEntity<?> acceptRequest(@PathVariable Long id, Authentication authentication) {
        String operatorEmail = authentication != null ? authentication.getName() : "Grid Operator";
        try {
            ManagerRequest updated = managerWorkflowService.acceptRequest(id, operatorEmail);
            return ResponseEntity.ok(Map.of(
                    "message", "Manager request accepted successfully and added to manager table.",
                    "request", updated
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        } catch (Exception e) {
            log.error("Error accepting manager request: ", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "Error accepting request."));
        }
    }

    // ── Grid Operator: Reject request ────────────────────────────────────────
    @PutMapping("/manager-requests/{id}/reject")
    public ResponseEntity<?> rejectRequest(@PathVariable Long id,
                                           @RequestBody(required = false) RejectRequestDto reasonDto,
                                           Authentication authentication) {
        String operatorEmail = authentication != null ? authentication.getName() : "Grid Operator";
        String reason = reasonDto != null ? reasonDto.getReason() : null;
        try {
            ManagerRequest updated = managerWorkflowService.rejectRequest(id, operatorEmail, reason);
            return ResponseEntity.ok(Map.of(
                    "message", "Manager request has been rejected.",
                    "request", updated
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        } catch (Exception e) {
            log.error("Error rejecting manager request: ", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "Error rejecting request."));
        }
    }

    // ── Grid Operator: Get active managers from `manager` table ──────────────
    @GetMapping("/managers")
    public ResponseEntity<List<Manager>> getManagers() {
        return ResponseEntity.ok(managerWorkflowService.getActiveManagers());
    }

    // ── Grid Operator: Dispatch alert to accepted managers ───────────────────
    @PostMapping("/managers/alerts")
    public ResponseEntity<?> sendAlert(@Valid @RequestBody SendAlertRequest request, Authentication authentication) {
        String operatorEmail = authentication != null ? authentication.getName() : "Grid Operator";
        try {
            ManagerAlert alert = managerWorkflowService.sendAlertToManagers(request, operatorEmail);
            return ResponseEntity.ok(Map.of(
                    "message", "Alert dispatched to " + alert.getRecipientCount() + " active station managers.",
                    "alert", alert
            ));
        } catch (Exception e) {
            log.error("Error dispatching alert: ", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "Failed to dispatch alert."));
        }
    }

    // ── Grid Operator: Get alert history ─────────────────────────────────────
    @GetMapping("/managers/alerts")
    public ResponseEntity<List<ManagerAlert>> getAlertHistory() {
        return ResponseEntity.ok(managerWorkflowService.getAlertHistory());
    }

    // ── Grid Operator: Get workflow summary stats ────────────────────────────
    @GetMapping("/managers/stats")
    public ResponseEntity<Map<String, Object>> getStats() {
        return ResponseEntity.ok(managerWorkflowService.getWorkflowStats());
    }
}

package com.example.backend.service;

import com.example.backend.dto.ManagerRequestDto;
import com.example.backend.dto.SendAlertRequest;
import com.example.backend.model.Manager;
import com.example.backend.model.ManagerAlert;
import com.example.backend.model.ManagerRequest;
import com.example.backend.repository.ManagerAlertRepository;
import com.example.backend.repository.ManagerRepository;
import com.example.backend.repository.ManagerRequestRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class ManagerWorkflowService {

    private final ManagerRequestRepository managerRequestRepository;
    private final ManagerRepository managerRepository;
    private final ManagerAlertRepository managerAlertRepository;

    @Transactional
    public ManagerRequest submitRequest(ManagerRequestDto dto) {
        log.info("Received station manager request for email: {} and station: {}", dto.getEmail(), dto.getStationName());

        if (managerRequestRepository.existsByEmailAndStatus(dto.getEmail(), "PENDING")) {
            throw new IllegalArgumentException("A pending request for email " + dto.getEmail() + " is already under review.");
        }

        ManagerRequest request = ManagerRequest.builder()
                .name(dto.getName().trim())
                .email(dto.getEmail().trim().toLowerCase())
                .phone(dto.getPhone() != null ? dto.getPhone().trim() : null)
                .stationName(dto.getStationName().trim())
                .stationLocation(dto.getStationLocation().trim())
                .capacityKw(dto.getCapacityKw() != null ? dto.getCapacityKw() : 100.0)
                .evPorts(dto.getEvPorts() != null ? dto.getEvPorts() : 4)
                .notes(dto.getNotes())
                .status("PENDING")
                .submittedAt(LocalDateTime.now())
                .build();

        return managerRequestRepository.save(request);
    }

    public List<ManagerRequest> getPendingRequests() {
        return managerRequestRepository.findByStatusOrderBySubmittedAtDesc("PENDING");
    }

    public List<ManagerRequest> getAllRequests() {
        return managerRequestRepository.findAllByOrderBySubmittedAtDesc();
    }

    @Transactional
    public ManagerRequest acceptRequest(Long requestId, String operatorEmail) {
        log.info("Accepting manager request id: {} by operator: {}", requestId, operatorEmail);

        ManagerRequest request = managerRequestRepository.findById(requestId)
                .orElseThrow(() -> new IllegalArgumentException("Manager request not found with ID: " + requestId));

        request.setStatus("ACCEPTED");
        request.setReviewedAt(LocalDateTime.now());
        request.setReviewedBy(operatorEmail != null ? operatorEmail : "Grid Operator");
        request.setRejectionReason(null);
        ManagerRequest savedRequest = managerRequestRepository.save(request);

        // Add or update entry in the `manager` table
        Manager manager = managerRepository.findByEmail(request.getEmail())
                .orElse(Manager.builder().email(request.getEmail()).build());

        manager.setName(request.getName());
        manager.setPhone(request.getPhone());
        manager.setStationName(request.getStationName());
        manager.setStationLocation(request.getStationLocation());
        manager.setCapacityKw(request.getCapacityKw());
        manager.setEvPorts(request.getEvPorts());
        manager.setActive(true);
        manager.setApprovedAt(LocalDateTime.now());
        manager.setApprovedBy(operatorEmail != null ? operatorEmail : "Grid Operator");
        manager.setRequestId(request.getId());

        managerRepository.save(manager);
        log.info("Successfully added/activated manager in `manager` table for: {}", manager.getEmail());

        return savedRequest;
    }

    @Transactional
    public ManagerRequest rejectRequest(Long requestId, String operatorEmail, String reason) {
        log.info("Rejecting manager request id: {} by operator: {}", requestId, operatorEmail);

        ManagerRequest request = managerRequestRepository.findById(requestId)
                .orElseThrow(() -> new IllegalArgumentException("Manager request not found with ID: " + requestId));

        request.setStatus("REJECTED");
        request.setReviewedAt(LocalDateTime.now());
        request.setReviewedBy(operatorEmail != null ? operatorEmail : "Grid Operator");
        request.setRejectionReason(reason != null && !reason.isBlank() ? reason.trim() : "Application criteria not met.");
        ManagerRequest savedRequest = managerRequestRepository.save(request);

        // Deactivate if previously present in manager table
        managerRepository.findByEmail(request.getEmail()).ifPresent(m -> {
            m.setActive(false);
            managerRepository.save(m);
        });

        return savedRequest;
    }

    public List<Manager> getActiveManagers() {
        return managerRepository.findByActiveTrue();
    }

    public List<Manager> getAllManagers() {
        return managerRepository.findAllByOrderByApprovedAtDesc();
    }

    @Transactional
    public ManagerAlert sendAlertToManagers(SendAlertRequest request, String operatorEmail) {
        // Only accepted and active managers in `manager` table receive alerts
        List<Manager> recipients = managerRepository.findByActiveTrue();
        int recipientCount = recipients.size();

        log.info("Dispatching alert '{}' to {} active managers in `manager` table", request.getTitle(), recipientCount);

        ManagerAlert alert = ManagerAlert.builder()
                .title(request.getTitle().trim())
                .message(request.getMessage().trim())
                .severity(request.getSeverity() != null ? request.getSeverity().toUpperCase() : "WARNING")
                .sentAt(LocalDateTime.now())
                .sentBy(operatorEmail != null ? operatorEmail : "Grid Operator")
                .recipientCount(recipientCount)
                .build();

        return managerAlertRepository.save(alert);
    }

    public List<ManagerAlert> getAlertHistory() {
        return managerAlertRepository.findAllByOrderBySentAtDesc();
    }

    public Map<String, Object> getWorkflowStats() {
        long pendingCount = managerRequestRepository.countByStatus("PENDING");
        long activeManagers = managerRepository.countByActiveTrue();
        List<ManagerAlert> alerts = managerAlertRepository.findAllByOrderBySentAtDesc();
        List<Manager> managers = managerRepository.findByActiveTrue();
        double totalCapacity = managers.stream()
                .mapToDouble(m -> m.getCapacityKw() != null ? m.getCapacityKw() : 0.0)
                .sum();

        Map<String, Object> stats = new HashMap<>();
        stats.put("pendingRequestsCount", pendingCount);
        stats.put("activeManagersCount", activeManagers);
        stats.put("totalAlertsSent", alerts.size());
        stats.put("totalManagedCapacityKw", Math.round(totalCapacity * 10.0) / 10.0);
        return stats;
    }
}

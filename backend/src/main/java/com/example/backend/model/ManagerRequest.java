package com.example.backend.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "manager_requests")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ManagerRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String email;

    private String phone;

    @Column(nullable = false)
    private String stationName;

    @Column(nullable = false)
    private String stationLocation;

    private Double capacityKw;

    private Integer evPorts;

    @Column(length = 1000)
    private String notes;

    @Column(nullable = false)
    private String status; // PENDING, ACCEPTED, REJECTED

    private LocalDateTime submittedAt;

    private LocalDateTime reviewedAt;

    private String reviewedBy;

    @Column(length = 1000)
    private String rejectionReason;

    @PrePersist
    public void prePersist() {
        if (submittedAt == null) {
            submittedAt = LocalDateTime.now();
        }
        if (status == null) {
            status = "PENDING";
        }
    }
}

package com.example.backend.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "manager")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Manager {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false, unique = true)
    private String email;

    private String phone;

    @Column(nullable = false)
    private String stationName;

    @Column(nullable = false)
    private String stationLocation;

    private Double capacityKw;

    private Integer evPorts;

    @Builder.Default
    @Column(nullable = false)
    private boolean active = true;

    private LocalDateTime approvedAt;

    private String approvedBy;

    private Long requestId;
}

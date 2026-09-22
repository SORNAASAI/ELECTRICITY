package com.example.backend.repository;

import com.example.backend.model.Manager;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ManagerRepository extends JpaRepository<Manager, Long> {
    Optional<Manager> findByEmail(String email);
    List<Manager> findByActiveTrue();
    List<Manager> findAllByOrderByApprovedAtDesc();
    long countByActiveTrue();
    boolean existsByEmail(String email);
}

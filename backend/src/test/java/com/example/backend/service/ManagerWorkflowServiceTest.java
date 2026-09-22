package com.example.backend.service;

import com.example.backend.dto.ManagerRequestDto;
import com.example.backend.dto.SendAlertRequest;
import com.example.backend.model.Manager;
import com.example.backend.model.ManagerAlert;
import com.example.backend.model.ManagerRequest;
import com.example.backend.repository.ManagerAlertRepository;
import com.example.backend.repository.ManagerRepository;
import com.example.backend.repository.ManagerRequestRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ManagerWorkflowServiceTest {

    @Mock
    private ManagerRequestRepository managerRequestRepository;

    @Mock
    private ManagerRepository managerRepository;

    @Mock
    private ManagerAlertRepository managerAlertRepository;

    @InjectMocks
    private ManagerWorkflowService service;

    private ManagerRequestDto sampleDto;

    @BeforeEach
    void setUp() {
        sampleDto = ManagerRequestDto.builder()
                .name("Rajesh Sharma")
                .email("rajesh@delhiev.in")
                .phone("+91 9876543210")
                .stationName("Connaught Place Fast Charging Hub")
                .stationLocation("Central Delhi - CP")
                .capacityKw(500.0)
                .evPorts(8)
                .notes("Near Metro Gate 2")
                .build();
    }

    @Test
    void testSubmitRequest_StoredAsPending() {
        when(managerRequestRepository.existsByEmailAndStatus("rajesh@delhiev.in", "PENDING")).thenReturn(false);
        when(managerRequestRepository.save(any(ManagerRequest.class))).thenAnswer(inv -> {
            ManagerRequest req = inv.getArgument(0);
            req.setId(1L);
            return req;
        });

        ManagerRequest created = service.submitRequest(sampleDto);

        assertNotNull(created);
        assertEquals(1L, created.getId());
        assertEquals("PENDING", created.getStatus());
        assertEquals("rajesh@delhiev.in", created.getEmail());
        assertEquals("Connaught Place Fast Charging Hub", created.getStationName());
        verify(managerRequestRepository, times(1)).save(any(ManagerRequest.class));
    }

    @Test
    void testAcceptRequest_AddsToManagerTable() {
        ManagerRequest pendingReq = ManagerRequest.builder()
                .id(10L)
                .name("Vikram Singh")
                .email("vikram@delhiev.in")
                .phone("+91 9123456780")
                .stationName("Dwarka Sector 21 EV Hub")
                .stationLocation("South West Delhi")
                .capacityKw(350.0)
                .evPorts(6)
                .status("PENDING")
                .submittedAt(LocalDateTime.now().minusHours(2))
                .build();

        when(managerRequestRepository.findById(10L)).thenReturn(Optional.of(pendingReq));
        when(managerRequestRepository.save(any(ManagerRequest.class))).thenAnswer(inv -> inv.getArgument(0));
        when(managerRepository.findByEmail("vikram@delhiev.in")).thenReturn(Optional.empty());
        when(managerRepository.save(any(Manager.class))).thenAnswer(inv -> {
            Manager m = inv.getArgument(0);
            m.setId(100L);
            return m;
        });

        ManagerRequest accepted = service.acceptRequest(10L, "operator@delhi.gov.in");

        assertEquals("ACCEPTED", accepted.getStatus());
        assertEquals("operator@delhi.gov.in", accepted.getReviewedBy());
        assertNotNull(accepted.getReviewedAt());

        // Verify manager record was saved to manager table
        verify(managerRepository, times(1)).save(argThat(m ->
                m.getEmail().equals("vikram@delhiev.in") &&
                m.getStationName().equals("Dwarka Sector 21 EV Hub") &&
                m.isActive() &&
                m.getRequestId().equals(10L)
        ));
    }

    @Test
    void testRejectRequest_DoesNotAddToManagerTable() {
        ManagerRequest pendingReq = ManagerRequest.builder()
                .id(20L)
                .name("Anil Verma")
                .email("anil@delhiev.in")
                .stationName("Rohini Hub")
                .stationLocation("North Delhi")
                .status("PENDING")
                .build();

        when(managerRequestRepository.findById(20L)).thenReturn(Optional.of(pendingReq));
        when(managerRequestRepository.save(any(ManagerRequest.class))).thenAnswer(inv -> inv.getArgument(0));
        when(managerRepository.findByEmail("anil@delhiev.in")).thenReturn(Optional.empty());

        ManagerRequest rejected = service.rejectRequest(20L, "operator@delhi.gov.in", "Incomplete location data");

        assertEquals("REJECTED", rejected.getStatus());
        assertEquals("Incomplete location data", rejected.getRejectionReason());
        verify(managerRepository, never()).save(any(Manager.class));
    }

    @Test
    void testSendAlert_OnlyTargetsActiveAcceptedManagers() {
        Manager m1 = Manager.builder().id(1L).email("m1@ev.in").active(true).build();
        Manager m2 = Manager.builder().id(2L).email("m2@ev.in").active(true).build();
        when(managerRepository.findByActiveTrue()).thenReturn(List.of(m1, m2));

        when(managerAlertRepository.save(any(ManagerAlert.class))).thenAnswer(inv -> {
            ManagerAlert a = inv.getArgument(0);
            a.setId(50L);
            return a;
        });

        SendAlertRequest alertReq = SendAlertRequest.builder()
                .title("Peak Load Warning")
                .message("High demand expected at 15:00. Please enable V2G.")
                .severity("CRITICAL")
                .build();

        ManagerAlert alert = service.sendAlertToManagers(alertReq, "operator@delhi.gov.in");

        assertNotNull(alert);
        assertEquals(2, alert.getRecipientCount());
        assertEquals("Peak Load Warning", alert.getTitle());
        assertEquals("CRITICAL", alert.getSeverity());
        verify(managerAlertRepository, times(1)).save(any(ManagerAlert.class));
    }
}
